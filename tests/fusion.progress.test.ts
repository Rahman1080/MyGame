import { describe, expect, it } from "vitest";
import { defaultSaveV2 } from "../src/save/schema";
import { FUSION_LEVELS } from "../src/games/fusion/levels";
import {
  fusionBumpAttempt,
  fusionIsLevelSolved,
  fusionIsLevelUnlocked,
  fusionNextLevel,
  fusionRecordWin,
} from "../src/games/fusion/progress";

function save() {
  return defaultSaveV2().games.fusion;
}

describe("fusion level progress", () => {
  it("starts with no levels solved and only level 1 unlocked", () => {
    const s = save();
    expect(fusionIsLevelSolved(s, 1)).toBe(false);
    expect(fusionIsLevelUnlocked(s, 1)).toBe(true);
    expect(fusionIsLevelUnlocked(s, 2)).toBe(false);
  });

  it("records a win with stars, best drops and best time", () => {
    const s = fusionRecordWin(save(), 1, { drops: 7, stars: 3, timeMs: 40000, hints: 0 });
    expect(fusionIsLevelSolved(s, 1)).toBe(true);
    const record = s.levels["1"]!;
    expect(record.won).toBe(true);
    expect(record.stars).toBe(3);
    expect(record.best).toBe(7);
    expect(record.bestTimeMs).toBe(40000);
  });

  it("keeps the best result across replays", () => {
    let s = fusionRecordWin(save(), 1, { drops: 9, stars: 2, timeMs: 50000, hints: 1 });
    s = fusionRecordWin(s, 1, { drops: 6, stars: 3, timeMs: 60000, hints: 0 });
    const record = s.levels["1"]!;
    expect(record.best).toBe(6);
    expect(record.bestTimeMs).toBe(50000);
    expect(record.hints).toBe(1);
  });

  it("unlocks levels sequentially", () => {
    const s = fusionRecordWin(save(), 1, { drops: 5, stars: 3, timeMs: 10000, hints: 0 });
    expect(fusionIsLevelUnlocked(s, 2)).toBe(true);
    expect(fusionIsLevelUnlocked(s, 3)).toBe(false);
    expect(fusionNextLevel(s, 1)).toBe(2);
  });

  it("never unlocks past the last level", () => {
    const s = save();
    expect(fusionNextLevel(s, FUSION_LEVELS)).toBe(FUSION_LEVELS);
  });

  it("counts attempts without marking a win", () => {
    const s = fusionBumpAttempt(save(), 2);
    expect(s.levels["2"]!.attempts).toBe(1);
    expect(s.levels["2"]!.won).toBe(false);
    const again = fusionBumpAttempt(s, 2);
    expect(again.levels["2"]!.attempts).toBe(2);
  });
});
