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
- Hint rotates the next unsolved step of the exact minimum route (once per puzzle).
- From level 41 the Color Gates pack activates: a gate recolours the orb, and the exit only opens for the colour of the last gate.
- From level 81 Wormhole adds portals: entering one warps the orb to its partner and keeps the same direction, skipping the tiles between.
- From level 101 Vector adds one-way walls: a wall may only be crossed in its chevron direction, from either side.
- 120 story levels across six packs: Pulse (1-20), Surge (21-40), Color Gates (41-60), Lattice (61-80), Wormhole (81-100) and Vector (101-120), each harder than the last.
- Home shows a level map with stars, locks and a Continue card.

Daily Run is five date-seeded puzzles. Streak uses the local calendar date.
