# NEON ARROWS — ARROW ESCAPE v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen NEON ARROWS into a large-board ordering puzzle where a tap launches an arrow off the board only when its whole lane to the edge is clear, with length 2-3 arrows, locks, color tiers, dense packing, and a 100-level campaign up to 9x9.

**Architecture:** Rewrite the arrow domain in `src/games/arrows/logic.ts` around a monotone "which arrows remain" state (arrows never move; they only leave). Generation plants arrows in reverse escape order so the forward index order always clears, then verifies with a linear greedy solver and rejects candidates outside a per-level difficulty band. Render/UI consume the new state and add tier tint, length styling, lane rays and missteps.

**Tech Stack:** Vite, vanilla TypeScript, Vitest (`environment: "node"` for logic/render tests), Playwright for manual QA, plain CSS in `src/styles/game.css`.

## Global Constraints

- Do NOT delete files. Rewrite files in place; repurpose `tests/arrows.trap.test.ts` rather than removing it.
- Logic and render modules must never call `Math.random()`, `Date.now()`, `localStorage`, or touch the DOM. Only `ui.ts` may hold mutable module state or use `Date.now()` (endless salt).
- `tsconfig.json` includes `["src", "tests"]`; strict flags include `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. Use `!` for index access proven safe and remove unused imports.
- Vitest `environment: "node"` — no jsdom. Tests are pure string/object assertions.
- Do not use emoji in code, CSS or UI copy. Stars use the existing `★`/`☆` characters.
- Game id stays `"arrows"`; tagline stays `"Arrow Escape"`; registry ids order unchanged: `["glowtrail", "fusion", "prism", "glyph", "blocks", "arrows"]`.
- Save key stays `"glowtrail:v1"` / `SAVE_VERSION = 1` / `SaveV2`; the arrows slice gains fields, the top-level save version does NOT change.
- No fail state: a valid board is always solvable and can never dead-end. `ArrowsStatus` is `"playing" | "solved"` only.
- Reduced-motion must be honored; board size 9x9 must fit a 390px viewport.
- Every task ends with: run its test file(s), then `npx tsc --noEmit`, then commit.
- One logical feature per commit; do not start NEON SORT / MERGE / SEARCH.

---

## File Structure

- `src/games/arrows/logic.ts` — rewrite: arrow model, geometry, queries, actions, scoring, saves. Pure, no DOM.
- `src/games/arrows/generate.ts` — rewrite: reverse placement, greedy solver, difficulty bands, level/endless/daily configs, `create*State`, `hintIndex`.
- `src/games/arrows/render.ts` — rewrite: `nar-` HTML builders for board/HUD/menu/result/help.
- `src/games/arrows/ui.ts` — rewrite controller for the new state model.
- `src/games/arrows/index.ts` — unchanged.
- `src/save/schema.ts` — add `ArrowsSave.version`, `ArrowsSave.perfect`, `ARROWS_SAVE_VERSION`, version-gated sanitize.
- `src/styles/game.css` — extend the existing `nar-` block (tiers, lengths, missteps, records).
- `tests/arrows.test.ts` — rewrite for the new logic.
- `tests/arrows.generation.sweep.test.ts` — rewrite for 100 levels + endless + daily + perf.
- `tests/arrows.render.test.ts` — rewrite for the new render.
- `tests/arrows.trap.test.ts` — repurpose: assert generated boards never dead-end and the greedy order always clears.
- `tests/saveV2.test.ts` — add an arrows version-reset assertion.

---

### Task 1: Rewrite the arrow domain (logic.ts)

**Files:**
- Modify: `src/games/arrows/logic.ts` (full rewrite of file contents)
- Test: `tests/arrows.test.ts` (full rewrite)

**Interfaces:**
- Consumes: `previousYmd` from `src/gen/daily.ts`; `ArrowsDailyRecord`, `ArrowsSave`, `LevelRecord`, `ARROWS_SAVE_VERSION` from `src/save/schema.ts` (added in Task 2 — define the constant there first, or temporarily import nothing and hardcode in Task 1 then switch. To avoid ordering problems, **Task 2 runs first** before this task. This task assumes `ARROWS_SAVE_VERSION` exists).
- Produces (used by Tasks 3-5):
  - Constants: `ARROWS_TOTAL_LEVELS = 100`, `ARROWS_MIN_SIZE = 4`, `ARROWS_MAX_SIZE = 9`, `ARROWS_MAX_LENGTH = 3`, `ARROWS_SCORE_PER_STAR = 200`.
  - Types: `Dir`, `ArrowsMode`, `ArrowsStatus` (`"playing" | "solved"`), `ArrowTile` (`{ id, dir, head, length, lock }`), `ArrowsBoard`, `ArrowsSnapshot` (`{ alive, escaped, launches, missteps }`), `ArrowsState`, `ArrowsResult`, `LaunchOutcome`, `LaneInfo`.
  - Geometry: `oppositeDir`, `dirName`, `rowOf`, `colOf`, `cellAt`, `stepCell`, `bodyCells`, `lanePath`.
  - Queries: `isEscaped`, `isLocked`, `occupiedCells`, `laneBlocked`, `laneInfo`, `canLaunch`, `readyIndices`, `availableIndices`, `availableCount`, `remainingArrows`, `isSolved`, `isStuck`.
  - Actions: `snapshot`, `launch`, `canUndo`, `undo`.
  - Scoring: `starsForRun(hints, missteps)`, `levelScore(launches, hints, stars)`, `boardValue(arrows, ready)`, `finalResult`.
  - Saves: `emptyArrowsSave`, `levelKey`, `levelRecord`, `levelStars`, `isLevelSolved`, `isLevelUnlocked`, `levelsWon`, `perfectLevels`, `isDailyDone`, `dailyRecordFor`, `dailyBestStars`, `dailyStreakOn`, `recordLevelRun`, `recordDailyRun`, `recordEndlessRun`.

- [ ] **Step 1: Write the failing test**

Create `tests/arrows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  type ArrowTile,
  type ArrowsBoard,
  type ArrowsState,
  availableIndices,
  bodyCells,
  canLaunch,
  emptyArrowsSave,
  finalResult,
  isLocked,
  isSolved,
  isStuck,
  laneInfo,
  lanePath,
  launch,
  levelScore,
  levelStars,
  levelsWon,
  perfectLevels,
  recordLevelRun,
  remainingArrows,
  starsForRun,
  undo,
} from "../src/games/arrows/logic";
import { ARROWS_SAVE_VERSION } from "../src/save/schema";

const tile = (over: Partial<ArrowTile> & Pick<ArrowTile, "dir" | "head">): ArrowTile => ({
  id: 0,
  length: 1,
  lock: 0,
  ...over,
});

function board(size: number, arrows: ArrowTile[]): ArrowsBoard {
  return { size, arrows: arrows.map((arrow, id) => ({ ...arrow, id })), seed: "test" };
}

function stateFor(source: ArrowsBoard): ArrowsState {
  return {
    mode: "level",
    level: 1,
    boardIndex: 0,
    size: source.size,
    arrows: source.arrows,
    alive: source.arrows.map(() => true),
    escaped: 0,
    launches: 0,
    missteps: 0,
    hints: 0,
    seed: source.seed,
    date: "",
    status: "playing",
    history: [],
  };
}

describe("arrow geometry", () => {
  it("builds body cells head-first, extending backwards", () => {
    expect(bodyCells(4, 0, 8, 1)).toEqual([8]);
    expect(bodyCells(4, 1, 4, 2)).toEqual([4, 3]);
    expect(bodyCells(4, 2, 0, 3)).toEqual([0, 4, 8]);
  });

  it("walks the lane to the edge", () => {
    expect(lanePath(4, 1, 4)).toEqual([5, 6, 7]);
    expect(lanePath(4, 0, 0)).toEqual([]);
    expect(lanePath(4, 2, 1)).toEqual([5, 9, 13]);
  });
});

describe("arrow queries", () => {
  it("reads the lane and finds the blocker", () => {
    const state = stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 2, head: 6 })]));
    expect(laneInfo(state, 0)).toEqual({ cells: [5, 6], blocked: true, blocker: 6 });
    expect(canLaunch(state, 0)).toBe(false);
    expect(canLaunch(state, 1)).toBe(true);
  });

  it("reports a clear lane to the edge", () => {
    const state = stateFor(board(4, [tile({ dir: 1, head: 4 })]));
    expect(laneInfo(state, 0)).toEqual({ cells: [5, 6, 7], blocked: false, blocker: -1 });
    expect(canLaunch(state, 0)).toBe(true);
  });

  it("counts a long arrow body as a blocker", () => {
    const state = stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 2, head: 10, length: 2 })]));
    expect(laneInfo(state, 0).blocked).toBe(true);
    expect(laneInfo(state, 0).blocker).toBe(6);
  });

  it("gates an arrow behind its lock", () => {
    const state = stateFor(board(4, [tile({ dir: 1, head: 0 }), tile({ dir: 1, head: 4, lock: 2 })]));
    expect(isLocked(state, 1)).toBe(true);
    expect(canLaunch(state, 1)).toBe(false);
    const after = launch(state, 0).state;
    expect(isLocked(after, 1)).toBe(true);
    const second = launch(after, launch(after, 0).state.arrows.length ? 0 : 0);
    void second;
  });

  it("lists ready arrows", () => {
    const state = stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 2, head: 6 })]));
    expect(availableIndices(state)).toEqual([1]);
  });

  it("is stuck only when arrows remain and none can launch", () => {
    const state = stateFor(board(2, [tile({ dir: 1, head: 0 }), tile({ dir: 3, head: 1 })]));
    expect(isStuck(state)).toBe(false);
    expect(isSolved(state)).toBe(false);
  });
});

describe("arrow launch", () => {
  it("escapes an arrow with a clear lane", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 })]));
    const outcome = launch(start, 0);
    expect(outcome.moved).toBe(true);
    expect(outcome.state.alive[0]).toBe(false);
    expect(outcome.state.escaped).toBe(1);
    expect(outcome.state.launches).toBe(1);
    expect(outcome.state.status).toBe("solved");
    expect(remainingArrows(outcome.state)).toBe(0);
  });

  it("rejects a blocked launch and records a misstep", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 2, head: 6 })]));
    const outcome = launch(start, 0);
    expect(outcome.moved).toBe(false);
    expect(outcome.reason).toBe("blocked");
    expect(outcome.misstep).toBe(true);
    expect(outcome.state.missteps).toBe(1);
    expect(outcome.state.launches).toBe(0);
    expect(outcome.state.alive[0]).toBe(true);
  });

  it("rejects a locked launch and records a misstep", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 0 }), tile({ dir: 1, head: 4, lock: 2 })]));
    const outcome = launch(start, 1);
    expect(outcome.moved).toBe(false);
    expect(outcome.reason).toBe("locked");
    expect(outcome.state.missteps).toBe(1);
  });

  it("ignores launches after solving", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 })]));
    const solved = launch(start, 0).state;
    const outcome = launch(solved, 0);
    expect(outcome.moved).toBe(false);
    expect(outcome.reason).toBe("done");
    expect(outcome.state.missteps).toBe(0);
  });

  it("undo restores the previous pose", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 })]));
    const after = launch(start, 0).state;
    const back = undo(after);
    expect(back.alive[0]).toBe(true);
    expect(back.escaped).toBe(0);
    expect(back.status).toBe("playing");
  });
});

describe("arrow scoring", () => {
  it("awards stars for clean runs", () => {
    expect(starsForRun(0, 0)).toBe(3);
    expect(starsForRun(1, 0)).toBe(2);
    expect(starsForRun(0, 3)).toBe(2);
    expect(starsForRun(2, 0)).toBe(1);
    expect(starsForRun(0, 4)).toBe(1);
  });

  it("scores a run", () => {
    expect(levelScore(12, 0, 3)).toBe(600);
    expect(levelScore(12, 2, 3)).toBe(520);
  });

  it("reports a result", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 })]));
    const result = finalResult(launch(start, 0).state);
    expect(result).toEqual({
      mode: "level",
      level: 1,
      date: "",
      solved: true,
      launches: 1,
      missteps: 0,
      hints: 0,
      arrows: 1,
      stars: 3,
    });
  });
});

describe("arrow saves", () => {
  it("starts empty at the current save version", () => {
    const save = emptyArrowsSave();
    expect(save.version).toBe(ARROWS_SAVE_VERSION);
    expect(save.levels).toEqual({});
    expect(save.perfect).toBe(0);
  });

  it("records a solved level and its perfect count", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 })]));
    const result = finalResult(launch(start, 0).state);
    const save = recordLevelRun(emptyArrowsSave(), result);
    expect(levelStars(save, 1)).toBe(3);
    expect(levelsWon(save)).toBe(1);
    expect(perfectLevels(save)).toBe(1);
    const again = recordLevelRun(save, result);
    expect(perfectLevels(again)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/arrows.test.ts`
Expected: FAIL — the new exports (`laneInfo`, `availableIndices`, `perfectLevels`, `ARROWS_SAVE_VERSION`) do not exist.

- [ ] **Step 3: Rewrite `src/games/arrows/logic.ts`**

Replace the entire file with:

```ts
import { previousYmd } from "../../gen/daily";
import { ARROWS_SAVE_VERSION, type ArrowsDailyRecord, type ArrowsSave, type LevelRecord } from "../../save/schema";

export const ARROWS_TOTAL_LEVELS = 100;
export const ARROWS_MIN_SIZE = 4;
export const ARROWS_MAX_SIZE = 9;
export const ARROWS_MAX_LENGTH = 3;
export const ARROWS_SCORE_PER_STAR = 200;

/** Arrow headings, clockwise starting at up. */
export type Dir = 0 | 1 | 2 | 3;

export const DIR_NAMES = ["up", "right", "down", "left"] as const;

const DIR_DR = [-1, 0, 1, 0] as const;
const DIR_DC = [0, 1, 0, -1] as const;

export type ArrowsMode = "level" | "endless" | "daily";

/** There is no fail state: a board is either in play or fully cleared. */
export type ArrowsStatus = "playing" | "solved";

/** A fixed arrow. Its body extends opposite `dir` for `length` cells. */
export interface ArrowTile {
  id: number;
  dir: Dir;
  /** Cell the arrow head starts on. */
  head: number;
  /** Cells the arrow occupies, head included (1-3). */
  length: number;
  /** Escapes required before this arrow may launch. 0 = free immediately. */
  lock: number;
}

/** Static, fully generated board definition. */
export interface ArrowsBoard {
  size: number;
  arrows: ArrowTile[];
  seed: string;
}

/** Undo point. Arrows never move, so only the live set and counters change. */
export interface ArrowsSnapshot {
  alive: boolean[];
  escaped: number;
  launches: number;
  missteps: number;
}

export interface ArrowsState {
  mode: ArrowsMode;
  level: number;
  boardIndex: number;
  size: number;
  arrows: ArrowTile[];
  /** Which arrows are still on the board. */
  alive: boolean[];
  escaped: number;
  /** Successful launches (each clears exactly one arrow). */
  launches: number;
  /** Taps the game rejected because the arrow was blocked or locked. */
  missteps: number;
  hints: number;
  seed: string;
  date: string;
  status: ArrowsStatus;
  history: ArrowsSnapshot[];
}

export interface ArrowsResult {
  mode: ArrowsMode;
  level: number;
  date: string;
  solved: boolean;
  launches: number;
  missteps: number;
  hints: number;
  arrows: number;
  stars: number;
}

export interface LaneInfo {
  /** Cells between the head and the edge, head-first. Ends at the blocker when blocked. */
  cells: number[];
  blocked: boolean;
  /** Cell index that blocks the launch, or -1 when the lane is clear. */
  blocker: number;
}

export interface LaunchOutcome {
  state: ArrowsState;
  moved: boolean;
  reason: "" | "blocked" | "locked" | "escaped" | "done";
  arrow: number;
  /** True when this rejected tap counted as a misstep. */
  misstep: boolean;
  lane: number[];
  blocker: number;
}

/* ------------------------------------------------------------------ geometry */

export function oppositeDir(dir: Dir): Dir {
  return ((dir + 2) % 4) as Dir;
}

export function dirName(dir: Dir): string {
  return DIR_NAMES[dir];
}

export function rowOf(size: number, cell: number): number {
  return Math.floor(cell / size);
}

export function colOf(size: number, cell: number): number {
  return cell % size;
}

export function cellAt(size: number, row: number, col: number): number {
  return row * size + col;
}

/** Cell index one step in `dir`, or -1 when it leaves the board. */
export function stepCell(size: number, cell: number, dir: Dir): number {
  const row = rowOf(size, cell) + DIR_DR[dir];
  const col = colOf(size, cell) + DIR_DC[dir];
  if (row < 0 || col < 0 || row >= size || col >= size) return -1;
  return row * size + col;
}

/** The cells a body of `length` cells occupies, head first. */
export function bodyCells(size: number, dir: Dir, head: number, length: number): number[] {
  const out: number[] = [];
  let cell = head;
  const back = oppositeDir(dir);
  for (let i = 0; i < length; i += 1) {
    if (cell < 0 || cell >= size * size) break;
    out.push(cell);
    cell = stepCell(size, cell, back);
  }
  return out;
}

/** Cells between the head and the board edge, head-first, excluding the head. */
export function lanePath(size: number, dir: Dir, head: number): number[] {
  const out: number[] = [];
  let cell = head;
  for (;;) {
    const next = stepCell(size, cell, dir);
    if (next < 0) return out;
    out.push(next);
    cell = next;
  }
}

/* ------------------------------------------------------------------- queries */

export function isEscaped(state: ArrowsState, index: number): boolean {
  return state.alive[index] !== true;
}

export function isLocked(state: ArrowsState, index: number): boolean {
  const arrow = state.arrows[index];
  if (!arrow) return false;
  return state.escaped < arrow.lock;
}

/** Every cell occupied by a live arrow, optionally skipping one index. */
export function occupiedCells(
  size: number,
  arrows: readonly ArrowTile[],
  alive: readonly boolean[],
  skip = -1,
): Set<number> {
  const set = new Set<number>();
  for (let i = 0; i < arrows.length; i += 1) {
    if (i === skip || alive[i] !== true) continue;
    const arrow = arrows[i]!;
    for (const cell of bodyCells(size, arrow.dir, arrow.head, arrow.length)) set.add(cell);
  }
  return set;
}

/** True when any other live arrow's body sits in `index`'s lane. */
export function laneBlocked(
  size: number,
  arrows: readonly ArrowTile[],
  alive: readonly boolean[],
  index: number,
): boolean {
  const arrow = arrows[index];
  if (!arrow) return true;
  const occupied = occupiedCells(size, arrows, alive, index);
  for (const cell of lanePath(size, arrow.dir, arrow.head)) {
    if (occupied.has(cell)) return true;
  }
  return false;
}

export function laneInfo(state: ArrowsState, index: number): LaneInfo {
  const arrow = state.arrows[index];
  if (!arrow || state.alive[index] !== true) return { cells: [], blocked: false, blocker: -1 };
  const occupied = occupiedCells(state.size, state.arrows, state.alive, index);
  const cells: number[] = [];
  let cell = arrow.head;
  for (;;) {
    const next = stepCell(state.size, cell, arrow.dir);
    if (next < 0) return { cells, blocked: false, blocker: -1 };
    cells.push(next);
    if (occupied.has(next)) return { cells, blocked: true, blocker: next };
    cell = next;
  }
}

export function canLaunch(state: ArrowsState, index: number): boolean {
  if (state.alive[index] !== true) return false;
  if (isLocked(state, index)) return false;
  return !laneBlocked(state.size, state.arrows, state.alive, index);
}

/** Ready arrows from raw arrays (used by the solver and generator). */
export function readyIndices(
  size: number,
  arrows: readonly ArrowTile[],
  alive: readonly boolean[],
  escaped: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < arrows.length; i += 1) {
    const arrow = arrows[i]!;
    if (alive[i] !== true || escaped < arrow.lock) continue;
    if (!laneBlocked(size, arrows, alive, i)) out.push(i);
  }
  return out;
}

export function availableIndices(state: ArrowsState): number[] {
  if (state.status !== "playing") return [];
  return readyIndices(state.size, state.arrows, state.alive, state.escaped);
}

export function availableCount(state: ArrowsState): number {
  return availableIndices(state).length;
}

export function remainingArrows(state: ArrowsState): number {
  return state.alive.reduce((count, live) => (live ? count + 1 : count), 0);
}

export function isSolved(state: ArrowsState): boolean {
  return state.escaped >= state.arrows.length;
}

export function isStuck(state: ArrowsState): boolean {
  if (isSolved(state)) return false;
  return availableIndices(state).length === 0;
}

/* ------------------------------------------------------------------- actions */

export function snapshot(state: ArrowsState): ArrowsSnapshot {
  return {
    alive: state.alive.slice(),
    escaped: state.escaped,
    launches: state.launches,
    missteps: state.missteps,
  };
}

function settle(state: ArrowsState): ArrowsState {
  return isSolved(state) ? { ...state, status: "solved" } : state;
}

function reject(
  state: ArrowsState,
  index: number,
  reason: LaunchOutcome["reason"],
  lane: number[],
  blocker: number,
  misstep: boolean,
): LaunchOutcome {
  return {
    state: misstep ? { ...state, missteps: state.missteps + 1 } : state,
    moved: false,
    reason,
    arrow: index,
    misstep,
    lane,
    blocker,
  };
}

/**
 * Launch an arrow. It escapes (and is removed) only when its whole lane to the
 * edge is free of every other live arrow's body and its lock is satisfied.
 */
export function launch(state: ArrowsState, index: number): LaunchOutcome {
  const arrow = state.arrows[index];
  if (state.status !== "playing") return reject(state, index, "done", [], -1, false);
  if (!arrow || state.alive[index] !== true) return reject(state, index, "escaped", [], -1, false);
  const info = laneInfo(state, index);
  if (isLocked(state, index)) return reject(state, index, "locked", info.cells, info.blocker, true);
  if (info.blocked) return reject(state, index, "blocked", info.cells, info.blocker, true);

  const alive = state.alive.slice();
  alive[index] = false;
  const next = settle({
    ...state,
    alive,
    escaped: state.escaped + 1,
    launches: state.launches + 1,
    history: [...state.history, snapshot(state)],
  });
  return { state: next, moved: true, reason: "", arrow: index, misstep: false, lane: info.cells, blocker: -1 };
}

export function canUndo(state: ArrowsState): boolean {
  return state.status === "playing" && state.history.length > 0;
}

export function undo(state: ArrowsState): ArrowsState {
  if (!canUndo(state)) return state;
  const history = state.history.slice();
  const last = history.pop();
  if (!last) return state;
  return { ...state, ...last, status: "playing", history };
}

/* ------------------------------------------------------------------ scoring */

/** Stars reward a clean run: no hints and no wasted taps for three. */
export function starsForRun(hints: number, missteps: number): number {
  if (hints <= 0 && missteps <= 0) return 3;
  if (hints <= 1 && missteps <= 3) return 2;
  return 1;
}

export function levelScore(_launches: number, hints: number, stars: number): number {
  return Math.max(0, stars * ARROWS_SCORE_PER_STAR - hints * 40);
}

export function boardValue(arrows: number, ready: number): number {
  return Math.max(0, arrows) * 25 + Math.max(0, ready) * 8;
}

export function finalResult(state: ArrowsState): ArrowsResult {
  const solved = state.status === "solved";
  return {
    mode: state.mode,
    level: state.level,
    date: state.date,
    solved,
    launches: state.launches,
    missteps: state.missteps,
    hints: state.hints,
    arrows: state.arrows.length,
    stars: solved ? starsForRun(state.hints, state.missteps) : 0,
  };
}

/* -------------------------------------------------------------------- saves */

export function emptyArrowsSave(): ArrowsSave {
  return {
    version: ARROWS_SAVE_VERSION,
    levels: {},
    best: 0,
    runs: 0,
    boards: 0,
    bestRun: 0,
    perfect: 0,
    dailyStreak: 0,
    bestDailyStreak: 0,
    daily: {},
  };
}

export function levelKey(level: number): string {
  return String(level);
}

export function levelRecord(save: ArrowsSave, level: number): LevelRecord | null {
  return save.levels[levelKey(level)] ?? null;
}

export function levelStars(save: ArrowsSave, level: number): number {
  return save.levels[levelKey(level)]?.stars ?? 0;
}

export function isLevelSolved(save: ArrowsSave, level: number): boolean {
  return save.levels[levelKey(level)]?.won === true;
}

export function isLevelUnlocked(save: ArrowsSave, level: number): boolean {
  if (level <= 1) return true;
  return isLevelSolved(save, level - 1);
}

export function levelsWon(save: ArrowsSave): number {
  return Object.values(save.levels).filter((record) => record.won).length;
}

/** A three-star level is by definition hint-free and misstep-free. */
export function perfectLevels(save: ArrowsSave): number {
  return Math.max(0, Math.floor(save.perfect));
}

export function isDailyDone(save: ArrowsSave, date: string): boolean {
  return save.daily[date] !== undefined;
}

export function dailyRecordFor(save: ArrowsSave, date: string): ArrowsDailyRecord | null {
  return save.daily[date] ?? null;
}

export function dailyBestStars(save: ArrowsSave, date: string): number {
  return save.daily[date]?.stars ?? 0;
}

/**
 * Consecutive solved daily dates ending at `date`. Derived from stored records
 * so replaying a completed day can never inflate the streak.
 */
export function dailyStreakOn(save: ArrowsSave, date: string, limit = 400): number {
  if (!isDailyDone(save, date)) return 0;
  let streak = 0;
  let cursor = date;
  for (let i = 0; i < limit; i += 1) {
    if (!isDailyDone(save, cursor)) break;
    streak += 1;
    cursor = previousYmd(cursor);
  }
  return streak;
}

export function recordLevelRun(save: ArrowsSave, result: ArrowsResult): ArrowsSave {
  if (result.mode !== "level" || !result.solved) return save;
  const key = levelKey(result.level);
  const prev = save.levels[key];
  const won = prev?.won === true;
  const stars = Math.max(prev?.stars ?? 0, result.stars);
  const record: LevelRecord = {
    won: true,
    stars,
    best: won && prev ? Math.min(prev.best, result.launches) : result.launches,
    bestTimeMs: null,
    hints: (prev?.hints ?? 0) + result.hints,
    attempts: (prev?.attempts ?? 0) + 1,
  };
  const wasPerfect = (prev?.stars ?? 0) >= 3;
  const gained = !wasPerfect && stars >= 3 ? 1 : 0;
  return {
    ...save,
    perfect: save.perfect + gained,
    boards: save.boards + 1,
    levels: { ...save.levels, [key]: record },
  };
}

/** Records a solved daily board once. Replays leave the save untouched. */
export function recordDailyRun(save: ArrowsSave, result: ArrowsResult): ArrowsSave {
  if (result.mode !== "daily" || !result.date) return save;
  if (!result.solved) return save;
  if (isDailyDone(save, result.date)) return save;
  const daily = {
    ...save.daily,
    [result.date]: { solved: true, launches: result.launches, stars: result.stars },
  };
  const streak = dailyStreakOn({ ...save, daily }, result.date);
  return {
    ...save,
    boards: save.boards + 1,
    dailyStreak: streak,
    bestDailyStreak: Math.max(save.bestDailyStreak, streak),
    daily,
  };
}

export function recordEndlessRun(save: ArrowsSave, score: number, cleared: number): ArrowsSave {
  const boards = Math.max(0, Math.floor(cleared));
  return {
    ...save,
    best: Math.max(save.best, Math.max(0, Math.floor(score))),
    runs: save.runs + 1,
    boards: save.boards + boards,
    bestRun: Math.max(save.bestRun, boards),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/arrows.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit 0). Note: `tests/arrows.render.test.ts`, `tests/arrows.generation.sweep.test.ts` and `tests/arrows.trap.test.ts` will fail to typecheck until Tasks 3-5; if so, temporarily rename their imports conceptually by fixing them in their own tasks. To keep this task independently green, delete-and-rewrite those three test files now to import only what exists, OR run tsc with only this file: `npx tsc --noEmit src/games/arrows/logic.ts`. Prefer the latter for the step, and rely on the full `tsc` gate in Task 7.

- [ ] **Step 6: Commit**

```bash
git add src/games/arrows/logic.ts tests/arrows.test.ts
git commit -m "feat(arrows): rewrite domain for full-lane launch and locks"
```

---

### Task 2: Save schema — version and perfect

**Files:**
- Modify: `src/save/schema.ts` (interfaces `ArrowsSave`, `defaultSaveV2`, `sanitizeV2` arrows block, new export)
- Test: `tests/saveV2.test.ts` (add one case)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ARROWS_SAVE_VERSION = 2`; `ArrowsSave.version: number`; `ArrowsSave.perfect: number`. Consumed by Task 1's `logic.ts` and Task 5's UI.

- [ ] **Step 1: Write the failing test**

Append to `tests/saveV2.test.ts` inside the top-level `describe("save v2 migration", ...)` block:

```ts
  it("resets the arrows slice when its version is stale", () => {
    const mem = new Mem();
    const stale = {
      version: 2,
      games: {
        arrows: {
          version: 1,
          levels: { "1": { won: true, stars: 3, best: 1, bestTimeMs: null, hints: 0, attempts: 1 } },
          perfect: 9,
          daily: { "2026-09-10": { solved: true, launches: 3, stars: 3 } },
        },
      },
    };
    mem.setItem(SAVE_KEY_V2, JSON.stringify(stale));
    const save = loadSaveV2(mem);
    expect(save.games.arrows.version).toBe(2);
    expect(save.games.arrows.levels).toEqual({});
    expect(save.games.arrows.perfect).toBe(0);
    expect(save.games.arrows.daily).toEqual({});
  });

  it("keeps the arrows slice when its version matches", () => {
    const mem = new Mem();
    const ok = {
      version: 2,
      games: {
        arrows: {
          version: 2,
          levels: { "1": { won: true, stars: 3, best: 1, bestTimeMs: null, hints: 0, attempts: 1 } },
          perfect: 1,
          daily: { "2026-09-10": { solved: true, launches: 3, stars: 3 } },
        },
      },
    };
    mem.setItem(SAVE_KEY_V2, JSON.stringify(ok));
    const save = loadSaveV2(mem);
    expect(save.games.arrows.perfect).toBe(1);
    expect(save.games.arrows.levels["1"]?.stars).toBe(3);
    expect(save.games.arrows.daily["2026-09-10"]?.solved).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/saveV2.test.ts`
Expected: FAIL — `save.games.arrows.perfect` is `undefined` and stale data is not reset.

- [ ] **Step 3: Implement the schema change**

In `src/save/schema.ts`, change the `ArrowsSave` interface (around line 203):

```ts
/** Schema version of the arrows slice; bump to invalidate older progress. */
export const ARROWS_SAVE_VERSION = 2;

export interface ArrowsSave {
  version: number;
  levels: Record<string, LevelRecord>;
  best: number;
  runs: number;
  boards: number;
  bestRun: number;
  perfect: number;
  dailyStreak: number;
  bestDailyStreak: number;
  daily: Record<string, ArrowsDailyRecord>;
}
```

In `defaultSaveV2`, replace the `arrows:` entry with:

```ts
      arrows: {
        version: ARROWS_SAVE_VERSION,
        levels: {},
        best: 0,
        runs: 0,
        boards: 0,
        bestRun: 0,
        perfect: 0,
        dailyStreak: 0,
        bestDailyStreak: 0,
        daily: {},
      },
```

Replace the `sanitizeV2` arrows block (around line 444) with:

```ts
  if (g.arrows && typeof g.arrows === "object") {
    const a = g.arrows as Record<string, unknown>;
    // Older arrows boards used a step-slide model and are invalid here.
    if (asCount(a.version) === ARROWS_SAVE_VERSION) {
      d.games.arrows.version = ARROWS_SAVE_VERSION;
      d.games.arrows.levels = asLevelRecords(a.levels);
      d.games.arrows.best = asCount(a.best);
      d.games.arrows.runs = asCount(a.runs);
      d.games.arrows.boards = asCount(a.boards);
      d.games.arrows.bestRun = asCount(a.bestRun);
      d.games.arrows.perfect = asCount(a.perfect);
      d.games.arrows.dailyStreak = asCount(a.dailyStreak);
      d.games.arrows.bestDailyStreak = asCount(a.bestDailyStreak);
      d.games.arrows.daily = asArrowsDaily(a.daily);
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/saveV2.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/save/schema.ts tests/saveV2.test.ts
git commit -m "feat(save): version the arrows slice and track perfect boards"
```

---

### Task 3: Generator — reverse placement, greedy solver, difficulty bands

**Files:**
- Modify: `src/games/arrows/generate.ts` (full rewrite)
- Test: `tests/arrows.generation.sweep.test.ts` (full rewrite)
- Test: `tests/arrows.trap.test.ts` (repurpose)

**Interfaces:**
- Consumes from Task 1: `ArrowTile`, `ArrowsBoard`, `ArrowsState`, `Dir`, `Dir` helpers `bodyCells`, `lanePath`, `laneBlocked`, `readyIndices`, `isSolved`, `availableIndices`.
- Produces (used by Task 5):
  - `ARROWS_LEVEL_VERSION = "v3"`, `BoardConfig`, `SolveInfo`, `plantBoard`, `solveBoard`, `analyzeDifficulty`, `levelConfig`, `endlessConfig`, `dailyConfig`, `generateLevel`, `generateEndlessBoard`, `generateDailyBoard`, `createLevelState`, `createEndlessState`, `createDailyState`, `hintIndex`.

- [ ] **Step 1: Write the failing tests**

Replace `tests/arrows.generation.sweep.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import {
  ARROWS_TOTAL_LEVELS,
  type ArrowTile,
  type ArrowsState,
  bodyCells,
  isSolved,
  launch,
} from "../src/games/arrows/logic";
import {
  createDailyState,
  createEndlessState,
  createLevelState,
  dailyConfig,
  endlessConfig,
  generateDailyBoard,
  generateEndlessBoard,
  generateLevel,
  levelConfig,
  solveBoard,
} from "../src/games/arrows/generate";

const heads = (arrows: readonly ArrowTile[]): number[] => arrows.map((a) => a.head);
const lens = (arrows: readonly ArrowTile[]): number[] => arrows.map((a) => a.length);

function cellsOverlap(size: number, arrows: readonly ArrowTile[]): boolean {
  const seen = new Set<number>();
  for (const arrow of arrows) {
    for (const cell of bodyCells(size, arrow.dir, arrow.head, arrow.length)) {
      if (seen.has(cell)) return true;
      seen.add(cell);
    }
  }
  return false;
}

/** Replays the canonical order through the public action. */
function replay(state: ArrowsState, order: number[]): ArrowsState {
  let out = state;
  for (const index of order) {
    const step = launch(out, index);
    if (!step.moved) throw new Error(`order rejected at arrow ${index}`);
    out = step.state;
  }
  return out;
}

describe("arrows generation", () => {
  it("generates 100 solvable levels", { timeout: 60000 }, () => {
    for (let level = 1; level <= ARROWS_TOTAL_LEVELS; level += 1) {
      const board = generateLevel(level);
      const info = solveBoard(board.size, board.arrows);
      expect(info.solvable, `level ${level}`).toBe(true);
      expect(info.order).toHaveLength(board.arrows.length);
    }
  });

  it("replays every canonical order to a clear", { timeout: 60000 }, () => {
    for (const level of [1, 10, 11, 25, 26, 45, 46, 70, 71, 85, 86, 100]) {
      const state = createLevelState(level);
      const info = solveBoard(state.size, state.arrows);
      expect(isSolved(replay(state, info.order)), `level ${level}`).toBe(true);
    }
  });

  it("never overlaps bodies and keeps lengths and locks valid", { timeout: 60000 }, () => {
    for (let level = 1; level <= ARROWS_TOTAL_LEVELS; level += 1) {
      const board = generateLevel(level);
      expect(cellsOverlap(board.size, board.arrows), `level ${level} overlap`).toBe(false);
      for (const arrow of board.arrows) {
        expect([1, 2, 3]).toContain(arrow.length);
        expect(arrow.length).toBeLessThanOrEqual(levelConfig(level).maxLength);
        expect(arrow.lock).toBeGreaterThanOrEqual(0);
        expect(arrow.lock).toBeLessThanOrEqual(levelConfig(level).maxLock);
      }
    }
  });

  it("keeps lock requirements satisfiable in the canonical order", { timeout: 60000 }, () => {
    for (let level = 1; level <= ARROWS_TOTAL_LEVELS; level += 1) {
      const board = generateLevel(level);
      const info = solveBoard(board.size, board.arrows);
      const position = new Map<number, number>();
      info.order.forEach((index, at) => position.set(index, at));
      for (const arrow of board.arrows) {
        const at = position.get(arrow.id) ?? 0;
        expect(arrow.lock, `level ${level} arrow ${arrow.id}`).toBeLessThanOrEqual(at);
      }
    }
  });

  it("is deterministic per seed", () => {
    expect(JSON.stringify(generateLevel(37))).toBe(JSON.stringify(generateLevel(37)));
    expect(JSON.stringify(generateEndlessBoard(4, "s"))).toBe(JSON.stringify(generateEndlessBoard(4, "s")));
    expect(JSON.stringify(generateDailyBoard("2026-09-15"))).toBe(JSON.stringify(generateDailyBoard("2026-09-15")));
  });

  it("scales board size across the campaign", () => {
    expect(levelConfig(1).size).toBe(4);
    expect(levelConfig(20).size).toBe(5);
    expect(levelConfig(35).size).toBe(6);
    expect(levelConfig(60).size).toBe(7);
    expect(levelConfig(80).size).toBe(8);
    expect(levelConfig(95).size).toBe(9);
  });

  it("escalates locks and lengths late in the campaign", () => {
    expect(levelConfig(1).maxLength).toBe(1);
    expect(levelConfig(60).maxLength).toBe(3);
    expect(levelConfig(95).maxLock).toBeGreaterThanOrEqual(4);
  });

  it("builds a solvable daily board", () => {
    const board = generateDailyBoard("2026-09-15");
    expect(board.size).toBe(dailyConfig().size);
    expect(solveBoard(board.size, board.arrows).solvable).toBe(true);
    expect(isSolved(createDailyState("2026-09-15"))).toBe(false);
  });

  it("builds solvable escalating endless boards", { timeout: 60000 }, () => {
    for (let i = 0; i < 30; i += 1) {
      const cfg = endlessConfig(i);
      expect(cfg.size).toBeLessThanOrEqual(9);
      const state = createEndlessState(i, "qa");
      expect(solveBoard(state.size, state.arrows).solvable, `endless ${i}`).toBe(true);
    }
  });

  it("generates the whole campaign within a bounded time", { timeout: 60000 }, () => {
    const start = Date.now();
    for (let level = 1; level <= ARROWS_TOTAL_LEVELS; level += 1) generateLevel(level);
    expect(Date.now() - start).toBeLessThan(20000);
  });
});

void heads;
void lens;
```

Replace `tests/arrows.trap.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { launch } from "../src/games/arrows/logic";
import { createLevelState, solveBoard } from "../src/games/arrows/generate";

describe("arrow escape has no dead ends", () => {
  it("never strands arrows: the canonical order always clears", { timeout: 60000 }, () => {
    for (let level = 1; level <= 40; level += 1) {
      let state = createLevelState(level);
      const info = solveBoard(state.size, state.arrows);
      expect(info.solvable).toBe(true);
      for (const index of info.order) {
        const step = launch(state, index);
        expect(step.moved, `level ${level} arrow ${index}`).toBe(true);
        state = step.state;
      }
      expect(state.status).toBe("solved");
    }
  });

  it("offers at least one ready arrow until the board is cleared", { timeout: 60000 }, () => {
    for (let level = 1; level <= 40; level += 1) {
      let state = createLevelState(level);
      let guard = 0;
      while (state.status === "playing" && guard < 200) {
        const info = solveBoard(state.size, state.arrows);
        const index = info.initial[0];
        expect(index, `level ${level} stalled`).toBeDefined();
        const step = launch(state, index!);
        expect(step.moved).toBe(true);
        state = step.state;
        guard += 1;
      }
      expect(state.status).toBe("solved");
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/arrows.generation.sweep.test.ts tests/arrows.trap.test.ts`
Expected: FAIL — `solveBoard`, `plantBoard`, `analyzeDifficulty`, `hintIndex` do not exist.

- [ ] **Step 3: Rewrite `src/games/arrows/generate.ts`**

Replace the entire file with:

```ts
import { dailySeed } from "../../platform/dailySeed";
import { hashString, mulberry32, rngInt, type Rng } from "../../gen/seededRng";
import {
  ARROWS_TOTAL_LEVELS,
  type ArrowTile,
  type ArrowsBoard,
  type ArrowsMode,
  type ArrowsState,
  type Dir,
  bodyCells,
  isSolved,
  lanePath,
  readyIndices,
} from "./logic";

/** Bumping this invalidates every generated board. */
export const ARROWS_LEVEL_VERSION = "v3";

export interface BoardConfig {
  size: number;
  count: number;
  maxLock: number;
  maxLength: 1 | 2 | 3;
  /** Target range for the number of arrows launchable at the start. */
  minInitial: number;
  maxInitial: number;
  /** Minimum length of the forced single-choice chain at the start. */
  minChain: number;
}

/* --------------------------------------------------------------- placement */

function pickLength(rng: Rng, maxLength: number): number {
  if (maxLength <= 1) return 1;
  const r = rng();
  if (maxLength === 2) return r < 0.5 ? 1 : 2;
  return r < 0.45 ? 1 : r < 0.8 ? 2 : 3;
}

interface Placement {
  head: number;
  dir: Dir;
  length: number;
}

/**
 * Find a spot for the next-placed arrow such that neither its body nor its
 * escape lane touches an already placed arrow. `occupied` holds the bodies of
 * arrows that escape AFTER this one, so a clear lane here means the arrow can
 * always leave once they are gone.
 */
function findPlacement(size: number, occupied: Set<number>, rng: Rng, maxLength: number): Placement | null {
  for (let attempt = 0; attempt < 260; attempt += 1) {
    const head = rngInt(rng, 0, size * size - 1);
    const dir = rngInt(rng, 0, 3) as Dir;
    const length = pickLength(rng, maxLength);
    const body = bodyCells(size, dir, head, length);
    if (body.length < length) continue;
    if (body.some((cell) => occupied.has(cell))) continue;
    if (lanePath(size, dir, head).some((cell) => occupied.has(cell))) continue;
    return { head, dir, length };
  }
  return null;
}

/**
 * Build a board by placing arrows in reverse escape order: arrow `count - 1`
 * escapes last and is placed first. Because a new arrow may not enter the
 * already-occupied escape lanes of previously placed arrows, launching in
 * index order `0..count-1` always clears the board.
 */
export function plantBoard(cfg: BoardConfig, rng: Rng): ArrowsBoard | null {
  const size = cfg.size;
  const occupied = new Set<number>();
  const arrows: ArrowTile[] = new Array(cfg.count);
  for (let i = cfg.count - 1; i >= 0; i -= 1) {
    const placed = findPlacement(size, occupied, rng, cfg.maxLength);
    if (!placed) return null;
    for (const cell of bodyCells(size, placed.dir, placed.head, placed.length)) occupied.add(cell);
    const lockTop = Math.min(cfg.maxLock, i);
    const lock = lockTop > 0 && rng() < 0.45 ? rngInt(rng, 1, lockTop) : 0;
    arrows[i] = { id: i, dir: placed.dir, head: placed.head, length: placed.length, lock };
  }
  return { size, arrows, seed: "" };
}

/** Simple fallback with disjoint lanes; always solvable. */
function fallbackBoard(size: number): ArrowsBoard {
  const arrows: ArrowTile[] = [];
  for (let col = 0; col < size; col += 1) {
    arrows.push({ id: col, dir: 0, head: (size - 1) * size + col, length: 1, lock: 0 });
  }
  return { size, arrows, seed: "" };
}

/* ------------------------------------------------------------------ solver */

export interface SolveInfo {
  solvable: boolean;
  /** Canonical launch order (empty when unsolvable). */
  order: number[];
  /** Arrows launchable at the start. */
  initial: number[];
  /** Longest opening run where exactly one arrow is available. */
  chain: number;
  /** The largest number of arrows available at any single point. */
  maxReady: number;
}

/**
 * Greedy solve. Launching an available arrow only ever removes an arrow, which
 * can only clear lane cells and advance locks, so the relation is monotone and
 * a single pass is exact. If arrows remain and none is ready, the board is
 * unsolvable.
 */
export function solveBoard(size: number, arrows: readonly ArrowTile[], startAlive?: readonly boolean[]): SolveInfo {
  const alive = startAlive ? startAlive.slice() : arrows.map(() => true);
  let escaped = 0;
  const order: number[] = [];
  let initial: number[] = [];
  let chain = 0;
  let chainClosed = false;
  let maxReady = 0;
  for (;;) {
    const ready = readyIndices(size, arrows, alive, escaped);
    if (ready.length === 0) break;
    if (order.length === 0) initial = ready.slice();
    maxReady = Math.max(maxReady, ready.length);
    if (!chainClosed) {
      if (ready.length === 1) chain += 1;
      else chainClosed = true;
    }
    const pick = ready[0]!;
    alive[pick] = false;
    escaped += 1;
    order.push(pick);
  }
  return { solvable: escaped === arrows.length, order, initial, chain, maxReady };
}

export interface Difficulty {
  initial: number;
  chain: number;
  maxReady: number;
}

export function analyzeDifficulty(board: ArrowsBoard): Difficulty {
  const info = solveBoard(board.size, board.arrows);
  return { initial: info.initial.length, chain: info.chain, maxReady: info.maxReady };
}

function bandMiss(info: SolveInfo, cfg: BoardConfig): number {
  let miss = 0;
  const initial = info.initial.length;
  if (initial < cfg.minInitial) miss += cfg.minInitial - initial;
  if (initial > cfg.maxInitial) miss += initial - cfg.maxInitial;
  if (info.chain < cfg.minChain) miss += cfg.minChain - info.chain;
  return miss;
}

function buildBoard(cfg: BoardConfig, rng: Rng, attempts = 90): ArrowsBoard {
  let best: ArrowsBoard | null = null;
  let bestMiss = Infinity;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const board = plantBoard(cfg, rng);
    if (!board) continue;
    const info = solveBoard(board.size, board.arrows);
    if (!info.solvable) continue;
    const miss = bandMiss(info, cfg);
    if (miss === 0) return board;
    if (miss < bestMiss) {
      bestMiss = miss;
      best = board;
    }
  }
  return best ?? fallbackBoard(cfg.size);
}

/* ------------------------------------------------------------------ configs */

export function levelConfig(level: number): BoardConfig {
  const L = Math.min(ARROWS_TOTAL_LEVELS, Math.max(1, Math.floor(level)));
  const lerp = (from: number, to: number, lo: number, hi: number): number => {
    const t = to === from ? 1 : (L - from) / (to - from);
    return Math.round(lo + (hi - lo) * Math.min(1, Math.max(0, t)));
  };
  if (L <= 10) {
    return { size: 4, count: lerp(1, 10, 4, 6), maxLock: 0, maxLength: 1, minInitial: 3, maxInitial: 6, minChain: 0 };
  }
  if (L <= 25) {
    return { size: 5, count: lerp(11, 25, 6, 10), maxLock: 1, maxLength: 2, minInitial: 2, maxInitial: 4, minChain: 1 };
  }
  if (L <= 45) {
    return { size: 6, count: lerp(26, 45, 9, 14), maxLock: 2, maxLength: 2, minInitial: 2, maxInitial: 3, minChain: 2 };
  }
  if (L <= 70) {
    return { size: 7, count: lerp(46, 70, 12, 18), maxLock: 3, maxLength: 3, minInitial: 1, maxInitial: 3, minChain: 3 };
  }
  if (L <= 85) {
    return { size: 8, count: lerp(71, 85, 15, 22), maxLock: 4, maxLength: 3, minInitial: 1, maxInitial: 2, minChain: 4 };
  }
  return { size: 9, count: lerp(86, 100, 18, 26), maxLock: 6, maxLength: 3, minInitial: 1, maxInitial: 2, minChain: 5 };
}

export function endlessConfig(index: number): BoardConfig {
  const i = Math.max(0, Math.floor(index));
  const size = Math.min(9, 4 + Math.floor(i / 4));
  const cap = Math.min(24, size * size - 6);
  return {
    size,
    count: Math.min(cap, size + 2 + Math.floor(i / 3)),
    maxLock: Math.min(6, Math.floor(i / 4)),
    maxLength: (Math.min(3, 1 + Math.floor(i / 6)) || 1) as 1 | 2 | 3,
    minInitial: 1,
    maxInitial: Math.max(2, 4 - Math.floor(i / 8)),
    minChain: Math.min(5, Math.floor(i / 5)),
  };
}

export function dailyConfig(): BoardConfig {
  return { size: 7, count: 13, maxLock: 2, maxLength: 2, minInitial: 1, maxInitial: 3, minChain: 2 };
}

/* ---------------------------------------------------------------- generators */

const boardCache = new Map<string, ArrowsBoard>();

function cachedBoard(seed: string, make: () => ArrowsBoard): ArrowsBoard {
  const hit = boardCache.get(seed);
  if (hit) return hit;
  const board = { ...make(), seed };
  boardCache.set(seed, board);
  return board;
}

export function generateLevel(level: number, seed = `arrows:level:${level}:${ARROWS_LEVEL_VERSION}`): ArrowsBoard {
  return cachedBoard(seed, () => buildBoard(levelConfig(level), mulberry32(hashString(seed))));
}

export function generateEndlessBoard(index: number, salt = "0"): ArrowsBoard {
  const seed = `arrows:endless:${salt}:${index}:${ARROWS_LEVEL_VERSION}`;
  return cachedBoard(seed, () => buildBoard(endlessConfig(index), mulberry32(hashString(seed))));
}

export function generateDailyBoard(date: string): ArrowsBoard {
  const seed = dailySeed(date, "arrows");
  return cachedBoard(seed, () => buildBoard(dailyConfig(), mulberry32(hashString(seed))));
}

/* -------------------------------------------------------------- state maker */

function stateFromBoard(
  board: ArrowsBoard,
  mode: ArrowsMode,
  level: number,
  boardIndex: number,
  date: string,
): ArrowsState {
  const state: ArrowsState = {
    mode,
    level,
    boardIndex,
    size: board.size,
    arrows: board.arrows,
    alive: board.arrows.map(() => true),
    escaped: 0,
    launches: 0,
    missteps: 0,
    hints: 0,
    seed: board.seed,
    date,
    status: "playing",
    history: [],
  };
  return isSolved(state) ? { ...state, status: "solved" } : state;
}

export function createLevelState(level: number, seed?: string): ArrowsState {
  const board = generateLevel(level, seed);
  return stateFromBoard(board, "level", level, 0, "");
}

export function createEndlessState(index: number, salt = "0"): ArrowsState {
  const board = generateEndlessBoard(index, salt);
  return stateFromBoard(board, "endless", 0, index, "");
}

export function createDailyState(date: string): ArrowsState {
  const board = generateDailyBoard(date);
  return stateFromBoard(board, "daily", 0, 0, date);
}

/* -------------------------------------------------------------------- hints */

export function hintIndex(state: ArrowsState): number | null {
  const ready = readyIndices(state.size, state.arrows, state.alive, state.escaped);
  if (ready.length === 0) return null;
  let best = ready[0]!;
  let bestGain = -1;
  for (const index of ready) {
    const alive = state.alive.slice();
    alive[index] = false;
    const gain = readyIndices(state.size, state.arrows, alive, state.escaped + 1).length;
    if (gain > bestGain) {
      bestGain = gain;
      best = index;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/arrows.generation.sweep.test.ts tests/arrows.trap.test.ts`
Expected: PASS. If the 100-level "bounded time" case exceeds 20s, raise the level config attempt count down (from `90` to `50`) before weakening the assertion.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: only pre-existing unrelated errors, none in `src/games/arrows/generate.ts`.

```bash
git add src/games/arrows/generate.ts tests/arrows.generation.sweep.test.ts tests/arrows.trap.test.ts
git commit -m "feat(arrows): plant solvable boards with locks and difficulty bands"
```

---

### Task 4: Render layer

**Files:**
- Modify: `src/games/arrows/render.ts` (full rewrite)
- Test: `tests/arrows.render.test.ts` (full rewrite)

**Interfaces:**
- Consumes from Tasks 1 and 3: `ArrowTile`, `ArrowsMode`, `ArrowsState`, `laneInfo`, `isLocked`, `availableIndices`, `availableCount`, `remainingArrows`, `starsForRun`.
- Produces (used by Task 5): `BoardView`, `LanePreview`, `laneCells`, `boardHtml`, `remainingArrows`, `statusText`, `hudHtml`, `liveStatusHtml`, `starsText`, `LevelOption`, `MenuView`, `menuHtml`, `ResultView`, `resultCardHtml`, `helpHtml`, `PlayBody`, `playShellHtml`, `modeLabel`.

- [ ] **Step 1: Write the failing test**

Replace `tests/arrows.render.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { type ArrowTile, type ArrowsBoard, type ArrowsState, launch } from "../src/games/arrows/logic";
import {
  boardHtml,
  helpHtml,
  hudHtml,
  laneCells,
  liveStatusHtml,
  menuHtml,
  resultCardHtml,
  statusText,
  type MenuView,
  type ResultView,
} from "../src/games/arrows/render";

const tile = (over: Partial<ArrowTile> & Pick<ArrowTile, "dir" | "head">): ArrowTile => ({
  id: 0,
  length: 1,
  lock: 0,
  ...over,
});

function board(size: number, arrows: ArrowTile[]): ArrowsBoard {
  return { size, arrows: arrows.map((arrow, id) => ({ ...arrow, id })), seed: "t" };
}

function stateFor(source: ArrowsBoard): ArrowsState {
  return {
    mode: "level",
    level: 1,
    boardIndex: 0,
    size: source.size,
    arrows: source.arrows,
    alive: source.arrows.map(() => true),
    escaped: 0,
    launches: 0,
    missteps: 0,
    hints: 0,
    seed: source.seed,
    date: "",
    status: "playing",
    history: [],
  };
}

function menuView(over: Partial<MenuView> = {}): MenuView {
  return {
    date: "2026-09-15",
    levels: [
      { level: 1, stars: 3, unlocked: true },
      { level: 2, stars: 0, unlocked: true },
      { level: 3, stars: 0, unlocked: false },
    ],
    totalStars: 3,
    nextLevel: 2,
    perfect: 1,
    bestRun: 0,
    boards: 0,
    dailyDone: false,
    dailyStreak: 0,
    dailyBest: 0,
    ...over,
  };
}

function resultView(over: Partial<ResultView> = {}): ResultView {
  return {
    mode: "level",
    level: 4,
    date: "2026-09-15",
    solved: true,
    score: 600,
    launches: 12,
    missteps: 0,
    hints: 0,
    stars: 3,
    arrows: 12,
    boards: 1,
    isBest: false,
    ranked: false,
    hasNext: true,
    ...over,
  };
}

describe("arrows board render", () => {
  it("renders a grid sized from the board", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 1, head: 0 })])));
    expect(html).toContain("nar-board");
    expect(html).toContain("--nar-size:4");
    expect(html).toContain("d1");
    expect(html).toContain("nar-tip");
  });

  it("marks ready and held arrows", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 1, head: 0 }), tile({ dir: 3, head: 1 })])));
    expect(html).toContain("ready");
    expect(html).toContain("held");
  });

  it("marks length and head and tail cells", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 2, head: 0, length: 3 })])));
    expect(html).toContain("len3");
    expect(html).toContain("head");
    expect(html).toContain("tail");
  });

  it("marks locked arrows and shows a lock badge", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 1, head: 0 }), tile({ dir: 1, head: 4, lock: 2 })])));
    expect(html).toContain("locked");
    expect(html).toContain("nar-lock");
  });

  it("tints by lock tier", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 1, head: 0 }), tile({ dir: 2, head: 7, lock: 3 })])));
    expect(html).toContain("tier0");
    expect(html).toContain("tier3");
  });

  it("highlights focus and hint arrows", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 1, head: 0 })])), { focus: 0, hint: 0 });
    expect(html).toContain("focus");
    expect(html).toContain("hint");
  });
});

describe("arrows lane preview", () => {
  it("returns the whole lane when clear", () => {
    const preview = laneCells(stateFor(board(4, [tile({ dir: 1, head: 4 })]), ), 0);
    expect(preview.cells).toEqual([5, 6, 7]);
    expect(preview.blocked).toBe(false);
  });

  it("stops at the blocker", () => {
    const preview = laneCells(stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 2, head: 6 })])), 0);
    expect(preview.cells).toEqual([5, 6]);
    expect(preview.blocked).toBe(true);
    expect(preview.blocker).toBe(6);
  });

  it("shows lane classes on empty cells", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 1, head: 4 })])), { press: 0 });
    expect(html).toContain("lane");
  });
});

describe("arrows hud and status", () => {
  it("shows left, ready, missteps and hints", () => {
    const html = hudHtml(stateFor(board(4, [tile({ dir: 1, head: 0 }), tile({ dir: 2, head: 7 })])));
    expect(html).toContain("LEFT");
    expect(html).toContain("READY");
    expect(html).toContain("MISSTEPS");
    expect(html).toContain("HINTS");
    expect(html).toContain(">2<");
  });

  it("explains the ready count", () => {
    expect(statusText(stateFor(board(4, [tile({ dir: 1, head: 0 })])))).toContain("1 arrow is ready");
  });

  it("reflects missteps in the hud", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 2, head: 6 })]));
    const after = launch(start, 0).state;
    expect(hudHtml(after)).toContain('data-hud="missteps">1<');
  });
});

describe("arrows menu, result and help", () => {
  it("renders the menu with records and levels", () => {
    const html = menuHtml(menuView(), false);
    expect(html).toContain("ARROW ESCAPE");
    expect(html).toContain("NEON ARROWS DAILY");
    expect(html).toContain("PERFECT");
    expect(html).toContain('data-level="2"');
    expect(html).toContain("CONTINUE · LEVEL 2");
  });

  it("shows a completed daily card", () => {
    const html = menuHtml(menuView({ dailyDone: true, dailyBest: 3, dailyStreak: 4 }), true);
    expect(html).toContain("TODAY · ★★★");
  });

  it("titles the result card by outcome", () => {
    expect(resultCardHtml(resultView())).toContain("BOARD CLEARED");
    expect(resultCardHtml(resultView({ mode: "endless", solved: false }))).toContain("RUN OVER");
    expect(resultCardHtml(resultView({ mode: "daily", solved: true }))).toContain("DAILY COMPLETE");
  });

  it("reports launches, missteps and hints", () => {
    const html = resultCardHtml(resultView());
    expect(html).toContain("LAUNCHES");
    expect(html).toContain("MISSTEPS");
    expect(html).toContain("HINTS");
  });

  it("mentions the lane and locks in help", () => {
    const html = helpHtml(false);
    expect(html).toContain("whole lane");
    expect(html).toContain("Locked");
    expect(html).toContain("dead end");
  });

  it("exposes a live status region", () => {
    expect(liveStatusHtml("Ready")).toContain('id="arrows-status"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/arrows.render.test.ts`
Expected: FAIL — `laneCells` still returns the old shape and `tier`, `len3`, `PERFECT`, `MISSTEPS` are missing.

- [ ] **Step 3: Rewrite `src/games/arrows/render.ts`**

Replace the entire file with the implementation below. Key changes: lane preview uses `laneInfo` and exposes `blocker`; tiles gain `len{n}` and `tier{n}` classes plus `ready`/`held`; HUD is LEFT/READY/MISSTEPS/HINTS; menu gains a records panel; result reports missteps; help explains lanes and locks.

```ts
import type { ArrowsMode, ArrowsState } from "./logic";
import { availableIndices, dirName, isLocked, laneInfo, occupiedCells } from "./logic";

const ICON_BACK = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" /></svg>`;
const ICON_RESTART = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 11a8 8 0 1 0-2.4 5.7" /><path d="M20 5v6h-6" /></svg>`;
const ICON_HINT = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.8.5-1.1 1-1.1 1.8v.4" /><path d="M12 17.2v.1" /></svg>`;
const ICON_UNDO = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 7H5v-4" /><path d="M5 7a7 7 0 1 1 2 5" /></svg>`;
const ARROW_TIP = `<svg class="nar-tip" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.5l7.5 13H4.5z" /></svg>`;
const LOCK_MARK = `<svg class="nar-lock" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>`;

export interface BoardView {
  focus?: number | null;
  hint?: number | null;
  press?: number | null;
}

export interface LanePreview {
  cells: number[];
  blocked: boolean;
  blocker: number;
}

export function laneCells(state: ArrowsState, index: number): LanePreview {
  const info = laneInfo(state, index);
  return { cells: info.cells, blocked: info.blocked, blocker: info.blocker };
}

/** Lock tier 0-3 drives the arrow tint: 0 free, then 1, 2 and 3+ escapes. */
export function lockTier(lock: number): number {
  return Math.max(0, Math.min(3, Math.floor(lock)));
}

function cellLabel(state: ArrowsState, index: number, cell: number): string {
  const row = Math.floor(cell / state.size) + 1;
  const col = (cell % state.size) + 1;
  const arrow = state.arrows[index];
  if (!arrow || state.alive[index] !== true) return `Empty at row ${row} column ${col}`;
  const lock = isLocked(state, index) ? ", locked" : "";
  const length = arrow.length > 1 ? `, ${arrow.length} cells long` : "";
  return `Arrow at row ${row} column ${col}, pointing ${dirName(arrow.dir)}${length}${lock}, tap to launch`;
}

export function boardHtml(state: ArrowsState, view: BoardView = {}): string {
  const moves = new Set(availableIndices(state));
  const occupied = new Map<number, { arrow: number; offset: number }>();
  for (let i = 0; i < state.arrows.length; i += 1) {
    if (state.alive[i] !== true) continue;
    const arrow = state.arrows[i]!;
    const cells: number[] = [];
    let cell = arrow.head;
    for (let n = 0; n < arrow.length && cell >= 0; n += 1) {
      cells.push(cell);
      cell = stepBack(state.size, cell, arrow.dir);
    }
    cells.forEach((body, offset) => occupied.set(body, { arrow: i, offset }));
  }

  const preview = view.press != null ? laneInfo(state, view.press) : null;
  const laneSet = new Set(preview?.cells ?? []);
  const laneBlock = preview?.blocked ? preview.blocker : -1;

  const rows: string[] = [];
  for (let row = 0; row < state.size; row += 1) {
    const cells: string[] = [];
    for (let col = 0; col < state.size; col += 1) {
      const index = row * state.size + col;
      const part = occupied.get(index);
      if (!part) {
        const classes = ["nar-cell"];
        if (laneSet.has(index)) classes.push("lane");
        cells.push(`<div class="${classes.join(" ")}" role="gridcell" data-cell="${index}"></div>`);
        continue;
      }
      const arrow = state.arrows[part.arrow]!;
      const locked = isLocked(state, part.arrow);
      const classes = ["nar-tile", `d${arrow.dir}`, `len${arrow.length}`, `tier${lockTier(arrow.lock)}`];
      classes.push(part.offset === 0 ? "head" : "tail");
      if (arrow.length > 1) classes.push("long");
      if (locked) classes.push("locked");
      classes.push(moves.has(part.arrow) ? "ready" : "held");
      if (laneSet.has(index)) classes.push("lane");
      if (index === laneBlock) classes.push("lane-block");
      if (view.focus === part.arrow && part.offset === 0) classes.push("focus");
      if (view.hint === part.arrow) classes.push("hint");
      const glyph = part.offset === 0 ? ARROW_TIP : "";
      const lockMark = locked && part.offset === 0 ? LOCK_MARK : "";
      cells.push(
        `<button type="button" role="gridcell" tabindex="-1" class="${classes.join(" ")}" data-arrow="${
          part.arrow
        }" data-cell="${index}" aria-label="${cellLabel(state, part.arrow, index)}">${glyph}${lockMark}</button>`,
      );
    }
    rows.push(`<div role="row" class="nar-row">${cells.join("")}</div>`);
  }
  const dim = `style="--nar-size:${state.size}"`;
  return `<div class="nar-board" role="grid" tabindex="0" ${dim} aria-label="Arrow board, ${state.size} by ${state.size}">${rows.join(
    "",
  )}</div>`;
}

/** One cell backwards (opposite the arrow direction), or -1 off board. */
function stepBack(size: number, cell: number, dir: number): number {
  const dr = [-1, 0, 1, 0][dir] ?? 0;
  const dc = [0, 1, 0, -1][dir] ?? 0;
  const row = Math.floor(cell / size) - dr;
  const col = (cell % size) - dc;
  if (row < 0 || col < 0 || row >= size || col >= size) return -1;
  return row * size + col;
}

export function remainingArrows(state: ArrowsState): number {
  return state.alive.reduce((count, live) => (live ? count + 1 : count), 0);
}

export function readyCount(state: ArrowsState): number {
  return state.status === "playing" ? availableIndices(state).length : 0;
}

export function statusText(state: ArrowsState): string {
  if (state.status === "solved") return "Clean exit. Every arrow escaped.";
  const ready = availableIndices(state).length;
  if (ready === 0) return "No arrow can launch — undo a tap.";
  const word = ready === 1 ? "1 arrow is ready" : `${ready} arrows are ready`;
  return `${word}. Launch one with a clear lane.`;
}

export function hudHtml(state: ArrowsState): string {
  return `<div class="nar-hud" role="group" aria-label="Run stats">
    <div class="nar-stat"><span class="k">LEFT</span><span class="v" data-hud="left">${remainingArrows(state)}</span></div>
    <div class="nar-stat"><span class="k">READY</span><span class="v" data-hud="ready">${readyCount(state)}</span></div>
    <div class="nar-stat"><span class="k">MISSTEPS</span><span class="v" data-hud="missteps">${state.missteps}</span></div>
    <div class="nar-stat"><span class="k">HINTS</span><span class="v" data-hud="hints">${state.hints}</span></div>
  </div>`;
}

export function liveStatusHtml(message: string): string {
  return `<div class="nar-status" id="arrows-status" role="status" aria-live="polite">${message}</div>`;
}

export function starsText(stars: number): string {
  const clamped = Math.max(0, Math.min(3, Math.floor(stars)));
  return `${"★".repeat(clamped)}${"☆".repeat(3 - clamped)}`;
}

export interface LevelOption {
  level: number;
  stars: number;
  unlocked: boolean;
}

export interface MenuView {
  date: string;
  levels: LevelOption[];
  totalStars: number;
  nextLevel: number;
  perfect: number;
  bestRun: number;
  boards: number;
  dailyDone: boolean;
  dailyStreak: number;
  dailyBest: number;
}

function dailyCardHtml(view: MenuView): string {
  const status = view.dailyDone
    ? view.dailyBest > 0
      ? `TODAY · ${"★".repeat(Math.max(0, Math.min(3, view.dailyBest)))}`
      : "TODAY · PLAYED"
    : `TODAY'S SEEDED BOARD${view.dailyStreak > 0 ? ` · ${view.dailyStreak} DAY STREAK` : ""}`;
  return `<button type="button" class="nar-daily-card${view.dailyDone ? " done" : ""}" data-act="daily">
    <span class="nar-daily-mark" aria-hidden="true"></span>
    <span class="nar-daily-text">
      <span class="nar-daily-label">NEON ARROWS DAILY</span>
      <span class="nar-daily-date">${view.date}</span>
      <span class="nar-daily-status">${status}</span>
    </span>
    <span class="nar-daily-arrow" aria-hidden="true">›</span>
  </button>`;
}

function recordsHtml(view: MenuView): string {
  const solved = view.levels.filter((option) => option.stars > 0).length;
  return `<div class="nar-records" role="group" aria-label="Records">
    <div class="nar-record"><span class="k">SOLVED</span><span class="v">${solved} / ${view.levels.length}</span></div>
    <div class="nar-record"><span class="k">PERFECT</span><span class="v">${view.perfect}</span></div>
    <div class="nar-record"><span class="k">STARS</span><span class="v">${view.totalStars}</span></div>
    <div class="nar-record"><span class="k">BEST RUN</span><span class="v">${view.bestRun}</span></div>
  </div>`;
}

function levelGridHtml(view: MenuView): string {
  const cells = view.levels.map((option) => {
    const locked = !option.unlocked;
    const stars = Math.max(0, Math.min(3, Math.floor(option.stars)));
    const label = locked
      ? `Level ${option.level}, locked`
      : `Level ${option.level}, ${stars} of 3 stars`;
    return `<button type="button" class="nar-level${locked ? " locked" : ""}${
      stars > 0 ? " won" : ""
    }${stars >= 3 ? " perfect" : ""}" data-level="${option.level}"${locked ? " disabled" : ""} aria-label="${label}">
      <span class="nar-level-num">${option.level}</span>
      ${stars > 0 ? `<span class="nar-level-stars" aria-hidden="true">${"★".repeat(stars)}</span>` : ""}
    </button>`;
  });
  return `<div class="nar-levels" role="group" aria-label="Levels">${cells.join("")}</div>`;
}

export function menuHtml(view: MenuView, reduced: boolean): string {
  const nextLabel = view.nextLevel > 1 ? `CONTINUE · LEVEL ${view.nextLevel}` : "START · LEVEL 1";
  return `<div class="shell nar-shell${reduced ? " reduce" : ""}">
    <div class="nar-top">
      <button class="icon-btn nar-back" data-act="arcade" aria-label="Back to arcade">${ICON_BACK}</button>
      <div class="nar-head">
        <div class="nar-word">NEON ARROWS</div>
        <span class="nar-badge">ARROW ESCAPE</span>
      </div>
      <button class="icon-btn nar-help" data-act="help" aria-label="How to play">${ICON_HINT}</button>
    </div>
    <div class="nar-menu-body">
      ${dailyCardHtml(view)}
      <button type="button" class="cta-play nar-levels-cta" data-act="level">
        <span class="nar-cta-k">${nextLabel}</span>
        <span class="nar-cta-sub">${view.totalStars} / ${view.levels.length * 3} STARS</span>
      </button>
      <button type="button" class="nar-endless" data-act="endless">
        <span class="nar-endless-k">ENDLESS</span>
        <span class="nar-endless-sub">LARGE BOARDS · SCORE ATTACK</span>
      </button>
      ${recordsHtml(view)}
      <div class="nar-menu-label" aria-hidden="true">LEVELS</div>
      ${levelGridHtml(view)}
    </div>
  </div>`;
}

export interface ResultView {
  mode: ArrowsMode;
  level: number;
  date: string;
  solved: boolean;
  score: number;
  launches: number;
  missteps: number;
  hints: number;
  stars: number;
  arrows: number;
  boards: number;
  isBest: boolean;
  ranked: boolean;
  hasNext: boolean;
}

function resultStat(k: string, v: string, accent = ""): string {
  return `<div class="nar-result-stat${accent ? ` ${accent}` : ""}"><span class="k">${k}</span><span class="v">${v}</span></div>`;
}

export function resultCardHtml(view: ResultView): string {
  const title =
    view.mode === "daily"
      ? view.solved
        ? "DAILY COMPLETE"
        : "DAILY OVER"
      : view.mode === "endless"
        ? "RUN OVER"
        : view.solved
          ? "BOARD CLEARED"
          : "BOARD OVER";
  const badge =
    view.mode === "daily"
      ? view.ranked
        ? `<div class="nar-practice reward">RANKED · FIRST RUN TODAY</div>`
        : `<div class="nar-practice">PRACTICE · DAILY ALREADY SCORED</div>`
      : view.mode === "endless"
        ? view.isBest
          ? `<div class="nar-practice reward">NEW BEST</div>`
          : `<div class="nar-practice">${view.boards} BOARDS CLEARED</div>`
        : `<div class="nar-practice reward">LEVEL ${view.level} · ${view.arrows} ARROWS</div>`;
  const replay = view.mode === "daily" ? "daily-again" : view.mode === "endless" ? "endless" : "level";
  const next =
    view.mode === "level" && view.solved && view.hasNext
      ? `<button class="cta-play" data-act="level-next">NEXT LEVEL</button>`
      : "";
  return `<div class="overlay nar-overlay">
    <div class="win-card nar-card">
      <div class="nar-card-glow" aria-hidden="true"></div>
      <h2>${title}</h2>
      ${badge}
      <div class="stars" aria-label="${view.stars} of 3 stars">${starsText(view.stars)}</div>
      <div class="nar-result-grid">
        ${resultStat("SCORE", String(view.score), "wide")}
        ${resultStat("LAUNCHES", String(view.launches))}
        ${resultStat("MISSTEPS", String(view.missteps))}
        ${resultStat("HINTS", String(view.hints))}
      </div>
      <div class="win-actions">
        ${next}
        <button class="cta-play" data-act="${replay}">PLAY AGAIN</button>
        <button class="ghost-btn" data-act="menu">LEVELS</button>
        <button class="ghost-btn" data-act="arcade">BACK TO ARCADE</button>
      </div>
    </div>
  </div>`;
}

export function helpHtml(reduced: boolean): string {
  return `<div class="shell nar-shell${reduced ? " reduce" : ""}">
    <div class="nar-top">
      <button class="icon-btn nar-back" data-act="close-help" aria-label="Close help">${ICON_BACK}</button>
      <div class="nar-head"><div class="nar-word">HOW TO PLAY</div></div>
      <span class="nar-spacer"></span>
    </div>
    <div class="nar-help">
      <p>Tap an arrow to <b>launch</b> it. It shoots straight in the direction it points and escapes off the edge.</p>
      <p>An arrow needs its <b>whole lane</b> to the edge clear. Hold an arrow to preview the lane: green means it can go, red stops at whatever blocks it.</p>
      <p><b>Long arrows</b> take up two or three cells, so they block more lanes and free more space when they leave.</p>
      <p><b>Locked arrows</b> wake only after a number of other arrows have escaped. The badge shows how many.</p>
      <p>Clear every arrow to finish the board. You can never dead end — every board has an order that works.</p>
      <ul class="nar-legend">
        <li><span class="nar-legend-cell ready" aria-hidden="true"></span> Ready — a clear lane to the edge.</li>
        <li><span class="nar-legend-cell held" aria-hidden="true"></span> Held — something sits in the lane.</li>
        <li><span class="nar-legend-cell locked" aria-hidden="true"></span> Locked — wakes after enough escapes.</li>
        <li><span class="nar-legend-cell long" aria-hidden="true"></span> Long arrow — fills two or three cells.</li>
      </ul>
      <p>Three stars need a clean run: no hints and no wasted taps.</p>
      <p class="nar-dim">Keyboard: arrows to move, Enter to launch, U to undo, H for a hint.</p>
      <button class="cta-play" data-act="close-help">Got it</button>
    </div>
  </div>`;
}

export interface PlayBody {
  board: string;
  status: string;
}

export function playShellHtml(state: ArrowsState, modeLabel: string, body: PlayBody, reduced: boolean): string {
  return `<div class="shell nar-shell${reduced ? " reduce" : ""}">
    <div class="nar-top">
      <button class="icon-btn nar-back" data-act="menu" aria-label="Back to modes">${ICON_BACK}</button>
      <div class="nar-head">
        <div class="nar-word">NEON ARROWS</div>
        <span class="nar-badge">${modeLabel}</span>
      </div>
      <div class="nar-top-actions">
        <button class="icon-btn nar-undo" data-act="undo" aria-label="Undo">${ICON_UNDO}</button>
        <button class="icon-btn nar-hint" data-act="hint" aria-label="Hint">${ICON_HINT}</button>
        <button class="icon-btn nar-restart" data-act="restart" aria-label="Restart board">${ICON_RESTART}</button>
      </div>
    </div>
    ${hudHtml(state)}
    <div class="nar-play">
      <div class="nar-stage">
        <div class="nar-board-frame">
          <div class="nar-board-wrap">${body.board}</div>
          <div class="nar-sparks" aria-hidden="true"></div>
        </div>
      </div>
      ${body.status}
    </div>
  </div>`;
}

export function modeLabel(mode: ArrowsMode, state: ArrowsState): string {
  if (mode === "daily") return `DAILY ${state.date}`;
  if (mode === "endless") return state.boardIndex > 0 ? `ENDLESS · BOARD ${state.boardIndex + 1}` : "ENDLESS";
  return `LEVEL ${state.level}`;
}
```

Note: `occupiedCells` is imported for completeness but unused in this file after the rewrite — remove it from the import list if `npx tsc --noEmit` reports `TS6133`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/arrows.render.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/games/arrows/render.ts tests/arrows.render.test.ts
git commit -m "feat(arrows): render lanes, tiers and missteps"
```

---

### Task 5: UI controller

**Files:**
- Modify: `src/games/arrows/ui.ts` (full rewrite)

**Interfaces:**
- Consumes: everything produced by Tasks 1-4, plus `hintIndex` from `generate.ts`.
- Produces: `mountArrows`, `unmountArrows` (unchanged signatures, consumed by `src/games/arrows/index.ts`).

- [ ] **Step 1: Rewrite `src/games/arrows/ui.ts`**

Replace the entire file with:

```ts
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
    goMenu();
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
```

`finishEndless` is intentionally defined but only callable from an endless loss; since there is no fail state it is currently unreferenced. To satisfy `noUnusedLocals`, either remove it or call it from an explicit "END RUN" button. Remove `finishEndless` if tsc reports `TS6133`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (after removing `finishEndless` if flagged).

- [ ] **Step 3: Run the arrows suites as a smoke check**

Run: `npx vitest run tests/arrows.test.ts tests/arrows.render.test.ts tests/arrows.generation.sweep.test.ts tests/arrows.trap.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/games/arrows/ui.ts
git commit -m "feat(arrows): drive the new launch model from the ui"
```

---

### Task 6: Styles

**Files:**
- Modify: `src/styles/game.css` (the existing `nar-` block)

**Interfaces:**
- Consumes: the class names emitted by Task 4: `tier0`-`tier3`, `len2`, `len3`, `lane`, `lane-block`, `nar-records`, `nar-record`, `nar-level.perfect`, plus existing `nar-tile`, `nar-hud`, `nar-stat`.

- [ ] **Step 1: Add tier, length and lane rules**

Append after the existing `.nar-cell` rule inside the `nar-` block:

```css
.nar-tile.len2 .nar-tip,
.nar-tile.len3 .nar-tip {
  transform: scale(1.05);
}

.nar-tile.len3 {
  filter: brightness(1.12);
}

.nar-tile.tier0 { --nar-tile: #4fc3ff; }
.nar-tile.tier1 { --nar-tile: #b46bff; }
.nar-tile.tier2 { --nar-tile: #ffc857; }
.nar-tile.tier3 { --nar-tile: #ff6b9a; }

.nar-tile.ready {
  border-color: color-mix(in srgb, var(--nar-tile, var(--nar)) 60%, transparent);
}

.nar-cell.lane {
  background: rgba(156, 255, 79, 0.14);
  box-shadow: inset 0 0 0 1px rgba(156, 255, 79, 0.35);
}

.nar-cell.lane-block,
.nar-tile.lane-block {
  background: rgba(255, 107, 154, 0.2);
  box-shadow: inset 0 0 0 1px rgba(255, 107, 154, 0.55);
}
```

If `.nar-tile` uses a hard-coded accent color, replace that declaration with `color: var(--nar-tile, var(--nar));` and `border-color: color-mix(in srgb, var(--nar-tile, var(--nar)) 45%, transparent);` so the tier custom property takes effect.

- [ ] **Step 2: Add the records panel rules**

Append near the menu rules:

```css
.nar-records {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}

.nar-record {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(10, 16, 28, 0.7);
}

.nar-record .k {
  font-size: 10px;
  letter-spacing: 0.16em;
  opacity: 0.65;
}

.nar-record .v {
  font-family: var(--display, "Orbitron", sans-serif);
  font-size: 14px;
  color: var(--nar);
}

.nar-level.perfect {
  border-color: rgba(255, 200, 87, 0.55);
  box-shadow: 0 0 14px rgba(255, 200, 87, 0.25);
}
```

- [ ] **Step 3: Verify visually**

Run: `npm run build`
Expected: build succeeds with no CSS warnings.

- [ ] **Step 4: Commit**

```bash
git add src/styles/game.css
git commit -m "feat(arrows): style tiers, lanes and records"
```

---

### Task 7: Full verification and QA

**Files:**
- No source changes unless a gate fails.

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all test files pass (previously 46 files / 560 tests; the count changes as arrows suites are rewritten). No failures, no unhandled errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Playwright QA**

Start the dev server in a background terminal, request a preview URL, then run a script at `/tmp/opencode/qa.cjs` with `NODE_PATH=/usr/local/lib/node_modules node qa.cjs`. It must visit `https://<preview-host>/` at 390x844 and 1024x768 and check:

1. Hub loads and the `arrows` card is present.
2. Arrows menu shows `ARROW ESCAPE`, the daily card, `ENDLESS`, `PERFECT` records and a level grid.
3. Level 1 opens; HUD shows `LEFT`, `READY`, `MISSTEPS`, `HINTS`.
4. A hint marks an arrow with `.nar-tile.hint`; tapping it increases `data-hud="launches"`.
5. Undo decreases launches by one.
6. A deliberate blocked tap increases `data-hud="missteps"` and shows a shake.
7. Guided `hint` + tap clears the board and the result shows `BOARD CLEARED` with `LAUNCHES`, `MISSTEPS`, `HINTS`.
8. `NEXT LEVEL` opens level 2.
9. Menu → daily opens a 7x7 board; menu → endless opens and accepts taps.
10. Zero console errors and zero page errors at both viewports.

- [ ] **Step 5: Commit any QA fixes**

```bash
git add -A
git commit -m "fix(arrows): address qa findings for the launch model"
```

Only commit if Step 4 required changes; otherwise skip.

---

## Self-Review

**Spec coverage**

- Full-lane launch, no rotation, escape at edge: Task 1 (`launch`, `laneInfo`, `lanePath`).
- Length 2-3 arrows: Task 1 (`length` in `ArrowTile`, `bodyCells`) and Task 3 (`pickLength`, `maxLength`).
- Locked arrows with exact badge count: Task 1 (`lock`, `isLocked`) and Task 4 (`nar-lock`, help copy).
- Color-coded tiers: Task 4 (`lockTier`, `tier0`-`tier3`) and Task 6 (tier CSS).
- Dense interlocking packing: Task 3 (reverse placement lanes, `minInitial`, `minChain`, band rejection).
- 100 levels, 4x4 to 9x9: Task 3 (`ARROWS_TOTAL_LEVELS`, `levelConfig`).
- Endless to 9x9 and daily 7x7: Task 3 (`endlessConfig`, `dailyConfig`).
- No fail state, never dead-ends: Task 1 (`ArrowsStatus`), Task 3 (monotone greedy solver), Task 6 test (`arrows.trap.test.ts`).
- Stars from hints and missteps, perfect records: Task 1 (`starsForRun`, `perfectLevels`), Task 2 (`perfect`), Task 4 (records panel).
- Lane ray preview green/red: Task 4 (`laneCells`, `lane`/`lane-block`), Task 5 (`onPointerDown`), Task 6 (colors).
- Save version reset: Task 2.
- Testing and QA: Tasks 1-5 tests plus Task 7 gates.

**Placeholder scan:** No "TBD", "TODO" or "similar to Task N". Every code step contains complete code or exact CSS.

**Type consistency:** `ArrowTile` is `{ id, dir, head, length, lock }` throughout. `ArrowsState.alive` replaces the old `heads`/`bodies` everywhere. `laneInfo` returns `{ cells, blocked, blocker }` and `laneCells` returns the same shape; both are used consistently in render and UI. `starsForRun(hints, missteps)` has two parameters in logic, tests and call sites. `levelScore(launches, hints, stars)` matches its call in `finishSolved`. `solveBoard(size, arrows, startAlive?)` is used identically in generator and tests.
