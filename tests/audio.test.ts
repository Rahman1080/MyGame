import { describe, expect, it } from "vitest";
import { createAudio, createHaptics } from "../src/platform/services/audio";

describe("audio service", () => {
  it("all cues are safe to call with no AudioContext (muted)", () => {
    const a = createAudio(true);
    expect(() => {
      a.tap();
      a.select();
      a.move();
      a.invalid();
      a.success();
      a.perfect();
      a.combo(5);
      a.levelComplete();
      a.button();
      a.setVolume(0.5);
      a.setMuted(true);
    }).not.toThrow();
  });

  it("can toggle mute without throwing", () => {
    const a = createAudio(false);
    expect(() => a.setMuted(true)).not.toThrow();
    expect(() => a.setMuted(false)).not.toThrow();
  });
});

describe("haptics service", () => {
  it("all cues are safe to call without navigator.vibrate", () => {
    const h = createHaptics();
    expect(() => {
      h.tap();
      h.select();
      h.success();
      h.fail();
    }).not.toThrow();
  });
});
