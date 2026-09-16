import type { Rng } from "../gen/seededRng";
import type { SaveV2 } from "../save/schema";

export type GameId = "glowtrail" | "fusion" | "prism" | "glyph" | "blocks" | "arrows" | "snake" | "breaker" | "matrix" | "wordsearch";

/** Union of the six per-game save slices. */
export type AnyGameSave = SaveV2["games"][GameId];

export interface GameMeta {
  id: GameId;
  name: string;
  tagline: string;
  icon: string;
  accent: string;
  status: "ready" | "soon";
  hasGauntlet: boolean;
}

export interface GameResult {
  score: number;
  stars?: number;
  solved?: boolean;
  stats?: Record<string, number>;
}

export interface AudioService {
  tap(): void;
  select(): void;
  move(): void;
  invalid(): void;
  success(): void;
  perfect(): void;
  combo(n: number): void;
  levelComplete(): void;
  button(): void;
  setMuted(muted: boolean): void;
  setVolume(v: number): void;
}

export interface HapticsService {
  tap(): void;
  select(): void;
  success(): void;
  fail(): void;
}

export interface AnalyticsService {
  track(event: string, props?: Record<string, string | number | boolean>): void;
}

export interface RewardedAd {
  show(): Promise<boolean>;
}

export interface InterstitialAd {
  show(): Promise<void>;
}

export interface AdsService {
  enabled: boolean;
  rewarded(): RewardedAd;
  interstitial(): InterstitialAd;
}

export interface SettingsService {
  muted(): boolean;
  setMuted(v: boolean): void;
  reduceMotion(): boolean;
  setReduceMotion(v: "auto" | "on" | "off"): void;
  theme(): string;
  setTheme(id: string): void;
}

export interface GameContext<S = AnyGameSave> {
  root: HTMLElement;
  audio: AudioService;
  haptics: HapticsService;
  ads: AdsService;
  settings: SettingsService;
  analytics: AnalyticsService;
  rng(seed: string): Rng;
  save: S;
  updateSave(slice: S): void;
  report(result: GameResult): void;
  exit(): void;
}

export interface MiniGame<S = AnyGameSave> {
  meta: GameMeta;
  mount(root: HTMLElement, ctx: GameContext<S>): void | Promise<void>;
  unmount(): void;
  daily(seed: string): unknown;
}
