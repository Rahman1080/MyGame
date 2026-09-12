import { getCell, inBounds, requiredCount, cellKey } from "./grid";
import { directionToDelta } from "./rotation";
import type { Cell, ColorName, Puzzle, SimResult, SimStep } from "./types";

function outgoingDir(cell: Cell): number | undefined {
  if (cell.type === "empty" || cell.type === "exit") return undefined;
  return cell.direction;
}

export function simulatePuzzle(puzzle: Puzzle, cells: Cell[] = puzzle.cells): SimResult {
  const size = puzzle.size;
  const requiredTotal = requiredCount(cells);
  const requiredIndex = new Map<string, number>();
  let bit = 0;
  for (const c of cells) {
    if (c.required) {
      requiredIndex.set(cellKey(c.row, c.col), bit);
      bit += 1;
    }
  }

  const path: SimStep[] = [];
  let row = puzzle.start.row;
  let col = puzzle.start.col;
  let mask = 0;
  let color: ColorName = "cyan";
  const seen = new Set<string>();

  const markRequired = () => {
    const idx = requiredIndex.get(cellKey(row, col));
    if (idx !== undefined) mask |= 1 << idx;
  };

  const allRequired = () => mask === (requiredTotal === 0 ? 0 : (1 << requiredTotal) - 1);

  for (let guard = 0; guard < size * size * 8 + 4; guard += 1) {
    if (!inBounds(size, row, col)) {
      return { outcome: "fail", reason: "OFF_GRID", path };
    }
    const cell = getCell(cells, row, col);
    if (!cell) {
      return { outcome: "fail", reason: "OFF_GRID", path };
    }

    if (cell.color && (cell.type === "arrow" || cell.type === "start" || cell.type === "gate")) {
      if (cell.type !== "gate") color = cell.color;
    }
    path.push({ row, col, color });

    markRequired();

    if (cell.type === "exit") {
      if (allRequired()) return { outcome: "win", path };
      return { outcome: "fail", reason: "EXIT_TOO_SOON", path };
    }

    if (cell.type === "gate" && cell.color && cell.color !== color) {
      return { outcome: "fail", reason: "DEAD_END", path };
    }
    if (cell.color && cell.type === "gate") color = cell.color;

    const state = `${row},${col},${mask},${color}`;
    if (seen.has(state)) {
      return { outcome: "fail", reason: "LOOP", path };
    }
    seen.add(state);

    const dir = outgoingDir(cell);
    if (dir === undefined) {
      if (allRequired()) {
        return { outcome: "fail", reason: "MISSED_NODE", path };
      }
      return { outcome: "fail", reason: "DEAD_END", path };
    }

    const { dr, dc } = directionToDelta(dir as 0 | 1 | 2 | 3);
    row += dr;
    col += dc;
  }

  return { outcome: "fail", reason: "LOOP", path };
}
