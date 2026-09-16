import { sanitizeSave, sanitizeV2, SAVE_VERSION_V2, type SaveV2 } from "./schema";

/** v1 raw -> v2 envelope, wrapping the validated v1 slice without mutation. */
export function migrateFromV1(raw: unknown): SaveV2 {
  const glowtrail = sanitizeSave(raw);
  return sanitizeV2({
    version: SAVE_VERSION_V2,
    profile: {
      streak: glowtrail.streak,
      muted: glowtrail.muted,
      lastDailyDate: glowtrail.lastDailyDate,
    },
    games: { glowtrail },
  });
}

/** Accepts either a v1 or v2 raw object (v2 detected by version === 2). */
export function migrateSave(raw: unknown): SaveV2 {
  const version = raw && typeof raw === "object" ? (raw as { version?: unknown }).version : undefined;
  if (version === SAVE_VERSION_V2) return sanitizeV2(raw);
  return migrateFromV1(raw);
}
