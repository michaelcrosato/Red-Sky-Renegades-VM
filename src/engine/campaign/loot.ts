import { random } from "../math";
import {
  AFFIXES,
  ASPECTS,
  GEAR_SLOTS,
  ITEM_BASES,
  RARITIES,
} from "../../game/campaign/catalog";
import type {
  Affix,
  AspectId,
  GearItem,
  GearSlot,
  MaterialId,
  Rarity,
} from "./types";

export const rarityOrder: Rarity[] = [
  "common",
  "magic",
  "rare",
  "legendary",
  "unique",
];
export function rollItem(
  seed: number,
  id: string,
  level: number,
  tier = 1,
  luck = 0,
  minimum: Rarity = "common",
  slot?: GearSlot,
): GearItem {
  seed = seed >>> 0;
  const rng = random(seed),
    pick = <T>(a: readonly T[]) => a[Math.floor(rng() * a.length)];
  const weights =
    tier >= 4
      ? [5, 20, 40, 30, 5]
      : tier === 3
        ? [15, 25, 40, 17, 3]
        : tier === 2
          ? [28, 35, 27, 9, 1]
          : [50, 30, 17, 3, 0];
  weights[0] = Math.max(0, weights[0] - luck * 0.4);
  weights[2] += luck * 0.2;
  weights[3] += luck * 0.12;
  const minRank = rarityOrder.indexOf(minimum);
  for (let i = 0; i < minRank; i++) weights[i] = 0;
  let roll = rng() * weights.reduce((a, b) => a + b, 0),
    rank = weights.length - 1;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll < 0) {
      rank = i;
      break;
    }
  }
  const rarity = rarityOrder[rank],
    chosenSlot = slot ?? pick(GEAR_SLOTS),
    base = pick(ITEM_BASES.filter((b) => b.slot === chosenSlot));
  const ilevel = Math.max(1, Math.min(50, Math.round(level))),
    affixTier = Math.min(5, 1 + Math.floor((ilevel - 1) / 8));
  const available = AFFIXES.filter(
      (a) => a.slots.includes(chosenSlot) && a.level <= ilevel,
    ),
    affixes: Affix[] = [];
  for (let i = 0; i < RARITIES[rarity].affixes && available.length; i++) {
    const index = Math.floor(rng() * available.length),
      a = available.splice(index, 1)[0];
    affixes.push({
      id: a.id,
      stat: a.stat,
      tier: affixTier,
      value: Math.round(
        a.min + rng() * (a.max - a.min) + (affixTier - 1) * a.growth,
      ),
    });
  }
  const aspect = rank >= 3 ? pick(Object.keys(ASPECTS) as AspectId[]) : null;
  const set =
    rank >= 2 && rng() < 0.22
      ? rng() < 0.5
        ? "trailwarden"
        : "iron-oath"
      : null;
  const prefix = affixes.length
    ? AFFIXES.find((a) => a.id === affixes[0].id)!.name + " "
    : "";
  const suffix =
    rank >= 2
      ? pick([
          " of the Red Sky",
          " of the Long Road",
          " of Resolve",
          " of Cinders",
          " of the Watch",
        ])
      : "";
  const uniqueNames: Record<AspectId, string> = {
    ricochet: "The Last Echo",
    "blood-price": "A Debt in Blood",
    stormcaller: "Thunder’s Promise",
    trailblazer: "Juniper’s Oath",
    "last-stand": "One More Sunrise",
  };
  return {
    id,
    baseId: base.id,
    name:
      rarity === "unique" ? uniqueNames[aspect!] : prefix + base.name + suffix,
    slot: chosenSlot,
    rarity,
    level: ilevel,
    affixes,
    aspect,
    set,
    rune: null,
    upgrade: 0,
    seed,
  };
}
export function starterGear(): GearItem[] {
  return GEAR_SLOTS.map((slot, i) => ({
    id: `starter-${slot}`,
    baseId: ITEM_BASES.find((b) => b.slot === slot)!.id,
    name: ITEM_BASES.find((b) => b.slot === slot)!.name,
    slot,
    rarity: "common",
    level: 1,
    affixes: [],
    aspect: null,
    set: null,
    rune: null,
    upgrade: 0,
    seed: 100 + i,
  }));
}
export function salvageYield(
  item: GearItem,
  bonus = 0,
): Partial<Record<MaterialId, number>> {
  const rank = rarityOrder.indexOf(item.rarity),
    mult = 1 + bonus / 100;
  return {
    scrap: Math.max(1, Math.floor((2 + rank * 2 + item.upgrade) * mult)),
    silver: rank >= 2 ? Math.max(1, Math.floor(rank * mult)) : 0,
    essence: rank >= 3 ? rank - 2 : 0,
    runes: item.rune ? 1 : 0,
  };
}
export function upgradeCost(item: GearItem) {
  return {
    scrap: 3 * (item.upgrade + 1),
    silver: Math.max(1, rarityOrder.indexOf(item.rarity)) * (item.upgrade + 1),
    essence: 0,
    runes: 0,
    herbs: 0,
  };
}
export function reforgeItem(item: GearItem, seed: number): GearItem {
  const rng = random(seed),
    copy = structuredClone(item),
    available = AFFIXES.filter(
      (a) =>
        a.slots.includes(item.slot) &&
        a.level <= item.level &&
        !item.affixes.slice(0, -1).some((v) => v.id === a.id),
    );
  const a = available[Math.floor(rng() * available.length)],
    tier = Math.min(5, 1 + Math.floor((item.level - 1) / 8));
  const affix = {
    id: a.id,
    stat: a.stat,
    tier,
    value: Math.round(a.min + rng() * (a.max - a.min) + (tier - 1) * a.growth),
  };
  if (copy.affixes.length) copy.affixes[copy.affixes.length - 1] = affix;
  else {
    copy.affixes.push(affix);
    copy.rarity = "magic";
  }
  copy.seed = seed;
  return copy;
}
export const gearPrice = (item: GearItem) =>
  18 +
  item.level * 4 +
  rarityOrder.indexOf(item.rarity) * 18 +
  item.upgrade * 12;
