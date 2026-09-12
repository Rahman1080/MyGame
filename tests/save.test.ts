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
