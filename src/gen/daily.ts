import type { Puzzle } from "../engine/types";
import { generatePuzzle } from "./generator";
import { dailyProfile } from "./difficulty";
import { dailySeed, GENERATOR_VERSION } from "./identity";

export function localYmd(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daySeed(ymd: string, version: string = GENERATOR_VERSION): number {
  return dailySeed(ymd, version);
}

export function generateDailyRun(ymd: string, version: string = GENERATOR_VERSION): Puzzle[] {
  const base = daySeed(ymd, version);
  return [1, 2, 3, 4, 5].map((i) =>
    generatePuzzle((base + i) >>> 0, {
      id: `daily-${version}-${ymd}-${i}`,
      pack: "daily",
      profile: dailyProfile(i - 1),
    }),
  );
}

export function previousYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d);
  dt.setDate(dt.getDate() - 1);
  return localYmd(dt);
}

export function daysBetween(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  const da = Date.UTC(pa[0]!, (pa[1] ?? 1) - 1, pa[2]);
  const db = Date.UTC(pb[0]!, (pb[1] ?? 1) - 1, pb[2]);
  return Math.round((db - da) / 86400000);
}
