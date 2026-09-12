import type { Cell, ColorName, Direction, Puzzle } from "../engine/types";
import { COLORS } from "../engine/types";
import { rotateDirection } from "../engine/rotation";
import { simulatePuzzle } from "../engine/simulation";
import { fillFromMap } from "./fill";
import { hashString, mulberry32, rngInt, rngPick, rngShuffle, type Rng } from "./seededRng";
import { profileForLevel, scoreDifficulty, type DifficultyProfile } from "./difficulty";

const DELTAS: Array<{ dr: number; dc: number; dir: Direction }> = [
  { dr: -1, dc: 0, dir: 0 },
  { dr: 0, dc: 1, dir: 1 },
  { dr: 1, dc: 0, dir: 2 },
  { dr: 0, dc: -1, dir: 3 },
];

function key(r: number, c: number): string {
  return `${r},${c}`;
}

function neighbors(size: number, r: number, c: number): typeof DELTAS {
  return DELTAS.filter((d) => {
    const nr = r + d.dr;
    const nc = c + d.dc;
    return nr >= 0 && nc >= 0 && nr < size && nc < size;
  });
}

function randomPath(rng: Rng, size: number, minLen: number, maxLen: number): Array<{ r: number; c: number }> | null {
  const cap = size * size - 1;
  const target = rngInt(rng, minLen, Math.min(maxLen, cap));
  const startR = rngInt(rng, 0, size - 1);
  const startC = rngInt(rng, 0, size - 1);
  const path = [{ r: startR, c: startC }];
  const used = new Set([key(startR, startC)]);
  let lastDir: Direction | null = null;

  while (path.length < target) {
    const cur = path[path.length - 1]!;
    const opts = neighbors(size, cur.r, cur.c).filter((d) => !used.has(key(cur.r + d.dr, cur.c + d.dc)));
    if (opts.length === 0) break;
    const straight: typeof DELTAS = lastDir === null ? [] : opts.filter((d) => d.dir === lastDir);
    const pickPool: typeof DELTAS = straight.length && rng() < 0.62 ? straight : opts;
    const n = rngPick(rng, rngShuffle(rng, pickPool));
    const nr = cur.r + n.dr;
    const nc = cur.c + n.dc;
    path.push({ r: nr, c: nc });
    used.add(key(nr, nc));
    lastDir = n.dir;
  }

  if (path.length < minLen) return null;
  return path;
}

function dirBetween(a: { r: number; c: number }, b: { r: number; c: number }): Direction {
  const dr = b.r - a.r;
  const dc = b.c - a.c;
  if (dr === -1 && dc === 0) return 0;
  if (dr === 0 && dc === 1) return 1;
  if (dr === 1 && dc === 0) return 2;
  return 3;
}

function scrambleAway(rng: Rng, dir: Direction): Direction {
  const steps = rng() < 0.7 ? 1 : rngInt(rng, 1, 3);
  return rotateDirection(dir, steps);
}

export function generatePuzzle(
  seed: number,
  opts: { id: string; pack: string; level?: number; profile?: DifficultyProfile },
): Puzzle {
  const profile = opts.profile ?? profileForLevel(opts.level ?? 10);
  const rng = mulberry32(seed >>> 0);
  let last: Puzzle | null = null;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const path = randomPath(rng, profile.size, profile.minPath, profile.maxPath);
    if (!path || path.length < 3) continue;
    const occupancy = path.length / (profile.size * profile.size);
    if (occupancy < Math.max(0.45, 0.72 - profile.emptyBias)) continue;

    const start = path[0]!;
    const lastNode = path[path.length - 1]!;
    const exitCandidates = neighbors(profile.size, lastNode.r, lastNode.c).filter(
      (d) => !path.some((p) => p.r === lastNode.r + d.dr && p.c === lastNode.c + d.dc),
    );
    if (exitCandidates.length === 0) continue;
    const exitDelta = rngPick(rng, exitCandidates);
    const exit = { r: lastNode.r + exitDelta.dr, c: lastNode.c + exitDelta.dc };

    const map = new Map<string, Cell>();
    for (let i = 0; i < path.length; i += 1) {
      const cur = path[i]!;
      const next = i < path.length - 1 ? path[i + 1]! : exit;
      const canonicalDir = dirBetween(cur, next);
      const isStart = i === 0;
      const incoming = COLORS[(i + COLORS.length - 1) % COLORS.length] as ColorName;
      const color = COLORS[i % COLORS.length] as ColorName;
      const useGate = profile.gates && i > 1 && i < path.length - 1 && rng() < 0.18;
      map.set(key(cur.r, cur.c), {
        row: cur.r,
        col: cur.c,
        type: isStart ? "start" : useGate ? "gate" : "arrow",
        direction: canonicalDir,
        canonicalDir,
        required: true,
        color: useGate ? incoming : color,
        locked: false,
      });
    }
    map.set(key(exit.r, exit.c), {
      row: exit.r,
      col: exit.c,
      type: "exit",
      required: false,
    });

    if (profile.decoyChance > 0) {
      for (let r = 0; r < profile.size; r += 1) {
        for (let c = 0; c < profile.size; c += 1) {
          if (map.has(key(r, c))) continue;
          if (rng() > profile.decoyChance) continue;
          const nbs = neighbors(profile.size, r, c);
          if (nbs.length === 0) continue;
          const dir = rngPick(rng, nbs).dir;
          map.set(key(r, c), {
            row: r,
            col: c,
            type: "arrow",
            direction: dir,
            canonicalDir: dir,
            required: false,
            color: rngPick(rng, COLORS),
            locked: false,
          });
        }
      }
    }

    const cells = fillFromMap(profile.size, map);
    const required = cells.filter((c) => c.required && c.canonicalDir !== undefined && !c.locked);
    const scrambleCount = Math.min(
      required.length,
      rngInt(rng, profile.scrambleMin, profile.scrambleMax),
    );
    const scrambleTargets = rngShuffle(rng, required).slice(0, scrambleCount);
    for (const t of scrambleTargets) {
      t.direction = scrambleAway(rng, t.canonicalDir as Direction);
    }

    let locks = 0;
    for (const c of cells) {
      if (!c.required || c.type === "start" || c.direction === undefined) continue;
      if (c.direction !== c.canonicalDir) continue;
      if (rng() < profile.lockChance) {
        c.locked = true;
        locks += 1;
      }
    }

    const par = cells.reduce((n, c) => {
      if (c.locked || c.canonicalDir === undefined || c.direction === undefined) return n;
      return n + ((c.canonicalDir - c.direction + 4) % 4);
    }, 0);

    const puzzle: Puzzle = {
      id: opts.id,
      seed,
      size: profile.size,
      cells,
      start: { row: start.r, col: start.c },
      exit: { row: exit.r, col: exit.c },
      par,
      difficulty: scoreDifficulty(profile.size, path.length, par, locks),
      pack: opts.pack,
    };

    const solved = simulatePuzzle(
      puzzle,
      puzzle.cells.map((c) => ({ ...c, direction: c.canonicalDir ?? c.direction })),
    );
    if (solved.outcome !== "win") continue;
    last = puzzle;
    return puzzle;
  }

  if (last) return last;
  return fallbackPuzzle(seed, opts.id, opts.pack, profile.size);
}

function fallbackPuzzle(seed: number, id: string, pack: string, size: number): Puzzle {
  const map = new Map<string, Cell>();
  const path: Array<[number, number]> = [];
  for (let c = 0; c < size - 1; c += 1) path.push([0, c]);
  for (let r = 0; r < size; r += 1) path.push([r, size - 1]);
  const unique: Array<[number, number]> = [];
  const seen = new Set<string>();
  for (const p of path) {
    const k = `${p[0]},${p[1]}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(p);
  }
  const exit = unique.pop()!;
  for (let i = 0; i < unique.length; i += 1) {
    const cur = unique[i]!;
    const next = i < unique.length - 1 ? unique[i + 1]! : exit;
    const dir = dirBetween({ r: cur[0], c: cur[1] }, { r: next[0], c: next[1] });
    map.set(key(cur[0], cur[1]), {
      row: cur[0],
      col: cur[1],
      type: i === 0 ? "start" : "arrow",
      direction: i === 1 ? rotateDirection(dir, 1) : dir,
      canonicalDir: dir,
      required: true,
      color: COLORS[i % 4],
    });
  }
  map.set(key(exit[0], exit[1]), { row: exit[0], col: exit[1], type: "exit", required: false });
  const cells = fillFromMap(size, map);
  const par = cells.reduce((n, c) => {
    if (c.canonicalDir === undefined || c.direction === undefined) return n;
    return n + ((c.canonicalDir - c.direction + 4) % 4);
  }, 0);
  return {
    id,
    seed,
    size,
    cells,
    start: { row: unique[0]![0], col: unique[0]![1] },
    exit: { row: exit[0], col: exit[1] },
    par,
    difficulty: 1,
    pack,
  };
}

export function seedForLevel(level: number): number {
  return hashString(`GLOWTRAIL:level:${level}:v1`);
}

export function generateLevel(level: number): Puzzle {
  const pack = level <= 20 ? "pulse" : level <= 40 ? "surge" : "color-gates";
  return generatePuzzle(seedForLevel(level), {
    id: `${pack}-${level}`,
    pack,
    level,
  });
}
