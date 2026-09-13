import { describe, expect, it } from "vitest";
import { generateLevel } from "../src/gen/generator";

describe("performance", () => {
  it("generates all 80 story levels within a bounded time", () => {
    const t0 = Date.now();
    for (let i = 1; i <= 80; i += 1) generateLevel(i);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(45000);
  }, 60000);

  it("re-generating a level is deterministic", () => {
    const a = generateLevel(15).cells.map((c) => c.direction);
    const b = generateLevel(15).cells.map((c) => c.direction);
    expect(a).toEqual(b);
  });
});
