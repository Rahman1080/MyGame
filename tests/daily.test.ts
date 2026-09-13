import { describe, expect, it } from "vitest";
import { daysBetween, generateDailyRun, localYmd, previousYmd } from "../src/gen/daily";
import { applyStreak, ensureDaily } from "../src/save/storage";
import { defaultSave } from "../src/save/schema";
import { isSolvable } from "../src/engine";

describe("daily", () => {
  it("same local date yields the same five puzzles", () => {
    const a = generateDailyRun("2026-01-02");
    const b = generateDailyRun("2026-01-02");
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
    expect(a.every((p) => isSolvable(p))).toBe(true);
  });

  it("different dates yield a different sequence", () => {
    const a = generateDailyRun("2026-01-02");
    const b = generateDailyRun("2026-01-03");
    expect(a.map((p) => p.seed)).not.toEqual(b.map((p) => p.seed));
  });

  it("unfinished previous date does not carry forward", () => {
    let d = ensureDaily(defaultSave(), "2026-01-02");
    d.dailyCompleted[0] = true;
    d = ensureDaily(d, "2026-01-03");
    expect(d.dailyCompleted[0]).toBe(false);
  });

  it("completing five puzzles then next day increments streak", () => {
    let d = applyStreak(defaultSave(), "2026-01-02");
    expect(d.streak).toBe(1);
    d = applyStreak(d, "2026-01-03");
    expect(d.streak).toBe(2);
  });

  it("previousYmd and localYmd are calendar based", () => {
    expect(previousYmd("2026-03-01")).toBe("2026-02-28");
    expect(localYmd(new Date(2026, 8, 12))).toBe("2026-09-12");
  });
});

describe("daily calendar boundaries", () => {
  it("counts days across month, year and leap boundaries", () => {
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2025-02-28", "2025-03-01")).toBe(1);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
    expect(daysBetween("2024-02-29", "2024-03-01")).toBe(1);
    expect(daysBetween("2026-01-02", "2026-01-02")).toBe(0);
  });

  it("previousYmd steps over month, year and leap boundaries", () => {
    expect(previousYmd("2026-03-01")).toBe("2026-02-28");
    expect(previousYmd("2026-01-01")).toBe("2025-12-31");
    expect(previousYmd("2024-03-01")).toBe("2024-02-29");
    expect(previousYmd("2024-01-01")).toBe("2023-12-31");
  });

  it("increments through a leap-day run without double counting", () => {
    let d = applyStreak(defaultSave(), "2024-02-28");
    d = applyStreak(d, "2024-02-29");
    d = applyStreak(d, "2024-03-01");
    expect(d.streak).toBe(3);
    d = applyStreak(d, "2024-03-01");
    expect(d.streak).toBe(3);
  });

  it("increments across a year boundary and resets after a gap", () => {
    let d = applyStreak(defaultSave(), "2025-12-31");
    d = applyStreak(d, "2026-01-01");
    expect(d.streak).toBe(2);
    d = applyStreak(d, "2026-01-04");
    expect(d.streak).toBe(1);
  });
});
