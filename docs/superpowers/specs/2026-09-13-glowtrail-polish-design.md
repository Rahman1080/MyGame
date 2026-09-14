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
5. **Hint = current-state solver assistant.** A hint is derived from the player's actual board, verified by the solver before it is shown, and never rotates the cell for the player. Superseded by the intelligent hint system below.
6. **Home gets a real level map**: stats, Continue card, Daily card, pack tabs, and a per-level grid with stars and lock state. Level ids are derived without generating puzzles.

## Hint (A)

Superseded by the Intelligent hint system at the bottom of this document. The historic `nextHint` helper (canonical route walk) still exists for internal comparisons, but the product uses `getHint`/`requestHint`.

## Color gates

Normative rules (the only color mechanic in the game):

- **Token color**: the orb starts as `cyan` and carries exactly one color at a time.
- **Gate color**: each `gate` cell has its own fixed `color` (one of cyan, magenta, amber, lime).
- **When it changes**: entering a `gate` sets the carried color to that gate's color. Ordinary arrows and the start/exit never change it (`resolveTokenColor`, `COLOR_MECHANIC_ENABLED = true`).
- **Mismatch / failure**: the exit stores `exit.color` = the last gate color on the canonical route. Reaching the exit while carrying a different color fails with `WRONG_COLOR`. Levels with no gates have `exit.color === undefined` and no color rule.
- **Accessibility**: gates are drawn as diamonds with an inner square marker (shape cue) and only then tinted; the exit shows its demanded color. Color is never the sole cue.
- Tests: `tests/polish.test.ts` (gated levels win on the canonical route, mismatch fails with `WRONG_COLOR`, plain levels carry no requirement) and `tests/simulation.test.ts`.

## Difficulty (C)

- `DifficultyProfile` gains `targetPar`.
- `generatePuzzle` tries up to `MINIMUM_ATTEMPTS` (minimum mode) or `CANONICAL_ATTEMPTS` fresh seeds; accepts the first valid candidate within `PAR_TOLERANCE` of `targetPar`; otherwise returns the closest valid candidate. Falls back to the deterministic validated fallback.
- `profileForLevel` uses a smooth size/feature/targetPar schedule across 120 levels. Late packs unlock portals (81-100) and one-way walls (101-120); their minimum par sits lower than the canonical-style ramp, so those profiles set a wider `parTolerance` (5).
- `DIFFICULTY_WEIGHTS` rebalanced so size, par, required count, locks, decoys and route branching all contribute. `alternativeSolutions` is weighted 0 until distinct-solution counting is implemented. UI derives a 1-10 dot rating from `puzzle.difficulty`.

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
- Every generated level is solvable and player-facing `par` equals the proven exact minimum (`parKind === "minimum"`).
- Minimum par within the profile's tolerance of `targetPar` for every story level.
- Color-gate levels require the correct color; non-gate levels have no color requirement.
- Hint always reduces the exact minimum distance by exactly one and is visibly highlighted.
- Required vs decoy, locked and gate cells are visually distinct.
- Home renders without generating puzzles.

## Mechanics expansion (2026-09-13)

Extends the loop with two deterministic, solver-friendly mechanics. Levels 1-80 and their digests are untouched; the campaign appends Wormhole (81-100) and Vector (101-120) so existing save keys and star records survive.

- **Modular tiles, not a mega-switch.** `MechanicFlags` (`src/engine/mechanics.ts`) enables each mechanic per pack. `DEFAULT_MECHANICS` ships colorGates, portals and oneWayWalls; splitters, timed tiles, switches, rotators, barriers and checkpoints exist only as types + flags and are disabled in production.
- **Pure movement resolver.** `resolveStep(cells, size, from, dir, flags)` returns `move | warp | offGrid | blocked | portalLoop`. A `wall` may only be entered while travelling in its `wallDir`; a `portal` warps to its partner and continues in the same direction, chaining through further portals and guarding against an infinite portal cycle. No clocks or randomness.
- **Simulation owns cross-cutting state.** `simulatePuzzle` delegates each step to `resolveStep` and keeps required-node coverage, carried color and loop detection. New failure reasons: `BLOCKED_WALL`, `PORTAL_LOOP`.
- **Exact minimum still proven.** `minimumRotationSolver` dispatches on `puzzleHasWarpMechanics`. Warp boards use a route branch-and-bound that enumerates the four outgoing directions of the resting cell, resolves each through `resolveStep`, and records per-cell `routeDirs`. A winning trajectory never revisits a cell (movement is deterministic), so a visited-set is sound. Base boards use the original orthogonal search unchanged.
- **Hints on warp routes.** `nextHint` follows `routeDirs` when present so a hint always reduces the proven minimum by exactly one, even across a warp.
- **Validation.** `validateStructure` rejects a portal without an id, an unbalanced `portalId`, or a wall without `wallDir`.
- **Generation.** `buildCandidate` splices a portal pair into a straight route segment, demoting skipped cells to decoys; walls convert straight route cells into fixed forced-passage tiles plus off-route decoys. Candidates that request a mechanic but place none are rejected. `featuresFor` counts `portals` and `walls` into the difficulty score.
- **Presentation.** Portals render as a coloured ring with an `A`/`B` glyph; walls render as a rail with a chevron in the allowed direction. `synth.portal()`/`synth.blocked()` and guarded haptics fire during the launch animation; `debugSummary` gives a one-line snapshot.
- Tests: `tests/movement.test.ts`, `tests/portal.test.ts`, `tests/wall.test.ts`, `tests/solver.mechanics.test.ts`, `tests/hint.mechanics.test.ts`, `tests/generator.mechanics.test.ts`, `tests/render.test.ts`, plus the 10,000-seed stress matrix.

## Intelligent hint system (2026-09-13)

Replaces "first wrong cell on the canonical route" with a small deterministic solving assistant. A hint is always CURRENT STATE -> CANDIDATE ACTIONS -> SIMULATE -> SOLVE/VERIFY -> RANK -> CHOOSE -> EXPLAIN -> SHOW, never CURRENT STATE -> GUESS -> SHOW.

- **Module.** `src/engine/hints.ts` is pure (no DOM/clocks/randomness). `getHint(puzzle, PlayerSolveState, options)` returns a `HintResult`; `buildSolution`, `solutionDistance` and `rankCandidates` are exported for tests and debug.
- **Solution model.** `buildSolution` prefers the proven exact-minimum solution from the player's board (which honours rotations already made); it falls back to the canonical route only when the exact search cannot complete and only if that route is reachable (no locked cell forced to an impossible direction). `Solution` carries per-cell target directions, `RotationAction[]`, total rotations, `exact` and `parKind`.
- **Candidate ranking.** Candidates are the first clockwise step toward each still-wrong target. Locked cells, empties, exits, walls and portals are excluded. Ranking weighs required nodes, the mechanic involved (portal/gate/wall/exit/node) and route order, then breaks ties deterministically.
- **Verification.** Before a hint is shown it is simulated on a cloned state. For exact solutions the clone is re-solved and must strictly reduce the proven minimum; for canonical fallbacks the remaining route is simulated to a win. Unverified actions are discarded rather than shown.
- **Two levels.** First hint is a single precise action. Tapping "More" recomputes from the board *after* the player's latest moves and, when useful, adds a verified second action or "then Launch". `hintUsed`/`strongHintUsed` are spent per puzzle; reset/retry do not refund them.
- **No auto-rotation.** `doHint` highlights one cell and prints a banner; `requestHint` never mutates `session.cells` or `rotations`. The player performs the rotation.
- **Failure-aware.** `session.lastFailReason` feeds the hint text (wrong color, blocked wall, missed nodes, portal loop, dead end/loop/off-grid) while the action itself stays solver-verified.
- **Mechanics.** Because verification runs the real simulator/solver, hints work with color gates, portals and one-way walls automatically. Experimental mechanics remain types/flags only; unknown mechanic cells are treated conservatively (a candidate is rejected unless it stays solvable).
- **Debug.** `hintDebug(result)` in `src/dev/debug.ts` prints confidence, distance, chosen/second action and candidate count.
- Tests: `tests/hints.test.ts` (24) plus session/controller regressions.
