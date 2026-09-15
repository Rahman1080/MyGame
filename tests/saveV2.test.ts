import { describe, expect, it } from "vitest";
import { defaultSave, defaultSaveV2, SAVE_KEY_V1, SAVE_KEY_V2 } from "../src/save/schema";
import { loadSaveV2, type StorageLike } from "../src/save/storage";

class Mem implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

function writeV1(mem: Mem) {
  const v1 = {
    ...defaultSave(),
    stars: { "pulse-1": 3 },
    solved: { "pulse-1": true },
    currentPack: "surge",
    tutorialDone: true,
    streak: 4,
    lastDailyDate: "2026-09-10",
    dailyDate: "2026-09-10",
    muted: true,
  };
  mem.setItem(SAVE_KEY_V1, JSON.stringify(v1));
  return v1;
}

describe("save v2 migration", () => {
  it("migrates all v1 fields losslessly and keeps the v1 key", () => {
    const mem = new Mem();
    const v1 = writeV1(mem);
    const v2 = loadSaveV2(mem);
    expect(v2.version).toBe(2);
    expect(v2.games.glowtrail.stars).toEqual(v1.stars);
    expect(v2.games.glowtrail.solved).toEqual(v1.solved);
    expect(v2.games.glowtrail.currentPack).toBe("surge");
    expect(v2.games.glowtrail.tutorialDone).toBe(true);
    expect(v2.games.glowtrail.muted).toBe(true);
    expect(v2.games.glowtrail.dailyCompleted).toEqual(v1.dailyCompleted);
    expect(v2.profile.streak).toBe(4);
    expect(v2.profile.muted).toBe(true);
    expect(mem.getItem(SAVE_KEY_V1)).not.toBeNull();
    expect(mem.getItem(SAVE_KEY_V2)).not.toBeNull();
  });

  it("is idempotent", () => {
    const mem = new Mem();
    writeV1(mem);
    const a = loadSaveV2(mem);
    const b = loadSaveV2(mem);
    expect(b).toEqual(a);
  });

  it("fresh install returns defaults", () => {
    expect(loadSaveV2(new Mem())).toEqual(defaultSaveV2());
  });

  it("corrupt v1 does not throw and yields defaults", () => {
    const mem = new Mem();
    mem.setItem(SAVE_KEY_V1, "{not json");
    const v2 = loadSaveV2(mem);
    expect(v2.games.glowtrail.stars).toEqual({});
  });

  it("prefers an existing valid v2 over v1", () => {
    const mem = new Mem();
    writeV1(mem);
    const first = loadSaveV2(mem);
    first.profile.xp = 999;
    mem.setItem(SAVE_KEY_V2, JSON.stringify(first));
    expect(loadSaveV2(mem).profile.xp).toBe(999);
  });
});
