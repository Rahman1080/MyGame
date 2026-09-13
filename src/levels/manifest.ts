/**
 * Frozen content fingerprints for the v1 story campaign.
 *
 * Each entry is `puzzleDigest(getLevel(level))` for levels 1..80 under
 * GENERATOR_VERSION "v1". If a generator change alters any level, the
 * `tests/stability.test.ts` guard fails, forcing an explicit version bump
 * instead of silently mutating published levels.
 *
 * Level *ids* (`pulse-1`, `surge-21`, ...) are the save keys and stay stable,
 * so player progress is preserved across generator versions.
 */
export const STORY_MANIFEST_VERSION = "v1" as const;

export const STORY_MANIFEST_V1: readonly string[] = [
  "e64652c9", "576f1841", "be07c0e3", "85ced390", "d62eac7a", "74d99bf0", "afc9c90a", "cc354e23",
  "b20755b3", "65976f4b", "4e99bb70", "c71e62aa", "ffb7b19a", "f3e0ff5b", "8fb3154d", "06215acd",
  "2b683161", "9386278d", "da09b61b", "74a97f87", "c657f182", "7e4c9b92", "36042f92", "39fe0750",
  "8ec70404", "66aee751", "a5032b8f", "5b27bced", "d8fef830", "5565c66f", "e43655fa", "bf244fee",
  "3082981d", "754adf9b", "570e4387", "a032e502", "0e414132", "b0f31d06", "5367cbba", "24a33c55",
  "9c8b6832", "3a3dc918", "00caeeb4", "fe50b84a", "fd8b745f", "8dcf1406", "fd401620", "70b913a5",
  "f4d94ded", "1bef59ad", "f2cce564", "d8b83dee", "7b42481c", "f36f6144", "392d736b", "f9aa9a60",
  "ab05c720", "46807bcc", "ad3e0d52", "5e254f2f", "ae74d98e", "bf2c992a", "97dc49b6", "20d5b601",
  "096ade9c", "caa7c46e", "03a7ff5f", "808346b7", "cfec8324", "d2052d1d", "bd5035b7", "1812d25c",
  "9356618b", "b822e71a", "5972bf0e", "ac1b7aab", "e60e9179", "a5f6e8a9", "f2cb10c2", "64b19f72",
];
