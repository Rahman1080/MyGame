import type { Cell, Puzzle } from "../engine/types";
import type { HintResult } from "../engine/hints";

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

/**
 * Dev-only snapshot of a hint decision: confidence, solution distance, the
 * chosen action, second action and how many candidates were ranked. Pure and
 * safe to call in tests.
 */
export function hintDebug(result: HintResult): string {
  const action = result.action
    ? `${result.action.row},${result.action.col} ${result.action.from}->${result.action.to}`
    : "none";
  const second = result.secondAction
    ? `${result.secondAction.row},${result.secondAction.col}`
    : "none";
  return [
    `hint=${result.available ? "yes" : "no"}`,
    `conf=${result.confidence}`,
    `distance=${result.distance}`,
    `action=${action}`,
    `second=${second}`,
    `candidates=${result.candidates.length}`,
  ].join(" ");
}
