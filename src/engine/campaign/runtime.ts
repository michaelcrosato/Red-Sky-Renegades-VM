import type { GameEvent, GameState, Enemy } from "../types";
import {
  angleTo,
  clamp,
  distance,
  moveWithCollision,
  random,
  type Vec2,
} from "../math";
import { OBSTACLES, TRAIL } from "../../game/content";
import { LANDMARKS, landmarkById, FRONTIER_ROADS } from "../../game/territory";
import {
  CONTRACT_MODIFIERS,
  ENEMY_FAMILIES,
  HUBS,
  MAX_ACTIVE_CONTRACTS,
  MAX_CAMPAIGN_ENEMIES,
  MAX_WORLD_DROPS,
  PACK_CAPACITY,
  STASH_CAPACITY,
  CONSEQUENCES,
} from "../../game/campaign/catalog";
import type {
  CampaignEnemy,
  CampaignObject,
  Contract,
  GroundLoot,
  HubId,
  MaterialId,
  Objective,
  Rarity,
} from "./types";
import { generateContract, refreshOffers } from "./generator";
import { freePosition, roadRoute, steerAround } from "./navigation";
import { derivedStats, grantXP, unlockedTier } from "./progression";
import { rollItem, salvageYield } from "./loot";
import { GearService, nearbyHub } from "./gear";
import { campaignNavigation } from "./queries";

export class CampaignRuntime {
  readonly gear: GearService;
  constructor(
    readonly state: GameState,
    readonly emit: (event: GameEvent) => void,
  ) {
    this.gear = new GearService(state, emit);
  }
  get data() {
    return this.state.campaign;
  }
  get stats() {
    return derivedStats(this.data, this.state.player.weapon);
  }
  private note(title: string, text = "") {
    this.emit({ type: "toast", title, text });
  }
  private save() {
    this.emit({ type: "checkpoint" });
  }
  private id(prefix: string) {
    return `${prefix}-${this.data.serial++}`;
  }
  contracts() {
    return [...this.data.active, ...this.data.events];
  }
  contract(id: string) {
    return this.contracts().find((c) => c.id === id);
  }
  allEnemies(): Enemy[] {
    return [...this.state.enemies, ...this.data.enemies];
  }
  awardXP(amount: number) {
    if (this.state.mode === "range") return;
    const gained = grantXP(this.data, amount);
    if (gained) {
      this.state.player.health = this.stats.health;
      this.emit({ type: "level-up", level: this.data.progression.level });
      this.save();
    }
  }
  accept(hubId: HubId, id: string) {
    if (this.state.mode !== "story") {
      this.note("Contracts are available in story mode");
      return false;
    }
    const h = nearbyHub(this.state),
      c = this.data.boards[hubId]?.find((c) => c.id === id);
    if (!h || h.id !== hubId || !c) return false;
    if (this.data.active.length >= MAX_ACTIVE_CONTRACTS) {
      this.note(
        "Three contracts at a time",
        "Finish, claim or abandon a current contract first.",
      );
      return false;
    }
    this.data.boards[hubId] = this.data.boards[hubId].filter(
      (c) => c.id !== id,
    );
    c.status = "active";
    this.data.active.push(c);
    this.data.tracked = c.id;
    this.data.engaged = true;
    this.state.explorationTarget = null;
    this.note("Contract accepted", c.title);
    this.save();
    return true;
  }
  track(id: string | null) {
    if (
      id !== null &&
      !this.data.active.some((c) => c.id === id) &&
      !this.data.events.some((c) => c.id === id)
    )
      return false;
    this.data.tracked = id;
    if (id) this.state.explorationTarget = null;
    this.save();
    return true;
  }
  refresh(hubId: HubId) {
    const h = nearbyHub(this.state);
    if (!h || h.id !== hubId) return false;
    if (this.state.inventory.dollars < 5) {
      this.note("New notices cost $5");
      return false;
    }
    this.state.inventory.dollars -= 5;
    refreshOffers(this.data, hubId);
    this.data.vendor[hubId] = [0, 1, 2].map((i) =>
      rollItem(
        this.data.seed + ++this.data.roll * 173 + i,
        this.id("stock"),
        this.data.progression.level + 1,
        this.data.difficulty,
        0,
        "magic",
      ),
    );
    this.note(
      "Fresh notices and stock",
      "Regional conditions shape the new offers.",
    );
    this.save();
    return true;
  }
  setDifficulty(tier: number) {
    if (!nearbyHub(this.state) || tier < 1 || tier > unlockedTier(this.data)) {
      this.note(
        "Challenge tier locked",
        "Tiers unlock at levels 1, 5, 10 and 15.",
      );
      return false;
    }
    this.data.difficulty = tier;
    for (const h of HUBS) refreshOffers(this.data, h.id);
    this.note(
      `Challenge tier ${tier}`,
      "New contracts have stronger enemies and richer rewards.",
    );
    this.save();
    return true;
  }
  abandon(id: string) {
    const c = this.data.active.find((c) => c.id === id);
    if (!c) return false;
    this.clearActors(c.id);
    this.data.active = this.data.active.filter((c) => c.id !== id);
    if (this.data.tracked === id) this.data.tracked = null;
    this.note("Contract abandoned", c.title);
    this.save();
    return true;
  }
  retry(id: string) {
    const c = this.data.active.find((c) => c.id === id),
      hub = nearbyHub(this.state);
    if (!c || c.status !== "failed" || !hub || hub.id !== c.hubId) return false;
    this.clearActors(c.id);
    for (const o of c.objectives) {
      o.progress = o.elapsed = o.wave = 0;
      o.started = o.spawned = false;
    }
    c.index = 0;
    c.status = "active";
    c.failure = "";
    c.outcome = "none";
    this.data.tracked = c.id;
    this.note("Another chance", c.title);
    this.save();
    return true;
  }
  claim(id: string) {
    const c = this.data.active.find((c) => c.id === id),
      hub = nearbyHub(this.state);
    if (!c || c.status !== "ready" || !hub || hub.id !== c.hubId) return false;
    if (
      this.data.items.length >= PACK_CAPACITY &&
      this.data.stash.length >= STASH_CAPACITY
    ) {
      this.note("Make room for your reward");
      return false;
    }
    this.reward(c);
    this.data.active = this.data.active.filter((q) => q.id !== id);
    if (this.data.tracked === id)
      this.data.tracked = this.data.active[0]?.id ?? null;
    if (!this.data.boards[hub.id].length) refreshOffers(this.data, hub.id);
    this.save();
    return true;
  }
  private reward(c: Contract) {
    if (this.data.history.some((h) => h.id === c.id)) return;
    const multiplier =
      c.outcome === "captured" ? 1.35 : c.outcome === "profit" ? 1.25 : 1;
    this.state.inventory.dollars += Math.round(c.reward.gold * multiplier);
    this.awardXP(c.reward.xp);
    this.data.reputation[c.faction] +=
      c.reward.reputation + (c.outcome === "protect" ? 8 : 0);
    if (c.outcome === "protect") this.state.honor += 8;
    if (c.outcome === "captured") {
      this.state.honor += 8;
      this.data.reputation.wardens += 4;
    }
    if (c.outcome === "profit") {
      this.state.honor -= 5;
      this.data.reputation.wardens = Math.max(
        0,
        this.data.reputation.wardens - 5,
      );
    }
    this.data.materials.scrap += c.reward.material;
    this.data.materials.silver += c.tier;
    if (c.tier >= 2 || c.kind === "quest")
      this.data.materials.essence += c.tier;
    if (c.kind === "quest" || c.kind === "salvage") this.data.materials.runes++;
    const item = rollItem(
      c.seed + 7919,
      this.id("reward"),
      c.level + c.tier,
      c.tier,
      this.stats.luck,
      c.reward.quality,
    );
    if (c.origin === "event")
      this.drop(
        { x: this.state.player.x + 2, z: this.state.player.z + 1 },
        item,
      );
    else this.gear.receive(item, true);
    for (const siteId of new Set(c.objectives.map((o) => o.siteId))) {
      const site = this.data.sites[siteId];
      if (!site) continue;
      site.threat = clamp(
        site.threat +
          CONSEQUENCES[c.kind].threat +
          (c.outcome === "profit" ? 15 : 0),
        0,
        100,
      );
      site.supply = clamp(
        site.supply +
          (c.kind === "supply" && siteId !== c.objectives.at(-1)!.siteId
            ? -4
            : CONSEQUENCES[c.kind].supply),
        0,
        100,
      );
      site.clears++;
    }
    this.data.completed++;
    if (c.kind === "quest") this.data.questsCompleted++;
    this.data.history.push({
      id: c.id,
      title: c.title,
      kind: c.kind,
      tier: c.tier,
    });
    if (this.data.history.length > 100) this.data.history.shift();
    this.clearActors(c.id);
    this.note(
      "Contract fulfilled",
      `+${c.reward.xp} XP · +$${Math.round(c.reward.gold * multiplier)} · ${item.name}`,
    );
    this.emit({ type: "sound", name: "complete" });
  }
  private clearActors(owner: string, stage?: number) {
    const match = (o: { owner: string; stage: number }) =>
      o.owner === owner && (stage === undefined || o.stage === stage);
    for (const e of this.data.enemies)
      if (match(e)) delete this.data.effects[e.id];
    this.data.enemies = this.data.enemies.filter((e) => !match(e));
    this.data.objects = this.data.objects.filter((o) => !match(o));
    this.data.hazards = this.data.hazards.filter((h) => h.owner !== owner);
  }
  private advance(c: Contract) {
    this.clearActors(c.id, c.index);
    c.index++;
    if (c.index >= c.objectives.length) {
      c.status = "ready";
      if (c.origin === "event") {
        this.reward(c);
        this.data.events = this.data.events.filter((e) => e.id !== c.id);
        if (this.data.tracked === c.id) this.data.tracked = null;
      } else
        this.note(
          "Job done. Collect your reward.",
          HUBS.find((h) => h.id === c.hubId)!.name,
        );
    } else this.note(c.title, c.objectives[c.index].label);
    this.save();
  }
  private fail(c: Contract, reason: string) {
    if (c.origin === "event") {
      this.data.events = this.data.events.filter((e) => e.id !== c.id);
      if (this.data.tracked === c.id) this.data.tracked = null;
    }
    c.status = "failed";
    c.failure = reason;
    this.clearActors(c.id);
    const site =
      this.data.sites[
        c.objectives[Math.min(c.index, c.objectives.length - 1)].siteId
      ];
    if (site) {
      site.threat = clamp(site.threat + 8, 0, 100);
      site.supply = clamp(site.supply - 8, 0, 100);
    }
    this.note("Contract failed", `${reason} · Return to the issuer to retry.`);
    this.save();
  }
  private spawnEnemies(
    c: Contract,
    o: Objective,
    count: number,
    boss = false,
    center: Vec2 = o,
  ) {
    if (this.data.enemies.length + count > MAX_CAMPAIGN_ENEMIES) {
      const alive = this.data.enemies.filter(
          (e) => e.health > 0 && !e.captured,
        ),
        bodies = this.data.enemies.filter((e) => e.health <= 0 || e.captured);
      this.data.enemies = [
        ...alive,
        ...bodies.slice(
          0,
          Math.max(0, MAX_CAMPAIGN_ENEMIES - alive.length - count),
        ),
      ];
    }
    let made = 0;
    const family = ENEMY_FAMILIES[c.family as keyof typeof ENEMY_FAMILIES],
      rng = random(c.seed + c.index * 103 + o.wave * 151),
      base = this.data.enemies.filter(
        (e) => e.owner === c.id && e.stage === c.index,
      ).length;
    const modifierIds = c.modifiers
      .map(
        (id) => CONTRACT_MODIFIERS[id as keyof typeof CONTRACT_MODIFIERS].enemy,
      )
      .filter((v): v is NonNullable<typeof v> => !!v);
    for (
      let i = 0;
      i < count && this.data.enemies.length < MAX_CAMPAIGN_ENEMIES;
      i++
    ) {
      const elite = (boss && i === count - 1) || (o.elite && i === 0),
        leader = boss && i === count - 1,
        angle = rng() * Math.PI * 2,
        pos = freePosition({
          x: center.x + Math.sin(angle) * (12 + i * 2),
          z: center.z + Math.cos(angle) * (12 + i * 2),
        });
      const hp = Math.round(
        (80 + c.level * 9 + c.tier * 4) * (leader ? 2.4 : elite ? 1.6 : 1),
      );
      this.data.enemies.push({
        ...pos,
        id: this.id(`${c.id}:${c.index}:enemy`),
        owner: c.id,
        stage: c.index,
        name: leader ? c.targetName : family.name,
        home: { ...pos },
        yaw: angle,
        health: hp,
        maxHealth: hp,
        animation: i,
        speed: 0,
        state: "patrol",
        cooldown: 1.5 + rng(),
        awareness: 0.65,
        loot: false,
        level: c.level,
        elite,
        boss: leader,
        family: c.family,
        modifiers: [
          ...new Set([...modifierIds, ...(elite ? [family.modifier] : [])]),
        ],
        damage: Math.round(
          (5 + c.level * 0.45 + c.tier) * family.damage * (leader ? 1.15 : 1),
        ),
        armor:
          modifierIds.includes("armored") ||
          (elite && family.modifier === "armored")
            ? 25 + c.level
            : 0,
        rewarded: false,
        captured: false,
        dropSeed: c.seed + c.index * 971 + (base + i) * 173 + o.wave * 719,
        bleed: 0,
        scorch: 0,
        chill: 0,
        stagger: 0,
        ability: elite ? 3 + rng() * 3 : 999,
      });
      made++;
    }
    return made;
  }
  private object(c: Contract, o: Objective, index = 0): CampaignObject {
    const pos = freePosition({
      x: o.x + (o.amount > 1 ? Math.sin(index * 2.3) * 7 : 0),
      z: o.z + (o.amount > 1 ? Math.cos(index * 2.3) * 7 : 0),
    });
    const health =
      o.kind === "defend"
        ? 160 + c.level * 10
        : o.kind === "escort"
          ? 120 + c.level * 8
          : 1;
    const object: CampaignObject = {
      ...pos,
      id: `${c.id}:${c.index}:object:${index}`,
      owner: c.id,
      stage: c.index,
      kind: o.prop,
      label: o.kind === "escort" ? "Stranded prospector" : o.label,
      health,
      maxHealth: health,
      used: false,
      path:
        o.kind === "escort" && o.destination
          ? roadRoute(pos, o.destination)
          : [],
      pathIndex: 0,
      yaw: 0,
      animation: 0,
    };
    this.data.objects.push(object);
    return object;
  }
  private spawnObjective(c: Contract, o: Objective) {
    o.spawned = true;
    if (o.kind === "eliminate")
      o.wave = this.spawnEnemies(c, o, o.amount, o.boss);
    if (o.kind === "interact" || o.kind === "choice")
      for (let i = 0; i < o.amount; i++) this.object(c, o, i);
    if (o.kind === "escort" || o.kind === "defend") this.object(c, o);
  }
  interaction(): {
    label: string;
    hint: string;
    kind: string;
    position: Vec2;
  } | null {
    const p = this.state.player;
    const item = this.data.drops
      .filter((d) => distance(p, d) < 3.2)
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (item)
      return {
        label: item.item
          ? `Pick up ${item.item.name}`
          : item.material
            ? `Gather ${item.quantity} ${item.material}`
            : `Collect $${item.gold}`,
        hint: item.item
          ? `${item.item.rarity.toUpperCase()} · Level ${item.item.level}`
          : "Frontier spoils",
        kind: `loot:${item.id}`,
        position: item,
      };
    const target = this.data.enemies.find(
      (e) =>
        e.boss &&
        !e.captured &&
        e.health > 0 &&
        e.health <= e.maxHealth * 0.3 &&
        distance(p, e) < 4.5,
    );
    if (target)
      return {
        label: "Capture the outlaw alive",
        hint: target.name,
        kind: `capture:${target.id}`,
        position: target,
      };
    for (const obj of this.data.objects) {
      const c = this.contract(obj.owner),
        o = c?.objectives[c.index];
      if (
        !c ||
        c.status !== "active" ||
        obj.used ||
        distance(p, obj) > 4.2 ||
        !o
      )
        continue;
      if (
        o.kind === "defend" ||
        o.kind === "eliminate" ||
        (o.kind === "escort" && o.started)
      )
        continue;
      return {
        label:
          o.kind === "escort" ? "Lead the prospector to safety" : obj.label,
        hint: c.title,
        kind: `objective:${obj.id}`,
        position: obj,
      };
    }
    const hub = HUBS.find((h) => distance(h, p) < 3.8);
    if (hub)
      return {
        label: "Open the dispatch board",
        hint: hub.name,
        kind: `hub:${hub.id}`,
        position: hub,
      };
    return null;
  }
  interact(kind: string) {
    if (kind.startsWith("hub:")) {
      const hub = HUBS.find((h) => h.id === kind.slice(4));
      if (!hub || distance(hub, this.state.player) > 4) return false;
      this.emit({ type: "hub", hub: hub.id });
      return true;
    }
    if (kind.startsWith("loot:")) return this.pickup(kind.slice(5));
    if (kind.startsWith("capture:")) {
      const e = this.data.enemies.find((e) => e.id === kind.slice(8));
      if (
        !e ||
        e.captured ||
        e.health <= 0 ||
        e.health > e.maxHealth * 0.3 ||
        distance(e, this.state.player) > 4.5
      )
        return false;
      e.captured = true;
      e.speed = 0;
      const c = this.contract(e.owner);
      if (c) c.outcome = "captured";
      this.defeated(e);
      this.note("Outlaw captured", "Alive bonus secured.");
      return true;
    }
    const obj = this.data.objects.find((o) => o.id === kind.slice(10));
    if (
      !kind.startsWith("objective:") ||
      !obj ||
      obj.used ||
      distance(obj, this.state.player) > 4.2
    )
      return false;
    const c = this.contract(obj.owner);
    if (!c || c.status !== "active" || c.index !== obj.stage) return false;
    const o = c.objectives[c.index];
    if (o.kind === "choice") {
      this.emit({ type: "campaign-choice", contract: c.id });
      return true;
    }
    if (o.kind === "escort") {
      o.started = true;
      this.note(
        "Stay close to the prospector",
        "Keep within 35 metres. Watch for an ambush.",
      );
      this.save();
      return true;
    }
    obj.used = true;
    o.progress++;
    this.awardXP(8);
    if (obj.kind === "ore") {
      this.data.materials.scrap += 2;
      this.data.materials.silver++;
      if ((c.seed + o.progress) % 3 === 0) this.data.materials.essence++;
    }
    if (obj.kind === "sage") this.data.materials.herbs += 2;
    this.emit({ type: "sound", name: "pickup" });
    if (o.progress >= o.amount) this.advance(c);
    else this.note(o.label, `${o.progress} / ${o.amount}`);
    this.save();
    return true;
  }
  choose(id: string, choice: "protect" | "profit") {
    const c = this.contract(id);
    if (
      !c ||
      c.status !== "active" ||
      c.objectives[c.index]?.kind !== "choice" ||
      distance(c.objectives[c.index], this.state.player) > 8
    )
      return false;
    c.outcome = choice;
    this.advance(c);
    return true;
  }
  drop(
    position: Vec2,
    item: GroundLoot["item"] = null,
    material: MaterialId | null = null,
    quantity = 0,
    gold = 0,
  ) {
    if (this.data.drops.length >= MAX_WORLD_DROPS) {
      const old = this.data.drops.shift()!;
      if (old.item) {
        if (!this.gear.receive(old.item, true)) {
          const yield_ = salvageYield(old.item);
          for (const [k, v] of Object.entries(yield_))
            this.data.materials[k as MaterialId] += v;
        }
      } else if (old.material)
        this.data.materials[old.material] += old.quantity;
      else this.state.inventory.dollars += old.gold;
    }
    this.data.drops.push({
      ...position,
      id: this.id("drop"),
      item,
      material,
      quantity,
      gold,
      expires: this.data.clock + 300,
    });
  }
  pickup(id: string) {
    const drop = this.data.drops.find((d) => d.id === id);
    if (!drop || distance(drop, this.state.player) > 3.5) return false;
    if (drop.item && !this.gear.receive(drop.item)) return false;
    if (drop.material) this.data.materials[drop.material] += drop.quantity;
    this.state.inventory.dollars += drop.gold;
    this.data.drops = this.data.drops.filter((d) => d.id !== id);
    this.emit({ type: "sound", name: "pickup" });
    if (drop.item)
      this.emit({
        type: "loot",
        name: drop.item.name,
        rarity: drop.item.rarity,
      });
    else
      this.note(
        "Supplies collected",
        drop.material ? `+${drop.quantity} ${drop.material}` : `+$${drop.gold}`,
      );
    this.save();
    return true;
  }
  defeated(enemy: Enemy) {
    const e = enemy as CampaignEnemy;
    if ("owner" in enemy) {
      if (e.rewarded) return;
      e.rewarded = true;
      this.awardXP((12 + e.level * 4) * (e.boss ? 4 : e.elite ? 2 : 1));
      const c = this.contract(e.owner);
      if (c && c.status === "active" && c.index === e.stage) {
        const o = c.objectives[c.index];
        if (o.kind === "eliminate") {
          o.progress++;
          if (o.progress >= o.amount) this.advance(c);
        }
      }
      const rng = random(e.dropSeed),
        rarity: Rarity = e.boss ? "rare" : e.elite ? "magic" : "common";
      if (e.boss || e.elite || rng() < 0.55)
        this.drop(
          e,
          rollItem(
            e.dropSeed,
            this.id("item"),
            e.level + (e.boss ? 2 : 0),
            c?.tier ?? 1,
            this.stats.luck,
            rarity,
          ),
        );
      this.drop(
        { x: e.x + 1.1, z: e.z },
        null,
        "scrap",
        1 + Math.floor(e.level / 5),
      );
      if (e.elite) this.drop({ x: e.x - 1, z: e.z }, null, "essence", 1);
      if (e.boss) this.drop({ x: e.x, z: e.z + 1 }, null, "runes", 1);
      this.drop({ x: e.x, z: e.z - 1 }, null, null, 0, 2 + e.level);
    } else {
      this.awardXP(20);
      if (this.data.engaged)
        this.drop(
          enemy,
          rollItem(
            this.data.seed + this.state.kills * 311,
            this.id("item"),
            this.data.progression.level,
            1,
            this.stats.luck,
          ),
        );
    }
    delete this.data.effects[enemy.id];
    if (this.stats.aspects.includes("blood-price"))
      this.state.player.health = Math.min(
        this.stats.health,
        this.state.player.health + 8,
      );
  }
  navigation() {
    return campaignNavigation(this.state);
  }
  tick(dt: number) {
    const c = this.data;
    if (this.state.mode === "range") return;
    c.clock += dt;
    c.shieldCooldown = Math.max(0, c.shieldCooldown - dt);
    c.procCooldown = Math.max(0, c.procCooldown - dt);
    c.shield = Math.max(0, c.shield - dt * 0.4);
    for (const contract of this.contracts()) {
      if (contract.status !== "active") continue;
      const o = contract.objectives[contract.index];
      if (!o) continue;
      if (contract.origin === "event" && c.clock > contract.expires) {
        this.clearActors(contract.id);
        c.events = c.events.filter((e) => e.id !== contract.id);
        if (c.tracked === contract.id) c.tracked = null;
        const site = c.sites[o.siteId];
        if (site) {
          site.threat = clamp(site.threat + 5, 0, 100);
          site.supply = clamp(site.supply - 5, 0, 100);
        }
        continue;
      }
      if (o.kind === "reach") {
        if (distance(this.state.player, o) < 20) this.advance(contract);
        continue;
      }
      if (!o.spawned && distance(this.state.player, o) < 60)
        this.spawnObjective(contract, o);
      if (!o.spawned) continue;
      if (
        o.kind === "eliminate" &&
        o.wave < o.amount &&
        distance(this.state.player, o) < 85
      )
        o.wave += this.spawnEnemies(contract, o, o.amount - o.wave, o.boss);
      const object = c.objects.find(
        (v) => v.owner === contract.id && v.stage === contract.index && !v.used,
      );
      if (o.kind === "defend") {
        if (!object || object.health <= 0) {
          this.fail(contract, "The supply wagon was destroyed");
          continue;
        }
        if (distance(this.state.player, o) < 70) o.elapsed += dt;
        if (o.wave < 3 && o.elapsed >= (o.wave * o.duration) / 3) {
          o.wave++;
          this.spawnEnemies(
            contract,
            o,
            o.wave === 3 ? 2 : o.encounter,
            o.wave === 3 && contract.tier >= 2,
          );
        }
        if (
          o.elapsed >= o.duration &&
          !c.enemies.some(
            (e) => e.owner === contract.id && e.health > 0 && !e.captured,
          )
        )
          this.advance(contract);
      }
      if (o.kind === "escort" && object) {
        if (object.health <= 0) {
          this.fail(contract, "The prospector did not survive");
          continue;
        }
        if (o.started && distance(this.state.player, object) < 35) {
          const point = object.path[object.pathIndex];
          if (point) {
            const target = steerAround(object, point),
              a = angleTo(object, target);
            object.yaw = a;
            Object.assign(
              object,
              moveWithCollision(
                object,
                Math.sin(a) * 5.6 * dt,
                Math.cos(a) * 5.6 * dt,
                OBSTACLES,
                0.5,
              ),
            );
            object.animation += dt * 7;
            if (distance(object, point) < 2.5) object.pathIndex++;
          }
          if (
            !o.wave &&
            object.pathIndex >= Math.floor(object.path.length / 2)
          ) {
            o.wave = 1;
            this.spawnEnemies(contract, o, o.encounter, false, object);
            this.note("Ambush on the trail", "Keep the prospector alive.");
          }
          if (
            object.pathIndex >= object.path.length &&
            o.destination &&
            distance(object, o.destination) < 6
          )
            this.advance(contract);
        }
      }
    }
    if (c.engaged && c.clock >= c.nextPressure) {
      c.nextPressure = c.clock + 60;
      for (const site of Object.values(c.sites)) {
        site.threat = clamp(site.threat + 2, 0, 100);
        site.supply = clamp(site.supply - 1, 0, 100);
      }
    }
    if (c.engaged && c.clock >= c.nextEvent) {
      c.nextEvent = c.clock + 85;
      this.spawnFieldEvent();
    }
    c.hazards = c.hazards.filter((h) => h.life > 0);
    for (const h of c.hazards) {
      const waiting = Math.max(0, h.warning);
      h.warning -= dt;
      if (h.warning <= 0) h.life -= Math.max(0, dt - waiting);
    }
    // Distant expired loot is mailed or salvaged, so an endless campaign remains bounded.
    for (const d of [...c.drops])
      if (c.clock > d.expires && distance(d, this.state.player) > 90) {
        if (d.item) {
          if (c.stash.length < STASH_CAPACITY) c.stash.push(d.item);
          else {
            const yield_ = salvageYield(d.item);
            for (const [k, n] of Object.entries(yield_))
              c.materials[k as MaterialId] += n;
          }
        } else if (d.material) c.materials[d.material] += d.quantity;
        else this.state.inventory.dollars += d.gold;
        c.drops = c.drops.filter((v) => v.id !== d.id);
      }
  }
  spawnFieldEvent() {
    if (this.data.events.length >= 2) return false;
    const sites = LANDMARKS.filter(
      (l) =>
        distance(l, this.state.player) < 230 &&
        !this.contracts().some(
          (c) =>
            c.status === "active" &&
            c.objectives.some((o) => o.siteId === l.id),
        ),
    );
    if (!sites.length) return false;
    const rng = random(this.data.seed + ++this.data.roll * 919),
      site = sites[Math.floor(rng() * sites.length)],
      pressure = this.data.sites[site.id],
      hub = [...HUBS].sort((a, b) => distance(a, site) - distance(b, site))[0];
    const kind =
      pressure.threat >= 55
        ? "raid"
        : pressure.supply < 40
          ? "defense"
          : rng() < 0.5
            ? "salvage"
            : "recovery";
    const event = generateContract(
      this.data,
      hub.id,
      kind,
      this.data.seed + this.data.roll * 8191,
      this.data.difficulty,
      "event",
      site.id,
    );
    const roadside: Vec2[] = [];
    for (const road of [TRAIL, ...FRONTIER_ROADS])
      for (let i = 1; i < road.length; i++)
        for (const t of [0.25, 0.5, 0.75]) {
          const point = {
            x: road[i - 1].x + (road[i].x - road[i - 1].x) * t,
            z: road[i - 1].z + (road[i].z - road[i - 1].z) * t,
          };
          const d = distance(point, this.state.player);
          if (
            d > 40 &&
            d < 145 &&
            distance(point, site) < 115 &&
            HUBS.every((h) => distance(point, h) > 35) &&
            this.data.active.every(
              (c) =>
                c.status !== "active" ||
                distance(point, c.objectives[c.index]) > 45,
            )
          )
            roadside.push(point);
        }
    if (roadside.length) {
      const place = freePosition(roadside[Math.floor(rng() * roadside.length)]);
      for (const objective of event.objectives)
        if (objective.siteId === site.id) {
          objective.x = place.x;
          objective.z = place.z;
        }
    }
    if (
      this.state.weather === "rain" &&
      kind !== "salvage" &&
      !event.modifiers.includes("storm") &&
      event.modifiers.length < 3
    ) {
      event.modifiers.push("storm");
      event.reward.xp = Math.round(event.reward.xp * 1.2);
      event.reward.gold = Math.round(event.reward.gold * 1.2);
      for (const o of event.objectives) if (o.encounter) o.elite = true;
    }
    this.data.events.push(event);
    this.note(
      "News from the trail",
      `${event.title} · See nearby events in your contract journal.`,
    );
    this.save();
    return true;
  }
}
