import type { MechanicFlags, MechanicId } from "./types";

function flagSet(...on: MechanicId[]): MechanicFlags {
  const flags: MechanicFlags = {
    colorGates: false,
    portals: false,
    oneWayWalls: false,
    splitters: false,
    timedTiles: false,
    switches: false,
    rotators: false,
    barriers: false,
    checkpoints: false,
  };
  for (const id of on) flags[id] = true;
  return flags;
}

/**
 * Shipped mechanics are on; experimental ones are off until they are explicitly
 * designed, tested and playtested. Nothing is ever deleted: a disabled mechanic
 * still has types and flags so it can be re-enabled behind this switch.
 */
export const DEFAULT_MECHANICS: MechanicFlags = flagSet("colorGates", "portals", "oneWayWalls");

const PACK_MECHANICS: Record<string, MechanicFlags> = {
  pulse: flagSet(),
  surge: flagSet(),
  "color-gates": flagSet("colorGates"),
  lattice: flagSet("colorGates"),
  wormhole: flagSet("colorGates", "portals"),
  vector: flagSet("colorGates", "oneWayWalls"),
  daily: flagSet("colorGates"),
};

/** Mechanic capabilities unlocked by the pack that contains a level. */
export function mechanicsForPack(pack: string): MechanicFlags {
  return PACK_MECHANICS[pack] ?? flagSet();
}

export function hasMechanic(flags: MechanicFlags, id: MechanicId): boolean {
  return flags[id];
}

export function activeMechanics(flags: MechanicFlags): MechanicId[] {
  return (Object.keys(flags) as MechanicId[]).filter((id) => flags[id]);
}
