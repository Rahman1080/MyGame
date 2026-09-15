import { describe, expect, it } from "vitest";
import { createStateFrom, hintCell, isSolved, rotateCell, type ArrowsCell, type Dir } from "../src/games/arrows/logic";
import { createLevelState, generateEndlessBoard, generateLevel } from "../src/games/arrows/generate";
import type { ArrowsLevel } from "../src/games/arrows/logic";

function canonical(level: ArrowsLevel): boolean {
  const cells: ArrowsCell[] = level.cells.map((cell, i) =>
    (level.solution[i] ?? -1) >= 0 ? { ...cell, dir: level.solution[i] as Dir } : { ...cell },
  );
  return isSolved(createStateFrom({ ...level, cells }, "level"));
}

/**
 * Bulk sweep over the whole procedural campaign, complementing the focused
 * cases in arrows.test.ts. Guards against seeds that produce an unsolvable
 * board or a rotation budget that cannot reach the solution.
 */
describe("arrows generation sweep", () => {
  it("solves every campaign level by following hints within the rotation budget", () => {
    for (let level = 1; level <= 60; level += 1) {
      let state = createLevelState(level);
      expect(state.status).toBe("playing");
      let guard = 0;
      while (state.status === "playing" && guard < 800) {
        const cell = hintCell(state);
        if (cell === null) break;
        const out = rotateCell(state, cell);
        expect(out.changed).toBe(true);
        state = out.state;
        guard += 1;
      }
      expect(state.status).toBe("solved");
      expect(isSolved(state)).toBe(true);
    }
  });

  it("keeps a reachable canonical solution on every generated board", () => {
    for (const level of [7, 26, 44, 58]) {
      const board = generateLevel(level);
      expect(canonical(board)).toBe(true);
      if (board.maxRotations !== null) expect(board.maxRotations).toBeGreaterThanOrEqual(board.par);
    }
    for (let index = 0; index < 30; index += 1) {
      const board = generateEndlessBoard("arrows:endless:sweep", index);
      expect(board.sources.length).toBeGreaterThanOrEqual(1);
      expect(canonical(board)).toBe(true);
      if (board.maxRotations !== null) expect(board.maxRotations).toBeGreaterThanOrEqual(board.par);
    }
  });
});
