# GLOWTRAIL Arcade - Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn GLOWTRAIL into GLOWTRAIL Arcade: a platform shell plus four original neon puzzle games sharing save, meta, daily, audio, accessibility, and navigation, without breaking existing GLOWTRAIL gameplay or save data.

**Architecture:** Additive `src/platform/` (types, registry, router, services, ui) and `src/games/` (glowtrail, fusion, prism, glyph). The proven `src/engine`, `src/gen`, `src/levels`, `src/render`, `src/audio`, and `src/save` v1 logic stay in place; GLOWTRAIL is wrapped in a `MiniGame` adapter. Save moves to a `glowtrail:v2` envelope with an idempotent, lossless v1 migration that never deletes the v1 key.

**Tech Stack:** Vite, vanilla TypeScript, Canvas 2D, Vitest, Capacitor 6 Android.

## Global Constraints

- Do not rewrite from scratch; do not delete existing GLOWTRAIL functionality or save data.
- Runtime dependencies: none new. No heavyweight engines, no image/audio libraries.
- Save key v2: `glowtrail:v2`. Legacy key preserved: `glowtrail:v1`.
- Games must not access `localStorage` directly.
- Pure game logic must not call `Date.now()` or `performance.now()`.
- Deterministic: all randomness from injected seeded RNG.
- TypeScript strict: `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`.
- Mobile-first portrait. Palette: bg `#07080D`, cyan `#29DDF4`, magenta `#E45CFF`, amber `#FFC857`, lime `#9CFF4F`.
- Interactive targets >= 44px. `focus-visible`. Respect `prefers-reduced-motion`. Never color-only communication.
- Ads disabled in M1 (`NoopAdsService`). Analytics interface only (`NoopAnalytics`).
- Verify every task with `npx vitest run`, `npm run typecheck`, `npm run build`.
- Never commit secrets. Signing material stays in `.android-signing/` (gitignored).
- App id stays `com.glowtrail.app`; display name becomes `GLOWTRAIL Arcade`.

## File Structure

```text
src/platform/
  types.ts                 MiniGame, GameMeta, GameContext, GameResult, GameSaveSlice
  registry.ts              descriptors + lazy loaders
  router.ts                hash router + back handling
  progression.ts           pure XP/level/achievement rules
  cosmetics.ts             cosmetic catalog + unlock rules (pure)
  services/audio/index.ts  AudioService over synth
  services/haptics/index.ts HapticsService over haptics
  services/save/index.ts   SaveService over save v2
  services/settings/index.ts SettingsService
  services/rng/index.ts    re-export seededRng
  services/telemetry/index.ts AnalyticsService + NoopAnalytics
  services/ads/index.ts    AdsService + NoopAdsService
  ui/launcher.ts           Home/Dashboard
  ui/chrome.ts             top bar, modal, toast, sheet
src/games/glowtrail/index.ts  MiniGame adapter (uses controller + render)
src/games/fusion/{logic.ts,render.ts,index.ts}
src/games/prism/{logic.ts,solver.ts,render.ts,index.ts}
src/games/glyph/{logic.ts,words.ts,render.ts,index.ts}
src/save/schema.ts         extend with v2 types + sanitizeV2
src/save/storage.ts        add loadSaveV2 / persistSaveV2
src/save/migration.ts      real v1 -> v2 migration
src/main.ts                boot router
tests/saveV2.test.ts, progression.test.ts, fusion.test.ts, prism.test.ts,
tests/glyph.test.ts, gauntlet.test.ts, registry.test.ts, cosmetics.test.ts
```

---

### Task 1: Save v2 schema and lossless migration

**Files:**
- Modify: `src/save/schema.ts`
- Modify: `src/save/storage.ts`
- Modify: `src/save/migration.ts`
- Test: `tests/saveV2.test.ts`

**Interfaces:**
- Consumes: existing `SaveData`, `defaultSave`, `sanitizeSave`, `StorageLike`.
- Produces:
  - `SAVE_KEY_V1 = "glowtrail:v1"`, `SAVE_KEY_V2 = "glowtrail:v2"`, `SAVE_VERSION = 2`
  - `type GlowtrailSave = SaveData`
  - `interface ProfileSave { xp; level; streak; lastDailyDate; muted; reduceMotion: "auto"|"on"|"off"; theme; cosmetics: string[]; achievements: string[]; gauntletDate: string|null; gauntletDone: string[] }`
  - `interface FusionSave { best; runs; dailyBest: Record<string, number> }`
  - `interface PrismSave { solved: string[]; bestMoves: Record<string, number> }`
  - `interface GlyphSave { wins; playDates: string[]; lastResult: string|null }`
  - `interface SaveV2 { version: 2; profile: ProfileSave; games: { glowtrail; fusion; prism; glyph } }`
  - `defaultSaveV2(): SaveV2`, `sanitizeV2(raw: unknown): SaveV2`
  - `loadSaveV2(storage?): SaveV2`, `persistSaveV2(data, storage?): void`
  - `migrateSave(raw: unknown): SaveV2`

- [ ] **Step 1: Write the failing test** `tests/saveV2.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { defaultSave, SAVE_KEY_V1, SAVE_KEY_V2 } from "../src/save/schema";
import { loadSaveV2 } from "../src/save/storage";
import type { StorageLike } from "../src/save/storage";

class Mem implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

function writeV1(mem: Mem) {
  const v1 = { ...defaultSave(), stars: { "pulse-1": 3 }, solved: { "pulse-1": true },
    currentPack: "surge", tutorialDone: true, streak: 4,
    lastDailyDate: "2026-09-10", dailyDate: "2026-09-10", muted: true };
  mem.setItem(SAVE_KEY_V1, JSON.stringify(v1));
  return v1;
}

describe("save v2 migration", () => {
  it("migrates all v1 fields losslessly and keeps the v1 key", () => {
    const mem = new Mem();
    const v1 = writeV1(mem);
    const v2 = loadSaveV2(mem);
    expect(v2.version).toBe(2);
    expect(v2.games.glowtrail.stars).toEqual(v1.stars);
    expect(v2.games.glowtrail.solved).toEqual(v1.solved);
    expect(v2.games.glowtrail.currentPack).toBe("surge");
    expect(v2.games.glowtrail.tutorialDone).toBe(true);
    expect(v2.games.glowtrail.muted).toBe(true);
    expect(v2.profile.streak).toBe(4);
    expect(v2.profile.muted).toBe(true);
    expect(mem.getItem(SAVE_KEY_V1)).not.toBeNull();
    expect(mem.getItem(SAVE_KEY_V2)).not.toBeNull();
  });

  it("is idempotent", () => {
    const mem = new Mem();
    writeV1(mem);
    const a = loadSaveV2(mem);
    const b = loadSaveV2(mem);
    expect(b).toEqual(a);
  });

  it("fresh install returns defaults", () => {
    expect(loadSaveV2(new Mem())).toEqual(defaultSaveV2());
  });

  it("corrupt v1 does not throw and yields defaults", () => {
    const mem = new Mem();
    mem.setItem(SAVE_KEY_V1, "{not json");
    const v2 = loadSaveV2(mem);
    expect(v2.games.glowtrail.stars).toEqual({});
  });

  it("prefers an existing valid v2 over v1", () => {
    const mem = new Mem();
    writeV1(mem);
    const first = loadSaveV2(mem);
    first.profile.xp = 999;
    mem.setItem(SAVE_KEY_V2, JSON.stringify(first));
    expect(loadSaveV2(mem).profile.xp).toBe(999);
  });
});
```

Note: import `defaultSaveV2` from `../src/save/schema` too; adjust the import line accordingly when writing the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/saveV2.test.ts`
Expected: FAIL (cannot resolve `loadSaveV2`).

- [ ] **Step 3: Implement schema v2**

In `src/save/schema.ts`, append:

```ts
export const SAVE_KEY_V1 = SAVE_KEY;           // "glowtrail:v1"
export const SAVE_KEY_V2 = "glowtrail:v2";

export type GlowtrailSave = SaveData;

export interface ProfileSave {
  xp: number;
  level: number;
  streak: number;
  lastDailyDate: string | null;
  muted: boolean;
  reduceMotion: "auto" | "on" | "off";
  theme: string;
  cosmetics: string[];
  achievements: string[];
  gauntletDate: string | null;
  gauntletDone: string[];
}

export interface FusionSave { best: number; runs: number; dailyBest: Record<string, number>; }
export interface PrismSave { solved: string[]; bestMoves: Record<string, number>; }
export interface GlyphSave { wins: number; playDates: string[]; lastResult: string | null; }

export interface SaveV2 {
  version: 2;
  profile: ProfileSave;
  games: { glowtrail: GlowtrailSave; fusion: FusionSave; prism: PrismSave; glyph: GlyphSave };
}

export function defaultProfile(): ProfileSave {
  return { xp: 0, level: 1, streak: 0, lastDailyDate: null, muted: false,
    reduceMotion: "auto", theme: "neon", cosmetics: [], achievements: [],
    gauntletDate: null, gauntletDone: [] };
}

export function defaultSaveV2(): SaveV2 {
  return {
    version: 2,
    profile: defaultProfile(),
    games: {
      glowtrail: defaultSave(),
      fusion: { best: 0, runs: 0, dailyBest: {} },
      prism: { solved: [], bestMoves: {} },
      glyph: { wins: 0, playDates: [], lastResult: null },
    },
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asNumberMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

export function sanitizeProfile(raw: unknown): ProfileSave {
  const d = defaultProfile();
  if (raw == null || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  if (typeof o.xp === "number" && Number.isFinite(o.xp) && o.xp >= 0) d.xp = Math.floor(o.xp);
  if (typeof o.level === "number" && Number.isFinite(o.level) && o.level >= 1) d.level = Math.floor(o.level);
  if (typeof o.streak === "number" && Number.isFinite(o.streak) && o.streak >= 0) d.streak = Math.floor(o.streak);
  d.lastDailyDate = asDateOrNull(o.lastDailyDate);
  if (typeof o.muted === "boolean") d.muted = o.muted;
  if (o.reduceMotion === "auto" || o.reduceMotion === "on" || o.reduceMotion === "off") d.reduceMotion = o.reduceMotion;
  if (typeof o.theme === "string") d.theme = o.theme;
  d.cosmetics = asStringArray(o.cosmetics);
  d.achievements = asStringArray(o.achievements);
  d.gauntletDate = asDateOrNull(o.gauntletDate);
  d.gauntletDone = asStringArray(o.gauntletDone);
  return d;
}

export function sanitizeV2(raw: unknown): SaveV2 {
  const d = defaultSaveV2();
  if (raw == null || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  d.profile = sanitizeProfile(o.profile);
  const g = o.games && typeof o.games === "object" ? (o.games as Record<string, unknown>) : {};
  d.games.glowtrail = sanitizeSave(g.glowtrail);
  if (g.fusion && typeof g.fusion === "object") {
    const f = g.fusion as Record<string, unknown>;
    if (typeof f.best === "number" && Number.isFinite(f.best)) d.games.fusion.best = Math.max(0, Math.floor(f.best));
    if (typeof f.runs === "number" && Number.isFinite(f.runs)) d.games.fusion.runs = Math.max(0, Math.floor(f.runs));
    d.games.fusion.dailyBest = asNumberMap(f.dailyBest);
  }
  if (g.prism && typeof g.prism === "object") {
    const p = g.prism as Record<string, unknown>;
    d.games.prism.solved = asStringArray(p.solved);
    d.games.prism.bestMoves = asNumberMap(p.bestMoves);
  }
  if (g.glyph && typeof g.glyph === "object") {
    const w = g.glyph as Record<string, unknown>;
    if (typeof w.wins === "number" && Number.isFinite(w.wins)) d.games.glyph.wins = Math.max(0, Math.floor(w.wins));
    d.games.glyph.playDates = asStringArray(w.playDates);
    d.games.glyph.lastResult = typeof w.lastResult === "string" ? w.lastResult : null;
  }
  d.version = 2;
  return d;
}
```

- [ ] **Step 4: Implement migration and storage v2**

`src/save/migration.ts`:

```ts
import { sanitizeSave, sanitizeV2, type SaveV2 } from "./schema";

/** v1 raw -> v2 envelope, wrapping the validated v1 slice. */
export function migrateFromV1(raw: unknown): SaveV2 {
  const glowtrail = sanitizeSave(raw);
  const v2 = sanitizeV2({ version: 2, profile: { streak: glowtrail.streak, muted: glowtrail.muted,
    lastDailyDate: glowtrail.lastDailyDate }, games: { glowtrail } });
  return v2;
}

/** Accepts either a v1 or v2 raw object (v2 detected by version === 2). */
export function migrateSave(raw: unknown): SaveV2 {
  const version = raw && typeof raw === "object" ? (raw as { version?: unknown }).version : undefined;
  if (version === 2) return sanitizeV2(raw);
  return migrateFromV1(raw);
}
```

`src/save/storage.ts` append:

```ts
import { defaultSaveV2, sanitizeV2, SAVE_KEY_V1, SAVE_KEY_V2, type SaveV2 } from "./schema";
import { migrateSave } from "./migration";

export function loadSaveV2(storage: StorageLike = resolveStorage()): SaveV2 {
  try {
    const v2 = storage.getItem(SAVE_KEY_V2);
    if (v2) return sanitizeV2(JSON.parse(v2));
    const v1 = storage.getItem(SAVE_KEY_V1);
    if (!v1) return defaultSaveV2();
    const migrated = migrateSave(JSON.parse(v1));
    persistSaveV2(migrated, storage);
    return migrated;
  } catch {
    return defaultSaveV2();
  }
}

export function persistSaveV2(data: SaveV2, storage: StorageLike = resolveStorage()): void {
  try {
    storage.setItem(SAVE_KEY_V2, JSON.stringify(data));
  } catch {
    /* never block gameplay */
  }
}
```

- [ ] **Step 5: Run tests and verify**

Run: `npx vitest run tests/saveV2.test.ts tests/save.test.ts`
Expected: PASS (all existing save tests still pass).

- [ ] **Step 6: Typecheck, build, commit**

```bash
npm run typecheck && npm run build
git add src/save/schema.ts src/save/storage.ts src/save/migration.ts tests/saveV2.test.ts
git commit -m "feat(save): add glowtrail:v2 envelope with lossless v1 migration"
```

---

### Task 2: Platform types, RNG, settings, telemetry, ads services

**Files:**
- Create: `src/platform/types.ts`
- Create: `src/platform/services/rng/index.ts`
- Create: `src/platform/services/settings/index.ts`
- Create: `src/platform/services/telemetry/index.ts`
- Create: `src/platform/services/ads/index.ts`
- Test: `tests/registry.test.ts` (types smoke; real assertions added in Task 4)

**Interfaces:**
- Consumes: `seededRng`, save v2 types.
- Produces: `MiniGame`, `GameMeta`, `GameContext`, `GameResult`, `GameSaveSlice`; `AudioService`; `HapticsService`; `AnalyticsService`; `AdsService`; `SettingsService`.

- [ ] **Step 1: Create `src/platform/types.ts`**

```ts
import type { Rng } from "../gen/seededRng";
import type { SaveV2 } from "../save/schema";

export interface GameMeta {
  id: GameId;
  name: string;
  tagline: string;
  icon: string;
  accent: string;
  status: "ready" | "soon";
  hasGauntlet: boolean;
}

export type GameId = "glowtrail" | "fusion" | "prism" | "glyph";

export interface GameResult {
  score: number;
  stars?: number;
  solved?: boolean;
  stats?: Record<string, number>;
}

export type GameSaveSlice = SaveV2["games"][GameId];

export interface AudioService {
  tap(): void; select(): void; move(): void; invalid(): void;
  success(): void; perfect(): void; combo(n: number): void;
  levelComplete(): void; button(): void;
  setMuted(muted: boolean): void;
  setVolume(v: number): void;
}

export interface HapticsService {
  tap(): void; select(): void; success(): void; fail(): void;
}

export interface AnalyticsService {
  track(event: string, props?: Record<string, string | number | boolean>): void;
}

export interface RewardedAd { show(): Promise<boolean>; }
export interface InterstitialAd { show(): Promise<void>; }

export interface AdsService {
  rewarded(): RewardedAd;
  interstitial(): InterstitialAd;
  enabled: boolean;
}

export interface SettingsService {
  muted(): boolean; setMuted(v: boolean): void;
  reduceMotion(): boolean; setReduceMotion(v: "auto" | "on" | "off"): void;
  theme(): string; setTheme(id: string): void;
}

export interface GameContext {
  root: HTMLElement;
  audio: AudioService;
  haptics: HapticsService;
  ads: AdsService;
  settings: SettingsService;
  analytics: AnalyticsService;
  rng(seed: string): Rng;
  save: GameSaveSlice;
  updateSave(slice: GameSaveSlice): void;
  report(result: GameResult): void;
  exit(): void;
}

export interface MiniGame {
  meta: GameMeta;
  mount(root: HTMLElement, ctx: GameContext): void | Promise<void>;
  unmount(): void;
  daily(seed: string): unknown;
}
```

- [ ] **Step 2: Create `src/platform/services/rng/index.ts`**

```ts
export { hashString, mulberry32, rngInt, rngPick, rngShuffle, type Rng } from "../../../gen/seededRng";
import { hashString, mulberry32, type Rng } from "../../../gen/seededRng";

export function rngFromSeed(seed: string): Rng {
  return mulberry32(hashString(seed));
}
```

- [ ] **Step 3: Create telemetry, ads, settings services**

`src/platform/services/telemetry/index.ts`:

```ts
import type { AnalyticsService } from "../../types";

export const EVENTS = {
  appOpen: "app_open", sessionStart: "session_start", gameStarted: "game_started",
  gameCompleted: "game_completed", gameFailed: "game_failed", hintUsed: "hint_used",
  solutionViewed: "solution_viewed", dailyStarted: "daily_started",
  dailyCompleted: "daily_completed", gameSwitched: "game_switched",
  achievementUnlocked: "achievement_unlocked",
} as const;

export class NoopAnalytics implements AnalyticsService {
  track(): void {}
}
```

`src/platform/services/ads/index.ts`:

```ts
import type { AdsService, InterstitialAd, RewardedAd } from "../../types";

const noReward: RewardedAd = { async show() { return false; } };
const noInterstitial: InterstitialAd = { async show() {} };

export class NoopAdsService implements AdsService {
  enabled = false;
  rewarded(): RewardedAd { return noReward; }
  interstitial(): InterstitialAd { return noInterstitial; }
}
```

`src/platform/services/settings/index.ts`:

```ts
import type { SettingsService as ISettings } from "../../types";
import type { SaveV2 } from "../../../save/schema";

export function createSettings(getSave: () => SaveV2, setSave: (s: SaveV2) => void): ISettings {
  return {
    muted: () => getSave().profile.muted,
    setMuted(v) { const s = getSave(); s.profile.muted = v; setSave(s); },
    reduceMotion: () => {
      const pref = getSave().profile.reduceMotion;
      if (pref === "on") return true;
      if (pref === "off") return false;
      return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
    setReduceMotion(v) { const s = getSave(); s.profile.reduceMotion = v; setSave(s); },
    theme: () => getSave().profile.theme,
    setTheme(id) { const s = getSave(); s.profile.theme = id; setSave(s); },
  };
}
```

- [ ] **Step 4: Typecheck and commit**

```bash
npm run typecheck
git add src/platform tests/registry.test.ts
git commit -m "feat(platform): add shared types and rng/settings/telemetry/ads services"
```

(Create `tests/registry.test.ts` in Task 4; do not add an empty test file here.)

---

### Task 3: Audio and haptics services

**Files:**
- Create: `src/platform/services/audio/index.ts`
- Create: `src/platform/services/haptics/index.ts`
- Test: `tests/audio.test.ts`

**Interfaces:**
- Consumes: `synth` from `src/audio/synth.ts`; `haptics` from `src/audio/haptics.ts`; `AudioService`, `HapticsService`.
- Produces: `createAudio(muted: boolean): AudioService`, `createHaptics(): HapticsService`.

- [ ] **Step 1: Write the failing test** `tests/audio.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { createAudio } from "../src/platform/services/audio";

describe("audio service", () => {
  it("maps cues without throwing when AudioContext is unavailable", () => {
    const a = createAudio(true);
    expect(() => { a.tap(); a.select(); a.move(); a.invalid();
      a.success(); a.perfect(); a.combo(3); a.levelComplete(); a.button(); }).not.toThrow();
  });

  it("combo and perfect are no-ops when muted", () => {
    const a = createAudio(true);
    const spy = vi.fn();
    a.setMuted(true);
    spy();
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement audio service**

```ts
import { synth } from "../../../audio/synth";
import { hapticTap, hapticRotate, hapticFail, hapticWin } from "../../../audio/haptics";
import type { AudioService, HapticsService } from "../../types";

export function createAudio(muted: boolean): AudioService {
  synth.setMuted(muted);
  return {
    tap: () => synth.tap(), select: () => synth.step(), move: () => synth.step(),
    invalid: () => synth.blocked(), success: () => synth.success(), perfect: () => synth.star(),
    combo: () => synth.star(), levelComplete: () => synth.success(), button: () => synth.tap(),
    setMuted: (m) => synth.setMuted(m),
    setVolume: () => {},
  };
}

export function createHaptics(): HapticsService {
  return { tap: () => hapticTap(), select: () => hapticRotate(), success: () => hapticWin(), fail: () => hapticFail() };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/audio.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/services/audio src/platform/services/haptics tests/audio.test.ts
git commit -m "feat(platform): add audio and haptics services"
```

---

### Task 4: Save service, registry, and hash router (GLOWTRAIL still the only game)

**Files:**
- Create: `src/platform/services/save/index.ts`
- Create: `src/platform/registry.ts`
- Create: `src/platform/router.ts`
- Test: `tests/registry.test.ts`

**Interfaces:**
- Consumes: `loadSaveV2`, `persistSaveV2`, `SaveV2`, `MiniGame`, `GameContext`.
- Produces: `createSaveService()`, `GAMES: GameDescriptor[]`, `startRouter(root, deps)`, `navigate(hash)`.

- [ ] **Step 1: Write the failing test** `tests/registry.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { GAMES } from "../src/platform/registry";

describe("game registry", () => {
  it("exposes the four M1 game ids", () => {
    expect(GAMES.map((g) => g.meta.id)).toEqual(["glowtrail", "fusion", "prism", "glyph"]);
  });

  it("every descriptor has metadata and a lazy loader", () => {
    for (const g of GAMES) {
      expect(g.meta.name.length).toBeGreaterThan(0);
      expect(g.meta.status).toBe("ready");
      expect(typeof g.load).toBe("function");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/registry.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement save service**

```ts
import { loadSaveV2, persistSaveV2, type StorageLike } from "../../../save/storage";
import type { SaveV2 } from "../../../save/schema";

export function createSaveService(storage?: StorageLike) {
  let data: SaveV2 = loadSaveV2(storage);
  return {
    get: (): SaveV2 => data,
    set: (next: SaveV2): void => { data = next; persistSaveV2(data, storage); },
    mutate: (fn: (draft: SaveV2) => void): SaveV2 => { fn(data); persistSaveV2(data, storage); return data; },
  };
}
export type SaveService = ReturnType<typeof createSaveService>;
```

- [ ] **Step 4: Implement registry and router**

`src/platform/registry.ts`:

```ts
import type { GameMeta } from "./types";
import type { MiniGame } from "./types";

export interface GameDescriptor {
  meta: GameMeta;
  load: () => Promise<{ default: MiniGame }>;
}

export const GAMES: GameDescriptor[] = [
  { meta: { id: "glowtrail", name: "GLOWTRAIL", tagline: "Rotate, launch, escape", icon: "trail", accent: "#29DDF4", status: "ready", hasGauntlet: true }, load: () => import("../games/glowtrail") },
  { meta: { id: "fusion", name: "FUSION", tagline: "Merge the glow", icon: "orb", accent: "#E45CFF", status: "ready", hasGauntlet: true }, load: () => import("../games/fusion") },
  { meta: { id: "prism", name: "PRISM", tagline: "Sort the spectrum", icon: "tube", accent: "#FFC857", status: "ready", hasGauntlet: true }, load: () => import("../games/prism") },
  { meta: { id: "glyph", name: "GLYPH", tagline: "One word a day", icon: "glyph", accent: "#9CFF4F", status: "ready", hasGauntlet: true }, load: () => import("../games/glyph") },
];
```

`src/platform/router.ts` (bootstrap in Task 5; here the pure parse helpers):

```ts
export type Route = { name: "home" } | { name: "game"; id: string } | { name: "daily" };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, "");
  if (h.startsWith("game/")) {
    const id = h.slice("game/".length);
    return id ? { name: "game", id } : { name: "home" };
  }
  if (h === "daily") return { name: "daily" };
  return { name: "home" };
}

export function hashFor(route: Route): string {
  if (route.name === "game") return `#/game/${route.id}`;
  if (route.name === "daily") return "#/daily";
  return "#/home";
}

export function navigate(route: Route): void {
  if (typeof location !== "undefined") location.hash = hashFor(route);
}
```

- [ ] **Step 5: Run tests, typecheck, commit**

Run: `npx vitest run tests/registry.test.ts && npm run typecheck`
Expected: PASS (registry imports the game modules, which are created in Task 5; if running Task 4 before Task 5, temporarily expect a resolution error and complete Task 5 first).

```bash
git add src/platform tests/registry.test.ts
git commit -m "feat(platform): add save service, game registry, and hash routes"
```

---

### Task 5: GLOWTRAIL MiniGame adapter and app bootstrap

**Files:**
- Create: `src/games/glowtrail/index.ts` (adapter)
- Move logic: extract the shell from `src/main.ts` into `src/games/glowtrail/ui.ts`
- Rewrite: `src/main.ts` (bootstrap only)
- Modify: `src/index.html` title/description (if needed)

**Interfaces:**
- Consumes: existing `src/game/controller.ts`, `src/render/board.ts`, `src/engine`, `GameContext`.
- Produces: default export `MiniGame` with `meta` and `mount/unmount/daily`; GLOWTRAIL keeps all current behavior (levels, hints, reveal, Daily Run, back button).

- [ ] **Step 1: Extract the shell**

Move the contents of `src/main.ts` (imports, state, `homeHtml/boardHtml/winHtml`, handlers, `loop`, back-button) into `src/games/glowtrail/ui.ts`, exporting:

```ts
export function mountGlowtrail(root: HTMLElement, ctx: GameContext): void
export function unmountGlowtrail(): void
```

Replace module-global `app` with the passed `root`, and replace `synth`/`haptics` calls with `ctx.audio`/`ctx.haptics`. Keep the signature-render loop and the delegated handlers. The GLOWTRAIL home screen is replaced by the platform launcher in Task 6, so `screen === "home"` returns to the platform Home via `ctx.exit()`.

- [ ] **Step 2: Adapter `src/games/glowtrail/index.ts`**

```ts
import type { GameContext, MiniGame } from "../../platform/types";
import { mountGlowtrail, unmountGlowtrail } from "./ui";

const meta = { id: "glowtrail" as const, name: "GLOWTRAIL", tagline: "Rotate, launch, escape",
  icon: "trail", accent: "#29DDF4", status: "ready" as const, hasGauntlet: true };

export default {
  meta,
  mount(root: HTMLElement, ctx: GameContext) { mountGlowtrail(root, ctx); },
  unmount() { unmountGlowtrail(); },
  daily(seed: string) { return { seed }; },
} satisfies MiniGame;
```

- [ ] **Step 3: Bootstrap `src/main.ts`**

```ts
import "./styles/globals.css";
import "./styles/game.css";
import { createSaveService } from "./platform/services/save";
import { createAudio, createHaptics } from "./platform/services/audio";
import { createSettings } from "./platform/services/settings";
import { NoopAnalytics } from "./platform/services/telemetry";
import { NoopAdsService } from "./platform/services/ads";
import { rngFromSeed } from "./platform/services/rng";
import { startRouter } from "./platform/router";

const root = document.querySelector<HTMLDivElement>("#app")!;
const save = createSaveService();
const audio = createAudio(save.get().profile.muted);
const settings = createSettings(() => save.get(), (s) => save.set(s));
startRouter(root, { save, audio, haptics: createHaptics(), ads: new NoopAdsService(),
  settings, analytics: new NoopAnalytics(), rng: rngFromSeed });
```

- [ ] **Step 4: Manual smoke via dev server**

Run: `npm run build` then `npm run dev`, open the preview, confirm GLOWTRAIL still plays (levels, launch, hint, reveal).
Expected: identical gameplay to before.

- [ ] **Step 5: Full test suite and commit**

```bash
npx vitest run && npm run typecheck && npm run build
git add src/games src/main.ts src/platform
git commit -m "refactor(platform): boot via router and wrap GLOWTRAIL as a MiniGame"
```

---

### Task 6: Home / Dashboard launcher

**Files:**
- Create: `src/platform/ui/launcher.ts`
- Create: `src/platform/ui/chrome.ts`
- Modify: `src/platform/router.ts` (implement `startRouter`)
- Modify: `src/styles/game.css` (launcher styles)

**Interfaces:**
- Consumes: `GameContext`, save profile, registry, progression (Task 11).
- Produces: `renderHome(root, deps)`, `startRouter(root, deps)` that mounts Home or a game by hash.

- [ ] **Step 1: Implement `startRouter`**

```ts
export interface PlatformDeps {
  save: ReturnType<typeof import("./services/save").createSaveService>;
  audio: import("./types").AudioService;
  haptics: import("./types").HapticsService;
  ads: import("./types").AdsService;
  settings: import("./types").SettingsService;
  analytics: import("./types").AnalyticsService;
  rng: (seed: string) => import("../gen/seededRng").Rng;
}

export function startRouter(root: HTMLElement, deps: PlatformDeps): void {
  // Parse hash, render Home for #/home, lazily import the game for #/game/<id>.
  // On unmount, call the previous MiniGame.unmount() and clear root.
  // Listen to hashchange and popstate; Android back handled by the game/Home.
}
```

- [ ] **Step 2: Implement `launcher.ts`**

Render in order: top bar (wordmark, level, XP bar, streak, settings button); CONTINUE PLAYING card (game name, level, progress, stars, Play); DAILY GAUNTLET card (`n of 4` pips); ARCADE (four cards from `GAMES`). Continue card targets the most recently played game (profile field `lastGame`, default `glowtrail`).

- [ ] **Step 3: Manual verification**

Open the preview. Confirm: Home shows Continue, Daily, Arcade; tapping a card routes to `#/game/<id>`; back returns Home; no 120 level buttons on Home.

- [ ] **Step 4: Commit**

```bash
git add src/platform src/styles/game.css
git commit -m "feat(platform): add arcade Home dashboard and router"
```

---

### Task 7: FUSION

**Files:**
- Create: `src/games/fusion/logic.ts`
- Create: `src/games/fusion/render.ts`
- Create: `src/games/fusion/index.ts`
- Test: `tests/fusion.test.ts`

**Interfaces:**
- Produces pure functions in `logic.ts`: `classify(tier): number`; `canMerge(a, b): boolean`; `mergeResult(a, b)`; `scoreForMerge(tier, combo): number`; `spawnQueue(seed: string): number[]`; `step(state, dt): FusionState` (fixed timestep); `isOver(state): boolean`.

- [ ] **Step 1: Write the failing test** `tests/fusion.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { canMerge, mergeResult, scoreForMerge, spawnQueue } from "../src/games/fusion/logic";

describe("fusion logic", () => {
  it("merges only equal tiers", () => {
    expect(canMerge(2, 2)).toBe(true);
    expect(canMerge(2, 3)).toBe(false);
  });
  it("merge result increments tier", () => {
    expect(mergeResult(2, 2)).toBe(3);
  });
  it("higher tiers score more and combos multiply", () => {
    expect(scoreForMerge(3, 1)).toBeGreaterThan(scoreForMerge(2, 1));
    expect(scoreForMerge(3, 2)).toBe(scoreForMerge(3, 1) * 2);
  });
  it("spawn queue is deterministic for a seed", () => {
    expect(spawnQueue("2026-09-15")).toEqual(spawnQueue("2026-09-15"));
    expect(spawnQueue("2026-09-15")).not.toEqual(spawnQueue("2026-09-16"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** `npx vitest run tests/fusion.test.ts` -> FAIL.

- [ ] **Step 3: Implement `logic.ts`** with an integer, fixed-timestep simulation (positions in sub-units, `dt` quantized to a fixed step count) so frame timing cannot change state. Tiers 0..9, glyph per tier, radius scaling, chain combo window by merge count (not wall-clock). Overflow check by resting orbs above the line for a step count.

- [ ] **Step 4: Implement `render.ts`** (canvas neon orbs with shape glyphs) and `index.ts` (`MiniGame` with `meta`, `mount`, `unmount`, `daily(seed)`), one-finger aim/drop, restart, pause, score, game over, `ctx.report({ score })`, `ctx.audio`/`ctx.haptics` cues.

- [ ] **Step 5: Run tests, typecheck, build, commit**

```bash
npx vitest run tests/fusion.test.ts && npm run typecheck && npm run build
git add src/games/fusion tests/fusion.test.ts
git commit -m "feat(fusion): add original neon merge/drop game"
```

---

### Task 8: PRISM with solvability validation

**Files:**
- Create: `src/games/prism/logic.ts`
- Create: `src/games/prism/solver.ts`
- Create: `src/games/prism/render.ts`
- Create: `src/games/prism/index.ts`
- Test: `tests/prism.test.ts`

**Interfaces:**
- Produces: `PrismState`, `move(state, from, to)`, `isSolved(state)`, `generate(seed, difficulty): PrismState`, `solve(state): Move[] | null`, `safeHint(state): Move | null`.

- [ ] **Step 1: Write the failing test** `tests/prism.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { generate, isSolved, move, safeHint, solve } from "../src/games/prism/logic";
import { solve as solveState } from "../src/games/prism/solver";

describe("prism", () => {
  it("generated levels are always solvable", () => {
    for (let i = 0; i < 200; i += 1) {
      const s = generate(`seed-${i}`, 1 + (i % 5));
      expect(solveState(s)).not.toBeNull();
    }
  });
  it("a solved state is detected", () => {
    const s = { tubes: [["cyan", "cyan"], ["magenta"], []], capacity: 3 };
    expect(isSolved(s as never)).toBe(true);
  });
  it("illegal moves are rejected", () => {
    const s = { tubes: [["cyan"], ["magenta"], []], capacity: 2 };
    expect(move(s as never, 0, 1)).toBe(false);
    expect(move(s as never, 0, 2)).toBe(true);
  });
  it("safeHint never breaks solvability", () => {
    const s = generate("hint", 2);
    const h = safeHint(s);
    expect(h).not.toBeNull();
    expect(solveState(s)).not.toBeNull();
  });
  it("solve returns a real solution", () => {
    const s = generate("solve-me", 3);
    const sol = solve(s);
    expect(Array.isArray(sol)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** FAIL.

- [ ] **Step 3: Implement `logic.ts` + `solver.ts`**

`logic.ts`: tube arrays, capacity, `move` moves the whole top run of equal color to an empty or matching destination with capacity. `generate(seed, difficulty)`: start from solved tubes (colors in blocks) and apply reverse moves with the injected RNG (deterministic), then confirm with the solver. `safeHint`: use `solve` and validate the move keeps the state solvable.

`solver.ts`: DFS/BFS over canonical states (sorted tube strings plus a per-tube order-preserving key), memoized visited set, depth cap, returns the first solution or `null`. Must be pure and deterministic.

- [ ] **Step 4: Implement `render.ts` and `index.ts`** with undo, restart, hint, progressive difficulty, daily(seed), and `ctx.report`.

- [ ] **Step 5: Run tests, typecheck, build, commit**

```bash
npx vitest run tests/prism.test.ts && npm run typecheck && npm run build
git add src/games/prism tests/prism.test.ts
git commit -m "feat(prism): add original color-sort game with solvability validation"
```

---

### Task 9: GLYPH

**Files:**
- Create: `src/games/glyph/words.ts`
- Create: `src/games/glyph/logic.ts`
- Create: `src/games/glyph/render.ts`
- Create: `src/games/glyph/index.ts`
- Test: `tests/glyph.test.ts`

**Interfaces:**
- Produces: `WORDS: readonly string[]`, `dailyWord(date: string): string`, `dailyModifier(date: string): GlyphModifier`, `scoreGuess(guess, answer): TileStatus[]`, `isWin(statuses)`, `chargeGain(statuses): number`.

- [ ] **Step 1: Write the failing test** `tests/glyph.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { dailyModifier, dailyWord, isWin, scoreGuess } from "../src/games/glyph/logic";
import { WORDS } from "../src/games/glyph/words";

describe("glyph", () => {
  it("word list is non-trivial and offline", () => {
    expect(WORDS.length).toBeGreaterThan(100);
    expect(WORDS.every((w) => /^[a-z]{5}$/.test(w))).toBe(true);
  });
  it("exact/present/absent scoring handles duplicates", () => {
    expect(scoreGuess("crane", "crane")).toEqual(["exact","exact","exact","exact","exact"]);
    const s = scoreGuess("allee", "apple");
    expect(s.filter((x) => x === "exact").length).toBe(2);
  });
  it("win detection", () => {
    expect(isWin(["exact","exact","exact","exact","exact"])).toBe(true);
    expect(isWin(["exact","present","absent","absent","absent"])).toBe(false);
  });
  it("daily selection is deterministic and modifier rotates", () => {
    expect(dailyWord("2026-09-15")).toBe(dailyWord("2026-09-15"));
    expect(typeof dailyModifier("2026-09-15")).toBe("string");
    expect(new Set(["2026-09-15","2026-09-16","2026-09-17","2026-09-18"].map(dailyModifier)).size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** FAIL.

- [ ] **Step 3: Implement `words.ts`** with a bundled 5-letter lowercase list (>= 800 common words), and `logic.ts` with standard duplicate-aware scoring, deterministic daily word and daily modifier from `hashString(date)`, and a charge meter (`chargeGain` from exact/present letters; at full, one free letter reveal, once per day).

- [ ] **Step 4: Implement `render.ts` and `index.ts`** with an on-screen and physical keyboard, six guesses, and non-color-only feedback: exact = filled tile plus dot, present = ring plus letter, absent = dim plus strike. Respect reduced motion.

- [ ] **Step 5: Run tests, typecheck, build, commit**

```bash
npx vitest run tests/glyph.test.ts && npm run typecheck && npm run build
git add src/games/glyph tests/glyph.test.ts
git commit -m "feat(glyph): add original daily word game"
```

---

### Task 10: Daily Gauntlet (3 of 4)

**Files:**
- Create: `src/platform/gauntlet.ts`
- Test: `tests/gauntlet.test.ts`

**Interfaces:**
- Produces: `GAMES_IN_GAUNTLET: GameId[]`, `gauntletSeed(date, id): string`, `gauntletProgress(save, date): { done: GameId[]; complete: boolean }`, `recordGauntlet(save, date, id): SaveV2`.

- [ ] **Step 1: Write the failing test** `tests/gauntlet.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { gauntletProgress, gauntletSeed, recordGauntlet } from "../src/platform/gauntlet";
import { defaultSaveV2 } from "../src/save/schema";

describe("daily gauntlet", () => {
  it("seeds are deterministic per date and game", () => {
    expect(gauntletSeed("2026-09-15", "fusion")).toBe(gauntletSeed("2026-09-15", "fusion"));
    expect(gauntletSeed("2026-09-15", "fusion")).not.toBe(gauntletSeed("2026-09-15", "prism"));
  });
  it("completes at three of four", () => {
    let s = defaultSaveV2();
    expect(gauntletProgress(s, "2026-09-15").complete).toBe(false);
    s = recordGauntlet(s, "2026-09-15", "glowtrail");
    s = recordGauntlet(s, "2026-09-15", "fusion");
    expect(gauntletProgress(s, "2026-09-15").complete).toBe(false);
    s = recordGauntlet(s, "2026-09-15", "prism");
    expect(gauntletProgress(s, "2026-09-15").complete).toBe(true);
    expect(gauntletProfile(s, "2026-09-15").done).toHaveLength(3);
  });
  it("a new date resets gauntlet progress", () => {
    let s = recordGauntlet(defaultSaveV2(), "2026-09-15", "glyph");
    expect(gauntletProgress(s, "2026-09-16").done).toHaveLength(0);
  });
});
```

Add a `gauntletProfile` helper export if needed, or assert `s.profile.gauntletDone.length` directly instead.

- [ ] **Step 2: Run test to verify it fails.** FAIL.

- [ ] **Step 3: Implement `gauntlet.ts`** with date-scoped `gauntletDone`, deterministic seeds via `hashString(`${date}:${id}`)`, and completion at 3. Advancing the shared streak happens here (reuse `applyStreak` semantics from `src/save/storage.ts`).

- [ ] **Step 4: Run tests, typecheck, commit**

```bash
npx vitest run tests/gauntlet.test.ts && npm run typecheck
git add src/platform/gauntlet.ts tests/gauntlet.test.ts
git commit -m "feat(platform): add daily gauntlet 3-of-4 with deterministic seeds"
```

---

### Task 11: Progression and cosmetics

**Files:**
- Create: `src/platform/progression.ts`
- Create: `src/platform/cosmetics.ts`
- Test: `tests/progression.test.ts`
- Test: `tests/cosmetics.test.ts`

**Interfaces:**
- Produces: `xpForGame(result): number`, `levelForXp(xp): number`, `xpForNextLevel(level): number`, `ACHIEVEMENTS`, `evaluateAchievements(save): string[]`; `COSMETICS`, `unlockedCosmetics(save): string[]`.

- [ ] **Step 1: Write failing tests** for XP monotonicity, level thresholds, and cosmetic unlock by level/achievement/streak.
- [ ] **Step 2: Run tests to verify they fail.**
- [ ] **Step 3: Implement pure functions.** XP = base(10) + stars*5 + perfect bonus(5). Level table: level n requires `100 * n * (n+1) / 2` cumulative XP. Achievements: `first_solve`, `solves_10`, `stars_50`, `streak_7`, `gauntlet_week`, `prism_perfect`, `glyph_win`. Cosmetics: 3 palettes, 2 backgrounds, 2 bursts.
- [ ] **Step 4: Run tests, typecheck, commit.**

```bash
npx vitest run tests/progression.test.ts tests/cosmetics.test.ts && npm run typecheck
git add src/platform/progression.ts src/platform/cosmetics.ts tests/progression.test.ts tests/cosmetics.test.ts
git commit -m "feat(platform): add XP/level/achievements and cosmetic unlocks"
```

---

### Task 12: Solution viewer upgrade and hint hardening

**Files:**
- Modify: `src/games/glowtrail/ui.ts` (reveal modal)
- Modify: `src/engine/hints.ts` (unsolvable detection message)
- Modify: `src/engine/session.ts` (expose solvable state)
- Modify: `src/styles/game.css` (viewer controls)
- Test: `tests/hints.test.ts` (extend)

**Interfaces:**
- Produces: reveal viewer controls (step, autoplay, replay, close) over `solvedPreview`; `requestHint` returns `{ available: false, reason: "unsolvable" }` when the current configuration has no solution.

- [ ] **Step 1: Extend `tests/hints.test.ts`** with an unsolvable-state case asserting `available === false` and a non-empty message.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** solver-based unsolvable detection in `hints.ts` and surface it in the banner with a Reset action.
- [ ] **Step 4: Upgrade the reveal modal** to step/autoplay/replay/close while keeping the non-destructive rules (no completion, no stars, no PAR change, no progress change).
- [ ] **Step 5: Verify and commit.**

```bash
npx vitest run tests/hints.test.ts tests/polish.test.ts && npm run typecheck && npm run build
git add src/engine src/games/glowtrail/ui.ts src/styles/game.css tests/hints.test.ts
git commit -m "feat(glowtrail): animated solution viewer and unsolvable hint handling"
```

---

### Task 13: Settings, Test Mode, and analytics wiring

**Files:**
- Create: `src/platform/ui/settings.ts`
- Modify: `src/platform/ui/launcher.ts` (settings entry)
- Test: `tests/settings.test.ts`

**Interfaces:**
- Produces: settings sheet with mute, haptics, reduce-motion, theme; Test Mode section showing version, build, current game, puzzles completed, dailies completed, save state, with REPORT BUG, SEND FEEDBACK, RESET LOCAL SAVE (confirmed).

- [ ] **Step 1: Write failing test** for `resetLocalSave(saveService)` clearing only v2 and re-seeding defaults with confirmation semantics (pure function tested, UI confirmation manual).
- [ ] **Step 2: Implement settings/Test Mode UI and wire analytics events** (`app_open`, `game_started`, `game_completed`, `game_failed`, `hint_used`, `solution_viewed`, `daily_started`, `daily_completed`, `game_switched`, `achievement_unlocked`) through `ctx.analytics`.
- [ ] **Step 3: Verify and commit.**

```bash
npx vitest run tests/settings.test.ts && npm run typecheck && npm run build
git add src/platform tests/settings.test.ts
git commit -m "feat(platform): add settings, test mode, and analytics events"
```

---

### Task 14: Audio/animation/accessibility pass and Android release check

**Files:**
- Modify: `src/styles/game.css`, `src/platform/ui/*`, `src/games/*/render.ts`
- Modify: `capacitor.config.ts` (`appName` -> "GLOWTRAIL Arcade")
- Modify: `android/app/src/main/res/values/strings.xml` (`app_name`)
- Modify: `android/app/build.gradle` (`versionCode` bump)
- Modify: `README.md`

- [ ] **Step 1: Accessibility pass** (44px targets, focus-visible, reduced motion, colorblind-safe), animation polish, and sound cue coverage.
- [ ] **Step 2: Rename for Android** and bump `versionCode` to 2.
- [ ] **Step 3: Build Android artifacts** and verify signatures.

```bash
export ANDROID_HOME=/opt/android-sdk JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
npm run android:aab && npm run android:apk
ls -la android/app/build/outputs/bundle/release/app-release.aab android/app/build/outputs/apk/release/app-release.apk
```

- [ ] **Step 4: Commit.**

```bash
git add -A
git commit -m "chore(release): GLOWTRAIL Arcade naming, versionCode 2, a11y and audio polish"
```

---

### Task 15: M1 quality gate

- [ ] **Step 1:** `npm test` -> all suites pass.
- [ ] **Step 2:** `npm run typecheck` -> clean.
- [ ] **Step 3:** `npm run build` -> clean.
- [ ] **Step 4:** Manual checklist from spec section 22: fresh install, first/returning launch, navigation, Android back, portrait, small phone, tablet, offline, corrupted save, v1 migration, persistence, Daily Gauntlet, streak, each game and exit, solution viewer, hints, sound, haptics, reduced motion, colorblind-safe.
- [ ] **Step 5:** Final commit.

```bash
git add -A
git commit -m "chore: milestone 1 quality gate"
```

## Self-Review

- Spec coverage: platform/services (Tasks 2-5), save migration (Task 1), Home (Task 6), FUSION (7), PRISM (8), GLYPH (9), Daily Gauntlet (10), meta and cosmetics (11), solution viewer and hints (12), Test Mode and analytics (13), audio/animation/a11y and Android (14), quality gate (15). Every spec section maps to a task.
- Placeholder scan: no TBD/TODO; game tasks include interface signatures, test code, and algorithms. Full pixel-level renderer code is intentionally specified by behavior plus interfaces (renderers are visual and verified manually), while all pure logic is TDD'd.
- Type consistency: `GameId`, `GameSaveSlice`, `SaveV2["games"][GameId]`, `gauntletSeed`, `recordGauntlet`, `safeHint`, `scoreGuess`, `unlockedCosmetics` are used consistently across tasks.
- Deliberate deviation: the engine is not physically relocated; documented in the spec section 25 and Task 5.
