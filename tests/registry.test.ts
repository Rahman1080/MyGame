import { describe, expect, it } from "vitest";
import { findGame, GAMES, isGameId } from "../src/platform/registry";

describe("game registry", () => {
  it("exposes the four M1 game ids in display order", () => {
    expect(GAMES.map((g) => g.meta.id)).toEqual(["glowtrail", "fusion", "prism", "glyph"]);
  });

  it("every descriptor has display metadata", () => {
    for (const g of GAMES) {
      expect(g.meta.name.length).toBeGreaterThan(0);
      expect(g.meta.tagline.length).toBeGreaterThan(0);
      expect(g.meta.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(g.meta.status === "ready" || g.meta.status === "soon").toBe(true);
    }
  });

  it("ready games have a lazy loader and coming-soon games do not", () => {
    for (const g of GAMES) {
      if (g.meta.status === "ready") expect(typeof g.load).toBe("function");
      else expect(g.load).toBeUndefined();
    }
  });

  it("looks up games by id and validates ids", () => {
    expect(findGame("prism")?.meta.name).toBe("PRISM");
    expect(findGame("nope")).toBeUndefined();
    expect(isGameId("glyph")).toBe(true);
    expect(isGameId("nope")).toBe(false);
  });
});
