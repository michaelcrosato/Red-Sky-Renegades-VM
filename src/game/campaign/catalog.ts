import type {
  AspectId,
  FactionId,
  GearSlot,
  HubId,
  RuneId,
  StatId,
  ContractKind,
} from "../../engine/campaign/types";
export const CONSEQUENCES: Record<
  ContractKind,
  { threat: number; supply: number }
> = {
  bounty: { threat: -18, supply: 3 },
  raid: { threat: -22, supply: 8 },
  recovery: { threat: -8, supply: 12 },
  courier: { threat: -3, supply: 22 },
  escort: { threat: -5, supply: 10 },
  defense: { threat: -12, supply: 18 },
  salvage: { threat: 3, supply: -4 },
  survey: { threat: -4, supply: 0 },
  supply: { threat: -6, supply: 25 },
  quest: { threat: -20, supply: 12 },
};

export const HUBS: readonly {
  id: HubId;
  name: string;
  x: number;
  z: number;
  faction: FactionId;
  description: string;
}[] = [
  {
    id: "cinder",
    name: "Cinder Creek Dispatch",
    x: -47,
    z: 40,
    faction: "settlers",
    description: "The settlers need safe roads, medicine and willing hands.",
  },
  {
    id: "sundown",
    name: "Sundown Marshal’s Office",
    x: 289,
    z: -76,
    faction: "wardens",
    description: "The Wardens pay for dangerous names and quiet nights.",
  },
  {
    id: "cottonwood",
    name: "Cottonwood Exchange",
    x: -31,
    z: 234,
    faction: "prospectors",
    description:
      "The prospectors trade in salvage, lost relics and second chances.",
  },
];
export const FACTIONS = {
  settlers: { name: "Free Settlers", color: "#d4be7c" },
  wardens: { name: "Territory Wardens", color: "#8fb8bb" },
  prospectors: { name: "Prospectors’ Guild", color: "#d59b6c" },
};
export const RARITIES = {
  common: { name: "Common", color: "#d0cfbd", affixes: 0 },
  magic: { name: "Magic", color: "#83b6dc", affixes: 2 },
  rare: { name: "Rare", color: "#e6cd77", affixes: 3 },
  legendary: { name: "Legendary", color: "#ed9b59", affixes: 4 },
  unique: { name: "Relic", color: "#ae9ed7", affixes: 4 },
} as const;
export const GEAR_SLOTS: GearSlot[] = [
  "revolver",
  "rifle",
  "coat",
  "boots",
  "charm",
  "saddle",
];
export const SLOT_NAMES: Record<GearSlot, string> = {
  revolver: "Revolver",
  rifle: "Repeater",
  coat: "Coat",
  boots: "Boots",
  charm: "Charm",
  saddle: "Saddle",
};
export const ITEM_BASES: readonly {
  id: string;
  name: string;
  slot: GearSlot;
}[] = [
  { id: "cattleman", name: "Cattleman", slot: "revolver" },
  { id: "peacemaker", name: "Frontier Sixgun", slot: "revolver" },
  { id: "longshadow", name: "Longshadow", slot: "rifle" },
  { id: "ironwood", name: "Ironwood Repeater", slot: "rifle" },
  { id: "duster", name: "Trail Duster", slot: "coat" },
  { id: "ironcoat", name: "Riveted Coat", slot: "coat" },
  { id: "riding-boots", name: "Riding Boots", slot: "boots" },
  { id: "scout-boots", name: "Scout’s Boots", slot: "boots" },
  { id: "silver-charm", name: "Silver Keepsake", slot: "charm" },
  { id: "bone-charm", name: "Carved Talisman", slot: "charm" },
  { id: "stock-saddle", name: "Stock Saddle", slot: "saddle" },
  { id: "ranger-saddle", name: "Ranger Saddle", slot: "saddle" },
];
export const STAT_NAMES: Record<StatId, string> = {
  damage: "Weapon damage",
  crit: "Critical chance",
  critDamage: "Critical damage",
  reload: "Reload speed",
  health: "Maximum health",
  armor: "Armor",
  resist: "Elemental resistance",
  move: "Movement speed",
  ride: "Riding efficiency",
  focus: "Focus efficiency",
  luck: "Loot fortune",
  leech: "Life on hit",
  evade: "Evade recovery",
  tonic: "Tonic potency",
  salvage: "Salvage yield",
};
export const AFFIXES: readonly {
  id: string;
  name: string;
  stat: StatId;
  slots: readonly GearSlot[];
  min: number;
  max: number;
  growth: number;
  level: number;
}[] = [
  {
    id: "heavy",
    name: "Heavy",
    stat: "damage",
    slots: ["revolver", "rifle"],
    min: 6,
    max: 12,
    growth: 3,
    level: 1,
  },
  {
    id: "keen",
    name: "Keen",
    stat: "crit",
    slots: ["revolver", "rifle", "charm"],
    min: 3,
    max: 6,
    growth: 1,
    level: 1,
  },
  {
    id: "cruel",
    name: "Cruel",
    stat: "critDamage",
    slots: ["revolver", "rifle", "charm"],
    min: 8,
    max: 15,
    growth: 4,
    level: 3,
  },
  {
    id: "nimble",
    name: "Nimble",
    stat: "reload",
    slots: ["revolver", "rifle", "boots"],
    min: 5,
    max: 10,
    growth: 2,
    level: 1,
  },
  {
    id: "vital",
    name: "Vital",
    stat: "health",
    slots: ["coat", "boots", "charm"],
    min: 8,
    max: 16,
    growth: 6,
    level: 1,
  },
  {
    id: "plated",
    name: "Plated",
    stat: "armor",
    slots: ["coat", "boots", "saddle"],
    min: 5,
    max: 10,
    growth: 4,
    level: 1,
  },
  {
    id: "warded",
    name: "Warded",
    stat: "resist",
    slots: ["coat", "charm", "saddle"],
    min: 4,
    max: 8,
    growth: 2,
    level: 2,
  },
  {
    id: "fleet",
    name: "Fleet",
    stat: "move",
    slots: ["boots", "charm"],
    min: 3,
    max: 6,
    growth: 1,
    level: 1,
  },
  {
    id: "enduring",
    name: "Enduring",
    stat: "ride",
    slots: ["saddle", "boots"],
    min: 5,
    max: 10,
    growth: 3,
    level: 1,
  },
  {
    id: "lucid",
    name: "Lucid",
    stat: "focus",
    slots: ["charm", "revolver", "rifle"],
    min: 4,
    max: 8,
    growth: 2,
    level: 1,
  },
  {
    id: "fortunate",
    name: "Fortunate",
    stat: "luck",
    slots: ["charm", "boots", "saddle"],
    min: 4,
    max: 9,
    growth: 3,
    level: 1,
  },
  {
    id: "sanguine",
    name: "Sanguine",
    stat: "leech",
    slots: ["revolver", "rifle", "charm"],
    min: 1,
    max: 3,
    growth: 1,
    level: 4,
  },
  {
    id: "elusive",
    name: "Elusive",
    stat: "evade",
    slots: ["boots", "coat"],
    min: 5,
    max: 10,
    growth: 2,
    level: 1,
  },
  {
    id: "restorative",
    name: "Restorative",
    stat: "tonic",
    slots: ["coat", "saddle"],
    min: 5,
    max: 12,
    growth: 3,
    level: 1,
  },
  {
    id: "resourceful",
    name: "Resourceful",
    stat: "salvage",
    slots: ["saddle", "charm"],
    min: 8,
    max: 15,
    growth: 4,
    level: 1,
  },
];
export const ASPECTS: Record<AspectId, { name: string; description: string }> =
  {
    ricochet: {
      name: "Echoing Lead",
      description: "Every third hit ricochets for 45% damage to a nearby foe.",
    },
    "blood-price": {
      name: "Blood Price",
      description:
        "Critical hits bleed enemies; defeating a foe restores health.",
    },
    stormcaller: {
      name: "Stormcaller",
      description: "A hit calls chain lightning every four seconds.",
    },
    trailblazer: {
      name: "Trailblazer",
      description:
        "Deal 25% more damage on horseback and spend less horse stamina.",
    },
    "last-stand": {
      name: "Last Stand",
      description:
        "Gain a protective barrier when a hit takes you below 35% health. 35s cooldown.",
    },
  };
export const RELIC_SIGNATURES: Record<
  AspectId,
  { stat: StatId; value: number; description: string }
> = {
  ricochet: {
    stat: "crit",
    value: 8,
    description: "Relic signature: +8% critical chance",
  },
  "blood-price": {
    stat: "leech",
    value: 3,
    description: "Relic signature: +3 life on hit",
  },
  stormcaller: {
    stat: "resist",
    value: 10,
    description: "Relic signature: +10% elemental resistance",
  },
  trailblazer: {
    stat: "ride",
    value: 15,
    description: "Relic signature: +15 riding efficiency",
  },
  "last-stand": {
    stat: "health",
    value: 25,
    description: "Relic signature: +25 maximum health",
  },
};
export const RUNES: Record<RuneId, { name: string; description: string }> = {
  ember: { name: "Ember", description: "Hits scorch for damage over time." },
  frost: {
    name: "Frost",
    description: "Hits chill enemies, slowing movement and attacks.",
  },
  vigor: {
    name: "Vigor",
    description: "+15 maximum health and +6 resistance.",
  },
  fortune: { name: "Fortune", description: "+12 loot fortune." },
};
export const SETS = {
  trailwarden: {
    name: "Trailwarden",
    two: "+8% movement speed",
    three: "+18 focus efficiency",
  },
  "iron-oath": {
    name: "Iron Oath",
    two: "+15 armor",
    three: "+30 maximum health",
  },
};
export const TALENTS: readonly {
  id: string;
  name: string;
  branch: "Gunslinger" | "Warden" | "Outrider";
  description: string;
  max: number;
  level: number;
  requires: string | null;
  stat: StatId | null;
  value: number;
  aspect: AspectId | null;
}[] = [
  {
    id: "steady-hand",
    name: "Steady Hand",
    branch: "Gunslinger",
    description: "+4% critical chance per rank.",
    max: 3,
    level: 2,
    requires: null,
    stat: "crit",
    value: 4,
    aspect: null,
  },
  {
    id: "quickloader",
    name: "Quickloader",
    branch: "Gunslinger",
    description: "+8% reload speed per rank.",
    max: 3,
    level: 2,
    requires: null,
    stat: "reload",
    value: 8,
    aspect: null,
  },
  {
    id: "deadeye",
    name: "Stillness",
    branch: "Gunslinger",
    description: "+10 focus efficiency per rank.",
    max: 3,
    level: 4,
    requires: "steady-hand",
    stat: "focus",
    value: 10,
    aspect: null,
  },
  {
    id: "executioner",
    name: "Final Word",
    branch: "Gunslinger",
    description: "+12% critical damage per rank.",
    max: 3,
    level: 6,
    requires: "quickloader",
    stat: "critDamage",
    value: 12,
    aspect: null,
  },
  {
    id: "leadstorm",
    name: "Echo of Thunder",
    branch: "Gunslinger",
    description: "Unlock Echoing Lead ricochets.",
    max: 1,
    level: 10,
    requires: "deadeye",
    stat: null,
    value: 0,
    aspect: "ricochet",
  },
  {
    id: "vitality",
    name: "True Grit",
    branch: "Warden",
    description: "+12 maximum health per rank.",
    max: 3,
    level: 2,
    requires: null,
    stat: "health",
    value: 12,
    aspect: null,
  },
  {
    id: "ironhide",
    name: "Ironhide",
    branch: "Warden",
    description: "+7 armor per rank.",
    max: 3,
    level: 2,
    requires: null,
    stat: "armor",
    value: 7,
    aspect: null,
  },
  {
    id: "campcraft",
    name: "Field Medicine",
    branch: "Warden",
    description: "+12 tonic potency per rank.",
    max: 3,
    level: 4,
    requires: "vitality",
    stat: "tonic",
    value: 12,
    aspect: null,
  },
  {
    id: "resilience",
    name: "Weather the Storm",
    branch: "Warden",
    description: "+8 elemental resistance per rank.",
    max: 3,
    level: 6,
    requires: "ironhide",
    stat: "resist",
    value: 8,
    aspect: null,
  },
  {
    id: "unbroken",
    name: "Unbroken",
    branch: "Warden",
    description: "Unlock the Last Stand barrier.",
    max: 1,
    level: 10,
    requires: "campcraft",
    stat: null,
    value: 0,
    aspect: "last-stand",
  },
  {
    id: "longstride",
    name: "Long Stride",
    branch: "Outrider",
    description: "+4% movement speed per rank.",
    max: 3,
    level: 2,
    requires: null,
    stat: "move",
    value: 4,
    aspect: null,
  },
  {
    id: "scavenger",
    name: "Fortune Finder",
    branch: "Outrider",
    description: "+8 loot fortune per rank.",
    max: 3,
    level: 2,
    requires: null,
    stat: "luck",
    value: 8,
    aspect: null,
  },
  {
    id: "resourceful",
    name: "Waste Nothing",
    branch: "Outrider",
    description: "+20% salvage yield per rank.",
    max: 3,
    level: 4,
    requires: "scavenger",
    stat: "salvage",
    value: 20,
    aspect: null,
  },
  {
    id: "trailbond",
    name: "Trail Bond",
    branch: "Outrider",
    description: "+12 riding efficiency per rank.",
    max: 3,
    level: 6,
    requires: "longstride",
    stat: "ride",
    value: 12,
    aspect: null,
  },
  {
    id: "windrider",
    name: "Windrider",
    branch: "Outrider",
    description: "Unlock Trailblazer mounted damage and endurance.",
    max: 1,
    level: 10,
    requires: "trailbond",
    stat: null,
    value: 0,
    aspect: "trailblazer",
  },
];
export const ENEMY_FAMILIES = {
  reavers: {
    name: "Dust Reavers",
    color: "#ae5b41",
    speed: 1.15,
    damage: 1,
    modifier: "frenzied",
  },
  syndicate: {
    name: "Iron Syndicate",
    color: "#647781",
    speed: 0.85,
    damage: 1.05,
    modifier: "armored",
  },
  knives: {
    name: "Ash Knives",
    color: "#657b52",
    speed: 1.25,
    damage: 0.9,
    modifier: "venomous",
  },
  stormbinders: {
    name: "Stormbound",
    color: "#847098",
    speed: 1,
    damage: 1,
    modifier: "stormbound",
  },
};
export const ENEMY_MODIFIERS = {
  armored: {
    name: "Armored",
    description: "Reduced incoming physical damage.",
  },
  frenzied: { name: "Frenzied", description: "Faster attacks and movement." },
  vampiric: { name: "Vampiric", description: "Heals when a shot connects." },
  stormbound: {
    name: "Stormbound",
    description: "Calls telegraphed lightning strikes.",
  },
  venomous: { name: "Venomous", description: "Leaves poison pools." },
  scorched: { name: "Scorched", description: "Creates burning ground." },
};
export const CONTRACT_MODIFIERS = {
  ironclad: {
    name: "Ironclad",
    description: "Enemies have armor.",
    enemy: "armored",
    reward: 0.15,
  },
  bloodmoon: {
    name: "Blood Debt",
    description: "Elites steal health on hit.",
    enemy: "vampiric",
    reward: 0.2,
  },
  storm: {
    name: "Storm Front",
    description: "Stormbound elites call lightning.",
    enemy: "stormbound",
    reward: 0.2,
  },
  venom: {
    name: "Bad Water",
    description: "Elites create poison pools.",
    enemy: "venomous",
    reward: 0.15,
  },
  fire: {
    name: "Scorched Earth",
    description: "Elites leave burning ground.",
    enemy: "scorched",
    reward: 0.2,
  },
  rush: {
    name: "Restless",
    description: "Enemies move and shoot faster.",
    enemy: "frenzied",
    reward: 0.15,
  },
  rich: {
    name: "Prospector’s Luck",
    description: "Richer materials and loot.",
    enemy: null,
    reward: 0.25,
  },
  dangerous: {
    name: "Reinforcements",
    description: "An extra enemy joins each pack.",
    enemy: null,
    reward: 0.25,
  },
};
export const CONTRACT_NAMES = {
  bounty: "Bounty",
  raid: "Gang raid",
  recovery: "Lost cargo",
  courier: "Courier job",
  escort: "Escort",
  defense: "Hold the line",
  salvage: "Salvage task",
  survey: "Survey task",
  supply: "Supply run",
  quest: "Frontier quest",
};
export const MAX_ACTIVE_CONTRACTS = 3,
  PACK_CAPACITY = 40,
  STASH_CAPACITY = 80,
  MAX_CAMPAIGN_ENEMIES = 48,
  MAX_WORLD_DROPS = 64;
