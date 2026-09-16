# GLOWTRAIL Arcade — Levels, Tiers & Hints Program

Date: 2026-09-15
Status: approved in principle (Phase 0 + GLYPH pilot)

## Goal

Give every arcade game a large, structured amount of play with a consistent
difficulty ladder, a hint system that can later be gated by rewarded ads, and
optional per-level timers. This supersedes the earlier "do not overbuild" M1
guidance, but is delivered in reviewable phases.

Content target per game: 100+ levels, hints on every level, timed levels where
they add tension without being unfair.

## Shared framework (Phase 0)

### Difficulty tiers

One ladder for all games:

```
EASY -> NORMAL -> MEDIUM -> HARD -> SUPER HARD -> EXTRA HARD -> MIND BLOW
```

- `src/platform/levels.ts` owns the tier list, labels, band assignment and the
  timer policy.
- A game maps a tier to its own parameters (guess budget, spawn mix, colours,
  time limit, hint generosity).
- Levels are banded in order: with `N` levels and 7 tiers, each tier gets a
  contiguous band. `tierForLevel(level, total)` is pure and total.

### Level record

A single shape reused by every game's save slice:

```ts
interface LevelRecord {
  won: boolean;
  stars: number;
  best: number;            // primary "better" metric, game defined
  bestTimeMs: number | null;
  hints: number;
  attempts: number;
}
```

Games store `levels: Record<string, LevelRecord>` keyed by level number.
Sanitizers fill defaults so older saves keep loading.

### Hint gate

Hints are free while ads are disabled and ad-gated once ads are enabled:

```ts
function hintGate(adsEnabled: boolean, granted: boolean): boolean {
  return !adsEnabled || granted;
}
```

The UI calls `ctx.ads.rewarded().show()` only when `ctx.ads.enabled`; the no-op
M1 ads service reports disabled, so hints work today and need no change when a
real ads provider ships. The same gate is reused for future rewarded actions
(level skip, timer continue, double XP).

### Timer policy

Timers are a per-level mode, never universal:

- EASY, NORMAL: untimed.
- MEDIUM: every 5th level is a RUSH level (timed).
- HARD and above: timed by default.
- Time limits scale down with tier and up with complexity.
- Running out of time fails the level (and can later offer a rewarded continue).
- Logic never calls the clock: the UI tracks elapsed time with
  `performance.now()` and passes it to pure helpers
  (`timeLimitMs`, `isTimedLevel`, `timeLeftMs`, `expireTimer`).

## GLYPH pilot (Phase 1)

- 105 levels (15 per tier) plus the existing Daily.
- Deterministic level config from `glyph:level:<n>`: answer is a
  de-duplicated walk through `ANSWER_WORDS`; modifier is chosen per tier so the
  player sees the full modifier set, not only CLEAR SKIES.
- 6 guesses on every level; the existing board, keyboard and modifier rules are
  reused unchanged.
- Hints on every level and on the Daily: reveal the next answer letter that is
  in the word but not yet known and not already hinted. No positions, no absent
  letters, unlimited, ad-gated. Shown as an "IN THE WORD" chip row and a cyan
  `hint` state on the keyboard.
- Timed levels show a countdown; timeout is a loss.
- Level select screen: a Daily card above a tier-sectioned grid of 105 tiles
  with solved state, stars, best guesses and lock icons.
- Sequential unlock: level 1 is open; solving level `n` unlocks `n + 1`;
  solved levels are always replayable.
- Rewards: XP on first solve only; replays are practice with no XP and no save
  change. Levels never touch the Daily streak. The Daily stays the ranked,
  streak-bearing puzzle with its text share.
- Back navigation: play/result returns to the level grid; Android back stays on
  the central handler.

## Data model

`GlyphState` gains `mode`, `level`, `hinted: string[]`, `timeLimitMs` and
`timedOut`. `GlyphSave` gains `levels: Record<string, LevelRecord>` and its
`daily` records gain `hints`. `GlyphResult` gains `hints`, `mode`, `level` and
`timeMs`. All additions are optional on read and defaulted by the sanitizer, so
existing v2 saves remain valid.

## Testing

- Framework: tier banding is total and ordered; timer policy; hint gate truth
  table.
- Levels: deterministic config, unique answers across 105 levels, full modifier
  coverage per tier, first-win XP gating, idempotent recording, sequential
  unlock, legacy-save migration.
- Hints: selection order, skipping known/hinted letters, exhaustion, never
  leaking a position or an absent letter.
- Timer: `timeLeftMs`, `expireTimer` sets a loss with `timedOut`, untimed levels
  never expire.
- Render: level grid sections/locks, hint chips, keyboard hint state, timer bar.

## Rollout

1. Phase 0 — shared framework + save groundwork (no gameplay change).
2. Phase 1 — GLYPH: 105 levels, tiers, hints, timers, level select.
3. Phase 2 — PRISM: 100+ solver-verified levels + hints + tiers + timers.
4. Phase 3 — GLOWTRAIL: keep 120 levels, add tiers/timers and ad-gated hints.
5. Phase 4 — FUSION: level mode with objectives + hints + tiers + timers,
   endless retained as Arcade.
6. Phase 5 — Monetization: rewarded placements (hints, continue, skip, 2x XP)
   once an ads provider ships. Ads never block core play.

## Risks

- FUSION level mode is a redesign, not a tweak.
- Overusing timers makes logic/word games feel unfair; kept off early tiers.
- Hand-authored content quality: GLYPH answers are drawn from the curated list;
  PRISM keeps solver-verified generation.
- 100+ levels are proven with generation/validation tests, not per-level
  hand tests.
- Until ads ship every hint is effectively free; the gate is in place so this
  self-corrects at ads launch.
