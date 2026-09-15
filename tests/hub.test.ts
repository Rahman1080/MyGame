import { describe, expect, it } from "vitest";
import { createSaveService } from "../src/platform/services/save";
import { defaultSaveV2, sanitizeV2, type FusionSave } from "../src/save/schema";
import type { StorageLike } from "../src/save/storage";

class Mem implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
}

const sample: FusionSave = { best: 420, runs: 3, dailyBest: { "2026-09-15": 180 } };

describe("hub shared save slice", () => {
  it("keeps the game's slice reference live when the platform merges an update", () => {
    const svc = createSaveService(new Mem());
    const held = svc.get().games.fusion;
    svc.mutate((draft) => {
      Object.assign(draft.games.fusion, sample);
    });
    expect(svc.get().games.fusion).toBe(held);
    expect(held.best).toBe(420);
    expect(held.runs).toBe(3);
    expect(held.dailyBest["2026-09-15"]).toBe(180);
  });

  it("persists a fusion run and reloads the same numbers", () => {
    const mem = new Mem();
    const a = createSaveService(mem);
    a.mutate((draft) => {
      Object.assign(draft.games.fusion, sample);
    });
    const b = createSaveService(mem);
    expect(b.get().games.fusion).toEqual(sample);
  });

  it("does not let one game's update overwrite another game's slice", () => {
    const svc = createSaveService(new Mem());
    svc.mutate((draft) => {
      Object.assign(draft.games.fusion, { best: 100 });
      Object.assign(draft.games.glyph, { wins: 2 });
    });
    expect(svc.get().games.fusion.best).toBe(100);
    expect(svc.get().games.glyph.wins).toBe(2);
  });

  it("sanitizes a corrupt fusion slice instead of crashing", () => {
    const dirty = defaultSaveV2() as unknown as { games: Record<string, unknown> };
    dirty.games.fusion = { best: -5, runs: "many", dailyBest: { ok: 12, bad: "no" } };
    const clean = sanitizeV2(JSON.parse(JSON.stringify(dirty)));
    expect(clean.games.fusion).toEqual({ best: 0, runs: 0, dailyBest: { ok: 12 } });
  });
});
