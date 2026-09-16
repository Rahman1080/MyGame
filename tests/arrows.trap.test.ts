import { describe, expect, it } from "vitest";
import { launch } from "../src/games/arrows/logic";
import { createLevelState, solveBoard } from "../src/games/arrows/generate";

describe("arrow escape has no dead ends", () => {
  it("never strands arrows: the canonical order always clears", { timeout: 60000 }, () => {
    for (let level = 1; level <= 40; level += 1) {
      let state = createLevelState(level);
      const info = solveBoard(state.size, state.arrows);
      expect(info.solvable).toBe(true);
      for (const index of info.order) {
        const step = launch(state, index);
        expect(step.moved, `level ${level} arrow ${index}`).toBe(true);
        state = step.state;
      }
      expect(state.status).toBe("solved");
    }
  });

  it("offers at least one ready arrow until the board is cleared", { timeout: 60000 }, () => {
    for (let level = 1; level <= 40; level += 1) {
      let state = createLevelState(level);
      let guard = 0;
      while (state.status === "playing" && guard < 200) {
        const info = solveBoard(state.size, state.arrows, state.alive);
        const index = info.initial[0];
        expect(index, `level ${level} stalled`).toBeDefined();
        const step = launch(state, index!);
        expect(step.moved).toBe(true);
        state = step.state;
        guard += 1;
      }
      expect(state.status).toBe("solved");
    }
  });
});
