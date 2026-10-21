// Integration tests for the loader boot/update flow using mocked
// window/document/fetch/CapacitorUpdater. Validates:
//   - offline start (fetch rejects)
//   - rate-limited start (HTTP 403)
//   - no releases
//   - up-to-date
//   - valid signed update -> downloaded -> activated
//   - unsigned/tampered manifest -> rejected, falls back to built-in
//   - webview without Ed25519 -> fails closed (no update), still boots
//
// Loaded by run-tests.mjs.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const loaderDir = path.resolve(here, "..", "loader");

export function runLoaderTests(report) {
  const logicSrc = fs.readFileSync(
    path.join(loaderDir, "update-logic.js"),
    "utf8"
  );

  // Build the public/private key pair used by the tests, and a config that
  // embeds the matching public key.
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pubB64 = publicKey
    .export({ type: "spki", format: "der" })
    .toString("base64");

  const configSrc = `
    window.SS_UPDATER_CONFIG = {
      repo: "BSXRay/SpaceShooter",
      releasesApi: "https://api.github.com/repos/BSXRay/SpaceShooter/releases?per_page=20",
      manifestAssetPrefix: "web-manifest",
      bundleAssetPrefix: "web-bundle",
      publicKeyB64: "${pubB64}",
      limits: { maxManifestBytes: 16384, maxBundleBytes: 41943040, minBundleBytes: 1024, requestTimeoutMs: 15000, downloadTimeoutMs: 60000 },
      forbiddenEntryPatterns: [
        /^\\.\\.(\\/|\\\\)/, /(^|\\/)\\.\\.(\\/|\\\\)/, /^[a-zA-Z]:/, /^\\//,
        /(^|\\/)\\.(env|git|ssh)/i, /\\.(pem|key|p12|keystore|jks)$/i
      ],
      requiredEntry: "index.html"
    };
  `;

  const loaderSrc = fs.readFileSync(path.join(loaderDir, "loader.js"), "utf8");

  // A signed manifest + matching bundle metadata for the "valid update" case.
  const payload = JSON.stringify({
    version: "1.2.0",
    sha256: "a".repeat(64),
    size: 2048,
    url: "https://github.com/BSXRay/SpaceShooter/releases/download/v1.2.0/web-bundle-1.2.0.zip",
    entries: ["index.html", "js/game.js"],
    createdAt: "2026-01-01T00:00:00.000Z"
  });
  const sig = crypto.sign(null, Buffer.from(payload), privateKey).toString("base64");

  function makeReleases() {
    return [
      {
        tag_name: "v1.2.0",
        draft: false,
        prerelease: false,
        assets: [
          {
            name: "web-manifest-1.2.0.txt",
            browser_download_url: "https://example.test/manifest"
          },
          {
            name: "web-bundle-1.2.0.zip",
            browser_download_url: "https://example.test/bundle"
          }
        ]
      }
    ];
  }

  async function runScenario(name, opts) {
    const calls = { download: 0, set: 0, next: 0, notify: 0, reset: 0 };

    // Resolved on the first terminal action so we don't depend on a fixed
    // number of event-loop ticks (which varies across Node/CI versions).
    let signalDone;
    const done = new Promise((r) => { signalDone = r; });

    const root = {
      // ---- element stubs ----
      getElementById: () => makeEl(),
      addEventListener: () => {},
      readyState: "complete"
    };

    function makeEl() {
      return {
        hidden: false,
        className: "",
        textContent: "",
        style: {},
        classList: { add() {}, remove() {} },
        addEventListener() {},
        parentNode: { removeChild() {} }
      };
    }

    const updater = {
      current: async () => ({ bundle: { version: "1.0.0" } }),
      getFailedUpdate: async () => opts.failed || null,
      reset: async () => { calls.reset++; signalDone(); },
      notifyAppReady: async () => { calls.notify++; signalDone(); },
      download: async (o) => {
        calls.download++;
        if (opts.downloadReject) throw new Error("checksum mismatch");
        return { version: o.version, size: 2048 };
      },
      set: async () => {
        calls.set++;
        signalDone();
        if (opts.setReject) throw new Error("set failed");
      },
      next: async () => { calls.next++; signalDone(); },
      delete: async () => {}
    };

    const sandbox = {
      console,
      Math,
      JSON,
      TextEncoder,
      Uint8Array,
      Array,
      Object,
      String,
      Number,
      RegExp,
      Date,
      setTimeout: (fn) => { /* do not fire reveal timers */ return 0; },
      clearTimeout: () => {},
      AbortController,
      atob: (b64) => Buffer.from(b64, "base64").toString("binary"),
      crypto: {
        subtle: opts.noEd25519
          ? {
              importKey: async () => { throw new Error("not supported"); },
              verify: async () => false,
              digest: async () => new ArrayBuffer(32)
            }
          : crypto.webcrypto.subtle
      },
      window: {
        SS_UPDATER_CONFIG: undefined,
        CapacitorUpdater: opts.noUpdater ? undefined : updater,
        addEventListener: () => {},
        matchMedia: () => ({ matches: false })
      },
      document: {
        getElementById: (id) => makeEl(),
        addEventListener: () => {},
        readyState: "complete"
      },
      fetch: async (url) => {
        if (opts.offline) throw new Error("network down");
        if (url.includes("releases")) {
          if (opts.rateLimited) {
            return { ok: false, status: 403, json: async () => [] };
          }
          return {
            ok: true,
            status: 200,
            json: async () => opts.releases || makeReleases()
          };
        }
        if (url === "version.json") {
          return { ok: true, json: async () => ({ version: "1.0.0" }) };
        }
        if (url === "https://example.test/manifest") {
          // Must match the released format exactly: make-bundle.mjs writes
          // "<signature>\n<payload>\n" (with a trailing newline) while the
          // signature covers the payload without it.
          const body = opts.unsigned
            ? "not-a-signature\n" + payload + "\n"
            : opts.tamperedManifest
              ? sig + "\n" + payload.replace("1.2.0", "9.9.9") + "\n"
              : sig + "\n" + payload + "\n";
          return { ok: true, status: 200, text: async () => body };
        }
        return { ok: true, status: 200, text: async () => "" };
      }
    };

    sandbox.window.window = sandbox.window;
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);

    vm.runInContext(logicSrc, sandbox);
    vm.runInContext(configSrc, sandbox);
    // Ensure window.crypto.self reference used by webcrypto.subtle works:
    sandbox.window.crypto = sandbox.crypto;

    vm.runInContext(loaderSrc, sandbox, { filename: "loader.js" });

    // Wait for the boot chain to reach a terminal action (notify/set/reset/
    // next). Fall back to draining the event loop if none happens.
    const timeout = new Promise((r) => setTimeout(r, 4000));
    await Promise.race([done, timeout]);
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setImmediate(r));
    }

    return { calls };
  }

  async function tests() {
    await report("loader: offline start boots and does not download", async () => {
      const { calls } = await runScenario("offline", { offline: true });
      assert(calls.download === 0, "must not download offline");
      assert(calls.notify === 1, "must notifyAppReady (boot built-in)");
    });

    await report("loader: HTTP 403 rate limit boots without download", async () => {
      const { calls } = await runScenario("403", { rateLimited: true });
      assert(calls.download === 0, "must not download on 403");
      assert(calls.notify === 1, "must boot built-in");
    });

    await report("loader: no releases boots without download", async () => {
      const { calls } = await runScenario("none", { releases: [] });
      assert(calls.download === 0, "must not download");
      assert(calls.notify === 1, "must boot built-in");
    });

    await report("loader: up-to-date boots without download", async () => {
      const { calls } = await runScenario("uptodate", {
        releases: [
          { tag_name: "v0.9.0", draft: false, prerelease: false, assets: [] }
        ]
      });
      assert(calls.download === 0, "must not download");
      assert(calls.notify === 1, "must boot built-in");
    });

    await report("loader: valid signed update is downloaded and activated", async () => {
      const { calls } = await runScenario("valid", {});
      assert(calls.download === 1, "must download once");
      assert(calls.set === 1, "must activate with set()");
    });

    await report("loader: unsigned manifest is rejected (no activation)", async () => {
      const { calls } = await runScenario("unsigned", { unsigned: true });
      assert(calls.download === 0, "must not download unsigned update");
      assert(calls.set === 0, "must not activate");
      assert(calls.notify === 1, "must still boot built-in");
    });

    await report("loader: tampered manifest is rejected (no activation)", async () => {
      const { calls } = await runScenario("tampered", {
        tamperedManifest: true
      });
      assert(calls.download === 0, "must not download tampered update");
      assert(calls.set === 0, "must not activate");
      assert(calls.notify === 1, "must still boot built-in");
    });

    await report("loader: failed bundle triggers reset before boot", async () => {
      const { calls } = await runScenario("failed", {
        failed: { id: "x", version: "0.0.0" },
        releases: []
      });
      assert(calls.reset === 1, "must reset known-bad bundle");
      assert(calls.notify === 1, "must boot");
    });

    await report("loader: webview without Ed25519 fails closed (no update)", async () => {
      const { calls } = await runScenario("no-ed25519", { noEd25519: true });
      assert(calls.download === 0, "must not download without Ed25519");
      assert(calls.set === 0, "must not activate");
      assert(calls.notify === 1, "must still boot built-in");
    });

    await report("loader: missing updater plugin boots built-in", async () => {
      const { calls } = await runScenario("no-updater", { noUpdater: true });
      assert(calls.notify === 0, "no plugin means no notify");
    });
  }

  return tests();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}
