# GLOWTRAIL Home + Solution Viewer + Juice Design Spec

2026-09-14. Extends the locked core design. Does not change concept, mechanic, stack or visual identity.

## Motivation

- Home exposed every level grid at once, so the first screen was a dense wall of tiles; the reward loop (Continue / Daily) competed with it.
- There was no way to study a level's answer. Players who were stuck could only brute-force or leave.
- Audio was a handful of blips; there was no feedback for taps, stars or reveals, and screen changes popped in with no transition.
- Interaction affordances (menus, modals) did not exist; `Escape`/focus handling were board-only.

## Decisions

1. **The solved board becomes a first-class, read-only view** available (a) from the board as the *last* menu option and (b) from Home as a browse mode. Building it requires no player state: `solvedPreview(puzzle)` returns the solved cells plus the winning route.
2. **Revealing never changes progress.** It is a study aid. Stars, `solved` and pack progress are untouched; the player still has to solve the level themselves.
3. **Home hides the level map behind a `Levels` accordion**, collapsed by default. The header row carries the progress summary so the map is one tap away without dominating the screen.
4. **Identity is preserved.** The same palette, fonts, glow language and dark background. Polish adds depth, motion and clarity; it does not restyle.
5. **Motion is always optional.** Every new animation is gated behind `prefers-reduced-motion`.

## A. Solution viewer

### Engine: `solvedPreview(puzzle)`

- New pure export in `src/engine/hints.ts`:
  ```ts
  interface SolvedPreview {
    cells: Cell[];        // cloned board with each rotatable cell set to its answer
    path: SimStep[];      // the winning route, from simulated play
    exact: boolean;       // true when this is the proven exact-minimum solution
    parKind: ParKind;
    rotations: number;
  }
  function solvedPreview(puzzle: Puzzle, flags?: MechanicFlags): SolvedPreview | null;
  ```
- Prefers `minimumRotationSolver(puzzle)` when it returns an exact solution; derives outgoing directions from `routeDirs` (warp) or from consecutive `path` cells (base), applies them to a clone and re-simulates to a win.
- Falls back to `canonicalSolution(puzzle)` when the exact search is incomplete; returns `null` only if neither wins.
- Pure and deterministic: no DOM, no clocks, no randomness, never mutates the input.

### Board reveal

- The board dock adds a `...` **Menu** button. The menu is a bottom sheet listing **Home**, **Reset board**, and **Reveal solution** (last).
- Reveal opens a modal (`role="dialog"`, `aria-modal="true"`, labelled) containing a read-only canvas that renders the solved cells and the winning route, plus the copy "Solved route — solve it yourself."
- The route draws with an animated sweep (progress driven by `performance.now()`), disabled when reduced motion.
- Closing the modal returns to the player's own board, unchanged.

### Home solutions mode

- Inside the Levels accordion a segmented **Play / Solutions** switch toggles the grid's meaning.
- In Solutions mode a level tile opens the same read-only modal instead of opening the board. Locked state is ignored in Solutions mode (previews are available for every level).
- The modal is shared between Home and the board.

## B. Progress rule

- Reveal does not write to `SaveData`. No stars are awarded, no level is marked solved, no pack unlock changes.
- The player's board, rotations and hints are untouched.

## C. Home redesign

- Layout: header (wordmark + mute) → animated hero → stats (total stars, day streak) → Continue card → Daily card → **Levels accordion**.
- Accordion header: `LEVELS`, a summary (`<cleared>/120 · ★<stars>`) and a chevron that rotates on toggle. Collapsed by default.
- Expanded body: pack tabs, pack header (name + stars/max), 4-column level grid, and the Play/Solutions switch.
- Open/mode state is module-local in `main.ts`, resets on returning Home. The accordion uses `aria-expanded`/`aria-controls` and the pack tabs keep their locked/active styling.
- Visual polish within the existing identity: layered gradients, subtle borders, glow accents, improved spacing/typography and staggered entrance animations.

## D. Juice

- **Sound** (`src/audio/synth.ts`, no files): add `tap`, `step`, `star`, `reveal`, `sweep`; refine `rotate`, `launch`, `success`, `fail`. Cues fire on button taps, star reveal, reveal-solution open and route sweep.
- **Haptics** (`src/audio/haptics.ts`): add `hapticTap`, `hapticReveal`; keep the existing guards so non-vibrate environments no-op.
- **Animation**: shell fade/slide on screen change, staggered card entrances, route sweep on reveal, star pop on win, refined win overlay. All disabled under reduced motion.
- **Interface**: bottom-sheet board menu, shared solved-board modal, toast for hint/reveal feedback, refined dock/hud.
- **Accessibility**: modal focus handling + `Escape` to close, `focus-visible` rings, `aria-live` hint/reveal toast, mute reachable from Home and board, reduced-motion CSS block.

## Acceptance criteria

- `npx vitest run`, `npm run typecheck`, `npm run build` all pass.
- `solvedPreview` is pure; its returned board simulates to a win; `exact` is true only for a proven minimum; deterministic across calls.
- Reveal changes no save data and does not modify the player's session.
- Home renders collapsed; expanding shows the map; Solutions mode previews any level.
- Modal closes with the button and with `Escape`; every animation has a reduced-motion path.
- No engine module imports DOM/Canvas/localStorage; puzzle rules stay clock/frame free.

## Build phases

1. **Engine + viewer**: `solvedPreview` + tests, route rendering, board menu + modal, Home Solutions mode.
2. **Home redesign**: accordion, summary header, entrance polish.
3. **Juice**: sound, haptics, animation, interface, accessibility.

Each phase is verified independently before the next.
