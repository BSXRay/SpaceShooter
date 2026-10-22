// Stages the Capacitor web bundle into android-app/www from the SINGLE
// shared web codebase (web/, images/, sounds/) plus a generated
// version.json. This mirrors .github/workflows/pages.yml so the website
// and the app always ship the same files.
//
// The only difference from the website is that the Android bundle gets the
// loader injected into index.html (a small overlay + script). The original
// web/index.html is never modified.
//
// The bundle layout (index.html at the root) is exactly what Capacitor
// and @capgo/capacitor-updater expect.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");        // android-app/
const repoRoot = path.resolve(appRoot, "..");    // repository root

const srcWeb = path.join(repoRoot, "web");
const srcImages = path.join(repoRoot, "images");
const srcSounds = path.join(repoRoot, "sounds");
const loaderDir = path.join(appRoot, "loader");

const outDir = path.join(appRoot, "www");

function fail(msg) {
  console.error("build-web: " + msg);
  process.exit(1);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) fail("missing source folder: " + from);
  fs.cpSync(from, to, { recursive: true });
}

for (const d of [srcWeb, srcImages, srcSounds, loaderDir]) {
  if (!fs.existsSync(d)) fail("required folder not found: " + d);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 1. The web app itself (same files the website serves).
copyDir(srcWeb, path.join(outDir));

// 2. Shared asset folders (served same-origin at /images and /sounds).
copyDir(srcImages, path.join(outDir, "images"));
copyDir(srcSounds, path.join(outDir, "sounds"));

// 3. Loader assets (Android-only, kept out of the website).
copyDir(loaderDir, path.join(outDir, "loader"));

// 4. Capacitor plugin glue (Android-only). Capacitor 3+ does not expose
//    plugins as window globals and does not register plugin JS by itself:
//    loading the @capacitor/core UMD build plus the updater plugin's UMD
//    build registers CapacitorUpdater in Capacitor.Plugins, which is what
//    loader.js talks to.
const vendorDir = path.join(outDir, "loader", "vendor");
fs.mkdirSync(vendorDir, { recursive: true });

const vendorScripts = [
  [
    path.join(appRoot, "node_modules", "@capacitor", "core", "dist", "capacitor.js"),
    "capacitor.js"
  ],
  [
    path.join(appRoot, "node_modules", "@capgo", "capacitor-updater", "dist", "plugin.js"),
    "capacitor-updater.js"
  ]
];

for (const [from, name] of vendorScripts) {
  if (!fs.existsSync(from)) fail("missing capacitor vendor script: " + from);
  fs.copyFileSync(from, path.join(vendorDir, name));
}

// 5. Inject the loader into the copied index.html.
const indexPath = path.join(outDir, "index.html");
let html = fs.readFileSync(indexPath, "utf8");

const cssTag = '<link rel="stylesheet" href="loader/loader.css">';
const overlay = `
<div id="loader-root" data-role="loader">
  <div class="ldr-card">
    <div class="ldr-logo">SPACE<span>SHOOTER</span></div>
    <div class="ldr-version">Version <span id="ldr-version">–</span></div>

    <div class="ldr-status" id="ldr-status">Starting…</div>

    <div class="ldr-bar"><div class="ldr-bar-fill" id="ldr-bar"></div></div>

    <div class="ldr-state" id="ldr-state"></div>

    <button class="ldr-retry" id="ldr-retry" hidden>Retry</button>
    <button class="ldr-play" id="ldr-play" hidden>Play</button>

    <div class="ldr-error" id="ldr-error" hidden></div>
  </div>
</div>`;

const loaderScripts = `
<script src="loader/vendor/capacitor.js"></script>
<script src="loader/vendor/capacitor-updater.js"></script>
<script src="loader/update-logic.js"></script>
<script src="loader/updater-config.js"></script>
<script src="loader/loader.js"></script>`;

if (!html.includes("</head>")) fail("index.html has no </head>");
html = html.replace("</head>", cssTag + "\n</head>");

if (!html.includes("<body>")) fail("index.html has no <body>");
html = html.replace("<body>", "<body>" + overlay);

// Loader runs BEFORE the game scripts so it can verify/activate updates and
// keep the game hidden until boot succeeds. It must not block the game from
// loading: the game scripts are appended after, but the loader overlay sits
// on top and is removed when boot is complete.
html = html.replace("</body>", loaderScripts + "\n</body>");

fs.writeFileSync(indexPath, html);

// 6. Version metadata. The version is the single source of truth used by
//    both the loader UI and the update checker.
const pkg = JSON.parse(
  fs.readFileSync(path.join(appRoot, "package.json"), "utf8")
);

const versionFile = path.join(appRoot, "version.json");
let webVersion = pkg.version;

if (fs.existsSync(versionFile)) {
  webVersion = JSON.parse(fs.readFileSync(versionFile, "utf8")).version;
}

const version = {
  version: webVersion,
  appId: "io.github.bsxray.spaceshooter",
  builtAt: new Date().toISOString(),
  source: "web+images+sounds"
};

fs.writeFileSync(
  path.join(outDir, "version.json"),
  JSON.stringify(version, null, 2) + "\n"
);

// Sanity checks that Capacitor Updater requires.
if (!fs.existsSync(path.join(outDir, "index.html"))) {
  fail("no index.html in bundle root");
}

console.log("build-web: staged " + outDir + " (version " + webVersion + ")");
