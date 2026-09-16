import { describe, expect, it } from "vitest";
import {
  createBreakerGame,
  movePaddle,
  launchBall,
  tickBreaker,
} from "../src/games/breaker/engine";

describe("Neon Breaker Engine", () => {
  it("initializes breaker game with correct defaults", () => {
    const game = createBreakerGame(360, 480, 500);
    expect(game.balls.length).toBe(1);
    expect(game.bricks.length).toBeGreaterThan(10);
    expect(game.lives).toBe(3);
    expect(game.score).toBe(0);
    expect(game.highScore).toBe(500);
    expect(game.launched).toBe(false);
  });

  it("moves paddle within bounds and moves unlaunched ball with it", () => {
    const game = createBreakerGame(360, 480);
    movePaddle(game, 100);
    expect(game.paddleX).toBe(100 - game.paddleWidth / 2);
    expect(game.balls[0]!.x).toBe(100);

    // Test clamped left bound
    movePaddle(game, -50);
    expect(game.paddleX).toBe(0);

    // Test clamped right bound
    movePaddle(game, 500);
    expect(game.paddleX).toBe(360 - game.paddleWidth);
  });

  it("launches ball and updates position on tick", () => {
    const game = createBreakerGame(360, 480);
    const startY = game.balls[0]!.y;
    expect(launchBall(game)).toBe(true);
    expect(game.launched).toBe(true);

    tickBreaker(game, 50);
    expect(game.balls[0]!.y).toBeLessThan(startY);
  });

  it("bounces ball off side walls", () => {
    const game = createBreakerGame(360, 480);
    game.launched = true;
    const b = game.balls[0]!;
    b.x = 2;
    b.vx = -100;
    b.y = 200;
    b.vy = 0;

    const events = tickBreaker(game, 50);
    expect(events.wallHit).toBe(true);
    expect(b.vx).toBeGreaterThan(0);
  });

  it("destroys brick on collision and awards score", () => {
    const game = createBreakerGame(360, 480);
    game.launched = true;
    const targetBrick = game.bricks[0]!;
    targetBrick.hitsLeft = 1;
    const b = game.balls[0]!;
    b.x = targetBrick.x + targetBrick.width / 2;
    b.y = targetBrick.y + targetBrick.height / 2;
    b.vx = 0;
    b.vy = 50;

    const initialBrickCount = game.bricks.length;
    const events = tickBreaker(game, 20);
    expect(events.brickHit).toBe(true);
    expect(events.brickDestroyed).toBe(true);
    expect(game.bricks.length).toBe(initialBrickCount - 1);
    expect(game.score).toBeGreaterThan(0);
  });
});
