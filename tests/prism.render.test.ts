import { describe, expect, it } from "vitest";
import { PRISM_PALETTE, prismColor, prismLayout, tubeFromPoint, unitCenter } from "../src/games/prism/render";
import { levelPuzzle } from "../src/games/prism/generate";

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe("prism layout", () => {
  it("computes a single row for four or fewer tubes and wraps beyond that", () => {
    expect(prismLayout(4, 4).rows).toBe(1);
    expect(prismLayout(6, 4).rows).toBe(2);
    expect(prismLayout(8, 4).rows).toBe(2);
    expect(prismLayout(8, 4).cols).toBe(4);
  });

  it("keeps every tube inside the logical canvas and non-overlapping", () => {
    for (const count of [4, 6, 7, 8]) {
      const layout = prismLayout(count, 4);
      expect(layout.rects.length).toBe(count);
      for (const r of layout.rects) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(layout.logicalW);
        expect(r.y + r.h).toBeLessThanOrEqual(layout.logicalH);
      }
      for (let i = 0; i < layout.rects.length; i += 1) {
        for (let j = i + 1; j < layout.rects.length; j += 1) {
          expect(overlaps(layout.rects[i]!, layout.rects[j]!)).toBe(false);
        }
      }
    }
  });

  it("places stacked units inside their tube and ordered bottom-up", () => {
    const layout = prismLayout(6, 4);
    const rect = layout.rects[0]!;
    const bottom = unitCenter(rect, layout, 0);
    const top = unitCenter(rect, layout, 3);
    expect(bottom.y).toBeGreaterThan(top.y);
    for (let k = 0; k < 4; k += 1) {
      const c = unitCenter(rect, layout, k);
      expect(c.x).toBeCloseTo(rect.x + rect.w / 2, 5);
      expect(c.y).toBeGreaterThan(rect.y);
      expect(c.y).toBeLessThan(rect.y + rect.h);
    }
  });

  it("hit-tests tubes by point and misses outside", () => {
    const layout = prismLayout(6, 4);
    const rect = layout.rects[3]!;
    expect(tubeFromPoint(layout, rect.x + rect.w / 2, rect.y + rect.h / 2)).toBe(3);
    expect(tubeFromPoint(layout, -50, -50)).toBe(-1);
  });
});

describe("prism palette", () => {
  it("gives each colour a distinct hex value and wraps safely", () => {
    const set = new Set(PRISM_PALETTE);
    expect(set.size).toBe(PRISM_PALETTE.length);
    expect(prismColor(0)).toBe(PRISM_PALETTE[0]);
    expect(prismColor(PRISM_PALETTE.length)).toBe(PRISM_PALETTE[0]);
    expect(prismColor(-1)).toBe(PRISM_PALETTE[PRISM_PALETTE.length - 1]);
  });

  it("uses as many distinct colours as the hardest generated puzzle", () => {
    const p = levelPuzzle(18);
    expect(new Set(p.tubes.flat()).size).toBeLessThanOrEqual(PRISM_PALETTE.length);
  });
});
