"use strict";

// Pure, dependency-free helpers shared by the loader and the tests.
// Exposed as window.SSUpdaterLogic so loader.js (a classic WebView script)
// and the Node test runner can both use it.

(function (root) {
  function parseSemver(v) {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(
      String(v).trim()
    );
    if (!m) return null;
    return {
      major: +m[1],
      minor: +m[2],
      patch: +m[3],
      prerelease: m[4] || null
    };
  }

  function isPrerelease(v) {
    const p = parseSemver(v);
    if (!p) return true;
    return Boolean(p.prerelease);
  }

  function compareStable(a, b) {
    const pa = parseSemver(a);
    const pb = parseSemver(b);
    if (!pa || !pb) return 0;
    for (const k of ["major", "minor", "patch"]) {
      if (pa[k] !== pb[k]) return pa[k] - pb[k];
    }
    return 0;
  }

  // Picks the newest stable (non-draft, non-prerelease, semver) release.
  function pickLatestStable(releases) {
    if (!Array.isArray(releases)) return null;

    const stable = releases.filter(
      (r) =>
        r &&
        !r.draft &&
        !r.prerelease &&
        parseSemver(String(r.tag_name || r.name || "").replace(/^v/, ""))
    );

    if (stable.length === 0) return null;

    stable.sort((a, b) =>
      compareStable(
        String(b.tag_name || b.name).replace(/^v/, ""),
        String(a.tag_name || a.name).replace(/^v/, "")
      )
    );

    return stable[0];
  }

  const DEFAULT_FORBIDDEN = [
    /^\.\.(\/|\\)/,
    /(^|\/)\.\.(\/|\\)/,
    /^[a-zA-Z]:/,
    /^\//,
    /(^|\/)\.(env|git|ssh)/i,
    /\.(pem|key|p12|keystore|jks)$/i
  ];

  // Validates bundle entry names. Throws on the first problem.
  function validateEntries(entries, options) {
    const opts = options || {};
    const patterns = opts.forbiddenEntryPatterns || DEFAULT_FORBIDDEN;
    const required = opts.requiredEntry || "index.html";

    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error("manifest declares no bundle entries");
    }

    for (const entry of entries) {
      if (typeof entry !== "string" || entry.length === 0) {
        throw new Error("invalid entry in manifest");
      }
      if (entry.includes("\\")) {
        throw new Error("backslash in entry path: " + entry);
      }
      for (const re of patterns) {
        if (re.test(entry)) {
          throw new Error("forbidden bundle entry: " + entry);
        }
      }
    }

    if (!entries.includes(required)) {
      throw new Error("bundle is missing " + required + " at its root");
    }

    return true;
  }

  // Decides what to do given current version and available releases.
  // Returns one of: "up-to-date" | "no-releases" | "update".
  function decide(releases, currentVersion) {
    const latest = pickLatestStable(releases);
    if (!latest) return { action: "no-releases" };

    const latestVersion = String(latest.tag_name || latest.name).replace(
      /^v/,
      ""
    );

    if (compareStable(latestVersion, currentVersion) <= 0) {
      return { action: "up-to-date", version: latestVersion };
    }

    return { action: "update", version: latestVersion, release: latest };
  }

  const api = {
    parseSemver,
    isPrerelease,
    compareStable,
    pickLatestStable,
    validateEntries,
    decide,
    DEFAULT_FORBIDDEN
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.SSUpdaterLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
