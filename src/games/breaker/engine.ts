/* ── Neon Breaker Engine ──
   High-octane multi-ball barrage brick breaker with numbered bricks,
   TNT explosive chain reactions, cross laser beams, armor bricks,
   splitter multiplier bricks, 25+ handcrafted mazes & procedural generation. */

export type BreakerPowerType = "multiball" | "laser" | "expand";

export type FieldOrbType = "add_ball" | "laser_cross" | "bomb";

export type SpecialBrickKind = "normal" | "tnt" | "laser_cross" | "armor" | "splitter";

export interface FieldOrb {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: FieldOrbType;
  collected: boolean;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  returning?: boolean;
  bounceCount?: number;
}

export interface Brick {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hitsLeft: number;
  maxHits: number;
  color: string;
  points: number;
  powerUp?: BreakerPowerType;
  special?: SpecialBrickKind;
  armorHits?: number;
  maxArmorHits?: number;
  hitFlashTimer?: number;
}

export interface PowerUpItem {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: BreakerPowerType;
}

export interface LaserBullet {
  x: number;
  y: number;
  vy: number;
}

export interface TrajectorySegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hitType: "wall" | "brick" | "none";
}

export interface BreakerGameState {
  width: number;
  height: number;
  paddleX: number;
  paddleY: number;
  paddleWidth: number;
  paddleHeight: number;
  paddleBaseWidth: number;
  balls: Ball[];
  bricks: Brick[];
  powerUps: PowerUpItem[];
  fieldOrbs: FieldOrb[];
  lasers: LaserBullet[];
  score: number;
  highScore: number;
  lives: number;
  wave: number;
  gameOver: boolean;
  victory: boolean;
  paused: boolean;
  launched: boolean;
  expandTimerMs: number;
  laserAmmo: number;
  combo: number;
  paddleVx: number;
  // Break Bricks specific mechanics
  aiming: boolean;
  aimAngle: number;
  aimTrajectory: TrajectorySegment[];
  launcherX: number;
  launcherY: number;
  nextLauncherX: number;
  totalBalls: number;
  ballsToAddNextRound: number;
  launchQueue: number;
  launchTimerMs: number;
  speedMultiplier: number;
  roundInProgress: boolean;
  ballsReturned: number;
  turnsTaken: number;
  starsEarned: number;
  roundTimeSeconds: number;
  initialBricksInStage: number;
}

export const BRICK_PALETTE = {
  green: "#00FF66",
  yellow: "#FFD700",
  cyan: "#00F2FF",
  magenta: "#FF007F",
  purple: "#9900FF",
  orange: "#FF8800",
  blue: "#4FC3FF",
  tnt: "#FF2A2A",
  laser: "#FFEB3B",
  armor: "#80DEEA",
  splitter: "#E040FB",
};

// 25 Handcrafted Iconic Mazes
// Legend: '#' = Normal brick, 'T' = TNT bomb, 'L' = Laser cross, 'A' = Armor brick, 'S' = Splitter, ' ' = Empty corridor
const STAGE_PATTERNS: string[][] = [
  // 1: Emerald Fortress Gate
  [
    "#########",
    "#########",
    "### # ###",
    "## ### ##",
    "##  T  ##",
    "###   ###",
    "##  L  ##",
    " ####### ",
  ],
  // 2: The Great U-Vault
  [
    "#########",
    "#########",
    "##  A  ##",
    "##     ##",
    "##  T  ##",
    "##     ##",
    "##  S  ##",
    "##     ##",
    "## ### ##",
    "## ### ##",
  ],
  // 3: Cyan Double Spiral
  [
    "#########",
    "#L     S#",
    "# ##### #",
    "# #   # #",
    "# # T # #",
    "# #   # #",
    "# ##### #",
    "#A     L#",
    "#########",
    " ####### ",
  ],
  // 4: Diamond Bastion
  [
    "#########",
    " ####### ",
    "  ##T##  ",
    " ### ### ",
    "##  L  ##",
    "### ### ",
    "  ##S##  ",
    " ####### ",
    "#########",
  ],
  // 5: Neon Alien Invader
  [
    "#########",
    " # # # # ",
    "  #####  ",
    " ##L#L## ",
    "#########",
    "#T#####T#",
    "# # A # #",
    "   ###   ",
  ],
  // 6: The Gauntlet Pillars
  [
    "#########",
    "#########",
    "# # # # #",
    "# # # # #",
    "#T#L#S#T#",
    "# # # # #",
    "# # # # #",
    "# # # # #",
    "### ### #",
  ],
  // 7: Hourglass Core
  [
    "#########",
    " ####### ",
    "  #####  ",
    "   #T#   ",
    "    #    ",
    "   #L#   ",
    "  #####  ",
    " ####### ",
    "#########",
  ],
  // 8: Twin Dragons
  [
    "#########",
    "## ### ##",
    "#L  #  S#",
    "#   #   #",
    "### T ###",
    "#   #   #",
    "#S  #  L#",
    "## ### ##",
    "#########",
  ],
  // 9: Honeycomb Matrix
  [
    "#########",
    " # # # # ",
    "#########",
    "# # # # #",
    "##T#L#S##",
    "# # # # #",
    "#########",
    " # # # # ",
    "#########",
  ],
  // 10: Cyber Skull
  [
    "#########",
    "#########",
    "### # ###",
    "## T L ##",
    " ####### ",
    "  #S#S#  ",
    "  #####  ",
    "   ###   ",
  ],
  // 11: Chevron V-Wings
  [
    "#########",
    "#   #   #",
    "##  #  ##",
    "### # ###",
    "#T# # #L#",
    " ####### ",
    "  #####  ",
    "   ###   ",
    "    #    ",
  ],
  // 12: The Citadel Vault
  [
    "#########",
    "#########",
    "##     ##",
    "## ### ##",
    "## #T# ##",
    "## ### ##",
    "##  L  ##",
    "##     ##",
    "#########",
  ],
  // 13: Neon Cyber Heart
  [
    "#########",
    " ##   ## ",
    "#### ####",
    "##T###L##",
    " ####### ",
    "  #####  ",
    "   #S#   ",
    "    #    ",
  ],
  // 14: DNA Helix Matrix
  [
    "#########",
    "## ### ##",
    " #  T  # ",
    "  #####  ",
    "   #L#   ",
    "  #####  ",
    " #  S  # ",
    "## ### ##",
    "#########",
  ],
  // 15: Space Shuttle Delta
  [
    "#########",
    "   ###   ",
    "   #T#   ",
    "  #####  ",
    "  #L#S#  ",
    " ####### ",
    "#########",
    "##  #  ##",
    "#   #   #",
  ],
  // 16: Castle Ramparts
  [
    "#########",
    "# # # # #",
    "#########",
    "##     ##",
    "## T L ##",
    "##  S  ##",
    "##     ##",
    "#########",
    "## ### ##",
  ],
  // 17: Laser Grid Matrix
  [
    "#########",
    "#L#L#L#L#",
    "#########",
    "# # # # #",
    "###T#T###",
    "# # # # #",
    "#########",
    "#S#S#S#S#",
    "#########",
  ],
  // 18: Triple Ring Target
  [
    "#########",
    "#       #",
    "# ##### #",
    "# #   # #",
    "# # T # #",
    "# #   # #",
    "# ##### #",
    "#       #",
    "#########",
  ],
  // 19: Retro Arcade Ghost
  [
    "#########",
    " ####### ",
    "#########",
    "##L###L##",
    "#########",
    " ####### ",
    "### # ###",
    "# # # # #",
  ],
  // 20: Dual Pyramid Gateway
  [
    "#########",
    " ####### ",
    "  #####  ",
    "   #T#   ",
    "   #L#   ",
    "  #####  ",
    " ####### ",
    "#########",
  ],
  // 21: Diamond Lattice
  [
    "#########",
    "# # # # #",
    " # # # # ",
    "##T#A#L##",
    " # # # # ",
    "# # # # #",
    "##S#A#T##",
    " # # # # ",
    "#########",
  ],
  // 22: The Monolith Vault
  [
    "#########",
    "## # # ##",
    "## # # ##",
    "## T L ##",
    "## # # ##",
    "## # # ##",
    "## S A ##",
    "#########",
  ],
  // 23: Crown of the Neon King
  [
    "#########",
    "# # # # #",
    "## ### ##",
    "#########",
    "##T#L#S##",
    " ####### ",
    "  #####  ",
    "#########",
  ],
  // 24: Cyber Butterfly
  [
    "#########",
    "##  #  ##",
    "### # ###",
    "#L# T #S#",
    " ####### ",
    "### # ###",
    "##  #  ##",
    "#########",
  ],
  // 25: The Final Nexus
  [
    "#########",
    "#########",
    "#T#L#S#A#",
    "# # # # #",
    "## ### ##",
    "# # # # #",
    "#A#S#L#T#",
    "#########",
    " ####### ",
  ],
];

export function createBricksForWave(width: number, wave: number): Brick[] {
  const bricks: Brick[] = [];
  const cols = 9;
  const padX = 18;
  const spacing = 4;
  const brickW = (width - padX * 2 - (cols - 1) * spacing) / cols;
  const brickH = 17;
  // Always start right near the top border so there are NO empty gaps at the top!
  const startY = 24;

  let id = 0;
  const colors = [
    BRICK_PALETTE.green,
    BRICK_PALETTE.yellow,
    BRICK_PALETTE.cyan,
    BRICK_PALETTE.magenta,
    BRICK_PALETTE.purple,
    BRICK_PALETTE.blue,
    BRICK_PALETTE.orange,
  ];

  const primaryColor = colors[(wave - 1) % colors.length]!;

  // 1. Handcrafted Stages (1 to 25)
  if (wave >= 1 && wave <= STAGE_PATTERNS.length) {
    const pattern = STAGE_PATTERNS[wave - 1]!;
    const baseHits = Math.min(60, 4 + wave * 2);

    for (let r = 0; r < pattern.length; r++) {
      const rowStr = pattern[r]!;
      for (let c = 0; c < rowStr.length && c < cols; c++) {
        const char = rowStr[c];
        if (char && char !== " ") {
          id++;
          let special: SpecialBrickKind = "normal";
          let color = primaryColor;
          let hits = baseHits + Math.floor((r / pattern.length) * 4);
          let armorHits = 0;

          if (char === "T") {
            special = "tnt";
            color = BRICK_PALETTE.tnt;
            hits = Math.max(1, Math.floor(baseHits * 0.6));
          } else if (char === "L") {
            special = "laser_cross";
            color = BRICK_PALETTE.laser;
            hits = Math.max(1, Math.floor(baseHits * 0.7));
          } else if (char === "A") {
            special = "armor";
            color = BRICK_PALETTE.armor;
            armorHits = 2 + Math.floor(wave / 4);
          } else if (char === "S") {
            special = "splitter";
            color = BRICK_PALETTE.splitter;
            hits = Math.max(1, Math.floor(baseHits * 0.5));
          }

          const x = padX + c * (brickW + spacing);
          const y = startY + r * (brickH + spacing);

          bricks.push({
            id,
            x,
            y,
            width: brickW,
            height: brickH,
            hitsLeft: hits,
            maxHits: hits,
            color,
            special,
            armorHits,
            maxArmorHits: armorHits,
            points: hits * 40,
          });
        }
      }
    }
    return bricks;
  }

  // 2. Procedural Endless Stages (Wave 26+)
  // Guaranteed solid top row and rich geometric maze architecture
  const rows = Math.min(13, 8 + Math.floor((wave - 25) / 5));
  const baseHits = 25 + Math.min(100, wave * 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Row 0 and Row 1 are ALWAYS solid or fortified so the top is NEVER empty!
      const isTopWall = r === 0 || r === 1;
      const isCorridor = !isTopWall && (c === 2 || c === 6) && r > 2 && r < rows - 2 && (wave + r) % 3 === 0;
      const isHole = !isTopWall && (c >= 3 && c <= 5) && (r >= 4 && r <= 6) && wave % 2 === 0;

      if (isCorridor || isHole) continue;

      id++;
      const x = padX + c * (brickW + spacing);
      const y = startY + r * (brickH + spacing);

      let special: SpecialBrickKind = "normal";
      let color = primaryColor;
      let hits = baseHits + Math.floor(Math.random() * 8);
      let armorHits = 0;

      // Deterministic scattering of special bricks
      const seedVal = (wave * 37 + r * 13 + c * 7) % 100;
      if (seedVal < 6) {
        special = "tnt";
        color = BRICK_PALETTE.tnt;
        hits = Math.max(2, Math.floor(baseHits * 0.5));
      } else if (seedVal < 11) {
        special = "laser_cross";
        color = BRICK_PALETTE.laser;
        hits = Math.max(2, Math.floor(baseHits * 0.6));
      } else if (seedVal < 16) {
        special = "armor";
        color = BRICK_PALETTE.armor;
        armorHits = 3;
      } else if (seedVal < 20) {
        special = "splitter";
        color = BRICK_PALETTE.splitter;
        hits = Math.max(2, Math.floor(baseHits * 0.5));
      }

      bricks.push({
        id,
        x,
        y,
        width: brickW,
        height: brickH,
        hitsLeft: hits,
        maxHits: hits,
        color,
        special,
        armorHits,
        maxArmorHits: armorHits,
        points: hits * 50,
      });
    }
  }

  return bricks;
}

export function createFieldOrbsForWave(width: number, wave: number): FieldOrb[] {
  const orbs: FieldOrb[] = [];
  const cols = 9;
  const padX = 18;
  const spacing = 4;
  const brickW = (width - padX * 2 - (cols - 1) * spacing) / cols;
  const brickH = 17;
  const startY = 24;

  let orbId = 0;

  // Add +Ball and Laser/Bomb orbs in corridors or central chambers
  orbs.push(
    {
      id: ++orbId,
      x: padX + 2 * (brickW + spacing) + brickW / 2,
      y: startY + 4 * (brickH + spacing),
      radius: 8,
      type: "add_ball",
      collected: false,
    },
    {
      id: ++orbId,
      x: padX + 6 * (brickW + spacing) + brickW / 2,
      y: startY + 4 * (brickH + spacing),
      radius: 8,
      type: "add_ball",
      collected: false,
    },
    {
      id: ++orbId,
      x: padX + 4 * (brickW + spacing) + brickW / 2,
      y: startY + (wave % 2 === 0 ? 5 : 6) * (brickH + spacing),
      radius: 8,
      type: wave % 3 === 0 ? "bomb" : "laser_cross",
      collected: false,
    },
  );

  return orbs;
}

export function calculateAimTrajectory(
  startX: number,
  startY: number,
  angleRad: number,
  width: number,
  _height: number,
  bricks: Brick[],
  maxBounces = 2,
): TrajectorySegment[] {
  const segments: TrajectorySegment[] = [];
  let currX = startX;
  let currY = startY;
  let dirX = Math.cos(angleRad);
  let dirY = Math.sin(angleRad);

  const leftWall = 8;
  const rightWall = width - 8;
  const topWall = 12;

  for (let bounce = 0; bounce <= maxBounces; bounce++) {
    let hitT = Infinity;
    let hitNormalX = 0;
    let hitNormalY = 0;
    let hitType: "wall" | "brick" | "none" = "none";

    // Wall checks
    if (dirX < 0) {
      const t = (leftWall - currX) / dirX;
      if (t > 0.01 && t < hitT) {
        hitT = t;
        hitNormalX = 1;
        hitNormalY = 0;
        hitType = "wall";
      }
    } else if (dirX > 0) {
      const t = (rightWall - currX) / dirX;
      if (t > 0.01 && t < hitT) {
        hitT = t;
        hitNormalX = -1;
        hitNormalY = 0;
        hitType = "wall";
      }
    }

    if (dirY < 0) {
      const t = (topWall - currY) / dirY;
      if (t > 0.01 && t < hitT) {
        hitT = t;
        hitNormalX = 0;
        hitNormalY = 1;
        hitType = "wall";
      }
    }

    // Brick checks
    for (const b of bricks) {
      const invDirX = 1 / (dirX === 0 ? 1e-6 : dirX);
      const invDirY = 1 / (dirY === 0 ? 1e-6 : dirY);

      let tMin = (b.x - currX) * invDirX;
      let tMax = (b.x + b.width - currX) * invDirX;
      if (tMin > tMax) [tMin, tMax] = [tMax, tMin];

      let tyMin = (b.y - currY) * invDirY;
      let tyMax = (b.y + b.height - currY) * invDirY;
      if (tyMin > tyMax) [tyMin, tyMax] = [tyMax, tyMin];

      if (tMin > tyMax || tyMin > tMax) continue;

      const enterT = Math.max(tMin, tyMin);
      if (enterT > 0.01 && enterT < hitT) {
        hitT = enterT;
        hitType = "brick";
        const hitX = currX + dirX * enterT;
        const hitY = currY + dirY * enterT;
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        const dx = hitX - cx;
        const dy = hitY - cy;
        if (Math.abs(dx / b.width) > Math.abs(dy / b.height)) {
          hitNormalX = dx > 0 ? 1 : -1;
          hitNormalY = 0;
        } else {
          hitNormalX = 0;
          hitNormalY = dy > 0 ? 1 : -1;
        }
      }
    }

    if (!Number.isFinite(hitT) || hitT < 0.01) {
      segments.push({
        x1: currX,
        y1: currY,
        x2: currX + dirX * 180,
        y2: currY + dirY * 180,
        hitType: "none",
      });
      break;
    }

    const nextX = currX + dirX * hitT;
    const nextY = currY + dirY * hitT;

    segments.push({
      x1: currX,
      y1: currY,
      x2: nextX,
      y2: nextY,
      hitType,
    });

    if (hitType === "brick" || bounce === maxBounces) {
      break;
    }

    const dot = dirX * hitNormalX + dirY * hitNormalY;
    dirX = dirX - 2 * dot * hitNormalX;
    dirY = dirY - 2 * dot * hitNormalY;
    currX = nextX + dirX * 0.05;
    currY = nextY + dirY * 0.05;
  }

  return segments;
}

export function createBreakerGame(
  width = 360,
  height = 480,
  highScore = 0,
): BreakerGameState {
  const paddleWidth = 74;
  const paddleHeight = 12;
  const paddleX = (width - paddleWidth) / 2;
  const paddleY = height - 42;
  const launcherX = paddleX + paddleWidth / 2;
  const launcherY = paddleY - 8;
  const defaultAimAngle = -Math.PI / 2;

  const bricks = createBricksForWave(width, 1);
  const fieldOrbs = createFieldOrbsForWave(width, 1);
  const aimTrajectory = calculateAimTrajectory(
    launcherX,
    launcherY,
    defaultAimAngle,
    width,
    height,
    bricks,
  );

  const state: BreakerGameState = {
    width,
    height,
    paddleX,
    paddleY,
    paddleWidth,
    paddleHeight,
    paddleBaseWidth: paddleWidth,
    balls: [
      {
        x: launcherX,
        y: launcherY,
        vx: 180,
        vy: -240,
        radius: 6,
      },
    ],
    bricks,
    powerUps: [],
    fieldOrbs,
    lasers: [],
    score: 0,
    highScore,
    lives: 3,
    wave: 1,
    gameOver: false,
    victory: false,
    paused: false,
    launched: false,
    expandTimerMs: 0,
    laserAmmo: 0,
    combo: 0,
    paddleVx: 0,
    aiming: false,
    aimAngle: defaultAimAngle,
    aimTrajectory,
    launcherX,
    launcherY,
    nextLauncherX: launcherX,
    totalBalls: 30,
    ballsToAddNextRound: 0,
    launchQueue: 0,
    launchTimerMs: 0,
    speedMultiplier: 1,
    roundInProgress: false,
    ballsReturned: 0,
    turnsTaken: 0,
    starsEarned: 3,
    roundTimeSeconds: 0,
    initialBricksInStage: bricks.length,
  };

  return state;
}

export function setAim(state: BreakerGameState, angleRad: number): void {
  const minAngle = -Math.PI * 0.94;
  const maxAngle = -Math.PI * 0.06;
  const clampedAngle = Math.max(minAngle, Math.min(maxAngle, angleRad));
  state.aimAngle = clampedAngle;
  state.aiming = true;
  state.aimTrajectory = calculateAimTrajectory(
    state.launcherX,
    state.launcherY,
    state.aimAngle,
    state.width,
    state.height,
    state.bricks,
  );
}

export function movePaddle(state: BreakerGameState, targetX: number, _dtSeconds?: number): void {
  const prevX = state.paddleX;
  const newX = Math.max(0, Math.min(state.width - state.paddleWidth, targetX - state.paddleWidth / 2));
  state.paddleX = newX;
  state.paddleVx = (newX - prevX) * 20;

  if (!state.launched && state.balls[0]) {
    state.launcherX = newX + state.paddleWidth / 2;
    state.balls[0].x = state.launcherX;
    state.aimTrajectory = calculateAimTrajectory(
      state.launcherX,
      state.launcherY,
      state.aimAngle,
      state.width,
      state.height,
      state.bricks,
    );
  }
}

export function launchBall(state: BreakerGameState, aimAngleRad?: number): boolean {
  if (state.launched || state.gameOver) return false;

  if (aimAngleRad !== undefined) {
    const minAngle = -Math.PI * 0.94;
    const maxAngle = -Math.PI * 0.06;
    state.aimAngle = Math.max(minAngle, Math.min(maxAngle, aimAngleRad));
  }

  state.launched = true;
  state.roundInProgress = true;
  state.ballsReturned = 0;
  state.roundTimeSeconds = 0;
  state.combo = 0;

  const speed = 360;
  state.balls = [];

  // Launch initial ball
  state.balls.push({
    x: state.launcherX,
    y: state.launcherY,
    vx: Math.cos(state.aimAngle) * speed,
    vy: Math.sin(state.aimAngle) * speed,
    radius: 6,
  });

  state.launchQueue = Math.max(0, state.totalBalls - 1);
  state.launchTimerMs = 0;

  return true;
}

export function recallBalls(state: BreakerGameState): boolean {
  if (!state.launched || state.balls.length === 0) return false;

  state.launchQueue = 0;
  state.roundTimeSeconds = 0;
  if (state.ballsReturned === 0 && state.balls[0]) {
    state.nextLauncherX = Math.max(20, Math.min(state.width - 20, state.balls[0].x));
  }

  state.launched = false;
  state.roundInProgress = false;
  state.launcherX = state.nextLauncherX;
  state.paddleX = Math.max(
    0,
    Math.min(state.width - state.paddleWidth, state.launcherX - state.paddleWidth / 2),
  );
  state.balls = [
    {
      x: state.launcherX,
      y: state.paddleY - 8,
      vx: 180,
      vy: -240,
      radius: 6,
    },
  ];
  state.totalBalls += state.ballsToAddNextRound;
  state.ballsToAddNextRound = 0;
  state.turnsTaken++;

  state.aimTrajectory = calculateAimTrajectory(
    state.launcherX,
    state.launcherY,
    state.aimAngle,
    state.width,
    state.height,
    state.bricks,
  );

  return true;
}

export function setSpeedMultiplier(state: BreakerGameState, mult: number): void {
  state.speedMultiplier = Math.max(1, Math.min(5, mult));
}

export function fireLaser(state: BreakerGameState): boolean {
  if (state.laserAmmo <= 0 || !state.launched || state.gameOver) return false;
  state.laserAmmo--;
  state.lasers.push(
    { x: state.paddleX + 8, y: state.paddleY, vy: -400 },
    { x: state.paddleX + state.paddleWidth - 8, y: state.paddleY, vy: -400 },
  );
  return true;
}

export interface BreakerEvents {
  paddleHit: boolean;
  wallHit: boolean;
  ceilingHit?: { x: number; y: number };
  brickHit: boolean;
  brickDestroyed: boolean;
  destroyedBrick?: Brick;
  tntExplosions: { x: number; y: number; radius: number }[];
  laserBeams: { x: number; y: number }[];
  splitterTriggered?: { x: number; y: number };
  powerUpCollected?: BreakerPowerType;
  orbCollected?: FieldOrbType;
  lostLife: boolean;
  waveCleared: boolean;
  roundEnded: boolean;
  combo: number;
}

export function tickBreaker(state: BreakerGameState, dtMs: number): BreakerEvents {
  const events: BreakerEvents = {
    paddleHit: false,
    wallHit: false,
    brickHit: false,
    brickDestroyed: false,
    tntExplosions: [],
    laserBeams: [],
    lostLife: false,
    waveCleared: false,
    roundEnded: false,
    combo: state.combo,
  };

  if (state.gameOver || state.paused) return events;

  const effectiveDtMs = dtMs * state.speedMultiplier;
  const dt = effectiveDtMs / 1000;

  state.paddleVx *= Math.exp(-12 * dt);

  if (state.expandTimerMs > 0) {
    state.expandTimerMs -= effectiveDtMs;
    if (state.expandTimerMs <= 0) {
      state.paddleWidth = state.paddleBaseWidth;
      state.expandTimerMs = 0;
    }
  }

  // Stream launch queue
  if (state.launched && state.launchQueue > 0) {
    state.launchTimerMs += effectiveDtMs;
    const speed = 360;
    const staggerInterval = 32;
    while (state.launchTimerMs >= staggerInterval && state.launchQueue > 0) {
      state.launchTimerMs -= staggerInterval;
      state.launchQueue--;
      state.balls.push({
        x: state.launcherX,
        y: state.launcherY,
        vx: Math.cos(state.aimAngle) * speed,
        vy: Math.sin(state.aimAngle) * speed,
        radius: 6,
        returning: false,
      });
    }
  }

  // Lasers
  for (let i = state.lasers.length - 1; i >= 0; i--) {
    const l = state.lasers[i]!;
    l.y += l.vy * dt;
    if (l.y < 0) {
      state.lasers.splice(i, 1);
      continue;
    }
    for (let b = state.bricks.length - 1; b >= 0; b--) {
      const brick = state.bricks[b]!;
      if (
        l.x >= brick.x &&
        l.x <= brick.x + brick.width &&
        l.y >= brick.y &&
        l.y <= brick.y + brick.height
      ) {
        state.lasers.splice(i, 1);
        damageBrick(state, b, 2, events);
        break;
      }
    }
  }

  // Power-up drops
  for (let i = state.powerUps.length - 1; i >= 0; i--) {
    const p = state.powerUps[i]!;
    p.y += p.vy * dt;

    if (
      p.y + 8 >= state.paddleY &&
      p.y <= state.paddleY + state.paddleHeight &&
      p.x >= state.paddleX &&
      p.x <= state.paddleX + state.paddleWidth
    ) {
      applyPowerUp(state, p.type);
      events.powerUpCollected = p.type;
      state.powerUps.splice(i, 1);
      continue;
    }

    if (p.y > state.height) {
      state.powerUps.splice(i, 1);
    }
  }

  // Anti-stuck safety
  if (state.launched && state.balls.length > 0) {
    state.roundTimeSeconds += dt;
  }
  if (state.roundTimeSeconds > 22 && state.balls.length <= 4 && state.launchQueue === 0) {
    recallBalls(state);
    return events;
  }

  // Balls physics & collision
  for (let i = state.balls.length - 1; i >= 0; i--) {
    const b = state.balls[i]!;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Prevent purely horizontal bounce
    if (Math.abs(b.vy) < 25 && dt > 0) {
      b.vy = (b.vy >= 0 ? 1 : -1) * 32;
    }

    // Left / Right wall bounce
    if (b.x - b.radius <= 0) {
      b.x = b.radius;
      b.vx = Math.abs(b.vx);
      b.bounceCount = (b.bounceCount ?? 0) + 1;
      events.wallHit = true;
    } else if (b.x + b.radius >= state.width) {
      b.x = state.width - b.radius;
      b.vx = -Math.abs(b.vx);
      b.bounceCount = (b.bounceCount ?? 0) + 1;
      events.wallHit = true;
    }

    // Top wall bounce (electric ceiling)
    if (b.y - b.radius <= 12) {
      b.y = 12 + b.radius;
      b.vy = Math.abs(b.vy);
      b.bounceCount = (b.bounceCount ?? 0) + 1;
      events.wallHit = true;
      events.ceilingHit = { x: b.x, y: b.y };
    }

    // Anti-loop break
    if ((b.bounceCount ?? 0) >= 8) {
      b.vy = Math.abs(b.vy) + 40;
      b.bounceCount = 0;
    }

    // Paddle collision
    if (
      b.vy > 0 &&
      b.y + b.radius >= state.paddleY &&
      b.y - b.radius <= state.paddleY + state.paddleHeight &&
      b.x >= state.paddleX - b.radius &&
      b.x <= state.paddleX + state.paddleWidth + b.radius
    ) {
      b.y = state.paddleY - b.radius;
      events.paddleHit = true;
      state.combo = 0;

      const hitOffset = (b.x - (state.paddleX + state.paddleWidth / 2)) / (state.paddleWidth / 2);
      const clampedOffset = Math.max(-0.85, Math.min(0.85, hitOffset));
      const currentSpeed = Math.hypot(b.vx, b.vy);
      const baseAngle = -Math.PI / 2 + clampedOffset * (Math.PI / 3);
      b.vx = Math.sin(baseAngle + Math.PI / 2) * currentSpeed + state.paddleVx * 0.12;
      b.vy = -Math.abs(Math.cos(baseAngle + Math.PI / 2) * currentSpeed);
      const newSpeed = Math.hypot(b.vx, b.vy);
      if (newSpeed > 0) {
        b.vx = (b.vx / newSpeed) * currentSpeed;
        b.vy = (b.vy / newSpeed) * currentSpeed;
      }
    }

    // Field Orbs collision (+Ball, Laser Cross, Bomb)
    for (let o = state.fieldOrbs.length - 1; o >= 0; o--) {
      const orb = state.fieldOrbs[o]!;
      if (orb.collected) continue;
      const distSq = (b.x - orb.x) ** 2 + (b.y - orb.y) ** 2;
      if (distSq <= (b.radius + orb.radius) ** 2) {
        orb.collected = true;
        events.orbCollected = orb.type;
        triggerFieldOrb(state, orb, events);
        state.fieldOrbs.splice(o, 1);
      }
    }

    // Brick collisions
    for (let j = state.bricks.length - 1; j >= 0; j--) {
      const brick = state.bricks[j]!;
      if (circleRectOverlap(b.x, b.y, b.radius, brick.x, brick.y, brick.width, brick.height)) {
        events.brickHit = true;
        b.bounceCount = 0;

        const prevX = b.x - b.vx * dt;
        if (prevX < brick.x) {
          b.vx = -Math.abs(b.vx);
          b.x = brick.x - b.radius;
        } else if (prevX > brick.x + brick.width) {
          b.vx = Math.abs(b.vx);
          b.x = brick.x + brick.width + b.radius;
        } else if (b.vy > 0) {
          b.vy = -Math.abs(b.vy);
          b.y = brick.y - b.radius;
        } else {
          b.vy = Math.abs(b.vy);
          b.y = brick.y + brick.height + b.radius;
        }

        // Damage brick (handles armor, TNT, laser, splitter)
        damageBrick(state, j, 1, events, b);
        break;
      }
    }

    // Bottom exit
    if (b.y - b.radius > state.height) {
      if (state.ballsReturned === 0) {
        state.nextLauncherX = Math.max(20, Math.min(state.width - 20, b.x));
      }
      state.ballsReturned++;
      state.balls.splice(i, 1);
    }
  }

  // Wave complete
  if (state.bricks.length === 0) {
    events.waveCleared = true;
    state.wave++;
    state.score += 1000;
    if (state.score > state.highScore) state.highScore = state.score;

    state.bricks = createBricksForWave(state.width, state.wave);
    state.fieldOrbs = createFieldOrbsForWave(state.width, state.wave);
    state.initialBricksInStage = state.bricks.length;
    state.launched = false;
    state.roundInProgress = false;
    state.launchQueue = 0;
    state.turnsTaken = 0;
    state.totalBalls += state.ballsToAddNextRound;
    state.ballsToAddNextRound = 0;

    state.balls = [
      {
        x: state.launcherX,
        y: state.paddleY - 8,
        vx: 180 + state.wave * 12,
        vy: -(240 + state.wave * 12),
        radius: 6,
      },
    ];

    state.aimTrajectory = calculateAimTrajectory(
      state.launcherX,
      state.launcherY,
      state.aimAngle,
      state.width,
      state.height,
      state.bricks,
    );

    return events;
  }

  // All balls returned to floor
  if (state.launched && state.balls.length === 0 && state.launchQueue === 0) {
    events.roundEnded = true;
    state.launched = false;
    state.roundInProgress = false;
    state.turnsTaken++;
    state.totalBalls += state.ballsToAddNextRound;
    state.ballsToAddNextRound = 0;

    state.launcherX = state.nextLauncherX;
    state.paddleX = Math.max(
      0,
      Math.min(state.width - state.paddleWidth, state.launcherX - state.paddleWidth / 2),
    );

    state.balls = [
      {
        x: state.launcherX,
        y: state.paddleY - 8,
        vx: 180,
        vy: -240,
        radius: 6,
      },
    ];

    state.aimTrajectory = calculateAimTrajectory(
      state.launcherX,
      state.launcherY,
      state.aimAngle,
      state.width,
      state.height,
      state.bricks,
    );
  }

  return events;
}

function damageBrick(
  state: BreakerGameState,
  brickIndex: number,
  damage: number,
  events: BreakerEvents,
  hitBall?: Ball,
): void {
  const brick = state.bricks[brickIndex];
  if (!brick) return;

  // 1. Armor absorbs hits before standard HP
  if (brick.armorHits && brick.armorHits > 0) {
    brick.armorHits -= damage;
    if (brick.armorHits < 0) {
      brick.hitsLeft += brick.armorHits;
      brick.armorHits = 0;
    }
  } else {
    brick.hitsLeft -= damage;
  }

  if (brick.hitsLeft <= 0) {
    state.combo++;
    events.combo = state.combo;
    events.brickDestroyed = true;
    events.destroyedBrick = brick;

    const comboBonus = Math.min(250, (state.combo - 1) * 25);
    state.score += brick.points + comboBonus;
    if (state.score > state.highScore) state.highScore = state.score;

    if (brick.powerUp) {
      state.powerUps.push({
        id: Date.now() + Math.random(),
        x: brick.x + brick.width / 2,
        y: brick.y + brick.height / 2,
        vy: 140,
        type: brick.powerUp,
      });
    }

    const destroyed = state.bricks.splice(brickIndex, 1)[0]!;

    // 2. Special Brick Effects
    if (destroyed.special === "tnt") {
      triggerTNTExplosion(state, destroyed, events);
    } else if (destroyed.special === "laser_cross") {
      triggerLaserCross(state, destroyed, events);
    } else if (destroyed.special === "splitter") {
      triggerSplitter(state, destroyed, events, hitBall);
    }
  }
}

function triggerTNTExplosion(state: BreakerGameState, tnt: Brick, events: BreakerEvents): void {
  const cx = tnt.x + tnt.width / 2;
  const cy = tnt.y + tnt.height / 2;
  const radius = 68;

  events.tntExplosions.push({ x: cx, y: cy, radius });

  // Damage all bricks within radius
  for (let i = state.bricks.length - 1; i >= 0; i--) {
    const b = state.bricks[i]!;
    const bcx = b.x + b.width / 2;
    const bcy = b.y + b.height / 2;
    const dist = Math.hypot(bcx - cx, bcy - cy);
    if (dist <= radius) {
      damageBrick(state, i, 15, events);
    }
  }
}

function triggerLaserCross(state: BreakerGameState, laserBrick: Brick, events: BreakerEvents): void {
  const cx = laserBrick.x + laserBrick.width / 2;
  const cy = laserBrick.y + laserBrick.height / 2;

  events.laserBeams.push({ x: cx, y: cy });

  for (let i = state.bricks.length - 1; i >= 0; i--) {
    const b = state.bricks[i]!;
    const inRow = cy >= b.y && cy <= b.y + b.height;
    const inCol = cx >= b.x && cx <= b.x + b.width;
    if (inRow || inCol) {
      damageBrick(state, i, 12, events);
    }
  }
}

function triggerSplitter(
  state: BreakerGameState,
  splitter: Brick,
  events: BreakerEvents,
  hitBall?: Ball,
): void {
  const cx = splitter.x + splitter.width / 2;
  const cy = splitter.y + splitter.height / 2;

  events.splitterTriggered = { x: cx, y: cy };

  if (hitBall) {
    state.balls.push(
      {
        x: cx,
        y: cy,
        vx: hitBall.vx * 0.8 - hitBall.vy * 0.5,
        vy: hitBall.vy * 0.8 + hitBall.vx * 0.5,
        radius: 6,
      },
      {
        x: cx,
        y: cy,
        vx: hitBall.vx * 0.8 + hitBall.vy * 0.5,
        vy: hitBall.vy * 0.8 - hitBall.vx * 0.5,
        radius: 6,
      },
    );
  }
}

function triggerFieldOrb(state: BreakerGameState, orb: FieldOrb, events: BreakerEvents): void {
  if (orb.type === "add_ball") {
    state.totalBalls += 1;
    state.score += 50;
  } else if (orb.type === "laser_cross") {
    state.score += 100;
    const blastRowY = orb.y;
    const blastColX = orb.x;
    events.laserBeams.push({ x: blastColX, y: blastRowY });
    for (let i = state.bricks.length - 1; i >= 0; i--) {
      const b = state.bricks[i]!;
      const inRow = blastRowY >= b.y && blastRowY <= b.y + b.height;
      const inCol = blastColX >= b.x && blastColX <= b.x + b.width;
      if (inRow || inCol) {
        damageBrick(state, i, 8, events);
      }
    }
  } else if (orb.type === "bomb") {
    state.score += 150;
    const bombRadius = 65;
    events.tntExplosions.push({ x: orb.x, y: orb.y, radius: bombRadius });
    for (let i = state.bricks.length - 1; i >= 0; i--) {
      const b = state.bricks[i]!;
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const dist = Math.hypot(cx - orb.x, cy - orb.y);
      if (dist <= bombRadius) {
        damageBrick(state, i, 12, events);
      }
    }
  }
}

function applyPowerUp(state: BreakerGameState, type: BreakerPowerType): void {
  if (type === "multiball") {
    const existing = state.balls[0] ?? {
      x: state.paddleX + state.paddleWidth / 2,
      y: state.paddleY - 12,
      vx: 180,
      vy: -240,
      radius: 6,
    };
    const spawnY = Math.min(existing.y, state.paddleY - 14);
    state.balls.push(
      { ...existing, y: spawnY, vx: existing.vx * 0.8 - 120, vy: -Math.abs(existing.vy) },
      { ...existing, y: spawnY, vx: existing.vx * 0.8 + 120, vy: -Math.abs(existing.vy) },
    );
  } else if (type === "expand") {
    state.paddleWidth = state.paddleBaseWidth * 1.5;
    state.paddleX = Math.max(0, Math.min(state.width - state.paddleWidth, state.paddleX));
    state.expandTimerMs = 8000;
  } else if (type === "laser") {
    state.laserAmmo += 6;
  }
}

function circleRectOverlap(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}
