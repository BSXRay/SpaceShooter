// Generates a fresh Ed25519 keypair for signing OTA update manifests.
//
//   node scripts/keygen.mjs
//
// Output:
//   - public key (base64 SPKI) -> paste into loader/updater-config.js
//   - private key (PEM)        -> store as the SS_UPDATE_SIGNING_KEY secret
//
// NEVER commit the private key. The repository's .gitignore excludes *.pem.

import crypto from "node:crypto";

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

const pubB64 = publicKey
  .export({ type: "spki", format: "der" })
  .toString("base64");

const privPem = privateKey.export({ type: "pkcs8", format: "pem" });

console.log("=== PUBLIC KEY (base64 SPKI) ===");
console.log("Paste this into android-app/loader/updater-config.js:");
console.log('  publicKeyB64: "' + pubB64 + '",');
console.log("");
console.log("=== PRIVATE KEY (PEM) ===");
console.log("Store this as the GitHub Actions secret SS_UPDATE_SIGNING_KEY.");
console.log("Do NOT commit it.");
console.log("");
console.log(privPem);
