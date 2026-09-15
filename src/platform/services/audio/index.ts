import { hapticFail, hapticRotate, hapticTap, hapticWin } from "../../../audio/haptics";
import { synth } from "../../../audio/synth";
import type { AudioService, HapticsService } from "../../types";

export function createAudio(muted: boolean): AudioService {
  synth.setMuted(muted);
  return {
    tap: () => synth.tap(),
    select: () => synth.step(),
    move: () => synth.step(),
    invalid: () => synth.blocked(),
    success: () => synth.success(),
    perfect: () => synth.star(),
    combo: () => synth.star(),
    levelComplete: () => synth.success(),
    button: () => synth.tap(),
    setMuted: (m: boolean) => synth.setMuted(m),
    setVolume: (_v: number) => {
      /* volume control is media-level; M1 only needs mute */
    },
  };
}

export function createHaptics(): HapticsService {
  return {
    tap: () => hapticTap(),
    select: () => hapticRotate(),
    success: () => hapticWin(),
    fail: () => hapticFail(),
  };
}
