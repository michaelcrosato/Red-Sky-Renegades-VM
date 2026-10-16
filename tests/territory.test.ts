import test from "node:test";
import assert from "node:assert/strict";
import { CatmullRomCurve3, Vector3 } from "three";
import {
  MAP_HALF_EXTENT,
  MAP_AREA,
  LANDMARKS,
  FRONTIER_ROADS,
  RIVER_CROSSINGS,
  ORIGINAL_HALF_EXTENT,
  SCENERY_HALF_EXTENT,
} from "../src/game/territory.ts";
import {
  groundHeight,
  moveWithCollision,
  distance,
  angleTo,
  crossingAt,
  riverX,
} from "../src/engine/math.ts";
import { newGame, Simulation } from "../src/engine/simulation.ts";
import { emptyControls } from "../src/engine/types.ts";
import { SaveStore, SAVE_KEY, validSave } from "../src/engine/save.ts";
import { CAMP, TRAIL } from "../src/game/content.ts";
import { mapPoint } from "../src/ui/territory-map.ts";

test("playable surface is exactly ten times the original area, with bounds in every direction", () => {
  assert.ok(Math.abs(MAP_AREA / (216 * 216) - 10) < 1e-12);
  assert.equal(ORIGINAL_HALF_EXTENT, 108);
  assert.ok(SCENERY_HALF_EXTENT > MAP_HALF_EXTENT + 150);
  for (const sign of [-1, 1]) {
    assert.equal(
      moveWithCollision({ x: 0, z: 0 }, sign * 10000, 0, []).x,
      sign * MAP_HALF_EXTENT,
    );
    assert.equal(
      moveWithCollision({ x: 0, z: 0 }, 0, sign * 10000, []).z,
      sign * MAP_HALF_EXTENT,
    );
  }
  for (let x = -MAP_HALF_EXTENT; x <= MAP_HALF_EXTENT; x += 20)
    for (let z = -MAP_HALF_EXTENT; z <= MAP_HALF_EXTENT; z += 20)
      assert.ok(Number.isFinite(groundHeight(x, z)));
});
test("all eight new destinations are beyond the original map and joined to the core trail network", () => {
  const key = (p: { x: number; z: number }) => `${p.x}:${p.z}`,
    edges = new Map<string, Set<string>>();
  for (const road of [TRAIL, ...FRONTIER_ROADS])
    for (let i = 1; i < road.length; i++) {
      const a = key(road[i - 1]),
        b = key(road[i]);
      for (const [from, to] of [
        [a, b],
        [b, a],
      ]) {
        if (!edges.has(from)) edges.set(from, new Set());
        edges.get(from)!.add(to);
      }
    }
  const visited = new Set<string>(),
    queue = [key(CAMP)];
  while (queue.length) {
    const k = queue.shift()!;
    if (visited.has(k)) continue;
    visited.add(k);
    queue.push(...(edges.get(k) ?? []));
  }
  assert.equal(LANDMARKS.length, 8);
  for (const l of LANDMARKS) {
    assert.ok(Math.max(Math.abs(l.x), Math.abs(l.z)) > 108);
    assert.ok(visited.has(key(l)), `${l.name} connected`);
    assert.ok(
      Math.abs(l.x) < MAP_HALF_EXTENT && Math.abs(l.z) < MAP_HALF_EXTENT,
    );
  }
});
test("a mounted player can ride every new rendered trail without colliding into a dead end", () => {
  for (const road of FRONTIER_ROADS) {
    const sim = new Simulation(newGame("range")),
      p = sim.state.player;
    p.mounted = true;
    Object.assign(p, road[0]);
    Object.assign(sim.state.horse, road[0]);
    const curve = new CatmullRomCurve3(
        road.map((v) => new Vector3(v.x, 0, v.z)),
      ),
      path = curve.getSpacedPoints(Math.ceil(curve.getLength() / 4));
    for (const target of path.slice(1)) {
      for (let i = 0; i < 600 && distance(p, target) > 1.4; i++) {
        const c = emptyControls();
        c.moveZ = 1;
        c.sprint = true;
        sim.update(1 / 60, c, angleTo(p, target));
        sim.drain();
      }
      assert.ok(
        distance(p, target) < 1.5,
        `trail ${JSON.stringify(road[0])} blocked at ${JSON.stringify({ x: p.x, z: p.z, target })}`,
      );
    }
  }
});
test("all river bridges share their rendered deck height and remove the water slowdown", () => {
  assert.equal(RIVER_CROSSINGS.length, 3);
  for (const b of RIVER_CROSSINGS) {
    const x = riverX(b.z);
    assert.equal(groundHeight(x, b.z), b.height);
    assert.ok(crossingAt(x, b.z));
    const sim = new Simulation(newGame("range"));
    Object.assign(sim.state.player, { x, z: b.z, mounted: true });
    const c = emptyControls();
    c.moveZ = 1;
    sim.update(0.1, c, Math.PI / 2);
    assert.equal(sim.state.player.speed, 8.7);
  }
});
test("existing saves migrate additively and positions in every expanded corner persist", () => {
  const memory = new Map<string, string>(),
    store = new SaveStore({
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => {
        memory.set(k, v);
      },
      removeItem: (k) => {
        memory.delete(k);
      },
    });
  const legacy = newGame() as unknown as Record<string, unknown>;
  delete legacy.discovered;
  delete legacy.explorationTarget;
  memory.set(SAVE_KEY, JSON.stringify(legacy));
  const loaded = store.load()!;
  assert.ok(loaded);
  assert.deepEqual(loaded.discovered, []);
  assert.equal(loaded.explorationTarget, null);
  assert.deepEqual(loaded.player, legacy.player);
  for (const x of [-335, 335])
    for (const z of [-335, 335]) {
      Object.assign(loaded.player, { x, z });
      Object.assign(loaded.horse, { x, z });
      loaded.explorationTarget = LANDMARKS[0].id;
      assert.ok(store.write(loaded));
      assert.deepEqual(store.load()!.player, loaded.player);
    }
  loaded.player.x = MAP_HALF_EXTENT + 10;
  assert.equal(validSave(loaded), false);
});
test("landmark discovery is one-time, camps restore cores, and a tracked destination persists", () => {
  const sim = new Simulation();
  const place = LANDMARKS[0];
  Object.assign(sim.state.player, place);
  sim.state.player.health = 20;
  sim.state.horse.stamina = 10;
  sim.update(0.1, emptyControls(), 0);
  assert.deepEqual(sim.state.discovered, [place.id]);
  sim.update(0.1, emptyControls(), 0);
  assert.equal(sim.state.discovered.length, 1);
  sim.interact();
  assert.equal(sim.state.player.health, 100);
  assert.equal(sim.state.horse.stamina, 100);
  assert.equal(sim.pendingDialogue?.speaker, place.name.toUpperCase());
  assert.ok(sim.navigateTo(place.id));
  assert.equal(sim.state.explorationTarget, place.id);
  assert.equal(sim.navigateTo("missing"), false);
  assert.ok(sim.navigateTo(null));
});
test("the atlas projects the full playable boundary and outer landmarks inside its paper border", () => {
  assert.deepEqual(mapPoint({ x: -MAP_HALF_EXTENT, z: -MAP_HALF_EXTENT }), {
    x: 24,
    y: 24,
  });
  assert.deepEqual(mapPoint({ x: MAP_HALF_EXTENT, z: MAP_HALF_EXTENT }), {
    x: 396,
    y: 396,
  });
  for (const l of LANDMARKS) {
    const p = mapPoint(l);
    assert.ok(p.x > 24 && p.x < 396 && p.y > 24 && p.y < 396);
  }
});
