import { describe, expect, it } from "vitest";
import { createWordConnectGame } from "../src/games/wordconnect/engine";
import {
  hitTestWheelNode,
  wheelGeometry,
  wheelNodePositions,
} from "../src/games/wordconnect/layout";

describe("Word Connect wheel layout", () => {
  it("produces one node per letter, all inside the canvas", () => {
    const state = createWordConnectGame(1); // letters A R T
    const w = 354;
    const h = 700;
    const nodes = wheelNodePositions(state, w, h, 0);

    expect(nodes.map((n) => n.letter).sort()).toEqual(["A", "R", "T"]);
    for (const n of nodes) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(w);
      expect(n.y).toBeGreaterThan(0);
      expect(n.y).toBeLessThan(h);
    }
  });

  it("hit-tests the exact drawn position back to the same node", () => {
    const state = createWordConnectGame(5); // 6 letters
    const nodes = wheelNodePositions(state, 354, 700, 1.3);
    for (const n of nodes) {
      expect(hitTestWheelNode(n.x, n.y, nodes)).toBe(n.index);
    }
  });

  it("misses empty space and out-of-bounds points", () => {
    const state = createWordConnectGame(5);
    const nodes = wheelNodePositions(state, 354, 700, 0);
    const { cx, cy } = wheelGeometry(354, 700);
    // Wheel centre is empty (nodes sit on a ring).
    expect(hitTestWheelNode(cx, cy, nodes)).toBe(-1);
    expect(hitTestWheelNode(-50, -50, nodes)).toBe(-1);
    expect(hitTestWheelNode(9999, 9999, nodes)).toBe(-1);
  });

  it("is deterministic for identical inputs", () => {
    const state = createWordConnectGame(3);
    const a = wheelNodePositions(state, 320, 640, 0.7);
    const b = wheelNodePositions(state, 320, 640, 0.7);
    expect(a).toEqual(b);
  });

  it("keeps wheel geometry stable across viewport sizes", () => {
    const mobile = wheelGeometry(354, 700);
    const desktop = wheelGeometry(394, 600);
    expect(mobile.cx).toBe(177);
    expect(desktop.cx).toBe(197);
    expect(mobile.radius).toBeGreaterThan(0);
    expect(desktop.nodeRadius).toBeGreaterThanOrEqual(20);
  });
});
