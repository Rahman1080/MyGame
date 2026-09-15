import { localYmd } from "../../gen/daily";
import { setBackHandler } from "../../platform/router";
import { EVENTS } from "../../platform/services/telemetry";
import type { GameContext } from "../../platform/types";
import type { ArrowsSave } from "../../save/schema";
import {
  ARROWS_TOTAL_LEVELS,
  boardValue,
  dailyBestStars,
  dailyStreakOn,
  emptyArrowsSave,
  finalResult,
  hintCell,
  isDailyDone,
  isLevelSolved,
  isLevelUnlocked,
  levelScore,
  levelStars,
  recordDailyRun,
  recordEndlessRun,
  recordLevelRun,
  rotateCell,
  type ArrowsResult,
  type ArrowsState,
} from "./logic";
import { createDailyState, createEndlessState, createLevelState } from "./generate";
import {
  boardHtml,
  helpHtml,
  hudHtml,
  liveStatusHtml,
  menuHtml,
  modeLabel,
  playShellHtml,
  resultCardHtml,
  statusText,
  type BoardView,
  type LevelOption,
  type MenuView,
  type ResultView,
} from "./render";

type Screen = "menu" | "play" | "over" | "help";

let app: HTMLElement;
let ctx: GameContext<ArrowsSave> | null = null;
let state: ArrowsState | null = null;
let screen: Screen = "menu";
let helpFrom: Screen = "menu";
let date = "";
let cursor = 0;
let keyboardMode = false;
let hintFocus: number | null = null;
let statusMessage = "";
let resultView: ResultView | null = null;
let transitioning = false;
let endlessScore = 0;
let endlessCleared = 0;
let endlessIndex = 0;
let endlessSeed = "";
let endlessRun = 0;
let aborter: AbortController | null = null;
let timers: number[] = [];

function reduced(): boolean {
  return ctx?.settings.reduceMotion() ?? false;
}

function schedule(fn: () => void, ms: number): void {
  const id = window.setTimeout(fn, ms);
  timers.push(id);
}

function clearTimers(): void {
  for (const id of timers) window.clearTimeout(id);
  timers = [];
}

function save(): ArrowsSave {
  return ctx?.save ?? emptyArrowsSave();
}

function boardElement(): HTMLElement | null {
  return app.querySelector<HTMLElement>(".nar-board");
}

function setStatus(message: string): void {
  statusMessage = message;
  const el = app.querySelector<HTMLElement>("#arrows-status");
  if (el) el.textContent = message;
}

function refreshPlay(): void {
  if (!state) return;
  const view: BoardView = { focus: keyboardMode ? cursor : null, hint: hintFocus };
  const wrap = app.querySelector<HTMLElement>(".nar-board-wrap");
  if (wrap) wrap.innerHTML = boardHtml(state, view);
  const hud = app.querySelector<HTMLElement>(".nar-hud");
  if (hud) hud.outerHTML = hudHtml(state);
  setStatus(statusMessage);
  if (keyboardMode) boardElement()?.focus();
}

function buildMenuView(): MenuView {
  const current = save();
  const levels: LevelOption[] = [];
  let totalStars = 0;
  let nextLevel = ARROWS_TOTAL_LEVELS;
  let foundNext = false;
  for (let level = 1; level <= ARROWS_TOTAL_LEVELS; level += 1) {
    const stars = levelStars(current, level);
    totalStars += stars;
    levels.push({ level, stars, unlocked: isLevelUnlocked(current, level) });
    if (!foundNext && !isLevelSolved(current, level)) {
      nextLevel = level;
      foundNext = true;
    }
  }
  return {
    date,
    levels,
    totalStars,
    nextLevel,
    bestRun: current.bestRun,
    boards: current.boards,
    dailyDone: isDailyDone(current, date),
    dailyStreak: dailyStreakOn(current, date),
    dailyBest: dailyBestStars(current, date),
  };
}

function render(): void {
  if (screen === "menu") {
    app.innerHTML = menuHtml(buildMenuView(), reduced());
    return;
  }
  if (screen === "help") {
    app.innerHTML = helpHtml(reduced());
    return;
  }
  if (!state) {
    screen = "menu";
    render();
    return;
  }
  const body = { board: boardHtml(state, { focus: keyboardMode ? cursor : null, hint: hintFocus }), status: liveStatusHtml(statusMessage) };
  app.innerHTML = playShellHtml(state, modeLabel(state.mode, state), body, reduced());
  if (screen === "over" && resultView) {
    const shell = app.querySelector<HTMLElement>(".nar-shell");
    if (shell) shell.insertAdjacentHTML("beforeend", resultCardHtml(resultView));
  }
}

function spawnSparks(): void {
  if (!state || reduced()) return;
  const sparks = app.querySelector<HTMLElement>(".nar-sparks");
  if (!sparks) return;
  const offsets = [
    [-16, -20],
    [15, -24],
    [-22, 8],
    [20, 12],
    [0, -28],
    [8, 22],
  ];
  const cells = (state.order.length > 0 ? state.order : state.sources.map((s) => s.cell)).slice(0, 18);
  for (const index of cells) {
    const row = Math.floor(index / state.size);
    const col = index % state.size;
    const left = ((col + 0.5) / state.size) * 100;
    const top = ((row + 0.5) / state.size) * 100;
    offsets.forEach(([dx, dy], k) => {
      const spark = document.createElement("span");
      spark.className = `nar-spark s${(k % 3) + 1}`;
      spark.style.left = `${left}%`;
      spark.style.top = `${top}%`;
      spark.style.setProperty("--dx", `${dx}px`);
      spark.style.setProperty("--dy", `${dy}px`);
      sparks.appendChild(spark);
    });
  }
  schedule(() => {
    sparks.innerHTML = "";
  }, 560);
}

/* ------------------------------------------------------------------- modes */

function startLevel(level: number): void {
  if (!ctx) return;
  const clamped = Math.max(1, Math.min(ARROWS_TOTAL_LEVELS, Math.floor(level)));
  state = createLevelState(clamped);
  cursor = 0;
  keyboardMode = false;
  hintFocus = null;
  transitioning = false;
  resultView = null;
  statusMessage = statusText(state);
  screen = "play";
  render();
  ctx.analytics.track(EVENTS.gameStarted, { game: "arrows", mode: "level", level: clamped });
}

function startDaily(): void {
  if (!ctx) return;
  state = createDailyState(date);
  cursor = 0;
  keyboardMode = false;
  hintFocus = null;
  transitioning = false;
  resultView = null;
  statusMessage = statusText(state);
  screen = "play";
  render();
  ctx.analytics.track(EVENTS.dailyStarted, { game: "arrows", date });
}

function startEndless(): void {
  if (!ctx) return;
  endlessRun += 1;
  endlessSeed = `arrows:endless:${Date.now()}:${endlessRun}`;
  endlessIndex = 0;
  endlessScore = 0;
  endlessCleared = 0;
  state = createEndlessState(endlessSeed, 0);
  cursor = 0;
  keyboardMode = false;
  hintFocus = null;
  transitioning = false;
  resultView = null;
  statusMessage = statusText(state);
  screen = "play";
  render();
  ctx.analytics.track(EVENTS.gameStarted, { game: "arrows", mode: "endless" });
}

function restart(): void {
  if (!state) return;
  if (state.mode === "endless") startEndless();
  else if (state.mode === "daily") startDaily();
  else startLevel(state.level);
}

/* ----------------------------------------------------------------- gameplay */

function afterSolve(next: () => void): void {
  transitioning = true;
  ctx?.audio.levelComplete();
  ctx?.haptics.success();
  spawnSparks();
  if (reduced()) next();
  else schedule(next, 420);
}

function rotate(index: number): void {
  if (!state || screen !== "play" || transitioning || state.status !== "playing") return;
  const cell = state.cells[index];
  if (!cell || (cell.kind !== "arrow" && cell.kind !== "checkpoint")) return;
  if (cell.locked) {
    ctx?.audio.invalid();
    ctx?.haptics.fail();
    setStatus("That tile is locked in place.");
    return;
  }
  const outcome = rotateCell(state, index);
  if (!outcome.changed) {
    if (outcome.reason === "limit") {
      ctx?.audio.invalid();
      setStatus("No rotations left.");
    }
    return;
  }
  state = outcome.state;
  hintFocus = null;
  cursor = index;
  if (state.status === "solved") {
    statusMessage = "All beams locked in.";
    refreshPlay();
    afterSolve(onSolved);
    return;
  }
  if (state.status === "failed") {
    statusMessage = "Out of rotations.";
    refreshPlay();
    finishFailed();
    return;
  }
  ctx?.audio.select();
  ctx?.haptics.select();
  statusMessage = statusText(state);
  refreshPlay();
}

function onSolved(): void {
  if (!state) return;
  if (state.mode === "endless") {
    const gain = boardValue(state.size, state.par, state.rotations) + (endlessIndex + 1) * 25;
    endlessScore += gain;
    endlessCleared += 1;
    transitioning = true;
    setStatus(`Board cleared! +${gain}.`);
    schedule(() => {
      if (!ctx || state?.mode !== "endless") return;
      endlessIndex += 1;
      state = createEndlessState(endlessSeed, endlessIndex);
      cursor = 0;
      hintFocus = null;
      keyboardMode = false;
      transitioning = false;
      statusMessage = statusText(state);
      render();
    }, reduced() ? 0 : 480);
    return;
  }
  finishSolved();
}

function finishSolved(): void {
  if (!state || !ctx) return;
  transitioning = false;
  const result: ArrowsResult = finalResult(state);
  const stars = result.stars;
  const score = levelScore(result.rotations, result.par, result.hints, stars);
  if (state.mode === "daily") {
    const ranked = !isDailyDone(ctx.save, date);
    if (ranked) {
      ctx.updateSave(recordDailyRun(ctx.save, result));
      ctx.report({ score, stars, solved: true, stats: { rotations: result.rotations, par: result.par, hints: result.hints } });
      ctx.analytics.track(EVENTS.dailyCompleted, { game: "arrows", stars, rotations: result.rotations });
    }
    resultView = {
      mode: "daily",
      level: 0,
      date,
      solved: true,
      score,
      rotations: result.rotations,
      par: result.par,
      hints: result.hints,
      stars,
      boards: 1,
      isBest: false,
      ranked,
      hasNext: false,
    };
  } else {
    const priorStars = levelStars(ctx.save, state.level);
    ctx.updateSave(recordLevelRun(ctx.save, result));
    ctx.report({ score, stars, solved: true, stats: { rotations: result.rotations, par: result.par, hints: result.hints } });
    ctx.analytics.track(EVENTS.gameCompleted, { game: "arrows", level: state.level, stars, rotations: result.rotations });
    resultView = {
      mode: "level",
      level: state.level,
      date,
      solved: true,
      score,
      rotations: result.rotations,
      par: result.par,
      hints: result.hints,
      stars,
      boards: 1,
      isBest: stars > priorStars,
      ranked: false,
      hasNext: state.level < ARROWS_TOTAL_LEVELS,
    };
  }
  screen = "over";
  render();
}

function finishFailed(): void {
  if (!state || !ctx) return;
  transitioning = false;
  if (state.mode === "endless") {
    const priorBest = ctx.save.best;
    ctx.updateSave(recordEndlessRun(ctx.save, endlessScore, endlessCleared));
    ctx.report({ score: endlessScore, stars: 0, solved: endlessCleared > 0, stats: { boards: endlessCleared } });
    ctx.analytics.track(endlessCleared > 0 ? EVENTS.gameCompleted : EVENTS.gameFailed, { game: "arrows", score: endlessScore, boards: endlessCleared });
    resultView = {
      mode: "endless",
      level: 0,
      date,
      solved: false,
      score: endlessScore,
      rotations: state.rotations,
      par: state.par,
      hints: state.hints,
      stars: 0,
      boards: endlessCleared,
      isBest: endlessScore > priorBest,
      ranked: false,
      hasNext: false,
    };
  } else {
    const result = finalResult(state);
    ctx.report({ score: 0, stars: 0, solved: false, stats: { rotations: result.rotations, par: result.par } });
    ctx.analytics.track(EVENTS.gameFailed, { game: "arrows", mode: state.mode, level: state.level });
    resultView = {
      mode: state.mode,
      level: state.level,
      date,
      solved: false,
      score: 0,
      rotations: result.rotations,
      par: result.par,
      hints: result.hints,
      stars: 0,
      boards: 1,
      isBest: false,
      ranked: false,
      hasNext: false,
    };
  }
  ctx.audio.invalid();
  ctx.haptics.fail();
  screen = "over";
  render();
}

function hint(): void {
  if (!state || screen !== "play" || transitioning || state.status !== "playing") return;
  const target = hintCell(state);
  if (target === null) {
    setStatus("Nothing left to correct.");
    return;
  }
  state = { ...state, hints: state.hints + 1 };
  hintFocus = target;
  cursor = target;
  ctx?.audio.select();
  ctx?.haptics.select();
  ctx?.analytics.track(EVENTS.hintUsed, { game: "arrows", level: state.level });
  setStatus("This tile still needs a turn.");
  refreshPlay();
}

function goMenu(): void {
  clearTimers();
  state = null;
  resultView = null;
  hintFocus = null;
  transitioning = false;
  statusMessage = "";
  keyboardMode = false;
  screen = "menu";
  render();
}

/* ------------------------------------------------------------------ events */

function onClick(e: MouseEvent): void {
  if (!ctx) return;
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-act],[data-level],[data-cell]");
  if (!target) return;
  const act = target.dataset.act;
  if (act) {
    ctx.audio.tap();
    if (act === "arcade") ctx.exit();
    else if (act === "help") {
      helpFrom = screen;
      screen = "help";
      render();
    } else if (act === "close-help") {
      screen = helpFrom;
      render();
    } else if (act === "level") startLevel(buildMenuView().nextLevel);
    else if (act === "endless") startEndless();
    else if (act === "daily" || act === "daily-again") startDaily();
    else if (act === "restart") restart();
    else if (act === "menu") goMenu();
    else if (act === "level-next") startLevel((state?.level ?? 0) + 1);
    else if (act === "hint") hint();
    return;
  }
  const levelAttr = target.dataset.level;
  if (levelAttr !== undefined) {
    startLevel(Number(levelAttr));
    return;
  }
  if (target.dataset.cell !== undefined && screen === "play") rotate(Number(target.dataset.cell));
}

function onKeyDown(e: KeyboardEvent): void {
  if (screen === "help") {
    if (e.key === "Escape") {
      screen = helpFrom;
      render();
    }
    return;
  }
  if (screen !== "play" || !state) return;
  if (e.key === "Escape") {
    goMenu();
    return;
  }
  if (e.key === "h" || e.key === "H") {
    hint();
    return;
  }
  const isBoard = keyboardMode || document.activeElement?.classList.contains("nar-board") === true;
  if (!isBoard) return;
  const size = state.size;
  const row = Math.floor(cursor / size);
  const col = cursor % size;
  if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    let r = row;
    let c = col;
    if (e.key === "ArrowUp") r = Math.max(0, row - 1);
    if (e.key === "ArrowDown") r = Math.min(size - 1, row + 1);
    if (e.key === "ArrowLeft") c = Math.max(0, col - 1);
    if (e.key === "ArrowRight") c = Math.min(size - 1, col + 1);
    cursor = r * size + c;
    keyboardMode = true;
    refreshPlay();
    return;
  }
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    keyboardMode = true;
    rotate(cursor);
  }
}

function handleBack(): boolean {
  if (screen === "help") {
    screen = helpFrom;
    render();
    return true;
  }
  if (screen === "play" || screen === "over") {
    goMenu();
    return true;
  }
  return false;
}

export function mountArrows(root: HTMLElement, context: GameContext<ArrowsSave>): void {
  app = root;
  ctx = context;
  date = localYmd();
  state = null;
  screen = "menu";
  helpFrom = "menu";
  cursor = 0;
  keyboardMode = false;
  hintFocus = null;
  statusMessage = "";
  resultView = null;
  transitioning = false;
  endlessScore = 0;
  endlessCleared = 0;
  endlessIndex = 0;
  endlessSeed = "";
  endlessRun = 0;
  context.audio.setMuted(context.settings.muted());
  aborter = new AbortController();
  const { signal } = aborter;
  app.addEventListener("click", onClick, { signal });
  window.addEventListener("keydown", onKeyDown, { signal });
  setBackHandler(handleBack);
  render();
}

export function unmountArrows(): void {
  aborter?.abort();
  aborter = null;
  clearTimers();
  setBackHandler(null);
  state = null;
  resultView = null;
  hintFocus = null;
  transitioning = false;
  keyboardMode = false;
  app.innerHTML = "";
}
