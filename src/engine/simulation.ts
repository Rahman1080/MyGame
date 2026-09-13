import { getCell, inBounds, requiredCount } from "./grid";
import { directionToDelta } from "./rotation";
import { resolveTokenColor, requiredExitColor } from "./colorRules";
import type { Cell, ColorName, Puzzle, SimResult, SimStep } from "./types";

const BASE_TOKEN_COLOR: ColorName = "cyan";

function outgoingDir(cell: Cell): number | undefined {
  if (cell.type === "empty" || cell.type === "exit") return undefined;
  return cell.direction;
}

function key(row: number, col: number): string {
  return `${row},${col}`;
}

function requiredStateKey(visited: Set<number>): string {
  return Array.from(visited)
    .sort((a, b) => a - b)
    .join(".");
}

export function simulatePuzzle(puzzle: Puzzle, cells: Cell[] = puzzle.cells): SimResult {
  const size = puzzle.size;
  const requiredTotal = requiredCount(cells);
  const requiredIndex = new Map<string, number>();
  let index = 0;
  for (const c of cells) {
    if (c.required) {
      requiredIndex.set(key(c.row, c.col), index);
      index += 1;
    }
  }

  const path: SimStep[] = [];
  let row = puzzle.start.row;
  let col = puzzle.start.col;
  const visited = new Set<number>();
  let color: ColorName = BASE_TOKEN_COLOR;
  const seen = new Set<string>();

  const allRequiredVisited = () => visited.size === requiredTotal;
  const guardLimit = size * size * 8 + 8;

  for (let guard = 0; guard < guardLimit; guard += 1) {
    if (!inBounds(size, row, col)) {
      return { outcome: "fail", reason: "OFF_GRID", path };
    }
    const cell = getCell(cells, row, col);
    if (!cell) {
      return { outcome: "fail", reason: "OFF_GRID", path };
    }

    // Color rule: gates recolour the orb, ordinary arrows do not.
    color = resolveTokenColor(cell, color);

    path.push({ row, col, color });

    const required = requiredIndex.get(key(row, col));
    if (required !== undefined) visited.add(required);

    if (cell.type === "exit") {
      const wanted = requiredExitColor(cell);
      if (wanted && color !== wanted) {
        return { outcome: "fail", reason: "WRONG_COLOR", path };
      }
      if (allRequiredVisited()) return { outcome: "win", path };
      return { outcome: "fail", reason: "EXIT_TOO_SOON", path };
    }

    // Repeat state = same position, same required coverage, same token color.
    const state = `${row},${col},${requiredStateKey(visited)},${color}`;
    if (seen.has(state)) {
      return { outcome: "fail", reason: "LOOP", path };
    }
    seen.add(state);

    const dir = outgoingDir(cell);
    if (dir === undefined) {
      if (allRequiredVisited()) {
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
