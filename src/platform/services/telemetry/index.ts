import type { AnalyticsService } from "../../types";

export const EVENTS = {
  appOpen: "app_open",
  sessionStart: "session_start",
  gameStarted: "game_started",
  gameCompleted: "game_completed",
  gameFailed: "game_failed",
  hintUsed: "hint_used",
  solutionViewed: "solution_viewed",
  dailyStarted: "daily_started",
  dailyCompleted: "daily_completed",
  gameSwitched: "game_switched",
  achievementUnlocked: "achievement_unlocked",
} as const;

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];

/** Default no-op analytics. Core gameplay must work with analytics disabled. */
export class NoopAnalytics implements AnalyticsService {
  track(): void {
    /* analytics disabled in M1 */
  }
}
