// Update configuration for the SpaceShooter Android loader.
//
// TRUST MODEL
// -----------
// A SHA-256 checksum alone only proves a download was not corrupted; it does
// NOT prove who produced it. Anyone who can replace the release asset could
// also replace its checksum. To establish trust we verify a detached Ed25519
// signature over the update manifest using the PUBLIC key embedded below.
// The matching PRIVATE key lives only in a GitHub Actions secret and is used
// by the release workflow to sign each manifest. A manifest whose signature
// does not verify is rejected, so a tampered release cannot be activated.
//
// The manifest itself references the bundle URL and its SHA-256. After the
// signature check we additionally verify the downloaded file's SHA-256 and
// size against the signed manifest.

window.SS_UPDATER_CONFIG = {
  // GitHub repository that hosts the releases (owner/name).
  repo: "BSXRay/SpaceShooter",

  // Only stable, non-prerelease releases published here are considered.
  releasesApi:
    "https://api.github.com/repos/BSXRay/SpaceShooter/releases?per_page=20",

  // Manifest assets inside each release.
  manifestAssetPrefix: "web-manifest",
  bundleAssetPrefix: "web-bundle",

  // Embedded trust anchor (Ed25519, SPKI DER, base64). Safe to ship.
  publicKeyB64: "MCowBQYDK2VwAyEAuS9Sn1ehseE/bULpq7q387pre9NNCKB3l7uV6D5PHWM=",

  // Hard limits to reject malformed or hostile bundles early.
  limits: {
    maxManifestBytes: 16 * 1024,            // 16 KiB
    maxBundleBytes: 40 * 1024 * 1024,       // 40 MiB
    minBundleBytes: 1024,                   // 1 KiB
    requestTimeoutMs: 15000,
    downloadTimeoutMs: 60000
  },

  // Files/folders that must NEVER appear in a bundle (path-traversal defense).
  // Bundle entries are validated before activation.
  forbiddenEntryPatterns: [
    /^\.\.(\/|\\)/,
    /(^|\/)\.\.(\/|\\)/,
    /^[a-zA-Z]:/,                 // absolute Windows drive
    /^\//,                        // absolute unix path
    /(^|\/)\.(env|git|ssh)/i,
    /\.(pem|key|p12|keystore|jks)$/i
  ],

  // Expected layout: index.html must exist at the bundle root.
  requiredEntry: "index.html"
};
