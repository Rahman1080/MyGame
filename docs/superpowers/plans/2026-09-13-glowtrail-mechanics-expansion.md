# GLOWTRAIL Mechanics Expansion (Phases A-D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GLOWTRAIL engine tile-extensible and add Portals and One-Way Walls as fully solver/generator/render/audio/test-supported mechanics, with the remaining mechanics scaffolded behind disabled flags.

**Architecture:** Keep the existing Rotate & Launch loop untouched. Introduce a `mechanics` flag layer, a pure per-step `movement` resolver (portals warp, walls gate), teach `simulatePuzzle` to use it, add a generalized exact-minimum route search used only when a puzzle contains portals/walls (existing base puzzles keep the current solver byte-for-byte), and extend the generator/packs/rendering/audio around those.

**Tech Stack:** Vite + vanilla TypeScript, Canvas 2D, Vitest, localStorage, PWA. No new dependencies.

## Global Constraints

- Do not change: visual identity, Home/Board/Win/Daily screens, one-thumb controls, mobile-first portrait, Vite+vanilla TS, Canvas 2D, PWA, local save, no backend.
- Do not add mechanics to the existing 80 levels. New packs are appended after level 80.
- Experimental mechanics (splitters, timed tiles, switches, rotators, barriers, checkpoints) must exist only as types/flags and are disabled in production.
- Deterministic only: no `Date.now()`, `performance.now()`, or frame counts in puzzle rules.
- Player-facing par stays the proven exact minimum; never label unproven as minimum.
- Existing story levels 1-80 and their digests must not change.
- `vite.config.ts` keeps `allowedHosts: ['.monkeycode-ai.live']`.
- Engine/generator must not import DOM, Canvas, or localStorage.
- Run `npx vitest run`, `npm run typecheck`, `npm run build` after every task; commit per task.

---

## File Structure

- `src/engine/types.ts` — extend `CellType`, `Cell`, `FailReason`; add `MechanicId`, `MechanicFlags`, `SimulationState`/`Beam` (future multi-beam).
- `src/engine/mechanics.ts` (new) — flag constants, `DEFAULT_MECHANICS`, `mechanicsForPack`, `hasMechanic`, `activeMechanics`.
- `src/engine/tiles.ts` (new) — tile trait registry (`isRotatable`, `isPortal`, `isWall`, `passesThrough`) and portal-pair helpers.
- `src/engine/movement.ts` (new) — `resolveStep(...)` pure step resolver with wall gating and portal warping (cycle-guarded).
- `src/engine/simulation.ts` — use `resolveStep`; add `PORTAL_LOOP`, `BLOCKED_WALL` fail paths; keep color logic.
- `src/engine/solver.ts` — generalized exact-min search when `puzzleHasWarpMechanics`; keep existing path otherwise.
- `src/engine/validation.ts` — portal-pair/wall structural checks; mechanic-aware final validation.
- `src/engine/index.ts` — export new modules.
- `src/gen/difficulty.ts` — profiles for wormhole/vector bands; mechanic difficulty features.
- `src/gen/generator.ts` — portal splicing and wall placement in `buildCandidate`; fallback validity.
- `src/levels/packs.ts` — append Wormhole (81-100) and Vector (101-120); `TOTAL_LEVELS = 120`.
- `src/levels/manifest.ts` — extend frozen digests to 120 (1-80 unchanged).
- `src/save/schema.ts` — `KNOWN_PACKS` += `wormhole`, `vector`.
- `src/render/board.ts` — `drawPortal`, `drawWall`.
- `src/audio/synth.ts` — `portal()`, `blocked()`.
- `src/audio/haptics.ts` (new) — optional vibration service.
- `src/dev/debug.ts` (new) — dev-only debug string.
- Tests: `tests/movement.test.ts`, `tests/mechanics.test.ts`, `tests/portal.test.ts`, `tests/wall.test.ts`, `tests/generator.mechanics.test.ts`; update level-range loops to `TOTAL_LEVELS`.

---

### Task 1: Mechanic flags + extended tile types

**Files:**
- Modify: `src/engine/types.ts`
- Create: `src/engine/mechanics.ts`
- Test: `tests/mechanics.test.ts`

**Interfaces:**
- Produces: `type MechanicId = "colorGates"|"portals"|"oneWayWalls"|"splitters"|"timedTiles"|"switches"|"rotators"|"barriers"|"checkpoints"`, `interface MechanicFlags`, `DEFAULT_MECHANICS`, `mechanicsForPack(pack: string): MechanicFlags`, `hasMechanic(flags, id): boolean`.
- Produces: `CellType` adds `"portal"|"wall"|"splitter"|"timed"|"switch"|"rotator"|"barrier"|"checkpoint"`; `Cell` adds `portalId?`, `portalSide?`, `wallDir?`, `metadata?`.

- [ ] **Step 1: Write failing test** asserting `DEFAULT_MECHANICS.colorGates === true`, splitter/timed false, and `mechanicsForPack("wormhole").portals === true`, `mechanicsForPack("pulse").portals === false`.
- [ ] **Step 2: Run** `npx vitest run tests/mechanics.test.ts` — expect fail.
- [ ] **Step 3: Implement** the types + flags module.
- [ ] **Step 4: Run** test — expect pass.
- [ ] **Step 5: Commit** `feat(engine): add mechanic flags and tile-type scaffolding`.

### Task 2: Pure movement resolver (portals + walls)

**Files:**
- Create: `src/engine/movement.ts`
- Test: `tests/movement.test.ts`

**Interfaces:**
- Produces:
```ts
export type StepKind = "move" | "warp" | "offGrid" | "blocked";
export interface StepResult { kind: StepKind; row: number; col: number; dir: Direction; portalId?: string; }
export function resolveStep(cells: Cell[], size: number, from: {row,col}, dir: Direction, flags: MechanicFlags): StepResult;
```
- Rules: a `wall` cell is enterable only when `dir === wall.wallDir`; a `portal` cell warps to its pair preserving `dir`; warping into another portal chains until a non-portal or a repeated portal (`PORTAL_LOOP`); off-grid returns `offGrid`.

- [ ] **Step 1: Failing tests**: straight move; wall allows matching direction and blocks opposite; portal A->B preserves direction; portal chain A->B->C; portal cycle detected; off-grid.
- [ ] **Step 2: Run** tests — fail.
- [ ] **Step 3: Implement** `resolveStep`.
- [ ] **Step 4: Run** tests — pass.
- [ ] **Step 5: Commit**.

### Task 3: Simulation uses the resolver

**Files:**
- Modify: `src/engine/simulation.ts`, `src/engine/types.ts` (FailReason)
- Test: `tests/portal.test.ts`, `tests/wall.test.ts`

- [ ] **Step 1: Failing tests**: portal warp wins and path includes both portal cells; wall crossed allowed direction wins; wall blocked fails `BLOCKED_WALL`; portal cycle fails `PORTAL_LOOP`; existing color/base behavior unchanged.
- [ ] **Step 2: Run** — fail.
- [ ] **Step 3: Implement** by replacing the `directionToDelta` step with `resolveStep` (keeping current loop/state/color logic).
- [ ] **Step 4: Run full engine tests** — all pass.
- [ ] **Step 5: Commit**.

### Task 4: Generalized exact-minimum solver

**Files:**
- Modify: `src/engine/solver.ts`
- Test: `tests/solver.mechanics.test.ts`

- [ ] **Step 1: Failing tests**: min par for a portal shortcut is lower than canonical; wall maze min solved; base puzzle min unchanged (`generateLevel(30).par` equals previous value).
- [ ] **Step 2: Run** — fail.
- [ ] **Step 3: Implement** `minimumRotationSolver` dispatch: if `puzzleHasWarpMechanics(puzzle)` use a route BnB that enumerates outgoing directions and uses `resolveStep` (recording per-cell chosen dirs); else existing code. Return `routeDirs` for hints.
- [ ] **Step 4: Run** `tests/solver.test.ts tests/par.test.ts tests/boardSizes.test.ts` — pass.
- [ ] **Step 5: Commit**.

### Task 5: Hint on warp routes

**Files:**
- Modify: `src/engine/solver.ts`
- Test: `tests/polish.test.ts` (extend or new `tests/hint.mechanics.test.ts`)

- [ ] **Step 1: Failing test**: hint on a portal puzzle rotates a rotatable cell one step and reduces exact min by exactly one.
- [ ] **Step 2: Run** — fail.
- [ ] **Step 3: Implement** `firstWrongOnRoute(routeDirs)` skipping portal/wall cells.
- [ ] **Step 4: Run** — pass.
- [ ] **Step 5: Commit**.

### Task 6: Structural validation for portals/walls

**Files:**
- Modify: `src/engine/validation.ts`
- Test: `tests/mechanics.test.ts` (extend)

- [ ] **Step 1: Failing tests**: unbalanced portal id fails; portal without pair fails; wall without `wallDir` fails; valid pair passes.
- [ ] **Step 2: Run** — fail.
- [ ] **Step 3: Implement** checks in `validateStructure`.
- [ ] **Step 4: Run** — pass.
- [ ] **Step 5: Commit**.

### Task 7: Generator — portals + walls in candidates

**Files:**
- Modify: `src/gen/generator.ts`, `src/gen/difficulty.ts`
- Test: `tests/generator.mechanics.test.ts`

- [ ] **Step 1: Failing tests**: wormhole profiles produce >=1 balanced portal pair and win canonically; vector profiles produce >=1 wall with allowedDir and win; deterministic; invalid candidates rejected.
- [ ] **Step 2: Run** — fail.
- [ ] **Step 3: Implement** portal splicing (same-direction segments, demote skipped route cells to decoys) and wall conversion (straight route cells -> fixed walls) plus decoy wall placement; add `portalCount`/`wallCount` to `featuresFor` and weights.
- [ ] **Step 4: Run** — pass.
- [ ] **Step 5: Commit**.

### Task 8: Packs, manifest, save schema to 120

**Files:**
- Modify: `src/levels/packs.ts`, `src/levels/manifest.ts`, `src/save/schema.ts`, `src/gen/difficulty.ts`
- Test: update `tests/par.test.ts`, `tests/polish.test.ts`, `tests/solver.test.ts`, `tests/performance.test.ts`, `tests/boardSizes.test.ts`, `tests/generator.test.ts`, `tests/simulation.test.ts` level loops to `TOTAL_LEVELS`.

- [ ] **Step 1: Failing tests**: `TOTAL_LEVELS === 120`; packs wormhole/vector exist; levels 81-120 solvable with right mechanics; 1-80 digests unchanged.
- [ ] **Step 2: Run** — fail.
- [ ] **Step 3: Implement** packs/profiles and regenerate digests 81-120; keep 1-80 entries.
- [ ] **Step 4: Run full suite** — pass.
- [ ] **Step 5: Commit**.

### Task 9: Rendering + audio + haptics + debug

**Files:**
- Modify: `src/render/board.ts`, `src/audio/synth.ts`, `src/game/controller.ts`
- Create: `src/audio/haptics.ts`, `src/dev/debug.ts`

- [ ] **Step 1: Tests**: pure helpers (portal ring color index, wall chevron direction, haptics no-throw without navigator).
- [ ] **Step 2: Run** — fail.
- [ ] **Step 3: Implement** `drawPortal` (ring + A/B glyph) and `drawWall` (rail + chevron); `synth.portal()`/`synth.blocked()`; haptics service guarded by `navigator.vibrate`; debug string builder.
- [ ] **Step 4: Run** typecheck + build.
- [ ] **Step 5: Commit**.

### Task 10: Stress + final verification

**Files:**
- Modify: `tests/generator.stress.test.ts`, `docs/superpowers/specs/2026-09-13-glowtrail-polish-design.md`, `README.md`

- [ ] **Step 1: Add** wormhole/vector profiles to the stress matrix; assert portal pairs and walls valid for every seed.
- [ ] **Step 2: Run** `npm run test:stress` (10,000 seeds) — pass.
- [ ] **Step 3: Run** `npx vitest run`, `npm run typecheck`, `npm run build` — all pass.
- [ ] **Step 4: Update docs** and produce the final report.
- [ ] **Step 5: Commit**.

## Self-Review Notes

- Spec §13 numbering suggests Portals at 61-80, but 61-80 are already published as Lattice; to honor the stability non-negotiable we append Wormhole 81-100 and Vector 101-120 instead of mutating existing levels.
- Splitters and all later mechanics are types+flags only in this pass (explicitly disabled), matching the chosen scope.
