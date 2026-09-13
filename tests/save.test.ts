import { describe, expect, it } from "vitest";
import { defaultSave, sanitizeSave } from "../src/save/schema";
import { applyStreak, ensureDaily, loadSave, persistSave, recordSolve, type StorageLike } from "../src/save/storage";

class Mem implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

describe("save", () => {
  it("first launch defaults", () => {
    expect(loadSave(new Mem())).toEqual(defaultSave());
  });

  it("persists stars, solved, pack, tutorial, mute", () => {
    const mem = new Mem();
    let data = defaultSave();
    data = recordSolve(data, "pulse-1", 3);
    data.currentPack = "surge";
    data.tutorialDone = true;
    data.muted = true;
    persistSave(data, mem);
    const loaded = loadSave(mem);
    expect(loaded.stars["pulse-1"]).toBe(3);
    expect(loaded.solved["pulse-1"]).toBe(true);
    expect(loaded.currentPack).toBe("surge");
    expect(loaded.tutorialDone).toBe(true);
    expect(loaded.muted).toBe(true);
  });

  it("corrupt JSON falls back to defaults", () => {
    const mem = new Mem();
    mem.setItem("glowtrail:v1", "{not json");
    expect(loadSave(mem)).toEqual(defaultSave());
  });

  it("missing and invalid fields use defaults without wiping valid data", () => {
    const s = sanitizeSave({
      stars: { a: 2, b: "nope" },
      solved: { a: true, b: 1 },
      streak: "x",
      muted: true,
    });
    expect(s.stars).toEqual({ a: 2 });
    expect(s.solved).toEqual({ a: true });
    expect(s.streak).toBe(0);
    expect(s.muted).toBe(true);
  });

  it("localStorage unavailable does not throw", () => {
    const broken: StorageLike = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };
    expect(() => loadSave(broken)).not.toThrow();
    expect(() => persistSave(defaultSave(), broken)).not.toThrow();
  });

  it("same-day streak does not increment", () => {
    let d = applyStreak(defaultSave(), "2026-09-12");
    expect(d.streak).toBe(1);
    d = applyStreak(d, "2026-09-12");
    expect(d.streak).toBe(1);
  });

  it("next-day streak increments", () => {
    let d = applyStreak(defaultSave(), "2026-09-12");
    d = applyStreak(d, "2026-09-13");
    expect(d.streak).toBe(2);
  });

  it("gap resets streak", () => {
    let d = applyStreak(defaultSave(), "2026-09-12");
    d = applyStreak(d, "2026-09-15");
    expect(d.streak).toBe(1);
  });

  it("new date discards previous daily progress", () => {
    let d = ensureDaily(defaultSave(), "2026-09-12");
    d.dailyCompleted = [true, true, false, false, false];
    d.dailyStars = [3, 2, 0, 0, 0];
    d = ensureDaily(d, "2026-09-13");
    expect(d.dailyCompleted).toEqual([false, false, false, false, false]);
    expect(d.dailyStars).toEqual([0, 0, 0, 0, 0]);
    expect(d.dailyDate).toBe("2026-09-13");
  });
});

describe("save bounds validation", () => {
  it("clamps stars to 0..3", () => {
    const s = sanitizeSave({ stars: { a: 9, b: -3, c: 2.7, d: "x" } });
    expect(s.stars).toEqual({ a: 3, b: 0, c: 3 });
  });

  it("clamps dailyStars to 0..3", () => {
    const s = sanitizeSave({ dailyStars: [5, -1, 3, 3.9, 0] });
    expect(s.dailyStars).toEqual([3, 0, 3, 3, 0]);
  });

  it("requires exactly five daily entries", () => {
    const s = sanitizeSave({ dailyCompleted: [true, true], dailyStars: [1, 2, 3, 4, 5, 6] });
    expect(s.dailyCompleted).toHaveLength(5);
    expect(s.dailyStars).toHaveLength(5);
    expect(s.dailyCompleted).toEqual([true, true, false, false, false]);
    expect(s.dailyStars).toEqual([1, 2, 3, 3, 3]);
  });

  it("rejects unknown packs and malformed dates", () => {
    const s = sanitizeSave({
      currentPack: "hacked",
      lastDailyDate: "2026-99-99",
      dailyDate: "not-a-date",
    });
    expect(s.currentPack).toBe("pulse");
    expect(s.lastDailyDate).toBeNull();
    expect(s.dailyDate).toBeNull();
  });

  it("accepts valid packs and dates", () => {
    const s = sanitizeSave({
      currentPack: "color-gates",
      lastDailyDate: "2026-09-12",
      dailyDate: "2026-02-28",
    });
    expect(s.currentPack).toBe("color-gates");
    expect(s.lastDailyDate).toBe("2026-09-12");
    expect(s.dailyDate).toBe("2026-02-28");
  });

  it("requires a non-negative integer streak", () => {
    expect(sanitizeSave({ streak: -4 }).streak).toBe(0);
    expect(sanitizeSave({ streak: 2.9 }).streak).toBe(2);
    expect(sanitizeSave({ streak: 7 }).streak).toBe(7);
    expect(sanitizeSave({ streak: "x" }).streak).toBe(0);
  });
});
