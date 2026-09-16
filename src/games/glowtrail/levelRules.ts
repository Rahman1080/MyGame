import { TIER_LABELS, formatClock, isTimedLevel, timeLeftMs, tierForLevel, timeLimitMs, type Tier } from "../../platform/levels";
import { TOTAL_LEVELS } from "../../levels/packs";

export const GLOWTRAIL_TIME_SCALE = 2;

export function glowtrailTier(level: number): Tier {
  return tierForLevel(level, TOTAL_LEVELS);
}

export function glowtrailTierLabel(level: number): string {
  return TIER_LABELS[glowtrailTier(level)];
}

export function glowtrailTimed(level: number): boolean {
  return isTimedLevel(level, TOTAL_LEVELS);
}

export function glowtrailTimeLimitMs(level: number): number {
  const base = timeLimitMs(level, TOTAL_LEVELS);
  return base > 0 ? base * GLOWTRAIL_TIME_SCALE : 0;
}

export function glowtrailTimeLeftMs(limitMs: number, elapsedMs: number): number {
  return timeLeftMs(limitMs, elapsedMs);
}

export function glowtrailClock(ms: number): string {
  return formatClock(ms);
}
