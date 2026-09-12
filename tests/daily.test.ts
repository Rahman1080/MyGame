import { describe, expect, it } from "vitest";
import { generateDailyRun, localYmd, previousYmd } from "../src/gen/daily";
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
