import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, newGame } from "../src/engine/simulation.ts";
import { emptyControls } from "../src/engine/types.ts";
import { Director } from "../src/game/director.ts";
import {
  ADA,
  BOSS,
  CAMP,
  CRATE,
  MERCHANT,
  OBSTACLES,
  WEAPONS,
} from "../src/game/content.ts";
import {
  angleTo,
  distance,
  groundHeight,
  lineBlocked,
  moveWithCollision,
} from "../src/engine/math.ts";
import { SaveStore, SAVE_KEY, validSave } from "../src/engine/save.ts";

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
  };
}
function play(sim: Simulation, limit = 600) {
  const director = new Director(),
    stages: string[] = [];
  let previous = "";
  for (let i = 0; i < limit * 60; i++) {
    const d = director.update(1 / 60, sim);
    sim.update(1 / 60, d.controls, d.yaw);
    sim.drain();
    if (previous !== sim.state.stage) {
      previous = sim.state.stage;
      stages.push(previous);
    }
    if (sim.state.stage === "complete") return { stages, seconds: i / 60 };
    if (d.restart)
      throw new Error(
        `Director restart before completion: ${JSON.stringify({ stage: sim.state.stage, pos: sim.state.player, age: director.stageAge, enemies: sim.state.enemies })}`,
      );
  }
  throw new Error(
    `No completion: ${JSON.stringify({ stage: sim.state.stage, pos: sim.state.player, stages })}`,
  );
}

test("autonomous director finishes the complete story using player commands", () => {
  const s = new Simulation();
  const result = play(s);
  assert.deepEqual(result.stages, [
    "meet",
    "mount",
    "trail",
    "outpost",
    "fight",
    "choice",
    "medicine",
    "return",
    "complete",
  ]);
  assert.equal(s.state.choice, "mercy");
  assert.equal(s.state.inventory.medicine, false);
  assert.equal(s.state.kills, 5);
  assert.ok(s.state.inventory.dollars >= 89);
  assert.equal(s.state.honor, 40);
  assert.ok(s.state.player.health > 0);
  assert.ok(s.state.shots > 0);
  assert.ok(result.seconds > 30);
});
test("three fresh attract cycles remain deterministic and finish", () => {
  for (let i = 0; i < 3; i++) {
    const sim = new Simulation();
    play(sim);
    assert.equal(sim.state.stage, "complete");
  }
});
test("checkpoint roundtrip preserves supplies, mission and choice", () => {
  const storage = memory(),
    save = new SaveStore(storage),
    sim = new Simulation();
  Object.assign(sim.state.player, { x: BOSS.x, z: BOSS.z });
  sim.state.stage = "choice";
  sim.choose(false);
  save.write(sim.state);
  const loaded = save.load()!;
  assert.equal(loaded.stage, "medicine");
  assert.equal(loaded.choice, "revenge");
  assert.equal(loaded.honor, -20);
  assert.equal(loaded.player.reserve.revolver, 60);
  loaded.inventory.tonics = 99;
  assert.equal(save.load()!.inventory.tonics, 3);
});
test("corrupt or unsupported saves are rejected and storage failures are contained", () => {
  const storage = memory(),
    save = new SaveStore(storage);
  storage.setItem(SAVE_KEY, "{bad");
  assert.equal(save.load(), null);
  storage.setItem(SAVE_KEY, JSON.stringify({ ...newGame(), version: 9 }));
  assert.equal(save.load(), null);
  const broken = new SaveStore({
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
    removeItem() {
      throw Error();
    },
  });
  assert.equal(broken.load(), null);
  assert.equal(broken.write(newGame()), false);
  assert.ok(broken.error);
});
test("structurally incomplete and nonfinite state cannot hydrate into a game", () => {
  const s = newGame();
  assert.ok(validSave(s));
  const broken = structuredClone(s) as unknown as Record<string, any>;
  delete broken.horse.stamina;
  assert.equal(validSave(broken), false);
  broken.horse.stamina = 100;
  broken.player.focus = NaN;
  assert.equal(validSave(broken), false);
  broken.player.focus = 100;
  broken.enemies[0].home = null;
  assert.equal(validSave(broken), false);
});
test("obstacles block movement and line of fire, bridge has a walkable surface", () => {
  const wall = { x: 0, z: 0, r: 2, height: 4, kind: "building" as const };
  const p = moveWithCollision({ x: 0, z: 3 }, 0, -2, [wall]);
  assert.ok(distance(p, wall) >= 2.45);
  assert.ok(lineBlocked({ x: -5, z: 0 }, { x: 5, z: 0 }, [wall]));
  assert.equal(groundHeight(-7, 6), 0.65);
});
test("aimed gunfire consumes rounds, cannot shoot through cover, and reload is finite", () => {
  const sim = new Simulation(),
    p = sim.state.player,
    e = sim.state.enemies[0];
  Object.assign(p, { x: 20, z: -23, aiming: true });
  Object.assign(e, { x: 28, z: -23 });
  const yaw = angleTo(p, e);
  sim.shoot(yaw);
  assert.equal(e.health, 100);
  assert.equal(p.ammo.revolver, 5);
  p.shot = 0;
  Object.assign(p, { x: 28, z: -15 });
  sim.shoot(angleTo(p, e));
  assert.equal(e.health, 58);
  p.reserve.revolver = 1;
  sim.startReload();
  const c = emptyControls();
  sim.update(2, c, p.yaw);
  assert.equal(p.ammo.revolver, 5);
  assert.equal(p.reserve.revolver, 0);
});
test("focus slows hostile world time and drains, tonic does not create infinite health", () => {
  const sim = new Simulation();
  const c = emptyControls();
  c.focus = true;
  sim.update(1, c, 0);
  assert.equal(sim.state.player.focus, 85);
  assert.ok(sim.state.player.focusing);
  assert.ok(sim.state.time - 16.6 < 0.002);
  sim.state.player.health = 40;
  sim.heal();
  assert.equal(sim.state.player.health, 100);
  assert.equal(sim.state.inventory.tonics, 2);
  sim.heal();
  assert.equal(sim.state.inventory.tonics, 2);
});
test("trader validates proximity and price, purchases persist", () => {
  const sim = new Simulation();
  assert.equal(sim.buy("tonic"), false);
  Object.assign(sim.state.player, MERCHANT);
  assert.equal(sim.buy("ammo"), true);
  assert.equal(sim.state.inventory.dollars, 18);
  assert.equal(sim.state.player.reserve.revolver, 66);
  sim.state.inventory.dollars = 1;
  assert.equal(sim.buy("tonic"), false);
  assert.equal(sim.state.inventory.tonics, 3);
});
test("witnessed gunfire creates a bounty and distance lets the search expire", () => {
  const sim = new Simulation();
  Object.assign(sim.state.player, CAMP);
  sim.shoot(0);
  assert.equal(sim.state.bounty, 5);
  assert.equal(sim.state.honor, -5);
  Object.assign(sim.state.player, { x: -90, z: 90 });
  for (let i = 0; i < 36; i++) sim.update(1, emptyControls(), 0);
  assert.equal(sim.state.heat, 0);
  assert.equal(sim.state.bounty, 5);
});
test("medicine and ending require the quest, mercy can only be chosen at surrender", () => {
  const sim = new Simulation();
  sim.choose(true);
  assert.equal(sim.state.choice, null);
  Object.assign(sim.state.player, CRATE);
  sim.interact();
  assert.equal(sim.state.inventory.medicine, false);
  sim.state.stage = "medicine";
  sim.interact();
  assert.equal(sim.state.stage, "return");
  Object.assign(sim.state.player, ADA);
  sim.interact();
  assert.equal(sim.state.stage, "complete");
  assert.equal(sim.state.inventory.medicine, false);
  assert.equal(sim.state.inventory.dollars, 89);
});
test("horse mount, dismount and whistle use normal interactions", () => {
  const sim = new Simulation();
  Object.assign(sim.state.player, sim.state.horse);
  sim.state.stage = "mount";
  sim.interact();
  assert.equal(sim.state.player.mounted, true);
  assert.equal(sim.state.stage, "trail");
  sim.interact();
  assert.equal(sim.state.player.mounted, false);
  sim.state.player.x += 15;
  const c = emptyControls();
  c.whistle = true;
  sim.update(0.1, c, 0);
  assert.equal(sim.state.horse.following, true);
  const before = distance(sim.state.player, sim.state.horse);
  for (let i = 0; i < 100; i++) sim.update(0.05, emptyControls(), 0);
  assert.ok(distance(sim.state.player, sim.state.horse) < before);
});
test("proving ground is separate from story saves and resets targets", () => {
  const sim = new Simulation(newGame("range")),
    store = new SaveStore(memory());
  assert.equal(store.write(sim.state), false);
  sim.state.targets[0].health = 0;
  Object.assign(sim.state.player, { x: 84, z: 49 });
  sim.interact();
  assert.ok(sim.state.targets.every((t) => t.health === 100));
  assert.equal(sim.state.player.reserve.revolver, 90);
});
