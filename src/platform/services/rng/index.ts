import { hashString, mulberry32, type Rng } from "../../../gen/seededRng";

export { hashString, mulberry32, rngInt, rngPick, rngShuffle, type Rng } from "../../../gen/seededRng";

/** Deterministic RNG for a string seed (dates, game ids, level ids). */
export function rngFromSeed(seed: string): Rng {
  return mulberry32(hashString(seed));
}
