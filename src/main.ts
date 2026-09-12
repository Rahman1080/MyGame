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
  type Game,
} from "./game/controller";
import { calculateStars } from "./engine";
import { attachBoard, cellCenter, drawBoard, hitCell, layoutBoard, startToken, type BoardView } from "./render/board";
import { colorHex } from "./render/colors";
import { ICON_FLAME, ICON_HINT, ICON_MUTE, ICON_UNDO, ICON_UNMUTE } from "./ui/icons";
import { PACKS } from "./levels/packs";


const app = document.querySelector<HTMLDivElement>("#app")!;
const game = createGame();
let view: BoardView | null = null;
let last = performance.now();
let boardCss = 280;

function reduced(): boolean {
  return game.reduced;
}

function homeHtml(): string {
  const s = game.save.streak;
  const packs = PACKS.map((p) => {
    const prog = packProgress(game, p.start, p.end);
    const locked = prog.solved === 0 && p.unlockAfter > 0 && packProgress(game, 1, p.unlockAfter).solved < p.unlockAfter;
    const width = Math.round((prog.stars / prog.max) * 100);
    return `<button class="pack${locked ? " locked" : ""}" data-act="pack" data-start="${p.start}" ${locked ? "disabled" : ""}>
      <span class="pack-name">${p.name}</span>
      <span class="pack-stars">${prog.stars}/${prog.max}</span>
      <span class="pack-meta">${p.start}–${p.end}${locked ? " · locked" : ""}</span>
      <div class="bar"><i style="width:${width}%"></i></div>
    </button>`;
  }).join("");
  return `<div class="shell">
    <div class="home">
      <div class="wordmark">GLOWTRAIL</div>
      <canvas class="hero-mini" width="160" height="64" aria-hidden="true"></canvas>
      <button class="cta-play" data-act="play">Play</button>
      <button class="daily-card" data-act="daily">
        <div><div class="k">Daily Run</div><div class="sub">5 puzzles · Today</div></div>
        <div class="streak-pill">${ICON_FLAME}<span class="streak-n">${s} DAY STREAK</span></div>
      </button>
      <div class="packs">${packs}</div>
    </div>
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

function boardHtml(): string {
  const s = game.session!;
  const daily = game.mode === "daily";
  const label = daily ? `${game.dailyIndex + 1} / 5` : `LEVEL ${game.level}`;
  const showRetry = s.phase === "failed" && game.anim.done;
  const launchLabel = showRetry ? "Retry" : "Launch";
  const fail = s.phase === "failed" && s.failReason
    ? `<div class="fail-tag">${s.failReason.replaceAll("_", " ")}</div>`
    : "";
  return `<div class="shell">
    <div class="hud">
      <button class="icon-btn" data-act="undo" ${s.phase !== "idle" ? "disabled" : ""}>${ICON_UNDO}<span>Undo</span></button>
      <div class="center-meta">
        <div class="lvl">${label}</div>
        <div class="par"><b>${s.rotations}</b> / ${s.puzzle.par}</div>
      </div>
      <button class="icon-btn" data-act="hint" ${s.hintUsed || s.phase !== "idle" ? "disabled" : ""}>${ICON_HINT}<span>Hint</span></button>
      <button class="icon-btn" data-act="mute">${game.save.muted ? ICON_UNMUTE : ICON_MUTE}<span>Mute</span></button>
    </div>
    <div class="board-wrap">
      <canvas id="board"></canvas>
      ${tutorialPrompt()}
    </div>
    <div class="dock">
      ${fail}
      <div class="reset-row">
        <button class="reset" data-act="home">Home</button>
        <button class="reset" data-act="reset">Reset</button>
      </div>
      <button class="launch${showRetry ? " retry" : ""}" data-act="launch">${launchLabel}</button>
    </div>
  </div>`;
}

function winHtml(): string {
  const s = game.session!;
  const stars = calculateStars(s.rotations, s.puzzle.par);
  const daily = game.mode === "daily";
  const complete = daily && game.save.dailyCompleted.every(Boolean);
  const title = complete ? "DAILY COMPLETE" : "COMPLETE";
  const extra = complete ? `<div class="win-meta">STREAK ${game.save.streak}</div>` : "";
  const next = daily ? (complete ? "Home" : "Next Daily") : "Next";
  return `<div class="shell" style="position:relative">
    ${boardHtml()}
    <div class="overlay">
      <div class="win-card">
        <h2>${title}</h2>
        <div class="stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>
        <div class="win-meta">${s.rotations} / ${s.puzzle.par}${daily ? ` · ${game.dailyIndex + 1} / 5` : ""}</div>
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
  const h = (shell?.clientHeight ?? window.innerHeight) - 160;
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
  layoutBoard(view, game.session.puzzle.size, boardCss);
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

function paint(): void {
  if (!view || !game.session) {
    paintHero();
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
  if (game.session.phase === "idle") token = startToken(view, game.session.puzzle, game.session.cells);

  drawBoard(view, {
    puzzle: game.session.puzzle,
    cells: game.session.cells,
    token: game.session.phase === "simulating" || game.session.phase === "won" || game.session.phase === "failed" ? token : startToken(view, game.session.puzzle, game.session.cells),
    lit,
    rotating: game.anim.rotating,
    winFlash: game.anim.winFlash,
    failDim: game.anim.failDim,
    ghost: ghostTarget(),
    reduced: reduced(),
    now: performance.now(),
  });
}

let lastScreen = "";
let lastSig = "";

function signature(g: Game): string {
  const s = g.session;
  return [
    g.screen,
    g.mode,
    g.level,
    g.dailyIndex,
    s?.phase,
    s?.rotations,
    s?.hintUsed,
    s?.failReason,
    g.save.muted,
    g.save.streak,
  ].join(":");
}

function render(): void {
  const sig = signature(game);
  const screenChange = lastScreen !== game.screen;
  if (sig !== lastSig) {
    lastSig = sig;
    if (game.screen === "home") app.innerHTML = homeHtml();
    else if (game.screen === "win") app.innerHTML = winHtml();
    else app.innerHTML = boardHtml();
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
  if (act === "play") openBoard(game, "story");
  else if (act === "daily") openBoard(game, "daily");
  else if (act === "pack") openBoard(game, "story", Number(t.dataset.start));
  else if (act === "undo") doUndo(game);
  else if (act === "hint") doHint(game);
  else if (act === "mute") toggleMute(game);
  else if (act === "reset") doReset(game);
  else if (act === "launch") doLaunch(game);
  else if (act === "next") nextAfterWin(game);
  else if (act === "retry-stars") retryForStars(game);
  else if (act === "home") goHome(game);
  lastSig = "";
  render();
});

window.addEventListener("keydown", (e) => {
  if (!game.session || game.screen === "home") return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    doLaunch(game);
  } else if (e.key === "Escape") {
    goHome(game);
  } else if (game.selected && ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(e.key)) {
    tapCell(game, game.selected.row, game.selected.col);
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
  const phase = game.session?.phase;
  tick(game, dt);
  if (game.session?.phase !== phase) lastSig = "";
  render();
  requestAnimationFrame(loop);
}

render();
requestAnimationFrame(loop);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
