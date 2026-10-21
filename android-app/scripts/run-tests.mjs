// Automated tests for the SpaceShooter Android loader.
// Runs pure-logic tests plus (when a built release exists) the same
// verification the app performs. Exits non-zero on failure.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { runLoaderTests } from "./loader-tests.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const require = createRequire(import.meta.url);

const Logic = require(path.join(appRoot, "loader", "update-logic.js"));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("OK   " + name);
  } catch (e) {
    failed++;
    console.log("FAIL " + name + ": " + e.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function assertThrows(fn, msg) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
  }
  assert(threw, msg || "expected function to throw");
}

// --------------------------------------------------
// semver
// --------------------------------------------------

test("parseSemver valid/invalid", () => {
  assert(Logic.parseSemver("1.2.3").major === 1, "major");
  assert(Logic.parseSemver("1.2.3").patch === 3, "patch");
  assert(Logic.parseSemver("1.2.3-beta.1").prerelease === "beta.1", "pre");
  assert(Logic.parseSemver("v1.2.3") === null, "leading v rejected");
  assert(Logic.parseSemver("1.2") === null, "short rejected");
  assert(Logic.parseSemver("abc") === null, "junk rejected");
});

test("compareStable ordering", () => {
  assert(Logic.compareStable("1.2.3", "1.2.4") < 0, "patch order");
  assert(Logic.compareStable("1.3.0", "1.2.9") > 0, "minor order");
  assert(Logic.compareStable("2.0.0", "1.9.9") > 0, "major order");
  assert(Logic.compareStable("1.0.0", "1.0.0") === 0, "equal");
});

test("isPrerelease", () => {
  assert(Logic.isPrerelease("1.0.0-beta") === true, "beta");
  assert(Logic.isPrerelease("1.0.0") === false, "stable");
  assert(Logic.isPrerelease("nonsense") === true, "junk treated as pre");
});

// --------------------------------------------------
// release selection
// --------------------------------------------------

test("pickLatestStable ignores draft/prerelease", () => {
  const releases = [
    { tag_name: "v1.2.0", draft: true, prerelease: false },
    { tag_name: "v1.1.0", draft: false, prerelease: true },
    { tag_name: "v1.0.5", draft: false, prerelease: false },
    { tag_name: "v1.0.10", draft: false, prerelease: false }
  ];
  const latest = Logic.pickLatestStable(releases);
  assert(latest.tag_name === "v1.0.10", "picked " + latest.tag_name);
});

test("pickLatestStable returns null when none stable", () => {
  assert(
    Logic.pickLatestStable([
      { tag_name: "v1.0.0", prerelease: true },
      { tag_name: "garbage", prerelease: false }
    ]) === null,
    "expected null"
  );
});

test("decide: up-to-date / update / no-releases", () => {
  const rel = [{ tag_name: "v2.0.0", draft: false, prerelease: false }];
  assert(Logic.decide(rel, "2.0.0").action === "up-to-date", "equal");
  assert(Logic.decide(rel, "1.9.9").action === "update", "update");
  assert(Logic.decide(rel, "2.0.1").action === "up-to-date", "newer local");
  assert(Logic.decide([], "1.0.0").action === "no-releases", "empty");
  assert(
    Logic.decide([{ tag_name: "v1.0.0", prerelease: true }], "0.1.0").action ===
      "no-releases",
    "pre only"
  );
});

// --------------------------------------------------
// entry validation
// --------------------------------------------------

test("validateEntries accepts a normal bundle", () => {
  assert(
    Logic.validateEntries(
      ["index.html", "js/game.js", "images/x.png", "sounds/y.mp3"],
      {}
    ) === true,
    "should accept"
  );
});

test("validateEntries requires index.html", () => {
  assertThrows(
    () => Logic.validateEntries(["js/game.js"], {}),
    "missing index.html must throw"
  );
});

test("validateEntries rejects path traversal", () => {
  for (const bad of [
    "../evil.js",
    "js/../../evil.js",
    "/etc/passwd",
    "C:/Windows/system32",
    ".env",
    "keys/server.pem",
    "app.keystore"
  ]) {
    assertThrows(
      () => Logic.validateEntries(["index.html", bad], {}),
      "should reject " + bad
    );
  }
});

test("validateEntries rejects empty list", () => {
  assertThrows(() => Logic.validateEntries([], {}));
});

// --------------------------------------------------
// manifest signature round-trip (the app's trust check)
// --------------------------------------------------

test("Ed25519 manifest signature round-trip + tamper rejection", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

  const payload = JSON.stringify({
    version: "1.0.0",
    sha256: "a".repeat(64),
    size: 1234,
    url: "https://github.com/BSXRay/SpaceShooter/releases/download/v1.0.0/x.zip",
    entries: ["index.html"]
  });

  const sig = crypto.sign(null, Buffer.from(payload), privateKey);
  const ok = crypto.verify(
    null,
    Buffer.from(payload),
    publicKey,
    sig
  );
  assert(ok, "valid signature must verify");

  const tampered = Buffer.from(payload.replace("1.0.0", "9.9.9"));
  const bad = crypto.verify(null, tampered, publicKey, sig);
  assert(!bad, "tampered payload must NOT verify");

  // Wrong key must not verify.
  const other = crypto.generateKeyPairSync("ed25519");
  const wrong = crypto.verify(
    null,
    Buffer.from(payload),
    other.publicKey,
    sig
  );
  assert(!wrong, "wrong key must NOT verify");
});

// --------------------------------------------------
// built-release verification (if dist exists)
// --------------------------------------------------

const version = JSON.parse(
  fs.readFileSync(path.join(appRoot, "version.json"), "utf8")
).version;

const distBundle = path.join(
  appRoot,
  "dist",
  "web-bundle-" + version + ".zip"
);

if (fs.existsSync(distBundle)) {
  console.log("---- release artifact checks (version " + version + ") ----");

  const cfgSrc = fs.readFileSync(
    path.join(appRoot, "loader", "updater-config.js"),
    "utf8"
  );
  const pubB64 = cfgSrc.match(/publicKeyB64:\s*"([^"]+)"/)[1];
  const publicKey = crypto.createPublicKey({
    key: Buffer.from(pubB64, "base64"),
    format: "der",
    type: "spki"
  });

  const manifestText = fs.readFileSync(
    path.join(appRoot, "dist", "web-manifest-" + version + ".txt"),
    "utf8"
  );
  const nl = manifestText.indexOf("\n");
  const sigB64 = manifestText.slice(0, nl).trim();
  const payload = manifestText.slice(nl + 1).trimEnd();
  const manifest = JSON.parse(payload);

  test("bundled manifest signature verifies against embedded key", () => {
    const ok = crypto.verify(
      null,
      Buffer.from(payload),
      publicKey,
      Buffer.from(sigB64, "base64")
    );
    assert(ok, "signature invalid");
  });

  test("bundle sha256 matches signed manifest", () => {
    const sha = crypto
      .createHash("sha256")
      .update(fs.readFileSync(distBundle))
      .digest("hex");
    assert(sha === manifest.sha256, "sha mismatch");
  });

  test("bundle entries are safe", () => {
    assert(Logic.validateEntries(manifest.entries, {}) === true, "unsafe");
  });
} else {
  console.log("---- no dist/ artifacts; skipping release checks ----");
}

// --------------------------------------------------

async function main() {
  // Loader integration tests (async).
  await runLoaderTests(async (name, fn) => {
    try {
      await fn();
      passed++;
      console.log("OK   " + name);
    } catch (e) {
      failed++;
      console.log("FAIL " + name + ": " + e.message);
    }
  });

  console.log("");
  console.log("tests: " + passed + " passed, " + failed + " failed");

  if (failed > 0) process.exit(1);
}

main();
