import {
  GEAR_SLOTS,
  TALENTS,
  RELIC_SIGNATURES,
} from "../../game/campaign/catalog";
import type { CampaignState, DerivedStats, GearItem } from "./types";
import type { WeaponId } from "../../game/content";

export const xpToNext = (level: number) =>
  100 + (level - 1) * 60 + (level - 1) ** 2 * 6;
export function grantXP(c: CampaignState, amount: number) {
  const p = c.progression,
    previous = p.level;
  amount = Math.max(0, Math.floor(amount));
  p.totalXP += amount;
  if (p.level < 30) {
    p.xp += amount;
    while (p.level < 30 && p.xp >= xpToNext(p.level)) {
      p.xp -= xpToNext(p.level);
      p.level++;
      p.points++;
    }
    if (p.level === 30) {
      p.masteryXP += p.xp;
      p.xp = 0;
    }
  } else p.masteryXP += amount;
  while (p.mastery < 100 && p.masteryXP >= 1500) {
    p.masteryXP -= 1500;
    p.mastery++;
    if (
      p.mastery % 5 === 0 &&
      p.points + Object.values(p.talents).reduce((a, b) => a + b, 0) <
        TALENTS.reduce((sum, t) => sum + t.max, 0)
    )
      p.points++;
  }
  if (p.mastery === 100) p.masteryXP = Math.min(1499, p.masteryXP);
  return p.level - previous;
}
export function learnTalent(c: CampaignState, id: string) {
  const node = TALENTS.find((n) => n.id === id),
    p = c.progression;
  if (
    !node ||
    p.points <= 0 ||
    p.level < node.level ||
    (p.talents[id] ?? 0) >= node.max ||
    (node.requires && (p.talents[node.requires] ?? 0) < 1)
  )
    return false;
  p.points--;
  p.talents[id] = (p.talents[id] ?? 0) + 1;
  return true;
}
export const unlockedTier = (c: CampaignState) =>
  c.progression.level >= 15
    ? 4
    : c.progression.level >= 10
      ? 3
      : c.progression.level >= 5
        ? 2
        : 1;
export function derivedStats(
  c: CampaignState,
  weapon: WeaponId = "revolver",
  replacement?: GearItem,
): DerivedStats {
  const p = c.progression,
    stats: DerivedStats = {
      health: 100 + (p.level - 1) * 4 + p.mastery,
      damage: (p.level - 1) * 1.5 + p.mastery * 0.15,
      crit: 0,
      critDamage: 50,
      reload: 0,
      armor: 0,
      resist: 0,
      move: 0,
      ride: 0,
      focus: 0,
      luck: 0,
      leech: 0,
      evade: 0,
      tonic: 0,
      salvage: 0,
      aspects: [],
      runes: [],
      sets: [],
    };
  const setCounts: Record<string, number> = {};
  for (const slot of GEAR_SLOTS) {
    if ((slot === "revolver" || slot === "rifle") && slot !== weapon) continue;
    const item =
      replacement?.slot === slot
        ? replacement
        : c.items.find((i) => i.id === c.equipped[slot]);
    if (!item) continue;
    if (slot === weapon)
      stats.damage += (item.level - 1) * 1.8 + item.upgrade * 3;
    if (slot === "coat" || slot === "boots")
      stats.armor += (item.level - 1) * 1.2 + item.upgrade;
    if (slot === "charm")
      stats.focus += (item.level - 1) * 0.4 + item.upgrade * 2;
    if (slot === "saddle")
      stats.ride += (item.level - 1) * 0.6 + item.upgrade * 3;
    for (const affix of item.affixes)
      stats[affix.stat] += affix.value * (1 + item.upgrade * 0.12);
    if (item.aspect && !stats.aspects.includes(item.aspect))
      stats.aspects.push(item.aspect);
    if (item.rarity === "unique" && item.aspect) {
      const signature = RELIC_SIGNATURES[item.aspect];
      stats[signature.stat] += signature.value;
    }
    if (item.rune) stats.runes.push(item.rune);
    if (item.set) setCounts[item.set] = (setCounts[item.set] ?? 0) + 1;
  }
  for (const node of TALENTS) {
    const ranks = p.talents[node.id] ?? 0;
    if (node.stat) stats[node.stat] += node.value * ranks;
    if (node.aspect && ranks && !stats.aspects.includes(node.aspect))
      stats.aspects.push(node.aspect);
  }
  if ((setCounts.trailwarden ?? 0) >= 2) {
    stats.move += 8;
    stats.sets.push("Trailwarden (2)");
  }
  if ((setCounts.trailwarden ?? 0) >= 3) {
    stats.focus += 18;
    stats.sets.push("Trailwarden (3)");
  }
  if ((setCounts["iron-oath"] ?? 0) >= 2) {
    stats.armor += 15;
    stats.sets.push("Iron Oath (2)");
  }
  if ((setCounts["iron-oath"] ?? 0) >= 3) {
    stats.health += 30;
    stats.sets.push("Iron Oath (3)");
  }
  for (const rune of stats.runes) {
    if (rune === "vigor") {
      stats.health += 15;
      stats.resist += 6;
    }
    if (rune === "fortune") stats.luck += 12;
  }
  stats.crit = Math.min(75, stats.crit);
  stats.resist = Math.min(70, stats.resist);
  stats.reload = Math.min(65, stats.reload);
  stats.move = Math.min(40, stats.move);
  stats.evade = Math.min(60, stats.evade);
  stats.luck = Math.min(120, stats.luck);
  stats.focus = Math.min(70, stats.focus);
  stats.leech = Math.min(15, stats.leech);
  return stats;
}
