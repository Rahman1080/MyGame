# FUSION Level Mode — Design

Date: 2026-09-15
Status: approved
Parent: `2026-09-15-glowtrail-levels-and-hints-design.md` (Phase 4)

## Goal

Add a level mode to FUSION (merge-drop) with objectives, tiers, timers and
ad-gated hints, without changing the existing endless and daily modes.

## Objective

- Core objective: **REACH TIER N** — create an orb of tier >= N within a fixed
  **drop budget**.
- Win: objective met before the budget is exhausted.
- Fail: overflow (existing game over) or OUT OF DROPS without the objective;
  timed tiers also fail on TIME UP.
- Stars: 3 inside `par` drops, 2 inside `par + 3`, otherwise 1.

## Difficulty

- 105 levels, 15 per shared tier, deterministic queue from
  `fusion:level:<n>:v1`.
- Per tier: `targetTier`, `dropBudget`, `par`, spawn-weight skew and timer.
- EASY/NORMAL untimed; MEDIUM every 5th timed; HARD and above timed with the
  shared limit scaled by `FUSION_TIME_SCALE = 4`.
- Generation is solver-verified: a bounded beam search must find a winning drop
  order before a config is accepted; otherwise reseed with a relaxed budget.
  Verified configs are cached.

## Hints

- Unlimited and ad-gated via `hintGate`.
- A hint is the next column of a winning line recomputed from the current
  state, so it stays valid after deviations; it highlights that column.
- An already-lost position reports that instead of a false move.
- Pure `solver.ts`; the UI only runs it on press.

## Modes

- Endless and daily are unchanged.
- `choose` gains `LEVELS · 105`; a tier-sectioned level grid with solved state,
  stars and locks is added.
- New `mode: "level"` alongside `"endless" | "daily"`.

## Progression

- `FusionSave` gains `levels: Record<string, LevelRecord>`.
- `best` stores the fewest drops on a win, `bestTimeMs` the fastest win.
- Sequential unlock; XP on first clear only; replays only improve stars/best.
- Legacy v2 saves keep loading.

## Files

- New: `fusion/levels.ts`, `fusion/solver.ts`, `fusion/progress.ts`,
  `tests/fusion.levels.test.ts`, `tests/fusion.solver.test.ts`.
- Touched: `fusion/logic.ts` (additive `dropsUsed`/`objectiveMet`),
  `fusion/render.ts` (hint column, objective/budget marks), `fusion/ui.ts`,
  `save/schema.ts`, `styles/game.css`.

## Testing

- Config determinism, tier coverage, 100+ levels, solvability of every level.
- Solver: state cloning is independent, found lines are valid, hints are legal
  columns, lost positions report no move.
- Progress: record/idempotency, sequential unlock, first-win gating.

## Out of Scope

- Currency, shop, lives.
- Additional objective kinds beyond reach-tier (structured so they can be added
  later).
