import {
  AFFIXES,
  ASPECTS,
  CONTRACT_MODIFIERS,
  ENEMY_FAMILIES,
  ENEMY_MODIFIERS,
  GEAR_SLOTS,
  HUBS,
  ITEM_BASES,
  RARITIES,
  RUNES,
  TALENTS,
} from "../../game/campaign/catalog";
import { LANDMARKS, SAVE_POSITION_LIMIT } from "../../game/territory";
import { CONTRACT_KINDS } from "./generator";
import type { CampaignState, Contract, GearItem } from "./types";
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, min = 0, max = 1e12): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const integer = (v: unknown, min = 0, max = 1e9) =>
  num(v, min, max) && Number.isInteger(v);
const text = (v: unknown, max = 300): v is string =>
  typeof v === "string" && v.length <= max;
const id = (v: unknown): v is string => text(v, 100) && /^[a-z0-9:-]+$/.test(v);
const bool = (v: unknown) => typeof v === "boolean";
const list = (
  v: unknown,
  max: number,
  check: (x: unknown) => boolean,
): v is unknown[] => Array.isArray(v) && v.length <= max && v.every(check);
const pos = (v: unknown) =>
  obj(v) &&
  num(v.x, -SAVE_POSITION_LIMIT, SAVE_POSITION_LIMIT) &&
  num(v.z, -SAVE_POSITION_LIMIT, SAVE_POSITION_LIMIT);
const one = (v: unknown, values: readonly string[]) =>
  typeof v === "string" && values.includes(v);
const site = (v: unknown) =>
  one(
    v,
    LANDMARKS.map((l) => l.id),
  );
export function validItem(v: unknown): v is GearItem {
  if (!obj(v)) return false;
  return (
    id(v.id) &&
    one(
      v.baseId,
      ITEM_BASES.map((i) => i.id),
    ) &&
    text(v.name) &&
    one(v.slot, GEAR_SLOTS) &&
    one(v.rarity, Object.keys(RARITIES)) &&
    integer(v.level, 1, 50) &&
    integer(v.upgrade, 0, 5) &&
    num(v.seed) &&
    list(
      v.affixes,
      4,
      (a) =>
        obj(a) &&
        one(
          a.id,
          AFFIXES.map((x) => x.id),
        ) &&
        AFFIXES.some(
          (x) =>
            x.id === a.id &&
            x.stat === a.stat &&
            x.slots.includes(v.slot as never),
        ) &&
        num(a.value, 0, 500) &&
        integer(a.tier, 1, 5),
    ) &&
    (v.aspect === null || one(v.aspect, Object.keys(ASPECTS))) &&
    (v.rune === null || one(v.rune, Object.keys(RUNES))) &&
    (v.set === null || one(v.set, ["trailwarden", "iron-oath"])) &&
    ITEM_BASES.some((i) => i.id === v.baseId && i.slot === v.slot)
  );
}
export function validContract(v: unknown): v is Contract {
  if (
    !obj(v) ||
    !obj(v.reward) ||
    !Array.isArray(v.objectives) ||
    !v.objectives.length
  )
    return false;
  return (
    id(v.id) &&
    num(v.seed) &&
    one(
      v.hubId,
      HUBS.map((h) => h.id),
    ) &&
    one(v.faction, ["settlers", "wardens", "prospectors"]) &&
    one(v.kind, CONTRACT_KINDS) &&
    text(v.title) &&
    text(v.summary, 2000) &&
    text(v.targetName) &&
    integer(v.tier, 1, 4) &&
    integer(v.level, 1, 40) &&
    one(v.family, Object.keys(ENEMY_FAMILIES)) &&
    list(v.modifiers, 3, (m) => one(m, Object.keys(CONTRACT_MODIFIERS))) &&
    list(
      v.objectives,
      15,
      (o) =>
        pos(o) &&
        obj(o) &&
        one(o.kind, [
          "reach",
          "interact",
          "eliminate",
          "defend",
          "escort",
          "choice",
        ]) &&
        text(o.label) &&
        site(o.siteId) &&
        integer(o.amount, 1, 20) &&
        integer(o.progress, 0, 100) &&
        num(o.duration) &&
        num(o.elapsed) &&
        integer(o.wave, 0, 50) &&
        bool(o.spawned) &&
        bool(o.started) &&
        one(o.prop, [
          "cache",
          "ore",
          "sage",
          "parcel",
          "clue",
          "survivor",
          "wagon",
          "ledger",
        ]) &&
        integer(o.encounter, 0, 20) &&
        bool(o.elite) &&
        bool(o.boss) &&
        (o.destination === null || pos(o.destination)),
    ) &&
    integer(v.index, 0, v.objectives.length) &&
    one(v.status, ["offered", "active", "ready", "failed"]) &&
    one(v.origin, ["board", "event"]) &&
    num(v.expires) &&
    one(v.outcome, ["none", "captured", "protect", "profit"]) &&
    text(v.failure) &&
    ["xp", "gold", "reputation", "material"].every((k) =>
      num((v.reward as Record<string, unknown>)[k]),
    ) &&
    one(v.reward.quality, Object.keys(RARITIES)) &&
    (v.status === "ready"
      ? v.index === v.objectives.length
      : (v.index as number) < v.objectives.length)
  );
}
export function validCampaign(v: unknown): v is CampaignState {
  if (
    !obj(v) ||
    v.version !== 1 ||
    !obj(v.progression) ||
    !obj(v.materials) ||
    !obj(v.equipped) ||
    !obj(v.boards) ||
    !obj(v.boardCycle) ||
    !obj(v.vendor) ||
    !obj(v.reputation) ||
    !obj(v.sites) ||
    !obj(v.effects)
  )
    return false;
  const p = v.progression;
  if (
    !integer(p.level, 1, 30) ||
    !num(p.xp) ||
    !num(p.totalXP) ||
    !integer(p.points, 0, 1000) ||
    !integer(p.mastery, 0, 100) ||
    !num(p.masteryXP) ||
    !obj(p.talents) ||
    !Object.entries(p.talents).every(([k, n]) =>
      TALENTS.some((t) => t.id === k && integer(n, 0, t.max)),
    )
  )
    return false;
  if (
    !list(v.items, 40, validItem) ||
    !list(v.stash, 80, validItem) ||
    !["scrap", "silver", "essence", "runes", "herbs"].every((k) =>
      integer((v.materials as Record<string, unknown>)[k]),
    )
  )
    return false;
  const items = v.items as GearItem[],
    stash = v.stash as GearItem[];
  if (
    new Set([...items, ...stash].map((i) => i.id)).size !==
      items.length + stash.length ||
    !GEAR_SLOTS.every(
      (slot) =>
        v.equipped &&
        obj(v.equipped) &&
        (v.equipped[slot] === null ||
          items.some(
            (i) => i.id === v.equipped![slot as never] && i.slot === slot,
          )),
    )
  )
    return false;
  for (const h of HUBS) {
    if (
      !list(
        v.boards[h.id],
        5,
        (c) => validContract(c) && c.status === "offered",
      ) ||
      !integer(v.boardCycle[h.id]) ||
      !list(v.vendor[h.id], 3, validItem) ||
      !integer(v.reputation[h.faction])
    )
      return false;
  }
  for (const l of LANDMARKS) {
    const s = v.sites[l.id];
    if (
      !obj(s) ||
      !num(s.threat, 0, 100) ||
      !num(s.supply, 0, 100) ||
      !integer(s.clears)
    )
      return false;
  }
  if (
    !list(v.active, 3, (c) => validContract(c) && c.status !== "offered") ||
    !list(v.events, 2, (c) => validContract(c) && c.origin === "event") ||
    !list(
      v.history,
      100,
      (h) =>
        obj(h) &&
        id(h.id) &&
        text(h.title) &&
        one(h.kind, CONTRACT_KINDS) &&
        integer(h.tier, 1, 4),
    )
  )
    return false;
  const contracts = [...v.active, ...v.events] as Contract[];
  if (
    v.tracked !== null &&
    (!id(v.tracked) || !contracts.some((c) => c.id === v.tracked))
  )
    return false;
  if (
    !list(
      v.enemies,
      48,
      (e) =>
        obj(e) &&
        pos(e) &&
        id(e.id) &&
        id(e.owner) &&
        contracts.some((c) => c.id === e.owner) &&
        integer(e.stage, 0, 14) &&
        text(e.name) &&
        pos(e.home) &&
        num(e.yaw, -1e12) &&
        num(e.health, -1e12) &&
        num(e.maxHealth, 1) &&
        num(e.animation) &&
        num(e.speed) &&
        one(e.state, ["patrol", "investigate", "attack", "flank", "dead"]) &&
        num(e.cooldown, -1e12) &&
        num(e.awareness, 0, 1) &&
        bool(e.loot) &&
        integer(e.level, 1, 40) &&
        bool(e.elite) &&
        bool(e.boss) &&
        one(e.family, Object.keys(ENEMY_FAMILIES)) &&
        list(e.modifiers, 6, (m) => one(m, Object.keys(ENEMY_MODIFIERS))) &&
        num(e.damage) &&
        num(e.armor) &&
        bool(e.rewarded) &&
        bool(e.captured) &&
        num(e.dropSeed) &&
        ["bleed", "scorch", "chill", "stagger"].every((k) => num(e[k])) &&
        num(e.ability, -1e12),
    )
  )
    return false;
  if (
    !list(
      v.objects,
      60,
      (o) =>
        obj(o) &&
        pos(o) &&
        id(o.id) &&
        id(o.owner) &&
        contracts.some((c) => c.id === o.owner) &&
        integer(o.stage, 0, 14) &&
        one(o.kind, [
          "cache",
          "ore",
          "sage",
          "parcel",
          "clue",
          "survivor",
          "wagon",
          "ledger",
        ]) &&
        text(o.label) &&
        num(o.health, 0) &&
        num(o.maxHealth, 1) &&
        bool(o.used) &&
        list(o.path, 100, pos) &&
        integer(o.pathIndex, 0, (o.path as unknown[]).length) &&
        num(o.yaw, -1e12) &&
        num(o.animation),
    )
  )
    return false;
  if (
    !list(
      v.drops,
      64,
      (d) =>
        obj(d) &&
        pos(d) &&
        id(d.id) &&
        (d.item === null || validItem(d.item)) &&
        (d.material === null ||
          one(d.material, ["scrap", "silver", "essence", "runes", "herbs"])) &&
        integer(d.quantity) &&
        num(d.gold) &&
        num(d.expires),
    )
  )
    return false;
  if (
    !list(
      v.hazards,
      20,
      (h) =>
        obj(h) &&
        pos(h) &&
        id(h.id) &&
        id(h.owner) &&
        num(h.radius, 0, 20) &&
        num(h.warning, -1e12) &&
        num(h.life, -1e12) &&
        num(h.damage) &&
        one(h.element, ["fire", "storm", "poison"]) &&
        bool(h.hit),
    )
  )
    return false;
  if (
    Object.keys(v.effects).length > 80 ||
    !Object.entries(v.effects).every(
      ([key, e]) =>
        id(key) &&
        obj(e) &&
        ["bleed", "scorch", "chill", "bleedDamage", "scorchDamage"].every((k) =>
          num(e[k]),
        ),
    )
  )
    return false;
  return (
    [
      "seed",
      "clock",
      "nextEvent",
      "nextPressure",
      "shield",
      "shieldCooldown",
      "procCooldown",
    ].every((k) => num(v[k])) &&
    ["serial", "roll", "completed", "questsCompleted"].every((k) =>
      integer(v[k]),
    ) &&
    bool(v.engaged) &&
    integer(v.difficulty, 1, 4)
  );
}
