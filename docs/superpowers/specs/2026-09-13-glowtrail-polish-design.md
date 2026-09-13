# GLOWTRAIL Polish Pass Design Spec

2026-09-13. Extends the locked core design. Does not change concept, mechanic, stack or visual identity.

## Motivation (measured)

- Par was labelled "minimum" but the BFS solver times out for most 4x4 (2s+ each) and all 5x5/6x6, so par secretly fell back to the canonical upper bound.
- The difficulty curve was non-monotonic: L1 par 6, L2 par 1; within 4x4, L22 par 19, L23 par 12, L24 par 18. The `difficulty` score did not track real solve length.
- Required nodes and optional decoys rendered identically, so puzzles read as guesswork.
- Pack 3 ("Color Gates") placed gates while `COLOR_MECHANIC_ENABLED` was `false`, so gates did nothing.
- Hint rotated the first required cell in row-major order with no visible feedback outside the tutorial.
- `packProgress`/`nextUnsolved` generated all 60 puzzles (solver included) on the Home screen.

## Decisions

1. **Par is an honest target.** Generated levels use the deterministic canonical route (`parKind: "canonical"`), always equal to `sum clockwiseDistance(scrambled -> canonicalDir)`. UI labels it `TARGET`, never `MIN`. The `minimumRotationSolver` remains available and budget-bounded, but is no longer used for shipped par. This is fast, deterministic and fair for star scoring.
2. **Real color-gate rule.** Token starts cyan; passing a gate sets token color; the exit accepts only the color of the last gate on the route. Levels without gates have no color requirement.
3. **Difficulty = measured features + target curve.** Each level has a `targetPar`; generation retries (bounded) until canonical par lands within `PAR_TOLERANCE`. Size and feature schedule ramps smoothly.
4. **Required nodes are visually primary.** Required arrows glow with a cell ring; decoys are dim and ringless. Locks show a hatch and lock glyph. Gates are colored diamonds. The exit shows its required color.
5. **Hint = next unsolved step on the canonical route**, highlighted with a pulsing ring, animated like a manual rotation, still once per puzzle.
6. **Home gets a real level map**: stats, Continue card, Daily card, pack tabs, and a per-level grid with stars and lock state. Level ids are derived without generating puzzles.

## Hint (A)

- `nextHint(puzzle, cells)` walks the canonical solution path and returns the first required, unlocked cell whose direction differs from `canonicalDir` as `{ row, col, from, to }`, `to = rotateDirection(from, 1)`. Falls back to row-major scan.
- `applyHint` records the move on `session.hint`, sets `hintUsed`, and increments rotations via the normal undo stack.
- `doHint` animates the rotation exactly like `tapCell` and plays the rotate sound.
- Board renders a pulsing double ring on `hint`.

## Color gates

- `COLOR_MECHANIC_ENABLED = true`.
- `resolveTokenColor`: a `gate` with `color` sets the token color; arrows never do.
- Simulation fails with `WRONG_COLOR` when the exit has a required color and the token color differs.
- Generator sets each gate's own color and sets `exit.color` to the last gate color along the canonical route; no gates means no color requirement.

## Difficulty (C)

- `DifficultyProfile` gains `targetPar`.
- `generatePuzzle` tries up to `PAR_ATTEMPTS` fresh seeds; accepts the first valid candidate within `PAR_TOLERANCE` of `targetPar`; otherwise returns the closest valid candidate. Falls back to the deterministic validated fallback.
- `profileForLevel` uses a smooth size/feature/targetPar schedule across 60 levels.
- `DIFFICULTY_WEIGHTS` rebalanced so size, par, required count, locks, decoys and route branching all contribute. UI derives a 1-5 dot rating from `puzzle.difficulty`.

## Home / level map (D)

- `levelId(level)` derives `pack-<level>` (matches tutorial ids) without generating.
- `packProgress`, `nextUnsolved`, `highestSolved`, `isLevelUnlocked`, `totalStars` are pure save lookups.
- Home: wordmark + mute; stats (total stars, streak); Continue card (next level + pack progress); Daily card; pack tabs; level grid (4 columns, star dots, lock/current styling). Home scrolls internally.
- A level is unlocked when `level <= highestSolved + 1`.
- Board HUD adds a moves/par line, star thresholds and a node count. Failures show a titled card with reason-specific guidance.

## Accessibility

- `aria-live="polite"` status region announces phase, win and fail reason.
- Canvas gets `role="img"` + descriptive `aria-label`.
- Keyboard: arrows move the selection cursor, `Space`/`R` rotates, `Enter` launches, `Escape` returns home.

## Acceptance criteria

- `npm test`, `npm run typecheck`, `npm run build` all pass.
- Every generated level is solvable and `calculatePar(p) === p.par`.
- Canonical par within `PAR_TOLERANCE` of `targetPar` for the large majority of levels.
- Color-gate levels require the correct color; non-gate levels have no color requirement.
- Hint always reduces clockwise distance to the canonical target and is visibly highlighted.
- Required vs decoy, locked and gate cells are visually distinct.
- Home renders without generating puzzles.
