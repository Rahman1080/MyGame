import { sanitizeSave, type SaveData } from "./schema";

export function migrateSave(raw: unknown): SaveData {
  return sanitizeSave(raw);
}
