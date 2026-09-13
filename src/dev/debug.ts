import type { Cell, Puzzle } from "../engine/types";

/**
 * One-line, human-readable snapshot of a puzzle for the dev overlay and bug
 * reports. Pure (no DOM, no clocks) so it can run in any context.
 */
export function debugSummary(puzzle: Puzzle, cells: Cell[] = puzzle.cells): string {
  const portals = cells.filter((c) => c.type === "portal").length;
  const walls = cells.filter((c) => c.type === "wall").length;
  const required = cells.filter((c) => c.required).length;
  const par = `${puzzle.par}${puzzle.parKind ? `/${puzzle.parKind}` : ""}`;
  return [
    `id=${puzzle.id}`,
    `pack=${puzzle.pack}`,
    `size=${puzzle.size}`,
    `par=${par}`,
    `req=${required}`,
    `portals=${portals}`,
    `walls=${walls}`,
  ].join(" ");
}
