import type { Obstacle, Vec2 } from "../engine/math";

/** Metres, measured from the original 216 × 216 m playable square. */
export const ORIGINAL_HALF_EXTENT = 108;
export const MAP_AREA_MULTIPLIER = 10;
export const MAP_HALF_EXTENT =
  ORIGINAL_HALF_EXTENT * Math.sqrt(MAP_AREA_MULTIPLIER);
export const MAP_SIZE = MAP_HALF_EXTENT * 2;
export const MAP_AREA = MAP_SIZE ** 2;
export const SCENERY_HALF_EXTENT = 620;
export const SAVE_POSITION_LIMIT = MAP_HALF_EXTENT + 2;

export const RIVER_CROSSINGS = [
  { id: "mercy-bridge", z: 6, halfLength: 10, halfWidth: 3.5, height: 0.65 },
  { id: "north-fork", z: -190, halfLength: 14, halfWidth: 3.5, height: 1.25 },
  { id: "cottonwood", z: 210, halfLength: 14, halfWidth: 3.5, height: 1.25 },
] as const;

export const LANDMARKS = [
  {
    id: "pine-watch",
    name: "Pinewatch Camp",
    x: -235,
    z: -245,
    kind: "camp",
    region: "WHISPERING PINES",
    description: "A high-country camp among the pines. Rest and water Juniper.",
    story:
      "The fire is still warm. A pencilled note reads: ‘Leave dry wood for whoever follows. The mountain owes us nothing.’",
  },
  {
    id: "copper-mine",
    name: "Old Copper Mine",
    x: -275,
    z: -35,
    kind: "mine",
    region: "REDWASH CANYON",
    description: "Follow the abandoned ore road into Redwash Canyon.",
    story:
      "The last shift left in 1887. The ledger lists forty-seven names, and one final entry: ‘Every man came home.’",
  },
  {
    id: "split-spire",
    name: "Split Spire",
    x: 165,
    z: -265,
    kind: "arch",
    region: "SUNSCAR HIGHLANDS",
    description: "A sandstone arch above the northern wagon trail.",
    story:
      "Two pillars hold the weight of a whole red sky. Travellers once tied ribbons here before crossing the high country.",
  },
  {
    id: "sundown-relay",
    name: "Sundown Relay",
    x: 280,
    z: -80,
    kind: "station",
    region: "SUNSCAR HIGHLANDS",
    description: "An old telegraph stop at the eastern edge of the territory.",
    story:
      "The wire is silent, but the last message remains: ‘Train delayed. Tell my daughter I will be there for her birthday.’",
  },
  {
    id: "red-mesa",
    name: "Red Mesa Lookout",
    x: 260,
    z: 80,
    kind: "lookout",
    region: "SUNSCAR HIGHLANDS",
    description:
      "Climb the rolling eastern trail for a view across the valley.",
    story:
      "Someone carved a small compass into the rail. Beneath it: ‘Home is a direction you choose.’",
  },
  {
    id: "saltwind-mill",
    name: "Saltwind Mill",
    x: 250,
    z: 265,
    kind: "windmill",
    region: "SALTWIND FLATS",
    description: "A weathered water tower in the pale southern grasslands.",
    story:
      "A cup hangs from the pump, polished by a hundred passing hands. The sign says only: ‘Take what you need.’",
  },
  {
    id: "cottonwood-crossing",
    name: "Cottonwood Crossing",
    x: -25,
    z: 225,
    kind: "crossing",
    region: "COTTONWOOD LOWLANDS",
    description: "A sheltered river crossing on the southern wagon road.",
    story:
      "The old ferry rope still hangs on its post. The bridge is new; the names scratched into the dock are not.",
  },
  {
    id: "settlers-rest",
    name: "Settlers’ Rest",
    x: -255,
    z: 205,
    kind: "camp",
    region: "COTTONWOOD LOWLANDS",
    description:
      "A quiet campsite where the western trail turns toward the river.",
    story:
      "A wagon wheel marks the place where the first settlers stopped. Nobody agreed on a name, so they simply called it Rest.",
  },
] as const;
export type LandmarkId = (typeof LANDMARKS)[number]["id"];
export const landmarkById = (id: string | null) =>
  LANDMARKS.find((l) => l.id === id);

/** Every outer trail joins the original level or another connected trail. */
export const FRONTIER_ROADS: readonly (readonly Vec2[])[] = [
  [
    { x: -57, z: 46 },
    { x: -140, z: 30 },
    { x: -205, z: 0 },
    { x: -275, z: -35 },
  ],
  [
    { x: -140, z: 30 },
    { x: -145, z: -80 },
    { x: -180, z: -170 },
    { x: -235, z: -245 },
  ],
  [
    { x: -235, z: -245 },
    { x: -145, z: -225 },
    { x: -40, z: -190 },
    { x: 0, z: -190 },
    { x: 45, z: -190 },
    { x: 110, z: -235 },
    { x: 165, z: -265 },
  ],
  [
    { x: 165, z: -265 },
    { x: 240, z: -225 },
    { x: 275, z: -160 },
    { x: 260, z: -110 },
    { x: 263, z: -75 },
    { x: 280, z: -80 },
  ],
  [
    { x: 39, z: -29 },
    { x: 40, z: -15 },
    { x: 70, z: -12 },
    { x: 120, z: -25 },
    { x: 200, z: -50 },
    { x: 280, z: -80 },
  ],
  [
    { x: 280, z: -80 },
    { x: 280, z: 0 },
    { x: 280, z: 55 },
    { x: 275, z: 85 },
    { x: 260, z: 80 },
    { x: 275, z: 180 },
    { x: 270, z: 240 },
    { x: 267, z: 270 },
    { x: 250, z: 265 },
  ],
  [
    { x: -57, z: 46 },
    { x: -55, z: 105 },
    { x: -150, z: 165 },
    { x: -255, z: 205 },
  ],
  [
    { x: -275, z: -35 },
    { x: -290, z: 65 },
    { x: -280, z: 140 },
    { x: -255, z: 205 },
  ],
  [
    { x: -255, z: 205 },
    { x: -170, z: 255 },
    { x: -80, z: 240 },
    { x: -25, z: 225 },
    { x: -35, z: 210 },
    { x: 10, z: 210 },
    { x: 60, z: 225 },
    { x: 150, z: 255 },
    { x: 250, z: 265 },
  ],
  [
    { x: -55, z: 105 },
    { x: -40, z: 160 },
    { x: -25, z: 225 },
  ],
];

export const INTERIOR_MESAS = [
  { x: 91, z: -60, r: 17, h: 36 },
  { x: 101, z: -80, r: 12, h: 49 },
  { x: -91, z: -62, r: 15, h: 29 },
  { x: 65, z: -105, r: 21, h: 27 },
  { x: -93, z: 93, r: 22, h: 32 },
];
export const FRONTIER_OBSTACLES: Obstacle[] = [
  ...INTERIOR_MESAS.map((m) => ({
    x: m.x,
    z: m.z,
    r: m.r * 1.05,
    height: m.h,
    kind: "mesa" as const,
  })),
  { x: -235, z: -253, r: 3.2, height: 3, kind: "building" },
  { x: -255, z: 197, r: 3.2, height: 3, kind: "building" },
  { x: 280, z: -88, r: 5, height: 6, kind: "building" },
  { x: -275, z: -49, r: 7, height: 8, kind: "mesa" },
  { x: 153, z: -270, r: 5, height: 18, kind: "mesa" },
  { x: 177, z: -270, r: 5, height: 18, kind: "mesa" },
  { x: 260, z: 71, r: 4.5, height: 7, kind: "building" },
  { x: 250, z: 257, r: 3.5, height: 9, kind: "building" },
];

export function regionAt(x: number, z: number): string {
  if (x < -110 && z < -100) return "WHISPERING PINES";
  if (x < -110 && z < 100) return "REDWASH CANYON";
  if (x > 110 && z < 150) return "SUNSCAR HIGHLANDS";
  if (x > 80 && z >= 150) return "SALTWIND FLATS";
  if (z > 110) return "COTTONWOOD LOWLANDS";
  return "CINDER CREEK";
}

export function distanceToRoad(
  x: number,
  z: number,
  roads: readonly (readonly Vec2[])[] = FRONTIER_ROADS,
) {
  let best = Infinity;
  for (const road of roads)
    for (let i = 1; i < road.length; i++) {
      const a = road[i - 1],
        b = road[i],
        dx = b.x - a.x,
        dz = b.z - a.z;
      const t = Math.max(
        0,
        Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)),
      );
      best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
    }
  return best;
}
