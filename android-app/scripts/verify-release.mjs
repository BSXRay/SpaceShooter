// Verifies a built release the same way the app does:
//   1. manifest signature (Ed25519) against the embedded public key
//   2. manifest <-> bundle SHA-256 and size
//   3. bundle entry safety (path traversal / dangerous files)
//   4. required index.html at the root
//
// Also supports negative tests via flags. Exits non-zero on any failure.
//
// Usage:
//   node scripts/verify-release.mjs <version>
//   node scripts/verify-release.mjs <version> --tamper-manifest
//   node scripts/verify-release.mjs <version> --tamper-bundle
//   node scripts/verify-release.mjs <version> --bad-entries

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");

const version = process.argv[2];
const flags = process.argv.slice(3);

if (!version) {
  console.error("verify-release: missing <version>");
  process.exit(2);
}

// Load the public key exactly as the app embeds it.
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

const distDir = path.join(appRoot, "dist");
const bundlePath = path.join(distDir, "web-bundle-" + version + ".zip");
const manifestPath = path.join(distDir, "web-manifest-" + version + ".txt");

if (!fs.existsSync(bundlePath)) fail("missing " + bundlePath);
if (!fs.existsSync(manifestPath)) fail("missing " + manifestPath);

const manifestText = fs.readFileSync(manifestPath, "utf8");
const nl = manifestText.indexOf("\n");
let signatureB64 = manifestText.slice(0, nl).trim();
const payloadText = manifestText.slice(nl + 1).trimEnd();
const payloadBytes = Buffer.from(payloadText, "utf8");

let manifest = JSON.parse(payloadText);

let failures = 0;

// ---- 1. signature --------------------------------------------------------
if (flags.includes("--tamper-manifest")) {
  // Flip a byte in the payload so the signature no longer matches.
  const tampered = JSON.parse(payloadText);
  tampered.version = "9.9.9";
  manifest = tampered;
}

const payloadToCheck = flags.includes("--tamper-manifest")
  ? Buffer.from(JSON.stringify(manifest), "utf8")
  : payloadBytes;

const sigOk = crypto.verify(
  null,
  payloadToCheck,
  publicKey,
  Buffer.from(signatureB64, "base64")
);

check("manifest signature valid", sigOk);

// ---- 2. checksum + size --------------------------------------------------
const zipBytes = fs.readFileSync(bundlePath);

if (flags.includes("--tamper-bundle")) {
  // Corrupt the bundle so it no longer matches the manifest.
  zipBytes[Math.floor(zipBytes.length / 2)] ^= 0xff;
}

const bundleSha = crypto
  .createHash("sha256")
  .update(zipBytes)
  .digest("hex");

check("bundle sha256 matches manifest", bundleSha === manifest.sha256);
check("bundle size matches manifest", zipBytes.length === manifest.size);

// ---- 3. entry safety -----------------------------------------------------
const forbidden = [
  /^\.\.(\/|\\)/,
  /(^|\/)\.\.(\/|\\)/,
  /^[a-zA-Z]:/,
  /^\//,
  /(^|\/)\.(env|git|ssh)/i,
  /\.(pem|key|p12|keystore|jks)$/i
];

let entries = Array.isArray(manifest.entries) ? manifest.entries.slice() : [];

if (flags.includes("--bad-entries")) {
  entries.push("../../etc/passwd");
}

let unsafe = entries.filter((e) =>
  typeof e !== "string" || forbidden.some((re) => re.test(e))
);

check("no forbidden bundle entries", unsafe.length === 0);
check("index.html present at root", entries.includes("index.html"));

// ---- result --------------------------------------------------------------
if (flags.length > 0) {
  // Negative-test mode: the specific control must catch the tamper.
  if (flags.includes("--tamper-manifest")) {
    if (sigOk) {
      console.error("verify-release: FAILED — tampered manifest verified OK");
      process.exit(1);
    }
    console.log("verify-release: OK (tampered manifest rejected by signature)");
    process.exit(0);
  }

  if (flags.includes("--tamper-bundle")) {
    const caught = !(bundleSha === manifest.sha256);
    if (!caught) {
      console.error("verify-release: FAILED — tampered bundle checksum matched");
      process.exit(1);
    }
    console.log("verify-release: OK (tampered bundle rejected by sha256)");
    process.exit(0);
  }

  if (flags.includes("--bad-entries")) {
    const caught = unsafe.length > 0 || !entries.includes("index.html");
    if (!caught) {
      console.error("verify-release: FAILED — unsafe entries not detected");
      process.exit(1);
    }
    console.log("verify-release: OK (unsafe entries rejected)");
    process.exit(0);
  }
}

if (failures > 0) {
  console.error("verify-release: FAILED (" + failures + " check(s))");
  process.exit(1);
}

console.log("verify-release: OK (version " + manifest.version + ")");

function check(name, ok) {
  console.log((ok ? "OK  " : "FAIL ") + name);
  if (!ok) failures++;
}

function fail(msg) {
  console.error("verify-release: " + msg);
  process.exit(2);
}
