import { directionToDelta } from "./rotation";
import { getCell, inBounds } from "./grid";
import type { Cell, Coord, Direction, MechanicFlags } from "./types";

export type StepKind = "move" | "warp" | "offGrid" | "blocked" | "portalLoop";

export interface StepResolution {
  kind: StepKind;
  from: Coord;
  dir: Direction;
  /** Cells entered during this step, in order: portal entries, warp exits, landing. */
  entered: Coord[];
  /** Final resting cell, or the attempted target for blocked/off-grid steps. */
  landing: Coord;
  portalId?: string;
}

function partnerOf(cells: Cell[], portal: Cell): Cell | undefined {
  if (!portal.portalId) return undefined;
  return cells.find(
    (c) =>
      c !== portal &&
      c.type === "portal" &&
      c.portalId === portal.portalId &&
      (c.row !== portal.row || c.col !== portal.col),
  );
}

function coord(c: { row: number; col: number }): Coord {
  return { row: c.row, col: c.col };
}

/**
 * Resolve a single move attempt from `from` in `dir`.
 *
 * - A `wall` may only be entered while travelling in its `wallDir`.
 * - A `portal` warps to its partner and continues in the same direction. Arriving
 *   at a portal is passive; entering one with another in the next cell chains.
 * - A portal pair revisited during one step is an unrecoverable `portalLoop`.
 *
 * Pure and deterministic: reads only cells + flags, no clocks or randomness.
 */
export function resolveStep(
  cells: Cell[],
  size: number,
  from: Coord,
  dir: Direction,
  flags: MechanicFlags,
): StepResolution {
  const { dr, dc } = directionToDelta(dir);
  const target: Coord = { row: from.row + dr, col: from.col + dc };
  if (!inBounds(size, target.row, target.col)) {
    return { kind: "offGrid", from, dir, entered: [], landing: target };
  }
  const targetCell = getCell(cells, target.row, target.col);
  if (!targetCell) {
    return { kind: "offGrid", from, dir, entered: [], landing: target };
  }

  if (targetCell.type === "wall" && flags.oneWayWalls) {
    if (targetCell.wallDir === dir) {
      return { kind: "move", from, dir, entered: [target], landing: target };
    }
    return { kind: "blocked", from, dir, entered: [target], landing: target };
  }

  if (targetCell.type === "portal" && flags.portals) {
    const entered: Coord[] = [coord(target)];
    const visited = new Set<string>();
    let portal: Cell = targetCell;
    let cur: Coord = coord(target);
    // Bounded by the number of portal pairs; the visited set is the real guard.
    for (let guard = 0; guard <= cells.length + 1; guard += 1) {
      const id = portal.portalId;
      if (!id || visited.has(id)) {
        return { kind: "portalLoop", from, dir, entered, landing: cur, portalId: id };
      }
      visited.add(id);
      const partner = partnerOf(cells, portal);
      if (!partner) {
        return { kind: "blocked", from, dir, entered, landing: cur, portalId: id };
      }
      const exit: Coord = { row: partner.row, col: partner.col };
      entered.push(exit);
      cur = exit;

      const nxt: Coord = { row: cur.row + dr, col: cur.col + dc };
      if (!inBounds(size, nxt.row, nxt.col)) {
        return { kind: "warp", from, dir, entered, landing: nxt, portalId: id };
      }
      const ncell = getCell(cells, nxt.row, nxt.col);
      if (!ncell) {
        return { kind: "warp", from, dir, entered, landing: nxt, portalId: id };
      }
      entered.push(coord(nxt));
      if (ncell.type === "portal" && flags.portals) {
        portal = ncell;
        cur = coord(nxt);
        continue;
      }
      if (ncell.type === "wall" && flags.oneWayWalls && ncell.wallDir !== dir) {
        return { kind: "blocked", from, dir, entered, landing: nxt, portalId: id };
      }
      return { kind: "warp", from, dir, entered, landing: nxt, portalId: id };
    }
    return { kind: "portalLoop", from, dir, entered, landing: cur };
  }

  return { kind: "move", from, dir, entered: [target], landing: target };
}
