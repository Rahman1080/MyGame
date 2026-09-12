export interface DifficultyProfile {
  size: number;
  minPath: number;
  maxPath: number;
  lockChance: number;
  emptyBias: number;
  scrambleMin: number;
  scrambleMax: number;
  gates: boolean;
  decoyChance: number;
}

export function profileForLevel(level: number): DifficultyProfile {
  if (level <= 3) {
    return { size: 3, minPath: 4, maxPath: 6, lockChance: 0, emptyBias: 0.22, scrambleMin: 1, scrambleMax: 2, gates: false, decoyChance: 0 };
  }
  if (level <= 10) {
    return { size: 3, minPath: 5, maxPath: 7, lockChance: 0.1, emptyBias: 0.18, scrambleMin: 2, scrambleMax: 4, gates: false, decoyChance: 0.04 };
  }
  if (level <= 20) {
    return { size: 4, minPath: 9, maxPath: 13, lockChance: 0.15, emptyBias: 0.16, scrambleMin: 3, scrambleMax: 6, gates: false, decoyChance: 0.06 };
  }
  if (level <= 30) {
    return { size: 4, minPath: 11, maxPath: 14, lockChance: 0.2, emptyBias: 0.12, scrambleMin: 4, scrambleMax: 8, gates: false, decoyChance: 0.08 };
  }
  if (level <= 40) {
    return { size: 5, minPath: 14, maxPath: 20, lockChance: 0.22, emptyBias: 0.12, scrambleMin: 5, scrambleMax: 10, gates: false, decoyChance: 0.08 };
  }
  if (level <= 50) {
    return { size: 5, minPath: 16, maxPath: 22, lockChance: 0.2, emptyBias: 0.1, scrambleMin: 5, scrambleMax: 11, gates: true, decoyChance: 0.06 };
  }
  return { size: 6, minPath: 20, maxPath: 30, lockChance: 0.25, emptyBias: 0.1, scrambleMin: 6, scrambleMax: 14, gates: true, decoyChance: 0.08 };
}

export function dailyProfile(index: number): DifficultyProfile {
  const table: DifficultyProfile[] = [
    { size: 3, minPath: 5, maxPath: 7, lockChance: 0, emptyBias: 0.18, scrambleMin: 2, scrambleMax: 3, gates: false, decoyChance: 0 },
    { size: 4, minPath: 9, maxPath: 12, lockChance: 0.1, emptyBias: 0.16, scrambleMin: 3, scrambleMax: 5, gates: false, decoyChance: 0.05 },
    { size: 4, minPath: 11, maxPath: 14, lockChance: 0.18, emptyBias: 0.12, scrambleMin: 4, scrambleMax: 7, gates: false, decoyChance: 0.06 },
    { size: 5, minPath: 15, maxPath: 20, lockChance: 0.22, emptyBias: 0.12, scrambleMin: 5, scrambleMax: 9, gates: false, decoyChance: 0.08 },
    { size: 5, minPath: 17, maxPath: 22, lockChance: 0.25, emptyBias: 0.1, scrambleMin: 6, scrambleMax: 12, gates: true, decoyChance: 0.08 },
  ];
  return table[index] ?? table[4]!;
}

export function scoreDifficulty(size: number, pathLen: number, par: number, locks: number): number {
  return size * 10 + pathLen + par + locks * 2;
}
