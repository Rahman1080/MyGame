import type { LevelRecord, PrismSave } from "../../save/schema";
import { PRISM_LEVELS } from "./generate";

const MAX_LEVEL = PRISM_LEVELS;

function clampLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
}

export function prismLevelId(level: number): string {
  return `prism-${clampLevel(level)}`;
}

export function prismLevelNumber(id: string): number {
  const match = /^prism-(\d+)$/.exec(id);
  if (!match) return 0;
  const level = Number(match[1]);
  return level >= 1 && level <= MAX_LEVEL ? level : 0;
}

export function prismIsLevelSolved(save: PrismSave, level: number): boolean {
  return save.solved.includes(prismLevelId(level));
}

export function prismIsLevelUnlocked(save: PrismSave, level: number): boolean {
  const safe = clampLevel(level);
  if (safe <= 1) return true;
  return prismIsLevelSolved(save, safe) || prismIsLevelSolved(save, safe - 1);
}

export function prismNextLevel(save: PrismSave, from: number): number {
  const safe = clampLevel(from);
  if (safe >= MAX_LEVEL) return safe;
  return prismIsLevelUnlocked(save, safe + 1) ? safe + 1 : safe;
}

export function prismBumpAttempt(save: PrismSave, level: number): PrismSave {
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

export interface PrismWin {
  moves: number;
  stars: number;
  timeMs: number;
  hints: number;
}

export function prismRecordWin(save: PrismSave, level: number, win: PrismWin): PrismSave {
  const safe = clampLevel(level);
  const key = String(safe);
  const id = prismLevelId(safe);
  const prev = save.levels[key];
  const already = save.solved.includes(id);
  const solved = already ? save.solved : [...save.solved, id];
  const prevBest = save.bestMoves[id];
  const best = prevBest === undefined ? win.moves : Math.min(prevBest, win.moves);
  const bestTimeMs =
    win.timeMs > 0
      ? prev?.bestTimeMs != null
        ? Math.min(prev.bestTimeMs, win.timeMs)
        : win.timeMs
      : prev?.bestTimeMs ?? null;
  const record: LevelRecord = {
    won: true,
    stars: Math.max(prev?.stars ?? 0, win.stars),
    best: prev && prev.best > 0 ? Math.min(prev.best, win.moves) : win.moves,
    bestTimeMs,
    hints: (prev?.hints ?? 0) + win.hints,
    attempts: prev?.attempts ?? 1,
  };
  return {
    ...save,
    solved,
    bestMoves: { ...save.bestMoves, [id]: best },
    levels: { ...save.levels, [key]: record },
  };
}
