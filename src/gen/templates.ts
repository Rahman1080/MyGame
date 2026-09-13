import type { Cell, ColorName, Direction, Puzzle } from "../engine/types";
import { fillFromMap } from "./fill";

const C: ColorName[] = ["cyan", "magenta", "amber", "lime"];

function p(
  id: string,
  size: number,
  start: [number, number],
  exit: [number, number],
  entries: Array<[number, number, Direction, ColorName?, boolean?]>,
  tutorialStep: 1 | 2 | 3,
): Puzzle {
  const map = new Map<string, Cell>();
  for (const [row, col, dir, color, scramble] of entries) {
    const type = row === start[0] && col === start[1] ? "start" : "arrow";
    const canonicalDir = dir;
    const direction = scramble ? (((dir + 3) % 4) as Direction) : dir;
    map.set(`${row},${col}`, {
      row,
      col,
      type,
      direction,
      canonicalDir,
      required: true,
      color: color ?? C[(row + col) % 4],
    });
  }
  map.set(`${exit[0]},${exit[1]}`, {
    row: exit[0],
    col: exit[1],
    type: "exit",
    required: false,
  });
  const cells = fillFromMap(size, map);
  const par = cells.reduce((n, c) => {
    if (c.canonicalDir === undefined || c.direction === undefined || c.locked) return n;
    return n + ((c.canonicalDir - c.direction + 4) % 4);
  }, 0);
  return {
    id,
    seed: tutorialStep,
    size,
    cells,
    start: { row: start[0], col: start[1] },
    exit: { row: exit[0], col: exit[1] },
    par,
    parKind: "canonical",
    difficulty: 1,
    pack: "pulse",
    tutorial: true,
    tutorialStep,
  };
}

export function tutorialPuzzles(): Puzzle[] {
  return [
    p(
      "pulse-1",
      3,
      [1, 0],
      [1, 2],
      [
        [1, 0, 1, "cyan", false],
        [1, 1, 1, "magenta", true],
      ],
      1,
    ),
    p(
      "pulse-2",
      3,
      [0, 0],
      [2, 2],
      [
        [0, 0, 2, "cyan", true],
        [1, 0, 1, "lime", false],
        [1, 1, 2, "amber", true],
        [2, 1, 1, "magenta", false],
      ],
      2,
    ),
    p(
      "pulse-3",
      3,
      [0, 1],
      [2, 1],
      [
        [0, 1, 2, "cyan", false],
        [1, 1, 2, "magenta", false],
      ],
      3,
    ),
  ];
}
