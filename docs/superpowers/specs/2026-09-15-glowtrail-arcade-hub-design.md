# GLOWTRAIL Arcade - Milestone 1 Design Spec

Date: 2026-09-15
Status: Approved direction (see attached product instruction), ready for implementation planning.
Scope: Milestone 1 only. M2 and beyond are explicitly out of scope.

## 1. Product positioning

GLOWTRAIL Arcade is one coherent neon puzzle product: "Quick neon brain games in
one universe." It is not a "100 games in 1" collection. Every game shares visual
language, progression, daily systems, accessibility, audio/haptics, navigation, and
save infrastructure. Four games ship in M1: GLOWTRAIL (flagship), FUSION, PRISM, GLYPH.

Guiding principle: it must feel like one polished game that contains multiple puzzle
experiences. Quality over quantity. Retention from fun, dailies, and progression.

## 2. Section 25 analysis (pre-implementation)

### 2.1 Current architecture

- `src/main.ts` (668 lines): single UI shell with module-global UI state, a
  signature-diffed `render()`, one delegated click handler, a keyboard map, a
  `requestAnimationFrame` loop, service-worker registration, and a Capacitor
  back-button listener.
- `src/game/controller.ts` (312 lines): `Game` state (`screen: home|board|win`,
  `mode: story|daily`), `openBoard`, `goHome`, `tapCell`, `doLaunch`, `doTick`,
  `doHint`, persistence, and win/star recording.
- Pure, deterministic engine: `src/engine/*` (types, session, simulation, solver,
  hints, validation, scoring), `src/gen/*` (seededRng, identity, difficulty,
  generator, daily), `src/levels/*` (packs, manifest, tutorial).
- Save v1: key `glowtrail:v1`, `SaveData`, `sanitizeSave`, `loadSave`, `persistSave`.
  `src/save/migration.ts` is currently a 5-line pass-through stub.
- Render/audio/services: `src/render/board.ts` + `colors.ts`; `src/audio/synth.ts`
  + `haptics.ts`; `src/ads/adService.ts` (noop); `public/sw.js`.
- Tests: 23 suites, 196 tests, all green.

### 2.2 Proposed versus current architecture

| Concern | Current | Target M1 |
|---|---|---|
| App shell | one `main.ts` monolith | `platform/router.ts` + `platform/ui/launcher.ts`, games mounted into a root |
| Games | GLOWTRAIL only, hardwired | `games/<id>` implementing `MiniGame`, loaded lazily |
| State | `game/controller.ts` globals in `main.ts` | game-local state inside each game; shared state in services |
| Save | single v1 namespace | `glowtrail:v2` envelope with per-game slices + profile |
| Daily | GLOWTRAIL 5-puzzle Daily Run | shared Daily Gauntlet (one challenge per game, complete 3 of 4) plus GLOWTRAIL Daily Run retained |
| Meta | stars + streak only | profile XP/level/streak/achievements + cosmetics |
| Audio | one `synth` singleton | `platform/services/audio` wrapping synth with a shared cue set |
| Ads/analytics | noop ads | AdsService interfaces + NoopAdsService; AnalyticsService seam |

### 2.3 Migration risks and mitigations

1. Losing v1 progress. Mitigation: read v1, map every field into
   `games.glowtrail`, write v2, and never delete the v1 key. Idempotent: if a valid
   v2 exists, v1 is ignored.
2. Conflating GLOWTRAIL Daily Run with the Gauntlet. Mitigation: keep the existing
   `dailyDate/dailyCompleted[5]/dailyStars[5]` inside `games.glowtrail`; the Gauntlet
   lives in `profile.gauntlet*`.
3. `sanitizeSave` hardcodes `version = SAVE_VERSION`. Mitigation: add a v2 sanitizer
   that keeps the v1 sanitizer as the GLOWTRAIL slice validator; existing save tests
   stay valid against the slice.
4. Moving the engine breaks 23 test import paths. Mitigation: keep `src/engine`,
   `src/gen`, `src/levels`, `src/render` in place and wrap them behind a GLOWTRAIL
   `MiniGame` adapter. Structural change is additive.
5. Corrupted or partial v2. Mitigation: sanitize every slice; on failure fall back
   to defaults for that slice only, never reset the whole save.

### 2.4 Android/Capacitor risks

- App display name changes to "GLOWTRAIL Arcade" in `capacitor.config.ts`
  (`appName`) and `android/app/src/main/res/values/strings.xml`; `appId` stays
  `com.glowtrail.app`.
- Lazy game chunks must work offline. Mitigation: keep chunks small and ensure the
  service worker runtime-caches JS chunks; optionally precache all four game chunks.
- `targetSdk 36`, AGP 8.11.1, Gradle 8.13, JDK 17 already in place. No native
  `.so` libraries, so 16 KB page-size compatibility is not applicable.
- Permissions stay minimal: only `INTERNET`. No new permissions.

### 2.5 Reuse map (build on, do not duplicate)

Solver/validation/hints; generator + `seededRng`/`identity`; palette in
`render/colors.ts`; `synth` and `haptics`; `noopAds`; `sanitizeSave` primitives;
`packs.ts`; `solvedPreview`; the signature-render pattern; the Capacitor
back-button handler.

### 2.6 Minimum structural changes and non-goals

Additive only: create `src/platform/` and `src/games/`. Do not relocate the engine,
do not rewrite the renderer, do not delete anything. No new runtime dependencies.

## 3. Target architecture

```text
src/
  platform/
    types.ts            # MiniGame, GameMeta, GameContext, GameResult
    registry.ts         # descriptors + lazy import()
    router.ts           # hash routes: #/home, #/game/<id>, #/daily
    services/
      audio/index.ts    # wraps synth, shared cue names, volume/mute/reduced-motion
      haptics/index.ts  # wraps haptics
      save/index.ts     # v2 load/persist, per-game slices, profile updates
      settings/index.ts # mute, haptics, reduced-motion, theme
      rng/index.ts      # re-export seededRng helpers
      telemetry/index.ts# AnalyticsService + NoopAnalytics
      ads/index.ts      # AdsService, RewardedAd, InterstitialAd, NoopAdsService
    ui/
      launcher.ts       # Home/Dashboard
      chrome.ts         # shared top bar, modal, toast, sheet
  games/
    glowtrail/index.ts  # MiniGame adapter over existing engine/controller/render
    fusion/index.ts     # FUSION mini-game
    prism/index.ts      # PRISM mini-game
    glyph/index.ts      # GLYPH mini-game
  main.ts               # boots the router
```

The existing `src/engine`, `src/gen`, `src/levels`, `src/render`, `src/audio`,
`src/save` (v1 slice), and `src/ads/adService.ts` remain and are consumed, not moved.

### 3.1 MiniGame contract

```ts
export interface GameMeta {
  id: string;                 // "glowtrail" | "fusion" | "prism" | "glyph"
  name: string;
  tagline: string;
  icon: string;               // inline SVG string
  accent: string;             // neon hex
  status: "ready" | "soon";
  hasGauntlet: boolean;
}

export interface GameResult {
  score: number;
  stars?: number;
  solved?: boolean;
  stats?: Record<string, number>;
}

export interface GameContext {
  root: HTMLElement;
  audio: AudioService;
  haptics: HapticsService;
  ads: AdsService;
  settings: SettingsService;
  analytics: AnalyticsService;
  rng(seed: string): Rng;
  save: GameSaveSlice;                 // namespaced, no direct localStorage
  report(result: GameResult): void;    // XP/stars/achievements/gauntlet
  exit(): void;
}

export interface MiniGame {
  meta: GameMeta;
  mount(root: HTMLElement, ctx: GameContext): void | Promise<void>;
  unmount(): void;
  daily(seed: string): unknown;        // deterministic daily config
}
```

Rules: games never touch `localStorage`; pure logic never calls `Date.now()` or
`performance.now()`; all randomness comes from the injected seeded RNG.

### 3.2 Registry and lazy loading

`registry.ts` exports ordered descriptors `{ meta, load: () => import("../games/<id>") }`.
The router mounts a game by importing its chunk on demand. The GLOWTRAIL chunk is
allowed to load eagerly on Home because it is the flagship "Continue" card. FUSION,
PRISM, GLYPH chunks load only when opened.

### 3.3 Router

Hash routes so the Capacitor `https` origin needs no server rewrites:
`#/home` (default), `#/game/<id>`, `#/daily`. Back button and `Escape` pop routes;
Android back exits only from `#/home`.

### 3.4 Milestone 1 game rules

GLOWTRAIL (flagship, unchanged gameplay): arrow rotation, launch, path simulation,
required nodes, locked cells, PAR, stars, hints, Color Gates, Wormhole, Vector,
story levels, Daily Run, and solutions all preserved. The solver stays deterministic
and authoritative. Wrapped in a `MiniGame` adapter; no rule changes.

FUSION (original merge/drop): a vertical bin. The player aims with one finger and
drops a glowing orb. Orbs have tiers 0-9 with radius scaling and a unique
shape-coded glyph per tier (colorblind-safe). Two touching orbs of equal tier merge
into the next tier. Scoring rewards each merge, with a chain/combo multiplier for
merges within a short window. A resting orb above the overflow line for longer than
a grace period ends the run. Restart and pause are always available. The daily mode
uses a seeded orb sequence and a fixed-timestep simulation so the same date gives
the same sequence and outcome; frame timing never affects game state. Visuals are
original neon orbs, not fruit or any existing game's presentation. Rewarded
continuation is a later placeholder.

PRISM (original color sort): N neon tubes each holding stacked colored orbs, plus a
small number of empty tubes. Selecting a source then a destination moves the top run
of same-colored orbs when the destination is empty or its top color matches and
capacity allows. Win when every tube is single-color or empty. The generator creates
levels by reverse-shuffling from a solved state; a solver/validator confirms
solvability before a level is ever shown, so an unsolvable generated puzzle can never
ship. Includes undo, restart, a safe solver-derived hint, progressive complexity, and
a deterministic seeded daily.

GLYPH (original daily word): six guesses for a fixed-length word from a bundled
offline word list with no network use. Feedback uses three statuses (exact, present,
absent) communicated with both color and a non-color symbol so it never relies on
green/red alone. The original rotating twist is a deterministic daily modifier drawn
from the date, such as an anchor letter, a no-repeat bonus, or a double-letter
spotlight, surfaced in the UI as a one-line rule. The experience remains
understandable in seconds.

## 4. Save v2 and migration

```ts
export const SAVE_KEY_V1 = "glowtrail:v1";
export const SAVE_KEY_V2 = "glowtrail:v2";
export const SAVE_VERSION = 2;

export interface ProfileSave {
  xp: number;
  level: number;
  streak: number;
  lastDailyDate: string | null;
  muted: boolean;
  reduceMotion: "auto" | "on" | "off";
  theme: string;               // palette id
  cosmetics: string[];         // unlocked ids
  achievements: string[];      // unlocked ids
  gauntletDate: string | null;
  gauntletDone: string[];      // game ids completed for gauntletDate
}

export interface SaveV2 {
  version: 2;
  profile: ProfileSave;
  games: {
    glowtrail: GlowtrailSave;  // existing v1 SaveData shape, unchanged fields
    fusion: FusionSave;        // { best, runs, dailyBest: Record<string, number> }
    prism: PrismSave;          // { solved: string[], bestMoves: Record<string, number> }
    glyph: GlyphSave;          // { wins, playDates: string[], lastResult: string | null }
  };
}
```

Migration `migrateSave(rawV1OrV2)`:
1. If a valid `glowtrail:v2` exists, sanitize and return it (idempotent).
2. Else read `glowtrail:v1`, run the existing `sanitizeSave` to get `GlowtrailSave`,
   wrap it in a v2 envelope with default profile and empty other slices.
3. Persist v2. Do not modify or delete the v1 key.

Invariants: lossless for stars, solved, currentPack, tutorialDone, streak,
lastDailyDate, dailyDate, dailyCompleted, dailyStars, muted; idempotent; tested;
never silently resets progress. A corrupted v2 falls back per-slice.

## 5. Shared meta

Light meta only. Profile fields: XP, level, daily streak, total puzzles solved,
total stars, achievements. Explicitly excluded: lives, energy, multiple currencies,
character stats, gear, weapons.

- XP: base per game completion + star bonus + perfect daily bonus.
- Level: derived from XP via a fixed table.
- Streak: advanced when the Daily Gauntlet is completed (3 of 4).
- Achievements: a small fixed list, for example first solve, 10 solves, 50 stars,
  7-day streak, complete all four gauntlets in a week, perfect PRISM, GLYPH win.
- Totals: solved and stars are aggregated across games for the profile.

## 6. Cosmetics

Unlockable, non-gameplay-affecting only: neon palettes, trail effects, board
backgrounds, orb skins, tile skins, completion bursts, profile badges, UI glow
themes. M1 ships at minimum: three palettes, two board backgrounds, two completion
bursts. Unlocked by level, achievements, streak milestones, or perfect dailies.
No shop in M1.

## 7. Daily Gauntlet

- Each day, generate exactly one challenge per game: GLOWTRAIL, FUSION, PRISM, GLYPH.
- Completing any THREE marks the Gauntlet complete; the fourth is optional but playable.
- Completion advances the shared streak and awards a bonus.
- Deterministic date-based seeds; the same date yields the same challenge for all
  players (no server).
- GLOWTRAIL's existing 5-puzzle Daily Run is retained as its own mode and is not
  the Gauntlet. The Gauntlet uses a separate seeded GLOWTRAIL puzzle.

## 8. Home / Dashboard

Order, top to bottom:
1. Top bar: GLOWTRAIL Arcade wordmark, player level, XP progress, streak, settings.
2. CONTINUE PLAYING card: game name, level, progress, stars, Play.
3. DAILY GAUNTLET card: "3 of 4" progress with per-game pips.
4. ARCADE: four game cards.

Do not overcrowd the first screen. Animations subtle and fast. GLOWTRAIL levels are
not shown directly here.

## 9. Level UI (GLOWTRAIL)

`LEVELS ▼` accordion, collapsed by default. When open: packs, per-pack progress,
scrolling, and Solutions preview mode. Default Home shows Continue, Daily, Arcade.

## 10. Solution / study mode

Level menu: PLAY, RESTART, HINT, VIEW SOLUTION. The viewer shows the solved board,
final arrow orientations, the required-node route, the exit route, and which
mechanics are active. Prefer animated replay with step-by-step, autoplay, replay,
and close. Viewing a solution never completes the level, awards stars, alters PAR,
or modifies progress.

## 11. Hint system

Already solver-driven. M1 hardens it: validate the current state, run the solver,
determine solvability, compute a safe next action, compare with the canonical
solution, and give the smallest useful hint. "More Hint" reveals one more step. If
the current configuration is unsolvable, state it plainly and offer Reset. Never
suggest a move that breaks solvability. Never randomize.

## 12. Audio

Shared audio service with a common cue set: tap, select, move, invalid, success,
perfect, combo, level complete, button. GLOWTRAIL adds rotate, launch, node, gate,
wormhole, vector, complete. Lightweight layered synthesis, no audio files. Respect
mute, effects volume, reduced motion, and haptics settings. Rate-limit overlapping
sounds.

## 13. Animation

Subtle glow, particle bursts, easing, path highlights, board transitions, score and
combo feedback, daily celebration. Never sacrifice 60 FPS for decoration. Honor
`prefers-reduced-motion`.

## 14. Accessibility

Keyboard operable where applicable, minimum 44px targets, `focus-visible`, reduced
motion, high contrast, and never color-only communication. GLYPH encodes exact,
present, and absent with both color and a non-color symbol. All palettes are
color-blind checked.

## 15. Performance

Mobile-first for inexpensive Android. No large image libraries, no heavyweight
engines, no extra dependencies, no unnecessary network. Lazy-load games, keep the
initial bundle small, cache chunks for offline, and cap device pixel ratio for
expensive rendering.

## 16. Android / Google Play

Keep `applicationId com.glowtrail.app`, display name "GLOWTRAIL Arcade". Verified:
targetSdk 36, AGP 8.11.1, Gradle 8.13, JDK 17, Capacitor 6, 64-bit safe (no native
code), release signing, versionCode increments, minimal permissions (INTERNET only).

## 17. Build output

`npm run android:sync`, `npm run android:apk`, `npm run android:aab`. APK for device
testing, AAB for Play. Verify outputs exist after each release build.

## 18. Test mode

Settings gains a Beta/Test section showing app version, build number, current game,
puzzles completed, daily challenges completed, and save state, with REPORT BUG,
SEND FEEDBACK, and RESET LOCAL SAVE. Reset requires confirmation and is the only
path that clears data.

## 19. Analytics seam

Interface only: `AnalyticsService` with `track(event, props?)` and a `NoopAnalytics`
default. Events: app_open, session_start, game_started, game_completed, game_failed,
hint_used, solution_viewed, daily_started, daily_completed, game_switched,
achievement_unlocked. Analytics is optional; core gameplay works with it disabled.
No paid analytics service in M1.

## 20. Monetization

Ads stay disabled in M1. Interfaces only: `AdsService`, `RewardedAd`,
`InterstitialAd`, `NoopAdsService`. Later placements: GLOWTRAIL rewarded hint, PRISM
rewarded hint, FUSION rewarded continue, occasional interstitial between sessions.
Never during gameplay.

## 21. Tester-ready design

M1 is designed so a real tester can exercise all four games, shared Home, Daily
Gauntlet, progression, cosmetics, solution viewer, hints, save/reload, offline,
audio, haptics, and accessibility. No fake engagement, no forced grinding.

## 22. Quality gate

Before M1 is complete: `npm test`, `npm run typecheck`, `npm run build` all pass,
then manual verification of fresh install, first and returning launch, navigation,
Android back, portrait, small phone, tablet, offline launch, corrupted save, v1
migration, persistence, Daily Gauntlet, streak, every game and exit, solution
viewer, hints, sound, haptics, reduced motion, and colorblind-safe UI. No known
crashes, no dead buttons, no placeholder screens, no fake functionality.

## 23. Scope guard

M1 only. Do not implement M2. M2 candidates after tester data: NEON TILE MATCH,
NEON BLOCKS, NEON PHYSICS, HIDDEN OBJECT/SEARCH. Choose based on engagement data.

## 24. Milestone ordering

1. Platform foundation: types, registry, router, services, save v2 + migration + tests.
2. GLOWTRAIL adapter over the existing controller/render, no behavior change.
3. Home/Dashboard launcher.
4. FUSION.
5. PRISM (with solvability validation).
6. GLYPH (offline data, colorblind-safe, twist).
7. Daily Gauntlet 3-of-4 + XP/level/achievements.
8. Cosmetics.
9. Solution viewer upgrade + hint hardening.
10. Audio/animation/accessibility pass, Test Mode, analytics seam.
11. Quality gate and Android rebuild.

After each step: run tests and build, fix regressions, commit a coherent change.

## 25. Deliberate decisions and rationale

- Keep the engine in place rather than relocating it: avoids rewriting 23 test
  import paths and the 5000-line risk surface. The `games/glowtrail` adapter
  satisfies the MiniGame contract without duplication.
- Hash routing: no server rewrite configuration needed under Capacitor `https`.
- Gauntlet and Daily Run coexist: preserves existing GLOWTRAIL behavior and save data.
- Ads and analytics are interfaces with no-op implementations: zero dependencies,
  no permissions, easy to enable later.
