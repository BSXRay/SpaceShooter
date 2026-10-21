// Builds the OTA update artifacts for a GitHub Release:
//
//   web-bundle-<version>.zip   the Capacitor web bundle (index.html at root)
//   web-manifest-<version>.txt  <base64 Ed25519 signature>\n<json manifest>
//
// The manifest is the trust anchor the app verifies. Signing uses the
// private key from the SS_UPDATE_SIGNING_KEY env var (a GitHub Actions
// secret). The matching public key is embedded in
// loader/updater-config.js. The private key is NEVER committed.
//
// Usage:
//   node scripts/make-bundle.mjs <version>
//   (env) SS_UPDATE_SIGNING_KEY = PEM private key
//
// If SS_UPDATE_SIGNING_KEY is absent the manifest is still produced with an
// empty signature so the workflow can fail loudly instead of shipping an
// unsigned (untrustworthy) release.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const repoRoot = path.resolve(appRoot, "..");

const version = process.argv[2] || readPkgVersion();

function readPkgVersion() {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(appRoot, "package.json"), "utf8")
  );
  return pkg.version;
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("make-bundle: version must be semver (x.y.z): " + version);
  process.exit(1);
}

const wwwDir = path.join(appRoot, "www");
if (!fs.existsSync(path.join(wwwDir, "index.html"))) {
  console.error("make-bundle: run build:web first (no www/index.html)");
  process.exit(1);
}

const outDir = path.join(appRoot, "dist");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const appId = "io.github.bsxray.spaceshooter";

// 1. Create the plugin-compatible zip via the Capgo CLI (produces a zip the
//    native updater can unpack, plus its SHA-256). The CLI is invoked as a
//    local module entry so we avoid shell quoting issues on Windows.
console.log("make-bundle: zipping bundle " + version);

const capgoBin = path.join(
  appRoot,
  "node_modules",
  "@capgo",
  "cli",
  "dist",
  "index.js"
);

if (!fs.existsSync(capgoBin)) {
  console.error("make-bundle: @capgo/cli not installed (run npm ci)");
  process.exit(1);
}

const cliOut = execFileSync(
  process.execPath,
  [
    capgoBin,
    "bundle", "zip", appId,
    "--path", wwwDir,
    "--bundle", version,
    "--json"
  ],
  { cwd: appRoot, encoding: "utf8" }
);

// The CLI prints some log lines before the JSON; grab the JSON object.
const jsonStart = cliOut.indexOf("{");
const cliJson = JSON.parse(cliOut.slice(jsonStart));

const builtZip = path.join(appRoot, cliJson.filename);
if (!fs.existsSync(builtZip)) {
  console.error("make-bundle: CLI did not produce " + builtZip);
  process.exit(1);
}

// 2. Verify the CLI checksum by recomputing it ourselves.
const zipBytes = fs.readFileSync(builtZip);
const sha256 = crypto.createHash("sha256").update(zipBytes).digest("hex");

if (cliJson.checksum && cliJson.checksum !== sha256) {
  console.error(
    "make-bundle: checksum mismatch (CLI " + cliJson.checksum +
    " vs computed " + sha256 + ")"
  );
  process.exit(1);
}

// 3. Compute the entry list for entry validation in the app.
const entries = listZipEntries(builtZip);

const bundleName = "web-bundle-" + version + ".zip";
const bundlePath = path.join(outDir, bundleName);
fs.renameSync(builtZip, bundlePath);

// 4. Build the manifest. Its URL points at the GitHub release asset that
//    the workflow will upload with this exact name.
const repo = "BSXRay/SpaceShooter";
const tag = "v" + version;

const manifest = {
  version,
  sha256,
  size: zipBytes.length,
  url:
    "https://github.com/" + repo + "/releases/download/" + tag + "/" +
    bundleName,
  entries,
  createdAt: new Date().toISOString()
};

const payload = JSON.stringify(manifest);

// 5. Sign the manifest payload (detached Ed25519 over the exact bytes).
const signingKey = process.env.SS_UPDATE_SIGNING_KEY;
let signatureB64 = "";

if (signingKey) {
  const key = crypto.createPrivateKey(signingKey);
  const sig = crypto.sign(null, Buffer.from(payload, "utf8"), key);
  signatureB64 = sig.toString("base64");
  console.log("make-bundle: manifest signed");
} else {
  console.warn(
    "make-bundle: WARNING no SS_UPDATE_SIGNING_KEY — manifest is UNSIGNED"
  );
}

const manifestText = signatureB64 + "\n" + payload + "\n";
const manifestName = "web-manifest-" + version + ".txt";
const manifestPath = path.join(outDir, manifestName);
fs.writeFileSync(manifestPath, manifestText);

// 6. Also expose the public key fingerprint for reference/debugging.
const pubKeyPath = path.join(appRoot, "loader", "updater-config.js");
const pubMatch = fs
  .readFileSync(pubKeyPath, "utf8")
  .match(/publicKeyB64:\s*"([^"]+)"/);
const pubFingerprint = pubMatch
  ? crypto.createHash("sha256")
      .update(Buffer.from(pubMatch[1], "base64"))
      .digest("hex")
      .slice(0, 16)
  : "unknown";

fs.writeFileSync(
  path.join(outDir, "release-info.json"),
  JSON.stringify(
    {
      version,
      bundle: bundleName,
      manifest: manifestName,
      sha256,
      size: zipBytes.length,
      signed: Boolean(signatureB64),
      publicKeyFingerprint: pubFingerprint
    },
    null,
    2
  ) + "\n"
);

console.log("make-bundle: wrote " + bundlePath);
console.log("make-bundle: wrote " + manifestPath);
console.log("make-bundle: sha256 " + sha256);

// --------------------------------------------------

function listZipEntries(zipFile) {
  // Minimal ZIP central-directory reader (no external dependency): parses
  // the End Of Central Directory record and the central directory entries.
  const buf = fs.readFileSync(zipFile);
  const eocd = findEocd(buf);
  if (eocd < 0) throw new Error("not a zip file");

  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const names = [];

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("bad central directory at " + offset);
    }
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLen);
    names.push(name);
    offset += 46 + nameLen + extraLen + commentLen;
  }

  return names.filter((n) => !n.endsWith("/"));
}

function findEocd(buf) {
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65535; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}
