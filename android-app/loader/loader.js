"use strict";

// SpaceShooter Android loader.
//
// Responsibilities:
//   1. Show boot progress / version / errors (never leave a black screen).
//   2. Check GitHub Releases for a newer, signed, stable web bundle.
//   3. Verify the bundle (Ed25519 signature + SHA-256 + size + entries).
//   4. Activate safely (download first, then set) with rollback protection.
//   5. Always allow the game to start, online or offline.
//
// The game scripts are already loaded from the bundled www/ (built-in
// version), so the app is fully playable offline on first launch.

(function () {
  const cfg = window.SS_UPDATER_CONFIG || {};
  const L = (cfg.limits) || {};
  const Logic = window.SSUpdaterLogic;
  const el = (id) => document.getElementById(id);

  const ui = {
    root: el("loader-root"),
    version: el("ldr-version"),
    status: el("ldr-status"),
    bar: el("ldr-bar"),
    state: el("ldr-state"),
    retry: el("ldr-retry"),
    play: el("ldr-play"),
    error: el("ldr-error")
  };

  let finished = false;

  function setStatus(text) {
    if (ui.status) ui.status.textContent = text;
  }

  function setState(text) {
    if (ui.state) ui.state.textContent = text || "";
  }

  function setProgress(fraction) {
    if (ui.bar) ui.bar.style.width = Math.max(0, Math.min(1, fraction)) * 100 + "%";
  }

  function showError(message, retryable) {
    if (ui.error) {
      ui.error.hidden = false;
      ui.error.textContent = message;
    }

    if (ui.retry) ui.retry.hidden = !retryable;
    setState("");
  }

  // Reveals the game and removes the loader overlay.
  function revealGame() {
    if (finished) return;
    finished = true;

    try {
      if (ui.root) {
        ui.root.classList.add("ldr-hidden");
        setTimeout(() => {
          if (ui.root && ui.root.parentNode) {
            ui.root.parentNode.removeChild(ui.root);
          }
        }, 400);
      }
    } catch (e) {
      /* ignore */
    }
  }

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  function timeout(ms) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms || 15000);
    return { signal: c.signal, done: () => clearTimeout(t) };
  }

  async function fetchWithTimeout(url, ms) {
    const t = timeout(ms);
    try {
      return await fetch(url, {
        signal: t.signal,
        headers: { "Accept": "application/json, application/octet-stream" }
      });
    } finally {
      t.done();
    }
  }

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function hexToBytes(hex) {
    const clean = String(hex).trim().toLowerCase();
    if (!/^[0-9a-f]+$/.test(clean) || clean.length % 2 !== 0) {
      throw new Error("invalid hex");
    }
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return out;
  }

  async function sha256Hex(bytes) {
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Verifies an Ed25519 signature over `payloadBytes` with the embedded key.
  // Returns true/false. Throws if the platform cannot do Ed25519 (so callers
  // can fail closed instead of silently trusting an unverified update).
  async function verifySignature(payloadBytes, signatureB64) {
    if (!cfg.publicKeyB64) {
      throw new Error("no embedded public key configured");
    }

    let supported = false;
    try {
      // Ed25519 in WebCrypto requires Chrome/Android WebView 137+.
      await crypto.subtle.importKey(
        "raw",
        new Uint8Array(32),
        { name: "Ed25519" },
        false,
        ["verify"]
      );
      supported = true;
    } catch (probeErr) {
      supported = false;
    }

    if (!supported) {
      throw new Error(
        "This device's WebView is too old to verify signed updates " +
        "(Ed25519 needs Android WebView 137+). Starting the installed " +
        "version. Update Android System WebView / Chrome to receive " +
        "in-app updates."
      );
    }

    const key = await crypto.subtle.importKey(
      "spki",
      base64ToBytes(cfg.publicKeyB64),
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    return crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      base64ToBytes(signatureB64),
      payloadBytes
    );
  }

  // --------------------------------------------------
  // Version comparison (delegated to the shared logic module)
  // --------------------------------------------------

  const parseSemver = (v) => Logic.parseSemver(v);
  const compareStable = (a, b) => Logic.compareStable(a, b);

  // Current web version: from version.json (built-in) or the active bundle.
  let currentVersion = null;

  async function readCurrentVersion() {
    // Prefer the version reported by the updater (active bundle).
    try {
      const cur = await window.CapacitorUpdater.current();
      if (cur && cur.bundle && cur.bundle.version &&
          cur.bundle.version !== "builtin") {
        return cur.bundle.version;
      }
    } catch (e) {
      /* plugin not available (web) */
    }

    try {
      const r = await fetch("version.json", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j && j.version) return j.version;
      }
    } catch (e) {
      /* ignore */
    }

    return "0.0.0";
  }

  // --------------------------------------------------
  // Update check
  // --------------------------------------------------

  let updating = false;

  async function checkForUpdate() {
    if (updating) return; // prevent parallel update loops
    updating = true;

    try {
      setStatus("Checking for updates…");
      setState("");
      setProgress(0.1);

      let releases;
      try {
        const res = await fetchWithTimeout(cfg.releasesApi, L.requestTimeoutMs);

        if (res.status === 403) {
          // Likely rate-limited. Not fatal.
          setState("Update check skipped (GitHub rate limit).");
          await bootBuiltin();
          return;
        }

        if (!res.ok) {
          setState("Update check failed (" + res.status + ").");
          await bootBuiltin();
          return;
        }

        releases = await res.json();
      } catch (netErr) {
        // Offline or timeout: start the built-in version immediately.
        setState("Offline — starting installed version.");
        await bootBuiltin();
        return;
      }

      if (!Array.isArray(releases) || releases.length === 0) {
        setState("No releases published yet.");
        await bootBuiltin();
        return;
      }

      // Only published, stable (non-draft, non-prerelease) releases.
      const decision = Logic.decide(releases, currentVersion);

      if (decision.action === "no-releases") {
        setState("No stable releases found.");
        await bootBuiltin();
        return;
      }

      if (decision.action === "up-to-date") {
        setState("Already up to date.");
        await bootBuiltin();
        return;
      }

      const latest = decision.release;
      const latestVersion = decision.version;

      setStatus("Update " + latestVersion + " available");
      setProgress(0.25);

      const assets = latest.assets || [];
      const manifestAsset = findAsset(assets, cfg.manifestAssetPrefix);
      const bundleAsset = findAsset(assets, cfg.bundleAssetPrefix);

      if (!manifestAsset || !bundleAsset) {
        showError(
          "The latest release (" + latestVersion + ") is missing its " +
          "web-manifest or web-bundle asset. Continuing with the installed " +
          "version.",
          true
        );
        await bootBuiltin();
        return;
      }

      const manifest = await fetchAndVerifyManifest(manifestAsset, latestVersion);
      setProgress(0.45);

      await downloadAndActivate(manifest, latestVersion);
    } finally {
      updating = false;
    }
  }

  function findAsset(assets, prefix) {
    return assets.find(
      (a) => a && typeof a.name === "string" && a.name.startsWith(prefix)
    );
  }

  async function fetchAndVerifyManifest(asset, expectedVersion) {
    setStatus("Verifying update…");

    const res = await fetchWithTimeout(asset.browser_download_url, L.requestTimeoutMs);
    if (!res.ok) throw new Error("manifest download failed: " + res.status);

    const raw = await res.text();

    if (raw.length > (L.maxManifestBytes || 16384)) {
      throw new Error("manifest too large");
    }

    // Format: <base64 signature>\n<json payload>
    const nl = raw.indexOf("\n");
    if (nl <= 0) throw new Error("malformed manifest (no signature)");

    const signatureB64 = raw.slice(0, nl).trim();
    const payloadText = raw.slice(nl + 1);
    const payloadBytes = new TextEncoder().encode(payloadText);

    const ok = await verifySignature(payloadBytes, signatureB64);
    if (!ok) {
      throw new Error(
        "signature verification failed — the update was not signed by the " +
        "trusted SpaceShooter release key"
      );
    }

    let manifest;
    try {
      manifest = JSON.parse(payloadText);
    } catch (e) {
      throw new Error("manifest is not valid JSON");
    }

    // Validate manifest shape.
    if (!manifest || typeof manifest !== "object") {
      throw new Error("manifest empty");
    }

    if (parseSemver(manifest.version) === null) {
      throw new Error("manifest has no valid semver version");
    }

    if (expectedVersion &&
        compareStable(manifest.version, expectedVersion) !== 0) {
      throw new Error("manifest version does not match release tag");
    }

    if (!/^[0-9a-f]{64}$/.test(String(manifest.sha256 || ""))) {
      throw new Error("manifest has no valid SHA-256");
    }

    if (typeof manifest.size !== "number" || manifest.size <= 0) {
      throw new Error("manifest has no valid size");
    }

    if (manifest.size > (L.maxBundleBytes || 40 * 1024 * 1024)) {
      throw new Error("bundle exceeds size limit");
    }

    if (manifest.size < (L.minBundleBytes || 1024)) {
      throw new Error("bundle smaller than minimum size");
    }

    if (typeof manifest.url !== "string" ||
        !/^https:\/\/github\.com\//.test(manifest.url)) {
      throw new Error("bundle URL must be an https://github.com URL");
    }

    validateEntries(manifest.entries);

    return manifest;
  }

  // Rejects path traversal, absolute paths and dangerous files.
  function validateEntries(entries) {
    return Logic.validateEntries(entries, {
      forbiddenEntryPatterns: cfg.forbiddenEntryPatterns,
      requiredEntry: cfg.requiredEntry
    });
  }

  async function downloadAndActivate(manifest, version) {
    setStatus("Downloading update…");
    setProgress(0.55);

    const Updater = window.CapacitorUpdater;
    if (!Updater) {
      // No native updater (e.g. running in a plain browser): just boot.
      setState("Updater unavailable — starting installed version.");
      await bootBuiltin();
      return;
    }

    // Download to local storage WITHOUT touching the active bundle.
    let bundle;
    try {
      bundle = await Updater.download({
        version: manifest.version,
        url: manifest.url,
        checksum: manifest.sha256
      });
    } catch (e) {
      throw new Error(
        "download failed or checksum mismatch: " + (e && e.message ? e.message : e)
      );
    }

    setProgress(0.8);

    // Independent size validation using the downloaded bundle metadata.
    if (bundle && typeof bundle.size === "number" && bundle.size > 0) {
      if (Math.abs(bundle.size - manifest.size) > 32) {
        try { await Updater.delete(bundle); } catch (_) {}
        throw new Error("downloaded size does not match signed manifest");
      }
    }

    // The bundle is only activated AFTER it has fully downloaded and passed
    // all checks. set() reloads the app into the new version.
    setStatus("Activating update…");
    setProgress(0.95);

    const reload = async () => {
      try {
        await Updater.set(bundle);
      } catch (e) {
        throw new Error("activation failed: " + (e && e.message ? e.message : e));
      }
    };

    // Try immediate activation; fall back to next-start activation.
    try {
      await reload();
    } catch (e) {
      try {
        await Updater.next(bundle);
        setState("Update will be applied on next start.");
        await bootBuiltin();
      } catch (e2) {
        throw new Error("could not queue update: " + (e2 && e2.message ? e2.message : e2));
      }
    }
  }

  // Boots the built-in / active bundle (offline path).
  async function bootBuiltin() {
    setStatus("Starting SpaceShooter…");
    setProgress(1);

    // Tell the updater the current bundle loaded fine, otherwise it will
    // roll back. This must run in both the built-in and updated bundle.
    try {
      if (window.CapacitorUpdater) {
        await window.CapacitorUpdater.notifyAppReady();
      }
    } catch (e) {
      /* ignore */
    }

    // Give the game a moment to initialise before revealing it.
    setTimeout(revealGame, 350);
  }

  // --------------------------------------------------
  // Entry point
  // --------------------------------------------------

  async function start() {
    try {
      currentVersion = await readCurrentVersion();

      if (ui.version) {
        ui.version.textContent = currentVersion;
      }
    } catch (e) {
      currentVersion = "0.0.0";
      if (ui.version) ui.version.textContent = "unknown";
    }

    // If the updater plugin itself reports a failed bundle, reset to a known
    // good version before continuing.
    try {
      if (window.CapacitorUpdater) {
        const failed = await window.CapacitorUpdater.getFailedUpdate();
        if (failed) {
          await window.CapacitorUpdater.reset();
        }
      }
    } catch (e) {
      /* ignore */
    }

    try {
      await checkForUpdate();
    } catch (err) {
      // Any unexpected error: explain it, but never block the game.
      showError(
        (err && err.message ? err.message : String(err)) +
        "\n\nStarting the installed version instead.",
        true
      );
      await bootBuiltin();
    }
  }

  // Wire up the buttons.
  if (ui.play) ui.play.addEventListener("click", revealGame);

  if (ui.retry) {
    ui.retry.addEventListener("click", () => {
      if (ui.error) ui.error.hidden = true;
      if (ui.retry) ui.retry.hidden = true;
      if (ui.play) ui.play.hidden = true;
      start();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
