export type PowerUpType = "phase" | "slowmo" | "multiplier";

export interface SnakeSegment {
  x: number;
  y: number;
}

export interface FoodItem {
  x: number;
  y: number;
  type: "energy" | PowerUpType;
  points: number;
}

export interface ActivePowerUp {
  type: PowerUpType;
  remainingMs: number;
}

export interface SnakeGameState {
  width: number;
  height: number;
  snake: SnakeSegment[];
  dir: SnakeSegment;
  nextDir: SnakeSegment;
  food: FoodItem | null;
  score: number;
  highScore: number;
  combo: number;
  comboTimerMs: number;
  alive: boolean;
  paused: boolean;
  activePowerUp: ActivePowerUp | null;
  moveTimerMs: number;
  baseIntervalMs: number;
}

export function createSnakeGame(
  width = 20,
  height = 20,
  highScore = 0,
): SnakeGameState {
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  const state: SnakeGameState = {
    width,
    height,
    snake: [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY },
    ],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: null,
    score: 0,
    highScore,
    combo: 0,
    comboTimerMs: 0,
    alive: true,
    paused: false,
    activePowerUp: null,
    moveTimerMs: 0,
    baseIntervalMs: 120,
  };
  state.food = spawnFood(state);
  return state;
}

export function setDirection(state: SnakeGameState, dir: SnakeSegment): boolean {
  if (!state.alive || state.paused) return false;
  // Cannot turn directly back on yourself
  if (dir.x + state.dir.x === 0 && dir.y + state.dir.y === 0) {
    return false;
  }
  state.nextDir = { x: Math.sign(dir.x), y: Math.sign(dir.y) };
  return true;
}

export function spawnFood(state: SnakeGameState, rng = Math.random): FoodItem | null {
  const occupied = new Set(state.snake.map((s) => `${s.x},${s.y}`));
  const available: SnakeSegment[] = [];
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!occupied.has(`${x},${y}`)) {
        available.push({ x, y });
      }
    }
  }
  if (available.length === 0) return null;
  const idx = Math.floor(rng() * available.length);
  const pos = available[idx]!;

  const roll = rng();
  let type: "energy" | PowerUpType = "energy";
  let points = 10;
  if (roll < 0.1) {
    type = "multiplier";
    points = 25;
  } else if (roll < 0.18) {
    type = "slowmo";
    points = 15;
  } else if (roll < 0.25) {
    type = "phase";
    points = 20;
  }

  return { x: pos.x, y: pos.y, type, points };
}

export interface SnakeStepResult {
  moved: boolean;
  ateFood: boolean;
  foodType?: "energy" | PowerUpType;
  died: boolean;
  scoreGained: number;
}

export function tickSnake(state: SnakeGameState, dt: number): SnakeStepResult {
  const result: SnakeStepResult = {
    moved: false,
    ateFood: false,
    died: false,
    scoreGained: 0,
  };

  if (!state.alive || state.paused) return result;

  // Update combo timer
  if (state.comboTimerMs > 0) {
    state.comboTimerMs -= dt;
    if (state.comboTimerMs <= 0) {
      state.combo = 0;
      state.comboTimerMs = 0;
    }
  }

  // Update active power-up
  if (state.activePowerUp) {
    state.activePowerUp.remainingMs -= dt;
    if (state.activePowerUp.remainingMs <= 0) {
      state.activePowerUp = null;
    }
  }

  // Speed calculation
  let speedMultiplier = 1;
  if (state.activePowerUp?.type === "slowmo") {
    speedMultiplier = 0.65;
  }
  // Snake gently speeds up as it grows
  const speedBonus = Math.min(40, state.snake.length * 1.5);
  const interval = (state.baseIntervalMs - speedBonus) / speedMultiplier;

  state.moveTimerMs += dt;
  if (state.moveTimerMs < interval) {
    return result;
  }
  state.moveTimerMs -= interval;
  result.moved = true;

  state.dir = { ...state.nextDir };
  const head = state.snake[0]!;
  let nextX = head.x + state.dir.x;
  let nextY = head.y + state.dir.y;

  const isPhase = state.activePowerUp?.type === "phase";

  // Wall collision or wrap if phase
  if (nextX < 0 || nextX >= state.width || nextY < 0 || nextY >= state.height) {
    if (isPhase) {
      nextX = (nextX + state.width) % state.width;
      nextY = (nextY + state.height) % state.height;
    } else {
      state.alive = false;
      result.died = true;
      return result;
    }
  }

  // Tail collision
  const willHitTail = state.snake.some((seg, i) => {
    // Exclude the very last tail segment if we aren't eating
    if (i === state.snake.length - 1) return false;
    return seg.x === nextX && seg.y === nextY;
  });

  if (willHitTail && !isPhase) {
    state.alive = false;
    result.died = true;
    return result;
  }

  const newHead = { x: nextX, y: nextY };
  state.snake.unshift(newHead);

  // Check food
  if (state.food && state.food.x === nextX && state.food.y === nextY) {
    result.ateFood = true;
    result.foodType = state.food.type;

    state.combo += 1;
    state.comboTimerMs = 3500; // 3.5s combo window

    let scoreMult = state.combo;
    if (state.activePowerUp?.type === "multiplier") {
      scoreMult *= 2;
    }

    const gained = state.food.points * scoreMult;
    state.score += gained;
    result.scoreGained = gained;
    if (state.score > state.highScore) {
      state.highScore = state.score;
    }

    if (state.food.type !== "energy") {
      state.activePowerUp = {
        type: state.food.type,
        remainingMs: 6000, // 6 seconds duration
      };
    }

    state.food = spawnFood(state);
  } else {
    state.snake.pop();
  }

  return result;
}
