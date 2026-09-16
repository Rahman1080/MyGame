# NEON ARCADE (GLOWTRAIL)

Mobile-first cyber/neon arcade suite powered by Vite, TypeScript, Canvas, Web Audio, and Capacitor.

## Featured Games

1. **GLOWTRAIL (Path Puzzle)**: Rotate arrows, launch, visit required nodes, escape.
   - 120 story levels across 6 mechanics packs (Pulse, Surge, Color Gates, Lattice, Wormhole, Vector).
   - Daily 5-puzzle challenge with streak tracking.
   - **Endless Zen Mode**: Procedurally generated infinite puzzles on the fly.
   - Built-in solver, hint engine, and solutions viewer.
2. **CYBER SNAKE**: High-velocity neon snake with combo multipliers and cyber power-up orbs (Phase Cloak, Slow-Mo, Overdrive Multiplier).
3. **NEON BREAKER**: Laser brick breaker with paddle physics, particle explosions, multiball, expanders, and laser blaster ammo across progressive waves.
4. **CYBER 2048**: Neon sliding tile synthesis puzzle with smooth tactile animations, 1-step undo, and endless high scoring.

All games feature synthesized zero-asset Web Audio, responsive touch/keyboard controls, and unified local save & high scores.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

Dev server: `http://localhost:5173`

## Android

The game is wrapped with [Capacitor](https://capacitorjs.com/) as a native Android app.

- App id: `com.glowtrail.app` · Name: `GLOWTRAIL`
- Web output (`dist/`) is synced into `android/app/src/main/assets/public`.

```bash
# Rebuild the web app and sync it into the Android project
npm run android:sync

# Signed release APK (android/app/build/outputs/apk/release/)
npm run android:apk

# Signed release App Bundle for Play Store (android/app/build/outputs/bundle/release/)
npm run android:aab
```

### Signing

Release builds are signed with a keystore that is intentionally **not** committed:

- Keystore: `.android-signing/keystore/glowtrail-release.jks`
- Config: `.android-signing/keystore.properties` (passwords live here)
- `android/app/build.gradle` reads that file; if it is missing, the release build is unsigned.

Back up both files somewhere safe. Losing the keystore means you can no longer update the
published app on Google Play. The Android SDK path is set in `android/local.properties`.

