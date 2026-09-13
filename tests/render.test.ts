import { describe, expect, it } from "vitest";
import { portalRingColorIndex, portalRingHex, wallChevronDir } from "../src/render/board";
import { hapticFail, hapticPortal, hapticRotate, hapticWin, vibrate } from "../src/audio/haptics";
import { synth } from "../src/audio/synth";
import { debugSummary } from "../src/dev/debug";
import { DIR_DOWN, DIR_LEFT } from "../src/engine/types";
import { straightPuzzle } from "./helpers";

describe("portal and wall render helpers", () => {
  it("maps portal ids to a stable, in-range ring colour", () => {
    expect(portalRingColorIndex("w0")).toBe(portalRingColorIndex("w0"));
    for (const id of ["w0", "w1", "w2", "north", "south"]) {
      const index = portalRingColorIndex(id);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(4);
    }
    expect(portalRingHex(undefined)).toBe(portalRingHex(undefined));
  });

  it("defaults wall chevrons to RIGHT", () => {
    expect(wallChevronDir(DIR_DOWN)).toBe(DIR_DOWN);
    expect(wallChevronDir(DIR_LEFT)).toBe(DIR_LEFT);
    expect(wallChevronDir(undefined)).toBe(1);
  });
});

describe("haptics are safe everywhere", () => {
  it("never throws without a vibrate function", () => {
    expect(typeof vibrate(10)).toBe("boolean");
    expect(() => {
      hapticRotate();
      hapticPortal();
      hapticFail();
      hapticWin();
    }).not.toThrow();
  });
});

describe("audio and debug helpers", () => {
  it("portal and blocked cues no-op without an audio context", () => {
    expect(() => {
      synth.portal();
      synth.blocked();
    }).not.toThrow();
  });

  it("debug summary reports mechanic counts", () => {
    const summary = debugSummary(straightPuzzle());
    expect(summary).toContain("pack=pulse");
    expect(summary).toContain("portals=0");
    expect(summary).toContain("walls=0");
  });
});
