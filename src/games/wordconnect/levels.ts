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
  {
    level: 13,
    letters: ["P", "R", "I", "S", "M"],
    targetWords: ["PRISM", "RIMS", "RIPS", "SIP", "RIP"],
    bonusWords: ["IMP", "SIR"],
  },
  {
    level: 14,
    letters: ["G", "L", "O", "W", "S"],
    targetWords: ["GLOWS", "GLOW", "SLOW", "LOGS", "OWL"],
    bonusWords: ["LOW", "SOW", "LOG"],
  },
  {
    level: 15,
    letters: ["F", "L", "A", "S", "H"],
    targetWords: ["FLASH", "HALF", "LASH", "ASH"],
    bonusWords: ["HAS"],
  },
  {
    level: 16,
    letters: ["V", "E", "C", "T", "O", "R"],
    targetWords: ["VECTOR", "ROTE", "CORE", "COVE", "VOTE", "ROVE"],
    bonusWords: ["COT", "ROT", "TOE", "VET", "ORE"],
  },
  {
    level: 17,
    letters: ["C", "R", "O", "W", "N"],
    targetWords: ["CROWN", "CORN", "WORN", "ROW", "NOW", "COW"],
    bonusWords: ["OWN", "WON", "CON", "NOR"],
  },
  {
    level: 18,
    letters: ["S", "H", "I", "E", "L", "D"],
    targetWords: ["SHIELD", "SLIDE", "HIDE", "HELD", "SHED", "IDLE"],
    bonusWords: ["LED", "LID", "DIE", "HIS", "LIE"],
  },
  {
    level: 19,
    letters: ["F", "U", "S", "I", "O", "N"],
    targetWords: ["FUSION", "ONUS", "IONS", "SUN", "FUN", "SIN"],
    bonusWords: ["SON", "ION"],
  },
  {
    level: 20,
    letters: ["P", "O", "R", "T", "A", "L"],
    targetWords: ["PORTAL", "PLOT", "TRAP", "PART", "PORT", "TARP"],
    bonusWords: ["POT", "TOP", "RAP", "ROT", "OAR", "TAP", "PAT", "ART"],
  },
  {
    level: 21,
    letters: ["B", "E", "A", "C", "O", "N"],
    targetWords: ["BEACON", "BACON", "CANOE", "BONE", "ONCE", "BEAN"],
    bonusWords: ["BANE", "ACNE", "CONE", "CAB", "BAN", "ONE"],
  },
  {
    level: 22,
    letters: ["S", "P", "H", "E", "R", "E"],
    targetWords: ["SPHERE", "SHEER", "PEER", "HERE", "SEE", "HER"],
    bonusWords: ["PEE", "PER"],
  },
  {
    level: 23,
    letters: ["P", "H", "A", "N", "T", "O", "M"],
    targetWords: ["PHANTOM", "MONTH", "ATOM", "MATH", "TAMP", "PATH"],
    bonusWords: ["MAP", "MAT", "TOP", "POT", "HOT", "HAT", "MAN", "PAN"],
  },
  {
    level: 24,
    letters: ["C", "R", "Y", "S", "T", "A", "L"],
    targetWords: ["CRYSTAL", "SCARY", "CLAY", "STAY", "STAR", "CART"],
    bonusWords: ["RAY", "CAT", "ART", "CRY", "SAY", "ACT", "TAR"],
  },
  {
    level: 25,
    letters: ["H", "O", "R", "I", "Z", "O", "N"],
    targetWords: ["HORIZON", "HONOR", "RHINO", "IRON", "HORN"],
    bonusWords: ["NOR", "ION", "ZOO"],
  },
  {
    level: 26,
    letters: ["A", "S", "T", "E", "R", "O", "I", "D"],
    targetWords: ["ASTEROID", "RADIO", "ROAST", "STARE", "TREAD", "STORE"],
    bonusWords: ["DOT", "RED", "EAR", "SEA", "TIE", "OAR", "SIT", "AIR"],
  },
  {
    level: 27,
    letters: ["E", "C", "L", "I", "P", "S", "E"],
    targetWords: ["ECLIPSE", "PIECE", "SLICE", "PEEL", "SLIP", "CLIP"],
    bonusWords: ["LIP", "PIE", "SEE", "ICE", "SIP"],
  },
  {
    level: 28,
    letters: ["S", "P", "E", "C", "T", "R", "U", "M"],
    targetWords: ["SPECTRUM", "TRUMP", "CRUST", "PURSE", "SUPER", "TERM"],
    bonusWords: ["CUP", "PET", "RUT", "SET", "MET", "CUT", "SUM"],
  },
  {
    level: 29,
    letters: ["D", "Y", "N", "A", "M", "I", "C"],
    targetWords: ["DYNAMIC", "ACID", "MIND", "MAID", "YAM", "MAN"],
    bonusWords: ["CAN", "AIM", "DAM", "DAY", "DIM"],
  },
  {
    level: 30,
    letters: ["U", "N", "I", "V", "E", "R", "S", "E"],
    targetWords: ["UNIVERSE", "NURSE", "NEVER", "SIRE", "VEIN", "RUNE"],
    bonusWords: ["RUN", "SUN", "SIN", "USE", "SEE", "SUE"],
  },
  {
    level: 31,
    letters: ["S", "U", "P", "E", "R", "N", "O", "V", "A"],
    targetWords: ["SUPERNOVA", "PERSON", "PROVE", "OPERA", "SUPER", "ROSE"],
    bonusWords: ["RUN", "SUN", "VAN", "PAN", "PEN", "SON", "ONE", "OAR", "RAP"],
  },
  {
    level: 32,
    letters: ["C", "H", "A", "M", "P", "I", "O", "N"],
    targetWords: ["CHAMPION", "MANIC", "CHAIN", "PIANO", "CHAMP", "CAMP"],
    bonusWords: ["MAP", "PAN", "PIN", "CAN", "HOP", "MOP", "CAP", "CHIP"],
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
