/** Offline browser QA scenarios. Never imported by the shipped game. */
import fs from "node:fs/promises";
import path from "node:path";
import { Simulation, newGame } from "../src/engine/simulation.ts";
import { HUBS, GEAR_SLOTS } from "../src/game/campaign/catalog.ts";
import { FIRE } from "../src/game/content.ts";
import { rollItem } from "../src/engine/campaign/loot.ts";
import { xpToNext } from "../src/engine/campaign/progression.ts";
import { generateContract } from "../src/engine/campaign/generator.ts";
import { freePosition } from "../src/engine/campaign/navigation.ts";
import { angleTo, distance } from "../src/engine/math.ts";
import { validSave } from "../src/engine/save.ts";

const output = process.argv[2] || "/tmp/red-sky-campaign";
await fs.mkdir(output, { recursive: true });
const position = (sim: Simulation, p: { x: number; z: number }) => {
  sim.state.player.x = p.x;
  sim.state.player.z = p.z;
};
function veteran() {
  const sim = new Simulation(newGame("story", 817491)),
    s = sim.state,
    c = s.campaign;
  position(sim, HUBS[0]);
  s.stage = "complete";
  s.choice = "mercy";
  s.completedAt = 0;
  s.enemies.forEach((e) => {
    e.health = 0;
    e.state = "dead";
  });
  s.inventory.dollars = 2000;
  Object.keys(c.materials).forEach(
    (k) => (c.materials[k as keyof typeof c.materials] = 1000),
  );
  sim.campaign.awardXP(
    Array.from({ length: 19 }, (_, i) => xpToNext(i + 1)).reduce(
      (a, b) => a + b,
      0,
    ),
  );
  for (let i = 0; i < GEAR_SLOTS.length; i++) {
    const item = rollItem(
      1000 + i,
      `qa-${GEAR_SLOTS[i]}`,
      25,
      4,
      0,
      "unique",
      GEAR_SLOTS[i],
    );
    sim.campaign.gear.receive(item);
    sim.campaign.gear.equip(item.id);
    for (let n = 0; n < 5; n++) sim.campaign.gear.upgrade(item.id);
    sim.campaign.gear.socket(
      item.id,
      ["ember", "frost", "vigor", "fortune", "vigor", "fortune"][i] as
        | "ember"
        | "frost"
        | "vigor"
        | "fortune",
    );
  }
  for (const [id, n] of [
    ["steady-hand", 3],
    ["quickloader", 3],
    ["deadeye", 2],
    ["executioner", 2],
    ["leadstorm", 1],
    ["vitality", 2],
    ["ironhide", 2],
    ["campcraft", 1],
    ["resilience", 1],
    ["unbroken", 1],
    ["scavenger", 1],
  ] as const)
    for (let i = 0; i < n; i++) sim.campaign.gear.learn(id);
  c.reputation = { settlers: 150, wardens: 150, prospectors: 150 };
  sim.campaign.setDifficulty(4);
  position(sim, FIRE);
  sim.interact();
  position(sim, HUBS[0]);
  s.player.health = sim.campaign.stats.health;
  s.player.weapon = "rifle";
  sim.drain();
  return sim;
}
async function write(name: string, sim: Simulation) {
  if (!validSave(sim.state)) throw Error(`Invalid QA fixture: ${name}`);
  await fs.writeFile(
    path.join(output, `${name}.json`),
    JSON.stringify(sim.state),
  );
}
const base = veteran();
await write("endgame", base);
const capture = new Simulation(base.state);
const bounty = generateContract(
  capture.state.campaign,
  "cinder",
  "bounty",
  551,
  4,
);
capture.state.campaign.boards.cinder = [bounty];
capture.campaign.accept("cinder", bounty.id);
position(capture, bounty.objectives[0]);
capture.campaign.tick(0.1);
capture.campaign.tick(0.1);
const boss = capture.state.campaign.enemies.find((e) => e.boss)!;
capture.state.campaign.enemies.forEach((e) => {
  e.cooldown = e.ability = 999;
});
boss.health = boss.maxHealth * 0.25;
const angle = angleTo(bounty.objectives[1], boss),
  near = freePosition(
    { x: boss.x + Math.sin(angle) * 3, z: boss.z + Math.cos(angle) * 3 },
    0.5,
  );
position(capture, near);
capture.state.player.yaw = angleTo(near, boss);
await write("capture", capture);
const hazard = new Simulation(capture.state);
const storm = hazard.state.campaign.enemies.find((e) => e.boss)!;
storm.health = storm.maxHealth;
storm.ability = 0;
storm.modifiers = ["stormbound"];
position(hazard, { x: bounty.objectives[1].x, z: bounty.objectives[1].z + 20 });
hazard.state.player.health = hazard.campaign.stats.health;
hazard.state.player.invulnerable = 0;
hazard.state.weather = "rain";
hazard.combat.enemyAbility(storm, 1, hazard.state.player);
await write("hazard", hazard);
const quest = new Simulation(base.state),
  q = generateContract(quest.state.campaign, "cinder", "quest", 9999, 4);
quest.state.campaign.boards.cinder = [q];
quest.campaign.accept("cinder", q.id);
while (q.index < 4) {
  const o = q.objectives[q.index];
  position(quest, o);
  quest.campaign.tick(0.1);
  if (q.objectives[q.index] !== o) continue;
  if (o.kind === "interact")
    for (const obj of [...quest.state.campaign.objects].filter(
      (v) => v.owner === q.id && !v.used,
    )) {
      position(quest, obj);
      quest.campaign.interact(`objective:${obj.id}`);
    }
  if (o.kind === "eliminate")
    for (const e of [...quest.state.campaign.enemies].filter(
      (e) => e.owner === q.id && e.health > 0,
    ))
      quest.combat.strike(e, 10000, false);
}
position(quest, q.objectives[q.index]);
quest.campaign.tick(0.1);
await write("ledger", quest);
console.log(`Wrote validated campaign QA fixtures to ${output}`);
