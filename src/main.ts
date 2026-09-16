import "./styles/globals.css";
import "./styles/game.css";
import {
  createGame,
  doHint,
  doLaunch,
  doReset,
  doUndo,
  goHome,
  nextAfterWin,
  openBoard,
  packProgress,
  retryForStars,
  tapCell,
  tick,
  toggleMute,
  totalStars,
  type Game,
} from "./game/controller";
import { calculateStars, solvedPreview, type Puzzle, type SolvedPreview } from "./engine";
import { attachBoard, cellCenter, drawBoard, hitCell, layoutBoard, startToken, type BoardView } from "./render/board";
import { colorHex } from "./render/colors";
import {
  ICON_CHEVRON,
  ICON_EYE,
  ICON_FLAME,
  ICON_HINT,
  ICON_LOCK,
  ICON_MENU,
  ICON_MUTE,
  ICON_UNDO,
  ICON_UNMUTE,
} from "./ui/icons";
import { getLevel, isLevelUnlocked, levelId, nextUnsolved, packForLevel, PACKS, TOTAL_LEVELS } from "./levels/packs";
import { difficultyRating } from "./gen/difficulty";
import { synth } from "./audio/synth";
import { hapticReveal, hapticTap } from "./audio/haptics";
import { App } from "@capacitor/app";
import type { GameId } from "./arcade/types";
import { arcadeHubHtml } from "./arcade/hub";
import { SnakeController } from "./games/snake/controller";
import { BreakerController } from "./games/breaker/controller";
import { MatrixController } from "./games/matrix/controller";
import { persistSave } from "./save/storage";

const app = document.querySelector<HTMLDivElement>("#app")!;
const game = createGame();
let view: BoardView | null = null;
let last = performance.now();
let boardCss = 280;
let selectedPack = packForLevel(game.level).id;
const UNLOCK_ALL_LEVELS = false;
const REVEAL_MS = 900;

let activeGame: GameId = "glowtrail";
let arcadeView: "hub" | "game" = "hub";
const snakeController = new SnakeController();
const breakerController = new BreakerController();
const matrixController = new MatrixController();

let levelsOpen = false;
let solutionsMode = false;
let menuOpen = false;
let reveal: { preview: SolvedPreview; puzzle: Puzzle; label: string } | null = null;
let revealStart = 0;
let revealView: BoardView | null = null;

function reduced(): boolean {
  return game.reduced;
}

function diffDots(puzzle: Puzzle): string {
  const rating = difficultyRating(puzzle.difficulty);
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    .map((i) => `<i class="d${i < rating ? " on" : ""}"></i>`)
    .join("");
}

function starDots(stars: number): string {
  return [0, 1, 2].map((i) => `<i class="dot${i < stars ? " on" : ""}"></i>`).join("");
}

function homeHtml(fresh = false): string {
  const level = nextUnsolved(game.save.solved, 1);
  const levelPack = packForLevel(level);
  if (!PACKS.some((p) => p.id === selectedPack)) selectedPack = levelPack.id;
  const pack = PACKS.find((p) => p.id === selectedPack) ?? PACKS[0]!;
  const packProg = packProgress(game, pack.start, pack.end);
  const contProg = packProgress(game, levelPack.start, levelPack.end);
  const total = totalStars(game);
  const cleared = PACKS.reduce((n, p) => n + packProgress(game, p.start, p.end).solved, 0);
  const s = game.save.streak;
  const dailyDone = game.save.dailyCompleted.filter(Boolean).length;

  const tabs = PACKS.map((p) => {
    const locked = !UNLOCK_ALL_LEVELS && p.unlockAfter > 0 && packProgress(game, 1, p.unlockAfter).solved < p.unlockAfter;
    return `<button class="pack-tab${p.id === pack.id ? " active" : ""}${locked ? " locked" : ""}" data-act="tab" data-pack="${p.id}" ${locked ? "disabled" : ""}>${p.name}</button>`;
  }).join("");

  const tiles: string[] = [];
  for (let l = pack.start; l <= pack.end; l += 1) {
    const id = levelId(l);
    if (solutionsMode) {
      tiles.push(
        `<button class="lv-tile preview" data-act="preview" data-level="${l}" aria-label="Preview solved level ${l}"><span class="lv-n">${l}</span><span class="lv-eye">${ICON_EYE}</span></button>`,
      );
      continue;
    }
    const solved = !!game.save.solved[id];
    const stars = game.save.stars[id] ?? 0;
    const unlocked = UNLOCK_ALL_LEVELS || isLevelUnlocked(game.save.solved, l);
    const cls = ["lv-tile", solved ? "solved" : "", l === level ? "current" : "", unlocked ? "" : "locked"]
      .filter(Boolean)
      .join(" ");
    const body = unlocked
      ? `<span class="lv-n">${l}</span><span class="lv-dots">${starDots(stars)}</span>`
      : `<span class="lv-lock">${ICON_LOCK}</span>`;
    tiles.push(
      `<button class="${cls}" data-act="level" data-level="${l}" ${unlocked ? "" : "disabled"} aria-label="Level ${l}${solved ? `, ${stars} stars` : ""}">${body}</button>`,
    );
  }

  const panel = levelsOpen
    ? `<div class="levels-body" id="levels-body">
        <div class="mode-switch" role="tablist" aria-label="Level map mode">
          <button class="mode-opt${solutionsMode ? "" : " active"}" data-act="mode-play" role="tab" aria-selected="${!solutionsMode}">Play</button>
          <button class="mode-opt${solutionsMode ? " active" : ""}" data-act="mode-solutions" role="tab" aria-selected="${solutionsMode}">${ICON_EYE}<span>Solutions</span></button>
        </div>
        <div class="pack-tabs">${tabs}</div>
        <div class="pack-head">
          <span class="pack-head-name">${pack.name}</span>
          <span class="pack-head-stars">★ ${packProg.stars}/${packProg.max}</span>
        </div>
        <div class="level-grid">${tiles.join("")}</div>
      </div>`
    : "";

  return `<div class="shell${fresh ? " enter" : ""}">
    <div class="home">
      <div class="home-top">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="icon-btn sm" data-act="arcade-hub" aria-label="Arcade Hub" style="padding: 4px 8px; font-family: Orbitron, sans-serif; font-size: 11px; letter-spacing: 0.05em; color: var(--cyan); border-color: rgba(41,221,244,0.4);">◀ HUB</button>
          <div class="wordmark" style="margin-top: 0;">GLOWTRAIL</div>
        </div>
        <button class="icon-btn sm" data-act="mute" aria-label="${game.save.muted ? "Unmute" : "Mute"}">${game.save.muted ? ICON_UNMUTE : ICON_MUTE}</button>
      </div>
      <div class="home-stats">
        <span class="stat"><span class="stat-star">★</span>${total} STARS</span>
        <span class="stat amber">${ICON_FLAME}${s} DAY STREAK</span>
      </div>
      <canvas class="hero-mini" width="160" height="64" aria-hidden="true"></canvas>
      <button class="continue-card" data-act="play">
        <span class="continue-text">
          <span class="k">CONTINUE</span>
          <span class="lvl-big">LEVEL ${level}</span>
          <span class="sub">${levelPack.name} · ${contProg.solved}/${levelPack.end - levelPack.start + 1} cleared</span>
        </span>
        <span class="continue-arrow" aria-hidden="true">›</span>
      </button>
      <button class="daily-card" data-act="daily">
        <div><div class="k">Daily Run</div><div class="sub">${dailyDone >= 5 ? "Complete today" : `${dailyDone}/5 · Today`}</div></div>
        <div class="streak-pill">${ICON_FLAME}<span class="streak-n">${s} DAY</span></div>
      </button>
      <button class="zen-card" data-act="zen">
        <div>
          <div class="k" style="font-family: Orbitron, sans-serif; font-weight: 700; color: #29DDF4; font-size: 12px; letter-spacing: 0.08em;">ENDLESS ZEN</div>
          <div class="sub" style="font-size: 11.5px; color: var(--sub);">Infinite procedural path puzzles</div>
        </div>
        <span class="continue-arrow" aria-hidden="true" style="color: #29DDF4;">›</span>
      </button>
      <button class="levels-toggle${levelsOpen ? " open" : ""}" data-act="toggle-levels" aria-expanded="${levelsOpen}" aria-controls="levels-body">
        <span class="levels-title">LEVELS</span>
        <span class="levels-sum">${cleared}/${TOTAL_LEVELS} · ★${total}</span>
        <span class="levels-chevron" aria-hidden="true">${ICON_CHEVRON}</span>
      </button>
      ${panel}
    </div>
    ${revealModalHtml()}
  </div>`;
}

function tutorialPrompt(): string {
  if (game.save.tutorialDone || game.mode !== "story") return "";
  const p = game.session?.puzzle;
  if (!p?.tutorialStep) return "";
  if (p.tutorialStep === 1) return `<div class="prompt">Tap an arrow</div>`;
  if (p.tutorialStep === 2) return `<div class="prompt">Rotate the path</div>`;
  if (p.tutorialStep === 3 && game.session && game.session.rotations >= p.par) {
    return `<div class="prompt">Press Launch</div>`;
  }
  if (p.tutorialStep === 3) return `<div class="prompt">Rotate, then Launch</div>`;
  return "";
}

function ghostTarget(): { row: number; col: number } | null {
  if (game.save.tutorialDone || game.mode !== "story" || !game.session) return null;
  const p = game.session.puzzle;
  if (p.tutorialStep !== 1 && p.tutorialStep !== 2) return null;
  const cell = game.session.cells.find(
    (c) => !c.locked && c.canonicalDir !== undefined && c.direction !== c.canonicalDir,
  );
  return cell ? { row: cell.row, col: cell.col } : null;
}

const FAIL_COPY: Record<string, [string, string]> = {
  DEAD_END: ["Dead end", "An arrow points off the trail."],
  OFF_GRID: ["Off the grid", "An arrow points outside the board."],
  LOOP: ["Loop", "The trail crosses itself."],
  EXIT_TOO_SOON: ["Too soon", "Collect every node before OUT."],
  MISSED_NODE: ["Missed a node", "Collect every node before OUT."],
  WRONG_COLOR: ["Wrong color", "Reach the gate that sets the OUT color."],
};

function failCard(reason: string): string {
  const [title, msg] = FAIL_COPY[reason] ?? ["Failed", "That route does not reach the portal."];
  return `<div class="fail-card"><b>${title}</b><span>${msg}</span></div>`;
}

function statusText(): string {
  const s = game.session;
  if (!s) return "";
  if (s.phase === "won") return "Level complete";
  if (s.phase === "failed" && s.failReason) return FAIL_COPY[s.failReason]?.[0] ?? "Failed";
  return "";
}

function revealModalHtml(): string {
  if (!reveal) return "";
  const tag = reveal.preview.exact ? "MINIMUM" : "TARGET";
  return `<div class="modal-scrim" data-act="reveal-close">
    <div class="reveal-card" role="dialog" aria-modal="true" aria-label="Solved route" data-act="reveal-hold">
      <div class="reveal-head"><span class="reveal-label">${reveal.label}</span><span class="reveal-tag">${tag}</span></div>
      <canvas id="reveal-canvas" aria-hidden="true"></canvas>
      <p class="reveal-copy">Solved route — now solve it yourself.</p>
      <button class="cta-play compact" data-act="reveal-close">Got it</button>
    </div>
  </div>`;
}

function boardMenuHtml(): string {
  if (!menuOpen) return "";
  return `<div class="sheet-scrim" data-act="menu-close">
    <div class="sheet" role="menu" aria-label="Level menu" data-act="menu-hold">
      <button class="sheet-item" role="menuitem" data-act="home">Home</button>
      <button class="sheet-item" role="menuitem" data-act="reset">Reset board</button>
      <button class="sheet-item accent" role="menuitem" data-act="reveal">Reveal solution</button>
    </div>
  </div>`;
}

function openReveal(puzzle: Puzzle, label: string): void {
  const preview = solvedPreview(puzzle);
  if (!preview) return;
  reveal = { preview, puzzle, label };
  revealStart = performance.now();
  revealView = null;
  menuOpen = false;
  synth.reveal();
  hapticReveal();
  lastSig = "";
}

function closeReveal(): void {
  if (!reveal) return;
  reveal = null;
  revealStart = 0;
  revealView = null;
  lastSig = "";
}

function boardHtml(fresh = false): string {
  const s = game.session!;
  const daily = game.mode === "daily";
  const zen = game.mode === "zen";
  const label = zen ? "ENDLESS ZEN" : daily ? `DAILY ${game.dailyIndex + 1} / 5` : `LEVEL ${game.level}`;
  const showRetry = s.phase === "failed" && game.anim.done;
  const launchLabel = showRetry ? "Retry" : "Launch";
  const fail = s.phase === "failed" && s.failReason ? failCard(s.failReason) : "";
  const hintDisabled = s.phase !== "idle" || (s.hintUsed && s.strongHintUsed);
  const hintLabel = s.hintUsed && !s.strongHintUsed ? "More" : "Hint";
  const par = s.puzzle.par;
  const nodes = s.puzzle.cells.filter((c) => c.required).length;
  return `<div class="shell${fresh ? " enter" : ""}">
    <div class="hud">
      <button class="icon-btn" data-act="undo" ${s.phase !== "idle" ? "disabled" : ""} aria-label="Undo">${ICON_UNDO}<span>Undo</span></button>
      <div class="center-meta">
        <div class="lvl">${label}<span class="diff-dots" aria-label="Difficulty">${diffDots(s.puzzle)}</span></div>
        <div class="par">MOVES <b>${s.rotations}</b> · PAR <b>${par}</b></div>
        <div class="par-sub">COLLECT ${nodes} · 3★ ≤ ${par}</div>
      </div>
      <button class="icon-btn" data-act="hint" ${hintDisabled ? "disabled" : ""} aria-label="${hintLabel}">${ICON_HINT}<span>${hintLabel}</span></button>
      <button class="icon-btn" data-act="mute" aria-label="${game.save.muted ? "Unmute" : "Mute"}">${game.save.muted ? ICON_UNMUTE : ICON_MUTE}<span>Mute</span></button>
    </div>
    <div class="board-wrap">
      <canvas id="board"></canvas>
      ${tutorialPrompt()}
    </div>
    ${s.hint ? `<div class="hint-banner" role="status">${s.hint.message}</div>` : ""}
    <div class="dock">
      ${fail}
      <div class="reset-row">
        <button class="reset menu-btn" data-act="menu" aria-label="Open level menu">${ICON_MENU}<span>Menu</span></button>
      </div>
      <button class="launch${showRetry ? " retry" : ""}" data-act="launch">${launchLabel}</button>
    </div>
    <div class="sr-only" role="status" aria-live="polite">${statusText()}</div>
    ${boardMenuHtml()}
    ${revealModalHtml()}
  </div>`;
}

function winHtml(fresh = false): string {
  const s = game.session!;
  const stars = calculateStars(s.rotations, s.puzzle.par);
  const daily = game.mode === "daily";
  const zen = game.mode === "zen";
  const complete = daily && game.save.dailyCompleted.every(Boolean);
  const title = complete ? "DAILY COMPLETE" : zen ? "ZEN COMPLETE" : "COMPLETE";
  const extra = complete ? `<div class="win-meta">STREAK ${game.save.streak}</div>` : "";
  const next = zen ? "Next Puzzle" : daily ? (complete ? "Home" : "Next Daily") : "Next";
  return `<div class="shell" style="position:relative">
    ${boardHtml(fresh)}
    <div class="overlay">
      <div class="win-card">
        <h2>${title}</h2>
        <div class="stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>
        <div class="win-meta">${s.rotations} / ${s.puzzle.par} target${daily ? ` · ${game.dailyIndex + 1} / 5` : ""}</div>
        ${extra}
        <div class="win-actions">
          <button class="cta-play" data-act="next">${next}</button>
          <button class="ghost-btn" data-act="retry-stars">Retry for better stars</button>
        </div>
      </div>
    </div>
  </div>`;
}

function sizeBoard(): number {
  const shell = app.querySelector(".shell") as HTMLElement | null;
  const w = shell?.clientWidth ?? Math.min(window.innerWidth, 430);
  const h = (shell?.clientHeight ?? window.innerHeight) - 168;
  return Math.max(220, Math.min(w - 8, h, 420));
}

function bindBoard(): void {
  const canvas = app.querySelector<HTMLCanvasElement>("#board");
  if (!canvas || !game.session) {
    view = null;
    return;
  }
  boardCss = sizeBoard();
  view = attachBoard(canvas, boardCss);
  const grid = game.session.puzzle.size;
  layoutBoard(view, grid, boardCss);
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    `Path puzzle, ${grid} by ${grid}. Rotate arrows to guide the orb from IN to OUT through every node.`,
  );
  canvas.addEventListener("pointerdown", (e) => {
    if (!view || !game.session) return;
    e.preventDefault();
    const hit = hitCell(view, e.clientX, e.clientY);
    if (hit) tapCell(game, hit.row, hit.col);
    paint();
  });
}

function paintHero(): void {
  const c = app.querySelector<HTMLCanvasElement>(".hero-mini");
  if (!c) return;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const t = performance.now() / 800;
  ctx.clearRect(0, 0, 160, 64);
  ctx.strokeStyle = "#29DDF4";
  ctx.shadowColor = "#29DDF4";
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(18, 32);
  ctx.lineTo(70, 32);
  ctx.lineTo(70, 18 + Math.sin(t) * 4);
  ctx.lineTo(142, 18 + Math.sin(t) * 4);
  ctx.stroke();
}

let lastSweepAt = 0;

function paintReveal(): void {
  if (!reveal) return;
  const canvas = app.querySelector<HTMLCanvasElement>("#reveal-canvas");
  if (!canvas) return;
  const css = Math.max(200, Math.min(320, Math.floor(window.innerWidth * 0.72)));
  if (!revealView || revealView.canvas !== canvas) revealView = attachBoard(canvas, css);
  layoutBoard(revealView, reveal.puzzle.size, css);
  const path = reveal.preview.path;
  const lit = new Set(path.map((p) => `${p.row},${p.col}`));
  const now = performance.now();
  const progress = reduced() ? 1 : Math.max(0, Math.min(1, (now - revealStart) / REVEAL_MS));
  if (progress < 1 && now - lastSweepAt > 110) {
    lastSweepAt = now;
    synth.sweep();
  }
  drawBoard(revealView, {
    puzzle: reveal.puzzle,
    cells: reveal.preview.cells,
    token: null,
    lit,
    winFlash: 0,
    failDim: 0,
    route: path,
    routeProgress: progress,
    selected: null,
    reduced: reduced(),
    now,
  });
}

function paint(): void {
  if (!view || !game.session) {
    if (game.screen === "home") paintHero();
    paintReveal();
    return;
  }
  layoutBoard(view, game.session.puzzle.size, boardCss);
  const lit = new Set<string>();
  const steps = game.anim.steps;
  const max = game.anim.done ? steps.length : game.anim.index + 1;
  for (let i = 0; i < max; i += 1) {
    const s = steps[i];
    if (s) lit.add(`${s.row},${s.col}`);
  }
  let token = startToken(view, game.session.puzzle, game.session.cells);
  if (steps.length && !game.anim.done) {
    const a = steps[game.anim.index] ?? steps[0]!;
    const b = steps[game.anim.index + 1] ?? a;
    const u = Math.min(1, game.anim.t / game.anim.duration);
    const ca = cellCenter(view, a.row, a.col);
    const cb = cellCenter(view, b.row, b.col);
    token = {
      x: ca.x + (cb.x - ca.x) * u,
      y: ca.y + (cb.y - ca.y) * u,
      color: colorHex(b.color),
    };
  } else if (game.anim.done && steps.length) {
    const lastStep = steps[steps.length - 1]!;
    const c = cellCenter(view, lastStep.row, lastStep.col);
    token = { ...c, color: colorHex(lastStep.color) };
  }
  const idle = game.session.phase === "idle";
  if (idle) token = startToken(view, game.session.puzzle, game.session.cells);

  drawBoard(view, {
    puzzle: game.session.puzzle,
    cells: game.session.cells,
    token: idle ? startToken(view, game.session.puzzle, game.session.cells) : token,
    lit,
    rotating: game.anim.rotating,
    winFlash: game.anim.winFlash,
    failDim: game.anim.failDim,
    ghost: ghostTarget(),
    hint: idle ? game.session.hint : null,
    selected: idle ? game.selected : null,
    reduced: reduced(),
    now: performance.now(),
  });
  paintReveal();
}

let lastScreen = "";
let lastSig = "";

function returnToHub(): void {
  synth.tap();
  if (activeGame === "snake") snakeController.destroy();
  if (activeGame === "breaker") breakerController.destroy();
  if (activeGame === "matrix") matrixController.destroy();
  arcadeView = "hub";
  lastSig = "";
  render();
}

function launchArcadeGame(id: GameId): void {
  activeGame = id;
  arcadeView = "game";
  lastSig = "";
  if (id === "glowtrail") {
    render();
  } else if (id === "snake") {
    snakeController.mount(app, returnToHub, game.save, (s) => {
      game.save = s;
      persistSave(s);
    });
  } else if (id === "breaker") {
    breakerController.mount(app, returnToHub, game.save, (s) => {
      game.save = s;
      persistSave(s);
    });
  } else if (id === "matrix") {
    matrixController.mount(app, returnToHub, game.save, (s) => {
      game.save = s;
      persistSave(s);
    });
  }
}

function signature(g: Game): string {
  const s = g.session;
  return [
    arcadeView,
    activeGame,
    g.screen,
    g.mode,
    g.level,
    g.dailyIndex,
    s?.phase,
    s?.rotations,
    s?.hintUsed,
    s?.strongHintUsed,
    s?.hint ? `${s.hint.row},${s.hint.col},${s.hint.message}` : "",
    s?.failReason,
    g.save.muted,
    g.save.streak,
    selectedPack,
    levelsOpen ? 1 : 0,
    solutionsMode ? 1 : 0,
    menuOpen ? 1 : 0,
    reveal ? `${reveal.puzzle.id}:${reveal.label}` : "",
    Object.keys(g.save.solved).length,
  ].join(":");
}

function render(): void {
  if (arcadeView === "hub") {
    app.innerHTML = arcadeHubHtml(game.save, totalStars(game));
    return;
  }
  if (activeGame !== "glowtrail") return;

  const sig = signature(game);
  const screenChange = lastScreen !== game.screen;
  if (screenChange && game.screen === "home") {
    selectedPack = packForLevel(nextUnsolved(game.save.solved, 1)).id;
    view = null;
    levelsOpen = false;
    solutionsMode = false;
    menuOpen = false;
  }
  if (screenChange && game.screen === "board") menuOpen = false;
  if (sig !== lastSig) {
    lastSig = sig;
    if (game.screen === "home") app.innerHTML = homeHtml(screenChange);
    else if (game.screen === "win") app.innerHTML = winHtml(screenChange);
    else app.innerHTML = boardHtml(screenChange);
    lastScreen = game.screen;
    if (game.screen !== "home") bindBoard();
  } else if (screenChange) {
    lastScreen = game.screen;
  }
  paint();
}

app.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
  if (!t) return;
  const act = t.dataset.act;
  if (act === "menu-hold" || act === "reveal-hold") return;

  if (act === "launch-game") {
    const targetGame = (t.dataset.game as GameId) || "glowtrail";
    synth.tap();
    hapticTap();
    launchArcadeGame(targetGame);
    return;
  }
  if (act === "arcade-hub") {
    returnToHub();
    return;
  }
  if (act === "zen") {
    reveal = null;
    menuOpen = false;
    synth.tap();
    openBoard(game, "zen");
    lastSig = "";
    render();
    return;
  }

  if (act === "play") {
    reveal = null;
    menuOpen = false;
    synth.tap();
    openBoard(game, "story");
  } else if (act === "daily") {
    reveal = null;
    menuOpen = false;
    synth.tap();
    openBoard(game, "daily");
  } else if (act === "tab") {
    synth.tap();
    hapticTap();
    selectedPack = t.dataset.pack ?? selectedPack;
  } else if (act === "toggle-levels") {
    synth.tap();
    hapticTap();
    levelsOpen = !levelsOpen;
  } else if (act === "mode-play") {
    synth.tap();
    hapticTap();
    solutionsMode = false;
  } else if (act === "mode-solutions") {
    synth.tap();
    hapticTap();
    solutionsMode = true;
  } else if (act === "level") {
    synth.tap();
    openBoard(game, "story", Number(t.dataset.level));
  } else if (act === "preview") {
    hapticTap();
    const lv = Number(t.dataset.level);
    openReveal(getLevel(lv), `LEVEL ${lv}`);
  } else if (act === "menu") {
    synth.tap();
    hapticTap();
    menuOpen = true;
  } else if (act === "menu-close") {
    menuOpen = false;
  } else if (act === "reveal") {
    const p = game.session?.puzzle;
    if (p) openReveal(p, game.mode === "daily" ? `DAILY ${game.dailyIndex + 1}` : `LEVEL ${game.level}`);
  } else if (act === "reveal-close") {
    closeReveal();
  } else if (act === "undo") doUndo(game);
  else if (act === "hint") doHint(game);
  else if (act === "mute") {
    synth.tap();
    toggleMute(game);
  } else if (act === "reset") {
    menuOpen = false;
    doReset(game);
  } else if (act === "launch") doLaunch(game);
  else if (act === "next") nextAfterWin(game);
  else if (act === "retry-stars") retryForStars(game);
  else if (act === "home") {
    reveal = null;
    menuOpen = false;
    goHome(game);
  }
  lastSig = "";
  render();
});

function moveCursor(game: Game, dr: number, dc: number): void {
  if (!game.session) return;
  const size = game.session.puzzle.size;
  const cur = game.selected ?? { row: game.session.puzzle.start.row, col: game.session.puzzle.start.col };
  game.selected = {
    row: Math.max(0, Math.min(size - 1, cur.row + dr)),
    col: Math.max(0, Math.min(size - 1, cur.col + dc)),
  };
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (reveal) {
      closeReveal();
      render();
      return;
    }
    if (menuOpen) {
      menuOpen = false;
      lastSig = "";
      render();
      return;
    }
    if (arcadeView === "game") {
      if (activeGame !== "glowtrail") {
        returnToHub();
        return;
      }
      if (game.screen !== "home") {
        goHome(game);
        lastSig = "";
        render();
        return;
      }
      returnToHub();
      return;
    }
  }
  if (arcadeView !== "game" || activeGame !== "glowtrail") return;
  if (!game.session || game.screen === "home") return;
  if (e.key === "Enter") {
    e.preventDefault();
    doLaunch(game);
  } else if (e.key === "Escape") {
    goHome(game);
  } else if (e.key === " " || e.key.toLowerCase() === "r") {
    e.preventDefault();
    if (game.selected) tapCell(game, game.selected.row, game.selected.col);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    moveCursor(game, -1, 0);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    moveCursor(game, 1, 0);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    moveCursor(game, 0, -1);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    moveCursor(game, 0, 1);
  } else {
    return;
  }
  lastSig = "";
  render();
});

window.addEventListener("resize", () => {
  lastSig = "";
  render();
});

function loop(now: number): void {
  const dt = Math.min(48, now - last);
  last = now;
  if (arcadeView === "game" && activeGame === "glowtrail") {
    const phase = game.session?.phase;
    tick(game, dt);
    if (game.session?.phase !== phase) lastSig = "";
    render();
  }
  requestAnimationFrame(loop);
}

render();
requestAnimationFrame(loop);

const nativeShell =
  typeof window !== "undefined" &&
  ("Capacitor" in window || (window as unknown as { capacitor?: unknown }).capacitor !== undefined);
if (!nativeShell && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

if (nativeShell) {
  void App.addListener("backButton", () => {
    if (reveal) {
      closeReveal();
      render();
      return;
    }
    if (menuOpen) {
      menuOpen = false;
      lastSig = "";
      render();
      return;
    }
    if (arcadeView === "game") {
      if (activeGame !== "glowtrail") {
        returnToHub();
        return;
      }
      if (game.screen !== "home") {
        goHome(game);
        lastSig = "";
        render();
        return;
      }
      returnToHub();
      return;
    }
    void App.exitApp();
  });
}
