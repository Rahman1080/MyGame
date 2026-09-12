import {
  applyHint,
  calculateStars,
  createSession,
  launch,
  reset,
  retry,
  rotateCell,
  undo,
  type PlaySession,
  type Puzzle,
  type SimStep,
} from "../engine";
import { generateDailyRun, localYmd } from "../gen/daily";
import { getLevel, nextUnsolved, PACKS, packForLevel } from "../levels/packs";
import { applyStreak, ensureDaily, loadSave, persistSave, recordSolve, starTotal } from "../save/storage";
import type { SaveData } from "../save/schema";
import { synth } from "../audio/synth";
import { noopAds } from "../ads/adService";

export type Screen = "home" | "board" | "win";
export type Mode = "story" | "daily";

export interface Anim {
  steps: SimStep[];
  index: number;
  t: number;
  duration: number;
  done: boolean;
  winFlash: number;
  failDim: number;
  rotating: { row: number; col: number; t: number } | null;
}

export interface Game {
  screen: Screen;
  mode: Mode;
  level: number;
  dailyIndex: number;
  session: PlaySession | null;
  save: SaveData;
  daily: Puzzle[];
  anim: Anim;
  selected: { row: number; col: number } | null;
  reduced: boolean;
}

function emptyAnim(): Anim {
  return {
    steps: [],
    index: 0,
    t: 0,
    duration: 110,
    done: true,
    winFlash: 0,
    failDim: 0,
    rotating: null,
  };
}

export function prefersReduced(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function createGame(): Game {
  const save = ensureDaily(loadSave(), localYmd());
  synth.setMuted(save.muted);
  return {
    screen: "home",
    mode: "story",
    level: nextUnsolved(save.solved, 1),
    dailyIndex: 0,
    session: null,
    save,
    daily: [],
    anim: emptyAnim(),
    selected: null,
    reduced: prefersReduced(),
  };
}

function persist(game: Game): void {
  persistSave(game.save);
}

export function currentPuzzle(game: Game): Puzzle {
  if (game.mode === "daily") {
    if (game.daily.length === 0) game.daily = generateDailyRun(localYmd());
    return game.daily[game.dailyIndex] ?? game.daily[0]!;
  }
  return getLevel(game.level);
}

export function openBoard(game: Game, mode: Mode, level?: number, dailyIndex?: number): void {
  game.mode = mode;
  if (mode === "story") {
    game.level = level ?? nextUnsolved(game.save.solved, 1);
  } else {
    game.save = ensureDaily(game.save, localYmd());
    game.daily = generateDailyRun(game.save.dailyDate ?? localYmd());
    game.dailyIndex = dailyIndex ?? game.save.dailyCompleted.findIndex((v) => !v);
    if (game.dailyIndex < 0) game.dailyIndex = 0;
  }
  game.session = createSession(currentPuzzle(game));
  game.anim = emptyAnim();
  game.screen = "board";
  game.selected = { row: game.session.puzzle.start.row, col: game.session.puzzle.start.col };
}

export function goHome(game: Game): void {
  game.screen = "home";
  game.session = null;
  game.anim = emptyAnim();
}

export function tapCell(game: Game, row: number, col: number): boolean {
  if (!game.session || game.session.phase !== "idle") return false;
  const ok = rotateCell(game.session, row, col);
  if (ok) {
    synth.rotate();
    game.anim.rotating = { row, col, t: 0 };
    game.selected = { row, col };
  }
  return ok;
}

export function doUndo(game: Game): void {
  if (!game.session) return;
  if (undo(game.session)) synth.rotate();
}

export function doReset(game: Game): void {
  if (!game.session) return;
  reset(game.session);
  game.anim = emptyAnim();
}

export function doHint(game: Game): void {
  if (!game.session) return;
  void noopAds.showRewardedHint();
  applyHint(game.session);
}

export function toggleMute(game: Game): void {
  game.save.muted = !game.save.muted;
  synth.setMuted(game.save.muted);
  persist(game);
}

export function doLaunch(game: Game): void {
  if (!game.session) return;
  if (!game.anim.done && game.session.phase !== "idle") return;
  if (game.session.phase === "failed") {
    retry(game.session);
    game.anim = emptyAnim();
    return;
  }
  if (!launch(game.session)) return;
  synth.launch();
  const result = game.session.lastResult;
  if (!result) return;
  if (game.reduced) {
    finishSim(game);
    return;
  }
  game.anim = {
    steps: result.path,
    index: 0,
    t: 0,
    duration: result.path.length > 10 ? 80 : 120,
    done: false,
    winFlash: 0,
    failDim: 0,
    rotating: null,
  };
}

function finishSim(game: Game): void {
  if (!game.session) return;
  game.anim.done = true;
  if (game.session.phase === "won") {
    synth.success();
    game.anim.winFlash = 1;
    const stars = calculateStars(game.session.rotations, game.session.puzzle.par);
    if (game.mode === "story") {
      game.save = recordSolve(game.save, game.session.puzzle.id, stars);
      if (game.level >= 3) game.save.tutorialDone = true;
      const pack = packForLevel(game.level);
      game.save.currentPack = pack.id;
    } else {
      const i = game.dailyIndex;
      game.save.dailyCompleted[i] = true;
      game.save.dailyStars[i] = Math.max(game.save.dailyStars[i] ?? 0, stars);
      if (game.save.dailyCompleted.every(Boolean)) {
        game.save = applyStreak(game.save, game.save.dailyDate ?? localYmd());
      }
    }
    persist(game);
    game.screen = "win";
  } else {
    synth.fail();
    game.anim.failDim = 1;
  }
}

export function tick(game: Game, dt: number): void {
  game.reduced = prefersReduced();
  if (game.anim.rotating) {
    game.anim.rotating.t += dt / 120;
    if (game.anim.rotating.t >= 1) game.anim.rotating = null;
  }
  if (game.anim.winFlash > 0) game.anim.winFlash = Math.max(0, game.anim.winFlash - dt / 500);
  if (game.anim.failDim > 0) game.anim.failDim = Math.max(0, game.anim.failDim - dt / 420);
  if (game.anim.done || !game.session) return;
  if (game.anim.steps.length === 0) {
    finishSim(game);
    return;
  }
  game.anim.t += dt;
  while (game.anim.t >= game.anim.duration && !game.anim.done) {
    game.anim.t -= game.anim.duration;
    game.anim.index += 1;
    synth.travel();
    if (game.anim.index >= game.anim.steps.length - 1) {
      finishSim(game);
      break;
    }
  }
}

export function nextAfterWin(game: Game): void {
  if (game.mode === "daily") {
    const next = game.save.dailyCompleted.findIndex((v) => !v);
    if (next >= 0) {
      openBoard(game, "daily", undefined, next);
      return;
    }
    goHome(game);
    return;
  }
  const n = Math.min(60, game.level + 1);
  openBoard(game, "story", n);
}

export function retryForStars(game: Game): void {
  if (!game.session) return;
  retry(game.session);
  game.anim = emptyAnim();
  game.screen = "board";
}

export function packProgress(game: Game, start: number, end: number): { solved: number; stars: number; max: number } {
  const ids: string[] = [];
  for (let i = start; i <= end; i += 1) ids.push(getLevel(i).id);
  const solved = ids.filter((id) => game.save.solved[id]).length;
  return { solved, stars: starTotal(game.save, ids), max: (end - start + 1) * 3 };
}

export { PACKS };
