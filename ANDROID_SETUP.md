# SpaceShooter — Android Loader / Setup Guide

This document explains how the Android app is built, how the web codebase is
shared with the website, how signed over-the-air (OTA) updates from GitHub
Releases work, and what you have to do manually.

The Android app is a thin **Capacitor** wrapper around the existing web game.
There is **one shared web codebase** (`web/`, `images/`, `sounds/`). The
website and the app are built from exactly the same files — nothing is
rewritten or duplicated.

---

## 1. Architecture Overview

```
web/                shared game code (HTML/CSS/JS)   <- single source of truth
images/             shared images
sounds/             shared sounds

greenfoot/          the original Greenfoot project (self-contained, not shipped)

android-app/
  package.json              Capacitor project + scripts
  capacitor.config.json     Capacitor config (appId, webDir=www, updater)
  version.json              current web version (semver, set by the release tag)
  loader/                   Android-only boot/update screen (injected into index.html)
    loader.css
    loader.js               boot + update logic
    updater-config.js       embedded public key + repo + limits  (TRUST ANCHOR)
    update-logic.js         pure helpers (semver, validation) — also unit-tested
  scripts/
    build-web.mjs           stages www/ from web/ + images/ + sounds/ + loader
    make-bundle.mjs         builds + signs the OTA release artifacts
    verify-release.mjs      verifies a built release (like the app does)
    run-tests.mjs           unit + artifact tests
    loader-tests.mjs        loader boot/update integration tests (mocked)
    keygen.mjs              generates a signing keypair
  signing/                  private OTA key (gitignored)
  keystore/                 private Android release key (gitignored)
  keystore.properties       local signing config (gitignored)
  www/                      GENERATED (gitignored) — the Capacitor web bundle
  dist/                     GENERATED (gitignored) — release artifacts
  android/                  native Android project (Capacitor)

.github/workflows/
  pages.yml                 existing: deploys the website (UNCHANGED)
  release-bundle.yml        NEW: builds + signs the OTA bundle AND the APK,
                            publishes the GitHub Release on a version tag
  android-build.yml         NEW: builds the debug APK + a signed release APK
                            (both as artifacts, for testing without a tag)
```

### Boot / update flow

1. The app launches with the **built-in bundle** (shipped inside the APK) and
   works fully offline immediately.
2. The loader shows a boot screen (version, status, progress bar, errors).
3. It queries the GitHub Releases API for **stable, published** releases only.
4. It picks the newest stable semver, compares it with the running version.
5. For a newer release it downloads:
   - `web-manifest-<version>.txt` — `<base64 Ed25519 signature>\n<json manifest>`
   - `web-bundle-<version>.zip` — the web bundle (`index.html` at root)
6. It verifies:
   - the manifest **Ed25519 signature** against the embedded public key,
   - the bundle **SHA-256** and **size** against the signed manifest,
   - that the bundle **entries** are safe (no path traversal / dangerous files),
   - that `index.html` exists at the bundle root.
7. Only after all checks pass it downloads the bundle into local storage
   **without touching the active version**, then activates it (`set`).
8. `notifyAppReady()` confirms the new bundle loaded; if it did not, the
   updater **rolls back** to the last working version automatically.

---

## 2. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ (22 recommended) | for Capacitor/CLI/scripts |
| JDK | **21** | required by Capacitor v8 / AGP 8.13 |
| Android SDK | API 36 (compile), API 24+ (min) | via Android Studio or cmdline-tools |
| Android Studio | latest | easiest way to get the SDK |

Environment variables (Android Studio usually sets these):

```
ANDROID_HOME       = C:\Users\<you>\AppData\Local\Android\Sdk
ANDROID_SDK_ROOT   = same
JAVA_HOME          = path to JDK 21
```

On the Android app itself: `minSdk 24`, `targetSdk 36`, portrait orientation,
immersive fullscreen, cleartext traffic disabled.

### Display and play field

The game is one shared web codebase for the website and the app. Its world
is always **600 units wide**; the **height follows the display aspect
ratio** (`web/js/assets.js` → `resizeGame()`). On a portrait phone the
canvas therefore covers the whole screen: no letterbox bars and no
distortion, and the taller play field gives more room to dodge. The canvas
backing store is sized in device pixels and a canvas transform maps the
world units onto it, so the game stays sharp on high density displays.

Menus and overlays are laid out relative to the world height and shrink on
short displays (`layoutUI()` in `web/js/game.js`), which keeps every button
reachable. The desktop website keeps the classic 2:3 ratio via CSS, so it
is unaffected.

> **OTA update requirement:** verifying signed updates uses **Ed25519 in
> WebCrypto**, which needs **Android System WebView / Chrome 137+**. On older
> WebViews the game still plays the installed version, but it will *not*
> install OTA updates (it fails closed rather than trusting an unverified
> package). Tell affected users to update "Android System WebView".

---

## 3. One-time setup

### 3.1 Install dependencies

```powershell
cd android-app
npm install
```

### 3.2 Signing key for updates

The trust anchor is an **Ed25519** keypair:

- the **public** key is embedded in `android-app/loader/updater-config.js`
  (`publicKeyB64`) and is safe to ship,
- the **private** key signs each release manifest and must be kept secret.

A keypair has already been generated for you:

- Private key: `android-app/signing/SS_UPDATE_SIGNING_KEY.pem` (gitignored —
  **never commit it**).
- Public key: already embedded in `updater-config.js`.

**You must add the private key as a GitHub Actions secret:**

1. Open the repository on GitHub →
   **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `SS_UPDATE_SIGNING_KEY`
3. Value: the full contents of `android-app/signing/SS_UPDATE_SIGNING_KEY.pem`,
   including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----`
   lines.

To rotate the key later:

```powershell
cd android-app
node scripts/keygen.mjs
```

Paste the new public key into `loader/updater-config.js`, store the new private
key as the `SS_UPDATE_SIGNING_KEY` secret, and rebuild the APK. (Rotating the
key requires shipping a new APK, because the public key is embedded.)

> **Status:** `SS_UPDATE_SIGNING_KEY` is already set in the repository
> secrets. You can check with `gh secret list`.

### 3.3 Signing key for the release APK

The **APK** needs a second, independent key: the Android release key proves
that the APK comes from you, and it is what the Play Store checks when you
publish an update.

- Keystore: `android-app/keystore/spaceshooter-release.keystore`
- Alias: `spaceshooter` (RSA 4096, PKCS#12, valid for 30 years)

The keystore is **never committed** (`android-app/.gitignore` excludes
`keystore/`, `*.keystore`, `*.p12`, `keystore.properties`). CI receives it
through four repository secrets:

| Secret | Value |
|--------|-------|
| `ANDROID_KEYSTORE_BASE64` | base64 of the keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `spaceshooter` |
| `ANDROID_KEY_PASSWORD` | key password |

`gh secret set ANDROID_KEYSTORE_BASE64 --body "<base64>"` (or pipe the value
into `gh secret set ANDROID_KEYSTORE_BASE64`) adds them.

> **Back up the keystore file.** Without it you can never publish an update
> to an already installed app — Android rejects APKs signed with a different
> key. Keep a copy outside the repository (e.g. in a password manager).

---

## 4. Building

All commands run from `android-app/`.

### 4.1 Build the web bundle

```powershell
npm run build:web      # stages www/ from ../web + ../images + ../sounds + loader/
```

### 4.2 Sync into the native project

```powershell
npm run sync           # build:web + cap sync android
```

### 4.3 Run / build the APK

```powershell
# open in Android Studio
npm run open:android

# or build a debug APK from the command line (Windows)
npm run build:android:debug

# macOS / Linux
npm run build:android:debug:unix
```

The debug APK is written to:

```
android-app/android/app/build/outputs/apk/debug/app-debug.apk
```

For a **release APK/AAB** you additionally need your own signing keystore and
`android/app/build.gradle` `signingConfigs` (see section 7).

### 4.4 Tests

```powershell
npm test               # unit tests + release-artifact verification
```

Covered by the automated tests:

- semver parsing / comparison / prerelease handling,
- stable-release selection (drafts & prereleases ignored),
- update decision (up-to-date / update / no releases),
- manifest entry validation (path traversal, dangerous files, missing index),
- Ed25519 signature round-trip and **tamper rejection**,
- (when a bundle is built) signature + SHA-256 + entries of the real artifact,
- **loader boot/update flow** (mocked window/fetch/updater), including:
  - offline start, HTTP 403 rate limit, no releases, up-to-date,
  - a valid signed update is downloaded and activated,
  - unsigned / tampered manifests are rejected (no activation, still boots),
  - a known-bad bundle triggers `reset()` before boot,
  - WebViews without Ed25519 fail closed (no update, game still boots).

---

## 5. Publishing a new game version (release flow)

**One tag produces everything:** the signed OTA bundle *and* the signed APK.
The tag is the single source of truth for the version number — the workflow
writes `android-app/version.json` from the tag, so the APK version, the bundle
version and the release title can never drift apart.

### 5.1 The normal case: a change to the game (web code)

1. **Change the game** in `web/`, `images/` or `sounds/`.

2. **Commit and push to `main`:**

   ```powershell
   git add -A
   git commit -m "feat: ..."
   git push origin main
   ```

3. **Create and push a version tag:**

   ```powershell
   git tag v1.2.0
   git push origin v1.2.0
   ```

4. The **`Release Android web bundle`** workflow
   (`.github/workflows/release-bundle.yml`) automatically:
   - builds the web bundle from `web/` + `images/` + `sounds/` + `loader/`,
   - runs the test suite,
   - creates the bundle zip and signs the manifest with the Ed25519 key,
   - verifies the artifacts (signature, SHA-256, entries),
   - builds the **signed release APK** (`assembleRelease`) and verifies its
     signature with `apksigner`,
   - publishes a **stable, non-prerelease** GitHub Release `v1.2.0` containing:
     - `spaceshooter-1.2.0.apk` — the installable Android app
     - `web-bundle-1.2.0.zip` — the OTA payload
     - `web-manifest-1.2.0.txt` — the signed manifest
     - `release-info.json` — build metadata

5. **That is all.** Installed apps pick up the new game version on their next
   start — no store upload, no APK download, nothing to do on the device.
   Only native changes (permissions, app name, icons, embedded keys) require
   the new APK to be installed.

### 5.2 Checklist before you tag

```powershell
npm --prefix android-app test     # tests must pass
npm --prefix android-app run build:web
```

The workflow runs the same checks, but a red test costs a failed release run.

### 5.3 New device installation

The APK of the newest release is the installable app:

```
https://github.com/BSXRay/SpaceShooter/releases/latest
```

Download `spaceshooter-<version>.apk`, allow "install unknown apps" and
install it. An already installed app can be updated with the same APK
(same signing key) — or just wait for the OTA update.

### 5.4 Patch releases / hotfixes

If only the game changed, bump the **patch** level (`v1.2.1`). The app compares
semver and installs the newest stable release. Skipping versions is fine; the
app always jumps to the newest one.

To publish without tagging (testing the workflow), run the workflow manually
with the `version` input. **Note:** the manifest URL points at
`.../releases/download/v<version>/...`, so the assets only resolve correctly
when a matching tag/release exists.

> The version in `android-app/version.json` is overwritten by the workflow
> from the tag. Keeping it in sync manually is not required, but it makes the
> local build match the release.

---

## 6. Security model of live updates

### Why a checksum is not enough

A SHA-256 checksum only proves a file was not corrupted in transit. It does
**not** prove *who* produced it — anyone able to replace the release asset
could replace the checksum too. Therefore the app verifies a **detached
Ed25519 signature** over the update manifest using a **public key embedded in
the APK**. Only manifests signed by the matching private key (held solely in
the GitHub Actions secret) are accepted.

### What is verified before activation

| Check | Purpose |
|-------|---------|
| Ed25519 signature of the manifest | authenticity (trusted publisher) |
| manifest version is valid semver / matches the tag | integrity of metadata |
| bundle **SHA-256** matches the signed manifest | integrity |
| bundle **size** matches and is within limits | integrity / DoS guard |
| bundle URL is `https://github.com/...` | no plaintext/foreign download |
| entry list has no path traversal / absolute paths / secrets | zip-slip defense |
| `index.html` present at the root | valid bundle |
| `notifyAppReady()` after activation | enables automatic rollback |

### Safety properties

- **Offline start:** the built-in bundle is always present; the app never waits
  on the network to become playable.
- **No hang on GitHub outage:** network errors, timeouts, rate limits (HTTP
  403) and missing assets all fall back to the installed version with a message.
- **Download-then-activate:** the active version is never modified during the
  download; activation happens only after every check passes.
- **Rollback:** if the new bundle fails to boot and `notifyAppReady()` is not
  called in time, `@capgo/capacitor-updater` automatically reverts to the last
  working bundle.
- **No parallel updates / no loops:** an `updating` guard prevents concurrent
  update runs; failures never auto-retry in a loop (the user gets a Retry
  button).
- **No embedded secrets:** the app contains only the *public* key. No GitHub
  token or private key is shipped.

### Residual risks / limitations

- The private signing key is a single point of trust. If it leaks, a malicious
  update could be signed. Rotate the key (and ship a new APK) if that happens.
- The public key is baked into the APK, so a key rotation requires an app
  update through the store.
- OTA updates require a recent WebView (Ed25519 ≥ WebView 137). Older devices
  fail closed (no update, game still works).
- Native code, permissions and the public key cannot be changed over the air —
  those require a new APK.

---

## 7. Release APK signing

The debug APK is signed with the debug key and is fine for testing/sideloading.
The distributable build is a **signed release APK** and is produced
automatically by the release workflow (section 5).

### 7.1 How the signing material reaches Gradle

`android-app/android/app/build.gradle` looks for the key in this order:

1. **Environment variables** (used by CI):
   `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
   `ANDROID_KEY_PASSWORD`.
2. **`android-app/keystore.properties`** (local builds, gitignored):

   ```properties
   storeFile=C:\\Users\\<you>\\...\\spaceshooter-release.keystore
   storePassword=...
   keyAlias=spaceshooter
   keyPassword=...
   ```

If neither is available the release build still succeeds but stays **unsigned**
(Gradle prints a warning). CI fails the release run instead, because a release
without a signature is useless.

### 7.2 Local release build

```powershell
cd android-app/android
./gradlew assembleRelease    # or bundleRelease for AAB
```

The APK lands in
`android-app/android/app/build/outputs/apk/release/app-release.apk`.

Verify the signature yourself with the Android SDK build tools:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
& "$env:ANDROID_HOME\build-tools\36.0.0\apksigner" verify --verbose --print-certs `
  android-app\android\app\build\outputs\apk\release\app-release.apk
```

### 7.3 Creating a new keystore

Only necessary if the old one is lost. **Keep the same alias and a safe copy.**

```powershell
keytool -genkeypair -v -keystore spaceshooter-release.keystore `
  -alias spaceshooter -keyalg RSA -keysize 4096 -validity 10950 `
  -storetype PKCS12
```

Then update the four secrets in section 3.3 and rebuild the APK.

> Android identifies an app by its signing key. A new keystore means a
> **different** app: users would have to uninstall the old one first and lose
> their data. Never regenerate the release key casually.

---

## 8. Maintenance notes

- **Never edit `www/` or `android/app/src/main/assets/public/`** — both are
  generated by `npm run build:web` / `cap sync`.
- **Single source of truth** stays in `web/`, `images/`, `sounds/`. The website
  build (`pages.yml`) and the app build (`build-web.mjs`) both consume them.
- The website deployment workflow is untouched; the Android work lives entirely
  under `android-app/` and the two new workflows.
- To change app identity (name, icon, package id) use Android Studio or the
  files under `android-app/android/app/src/main/res/`.
- If you bump Capacitor, run `npm install` and `npm run sync` again.

---

## 9. Quick reference

```powershell
cd android-app

npm install                 # one-time
npm run build:web           # stage www/
npm run sync                # build + cap sync
npm test                    # tests
npm run build:android:debug # debug APK (needs Android SDK)
npm run open:android        # open in Android Studio

# release artifacts locally (needs SS_UPDATE_SIGNING_KEY env var)
$env:SS_UPDATE_SIGNING_KEY = Get-Content signing\SS_UPDATE_SIGNING_KEY.pem -Raw
node scripts/make-bundle.mjs 1.2.0
node scripts/verify-release.mjs 1.2.0

# local release APK (needs keystore.properties, see section 7)
cd android
./gradlew assembleRelease
```

### Publishing (the three commands that matter)

```powershell
git add -A
git commit -m "feat: ..."
git push origin main
git tag v1.2.0
git push origin v1.2.0
```

The tag starts the release workflow; the installed app picks the new version
up on its next start. Full details in section 5.
