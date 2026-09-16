export type BreakerPowerType = "multiball" | "laser" | "expand";

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
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
}

const BRICK_COLORS = ["#00F2FF", "#9900FF", "#FF007F", "#FFD700", "#00FF66"];

export function createBricksForWave(width: number, wave: number): Brick[] {
  const bricks: Brick[] = [];
  const rows = Math.min(7, 3 + wave);
  const cols = 7;
  const padX = 14;
  const padY = 48;
  const spacing = 6;
  const brickW = (width - padX * 2 - (cols - 1) * spacing) / cols;
  const brickH = 18;

  let id = 0;
  for (let r = 0; r < rows; r++) {
    const hits = r === 0 && wave > 1 ? 2 : 1;
    const color = BRICK_COLORS[r % BRICK_COLORS.length]!;
    for (let c = 0; c < cols; c++) {
      id++;
      const x = padX + c * (brickW + spacing);
      const y = padY + r * (brickH + spacing);

      let powerUp: BreakerPowerType | undefined;
      const roll = ((id * 37 + wave * 13) % 100) / 100;
      if (roll < 0.12) powerUp = "multiball";
      else if (roll < 0.22) powerUp = "laser";
      else if (roll < 0.32) powerUp = "expand";

      bricks.push({
        id,
        x,
        y,
        width: brickW,
        height: brickH,
        hitsLeft: hits,
        maxHits: hits,
        color,
        points: hits * 50,
        powerUp,
      });
    }
  }
  return bricks;
}

export function createBreakerGame(
  width = 360,
  height = 500,
  highScore = 0,
): BreakerGameState {
  const paddleWidth = 74;
  const paddleHeight = 12;
  const paddleX = (width - paddleWidth) / 2;
  const paddleY = height - 42;

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
        x: paddleX + paddleWidth / 2,
        y: paddleY - 8,
        vx: 180,
        vy: -240,
        radius: 6,
      },
    ],
    bricks: createBricksForWave(width, 1),
    powerUps: [],
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
  };

  return state;
}

export function movePaddle(state: BreakerGameState, targetCenterX: number, dt = 0.016): void {
  const half = state.paddleWidth / 2;
  const newX = Math.max(0, Math.min(state.width - state.paddleWidth, targetCenterX - half));
  if (dt > 0) {
    state.paddleVx = (newX - state.paddleX) / dt;
  }
  state.paddleX = newX;
  if (!state.launched && state.balls.length > 0) {
    state.balls[0]!.x = state.paddleX + half;
    state.balls[0]!.y = state.paddleY - 8;
  }
}

export function launchBall(state: BreakerGameState): boolean {
  if (state.launched || state.gameOver) return false;
  state.launched = true;
  return true;
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
  brickHit: boolean;
  brickDestroyed: boolean;
  destroyedBrick?: Brick;
  powerUpCollected?: BreakerPowerType;
  lostLife: boolean;
  waveCleared: boolean;
  combo: number;
}

export function tickBreaker(state: BreakerGameState, dtMs: number): BreakerEvents {
  const events: BreakerEvents = {
    paddleHit: false,
    wallHit: false,
    brickHit: false,
    brickDestroyed: false,
    lostLife: false,
    waveCleared: false,
    combo: state.combo,
  };

  if (state.gameOver || state.paused) return events;
  const dt = dtMs / 1000;

  // Timers
  if (state.expandTimerMs > 0) {
    state.expandTimerMs -= dtMs;
    if (state.expandTimerMs <= 0) {
      state.paddleWidth = state.paddleBaseWidth;
      state.expandTimerMs = 0;
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
    // Check collision with bricks
    for (let b = state.bricks.length - 1; b >= 0; b--) {
      const brick = state.bricks[b]!;
      if (
        l.x >= brick.x &&
        l.x <= brick.x + brick.width &&
        l.y >= brick.y &&
        l.y <= brick.y + brick.height
      ) {
        state.lasers.splice(i, 1);
        brick.hitsLeft--;
        events.brickHit = true;
        if (brick.hitsLeft <= 0) {
          events.brickDestroyed = true;
          events.destroyedBrick = brick;
          state.score += brick.points;
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
          state.bricks.splice(b, 1);
        }
        break;
      }
    }
  }

  // Power-up drops
  for (let i = state.powerUps.length - 1; i >= 0; i--) {
    const p = state.powerUps[i]!;
    p.y += p.vy * dt;

    // Paddle catch
    if (
      p.y >= state.paddleY &&
      p.y <= state.paddleY + state.paddleHeight &&
      p.x >= state.paddleX &&
      p.x <= state.paddleX + state.paddleWidth
    ) {
      events.powerUpCollected = p.type;
      applyPowerUp(state, p.type);
      state.powerUps.splice(i, 1);
      continue;
    }

    // Off screen bottom
    if (p.y > state.height) {
      state.powerUps.splice(i, 1);
    }
  }

  // Balls physics
  if (!state.launched) {
    if (state.balls.length > 0) {
      state.balls[0]!.x = state.paddleX + state.paddleWidth / 2;
      state.balls[0]!.y = state.paddleY - 8;
    }
    return events;
  }

  for (let i = state.balls.length - 1; i >= 0; i--) {
    const b = state.balls[i]!;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Left / Right wall bounce
    if (b.x - b.radius <= 0) {
      b.x = b.radius;
      b.vx = Math.abs(b.vx);
      events.wallHit = true;
    } else if (b.x + b.radius >= state.width) {
      b.x = state.width - b.radius;
      b.vx = -Math.abs(b.vx);
      events.wallHit = true;
    }

    // Top wall bounce
    if (b.y - b.radius <= 0) {
      b.y = b.radius;
      b.vy = Math.abs(b.vy);
      events.wallHit = true;
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
      state.combo = 0; // Reset combo when ball returns to paddle

      // Angular bounce based on hit location
      const hitOffset = (b.x - (state.paddleX + state.paddleWidth / 2)) / (state.paddleWidth / 2);
      const clampedOffset = Math.max(-0.85, Math.min(0.85, hitOffset));
      const currentSpeed = Math.hypot(b.vx, b.vy);
      const baseAngle = -Math.PI / 2 + clampedOffset * (Math.PI / 3);
      b.vx = Math.sin(baseAngle + Math.PI / 2) * currentSpeed + state.paddleVx * 0.12;
      b.vy = -Math.abs(Math.cos(baseAngle + Math.PI / 2) * currentSpeed);
      // Re-normalize speed
      const newSpeed = Math.hypot(b.vx, b.vy);
      if (newSpeed > 0) {
        b.vx = (b.vx / newSpeed) * currentSpeed;
        b.vy = (b.vy / newSpeed) * currentSpeed;
      }
    }

    // Brick collisions
    for (let j = state.bricks.length - 1; j >= 0; j--) {
      const brick = state.bricks[j]!;
      if (circleRectOverlap(b.x, b.y, b.radius, brick.x, brick.y, brick.width, brick.height)) {
        events.brickHit = true;

        // Determine bounce axis
        const prevX = b.x - b.vx * dt;
        if (prevX < brick.x || prevX > brick.x + brick.width) {
          b.vx = -b.vx;
        } else {
          b.vy = -b.vy;
        }

        brick.hitsLeft--;
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
          state.bricks.splice(j, 1);
        }
        break;
      }
    }

    // Bottom loss
    if (b.y - b.radius > state.height) {
      state.balls.splice(i, 1);
    }
  }

  // Check wave complete
  if (state.bricks.length === 0) {
    events.waveCleared = true;
    state.wave++;
    state.score += 500;
    if (state.score > state.highScore) state.highScore = state.score;
    state.bricks = createBricksForWave(state.width, state.wave);
    state.launched = false;
    state.balls = [
      {
        x: state.paddleX + state.paddleWidth / 2,
        y: state.paddleY - 8,
        vx: 180 + state.wave * 15,
        vy: -(240 + state.wave * 15),
        radius: 6,
      },
    ];
    return events;
  }

  // Check life loss
  if (state.balls.length === 0) {
    state.lives--;
    events.lostLife = true;
    if (state.lives <= 0) {
      state.gameOver = true;
    } else {
      state.launched = false;
      state.balls = [
        {
          x: state.paddleX + state.paddleWidth / 2,
          y: state.paddleY - 8,
          vx: 180,
          vy: -240,
          radius: 6,
        },
      ];
    }
  }

  return events;
}

function applyPowerUp(state: BreakerGameState, type: BreakerPowerType): void {
  if (type === "multiball") {
    const existing = state.balls[0] ?? {
      x: state.paddleX + state.paddleWidth / 2,
      y: state.paddleY - 8,
      vx: 180,
      vy: -240,
      radius: 6,
    };
    state.balls.push(
      { ...existing, vx: existing.vx * 0.8 - 120, vy: -Math.abs(existing.vy) },
      { ...existing, vx: existing.vx * 0.8 + 120, vy: -Math.abs(existing.vy) },
    );
  } else if (type === "expand") {
    state.paddleWidth = state.paddleBaseWidth * 1.5;
    state.expandTimerMs = 8000; // 8s
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
