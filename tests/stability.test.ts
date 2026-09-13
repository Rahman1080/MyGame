import { describe, expect, it } from "vitest";
import { getLevel, TOTAL_LEVELS } from "../src/levels/packs";
import { STORY_MANIFEST_V1, STORY_MANIFEST_VERSION } from "../src/levels/manifest";
import { GENERATOR_VERSION, dailySeed, puzzleDigest, storySeed } from "../src/gen/identity";
import { seedForLevel } from "../src/gen/generator";
import { generateDailyRun } from "../src/gen/daily";

describe("story level stability", () => {
  it("freezes the v1 story manifest against generator drift", () => {
    expect(STORY_MANIFEST_VERSION).toBe(GENERATOR_VERSION);
    expect(STORY_MANIFEST_V1).toHaveLength(TOTAL_LEVELS);
    for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
      expect(puzzleDigest(getLevel(level)), `level ${level} drifted`).toBe(
        STORY_MANIFEST_V1[level - 1],
      );
    }
  }, 120000);

  it("namespaces story seeds by generator version", () => {
    expect(seedForLevel(25)).toBe(storySeed(25, GENERATOR_VERSION));
    expect(seedForLevel(25)).toBe(seedForLevel(25));
    expect(storySeed(25, "v1")).not.toBe(storySeed(25, "v2"));
  });
});

describe("daily run versioning", () => {
  it("same date and version yields identical puzzles", () => {
    const a = generateDailyRun("2026-09-12", "v1");
    const b = generateDailyRun("2026-09-12", "v1");
    expect(a.map((p) => puzzleDigest(p))).toEqual(b.map((p) => puzzleDigest(p)));
    expect(a).toHaveLength(5);
  });

  it("different dates yield different seeds", () => {
    expect(dailySeed("2026-09-12", "v1")).not.toBe(dailySeed("2026-09-13", "v1"));
  });

  it("a new generator version does not mutate v1 daily identity", () => {
    expect(dailySeed("2026-09-12", "v1")).not.toBe(dailySeed("2026-09-12", "v2"));
    const v1 = generateDailyRun("2026-09-12", "v1");
    const v2 = generateDailyRun("2026-09-12", "v2");
    expect(v1.map((p) => p.id)).not.toEqual(v2.map((p) => p.id));
  }, 60000);
});
