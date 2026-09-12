import type { Cell, CellType, ColorName, Direction, Puzzle } from "../src/engine/types";

export function cell(
  row: number,
  col: number,
  type: CellType,
  direction?: Direction,
  extra: Partial<Cell> = {},
): Cell {
  const required =
    extra.required ?? (type === "empty" || type === "exit" ? false : type === "arrow" || type === "start" || type === "gate");
  return {
    row,
    col,
    type,
    direction,
    canonicalDir: extra.canonicalDir ?? direction,
    required,
    locked: extra.locked,
    color: extra.color,
  };
}

export function fillGrid(size: number, placed: Cell[]): Cell[] {
  const map = new Map(placed.map((c) => [`${c.row},${c.col}`, c]));
  const cells: Cell[] = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      cells.push(
        map.get(`${r},${c}`) ?? {
          row: r,
          col: c,
          type: "empty",
          required: false,
        },
      );
    }
  }
  return cells;
}

export function straightPuzzle(): Puzzle {
  const cells = fillGrid(3, [
    cell(0, 0, "start", 1, { color: "cyan" as ColorName }),
    cell(0, 1, "arrow", 1, { color: "magenta" as ColorName }),
    cell(0, 2, "arrow", 2, { color: "amber" as ColorName }),
    cell(1, 2, "arrow", 2, { color: "lime" as ColorName }),
    cell(2, 2, "exit"),
  ]);
  return {
    id: "test-straight",
    seed: 1,
    size: 3,
    cells,
    start: { row: 0, col: 0 },
    exit: { row: 2, col: 2 },
    par: 0,
    difficulty: 1,
    pack: "pulse",
  };
}
