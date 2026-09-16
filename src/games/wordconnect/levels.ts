export interface WordConnectLevel {
  level: number;
  letters: string[];
  targetWords: string[];
  bonusWords: string[];
}

export const WORD_CONNECT_LEVELS: WordConnectLevel[] = [
  // ── Stage 1: 3 & 4-Letter Starters (Levels 1-5) ──
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
    letters: ["C", "A", "T"],
    targetWords: ["CAT", "ACT"],
    bonusWords: [],
  },
  {
    level: 7,
    letters: ["S", "U", "N"],
    targetWords: ["SUN", "RUN"],
    bonusWords: [],
  },
  {
    level: 8,
    letters: ["G", "L", "O", "W"],
    targetWords: ["GLOW", "OWL", "LOG", "LOW"],
    bonusWords: [],
  },
  {
    level: 9,
    letters: ["N", "E", "O", "N"],
    targetWords: ["NEON", "NONE", "ONE", "EON"],
    bonusWords: [],
  },
  {
    level: 10,
    letters: ["G", "A", "M", "E"],
    targetWords: ["GAME", "MAGE", "MEGA", "GEM"],
    bonusWords: ["AGE"],
  },

  // ── Stage 3: 5-Letter Expanding Horizons (Levels 11-20) ──
  {
    level: 11,
    letters: ["A", "C", "E", "N", "V"],
    targetWords: ["CAVE", "VANE", "ACNE", "CAN", "VAN", "ACE"],
    bonusWords: [],
  },
  {
    level: 12,
    letters: ["E", "R", "A", "L", "X"],
    targetWords: ["RELAX", "REAL", "EARL", "AXE", "EAR", "ERA"],
    bonusWords: ["ALE", "AXLE"],
  },
  {
    level: 13,
    letters: ["S", "P", "A", "R", "K"],
    targetWords: ["SPARK", "PARK", "SPAR", "RAP", "ARK"],
    bonusWords: ["SPA", "SAP", "ASK"],
  },
  {
    level: 14,
    letters: ["C", "Y", "B", "E", "R"],
    targetWords: ["CYBER", "BYRE", "CRY", "BYE", "RYE"],
    bonusWords: [],
  },
  {
    level: 15,
    letters: ["L", "A", "S", "E", "R"],
    targetWords: ["LASER", "SEAL", "EARL", "SALE", "ERA", "SEA"],
    bonusWords: ["ARE", "EAR"],
  },
  {
    level: 16,
    letters: ["S", "H", "I", "N", "E"],
    targetWords: ["SHINE", "SHIN", "WISH", "HEN", "SIN"],
    bonusWords: ["SHE"],
  },
  {
    level: 17,
    letters: ["P", "U", "L", "S", "E"],
    targetWords: ["PULSE", "PLUS", "SLUP", "USE"],
    bonusWords: ["SUE"],
  },
  {
    level: 18,
    letters: ["S", "P", "A", "C", "E"],
    targetWords: ["SPACE", "CAPE", "PACE", "ACE", "CAP", "APE"],
    bonusWords: ["PEA", "SEA", "SPA"],
  },
  {
    level: 19,
    letters: ["C", "O", "S", "M", "O"],
    targetWords: ["COSMO", "MOOS", "SOOT", "MOO"],
    bonusWords: [],
  },
  {
    level: 20,
    letters: ["F", "L", "A", "M", "E"],
    targetWords: ["FLAME", "FLEA", "MALE", "MEAL", "FAME", "LEAF"],
    bonusWords: ["ALE", "ELF", "ELM"],
  },

  // ── Stage 4: 6-Letter Arcade Matrices (Levels 21-35) ──
  {
    level: 21,
    letters: ["N", "E", "B", "U", "L", "A"],
    targetWords: ["NEBULA", "BANE", "BLUE", "LANE", "ABLE", "BEAN"],
    bonusWords: ["ALE", "BAN", "LAB", "NAB", "BALE"],
  },
  {
    level: 22,
    letters: ["P", "L", "A", "N", "E", "T"],
    targetWords: ["PLANET", "PLANT", "LEAP", "PALE", "LANE", "NEAT"],
    bonusWords: ["TAP", "PAN", "NET", "PET", "ALE", "APE"],
  },
  {
    level: 23,
    letters: ["M", "A", "T", "R", "I", "X"],
    targetWords: ["MATRIX", "TRIM", "MAXI", "RAM", "ARM", "AIM", "AIR"],
    bonusWords: ["ART", "RAT", "MIX", "TAX", "TAR"],
  },
  {
    level: 24,
    letters: ["G", "A", "L", "A", "X", "Y"],
    targetWords: ["GALAXY", "GALA", "LAY", "GAY"],
    bonusWords: [],
  },
  {
    level: 25,
    letters: ["F", "U", "S", "I", "O", "N"],
    targetWords: ["FUSION", "IONS", "SUN", "FUN", "SIN", "SON"],
    bonusWords: ["FIN", "ION"],
  },
  {
    level: 26,
    letters: ["S", "H", "I", "E", "L", "D"],
    targetWords: ["SHIELD", "HIDE", "HELD", "IDLE", "SIDE", "SHED"],
    bonusWords: ["LED", "LID", "DIE", "HIS"],
  },
  {
    level: 27,
    letters: ["E", "N", "E", "R", "G", "Y"],
    targetWords: ["ENERGY", "GREEN", "GENRE", "GREY", "EYRE"],
    bonusWords: ["EYE", "EGG"],
  },
  {
    level: 28,
    letters: ["V", "E", "C", "T", "O", "R"],
    targetWords: ["VECTOR", "ROTE", "COVE", "CORE", "TORE"],
    bonusWords: ["COT", "ROT", "TOE", "VOW"],
  },
  {
    level: 29,
    letters: ["R", "O", "C", "K", "E", "T"],
    targetWords: ["ROCKET", "ROCK", "CORK", "TORE", "COTE"],
    bonusWords: ["ROT", "TOE", "COT"],
  },
  {
    level: 30,
    letters: ["A", "R", "C", "A", "D", "E"],
    targetWords: ["ARCADE", "RACE", "CARE", "READ", "DEAR", "CARD"],
    bonusWords: ["ACE", "ARC", "CAR", "EAR", "ERA", "RED"],
  },
  {
    level: 31,
    letters: ["C", "Y", "B", "O", "R", "G"],
    targetWords: ["CYBORG", "BOG", "BOY", "ORB", "ROB", "CRY"],
    bonusWords: [],
  },
  {
    level: 32,
    letters: ["P", "U", "L", "S", "A", "R"],
    targetWords: ["PULSAR", "SLUR", "SPUR", "PLUS"],
    bonusWords: ["SPA", "RAP", "RUM"],
  },
  {
    level: 33,
    letters: ["S", "P", "H", "E", "R", "E"],
    targetWords: ["SPHERE", "SHEER", "PEER", "HERE", "SEEP"],
    bonusWords: ["HER", "SEE"],
  },
  {
    level: 34,
    letters: ["Q", "U", "A", "N", "T", "A"],
    targetWords: ["QUANTA", "AUNT", "AQUA", "NUT", "TAN"],
    bonusWords: ["ANT"],
  },
  {
    level: 35,
    letters: ["H", "E", "L", "I", "U", "M"],
    targetWords: ["HELIUM", "MULE", "LIME", "MILE", "HUE"],
    bonusWords: ["HIM", "HEM", "ELM"],
  },

  // ── Stage 5: 7 & 8-Letter Master Constellations (Levels 36-50) ──
  {
    level: 36,
    letters: ["S", "P", "E", "C", "T", "R", "U", "M"],
    targetWords: ["SPECTRUM", "TRUMP", "CRUST", "PURSE", "SUPER", "TERM"],
    bonusWords: ["CUP", "PET", "RUT", "SET", "MET", "CUT", "SUM"],
  },
  {
    level: 37,
    letters: ["D", "Y", "N", "A", "M", "I", "C"],
    targetWords: ["DYNAMIC", "ACID", "MIND", "MAID", "YAM", "MAN"],
    bonusWords: ["CAN", "AIM", "DAM", "DAY", "DIM"],
  },
  {
    level: 38,
    letters: ["U", "N", "I", "V", "E", "R", "S", "E"],
    targetWords: ["UNIVERSE", "NURSE", "NEVER", "SIRE", "VEIN", "RUNE"],
    bonusWords: ["RUN", "SUN", "SIN", "USE", "SEE", "SUE"],
  },
  {
    level: 39,
    letters: ["A", "S", "T", "E", "R", "O", "I", "D"],
    targetWords: ["ASTEROID", "STORE", "STARE", "RADIO", "TRIED", "RATED"],
    bonusWords: ["DOT", "ROT", "OAT", "SEA", "TIE", "EAR", "AIR"],
  },
  {
    level: 40,
    letters: ["S", "U", "P", "E", "R", "N", "O", "V", "A"],
    targetWords: ["SUPERNOVA", "PERSON", "PROVE", "OPERA", "SUPER", "ROSE"],
    bonusWords: ["RUN", "SUN", "VAN", "PAN", "PEN", "SON", "ONE", "OAR", "RAP"],
  },
  {
    level: 41,
    letters: ["C", "H", "A", "M", "P", "I", "O", "N"],
    targetWords: ["CHAMPION", "MANIC", "CHAIN", "PIANO", "CHAMP", "CAMP"],
    bonusWords: ["MAP", "PAN", "PIN", "CAN", "HOP", "MOP", "CAP", "CHIP"],
  },
  {
    level: 42,
    letters: ["H", "O", "R", "I", "Z", "O", "N"],
    targetWords: ["HORIZON", "HONOR", "IRON", "HORN", "ZOOM"],
    bonusWords: ["ZOO", "NOR", "ION"],
  },
  {
    level: 43,
    letters: ["I", "N", "F", "I", "N", "I", "T", "Y"],
    targetWords: ["INFINITY", "TINY", "NINE", "INIT"],
    bonusWords: ["FIT", "TIN"],
  },
  {
    level: 44,
    letters: ["Q", "U", "A", "N", "T", "U", "M"],
    targetWords: ["QUANTUM", "MUTT", "AUNT", "NUT", "MAT"],
    bonusWords: ["MAN", "TAN"],
  },
  {
    level: 45,
    letters: ["S", "A", "T", "E", "L", "L", "I", "T", "E"],
    targetWords: ["SATELLITE", "LITTLE", "TITLE", "STATE", "STEAL"],
    bonusWords: ["SET", "LET", "ILL", "TIE", "TEA", "SEA"],
  },
  {
    level: 46,
    letters: ["H", "O", "L", "O", "G", "R", "A", "M"],
    targetWords: ["HOLOGRAM", "GLAMOR", "MORAL", "GLOAM", "ROAM", "HARM"],
    bonusWords: ["RAG", "ARM", "HAM", "LOG", "OAR"],
  },
  {
    level: 47,
    letters: ["D", "I", "S", "C", "O", "V", "E", "R"],
    targetWords: ["DISCOVER", "VOICE", "DRIVE", "CODER", "COVER", "RIDE"],
    bonusWords: ["RED", "ICE", "ROD", "DOSE"],
  },
  {
    level: 48,
    letters: ["T", "E", "L", "E", "S", "C", "O", "P", "E"],
    targetWords: ["TELESCOPE", "SELECT", "SLEEP", "PEEL", "PLOT", "COLE"],
    bonusWords: ["SEE", "LET", "POT", "TOP", "PET"],
  },
  {
    level: 49,
    letters: ["C", "E", "L", "E", "S", "T", "I", "A", "L"],
    targetWords: ["CELESTIAL", "CASTLE", "SLICE", "SCALE", "ELITE"],
    bonusWords: ["CAT", "ACT", "ICE", "SEA", "TIE", "LIT"],
  },
  {
    level: 50,
    letters: ["M", "U", "L", "T", "I", "V", "E", "R", "S", "E"],
    targetWords: ["MULTIVERSE", "VIRTUE", "RESULT", "RIVET", "SUITE", "TIMER"],
    bonusWords: ["LET", "SET", "USE", "RUN", "SUN", "RUE", "RIM", "LIME"],
  },
];

export function getWordConnectLevel(lvl: number): WordConnectLevel {
  const safeLvl = Math.max(1, lvl);
  if (safeLvl <= WORD_CONNECT_LEVELS.length) {
    return WORD_CONNECT_LEVELS[safeLvl - 1]!;
  }
  // Endless loop through shuffled higher tiers
  const idx = (safeLvl - 1) % WORD_CONNECT_LEVELS.length;
  const base = WORD_CONNECT_LEVELS[idx]!;
  return {
    ...base,
    level: safeLvl,
  };
}
