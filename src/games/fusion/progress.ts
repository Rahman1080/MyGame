import type { FusionSave, LevelRecord } from "../../save/schema";
import { FUSION_LEVELS } from "./levels";

function clampLevel(level: number): number {
  return Math.min(FUSION_LEVELS, Math.max(1, Math.floor(level)));
}

export function fusionLevelId(level: number): string {
  return `fusion-${clampLevel(level)}`;
}

export function fusionIsLevelSolved(save: FusionSave, level: number): boolean {
  const record = save.levels[String(clampLevel(level))];
  return record?.won ?? false;
}

export function fusionIsLevelUnlocked(save: FusionSave, level: number): boolean {
  const safe = clampLevel(level);
  if (safe <= 1) return true;
  return fusionIsLevelSolved(save, safe) || fusionIsLevelSolved(save, safe - 1);
}

export function fusionNextLevel(save: FusionSave, from: number): number {
  const safe = clampLevel(from);
  if (safe >= FUSION_LEVELS) return safe;
  return fusionIsLevelUnlocked(save, safe + 1) ? safe + 1 : safe;
}

export function fusionBumpAttempt(save: FusionSave, level: number): FusionSave {
  const key = String(clampLevel(level));
  const prev = save.levels[key];
  const record: LevelRecord = {
    won: prev?.won ?? false,
    stars: prev?.stars ?? 0,
    best: prev?.best ?? 0,
    bestTimeMs: prev?.bestTimeMs ?? null,
    hints: prev?.hints ?? 0,
    attempts: (prev?.attempts ?? 0) + 1,
  };
  return { ...save, levels: { ...save.levels, [key]: record } };
}

export interface FusionWin {
  drops: number;
  stars: number;
  timeMs: number;
  hints: number;
}

export function fusionRecordWin(save: FusionSave, level: number, win: FusionWin): FusionSave {
  const safe = clampLevel(level);
  const key = String(safe);
  const prev = save.levels[key];
  const bestTimeMs =
    win.timeMs > 0
      ? prev?.bestTimeMs != null
        ? Math.min(prev.bestTimeMs, win.timeMs)
        : win.timeMs
      : prev?.bestTimeMs ?? null;
  const record: LevelRecord = {
    won: true,
    stars: Math.max(prev?.stars ?? 0, win.stars),
    best: prev && prev.best > 0 ? Math.min(prev.best, win.drops) : win.drops,
    bestTimeMs,
    hints: (prev?.hints ?? 0) + win.hints,
    attempts: prev?.attempts ?? 1,
  };
  return { ...save, levels: { ...save.levels, [key]: record } };
}
