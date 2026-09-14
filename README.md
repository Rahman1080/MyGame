# GLOWTRAIL

Mobile-first neon path puzzle. Rotate arrows, Launch, visit every required node, escape.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

Dev server: `http://localhost:5173`

## Play

Tap a cell to rotate its arrow 90 degrees clockwise. Press Launch. The token follows the path. Visit every required node, then reach the exit.

- Required nodes glow with a ring; grey arrows are decoys you may ignore. Locked cells cannot be rotated.
- `PAR` is the proven minimum number of rotations to solve the puzzle. Beat it for 3 stars, or finish within two extra moves for 2.
- Hint analyses your current board, verifies a safe next rotation with the solver and highlights it without rotating for you. Tap "More" for a stronger second hint (once per puzzle).
- From level 41 the Color Gates pack activates: a gate recolours the orb, and the exit only opens for the colour of the last gate.
- From level 81 Wormhole adds portals: entering one warps the orb to its partner and keeps the same direction, skipping the tiles between.
- From level 101 Vector adds one-way walls: a wall may only be crossed in its chevron direction, from either side.
- 120 story levels across six packs: Pulse (1-20), Surge (21-40), Color Gates (41-60), Lattice (61-80), Wormhole (81-100) and Vector (101-120), each harder than the last.
- Home shows stats, a Continue card and a Daily card. The level map lives behind a collapsible `LEVELS` panel; open it and switch to `Solutions` to preview any level's solved board.
- The board menu (last option) reveals the solved board and its winning route. Revealing is a study aid: it changes no progress and awards no stars, so you still solve the level yourself.

Daily Run is five date-seeded puzzles. Streak uses the local calendar date.

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

