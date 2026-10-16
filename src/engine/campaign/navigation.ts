import { FRONTIER_ROADS, MAP_HALF_EXTENT } from "../../game/territory";
import { OBSTACLES, TRAIL } from "../../game/content";
import { distance, lineBlocked, type Vec2 } from "../math";

export function freePosition(desired: Vec2, margin = 1.2): Vec2 {
  for (let ring = 0; ring < 14; ring++)
    for (let i = 0; i < (ring ? 24 : 1); i++) {
      const angle = (i / 24) * Math.PI * 2,
        r = ring * 2.5,
        x = Math.max(
          -MAP_HALF_EXTENT + 4,
          Math.min(MAP_HALF_EXTENT - 4, desired.x + Math.sin(angle) * r),
        ),
        z = Math.max(
          -MAP_HALF_EXTENT + 4,
          Math.min(MAP_HALF_EXTENT - 4, desired.z + Math.cos(angle) * r),
        );
      if (OBSTACLES.every((o) => Math.hypot(x - o.x, z - o.z) > o.r + margin))
        return { x, z };
    }
  return { x: -50, z: 45 };
}
/** Persistent escort routes reuse the territory's connected road graph. */
export function roadRoute(from: Vec2, to: Vec2): Vec2[] {
  const nodes: Vec2[] = [],
    edges = new Map<number, { to: number; cost: number }[]>(),
    indices = new Map<string, number>();
  const node = (p: Vec2) => {
    const key = `${p.x}:${p.z}`;
    let index = indices.get(key);
    if (index === undefined) {
      index = nodes.length;
      indices.set(key, index);
      nodes.push({ ...p });
      edges.set(index, []);
    }
    return index;
  };
  for (const road of [TRAIL, ...FRONTIER_ROADS])
    for (let i = 1; i < road.length; i++) {
      const a = node(road[i - 1]),
        b = node(road[i]);
      edges.get(a)!.push({ to: b, cost: distance(nodes[a], nodes[b]) });
      edges.get(b)!.push({ to: a, cost: distance(nodes[a], nodes[b]) });
    }
  const nearest = (p: Vec2) =>
      nodes.reduce(
        (best, n, i) => (distance(n, p) < distance(nodes[best], p) ? i : best),
        0,
      ),
    start = nearest(from),
    goal = nearest(to),
    dist = new Map<number, number>([[start, 0]]),
    previous = new Map<number, number>(),
    open = new Set([start]);
  while (open.size) {
    let current = [...open].reduce((a, b) =>
      dist.get(a)! < dist.get(b)! ? a : b,
    );
    open.delete(current);
    if (current === goal) break;
    for (const edge of edges.get(current)!) {
      const cost = dist.get(current)! + edge.cost;
      if (cost < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, cost);
        previous.set(edge.to, current);
        open.add(edge.to);
      }
    }
  }
  const route = [goal];
  let current = goal;
  while (current !== start) {
    const p = previous.get(current);
    if (p === undefined) return [freePosition(to)];
    route.unshift(p);
    current = p;
  }
  return [...route.map((i) => freePosition(nodes[i])), freePosition(to)];
}
/** A cheap local detour for combat actors approaching a circular obstacle. */
export function steerAround(from: Vec2, to: Vec2): Vec2 {
  if (!lineBlocked(from, to, OBSTACLES, 0.5)) return to;
  const dx = to.x - from.x,
    dz = to.z - from.z,
    len = Math.hypot(dx, dz) || 1;
  for (const side of [-1, 1])
    for (const reach of [5, 10, 17]) {
      const candidate = freePosition({
        x: from.x + (dx / len) * 3 - (dz / len) * reach * side,
        z: from.z + (dz / len) * 3 + (dx / len) * reach * side,
      });
      if (!lineBlocked(from, candidate, OBSTACLES, 0.5)) return candidate;
    }
  return to;
}
