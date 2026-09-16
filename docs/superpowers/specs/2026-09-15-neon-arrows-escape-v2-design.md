# NEON ARROWS — ARROW ESCAPE v2 Design

Date: 2026-09-15
Status: approved
Supersedes: the step-by-step ARROW ESCAPE model shipped in commit `32abf50`

## Goal

Deepen NEON ARROWS from a step-slide clear-all game into a large-board,
ordering puzzle. Boards grow to 9x9, arrows gain length, locks and color
tiers, and difficulty comes from dense interlocking packing. The win is still
"clear every arrow"; there is no fail state.

## Core mechanic

An arrow has a fixed direction and a length of 1-3 cells out of its head. A tap
launches it only when **its entire lane from its head to the board edge is free
of every other arrow's body**. On success the arrow flies off the board and
escapes. On failure it shakes in place and is ignored.

- Blocked: a lane cell is occupied by another arrow's body.
- Locked: the arrow's lock requirement is unmet.
- Collision is a pure ray test: walk head -> edge, test each cell against the
  other arrows' body cells. Length is honoured when building body cells.

Because a launch only ever removes an arrow, the reachable state is simply
"which arrows remain". Launching any available arrow is monotone-safe: a
removal can only clear lanes and advance locks, never create a new block. This
is what makes a solvable board impossible to fail.

### State model

Arrows never move while on the board; they are either present at their start
placement or escaped. So the only mutable data is:

- `alive: boolean[]` per arrow (or equivalently `escaped` count plus a live
  set),
- `escaped: number` (drives lock readiness),
- `missteps`, `hints`, `history` (for undo and scoring),
- `status: "playing" | "solved"`.

Every arrow's `dir`, `head`, `length` and `lock` are static board data. Body
cells are derived on demand from the static arrow definition, so no per-cell
position tracking is needed.

## Difficulty mechanics

- **Length 2-3 arrows** occupy 2-3 cells and block more lanes.
- **Locked arrows** stay locked until N other arrows have escaped. The exact
  remaining count is shown on the badge. A lock requirement is clamped to be
  satisfiable by the number of arrows that escape before it in the planted
  order, so it can never make a solvable board unsolvable.
- **Color-coded readiness tiers**: tint encodes lock tier, so sequencing reads
  at a glance. Tier color is derived from `lock`, not stored per arrow.
- **Dense interlocking packing**: level configs target narrow starts, where
  only a small number of arrows are launchable initially.

## Generator

Deterministic and guaranteed solvable.

1. **Reverse placement.** Build an ordered arrow list `0..count-1`. Place the
   last-escaping arrow first. A new arrow may not place any body cell into the
   escape lane of an already-placed arrow, and may not overlap any occupied
   cell. Placing in reverse order guarantees the forward index order clears the
   board, because when arrow `i` launches, every arrow that could block it is
   already gone.
2. **Locks during placement.** Assign lock `0..maxLock`, clamped so that the
   number of arrows escaping before it in the planted order is at least its
   lock.
3. **Difficulty analysis and banding.** Compute the blocking graph (`B` blocks
   `A` when a `B` body cell lies in `A`'s lane), the initial available count,
   forced-chain length and locked-gating depth. Each level defines target
   ranges for these; generation rejects candidates outside the band and keeps
   the closest as a fallback.

### Solver

`greedySolve(board, alive)` repeatedly launches any available arrow. Because
the relation is monotone, a single linear pass is exact:
- If every arrow is removed, the board is solvable.
- If arrows remain with none available, the board is unsolvable.

No exponential search. Returns the canonical order, the initial available
arrows (for hints and difficulty) and the arrow count. Verification of a full
campaign is therefore fast.

## Progression

- `ARROWS_TOTAL_LEVELS = 100`, sizes 4x4 -> 9x9.
- Arrow counts roughly 5 -> 24; lengths introduce 2 then 3; locks 0 -> 6;
  tiers 1 -> 4; late levels require narrow starts and long forced chains.
- Endless rises to 9x9 with a per-board score; daily is a seeded 7x7 board.

## Scoring, stars and records

- A tap the game rejects (blocked or locked) is a **misstep**.
- Stars: 3 when hints = 0 and missteps = 0; 2 when hints <= 1 and
  missteps <= 3; otherwise 1. Solved boards only.
- `perfect` is recorded when a level is first cleared with 3 stars and no
  missteps.
- Records: levels solved, total stars, perfect boards, endless best score and
  boards cleared, daily streak. Stored in `ArrowsSave`.

## UI and visual identity

Clarity-first on a flat grid, because 9x9 cells are ~42px on a 390px phone.

- Dimensional neon chevrons where the 1-3 cell length is obvious.
- Tier tint; lock badge showing the exact remaining escapes.
- **Lane ray preview** on press and hover: green to the edge when clear, red
  stopping at the blocker. Drawn as pure DOM classes.
- Escape fly-off, unlock pulse, blocked/locked shake. Reduce-motion honoured.
- HUD: LEFT / READY / MISSTEPS / HINTS. Menu gains a records panel and a
  100-level grid. Result card reports launches, missteps, hints and stars.
- Keyboard (arrows / Enter / U / H / Escape) and undo / restart retained.

## Save and migration

- `ARROWS_LEVEL_VERSION` becomes `v3`; `ArrowsSave` gains `version` and
  `perfect`.
- On load, when the stored `version` is missing or differs, the arrows slice is
  reset to defaults. This intentionally clears old arrows progress because
  v1 step-slide boards are invalid under the new rules.

## Testing

- Unit: lane/body geometry, blocked, locked, launch, escape, greedy solver
  (solvable and unsolvable), stars and misstep scoring.
- Generation sweep: all 100 levels solvable, no overlapping body cells, valid
  lengths, clamps hold, difficulty bands monotonic, deterministic per seed.
- Render: chevrons, tier tint, lock badges, lane rays, HUD, menu, result, help.
- Performance: full campaign generates within a bounded time.
- Playwright QA at 390x844 and 1024x768 across hub, menu, levels, launch,
  blocked/locked feedback, hint, undo, clear, next, daily and endless, with
  zero console errors.

## Known limitation

With full-lane launch and no fail state, **any available move is safe**; a
solvable board cannot be ruined. The challenge is perception and lock tracking,
rewarding clean no-hint, no-misstep runs rather than risk management. This is
a deliberate consequence of the approved "constraints only, no fail" choice.
Reintroducing consequence would need partial slides (arrow stops at the blocker
and stays) or a generous tap budget, which are explicitly out of scope here.

## Out of scope

- Target-orb routing, countdown timers and game-over screens from the reference
  image.
- Partial slides and tap budgets.
- Changes to other games or the shared platform.
