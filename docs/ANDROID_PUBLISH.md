# GLOWTRAIL - Build & Publish Guide (Google Play)

This is the end-to-end guide to produce installable artifacts and publish GLOWTRAIL
to Google Play. It covers one-time machine setup, one-time signing setup, the
everyday build loop, verification, device testing, and the Play Console upload flow.

- App id: `com.glowtrail.app`
- Current version: `versionCode 1` / `versionName 1.0.0`
- minSdk 22 (Android 5.1) / targetSdk 36 / compileSdk 36
- Wrapper: Capacitor 6 + Gradle 8.13 + Android Gradle Plugin 8.11.1

---

## 1. What "publishing" actually needs

Two files come out of the build:

| File | Purpose |
|------|---------|
| `android/app/build/outputs/bundle/release/app-release.aab` | The Android App Bundle. This is what you upload to Google Play. Play generates optimized APKs from it. |
| `android/app/build/outputs/apk/release/app-release.apk` | A universal signed APK. Play does not accept it for new apps, but it is what you sideload onto a phone to test. |

Plus, one secret you must keep forever:

- The keystore (`.android-signing/keystore/glowtrail-release.jks`) and its passwords
  (`.android-signing/keystore.properties`). These are the **upload key**.

---

## 2. One-time machine setup

Only needed on a fresh machine. The current dev environment is already set up.

### 2.1 Node

Node 20+ recommended. Install project dependencies from the repo root:

```bash
npm install
```

### 2.2 JDK 17

```bash
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y openjdk-17-jdk-headless
```

### 2.3 Android SDK command-line tools

Download "Command line tools only" from the Android developer site, unzip it under
a directory such as `/opt/android-sdk/cmdline-tools/latest`, then export the paths:

```bash
export ANDROID_HOME=/opt/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
```

### 2.4 Install the required SDK packages

```bash
export ANDROID_HOME=/opt/android-sdk
yes | /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager \
  --sdk_root="$ANDROID_HOME" \
  "platform-tools" \
  "platforms;android-36" \
  "build-tools;36.0.0"
```

### 2.5 Point Gradle at the SDK

`android/local.properties` (gitignored) must contain:

```properties
sdk.dir=/opt/android-sdk
```

---

## 3. One-time signing setup

Already done in this repo. Repeat only if you ever create a new keystore.

### 3.1 Generate the keystore

```bash
mkdir -p .android-signing/keystore
keytool -genkeypair -v \
  -keystore .android-signing/keystore/glowtrail-release.jks \
  -alias glowtrail \
  -keyalg RSA -keysize 2048 -validity 10000
```

### 3.2 Create the signing properties file

`.android-signing/keystore.properties` (gitignored):

```properties
storeFile=../../.android-signing/keystore/glowtrail-release.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=glowtrail
keyPassword=YOUR_KEY_PASSWORD
```

The path is relative to `android/app/`, which is why it uses the `../../` prefix.

### 3.3 Verify it is not in git

```bash
git status --porcelain .android-signing
git check-ignore .android-signing/keystore/glowtrail-release.jks
```

### 3.4 Back it up - this is critical

Copy the entire `.android-signing/` folder to a password manager or encrypted vault.
With Google Play App Signing (recommended, default for new apps) your keystore is the
**upload key** only: if it is lost you can request an upload key reset from Play.
Never commit it. Never share it.

---

## 4. The everyday build loop

Run from the repo root. Always export the toolchain paths first (or put them in your
shell profile):

```bash
export ANDROID_HOME=/opt/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
```

### Option A - npm scripts (recommended)

```bash
# Web build + Capacitor sync (run this whenever web code changes)
npm run android:sync

# Web build + sync + signed release APK
npm run android:apk

# Web build + sync + signed release AAB
npm run android:aab

# Open the native project in Android Studio (requires a desktop with Studio)
npm run android:open
```

### Option B - raw commands

```bash
# 1. Type-check and build the web app into dist/
npm run build

# 2. Copy dist/ into the native project and refresh plugins
npx cap sync android

# 3. Build both release artifacts (signed)
./android/gradlew -p android assembleRelease bundleRelease --no-daemon
```

### Output locations

```text
android/app/build/outputs/apk/release/app-release.apk
android/app/build/outputs/bundle/release/app-release.aab
```

Important: always run `npm run build` (or the `android:sync` script) before Gradle.
Gradle does not build the web app; if you skip this step the APK ships stale or empty
web assets.

---

## 5. Verify before uploading

```bash
export PATH="/usr/lib/jvm/java-17-openjdk-amd64/bin:$PATH"
BT=/opt/android-sdk/build-tools/36.0.0
APK=android/app/build/outputs/apk/release/app-release.apk
AAB=android/app/build/outputs/bundle/release/app-release.aab

# APK signature is valid
"$BT/apksigner" verify --print-certs "$APK"

# Package id, version and API levels
"$BT/aapt" dump badging "$APK" | grep -E "^package|sdkVersion|targetSdkVersion"

# AAB signature is valid
jarsigner -verify "$AAB"

# Capacitor plugin (App / back button) is bundled
unzip -p "$APK" assets/capacitor.plugins.json
```

Expected: `package: name='com.glowtrail.app'`, `targetSdkVersion:'36'`,
`Signer #1 certificate DN: CN=GLOWTRAIL`, and `@capacitor/app` in the plugin list.

---

## 6. Test on a real device

### 6.1 Install the APK over USB

Enable Developer options and USB debugging on the phone, then:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### 6.2 Test the AAB (optional)

The AAB cannot be installed directly. Use bundletool to generate device APKs:

```bash
# Generate a set of APKs from the bundle
java -jar bundletool.jar build-apks \
  --bundle=android/app/build/outputs/bundle/release/app-release.aab \
  --output=glowtrail.apks \
  --ks=.android-signing/keystore/glowtrail-release.jks \
  --ks-key-alias=glowtrail

# Install onto the connected device
java -jar bundletool.jar install-apks --apks=glowtrail.apks
```

Manual test checklist: launch, portrait lock, Home accordion, level play, win screen,
back button (closes reveal, then menu, then returns Home, then exits), audio, offline.

---

## 7. Publish to Google Play

### 7.1 Create the developer account

1. Go to the Google Play Console and register as a developer (one-time registration fee).
2. Complete identity verification. This can take a few days for new accounts, so do it early.

### 7.2 Create the app

1. Play Console > **Create app**.
2. App name `GLOWTRAIL`, default language, type **Game**, **Free**.
3. Accept the developer program policies.

### 7.3 Play App Signing

When you upload your first AAB, Play asks you to enroll in **Play App Signing**.
Accept it. Play generates and holds the **app signing key**; your keystore acts as the
**upload key**. This is the recommended setup because an upload key can be reset if lost.

### 7.4 Store listing assets

Prepare once, reuse for every release:

- App icon: 512x512 PNG, 32-bit, no alpha.
- Feature graphic: 1024x500 PNG.
- Phone screenshots: 2 to 8 images, portrait, between 320px and 3840px per side.
- Short description: up to 80 characters.
- Full description: up to 4000 characters.
- App category: Games > Puzzle.
- Optional: promo video, tablet screenshots, 7-inch and 10-inch.

### 7.5 App content declarations

Complete every item under **Policy > App content**:

- **Privacy policy**: required because the app can collect data once ads are added.
  Host one at a public URL and paste the link.
- **App access**: all functionality is available without login. Select "All
  functionality is available without special access".
- **Ads**: declare **No ads** for now. Change this to "Yes" the moment AdMob ships.
- **Content rating**: complete the IARC questionnaire. A puzzle game is normally
  rated Everyone / PEGI 3.
- **Target audience**: pick the age groups. Do not select ages under 13 unless you
  also comply with the Families policy.
- **Data safety**: declare what is collected and shared. Currently nothing; after
  AdMob you must declare device or advertising identifiers.
- **News app**: No. **Government app**: No. **Financial features**: No.

### 7.6 Upload a release

1. **Testing > Internal testing > Create new release**.
2. Upload `app-release.aab`.
3. Add release notes and the testers' email addresses (or an email list).
4. Roll out. Internal testing goes live within minutes to a few hours.
5. Verify on a tester device, then promote the release to **Closed**, **Open**, and
   finally **Production**. Production review typically takes a few days for a new app.

### 7.7 64-bit and size requirements

Play requires 64-bit support and caps AAB size. Capacitor apps carry no custom native
`.so` libraries, so the 64-bit rule is already satisfied, and this bundle is roughly
3 MB, far below the limits.

---

## 8. Shipping an update

1. Edit `android/app/build.gradle` and increase **versionCode** by at least 1. Update
   **versionName** for the user-visible string.

```gradle
versionCode 2
versionName "1.0.1"
```

2. Rebuild:

```bash
npm run android:aab
```

3. In Play Console, create a new release on the same track and upload the new AAB.
   Play rejects any upload whose `versionCode` was already used.

---

## 9. Target API level (why we are on 36)

Google Play requires new apps and updates to target a recent Android API level, and
raises the requirement roughly every August. API 34 was required from Aug 2024, API 35
from Aug 2025, and API 36 from Aug 2026. A build targeting an older level is rejected
at upload. If Play Console shows a higher requirement later, bump it:

1. Install the newer platform and build tools:

```bash
export ANDROID_HOME=/opt/android-sdk
yes | /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager \
  --sdk_root="$ANDROID_HOME" "platforms;android-37" "build-tools;37.0.0"
```

2. Raise the values in `android/variables.gradle`:

```gradle
compileSdkVersion = 37
targetSdkVersion = 37
```

3. If the new SDK needs a newer build toolchain, bump the Android Gradle Plugin in
   `android/build.gradle` and the Gradle wrapper in
   `android/gradle/wrapper/gradle-wrapper.properties` to a compatible pair, then rebuild.

Also review Android behavior changes for the new API level (background limits,
permissions, edge-to-edge) before shipping.

---

## 10. Adding AdMob later

The native build already applies the Google Services plugin when
`android/app/google-services.json` exists, so no Gradle change is needed. When you are
ready:

1. Create the app in AdMob, download `google-services.json`, and place it at
   `android/app/google-services.json` (gitignore it; it is account-specific).
2. Install the Capacitor AdMob plugin, then sync and rebuild.
3. Use AdMob **test ad unit ids** during development.
4. Return to the Play Console and update **Ads** to "Yes" and update the **Data
   safety** form to declare advertising identifiers.
5. Update the privacy policy to mention ads and data collection.

This app currently ships a no-op ad service, so nothing changes until you wire a real
provider.

---

## 11. Troubleshooting

- `SDK location not found` - create `android/local.properties` with `sdk.dir`.
- `Unsupported class file major version` - you are on the wrong JDK. Use JDK 17.
- Stale UI in the app - you forgot `npm run android:sync` before Gradle.
- `App not installed` on sideload - an older build with the same id is present; uninstall
  it first, or your device blocks the signature.
- Gradle download slow or blocked - the wrapper needs network access to
  `services.gradle.org` on the first build.
- Signing config missing - `app-release.apk` builds unsigned. Confirm
  `.android-signing/keystore.properties` exists and its `storeFile` path resolves.

---

## 12. Pre-publish checklist

- [ ] `npm test` and `npm run typecheck` pass.
- [ ] `npm run build` succeeds.
- [ ] `targetSdkVersion` meets the current Play requirement.
- [ ] `versionCode` is higher than the last upload.
- [ ] APK signature verifies and displays `CN=GLOWTRAIL`.
- [ ] AAB signature verifies.
- [ ] Tested on a real device, including the hardware back button.
- [ ] `.android-signing/` backed up outside the repo.
- [ ] Play Console app content forms completed (ads, data safety, content rating).
- [ ] Privacy policy URL live.
- [ ] Store listing assets uploaded.
