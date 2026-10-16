import { HUBS } from "../../game/campaign/catalog";
import { LANDMARKS } from "../../game/territory";
import { refreshOffers } from "./generator";
import { starterGear, rollItem } from "./loot";
import type { CampaignState, GearSlot } from "./types";

export function newCampaign(seed = 7311893): CampaignState {
  const items = starterGear(),
    c: CampaignState = {
      version: 1,
      seed,
      serial: 1,
      roll: 0,
      clock: 0,
      engaged: false,
      progression: {
        level: 1,
        xp: 0,
        totalXP: 0,
        points: 0,
        talents: {},
        mastery: 0,
        masteryXP: 0,
      },
      items,
      stash: [],
      equipped: Object.fromEntries(items.map((i) => [i.slot, i.id])) as Record<
        GearSlot,
        string
      >,
      materials: { scrap: 0, silver: 0, essence: 0, runes: 0, herbs: 0 },
      boards: { cinder: [], sundown: [], cottonwood: [] },
      boardCycle: { cinder: 0, sundown: 0, cottonwood: 0 },
      vendor: { cinder: [], sundown: [], cottonwood: [] },
      active: [],
      events: [],
      tracked: null,
      history: [],
      reputation: { settlers: 0, wardens: 0, prospectors: 0 },
      sites: Object.fromEntries(
        LANDMARKS.map((l, i) => [
          l.id,
          { threat: 25 + i * 4, supply: 55, clears: 0 },
        ]),
      ),
      difficulty: 1,
      completed: 0,
      questsCompleted: 0,
      enemies: [],
      objects: [],
      drops: [],
      hazards: [],
      nextEvent: 75,
      nextPressure: 60,
      shield: 0,
      shieldCooldown: 0,
      procCooldown: 0,
      effects: {},
    };
  for (const hub of HUBS) {
    refreshOffers(c, hub.id);
    c.vendor[hub.id] = [0, 1, 2].map((i) =>
      rollItem(seed + i * 173 + hub.x, `stock-${c.serial++}`, 2, 1, 0, "magic"),
    );
  }
  return c;
}
