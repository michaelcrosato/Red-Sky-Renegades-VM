import { MAP_HALF_EXTENT, RIVER_CROSSINGS } from "../game/territory";
export interface Vec2 {
  x: number;
  z: number;
}
export const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
export const angleTo = (a: Vec2, b: Vec2) => Math.atan2(b.x - a.x, b.z - a.z);
export const angleDelta = (a: number, b: number) =>
  Math.atan2(Math.sin(b - a), Math.cos(b - a));
export function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const riverX = (z: number) => -8 + Math.sin(z * 0.028) * 8;
export function terrainHeight(x: number, z: number): number {
  const base =
    Math.sin(x * 0.021) * 0.85 +
    Math.cos(z * 0.033) * 0.55 +
    Math.sin((x + z) * 0.049) * 0.3;
  const river = Math.abs(x - riverX(z));
  const outer = clamp((Math.max(Math.abs(x), Math.abs(z)) - 110) / 65);
  const ridge = (cx: number, cz: number, r: number, h: number) =>
    Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r)) * h;
  const hills =
    4 +
    Math.sin(x * 0.012) * 3 +
    Math.cos(z * 0.011) * 2 +
    ridge(-235, -245, 95, 19) +
    ridge(230, -210, 110, 20) +
    ridge(-275, -40, 100, 12) +
    ridge(260, 80, 85, 13);
  return (
    base -
    (1 - clamp((river - 3.5) / 3)) * 2.2 +
    outer * outer * (3 - 2 * outer) * hills * clamp((river - 8) / 32)
  );
}
export function crossingAt(x: number, z: number) {
  return RIVER_CROSSINGS.find(
    (b) =>
      Math.abs(z - b.z) < b.halfWidth &&
      Math.abs(x - riverX(b.z)) < b.halfLength + 10,
  );
}
export function groundHeight(x: number, z: number) {
  const crossing = crossingAt(x, z);
  if (crossing) {
    const ramp = clamp(
      (Math.abs(x - riverX(crossing.z)) - crossing.halfLength) / 10,
    );
    return lerp(crossing.height, terrainHeight(x, z), ramp);
  }
  return terrainHeight(x, z);
}
export interface Obstacle extends Vec2 {
  r: number;
  height: number;
  kind: "rock" | "building" | "crate" | "tree" | "mesa";
}
export function moveWithCollision(
  p: Vec2,
  dx: number,
  dz: number,
  obstacles: Obstacle[],
  radius = 0.48,
): Vec2 {
  let x = clamp(p.x + dx, -MAP_HALF_EXTENT, MAP_HALF_EXTENT),
    z = clamp(p.z + dz, -MAP_HALF_EXTENT, MAP_HALF_EXTENT);
  for (let iteration = 0; iteration < 2; iteration++)
    for (const o of obstacles) {
      const d = Math.hypot(x - o.x, z - o.z),
        min = o.r + radius;
      if (d < min) {
        x = o.x + (d > 0.0001 ? (x - o.x) / d : 1) * min;
        z = o.z + (d > 0.0001 ? (z - o.z) / d : 0) * min;
      }
    }
  return {
    x: clamp(x, -MAP_HALF_EXTENT, MAP_HALF_EXTENT),
    z: clamp(z, -MAP_HALF_EXTENT, MAP_HALF_EXTENT),
  };
}
export function lineBlocked(
  a: Vec2,
  b: Vec2,
  obstacles: Obstacle[],
  minHeight = 1.3,
) {
  const vx = b.x - a.x,
    vz = b.z - a.z,
    length2 = vx * vx + vz * vz;
  if (length2 < 0.001) return false;
  return obstacles.some((o) => {
    if (o.height < minHeight) return false;
    const t = clamp(((o.x - a.x) * vx + (o.z - a.z) * vz) / length2);
    return (
      t > 0.06 &&
      t < 0.96 &&
      Math.hypot(a.x + vx * t - o.x, a.z + vz * t - o.z) < o.r * 0.92
    );
  });
}
