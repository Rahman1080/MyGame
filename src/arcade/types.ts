export type GameId = "glowtrail" | "snake" | "breaker" | "matrix";

export interface ArcadeGameMeta {
  id: GameId;
  title: string;
  tagline: string;
  badge: string;
  accentColor: string;
  glowColor: string;
  iconSvg: string;
  controls: string;
  description: string;
}

export interface ArcadeStats {
  totalStars: number;
  dayStreak: number;
  highScores: Record<string, number>;
}
