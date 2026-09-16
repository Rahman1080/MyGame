export function dailySeed(date: string, game: string): string {
  return `daily:${game}:${date}`;
}
