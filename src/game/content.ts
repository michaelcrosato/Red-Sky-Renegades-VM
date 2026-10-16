import type { Obstacle, Vec2 } from "../engine/math";
import { FRONTIER_OBSTACLES } from "./territory";
export const CAMP = { x: -57, z: 46 };
export const ADA = { x: -58, z: 42 };
export const MERCHANT = { x: -67, z: 41 };
export const FIRE = { x: -60, z: 49 };
export const WAGON = { x: -28, z: 18 };
export const BRIDGE = { x: -6.7, z: 6 };
export const CRATE = { x: 49, z: -41 };
export const BOSS = { x: 56, z: -34 };
export const POST = { x: 39, z: -29 };
export const GRAVE = { x: -75, z: -10 };
export const WILD_HERB = [
  { x: -44, z: 27 },
  { x: 9, z: 4 },
  { x: 19, z: -13 },
];
export const WEAPONS = {
  revolver: {
    name: "Cattleman",
    kind: "Revolver",
    capacity: 6,
    damage: 42,
    rate: 0.48,
    reload: 1.65,
    range: 46,
    spread: 0.13,
  },
  rifle: {
    name: "Longshadow",
    kind: "Repeater",
    capacity: 8,
    damage: 57,
    rate: 0.68,
    reload: 2.3,
    range: 75,
    spread: 0.09,
  },
} as const;
export type WeaponId = keyof typeof WEAPONS;
export const STAGES = [
  {
    id: "meet",
    title: "A promise to keep",
    text: "Speak to Ada at Cinder Creek camp.",
    location: "CINDER CREEK",
    target: ADA,
  },
  {
    id: "mount",
    title: "An old friend",
    text: "Saddle up. Your horse, Juniper, is waiting.",
    location: "CINDER CREEK",
    target: { x: -51, z: 44 },
  },
  {
    id: "trail",
    title: "The cold trail",
    text: "Follow the road to the abandoned wagon.",
    location: "SAGEBRUSH TRAIL",
    target: WAGON,
  },
  {
    id: "outpost",
    title: "Bad company",
    text: "Cross the bridge. Find the stolen medicine at Mercy Station.",
    location: "MERCY STATION",
    target: POST,
  },
  {
    id: "fight",
    title: "A little persuasion",
    text: "Defeat the Cinder gang. Use rocks and crates for cover.",
    location: "MERCY STATION",
    target: POST,
  },
  {
    id: "choice",
    title: "The weight of mercy",
    text: "The gang leader has surrendered. Decide his fate.",
    location: "MERCY STATION",
    target: BOSS,
  },
  {
    id: "medicine",
    title: "Something worth saving",
    text: "Collect the medicine from the supply chest.",
    location: "MERCY STATION",
    target: CRATE,
  },
  {
    id: "return",
    title: "The long way home",
    text: "Bring the medicine back to Ada.",
    location: "CINDER CREEK",
    target: ADA,
  },
  {
    id: "complete",
    title: "The last good deed",
    text: "The camp will see another sunrise.",
    location: "CINDER CREEK",
    target: CAMP,
  },
] as const;
export type StageId = (typeof STAGES)[number]["id"];
export const ENEMY_SPAWNS = [
  { x: 30, z: -21 },
  { x: 42, z: -25 },
  { x: 35, z: -38 },
  { x: 49, z: -33 },
  { x: 59, z: -44 },
];
export const OBSTACLES: Obstacle[] = [
  ...FRONTIER_OBSTACLES,
  { x: 39, z: -44, r: 4.2, height: 5, kind: "building" },
  { x: 61, z: -27, r: 3.5, height: 5, kind: "building" },
  { x: 24, z: -23, r: 2.1, height: 1.9, kind: "rock" },
  { x: 33, z: -30, r: 1.25, height: 1.1, kind: "crate" },
  { x: 46, z: -29, r: 1.25, height: 1.5, kind: "crate" },
  { x: 51, z: -46, r: 1.1, height: 1.4, kind: "crate" },
  { x: 18, z: -13, r: 2.4, height: 2.5, kind: "rock" },
  { x: -35, z: 26, r: 2.4, height: 2.3, kind: "rock" },
  { x: -45, z: 56, r: 2.4, height: 3, kind: "rock" },
  { x: -72, z: 51, r: 2.7, height: 3, kind: "rock" },
  { x: -64, z: 57, r: 2.6, height: 2.6, kind: "building" },
  { x: -66, z: 33, r: 2.6, height: 2.6, kind: "building" },
  { x: -28, z: 20, r: 1.8, height: 1.3, kind: "crate" },
  { x: 6, z: 28, r: 3.4, height: 3, kind: "rock" },
  { x: 63, z: 9, r: 4.2, height: 4, kind: "rock" },
];
export const TRAIL: Vec2[] = [
  CAMP,
  { x: -42, z: 32 },
  WAGON,
  { x: -21, z: 7 },
  BRIDGE,
  { x: 6, z: 6 },
  { x: 20, z: -5 },
  { x: 27, z: -14 },
  POST,
];
export const FIELD_GUIDE = [
  {
    title: "Beyond Cinder Creek",
    copy: "Eight frontier landmarks wait beyond camp. Open the journal and use D-pad Left or Right to choose a destination. Cross tracks it on your compass. Camps restore your cores; trail markers tell the territory’s stories.",
    keys: "Tab · Left / Right arrows · Enter to track",
  },
  {
    title: "Ride the frontier",
    copy: "Left stick moves. Right stick looks. Hold Cross to sprint or gallop. Triangle mounts Juniper; hold D-pad Up to call her. She follows the road best at a steady pace.",
    keys: "WASD · Mouse drag / arrows · Shift · E · H",
  },
  {
    title: "Make every shot count",
    copy: "Hold L2 to aim. R2 fires. Square reloads. Press R3 for Focus: time slows while your focus core drains. Aim near an outlaw to engage gentle aim assistance.",
    keys: "Right mouse · Left mouse / Space · R · F",
  },
  {
    title: "Keep your promises",
    copy: "Triangle interacts with the closest person or object. The compass and map show your next objective. Supplies, choices, and mission checkpoints are saved automatically.",
    keys: "E · Tab opens the journal",
  },
  {
    title: "Look after yourself",
    copy: "Hold L1 for the equipment wheel. Choose a revolver, repeater, or tonic with the stick. Rest by the campfire to refill your cores. Pick sage to brew more tonic.",
    keys: "Q wheel · 1 / 2 weapons · C tonic",
  },
  {
    title: "A name follows you",
    copy: "Mercy earns honor. Violence near camp creates witnesses and a bounty. Leave the search area and keep your weapon quiet until the heat fades. The trader sells supplies.",
    keys: "Camp: trader, campfire, Ada · Mercy Station: cover and loot",
  },
];
