import { describe, expect, it } from "vitest";
import { fitBox } from "../src/games/canvasFit";

describe("canvasFit", () => {
  it("uses the smaller dimension for a square box", () => {
    expect(fitBox(400, 260, 1)).toEqual({ w: 260, h: 260 });
  });

  it("preserves a non-square aspect ratio", () => {
    const { w, h } = fitBox(400, 260, 360 / 480);
    expect(w / h).toBeCloseTo(360 / 480, 1);
    expect(h).toBeLessThanOrEqual(260);
    expect(w).toBeLessThanOrEqual(400);
  });

  it("caps the longest edge at maxSize", () => {
    const { w, h } = fitBox(2000, 2000, 1, 360);
    expect(w).toBe(360);
    expect(h).toBe(360);
  });

  it("never returns a zero or negative dimension", () => {
    expect(fitBox(0, 0, 1)).toEqual({ w: 1, h: 1 });
    expect(fitBox(-50, 10, 1).w).toBeGreaterThanOrEqual(1);
  });

  it("treats an invalid aspect as square", () => {
    expect(fitBox(300, 300, 0)).toEqual({ w: 300, h: 300 });
  });
});
