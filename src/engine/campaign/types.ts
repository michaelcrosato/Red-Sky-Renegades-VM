import type { Vec2 } from "../math";
import type { Enemy } from "../types";

export type HubId = "cinder" | "sundown" | "cottonwood";
export type FactionId = "settlers" | "wardens" | "prospectors";
export type ContractKind =
  | "bounty"
  | "raid"
  | "recovery"
  | "courier"
  | "escort"
  | "defense"
  | "salvage"
  | "survey"
  | "supply"
  | "quest";
export type ObjectiveKind =
  | "reach"
  | "interact"
  | "eliminate"
  | "defend"
  | "escort"
  | "choice";
export type Rarity = "common" | "magic" | "rare" | "legendary" | "unique";
export type GearSlot =
  | "revolver"
  | "rifle"
  | "coat"
  | "boots"
  | "charm"
  | "saddle";
export type RuneId = "ember" | "frost" | "vigor" | "fortune";
export type MaterialId = "scrap" | "silver" | "essence" | "runes" | "herbs";
export type StatId =
  | "damage"
  | "crit"
  | "critDamage"
  | "reload"
  | "health"
  | "armor"
  | "resist"
  | "move"
  | "ride"
  | "focus"
  | "luck"
  | "leech"
  | "evade"
  | "tonic"
  | "salvage";
export type AspectId =
  | "ricochet"
  | "blood-price"
  | "stormcaller"
  | "trailblazer"
  | "last-stand";
export interface Affix {
  id: string;
  stat: StatId;
  value: number;
  tier: number;
}
export interface GearItem {
  id: string;
  baseId: string;
  name: string;
  slot: GearSlot;
  rarity: Rarity;
  level: number;
  affixes: Affix[];
  aspect: AspectId | null;
  set: "trailwarden" | "iron-oath" | null;
  rune: RuneId | null;
  upgrade: number;
  seed: number;
}
export interface Progression {
  level: number;
  xp: number;
  totalXP: number;
  points: number;
  talents: Record<string, number>;
  mastery: number;
  masteryXP: number;
}
export interface SitePressure {
  threat: number;
  supply: number;
  clears: number;
}
export interface Objective extends Vec2 {
  kind: ObjectiveKind;
  label: string;
  siteId: string;
  amount: number;
  progress: number;
  duration: number;
  elapsed: number;
  wave: number;
  spawned: boolean;
  started: boolean;
  prop:
    | "cache"
    | "ore"
    | "sage"
    | "parcel"
    | "clue"
    | "survivor"
    | "wagon"
    | "ledger";
  encounter: number;
  elite: boolean;
  boss: boolean;
  destination: Vec2 | null;
}
export interface Contract {
  id: string;
  seed: number;
  hubId: HubId;
  faction: FactionId;
  kind: ContractKind;
  title: string;
  summary: string;
  targetName: string;
  tier: number;
  level: number;
  family: string;
  modifiers: string[];
  objectives: Objective[];
  index: number;
  status: "offered" | "active" | "ready" | "failed";
  origin: "board" | "event";
  expires: number;
  reward: {
    xp: number;
    gold: number;
    reputation: number;
    material: number;
    quality: Rarity;
  };
  outcome: "none" | "captured" | "protect" | "profit";
  failure: string;
}
export interface CampaignEnemy extends Enemy {
  owner: string;
  stage: number;
  name: string;
  level: number;
  maxHealth: number;
  elite: boolean;
  boss: boolean;
  family: string;
  modifiers: string[];
  damage: number;
  armor: number;
  rewarded: boolean;
  captured: boolean;
  dropSeed: number;
  bleed: number;
  scorch: number;
  chill: number;
  stagger: number;
  ability: number;
}
export interface CampaignObject extends Vec2 {
  id: string;
  owner: string;
  stage: number;
  kind: Objective["prop"];
  label: string;
  health: number;
  maxHealth: number;
  used: boolean;
  path: Vec2[];
  pathIndex: number;
  yaw: number;
  animation: number;
}
export interface GroundLoot extends Vec2 {
  id: string;
  item: GearItem | null;
  material: MaterialId | null;
  quantity: number;
  gold: number;
  expires: number;
}
export interface Hazard extends Vec2 {
  id: string;
  owner: string;
  radius: number;
  warning: number;
  life: number;
  damage: number;
  element: "fire" | "storm" | "poison";
  hit: boolean;
}
export interface CampaignState {
  version: 1;
  seed: number;
  serial: number;
  roll: number;
  clock: number;
  engaged: boolean;
  progression: Progression;
  items: GearItem[];
  stash: GearItem[];
  equipped: Record<GearSlot, string | null>;
  materials: Record<MaterialId, number>;
  boards: Record<HubId, Contract[]>;
  boardCycle: Record<HubId, number>;
  vendor: Record<HubId, GearItem[]>;
  active: Contract[];
  events: Contract[];
  tracked: string | null;
  history: { id: string; title: string; kind: ContractKind; tier: number }[];
  reputation: Record<FactionId, number>;
  sites: Record<string, SitePressure>;
  difficulty: number;
  completed: number;
  questsCompleted: number;
  enemies: CampaignEnemy[];
  objects: CampaignObject[];
  drops: GroundLoot[];
  hazards: Hazard[];
  nextEvent: number;
  nextPressure: number;
  shield: number;
  shieldCooldown: number;
  procCooldown: number;
  effects: Record<
    string,
    {
      bleed: number;
      scorch: number;
      chill: number;
      bleedDamage: number;
      scorchDamage: number;
    }
  >;
}
export interface DerivedStats {
  health: number;
  damage: number;
  crit: number;
  critDamage: number;
  reload: number;
  armor: number;
  resist: number;
  move: number;
  ride: number;
  focus: number;
  luck: number;
  leech: number;
  evade: number;
  tonic: number;
  salvage: number;
  aspects: AspectId[];
  runes: RuneId[];
  sets: string[];
}
