import { localYmd } from "../../gen/daily";
import { setBackHandler } from "../../platform/router";
import { EVENTS } from "../../platform/services/telemetry";
import type { GameContext } from "../../platform/types";
import type { ArrowsSave } from "../../save/schema";
import {
  ARROWS_TOTAL_LEVELS,
  type ArrowsResult,
  type ArrowsState,
  type Dir,
  availableCount,
  boardValue,
  canUndo,
  dailyBestStars,
  dailyStreakOn,
  emptyArrowsSave,
  finalResult,
  isDailyDone,
  isLevelSolved,
  isLevelUnlocked,
  launch,
  levelScore,
  levelStars,
  perfectLevels,
  recordDailyRun,
  recordEndlessRun,
  recordLevelRun,
  undo,
} from "./logic";
import { createDailyState, createEndlessState, createLevelState, hintIndex } from "./generate";
import {
  boardHtml,
  helpHtml,
  hudHtml,
  laneCells,
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

interface FlyerRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

let app: HTMLElement;
let ctx: GameContext<ArrowsSave> | null = null;
let state: ArrowsState | null = null;
let screen: Screen = "menu";
let helpFrom: Screen = "menu";
let date = "";
let cursorArrow = 0;
let keyboardMode = false;
let hintFocus: number | null = null;
let statusMessage = "";
let resultView: ResultView | null = null;
let transitioning = false;
let endlessScore = 0;
let endlessCleared = 0;
let endlessIndex = 0;
let endlessSalt = "0";
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

function setStatus(message: string): void {
  statusMessage = message;
  const el = app.querySelector<HTMLElement>("#arrows-status");
  if (el) el.textContent = message;
}

function arrowTiles(index: number): HTMLElement[] {
  return Array.from(app.querySelectorAll<HTMLElement>(`[data-arrow="${index}"]`));
}

function flashArrow(index: number, className: string): void {
  const tiles = arrowTiles(index);
  for (const tile of tiles) tile.classList.add(className);
  schedule(() => {
    for (const tile of tiles) tile.classList.remove(className);
  }, 420);
}

function captureCellRect(cell: number): FlyerRect | null {
  const wrap = app.querySelector<HTMLElement>(".nar-board-wrap");
  const el = wrap?.querySelector<HTMLElement>(`[data-cell="${cell}"]`);
  if (!wrap || !el) return null;
  const w = wrap.getBoundingClientRect();
  const c = el.getBoundingClientRect();
  return { left: c.left - w.left, top: c.top - w.top, width: c.width, height: c.height };
}

function spawnFlyer(rect: FlyerRect, dir: Dir): void {
  if (!state) return;
  const wrap = app.querySelector<HTMLElement>(".nar-board-wrap");
  if (!wrap) return;
  const flyer = document.createElement("span");
  flyer.className = `nar-flyer d${dir}`;
  flyer.style.left = `${rect.left}px`;
  flyer.style.top = `${rect.top}px`;
  flyer.style.width = `${rect.width}px`;
  flyer.style.height = `${rect.height}px`;
  const distance = (state.size + 1) * Math.max(rect.width, rect.height) + 40;
  const dx = dir === 1 ? distance : dir === 3 ? -distance : 0;
  const dy = dir === 2 ? distance : dir === 0 ? -distance : 0;
  flyer.style.setProperty("--dx", `${dx}px`);
  flyer.style.setProperty("--dy", `${dy}px`);
  wrap.appendChild(flyer);
  schedule(() => flyer.remove(), 520);
}

function refreshPlay(): void {
  if (!state) return;
  const view: BoardView = { focus: keyboardMode ? cursorArrow : null, hint: hintFocus };
  const wrap = app.querySelector<HTMLElement>(".nar-board-wrap");
  if (wrap) wrap.innerHTML = boardHtml(state, view);
  const hud = app.querySelector<HTMLElement>(".nar-hud");
  if (hud) hud.outerHTML = hudHtml(state);
  setStatus(statusMessage);
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
    perfect: perfectLevels(current),
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
  const body = {
    board: boardHtml(state, { focus: keyboardMode ? cursorArrow : null, hint: hintFocus }),
    status: liveStatusHtml(statusMessage),
  };
  app.innerHTML = playShellHtml(state, modeLabel(state.mode, state), body, reduced());
  if (screen === "over" && resultView) {
    const shell = app.querySelector<HTMLElement>(".nar-shell");
    if (shell) shell.insertAdjacentHTML("beforeend", resultCardHtml(resultView));
  }
}

/* ------------------------------------------------------------------- modes */

function resetRunState(): void {
  cursorArrow = 0;
  keyboardMode = false;
  hintFocus = null;
  transitioning = false;
  resultView = null;
}

function startLevel(level: number): void {
  if (!ctx) return;
  const clamped = Math.max(1, Math.min(ARROWS_TOTAL_LEVELS, Math.floor(level)));
  state = createLevelState(clamped);
  resetRunState();
  statusMessage = statusText(state);
  screen = "play";
  render();
  ctx.analytics.track(EVENTS.gameStarted, { game: "arrows", mode: "level", level: clamped });
}

function startDaily(): void {
  if (!ctx) return;
  state = createDailyState(date);
  resetRunState();
  statusMessage = statusText(state);
  screen = "play";
  render();
  ctx.analytics.track(EVENTS.dailyStarted, { game: "arrows", date });
}

function startEndless(): void {
  if (!ctx) return;
  endlessSalt = `${Date.now()}`;
  endlessIndex = 0;
  endlessScore = 0;
  endlessCleared = 0;
  state = createEndlessState(0, endlessSalt);
  resetRunState();
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

/* ---------------------------------------------------------------- gameplay */

function afterSolve(next: () => void): void {
  transitioning = true;
  ctx?.audio.levelComplete();
  ctx?.haptics.success();
  if (reduced()) next();
  else schedule(next, 440);
}

function doLaunch(index: number): void {
  if (!state || screen !== "play" || transitioning || state.status !== "playing") return;
  const arrow = state.arrows[index];
  if (!arrow) return;

  const flyerRect = reduced() ? null : captureCellRect(arrow.head);
  const outcome = launch(state, index);
  if (!outcome.moved) {
    state = outcome.state;
    ctx?.audio.invalid();
    ctx?.haptics.fail();
    if (outcome.reason === "locked") {
      setStatus(`Locked — ${arrow.lock} arrows must escape first.`);
    } else if (outcome.reason === "blocked") {
      setStatus("Blocked — an arrow sits in the lane.");
    }
    const hud = app.querySelector<HTMLElement>(".nar-hud");
    if (hud) hud.outerHTML = hudHtml(state);
    flashArrow(index, "shake");
    return;
  }

  state = outcome.state;
  hintFocus = null;
  cursorArrow = index;

  if (state.status === "solved") {
    statusMessage = "Clean exit. Every arrow escaped.";
    refreshPlay();
    if (flyerRect) spawnFlyer(flyerRect, arrow.dir);
    else if (!reduced()) flashArrow(index, "just-moved");
    afterSolve(onSolved);
    return;
  }

  ctx?.audio.select();
  ctx?.haptics.select();
  statusMessage = statusText(state);
  refreshPlay();
  if (flyerRect) spawnFlyer(flyerRect, arrow.dir);
  else if (!reduced()) flashArrow(index, "just-moved");
}

function onSolved(): void {
  if (!state) return;
  if (state.mode === "endless") {
    const gain = boardValue(state.arrows.length, availableCount(state)) + (endlessIndex + 1) * 25;
    endlessScore += gain;
    endlessCleared += 1;
    transitioning = true;
    setStatus(`Board cleared! +${gain}.`);
    schedule(
      () => {
        if (!ctx || state?.mode !== "endless") return;
        endlessIndex += 1;
        state = createEndlessState(endlessIndex, endlessSalt);
        resetRunState();
        statusMessage = statusText(state);
        render();
      },
      reduced() ? 0 : 520,
    );
    return;
  }
  finishSolved();
}

function finishSolved(): void {
  if (!state || !ctx) return;
  transitioning = false;
  const result: ArrowsResult = finalResult(state);
  const stars = result.stars;
  const score = levelScore(result.launches, result.hints, stars);
  const stats = { launches: result.launches, missteps: result.missteps, hints: result.hints };
  if (state.mode === "daily") {
    const ranked = !isDailyDone(ctx.save, date);
    if (ranked) {
      ctx.updateSave(recordDailyRun(ctx.save, result));
      ctx.report({ score, stars, solved: true, stats });
      ctx.analytics.track(EVENTS.dailyCompleted, { game: "arrows", stars, launches: result.launches });
    }
    resultView = {
      mode: "daily",
      level: 0,
      date,
      solved: true,
      score,
      launches: result.launches,
      missteps: result.missteps,
      hints: result.hints,
      stars,
      arrows: result.arrows,
      boards: 1,
      isBest: false,
      ranked,
      hasNext: false,
    };
  } else {
    const priorStars = levelStars(ctx.save, state.level);
    ctx.updateSave(recordLevelRun(ctx.save, result));
    ctx.report({ score, stars, solved: true, stats });
    ctx.analytics.track(EVENTS.gameCompleted, { game: "arrows", level: state.level, stars, launches: result.launches });
    resultView = {
      mode: "level",
      level: state.level,
      date,
      solved: true,
      score,
      launches: result.launches,
      missteps: result.missteps,
      hints: result.hints,
      stars,
      arrows: result.arrows,
      boards: 1,
      isBest: stars > priorStars,
      ranked: false,
      hasNext: state.level < ARROWS_TOTAL_LEVELS,
    };
  }
  screen = "over";
  render();
}

/** Endless has no fail state, so leaving the run is what records it. */
function finishEndless(): void {
  if (!state || !ctx) return;
  transitioning = false;
  const priorBest = ctx.save.best;
  ctx.updateSave(recordEndlessRun(ctx.save, endlessScore, endlessCleared));
  ctx.report({ score: endlessScore, stars: 0, solved: endlessCleared > 0, stats: { boards: endlessCleared } });
  ctx.analytics.track(endlessCleared > 0 ? EVENTS.gameCompleted : EVENTS.gameFailed, {
    game: "arrows",
    score: endlessScore,
    boards: endlessCleared,
  });
  resultView = {
    mode: "endless",
    level: 0,
    date,
    solved: false,
    score: endlessScore,
    launches: state.launches,
    missteps: state.missteps,
    hints: state.hints,
    stars: 0,
    arrows: state.arrows.length,
    boards: endlessCleared,
    isBest: endlessScore > priorBest,
    ranked: false,
    hasNext: false,
  };
  screen = "over";
  render();
}

function hint(): void {
  if (!state || screen !== "play" || transitioning || state.status !== "playing") return;
  const target = hintIndex(state);
  if (target === null) {
    setStatus("No arrow can launch — undo a tap.");
    return;
  }
  state = { ...state, hints: state.hints + 1 };
  hintFocus = target;
  cursorArrow = target;
  ctx?.audio.select();
  ctx?.haptics.select();
  ctx?.analytics.track(EVENTS.hintUsed, { game: "arrows", level: state.level });
  setStatus("This arrow has a clear lane.");
  refreshPlay();
}

function doUndo(): void {
  if (!state || screen !== "play" || transitioning || !canUndo(state)) {
    setStatus("Nothing to undo.");
    return;
  }
  state = undo(state);
  hintFocus = null;
  ctx?.audio.tap();
  statusMessage = statusText(state);
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

/** Leaving endless play ends and records the run before showing the menu. */
function exitPlay(): void {
  if (screen === "play" && state?.mode === "endless") {
    finishEndless();
    return;
  }
  goMenu();
}

/* ------------------------------------------------------------------ events */

function arrowAt(index: number): number | null {
  if (!state) return null;
  return state.alive[index] === true ? index : null;
}

function aliveHeads(): { index: number; head: number }[] {
  if (!state) return [];
  const out: { index: number; head: number }[] = [];
  state.arrows.forEach((arrow, i) => {
    if (state!.alive[i] === true) out.push({ index: i, head: arrow.head });
  });
  return out;
}

function moveCursor(dir: Dir): void {
  if (!state) return;
  const size = state.size;
  const here = arrowAt(cursorArrow);
  const from = here !== null ? state.arrows[here]!.head : 0;
  const fr = Math.floor(from / size);
  const fc = from % size;
  let best = -1;
  let bestScore = Infinity;
  for (const entry of aliveHeads()) {
    if (entry.index === cursorArrow) continue;
    const r = Math.floor(entry.head / size);
    const c = entry.head % size;
    const dr = r - fr;
    const dc = c - fc;
    if (dir === 0 && dr >= 0) continue;
    if (dir === 2 && dr <= 0) continue;
    if (dir === 1 && dc <= 0) continue;
    if (dir === 3 && dc >= 0) continue;
    const aligned = dir === 0 || dir === 2 ? dc === 0 : dr === 0;
    const score = Math.abs(dr) + Math.abs(dc) + (aligned ? 0 : 1000);
    if (score < bestScore) {
      bestScore = score;
      best = entry.index;
    }
  }
  if (best >= 0) {
    cursorArrow = best;
    keyboardMode = true;
    refreshPlay();
  }
}

function onClick(e: MouseEvent): void {
  if (!ctx) return;
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-act],[data-level],[data-arrow]");
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
    else if (act === "undo") doUndo();
    else if (act === "menu") exitPlay();
    else if (act === "level-next") startLevel((state?.level ?? 0) + 1);
    else if (act === "hint") hint();
    return;
  }
  const levelAttr = target.dataset.level;
  if (levelAttr !== undefined) {
    startLevel(Number(levelAttr));
    return;
  }
  if (target.dataset.arrow !== undefined && screen === "play") doLaunch(Number(target.dataset.arrow));
}

function clearPress(): void {
  const wrap = app.querySelector<HTMLElement>(".nar-board-wrap");
  if (!wrap) return;
  for (const el of Array.from(wrap.querySelectorAll<HTMLElement>(".lane, .lane-block, .pressed"))) {
    el.classList.remove("lane", "lane-block", "pressed");
  }
}

function onPointerDown(e: PointerEvent): void {
  if (screen !== "play" || !state) return;
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-arrow]");
  if (!target) return;
  const index = Number(target.dataset.arrow);
  const preview = laneCells(state, index);
  const wrap = app.querySelector<HTMLElement>(".nar-board-wrap");
  if (!wrap) return;
  for (const cell of preview.cells) {
    wrap.querySelector<HTMLElement>(`[data-cell="${cell}"]`)?.classList.add("lane");
  }
  if (preview.blocked && preview.blocker >= 0) {
    wrap.querySelector<HTMLElement>(`[data-cell="${preview.blocker}"]`)?.classList.add("lane-block");
  }
  for (const tile of arrowTiles(index)) tile.classList.add("pressed");
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
    exitPlay();
    return;
  }
  if (e.key === "h" || e.key === "H") {
    hint();
    return;
  }
  if (e.key === "u" || e.key === "U") {
    doUndo();
    return;
  }
  const isBoard = keyboardMode || document.activeElement?.classList.contains("nar-board") === true;
  if (!isBoard) return;
  if (e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft") {
    e.preventDefault();
    const dir: Dir = e.key === "ArrowUp" ? 0 : e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" ? 2 : 3;
    moveCursor(dir);
    return;
  }
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    keyboardMode = true;
    doLaunch(cursorArrow);
  }
}

function handleBack(): boolean {
  if (screen === "help") {
    screen = helpFrom;
    render();
    return true;
  }
  if (screen === "play" || screen === "over") {
    exitPlay();
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
  resetRunState();
  statusMessage = "";
  endlessScore = 0;
  endlessCleared = 0;
  endlessIndex = 0;
  endlessSalt = "0";
  context.audio.setMuted(context.settings.muted());
  aborter = new AbortController();
  const { signal } = aborter;
  app.addEventListener("click", onClick, { signal });
  app.addEventListener("pointerdown", onPointerDown, { signal });
  app.addEventListener("pointerup", clearPress, { signal });
  app.addEventListener("pointercancel", clearPress, { signal });
  app.addEventListener("pointerleave", clearPress, { signal });
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
