import type { SaveV2 } from "../../../save/schema";
import { loadSaveV2, persistSaveV2, type StorageLike } from "../../../save/storage";

/**
 * Owns the single in-memory v2 save and persists on every change.
 * Games receive only their slice through GameContext, never this service.
 */
export function createSaveService(storage?: StorageLike) {
  let data: SaveV2 = loadSaveV2(storage);
  return {
    get: (): SaveV2 => data,
    set: (next: SaveV2): void => {
      data = next;
      persistSaveV2(data, storage);
    },
    /** Mutate in place and persist. Returns the same reference. */
    mutate: (fn: (draft: SaveV2) => void): SaveV2 => {
      fn(data);
      persistSaveV2(data, storage);
      return data;
    },
  };
}

export type SaveService = ReturnType<typeof createSaveService>;
