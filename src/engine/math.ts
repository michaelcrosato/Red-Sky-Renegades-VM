export interface Vec2 { x: number; z: number }
export const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
export const angleTo = (a: Vec2, b: Vec2) => Math.atan2(b.x - a.x, b.z - a.z);
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export function random(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const riverX = (z: number) => -8 + Math.sin(z * .028) * 8;
export function terrainHeight(x: number, z: number): number {
  const base = Math.sin(x * .021) * .85 + Math.cos(z * .033) * .55 + Math.sin((x + z) * .049) * .3;
  const river = Math.abs(x - riverX(z));
  return base - (1 - clamp((river - 3.5) / 3)) * 2.2;
}
export function groundHeight(x: number, z: number) {
  if (Math.abs(z - 6) < 3.5 && Math.abs(x - riverX(6)) < 10) return .65;
  return terrainHeight(x, z);
}
export interface Obstacle extends Vec2 { r: number; height: number; kind: 'rock' | 'building' | 'crate' | 'tree' }
export function moveWithCollision(p: Vec2, dx: number, dz: number, obstacles: Obstacle[], radius = .48): Vec2 {
  let x = clamp(p.x + dx, -108, 108), z = clamp(p.z + dz, -108, 108);
  for (let iteration = 0; iteration < 2; iteration++) for (const o of obstacles) {
    const d = Math.hypot(x - o.x, z - o.z), min = o.r + radius;
    if (d < min) { x = o.x + (d > .0001 ? (x - o.x) / d : 1) * min; z = o.z + (d > .0001 ? (z - o.z) / d : 0) * min; }
  }
  return { x, z };
}
export function lineBlocked(a: Vec2, b: Vec2, obstacles: Obstacle[], minHeight = 1.3) {
  const vx = b.x - a.x, vz = b.z - a.z, length2 = vx * vx + vz * vz;
  if (length2 < .001) return false;
  return obstacles.some(o => {
    if (o.height < minHeight) return false;
    const t = clamp(((o.x - a.x) * vx + (o.z - a.z) * vz) / length2);
    return t > .06 && t < .96 && Math.hypot(a.x + vx * t - o.x, a.z + vz * t - o.z) < o.r * .92;
  });
}
