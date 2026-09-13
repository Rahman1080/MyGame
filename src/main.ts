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
import { calculateStars, type Puzzle } from "./engine";
import { attachBoard, cellCenter, drawBoard, hitCell, layoutBoard, startToken, type BoardView } from "./render/board";
import { colorHex } from "./render/colors";
import { ICON_FLAME, ICON_HINT, ICON_LOCK, ICON_MUTE, ICON_UNDO, ICON_UNMUTE } from "./ui/icons";
import { isLevelUnlocked, levelId, nextUnsolved, packForLevel, PACKS } from "./levels/packs";
import { difficultyRating } from "./gen/difficulty";

const app = document.querySelector<HTMLDivElement>("#app")!;
const game = createGame();
let view: BoardView | null = null;
let last = performance.now();
let boardCss = 280;
let selectedPack = packForLevel(game.level).id;

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

function homeHtml(): string {
  const level = nextUnsolved(game.save.solved, 1);
  const levelPack = packForLevel(level);
  if (!PACKS.some((p) => p.id === selectedPack)) selectedPack = levelPack.id;
  const pack = PACKS.find((p) => p.id === selectedPack) ?? PACKS[0]!;
  const packProg = packProgress(game, pack.start, pack.end);
  const contProg = packProgress(game, levelPack.start, levelPack.end);
  const total = totalStars(game);
  const s = game.save.streak;
  const dailyDone = game.save.dailyCompleted.filter(Boolean).length;

  const tabs = PACKS.map((p) => {
    const locked = p.unlockAfter > 0 && packProgress(game, 1, p.unlockAfter).solved < p.unlockAfter;
    return `<button class="pack-tab${p.id === pack.id ? " active" : ""}${locked ? " locked" : ""}" data-act="tab" data-pack="${p.id}" ${locked ? "disabled" : ""}>${p.name}</button>`;
  }).join("");

  const tiles: string[] = [];
  for (let l = pack.start; l <= pack.end; l += 1) {
    const id = levelId(l);
    const solved = !!game.save.solved[id];
    const stars = game.save.stars[id] ?? 0;
    const unlocked = isLevelUnlocked(game.save.solved, l);
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

  return `<div class="shell">
    <div class="home">
      <div class="home-top">
        <div class="wordmark">GLOWTRAIL</div>
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
      <div class="pack-tabs">${tabs}</div>
      <div class="pack-head">
        <span class="pack-head-name">${pack.name}</span>
        <span class="pack-head-stars">★ ${packProg.stars}/${packProg.max}</span>
      </div>
      <div class="level-grid">${tiles.join("")}</div>
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

function boardHtml(): string {
  const s = game.session!;
  const daily = game.mode === "daily";
  const label = daily ? `DAILY ${game.dailyIndex + 1} / 5` : `LEVEL ${game.level}`;
  const showRetry = s.phase === "failed" && game.anim.done;
  const launchLabel = showRetry ? "Retry" : "Launch";
  const fail = s.phase === "failed" && s.failReason ? failCard(s.failReason) : "";
  const par = s.puzzle.par;
  const nodes = s.puzzle.cells.filter((c) => c.required).length;
  return `<div class="shell">
    <div class="hud">
      <button class="icon-btn" data-act="undo" ${s.phase !== "idle" ? "disabled" : ""} aria-label="Undo">${ICON_UNDO}<span>Undo</span></button>
      <div class="center-meta">
        <div class="lvl">${label}<span class="diff-dots" aria-label="Difficulty">${diffDots(s.puzzle)}</span></div>
        <div class="par">MOVES <b>${s.rotations}</b> · PAR <b>${par}</b></div>
        <div class="par-sub">COLLECT ${nodes} · 3★ ≤ ${par}</div>
      </div>
      <button class="icon-btn" data-act="hint" ${s.hintUsed || s.phase !== "idle" ? "disabled" : ""} aria-label="Hint">${ICON_HINT}<span>Hint</span></button>
      <button class="icon-btn" data-act="mute" aria-label="${game.save.muted ? "Unmute" : "Mute"}">${game.save.muted ? ICON_UNMUTE : ICON_MUTE}<span>Mute</span></button>
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
    <div class="sr-only" role="status" aria-live="polite">${statusText()}</div>
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
    s?.hint ? `${s.hint.row},${s.hint.col}` : "",
    s?.failReason,
    g.save.muted,
    g.save.streak,
    selectedPack,
    Object.keys(g.save.solved).length,
  ].join(":");
}

function render(): void {
  const sig = signature(game);
  const screenChange = lastScreen !== game.screen;
  if (screenChange && game.screen === "home") {
    selectedPack = packForLevel(nextUnsolved(game.save.solved, 1)).id;
    view = null;
  }
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
  else if (act === "tab") {
    selectedPack = t.dataset.pack ?? selectedPack;
  } else if (act === "level") openBoard(game, "story", Number(t.dataset.level));
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
