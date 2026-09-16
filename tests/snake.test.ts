import { describe, expect, it } from "vitest";
import {
  createSnakeGame,
  setDirection,
  tickSnake,
} from "../src/games/snake/engine";

describe("Cyber Snake Engine", () => {
  it("initializes snake with default segments and direction", () => {
    const game = createSnakeGame(20, 20, 100);
    expect(game.snake.length).toBe(3);
    expect(game.dir).toEqual({ x: 1, y: 0 });
    expect(game.alive).toBe(true);
    expect(game.score).toBe(0);
    expect(game.highScore).toBe(100);
    expect(game.food).not.toBeNull();
  });

  it("prevents turning 180 degrees backwards", () => {
    const game = createSnakeGame(20, 20);
    // moving right: cannot move left
    const ok = setDirection(game, { x: -1, y: 0 });
    expect(ok).toBe(false);
    expect(game.nextDir).toEqual({ x: 1, y: 0 });

    // can turn up
    const upOk = setDirection(game, { x: 0, y: -1 });
    expect(upOk).toBe(true);
    expect(game.nextDir).toEqual({ x: 0, y: -1 });
  });

  it("moves forward on tick interval", () => {
    const game = createSnakeGame(20, 20);
    const startX = game.snake[0]!.x;

    // Tick before interval should not move
    const res1 = tickSnake(game, 50);
    expect(res1.moved).toBe(false);
    expect(game.snake[0]!.x).toBe(startX);

    // Tick exceeding interval moves one cell
    const res2 = tickSnake(game, 150);
    expect(res2.moved).toBe(true);
    expect(game.snake[0]!.x).toBe(startX + 1);
  });

  it("dies on wall collision when not phased", () => {
    const game = createSnakeGame(10, 10);
    game.snake = [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }];
    game.dir = { x: 1, y: 0 };
    game.nextDir = { x: 1, y: 0 };

    const res = tickSnake(game, 200);
    expect(res.died).toBe(true);
    expect(game.alive).toBe(false);
  });

  it("wraps around walls when phase powerup is active", () => {
    const game = createSnakeGame(10, 10);
    game.snake = [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }];
    game.dir = { x: 1, y: 0 };
    game.nextDir = { x: 1, y: 0 };
    game.activePowerUp = { type: "phase", remainingMs: 3000 };

    const res = tickSnake(game, 200);
    expect(res.died).toBe(false);
    expect(game.alive).toBe(true);
    expect(game.snake[0]!.x).toBe(0);
  });

  it("grows and increments score upon eating food", () => {
    const game = createSnakeGame(10, 10);
    const head = game.snake[0]!;
    // Place food directly in path
    game.food = { x: head.x + 1, y: head.y, type: "energy", points: 10 };
    const prevLen = game.snake.length;

    const res = tickSnake(game, 200);
    expect(res.ateFood).toBe(true);
    expect(game.snake.length).toBe(prevLen + 1);
    expect(game.score).toBeGreaterThan(0);
    expect(game.food).not.toBeNull();
  });

  it("buffers double turns in input queue", () => {
    const game = createSnakeGame(20, 20);
    // Moving right currently
    // Turn down, then turn left in rapid succession
    setDirection(game, { x: 0, y: 1 }); // Down
    setDirection(game, { x: -1, y: 0 }); // Left
    expect(game.inputQueue.length).toBe(2);

    // First tick: executes down
    tickSnake(game, 200);
    expect(game.dir).toEqual({ x: 0, y: 1 });
    expect(game.inputQueue.length).toBe(1);

    // Second tick: executes left
    tickSnake(game, 200);
    expect(game.dir).toEqual({ x: -1, y: 0 });
    expect(game.inputQueue.length).toBe(0);
  });
});
