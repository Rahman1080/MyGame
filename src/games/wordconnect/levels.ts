export interface WordConnectLevel {
  level: number;
  letters: string[];
  targetWords: string[];
  bonusWords: string[];
}

export const WORD_CONNECT_LEVELS: WordConnectLevel[] = [
  {
    level: 1,
    letters: ["A", "R", "T"],
    targetWords: ["ART", "RAT", "TAR"],
    bonusWords: [],
  },
  {
    level: 2,
    letters: ["D", "O", "R", "W"],
    targetWords: ["WORD", "ROW", "ROD"],
    bonusWords: [],
  },
  {
    level: 3,
    letters: ["E", "A", "P", "L"],
    targetWords: ["PLEA", "PALE", "LEAP", "APE"],
    bonusWords: ["ALE", "LAP", "PAL", "PEA"],
  },
  {
    level: 4,
    letters: ["S", "T", "A", "R"],
    targetWords: ["STAR", "RATS", "ARTS", "TAR"],
    bonusWords: ["SAT", "RAT", "ART"],
  },
  {
    level: 5,
    letters: ["A", "C", "E", "N", "V"],
    targetWords: ["CAVE", "VANE", "ACNE", "CAN", "VAN", "ACE"],
    bonusWords: [],
  },
  {
    level: 6,
    letters: ["E", "R", "A", "L", "X"],
    targetWords: ["RELAX", "REAL", "EARL", "AXE", "EAR", "ERA"],
    bonusWords: ["ALE", "AXLE"],
  },
  {
    level: 7,
    letters: ["S", "P", "A", "R", "K"],
    targetWords: ["SPARK", "PARK", "SPAR", "RAP", "ARK"],
    bonusWords: ["SPA", "SAP", "ASK"],
  },
  {
    level: 8,
    letters: ["C", "Y", "B", "E", "R"],
    targetWords: ["CYBER", "BYRE", "CRY", "BYE", "RYE"],
    bonusWords: [],
  },
  {
    level: 9,
    letters: ["N", "E", "B", "U", "L", "A"],
    targetWords: ["NEBULA", "BANE", "BLUE", "LANE", "ABLE", "BEAN"],
    bonusWords: ["BALE", "LUNA", "BAN", "LAB", "ALE"],
  },
  {
    level: 10,
    letters: ["M", "A", "T", "R", "I", "X"],
    targetWords: ["MATRIX", "TRIM", "TAXI", "RAM", "MAX", "AIR"],
    bonusWords: ["RIM", "MIX", "ARM", "RAT"],
  },
  {
    level: 11,
    letters: ["P", "L", "A", "S", "M", "A"],
    targetWords: ["PLASMA", "LAMP", "PALM", "SLAP", "MAP"],
    bonusWords: ["SPA", "ALAS", "SLAM"],
  },
  {
    level: 12,
    letters: ["Q", "U", "A", "N", "T", "U", "M"],
    targetWords: ["QUANTUM", "AUNT", "TUNA", "NUT", "MAT"],
    bonusWords: ["MAN", "TAN"],
  },
];

export function getWordConnectLevel(lvl: number): WordConnectLevel {
  if (lvl <= WORD_CONNECT_LEVELS.length) {
    return WORD_CONNECT_LEVELS[lvl - 1]!;
  }
  // Endless loop through shuffled higher tiers
  const idx = (lvl - 1) % WORD_CONNECT_LEVELS.length;
  const base = WORD_CONNECT_LEVELS[idx]!;
  return {
    ...base,
    level: lvl,
  };
}
