import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, newGame } from "../src/engine/simulation.ts";
import { emptyControls } from "../src/engine/types.ts";
import {
  HUBS,
  GEAR_SLOTS,
  MAX_WORLD_DROPS,
} from "../src/game/campaign/catalog.ts";
import { LANDMARKS } from "../src/game/territory.ts";
import {
  CONTRACT_KINDS,
  generateContract,
} from "../src/engine/campaign/generator.ts";
import { newCampaign } from "../src/engine/campaign/state.ts";
import { validCampaign, validItem } from "../src/engine/campaign/validation.ts";
import {
  derivedStats,
  grantXP,
  learnTalent,
  xpToNext,
} from "../src/engine/campaign/progression.ts";
import {
  rollItem,
  rarityOrder,
  upgradeCost,
} from "../src/engine/campaign/loot.ts";
import { SaveStore, SAVE_KEY, validSave } from "../src/engine/save.ts";
import { marketMultiplier } from "../src/engine/campaign/gear.ts";
import { distance } from "../src/engine/math.ts";
import type { Contract, ContractKind } from "../src/engine/campaign/types.ts";
import { Director } from "../src/game/director.ts";

const put = (sim: Simulation, p: { x: number; z: number }) =>
  Object.assign(sim.state.player, { x: p.x, z: p.z });
function accept(sim: Simulation, kind: ContractKind, seed = 12345) {
  put(sim, HUBS[0]);
  const job = generateContract(sim.state.campaign, "cinder", kind, seed);
  sim.state.campaign.boards.cinder = [job];
  assert.ok(sim.campaign.accept("cinder", job.id));
  return job;
}
function complete(
  sim: Simulation,
  job: Contract,
  choice: "protect" | "profit" = "protect",
  capture = false,
) {
  for (let guard = 0; guard < 40 && job.status === "active"; guard++) {
    const o = job.objectives[job.index];
    put(sim, o);
    sim.campaign.tick(0.1);
    if (job.status !== "active" || job.objectives[job.index] !== o) continue;
    if (o.kind === "interact") {
      for (const obj of [...sim.state.campaign.objects].filter(
        (v) => v.owner === job.id && !v.used,
      )) {
        put(sim, obj);
        assert.ok(sim.campaign.interact(`objective:${obj.id}`));
      }
    } else if (o.kind === "choice") {
      assert.ok(sim.campaign.choose(job.id, choice));
    } else if (o.kind === "eliminate") {
      for (const e of [...sim.state.campaign.enemies].filter(
        (e) => e.owner === job.id && e.health > 0,
      )) {
        if (capture && e.boss) {
          e.health = e.maxHealth * 0.25;
          put(sim, e);
          assert.ok(sim.campaign.interact(`capture:${e.id}`));
        } else sim.combat.strike(e, 10000, false);
      }
    } else if (o.kind === "defend") {
      for (
        let i = 0;
        i < 180 && job.status === "active" && job.objectives[job.index] === o;
        i++
      ) {
        sim.campaign.tick(1);
        for (const e of [...sim.state.campaign.enemies].filter(
          (e) => e.owner === job.id && e.health > 0,
        ))
          sim.combat.strike(e, 10000, false);
      }
    } else if (o.kind === "escort") {
      const escort = sim.state.campaign.objects.find(
        (v) => v.owner === job.id,
      )!;
      put(sim, escort);
      assert.ok(sim.campaign.interact(`objective:${escort.id}`));
      for (
        let i = 0;
        i < 15000 && job.status === "active" && job.objectives[job.index] === o;
        i++
      ) {
        put(sim, { x: escort.x + 3, z: escort.z + 3 });
        sim.campaign.tick(0.1);
        for (const e of [...sim.state.campaign.enemies].filter(
          (e) => e.owner === job.id && e.health > 0,
        ))
          sim.combat.strike(e, 10000, false);
      }
    }
  }
  assert.equal(
    job.status,
    "ready",
    `${job.kind}: ${job.failure}; stage ${job.index}`,
  );
}

test("contract and loot generators reproduce a seed and combine varied content", () => {
  const a = newCampaign(42),
    b = newCampaign(42);
  assert.deepEqual(a, b);
  assert.deepEqual(
    generateContract(a, "cinder", "quest", 555, 3),
    generateContract(b, "cinder", "quest", 555, 3),
  );
  const variants = new Set<string>();
  for (let i = 0; i < 150; i++) {
    const c = generateContract(
      a,
      "sundown",
      CONTRACT_KINDS[i % 10],
      i * 997,
      1 + (i % 4),
    );
    variants.add(
      [
        c.kind,
        c.family,
        c.objectives.map((o) => o.siteId).join(","),
        c.modifiers.join(","),
      ].join(":"),
    );
  }
  assert.ok(variants.size > 100);
  assert.deepEqual(
    rollItem(123, "loot-test", 12, 3, 20),
    rollItem(123, "loot-test", 12, 3, 20),
  );
});
test("generated gear is valid across every slot, item level and rarity tier", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const item = rollItem(
      i - 50,
      `test-${i}`,
      1 + (i % 45),
      1 + (i % 4),
      30,
      i % 11 === 0 ? "unique" : "common",
      GEAR_SLOTS[i % 6],
    );
    assert.ok(validItem(item));
    assert.ok(
      new Set(item.affixes.map((a) => a.id)).size === item.affixes.length,
    );
    seen.add(item.rarity);
  }
  assert.equal(seen.size, 5);
});
for (const kind of CONTRACT_KINDS)
  test(`${kind}: playable objectives reach turn-in and pay exactly once`, () => {
    const sim = new Simulation();
    const job = accept(sim, kind, 333 + CONTRACT_KINDS.indexOf(kind));
    complete(sim, job);
    assert.ok(validSave(sim.state), `${kind} ready save is valid`);
    const xp = sim.state.campaign.progression.totalXP,
      gold = sim.state.inventory.dollars,
      items = sim.state.campaign.items.length;
    put(sim, HUBS[0]);
    assert.ok(sim.campaign.claim(job.id));
    assert.equal(sim.state.campaign.progression.totalXP, xp + job.reward.xp);
    assert.equal(sim.state.inventory.dollars, gold + job.reward.gold);
    assert.equal(sim.state.campaign.items.length, items + 1);
    assert.equal(sim.state.campaign.completed, 1);
    assert.ok(validSave(sim.state));
    const snapshot = structuredClone(sim.state);
    assert.equal(sim.campaign.claim(job.id), false);
    assert.deepEqual(sim.state, snapshot);
    if (kind === "quest")
      assert.ok(
        rarityOrder.indexOf(sim.state.campaign.items.at(-1)!.rarity) >= 3,
      );
  });
test("live bounty capture grants its bonus and does not count as a kill", () => {
  const sim = new Simulation(),
    job = accept(sim, "bounty");
  complete(sim, job, "protect", true);
  assert.equal(job.outcome, "captured");
  assert.equal(sim.state.kills, job.objectives[1].amount - 1);
  const cash = sim.state.inventory.dollars;
  put(sim, HUBS[0]);
  sim.campaign.claim(job.id);
  assert.equal(
    sim.state.inventory.dollars,
    cash + Math.round(job.reward.gold * 1.35),
  );
  assert.ok(sim.state.honor >= 8);
});
test("quest decisions change money, honor, renown and remaining regional threat", () => {
  const good = new Simulation(),
    shady = new Simulation(),
    a = accept(good, "quest", 905),
    b = accept(shady, "quest", 905);
  complete(good, a, "protect");
  complete(shady, b, "profit");
  put(good, HUBS[0]);
  put(shady, HUBS[0]);
  good.campaign.claim(a.id);
  shady.campaign.claim(b.id);
  assert.ok(shady.state.inventory.dollars > good.state.inventory.dollars);
  assert.ok(good.state.honor > shady.state.honor);
  assert.ok(
    good.state.campaign.reputation.settlers >
      shady.state.campaign.reputation.settlers,
  );
  const site = a.objectives[0].siteId;
  assert.ok(
    shady.state.campaign.sites[site].threat >
      good.state.campaign.sites[site].threat,
  );
});
test("hub proximity, active contract limits and challenge unlocks are enforced", () => {
  const sim = new Simulation(),
    c = sim.state.campaign;
  assert.equal(sim.campaign.accept("cinder", c.boards.cinder[0].id), false);
  put(sim, HUBS[0]);
  for (const offer of [...c.boards.cinder].slice(0, 3))
    assert.ok(sim.campaign.accept("cinder", offer.id));
  assert.equal(sim.campaign.accept("cinder", c.boards.cinder[0].id), false);
  assert.equal(sim.campaign.setDifficulty(2), false);
  grantXP(c, 1000);
  assert.ok(sim.campaign.setDifficulty(2));
  assert.ok(c.boards.cinder.every((o) => o.tier === 2));
  assert.ok(c.active.every((o) => o.tier === 1));
});
test("defense and escort targets take real hostile fire; destroyed objectives can be retried", () => {
  const sim = new Simulation(),
    job = accept(sim, "defense");
  put(sim, job.objectives[0]);
  sim.campaign.tick(0.1);
  sim.campaign.tick(0.1);
  sim.campaign.tick(0.1);
  const wagon = sim.state.campaign.objects.find((o) => o.owner === job.id)!;
  assert.ok(wagon);
  const enemy = sim.state.campaign.enemies.find((e) => e.owner === job.id)!;
  Object.assign(enemy, {
    x: wagon.x,
    z: wagon.z + 12,
    awareness: 1,
    cooldown: 0,
  });
  put(sim, { x: wagon.x + 30, z: wagon.z + 20 });
  const hp = wagon.health;
  for (let i = 0; i < 30; i++) sim.update(0.1, emptyControls(), 0);
  assert.ok(wagon.health < hp);
  wagon.health = 0;
  sim.campaign.tick(0.1);
  assert.equal(job.status, "failed");
  assert.equal(
    sim.state.campaign.enemies.filter((e) => e.owner === job.id).length,
    0,
  );
  put(sim, HUBS[0]);
  assert.ok(sim.campaign.retry(job.id));
  assert.equal(job.index, 0);
  assert.equal(job.status, "active");
});
test("XP grants levels, talent points and gated build choices", () => {
  const c = newCampaign();
  assert.equal(grantXP(c, 100), 1);
  assert.equal(c.progression.level, 2);
  assert.equal(c.progression.points, 1);
  assert.ok(learnTalent(c, "steady-hand"));
  assert.equal(c.progression.points, 0);
  assert.equal(derivedStats(c).crit, 4);
  assert.equal(learnTalent(c, "leadstorm"), false);
  grantXP(c, 1e6);
  assert.equal(c.progression.level, 30);
  assert.ok(c.progression.mastery > 0);
  assert.ok(c.progression.mastery <= 100);
});
test("equipment affixes change actual shot damage and armor reduces incoming hits", () => {
  const sim = new Simulation(),
    c = sim.state.campaign,
    gun = rollItem(32, "test-gun", 15, 3, 0, "legendary", "revolver");
  gun.aspect = null;
  gun.rune = null;
  sim.campaign.gear.receive(gun);
  sim.campaign.gear.equip(gun.id);
  const enemy = sim.state.enemies[0];
  enemy.health = 1000;
  put(sim, { x: enemy.x, z: enemy.z + 1 });
  sim.state.player.aiming = true;
  sim.shoot(Math.PI);
  assert.ok(1000 - enemy.health > 42);
  const coat = rollItem(99, "test-coat", 20, 3, 0, "legendary", "coat");
  coat.aspect = null;
  sim.campaign.gear.receive(coat);
  sim.campaign.gear.equip(coat.id);
  sim.state.player.health = sim.campaign.stats.health;
  const damage = sim.combat.damagePlayer(50);
  assert.ok(damage > 0 && damage < 50);
});
test("runes apply burning and chill; rain changes fire and storm interactions", () => {
  const dry = new Simulation(),
    wet = new Simulation();
  for (const sim of [dry, wet]) {
    const gun = sim.state.campaign.items[0];
    gun.rune = "ember";
    sim.state.enemies[0].health = 1000;
    sim.combat.strike(sim.state.enemies[0], 10, false);
  }
  wet.state.weather = "rain";
  const beforeDry = dry.state.enemies[0].health,
    beforeWet = wet.state.enemies[0].health;
  dry.combat.tick(1);
  wet.combat.tick(1);
  assert.ok(
    beforeDry - dry.state.enemies[0].health >
      beforeWet - wet.state.enemies[0].health,
  );
  dry.state.campaign.items[0].rune = "frost";
  dry.combat.strike(dry.state.enemies[0], 10, false);
  assert.ok(dry.state.campaign.effects[dry.state.enemies[0].id].chill > 0);
});
test("legendary ricochets, barriers and set bonuses affect combat and stats", () => {
  const sim = new Simulation(),
    c = sim.state.campaign;
  c.items[0].aspect = "ricochet";
  const a = sim.state.enemies[0],
    b = sim.state.enemies[1];
  Object.assign(a, { x: 0, z: 50, health: 100 });
  Object.assign(b, { x: 2, z: 50, health: 100 });
  sim.state.shots = 3;
  sim.combat.strike(a, 20, false);
  assert.ok(b.health < 100);
  c.items[0].aspect = "last-stand";
  sim.state.player.health = 25;
  sim.state.player.invulnerable = 0;
  sim.combat.damagePlayer(5);
  assert.ok(c.shield > 0);
  sim.state.player.invulnerable = 0;
  const hp = sim.state.player.health;
  sim.combat.damagePlayer(5);
  assert.equal(sim.state.player.health, hp);
  const coat = c.items.find((i) => i.slot === "coat")!,
    boots = c.items.find((i) => i.slot === "boots")!;
  coat.set = boots.set = "trailwarden";
  assert.equal(derivedStats(c).move, 8);
  c.items.find((i) => i.slot === "charm")!.set = "trailwarden";
  assert.equal(derivedStats(c).focus, 18);
});
test("telegraphed hazards damage the player and an evade avoids the impact", () => {
  const sim = new Simulation(),
    job = accept(sim, "bounty");
  put(sim, job.objectives[0]);
  sim.campaign.tick(0.1);
  sim.campaign.tick(0.1);
  const boss = sim.state.campaign.enemies.find((e) => e.boss)!;
  boss.modifiers = ["stormbound"];
  boss.ability = 0;
  sim.combat.enemyAbility(boss, 1, sim.state.player);
  assert.equal(sim.state.campaign.hazards.length, 1);
  assert.ok(sim.state.campaign.hazards[0].warning > 0);
  sim.campaign.tick(1.4);
  sim.state.player.dodge = 0.2;
  sim.combat.tick(0.1);
  assert.equal(sim.state.player.health, 100);
  sim.state.player.dodge = 0;
  sim.state.player.invulnerable = 0;
  boss.ability = 0;
  sim.combat.enemyAbility(boss, 1, sim.state.player);
  sim.campaign.tick(1.4);
  sim.combat.tick(0.1);
  assert.ok(sim.state.player.health < 100);
});
test("dodge consumes stamina, moves the rider and respects its cooldown", () => {
  const sim = new Simulation(),
    c = emptyControls();
  c.dodge = true;
  c.moveX = 1;
  const x = sim.state.player.x,
    z = sim.state.player.z;
  sim.update(0.05, c, 0);
  assert.ok(sim.state.player.stamina < 90);
  assert.ok(sim.state.player.dodge > 0);
  assert.ok(Math.hypot(sim.state.player.x - x, sim.state.player.z - z) > 0.4);
  const stamina = sim.state.player.stamina;
  sim.update(0.05, c, 0);
  assert.ok(sim.state.player.stamina >= stamina);
});
test("workshop transactions consume exact materials and protect equipped gear", () => {
  const sim = new Simulation(),
    c = sim.state.campaign;
  put(sim, HUBS[0]);
  const item = c.items[0],
    cost = upgradeCost(item),
    before = structuredClone(c);
  assert.equal(sim.campaign.gear.upgrade(item.id), false);
  assert.deepEqual(c, before);
  Object.assign(c.materials, {
    scrap: 100,
    silver: 100,
    essence: 20,
    runes: 5,
    herbs: 9,
  });
  const damage = derivedStats(c).damage;
  assert.ok(sim.campaign.gear.upgrade(item.id));
  assert.equal(c.materials.scrap, 100 - cost.scrap);
  assert.ok(derivedStats(c).damage > damage);
  assert.ok(sim.campaign.gear.socket(item.id, "ember"));
  assert.equal(c.materials.runes, 4);
  assert.equal(sim.campaign.gear.salvage(item.id), false);
  assert.ok(sim.campaign.gear.brew());
  assert.equal(sim.state.inventory.tonics, 5);
  const spare = rollItem(800, "spare", 8, 2, 0, "rare", "coat");
  c.items.push(spare);
  const prefix = structuredClone(spare.affixes.slice(0, -1));
  assert.ok(sim.campaign.gear.reforge(spare.id));
  assert.deepEqual(
    c.items.find((i) => i.id === spare.id)!.affixes.slice(0, -1),
    prefix,
  );
  assert.ok(sim.campaign.gear.salvage(spare.id));
  assert.ok(!c.items.some((i) => i.id === spare.id));
  assert.ok(validSave(sim.state));
});
test("pack/stash capacity and reward claiming remain atomic when storage is full", () => {
  const sim = new Simulation(),
    job = accept(sim, "salvage");
  complete(sim, job);
  put(sim, HUBS[0]);
  const c = sim.state.campaign;
  while (c.items.length < 40)
    c.items.push(rollItem(c.serial, `fill-${c.serial++}`, 1));
  while (c.stash.length < 80)
    c.stash.push(rollItem(c.serial, `fill-${c.serial++}`, 1));
  const gold = sim.state.inventory.dollars,
    xp = c.progression.totalXP;
  assert.equal(sim.campaign.claim(job.id), false);
  assert.equal(sim.state.inventory.dollars, gold);
  assert.equal(c.progression.totalXP, xp);
  assert.equal(job.status, "ready");
  assert.ok(sim.campaign.gear.salvage(c.items.at(-1)!.id));
  assert.ok(sim.campaign.claim(job.id));
});
test("regional pressure shapes field events and supply prices", () => {
  const sim = new Simulation();
  put(sim, LANDMARKS[0]);
  for (const s of Object.values(sim.state.campaign.sites)) {
    s.threat = 80;
    s.supply = 20;
  }
  const expensive = marketMultiplier(sim.state);
  assert.ok(sim.campaign.spawnFieldEvent());
  assert.equal(sim.state.campaign.events[0].kind, "raid");
  sim.state.campaign.events = [];
  for (const s of Object.values(sim.state.campaign.sites)) {
    s.threat = 10;
    s.supply = 20;
  }
  assert.ok(sim.campaign.spawnFieldEvent());
  assert.equal(sim.state.campaign.events[0].kind, "defense");
  for (const s of Object.values(sim.state.campaign.sites)) s.supply = 90;
  assert.ok(marketMultiplier(sim.state) < expensive);
});
test("campaign state, accepted objectives, inventory and talents roundtrip; older saves migrate", () => {
  const values = new Map<string, string>(),
    save = new SaveStore({
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => {
        values.set(k, v);
      },
      removeItem: (k) => {
        values.delete(k);
      },
    });
  const sim = new Simulation(),
    job = accept(sim, "recovery");
  put(sim, job.objectives[0]);
  sim.campaign.tick(0.1);
  sim.campaign.tick(0.1);
  assert.ok(save.write(sim.state));
  assert.deepEqual(save.load(), sim.state);
  const legacy = structuredClone(newGame()) as unknown as Record<string, any>;
  delete legacy.campaign;
  for (const k of ["dodge", "dodgeCooldown", "evadeX", "evadeZ"])
    delete legacy.player[k];
  values.set(SAVE_KEY, JSON.stringify(legacy));
  const loaded = save.load()!;
  assert.ok(loaded);
  assert.ok(validCampaign(loaded.campaign));
  assert.equal(loaded.player.health, legacy.player.health);
  assert.equal(loaded.stage, legacy.stage);
  const corrupt = structuredClone(sim.state);
  corrupt.campaign.active[0].index = 999;
  assert.equal(validSave(corrupt), false);
});
test("an extended campaign keeps world arrays bounded and rewards repeatable without duplicated IDs", () => {
  const sim = new Simulation();
  for (let i = 0; i < 110; i++) {
    put(sim, HUBS[0]);
    for (const item of [...sim.state.campaign.items])
      if (!Object.values(sim.state.campaign.equipped).includes(item.id))
        sim.campaign.gear.salvage(item.id);
    const job = accept(sim, i % 4 === 0 ? "bounty" : "salvage", 20000 + i * 99);
    complete(sim, job);
    put(sim, HUBS[0]);
    assert.ok(sim.campaign.claim(job.id));
    assert.ok(sim.state.campaign.drops.length <= MAX_WORLD_DROPS);
    assert.ok(sim.state.campaign.enemies.length <= 48);
    assert.ok(sim.state.campaign.events.length <= 2);
    assert.ok(validSave(sim.state));
  }
  assert.equal(sim.state.campaign.completed, 110);
  assert.equal(sim.state.campaign.history.length, 100);
  assert.equal(new Set(sim.state.campaign.history.map((h) => h.id)).size, 100);
});

test("attract loop performs a real hub contract, claims loot and upgrades it before restarting", () => {
  const sim = new Simulation(),
    director = new Director();
  let restarted = false;
  for (let i = 0; i < 60 * 320; i++) {
    const frame = director.update(1 / 60, sim);
    if (frame.restart) {
      restarted = true;
      break;
    }
    sim.update(1 / 60, frame.controls, frame.yaw);
    sim.drain();
  }
  assert.ok(restarted, "demo eventually restarts");
  assert.ok(
    sim.state.campaign.completed >= 1,
    JSON.stringify({
      stage: sim.state.stage,
      player: sim.state.player,
      active: sim.state.campaign.active.map((c) => ({
        kind: c.kind,
        index: c.index,
        status: c.status,
        objective: c.objectives[c.index],
      })),
    }),
  );
  assert.ok(
    sim.state.campaign.items.some(
      (i) => i.upgrade > 0 && sim.state.campaign.equipped[i.slot] === i.id,
    ),
  );
});

test("ground loot pickup is atomic and a full pack leaves equipment on the ground", () => {
  const sim = new Simulation(),
    item = rollItem(444, "ground-test", 4, 2, 0, "rare");
  put(sim, { x: 10, z: 80 });
  sim.campaign.drop(sim.state.player, item);
  const drop = sim.state.campaign.drops[0];
  assert.equal(sim.interactable()?.kind, `loot:${drop.id}`);
  sim.interact();
  assert.ok(sim.state.campaign.items.some((i) => i.id === item.id));
  assert.equal(sim.campaign.pickup(drop.id), false);
  while (sim.state.campaign.items.length < 40) {
    const id = `fill-${sim.state.campaign.serial++}`;
    sim.state.campaign.items.push(rollItem(sim.state.campaign.serial, id, 1));
  }
  sim.campaign.drop(sim.state.player, rollItem(88, "overflow-test", 2));
  const blocked = sim.state.campaign.drops.at(-1)!;
  assert.equal(sim.campaign.pickup(blocked.id), false);
  assert.ok(sim.state.campaign.drops.includes(blocked));
});
test("stash transfers and stock purchases preserve identity and validate capacity and payment", () => {
  const sim = new Simulation();
  put(sim, HUBS[0]);
  const c = sim.state.campaign,
    spare = rollItem(119, "stash-test", 5, 2, 0, "rare");
  c.items.push(spare);
  assert.ok(sim.campaign.gear.store(spare.id));
  assert.ok(c.stash.some((i) => i.id === spare.id));
  assert.ok(!c.items.some((i) => i.id === spare.id));
  assert.ok(sim.campaign.gear.withdraw(spare.id));
  assert.equal(sim.campaign.gear.store(c.equipped.revolver!), false);
  const stock = c.vendor.cinder[0];
  sim.state.inventory.dollars = 0;
  assert.equal(sim.campaign.gear.buy("cinder", stock.id), false);
  sim.state.inventory.dollars = 1000;
  assert.ok(sim.campaign.gear.buy("cinder", stock.id));
  assert.ok(c.items.some((i) => i.id === stock.id));
  assert.ok(!c.vendor.cinder.some((i) => i.id === stock.id));
  assert.ok(validSave(sim.state));
});
test("escort actors receive hostile fire and their death fails the job", () => {
  const sim = new Simulation(),
    job = accept(sim, "escort", 557);
  put(sim, job.objectives[0]);
  sim.campaign.tick(0.1);
  sim.campaign.tick(0.1);
  const o = job.objectives[job.index],
    escort = sim.state.campaign.objects.find((a) => a.owner === job.id)!;
  put(sim, escort);
  sim.campaign.interact(`objective:${escort.id}`);
  escort.pathIndex = Math.floor(escort.path.length / 2);
  sim.campaign.tick(0.1);
  const enemy = sim.state.campaign.enemies.find((e) => e.owner === job.id)!;
  assert.ok(enemy);
  Object.assign(enemy, {
    x: escort.x + 8,
    z: escort.z + 3,
    awareness: 1,
    cooldown: 0,
  });
  put(sim, { x: escort.x - 28, z: escort.z + 8 });
  const health = escort.health;
  for (let i = 0; i < 180 && escort.health === health; i++)
    sim.update(0.1, emptyControls(), 0);
  assert.ok(escort.health < health);
  escort.health = 0;
  sim.campaign.tick(0.1);
  assert.equal(job.status, "failed");
});
test("chill slows actual enemy movement and rain amplifies storm hazard damage", () => {
  const a = new Simulation(),
    b = new Simulation();
  for (const sim of [a, b]) {
    put(sim, { x: 30, z: 10 });
    Object.assign(sim.state.enemies[0], {
      x: 30,
      z: -21,
      awareness: 1,
      state: "attack",
    });
  }
  b.state.campaign.effects[b.state.enemies[0].id] = {
    bleed: 0,
    scorch: 0,
    chill: 3,
    bleedDamage: 0,
    scorchDamage: 0,
  };
  a.update(0.1, emptyControls(), 0);
  b.update(0.1, emptyControls(), 0);
  assert.ok(b.state.enemies[0].speed < a.state.enemies[0].speed);
  const dry = new Simulation(),
    rain = new Simulation();
  rain.state.weather = "rain";
  for (const sim of [dry, rain]) {
    sim.state.campaign.hazards.push({
      id: "hazard-test",
      owner: "contract-test",
      x: sim.state.player.x,
      z: sim.state.player.z,
      radius: 3,
      warning: 0,
      life: 2,
      damage: 10,
      element: "storm",
      hit: false,
    });
    sim.combat.tick(0.1);
  }
  assert.ok(rain.state.player.health < dry.state.player.health);
});
test("renown unlocks relic commissions and resource extraction increases regional pressure", () => {
  const c = newCampaign();
  c.reputation.settlers = 100;
  assert.equal(
    generateContract(c, "cinder", "quest", 123).reward.quality,
    "unique",
  );
  const sim = new Simulation(),
    job = accept(sim, "salvage"),
    site = sim.state.campaign.sites[job.objectives[0].siteId],
    threat = site.threat,
    supply = site.supply;
  complete(sim, job);
  put(sim, HUBS[0]);
  sim.campaign.claim(job.id);
  assert.ok(site.threat > threat);
  assert.ok(site.supply < supply);
});

test("all mission hubs are trackable atlas destinations and persist in existing saves", () => {
  const sim = new Simulation(),
    memory = new Map<string, string>(),
    store = new SaveStore({
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => {
        memory.set(k, v);
      },
      removeItem: (k) => {
        memory.delete(k);
      },
    });
  for (const hub of HUBS) {
    assert.ok(sim.navigateTo(`hub:${hub.id}`));
    store.write(sim.state);
    assert.equal(store.load()!.explorationTarget, `hub:${hub.id}`);
  }
});

test("mastery does not award unusable points and no-op crafting does not charge materials", () => {
  const sim = new Simulation();
  put(sim, HUBS[0]);
  grantXP(sim.state.campaign, 1e9);
  assert.equal(sim.state.campaign.progression.mastery, 100);
  assert.ok(sim.state.campaign.progression.points <= 39);
  Object.assign(sim.state.campaign.materials, { runes: 3, silver: 20 });
  const item = sim.state.campaign.items[0];
  assert.ok(sim.campaign.gear.socket(item.id, "ember"));
  const mats = structuredClone(sim.state.campaign.materials);
  assert.equal(sim.campaign.gear.socket(item.id, "ember"), false);
  assert.deepEqual(sim.state.campaign.materials, mats);
  const cash = sim.state.inventory.dollars;
  assert.equal(sim.campaign.gear.respec(), false);
  assert.equal(sim.state.inventory.dollars, cash);
});

test("named relics grant a distinct signature bonus beyond a legendary with the same power", () => {
  const c = newCampaign(),
    item = c.items[0];
  item.rarity = "legendary";
  item.aspect = "ricochet";
  const legendary = derivedStats(c).crit;
  item.rarity = "unique";
  assert.equal(derivedStats(c).crit, legendary + 8);
  item.aspect = "last-stand";
  assert.equal(derivedStats(c).health, 125);
});

test("Stormcaller cooldown, Blood Price bleeding/healing and Trailblazer mounted effects are functional", () => {
  const storm = new Simulation();
  storm.state.campaign.items[0].aspect = "stormcaller";
  const first = storm.state.enemies[0],
    second = storm.state.enemies[1];
  Object.assign(first, { x: 0, z: 50, health: 1000 });
  Object.assign(second, { x: 2, z: 50, health: 1000 });
  storm.combat.strike(first, 20, false);
  const after = second.health;
  assert.ok(after < 1000);
  storm.combat.strike(first, 20, false);
  assert.equal(second.health, after);
  storm.campaign.tick(4.1);
  storm.state.weather = "rain";
  storm.combat.strike(first, 20, false);
  assert.ok(after - second.health > 1000 - after);
  const blood = new Simulation();
  grantXP(blood.state.campaign, 1000);
  for (let i = 0; i < 3; i++) blood.campaign.gear.learn("steady-hand");
  blood.state.campaign.items[0].aspect = "blood-price";
  const victim = blood.state.enemies[0];
  victim.health = 1000;
  for (
    let i = 0;
    i < 30 && !blood.state.campaign.effects[victim.id]?.bleed;
    i++
  )
    blood.combat.strike(victim, 10, false);
  assert.ok(blood.state.campaign.effects[victim.id]?.bleed > 0);
  const hp = victim.health;
  blood.combat.tick(1);
  assert.ok(victim.health < hp);
  blood.state.player.health = 50;
  blood.combat.strike(victim, 10000, false);
  assert.equal(blood.state.player.health, 58);
  const mounted = new Simulation(),
    normal = new Simulation();
  mounted.state.campaign.items[0].aspect = "trailblazer";
  for (const sim of [mounted, normal]) {
    sim.state.player.mounted = true;
    sim.state.enemies[0].health = 1000;
  }
  mounted.combat.strike(mounted.state.enemies[0], 40, false);
  normal.combat.strike(normal.state.enemies[0], 40, false);
  assert.equal(
    1000 - mounted.state.enemies[0].health,
    (1000 - normal.state.enemies[0].health) * 1.25,
  );
  const controls = emptyControls();
  controls.moveZ = 1;
  controls.sprint = true;
  mounted.update(1, controls, 0);
  normal.update(1, controls, 0);
  assert.ok(mounted.state.horse.stamina > normal.state.horse.stamina);
});
