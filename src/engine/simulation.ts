import {
  ADA,
  BOSS,
  CAMP,
  CRATE,
  ENEMY_SPAWNS,
  FIRE,
  GRAVE,
  MERCHANT,
  OBSTACLES,
  STAGES,
  WAGON,
  WEAPONS,
  WILD_HERB,
  type StageId,
} from "../game/content";
import {
  angleDelta,
  angleTo,
  clamp,
  distance,
  groundHeight,
  crossingAt,
  lineBlocked,
  moveWithCollision,
  riverX,
  type Vec2,
} from "./math";
import { type Controls, type GameEvent, type GameState } from "./types";
import { lastGoodDeed } from "../game/mission";
import type { MissionGraph } from "./mission";
import { LANDMARKS, landmarkById } from "../game/territory";
import { newCampaign } from "./campaign/state";
import { CampaignRuntime } from "./campaign/runtime";
import { CampaignCombat } from "./campaign/combat";
import { supplyPrice } from "./campaign/gear";
import { ENEMY_FAMILIES } from "../game/campaign/catalog";
import { steerAround } from "./campaign/navigation";
import type { CampaignEnemy } from "./campaign/types";
import { destinationById } from "../game/destinations";

export function newGame(
  mode: "story" | "range" = "story",
  seed = 7311893,
): GameState {
  return {
    version: 1,
    mode,
    stage: mode === "range" ? "complete" : "meet",
    player: {
      id: "rider",
      x: mode === "range" ? 79 : -54,
      z: mode === "range" ? 51 : 48,
      yaw: 2.4,
      health: 100,
      stamina: 100,
      focus: 100,
      focusing: false,
      mounted: false,
      aiming: false,
      weapon: "revolver",
      ammo: { revolver: 6, rifle: 8 },
      reserve: { revolver: 48, rifle: 32 },
      reload: 0,
      shot: 0,
      invulnerable: 0,
      dodge: 0,
      dodgeCooldown: 0,
      evadeX: 0,
      evadeZ: 0,
      animation: 0,
      speed: 0,
    },
    horse: {
      id: "juniper",
      x: mode === "range" ? 74 : -51,
      z: mode === "range" ? 50 : 44,
      yaw: 2.1,
      health: 100,
      stamina: 100,
      following: false,
      bond: 0,
      animation: 0,
      speed: 0,
    },
    enemies:
      mode === "range"
        ? []
        : ENEMY_SPAWNS.map((p, i) => ({
            ...p,
            id: `outlaw-${i}`,
            home: { ...p },
            yaw: 2 + i,
            health: 100,
            animation: i,
            speed: 0,
            state: "patrol",
            cooldown: 1.8 + i * 0.3,
            awareness: 0,
            loot: false,
          })),
    inventory: {
      tonics: 3,
      herbs: 0,
      medicine: false,
      dollars: 24,
      relic: false,
    },
    honor: 0,
    bounty: 0,
    heat: 0,
    time: 16.6,
    elapsed: 0,
    weather: "clear",
    weatherTime: 0,
    herbs: [false, false, false],
    choice: null,
    shots: 0,
    hits: 0,
    kills: 0,
    deaths: 0,
    completedAt: null,
    discovered: [],
    explorationTarget: null,
    campaign: newCampaign(seed),
    targets: Array.from({ length: 5 }, (_, i) => ({
      x: 70 + i * 5,
      z: 30 - (i % 2) * 5,
      health: 100,
    })),
  };
}

export interface Interaction {
  label: string;
  hint: string;
  kind: string;
  position: Vec2;
}

export class Simulation {
  state: GameState;
  events: GameEvent[] = [];
  pendingDialogue: { speaker: string; text: string; next?: StageId } | null =
    null;
  pendingChoice = false;
  private stepSound = 0;
  private lastCrime = -10;
  private shotId = 0;
  readonly campaign: CampaignRuntime;
  readonly combat: CampaignCombat;
  constructor(
    state = newGame(),
    readonly mission: MissionGraph<StageId> = lastGoodDeed,
  ) {
    this.state = structuredClone(state);
    this.campaign = new CampaignRuntime(this.state, (e) => this.emit(e));
    this.combat = new CampaignCombat(this.state, this.campaign, (e) =>
      this.emit(e),
    );
  }
  allEnemies() {
    return this.campaign.allEnemies();
  }
  emit(e: GameEvent) {
    this.events.push(e);
  }
  drain() {
    const e = this.events;
    this.events = [];
    return e;
  }
  checkpoint() {
    this.emit({ type: "checkpoint" });
  }
  setStage(stage: StageId) {
    this.state.stage = stage;
    this.emit({ type: "stage", stage });
    this.checkpoint();
  }
  signal(event: string) {
    const next = this.mission.transition(this.state.stage, event);
    if (next) this.setStage(next);
    return next;
  }
  say(speaker: string, text: string, next?: StageId) {
    this.pendingDialogue = { speaker, text, next };
    this.emit({ type: "dialogue", speaker, text, next });
  }
  respond() {
    const d = this.pendingDialogue;
    this.pendingDialogue = null;
    if (d?.next)
      this.signal(
        d.next === "mount" ? "conversation-finished" : "evidence-read",
      );
  }
  choose(mercy: boolean) {
    const s = this.state;
    if (s.stage !== "choice") return;
    s.choice = mercy ? "mercy" : "revenge";
    s.honor += mercy ? 25 : -20;
    this.pendingChoice = false;
    this.emit({
      type: "toast",
      title: mercy ? "Mercy remembered" : "A debt paid in blood",
      text: mercy
        ? "Honor increased · The leader leaves his ammunition."
        : "Honor decreased · Some debts follow you home.",
    });
    if (!mercy)
      this.emit({
        type: "shot",
        from: s.player,
        to: BOSS,
        hit: true,
        enemy: false,
        mounted: s.player.mounted,
      });
    s.player.reserve.revolver += 12;
    this.signal("leader-resolved");
  }
  interactable(): Interaction | null {
    const s = this.state,
      p = s.player;
    const nearby = (v: Vec2, r = 3.4) => distance(p, v) < r;
    if (s.mode === "range" && nearby({ x: 84, z: 49 }, 3.4))
      return {
        label: "Reset the range",
        hint: "Refill cores, ammunition & targets",
        kind: "range",
        position: { x: 84, z: 49 },
      };
    if (nearby(ADA))
      return {
        label: s.stage === "return" ? "Deliver the medicine" : "Speak to Ada",
        hint: "Cinder Creek camp",
        kind: "ada",
        position: ADA,
      };
    if (s.stage === "choice" && nearby(BOSS, 4))
      return {
        label: "Decide his fate",
        hint: "The gang leader has surrendered",
        kind: "choice",
        position: BOSS,
      };
    if (s.stage === "medicine" && nearby(CRATE))
      return {
        label: "Recover the medicine",
        hint: "Camp supplies",
        kind: "medicine",
        position: CRATE,
      };
    if (s.stage === "trail" && nearby(WAGON, 4.8))
      return {
        label: "Search the wagon",
        hint: "Follow the stolen shipment",
        kind: "wagon",
        position: WAGON,
      };
    const campaignInteraction = this.campaign.interaction();
    if (campaignInteraction) return campaignInteraction;
    if (nearby(MERCHANT))
      return {
        label: "Trade with Elias",
        hint: "Tonics & ammunition",
        kind: "shop",
        position: MERCHANT,
      };
    if (nearby(FIRE, 3))
      return {
        label: "Rest by the fire",
        hint: "Restore cores · Save progress",
        kind: "rest",
        position: FIRE,
      };
    if (nearby(GRAVE, 3.5) && !s.inventory.relic)
      return {
        label: "Read the old memorial",
        hint: "A story the frontier forgot",
        kind: "relic",
        position: GRAVE,
      };
    for (let i = 0; i < WILD_HERB.length; i++)
      if (!s.herbs[i] && nearby(WILD_HERB[i], 2.8))
        return {
          label: "Gather prairie sage",
          hint: "Brew one health tonic",
          kind: `herb-${i}`,
          position: WILD_HERB[i],
        };
    for (const place of LANDMARKS)
      if (nearby(place, 4))
        return {
          label:
            place.kind === "camp" ? "Rest at camp" : "Read the trail marker",
          hint: place.name,
          kind: `landmark:${place.id}`,
          position: place,
        };
    for (const e of s.enemies)
      if (e.health <= 0 && !e.loot && nearby(e, 2.5))
        return {
          label: "Search saddlebags",
          hint: "Ammunition & loose change",
          kind: e.id,
          position: e,
        };
    if (p.mounted || nearby(s.horse, 3.8))
      return {
        label: p.mounted ? "Dismount Juniper" : "Ride Juniper",
        hint: p.mounted ? "Steady, girl." : "Your trusted companion",
        kind: "horse",
        position: s.horse,
      };
    return null;
  }
  interact() {
    const s = this.state,
      p = s.player,
      t = this.interactable();
    if (!t) return;
    this.emit({ type: "sound", name: "click" });
    if (
      ["hub:", "objective:", "loot:", "capture:"].some((prefix) =>
        t.kind.startsWith(prefix),
      )
    ) {
      this.campaign.interact(t.kind);
      return;
    }
    if (t.kind === "ada") {
      if (s.stage === "meet")
        this.say(
          "ADA MORROW",
          "The fever is getting worse. The Cinder gang took our medicine wagon. Follow the road east, find what they stole… and come back in one piece.",
          "mount",
        );
      else if (s.stage === "return") {
        s.inventory.medicine = false;
        s.inventory.dollars += 65;
        s.honor += 15;
        s.completedAt = s.elapsed;
        this.campaign.awardXP(250);
        s.campaign.engaged = true;
        this.signal("supplies-delivered");
        this.emit({ type: "complete" });
        this.emit({ type: "sound", name: "complete" });
      } else
        this.say(
          "ADA MORROW",
          s.stage === "complete"
            ? "You brought more than medicine back. You gave these people another morning. There is always a place for you here."
            : "Follow the wagon road, across the river. Mercy Station is beyond the red cliffs. I will keep the fire going.",
        );
    } else if (t.kind === "horse") {
      p.mounted = !p.mounted;
      s.horse.following = false;
      this.emit({ type: "sound", name: "mount" });
      if (p.mounted) {
        p.x = s.horse.x;
        p.z = s.horse.z;
        p.yaw = s.horse.yaw;
        this.signal("horse-mounted");
      } else {
        const offset = moveWithCollision(
          p,
          Math.cos(p.yaw) * 1.8,
          -Math.sin(p.yaw) * 1.8,
          OBSTACLES,
        );
        Object.assign(p, offset);
      }
    } else if (t.kind === "wagon")
      this.say(
        "THE RANSACKED WAGON",
        "Empty bottles. Fresh hoofprints. A scrap of red cloth caught on the axle. The trail leads across the river, toward Mercy Station.",
        "outpost",
      );
    else if (t.kind === "choice") {
      this.pendingChoice = true;
      this.emit({ type: "choice" });
    } else if (t.kind === "medicine") {
      s.inventory.medicine = true;
      this.emit({
        type: "toast",
        title: "Medicine recovered",
        text: "A small crate. A whole camp’s tomorrow.",
      });
      this.emit({ type: "sound", name: "pickup" });
      this.signal("supplies-collected");
    } else if (t.kind === "shop") this.emit({ type: "shop" });
    else if (t.kind === "rest") {
      if (s.heat > 0) {
        this.emit({
          type: "toast",
          title: "Not while you are wanted",
          text: "Lose the search party before resting.",
        });
        return;
      }
      p.health = this.campaign.stats.health;
      p.stamina = p.focus = s.horse.stamina = 100;
      s.time = 16.6;
      s.horse.bond = clamp(s.horse.bond + 15, 0, 100);
      this.emit({
        type: "toast",
        title: "A moment of peace",
        text: "Cores restored · Juniper’s bond increased · Progress saved",
      });
      this.checkpoint();
    } else if (t.kind === "relic") {
      s.inventory.relic = true;
      s.honor += 10;
      s.inventory.dollars += 15;
      this.say(
        "THE FORGOTTEN CROSS",
        "“Mara Vale, 1841–1889. She planted trees whose shade she would never see.” Beneath the stone, a silver keepsake. Some things are worth remembering.",
      );
      this.checkpoint();
    } else if (t.kind.startsWith("herb-")) {
      s.herbs[Number(t.kind.slice(5))] = true;
      s.inventory.herbs++;
      s.campaign.materials.herbs += 2;
      s.inventory.tonics++;
      this.emit({
        type: "toast",
        title: "Prairie tonic brewed",
        text: "+1 health tonic · A little frontier medicine",
      });
      this.emit({ type: "sound", name: "pickup" });
      this.checkpoint();
    } else if (t.kind.startsWith("outlaw-")) {
      const e = s.enemies.find((e) => e.id === t.kind)!;
      e.loot = true;
      s.inventory.dollars += 5;
      s.player.reserve.revolver += 6;
      s.player.reserve.rifle += 4;
      this.emit({
        type: "toast",
        title: "Supplies found",
        text: "+$5 · +6 revolver rounds · +4 repeater rounds",
      });
      this.checkpoint();
    } else if (t.kind.startsWith("landmark:")) {
      const place = landmarkById(t.kind.slice(9));
      if (!place) return;
      if (place.kind === "camp") {
        p.health = this.campaign.stats.health;
        p.stamina = p.focus = s.horse.stamina = 100;
        this.emit({
          type: "toast",
          title: "A place to rest",
          text: "Cores restored · Juniper watered · Progress saved",
        });
      }
      this.say(place.name.toUpperCase(), place.story);
      this.checkpoint();
    } else if (t.kind === "range") {
      p.health = p.focus = p.stamina = 100;
      p.reserve = { revolver: 90, rifle: 90 };
      p.ammo = { revolver: 6, rifle: 8 };
      s.targets.forEach((t) => (t.health = 100));
      this.emit({
        type: "toast",
        title: "Range ready",
        text: "Five targets · Full supplies",
      });
    }
  }
  navigateTo(id: string | null) {
    if (id !== null && !destinationById(id)) return false;
    this.state.explorationTarget = id;
    this.state.campaign.tracked = null;
    this.checkpoint();
    return true;
  }
  buy(item: "tonic" | "ammo") {
    const s = this.state,
      price = supplyPrice(s, item);
    if (distance(s.player, MERCHANT) > 4) return false;
    if (s.inventory.dollars < price) {
      this.emit({ type: "toast", title: "Not enough dollars" });
      return false;
    }
    s.inventory.dollars -= price;
    if (item === "tonic") s.inventory.tonics++;
    else {
      s.player.reserve.revolver += 18;
      s.player.reserve.rifle += 12;
    }
    this.emit({ type: "sound", name: "pickup" });
    this.checkpoint();
    return true;
  }
  heal() {
    const s = this.state,
      p = s.player;
    const stats = this.campaign.stats;
    if (!s.inventory.tonics || p.health >= stats.health) return;
    s.inventory.tonics--;
    p.health = clamp(p.health + 65 * (1 + stats.tonic / 100), 0, stats.health);
    p.focus = clamp(p.focus + 25, 0, 100);
    this.emit({ type: "sound", name: "tonic" });
    this.emit({
      type: "toast",
      title: "Prairie tonic",
      text: "Health and focus restored",
    });
  }
  aimTarget(yaw: number) {
    const s = this.state,
      p = s.player,
      w = WEAPONS[p.weapon];
    return this.allEnemies()
      .filter(
        (e) =>
          e.health > 0 &&
          !("captured" in e && e.captured) &&
          distance(p, e) < w.range &&
          Math.abs(angleDelta(yaw, angleTo(p, e))) < 0.38 &&
          !lineBlocked(p, e, OBSTACLES, p.mounted ? 2.1 : 1.3),
      )
      .sort(
        (a, b) =>
          Math.abs(angleDelta(yaw, angleTo(p, a))) -
          Math.abs(angleDelta(yaw, angleTo(p, b))),
      )[0];
  }
  shoot(yaw: number) {
    const s = this.state,
      p = s.player,
      w = WEAPONS[p.weapon];
    if (p.shot > 0 || p.reload > 0) return;
    if (p.ammo[p.weapon] <= 0) {
      p.shot = 0.4;
      this.emit({ type: "sound", name: "empty" });
      this.startReload();
      return;
    }
    p.ammo[p.weapon]--;
    p.shot = w.rate;
    s.shots++;
    this.shotId++;
    const target = p.aiming
      ? this.aimTarget(yaw)
      : this.allEnemies().find(
          (e) =>
            e.health > 0 &&
            !("captured" in e && e.captured) &&
            distance(p, e) < 22 &&
            Math.abs(angleDelta(yaw, angleTo(p, e))) < 0.14 &&
            !lineBlocked(p, e, OBSTACLES),
        );
    let hit = false,
      to: Vec2 = {
        x: p.x + Math.sin(yaw) * w.range,
        z: p.z + Math.cos(yaw) * w.range,
      };
    if (target) {
      this.combat.strike(target, w.damage, p.focusing);
      to = target;
      hit = true;
      s.hits++;
      this.emit({ type: "sound", name: "hit" });
    }
    if (s.mode === "range")
      for (const t of s.targets)
        if (
          t.health > 0 &&
          distance(p, t) < w.range &&
          Math.abs(angleDelta(yaw, angleTo(p, t))) < (p.aiming ? 0.15 : 0.07)
        ) {
          t.health -= w.damage * (p.focusing ? 1.55 : 1);
          to = t;
          hit = true;
          s.hits++;
          break;
        }
    this.emit({
      type: "shot",
      from: { x: p.x, z: p.z },
      to: { x: to.x, z: to.z },
      hit,
      enemy: false,
      mounted: p.mounted,
    });
    for (const e of this.allEnemies())
      if (e.health > 0 && distance(p, e) < 55) {
        e.awareness = 1;
        e.state = "investigate";
      }
    if (distance(p, CAMP) < 27 && s.elapsed - this.lastCrime > 3) {
      this.lastCrime = s.elapsed;
      s.honor -= 5;
      s.bounty += 5;
      s.heat = 35;
      this.emit({
        type: "toast",
        title: "Witness: disturbing the peace",
        text: `$${s.bounty} bounty · Leave camp and let the search cool down`,
      });
    }
  }
  startReload() {
    const p = this.state.player,
      w = WEAPONS[p.weapon];
    if (
      p.reload > 0 ||
      p.ammo[p.weapon] >= w.capacity ||
      p.reserve[p.weapon] <= 0
    )
      return;
    p.reload = w.reload / (1 + this.campaign.stats.reload / 100);
    this.emit({ type: "sound", name: "reload" });
  }
  update(dt: number, c: Controls, yaw: number) {
    const s = this.state,
      p = s.player;
    if (p.health <= 0 || this.pendingChoice || this.pendingDialogue) return;
    const stats = this.campaign.stats;
    p.health = Math.min(p.health, stats.health);
    if (c.focus && p.focus > 5) p.focusing = !p.focusing;
    const worldDt = dt * (p.focusing ? 0.32 : 1);
    this.campaign.tick(worldDt);
    this.combat.tick(worldDt);
    p.dodge = Math.max(0, p.dodge - dt);
    p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
    if (
      c.dodge &&
      p.dodgeCooldown <= 0 &&
      (p.mounted ? s.horse.stamina : p.stamina) >= 18
    ) {
      const mx = Math.sin(yaw) * c.moveZ - Math.cos(yaw) * c.moveX,
        mz = Math.cos(yaw) * c.moveZ + Math.sin(yaw) * c.moveX,
        len = Math.hypot(mx, mz);
      p.evadeX = len > 0.1 ? mx / len : -Math.sin(yaw);
      p.evadeZ = len > 0.1 ? mz / len : -Math.cos(yaw);
      p.dodge = 0.32;
      p.dodgeCooldown = 1.2 * (1 - stats.evade / 100);
      p.invulnerable = Math.max(p.invulnerable, 0.3);
      if (p.mounted) s.horse.stamina -= 18;
      else p.stamina -= 18;
    }
    s.elapsed += dt;
    for (const place of LANDMARKS)
      if (distance(p, place) < 18 && !s.discovered.includes(place.id)) {
        s.discovered.push(place.id);
        this.campaign.awardXP(12);
        s.campaign.engaged = true;
        this.emit({
          type: "toast",
          title: place.name,
          text: `New landmark · ${s.discovered.length} of ${LANDMARKS.length} discovered`,
        });
        this.emit({ type: "sound", name: "pickup" });
        this.checkpoint();
      }
    s.time = (s.time + worldDt * 0.003) % 24;
    s.weatherTime += worldDt;
    if (s.weatherTime > 190) {
      s.weather = s.weather === "clear" ? "rain" : "clear";
      s.weatherTime = 0;
    }
    if (p.focusing) {
      p.focus = Math.max(0, p.focus - dt * 15 * (1 - stats.focus / 100));
      if (p.focus <= 0) p.focusing = false;
    } else
      p.focus = clamp(p.focus + dt * 2.6 * (1 + stats.focus / 100), 0, 100);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.shot = Math.max(0, p.shot - dt);
    if (p.reload > 0) {
      p.reload = Math.max(0, p.reload - dt);
      if (p.reload === 0) {
        const need = WEAPONS[p.weapon].capacity - p.ammo[p.weapon],
          n = Math.min(need, p.reserve[p.weapon]);
        p.ammo[p.weapon] += n;
        p.reserve[p.weapon] -= n;
      }
    }
    if (c.weapon && p.reload === 0) p.weapon = c.weapon;
    p.aiming = c.aim;
    if (c.reload) this.startReload();
    if (c.tonic) this.heal();
    if (c.interact) this.interact();
    if (c.whistle && !p.mounted) {
      s.horse.following = true;
      this.emit({ type: "sound", name: "whistle" });
      this.emit({ type: "toast", title: "Juniper is on her way" });
    }
    const len = p.dodge > 0 ? 1 : Math.min(1, Math.hypot(c.moveX, c.moveZ)),
      sprinting = c.sprint && !p.aiming && len > 0.1;
    const core = p.mounted ? s.horse.stamina : p.stamina,
      boost = sprinting && core > 5;
    let speed = p.mounted
      ? boost
        ? 16.5
        : 8.7
      : p.aiming
        ? 2.5
        : boost
          ? 7.1
          : 4.2;
    speed *= p.mounted
      ? 1 + Math.min(0.3, stats.ride / 250)
      : 1 + stats.move / 100;
    if (p.dodge > 0) speed *= 2.3;
    const inWater = Math.abs(p.x - riverX(p.z)) < 5.3 && !crossingAt(p.x, p.z);
    if (inWater) speed *= 0.48;
    const mx =
        p.dodge > 0
          ? p.evadeX
          : Math.sin(yaw) * c.moveZ - Math.cos(yaw) * c.moveX,
      mz =
        p.dodge > 0
          ? p.evadeZ
          : Math.cos(yaw) * c.moveZ + Math.sin(yaw) * c.moveX;
    p.speed = speed * len;
    if (len > 0.05) {
      const desired = Math.atan2(mx, mz);
      p.yaw +=
        angleDelta(p.yaw, desired) * Math.min(1, dt * (p.mounted ? 6 : 14));
      const old = { x: p.x, z: p.z };
      Object.assign(
        p,
        moveWithCollision(
          p,
          mx * speed * dt,
          mz * speed * dt,
          OBSTACLES,
          p.mounted ? 0.8 : 0.45,
        ),
      );
      if (distance(old, p) < 0.005) p.speed = 0;
      p.animation += dt * speed * (p.mounted ? 0.65 : 1.6);
      this.stepSound += dt * speed;
      if (this.stepSound > (p.mounted ? 2 : 1.9)) {
        this.stepSound = 0;
        this.emit({ type: "sound", name: p.mounted ? "hoof" : "step" });
      }
    }
    if (p.aiming) p.yaw = yaw;
    p.stamina = clamp(p.stamina + dt * (!p.mounted && boost ? -11 : 8), 0, 100);
    s.horse.stamina = clamp(
      s.horse.stamina +
        dt *
          (p.mounted && boost
            ? -5.5 /
              (1 +
                stats.ride / 100 +
                (stats.aspects.includes("trailblazer") ? 0.4 : 0))
            : 6),
      0,
      100,
    );
    if (p.mounted) {
      s.horse.x = p.x;
      s.horse.z = p.z;
      s.horse.yaw = p.yaw;
      s.horse.speed = p.speed;
      s.horse.animation = p.animation;
      s.horse.bond = clamp(s.horse.bond + dt * 0.08, 0, 100);
    } else if (s.horse.following) {
      const d = distance(p, s.horse);
      if (d < 2.8) {
        s.horse.following = false;
        s.horse.speed = 0;
      } else {
        const a = angleTo(s.horse, p);
        s.horse.yaw += angleDelta(s.horse.yaw, a) * Math.min(1, dt * 5);
        s.horse.speed = Math.min(11, d);
        Object.assign(
          s.horse,
          moveWithCollision(
            s.horse,
            Math.sin(a) * s.horse.speed * dt,
            Math.cos(a) * s.horse.speed * dt,
            OBSTACLES,
            0.8,
          ),
        );
        s.horse.animation += dt * s.horse.speed * 0.65;
      }
    } else s.horse.speed = 0;
    if (c.fire && p.dodge <= 0) this.shoot(yaw);
    if (distance(p, { x: 39, z: -29 }) < 25) this.signal("site-reached");
    if (s.stage === "fight" && s.enemies.every((e) => e.health <= 0)) {
      this.signal("gang-defeated");
      this.emit({
        type: "toast",
        title: "“All right! I give up!”",
        text: "The gang leader drops his weapon.",
      });
    }
    const foes = this.allEnemies();
    for (let i = 0; i < foes.length; i++) {
      const e = foes[i],
        dynamic = "owner" in e ? (e as CampaignEnemy) : null;
      if (e.health <= 0 || dynamic?.captured) continue;
      if (dynamic?.boss && e.health <= dynamic.maxHealth * 0.3) {
        e.speed = 0;
        e.yaw = angleTo(e, p);
        continue;
      }
      const protect = dynamic
        ? s.campaign.objects.find(
            (o) =>
              o.owner === dynamic.owner &&
              !o.used &&
              o.health > 0 &&
              (o.kind === "wagon" || o.kind === "survivor"),
          )
        : undefined;
      const target =
        protect &&
        distance(e, protect) < 35 &&
        (distance(e, p) > 15 || i % 2 === 0)
          ? protect
          : p;
      const d = distance(e, target),
        visible = d < 43 && !lineBlocked(e, target, OBSTACLES);
      if (visible && d < 32) e.awareness = clamp(e.awareness + worldDt * 0.9);
      else e.awareness = Math.max(0, e.awareness - worldDt * 0.06);
      if (e.awareness >= 0.8) e.state = visible ? "attack" : "flank";
      let dest: Vec2 = e.home;
      if (e.state === "patrol")
        dest = {
          x: e.home.x + Math.sin(s.elapsed * 0.18 + i) * 3,
          z: e.home.z + Math.cos(s.elapsed * 0.18 + i) * 3,
        };
      else if (e.state === "flank" || e.state === "investigate")
        dest = {
          x: target.x + Math.cos(i * 2.4) * 8,
          z: target.z + Math.sin(i * 2.4) * 8,
        };
      else if (e.state === "attack")
        dest =
          d > 21
            ? target
            : { x: e.x + Math.sin(s.elapsed * 0.5 + i) * 0.2, z: e.z };
      if (dynamic && distance(e, dest) > 1) dest = steerAround(e, dest);
      const chilled = (s.campaign.effects[e.id]?.chill ?? 0) > 0 ? 0.55 : 1;
      const family = dynamic
        ? ENEMY_FAMILIES[dynamic.family as keyof typeof ENEMY_FAMILIES]
        : null;
      const frenzy = dynamic?.modifiers.includes("frenzied") ? 1.3 : 1;
      e.speed =
        distance(e, dest) > 0.8
          ? (e.state === "patrol" ? 1.2 : 2.5) *
            (family?.speed ?? 1) *
            frenzy *
            chilled
          : 0;
      if (e.speed) {
        const angle = angleTo(e, dest);
        Object.assign(
          e,
          moveWithCollision(
            e,
            Math.sin(angle) * e.speed * worldDt,
            Math.cos(angle) * e.speed * worldDt,
            OBSTACLES,
            0.45,
          ),
        );
        e.yaw = angle;
        e.animation += worldDt * e.speed * 1.8;
      }
      if (e.awareness > 0.7) {
        e.yaw = angleTo(e, target);
        e.cooldown -= worldDt * chilled;
        if (dynamic)
          this.combat.enemyAbility(dynamic, worldDt * chilled, target);
        if (e.cooldown <= 0 && visible && d < 43) {
          e.cooldown = (2.6 + (dynamic ? (i % 5) * 0.15 : i * 0.19)) / frenzy;
          const moving =
              target === p ? p.speed > 5 : protect?.kind === "survivor",
            covered = lineBlocked(e, target, OBSTACLES, 1),
            hit =
              (this.shotId + i + Math.floor(s.elapsed)) % 5 >
                (moving ? 2 : 0) && !covered;
          this.emit({
            type: "shot",
            from: { x: e.x, z: e.z },
            to: {
              x: target.x + (hit ? 0 : 2.5),
              z: target.z + (hit ? 0 : 1.7),
            },
            hit,
            enemy: true,
          });
          if (hit) {
            let damage = dynamic?.damage ?? 8;
            if (target === p) damage = this.combat.damagePlayer(damage);
            else if (protect) {
              damage *= 0.65;
              protect.health = Math.max(0, protect.health - damage);
            }
            if (dynamic?.modifiers.includes("vampiric"))
              e.health = Math.min(dynamic.maxHealth, e.health + damage * 0.6);
          }
        }
      }
    }
    if (s.heat > 0) {
      if (distance(p, CAMP) > 27) s.heat = Math.max(0, s.heat - dt);
      else if (s.elapsed - this.lastCrime > 5)
        s.heat = Math.max(0, s.heat - dt * 0.2);
    }
    if (groundHeight(p.x, p.z) < -1.6 && !p.mounted)
      p.stamina = Math.max(0, p.stamina - dt * 2);
  }
}
