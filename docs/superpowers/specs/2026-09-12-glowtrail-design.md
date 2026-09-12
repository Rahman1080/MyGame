# GLOWTRAIL Design Spec

Locked 2026-09-12. Do not redesign concept, mechanics, visual identity, architecture, or stack.

## Product

Mobile-first neon path puzzle. Rotate arrows, Launch, visit every required node, exit the portal. One thumb, snack sessions, Daily Run streak.

Stack: Vite + vanilla TypeScript + HTML/CSS + Canvas 2D. No React, no backend, no accounts. PWA, offline after first visit.

## Loop

Home → Play → rotate → Launch → win/fail → next. Daily Run = 5 date-seeded puzzles, streak on local calendar dates.

## Mechanic

Tap cell: rotate arrow clockwise 90° (0=UP, 1=RIGHT, 2=DOWN, 3=LEFT). Launch simulates a deterministic path. Ignore input during simulation. Retry restores pre-launch rotations. Undo last rotation. Reset to original. Hint once: one clockwise step toward canonical solution.

## Rules

Token starts at Start, follows each cell’s outgoing direction. Success: visit every required node, then enter Exit. Empty cells are not required. Fail: off-grid, dead end, exit too soon, missed node, unrecoverable loop. Loop = repeated `(row, col, visitedRequiredMask)`, not merely revisiting a cell.

## Generation

Path first, then arrows, scramble, lock, validate, par. Never ship unsolvable puzzles. Same seed + version = same puzzle. No `Math.random()` in generation. Tutorial 1–3 hand-authored. Packs: Pulse 1–20, Surge 21–40, Color Gates 41–60.

Par = sum of clockwise 90° steps from scrambled start to canonical solution (unlocked cells only). Stars: 3 if rotations ≤ par, 2 if ≤ par+2, 1 otherwise.

## Persistence

`localStorage` key `glowtrail:v1`. Corrupt fields reset individually. Streak uses YYYY-MM-DD. Daily progress does not carry across dates.

## UI (locked)

Background `#07080D`. Cyan `#29DDF4`, magenta `#E45CFF`, amber `#FFC857`, lime `#9CFF4F`. Board is the hero. Start = cyan orb (IN). Exit = magenta diamond (OUT). Launch bottom; becomes Retry on fail. HUD: Undo, level or Daily `n / 5`, rotations/par, Hint, Mute. Home: wordmark, Play, Daily Run + flame streak, packs.

Motion: 120ms rotate, 80–140ms/cell token, path flash + portal bloom on win. `prefers-reduced-motion`: instant result, same logic.

## Non-goals

No ads in v1 (noop AdService). No cloud save. No tutorial screen. No clone of another game’s assets.
