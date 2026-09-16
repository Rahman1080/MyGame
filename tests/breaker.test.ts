import { describe, expect, it } from "vitest";
import {
  createBreakerGame,
  movePaddle,
  launchBall,
  tickBreaker,
  recallBalls,
  setSpeedMultiplier,
  createBricksForWave,
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
    expect(game.combo).toBe(1);
  });

  it("resets combo when ball hits paddle", () => {
    const game = createBreakerGame(360, 480);
    game.launched = true;
    game.combo = 4;
    const b = game.balls[0]!;
    b.x = game.paddleX + game.paddleWidth / 2;
    b.y = game.paddleY - b.radius + 1;
    b.vx = 0;
    b.vy = 100;

    const events = tickBreaker(game, 20);
    expect(events.paddleHit).toBe(true);
    expect(game.combo).toBe(0);
  });

  it("calculates aim trajectory reflecting off walls", () => {
    const game = createBreakerGame(360, 480);
    expect(game.aimTrajectory.length).toBeGreaterThan(0);
    expect(game.aimTrajectory[0]!.x1).toBe(game.launcherX);
    expect(game.aimTrajectory[0]!.y1).toBe(game.launcherY);
  });

  it("launches multi-ball barrage stream and decrements queue", () => {
    const game = createBreakerGame(360, 480);
    game.totalBalls = 20;
    launchBall(game, -Math.PI / 2);
    expect(game.launched).toBe(true);
    expect(game.launchQueue).toBe(19);

    // After ticking through stream spawn intervals, additional balls spawn
    tickBreaker(game, 100);
    expect(game.balls.length).toBeGreaterThan(1);
    expect(game.launchQueue).toBeLessThan(19);
  });

  it("recalls balls immediately back to the launcher floor", () => {
    const game = createBreakerGame(360, 480);
    launchBall(game, -Math.PI / 2);
    tickBreaker(game, 100);
    expect(game.launched).toBe(true);

    const recalled = recallBalls(game);
    expect(recalled).toBe(true);
    expect(game.launched).toBe(false);
    expect(game.balls.length).toBe(1);
    expect(game.launchQueue).toBe(0);
  });

  it("cycles speed multiplier correctly", () => {
    const game = createBreakerGame(360, 480);
    expect(game.speedMultiplier).toBe(1);
    setSpeedMultiplier(game, 2);
    expect(game.speedMultiplier).toBe(2);
    setSpeedMultiplier(game, 3);
    expect(game.speedMultiplier).toBe(3);
    setSpeedMultiplier(game, 5);
    expect(game.speedMultiplier).toBe(5);
  });

  it("prevents balls from getting trapped in near-horizontal loops (anti-stuck guard)", () => {
    const game = createBreakerGame(360, 480);
    game.launched = true;
    const b = game.balls[0]!;
    b.x = 100;
    b.y = 200;
    b.vx = 200;
    b.vy = 2; // dangerously close to zero (flat horizontal)

    tickBreaker(game, 20);
    // Anti-stuck guard should have nudged vy to maintain vertical movement
    expect(Math.abs(b.vy)).toBeGreaterThanOrEqual(25);
  });

  it("breaks infinite wall-to-wall bounces by deflecting downward", () => {
    const game = createBreakerGame(360, 480);
    game.launched = true;
    const b = game.balls[0]!;
    b.bounceCount = 8;
    b.x = 2;
    b.vx = -100;
    b.y = 200;
    b.vy = -10;

    tickBreaker(game, 20);
    // Should have deflected downward and reset bounce count
    expect(b.vy).toBeGreaterThan(0);
    expect(b.bounceCount).toBe(0);
  });

  it("triggers field orbs like add_ball and increases total balls", () => {
    const game = createBreakerGame(360, 480);
    game.launched = true;
    const initialBalls = game.totalBalls;

    // Simulate ball hitting first field orb
    const targetOrb = game.fieldOrbs[0]!;
    const b = game.balls[0]!;
    b.x = targetOrb.x;
    b.y = targetOrb.y;

    const events = tickBreaker(game, 16);
    expect(events.orbCollected).toBeDefined();
    if (events.orbCollected === "add_ball") {
      expect(game.totalBalls).toBe(initialBalls + 1);
    }
  });

  it("generates distinct handcrafted maze levels across waves 1 to 5 and ensures top row coverage", () => {
    const wave1 = createBricksForWave(360, 1);
    const wave2 = createBricksForWave(360, 2);
    const wave3 = createBricksForWave(360, 3);
    const wave4 = createBricksForWave(360, 4);
    const wave5 = createBricksForWave(360, 5);

    expect(wave1.length).toBeGreaterThan(15);
    expect(wave2.length).toBeGreaterThan(20);
    expect(wave3.length).toBeGreaterThan(20);
    expect(wave4.length).toBeGreaterThan(15);
    expect(wave5.length).toBeGreaterThan(15);

    // Verify bricks have hit counters
    for (const b of wave1) {
      expect(b.hitsLeft).toBeGreaterThan(0);
      expect(b.maxHits).toBeGreaterThan(0);
    }
  });

  it("ensures top row has obstacles across waves 1 to 30 without empty voids at top", () => {
    for (let w = 1; w <= 30; w++) {
      const bricks = createBricksForWave(360, w);
      expect(bricks.length).toBeGreaterThan(12);

      // Verify that the top row (y = 24) is always populated
      const minY = Math.min(...bricks.map((b) => b.y));
      expect(minY).toBe(24);

      // Verify there are multiple bricks in row 0
      const topRowBricks = bricks.filter((b) => b.y === 24);
      expect(topRowBricks.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("triggers TNT explosions damaging neighboring bricks", () => {
    const game = createBreakerGame(360, 480);
    game.launched = true;

    // Create a TNT brick with 1 hit and a neighbor
    game.bricks = [
      {
        id: 100,
        x: 100,
        y: 100,
        width: 30,
        height: 15,
        hitsLeft: 1,
        maxHits: 1,
        color: "#FF2A2A",
        points: 50,
        special: "tnt",
      },
      {
        id: 101,
        x: 135,
        y: 100,
        width: 30,
        height: 15,
        hitsLeft: 20,
        maxHits: 20,
        color: "#00FF66",
        points: 50,
        special: "normal",
      },
    ];

    const b = game.balls[0]!;
    b.x = 105;
    b.y = 105;
    b.vx = 0;
    b.vy = 50;

    const events = tickBreaker(game, 20);
    expect(events.brickDestroyed).toBe(true);
    expect(events.tntExplosions.length).toBeGreaterThan(0);
    // Neighbor should have taken 15 explosion blast damage
    const neighbor = game.bricks.find((br) => br.id === 101);
    expect(neighbor).toBeDefined();
    expect(neighbor!.hitsLeft).toBeLessThan(20);
  });

  it("absorbs ball impact with armor hits before brick takes damage", () => {
    const game = createBreakerGame(360, 480);
    game.launched = true;

    const armorBrick = {
      id: 200,
      x: 100,
      y: 100,
      width: 30,
      height: 15,
      hitsLeft: 10,
      maxHits: 10,
      color: "#80DEEA",
      points: 50,
      special: "armor" as const,
      armorHits: 2,
      maxArmorHits: 2,
    };
    game.bricks = [armorBrick];

    const b = game.balls[0]!;
    b.x = 105;
    b.y = 105;
    b.vx = 0;
    b.vy = 50;

    const events = tickBreaker(game, 20);
    expect(events.brickHit).toBe(true);
    expect(events.brickDestroyed).toBe(false);
    expect(armorBrick.armorHits).toBe(1);
    expect(armorBrick.hitsLeft).toBe(10); // HP untouched while armor active
  });
});

