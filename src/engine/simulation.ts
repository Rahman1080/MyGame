import { getCell, inBounds, requiredCount } from "./grid";
import { resolveStep } from "./movement";
import { DEFAULT_MECHANICS } from "./mechanics";
import { resolveTokenColor, requiredExitColor } from "./colorRules";
import type { Cell, ColorName, Direction, MechanicFlags, Puzzle, SimResult, SimStep } from "./types";

const BASE_TOKEN_COLOR: ColorName = "cyan";

function outgoingDir(cell: Cell): Direction | undefined {
  if (cell.type === "empty" || cell.type === "exit" || cell.type === "portal") return undefined;
  if (cell.type === "wall") return cell.wallDir ?? cell.direction;
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

/**
 * Advance a single token from start to exit.
 *
 * Movement is delegated to `resolveStep`, which knows about one-way walls and
 * portals. This loop owns the cross-cutting state: required-node coverage, the
 * carried color, loop detection and terminal win/fail decisions.
 */
export function simulatePuzzle(
  puzzle: Puzzle,
  cells: Cell[] = puzzle.cells,
  flags: MechanicFlags = DEFAULT_MECHANICS,
): SimResult {
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

  /** Enter a cell mid-warp: update color, path and required coverage. */
  const visit = (r: number, c: number): SimResult | null => {
    const ec = getCell(cells, r, c);
    if (!ec) return { outcome: "fail", reason: "OFF_GRID", path };
    color = resolveTokenColor(ec, color);
    path.push({ row: r, col: c, color });
    const req = requiredIndex.get(key(r, c));
    if (req !== undefined) visited.add(req);
    if (ec.type === "exit") {
      const wanted = requiredExitColor(ec);
      if (wanted && color !== wanted) return { outcome: "fail", reason: "WRONG_COLOR", path };
      if (allRequiredVisited()) return { outcome: "win", path };
      return { outcome: "fail", reason: "EXIT_TOO_SOON", path };
    }
    return null;
  };

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

    const step = resolveStep(cells, size, { row, col }, dir, flags);
    if (step.kind === "offGrid") {
      return { outcome: "fail", reason: "OFF_GRID", path };
    }
    if (step.kind === "blocked") {
      return { outcome: "fail", reason: "BLOCKED_WALL", path };
    }
    if (step.kind === "portalLoop") {
      return { outcome: "fail", reason: "PORTAL_LOOP", path };
    }

    if (step.kind === "warp") {
      // Intermediates are portal entries/exits; the landing is handled by the
      // next loop iteration so it is only appended (and coloured) once.
      for (const e of step.entered.slice(0, -1)) {
        const early = visit(e.row, e.col);
        if (early) return early;
      }
    }

    row = step.landing.row;
    col = step.landing.col;
  }

  return { outcome: "fail", reason: "LOOP", path };
}
