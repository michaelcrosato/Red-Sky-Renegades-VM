import {
  clamp,
  distance,
  lineBlocked,
  random,
  riverX,
  crossingAt,
} from "../math";
import { OBSTACLES } from "../../game/content";
import type { Enemy, GameEvent, GameState } from "../types";
import type { CampaignEnemy } from "./types";
import { CampaignRuntime } from "./runtime";

export class CampaignCombat {
  constructor(
    readonly state: GameState,
    readonly campaign: CampaignRuntime,
    readonly emit: (event: GameEvent) => void,
  ) {}
  private elementalScale(element: string, target: { x: number; z: number }) {
    let scale = 1;
    if (this.state.weather === "rain") {
      if (element === "fire") scale *= 0.6;
      if (element === "storm") scale *= 1.25;
    }
    if (
      element === "storm" &&
      Math.abs(target.x - riverX(target.z)) < 6 &&
      !crossingAt(target.x, target.z)
    )
      scale *= 1.25;
    return scale;
  }
  private deal(enemy: Enemy, amount: number, element = "physical") {
    if (enemy.health <= 0 || ("captured" in enemy && enemy.captured)) return 0;
    const armor = "armor" in enemy ? (enemy as CampaignEnemy).armor : 0,
      damage =
        amount *
        (element === "physical"
          ? 100 / (100 + armor)
          : this.elementalScale(element, enemy));
    enemy.health -= damage;
    enemy.awareness = 1;
    enemy.state = "attack";
    if (enemy.health <= 0) {
      enemy.state = "dead";
      enemy.speed = 0;
      this.state.kills++;
      this.state.player.focus = clamp(this.state.player.focus + 16, 0, 100);
      this.campaign.defeated(enemy);
    }
    return damage;
  }
  strike(enemy: Enemy, base: number, focusing: boolean) {
    const c = this.state.campaign,
      stats = this.campaign.stats,
      p = this.state.player,
      rng = random(c.seed + ++c.roll * 31337),
      critical = rng() * 100 < stats.crit;
    const amount =
      base *
      (1 + stats.damage / 100) *
      (focusing ? 1.55 : 1) *
      (critical ? 1 + stats.critDamage / 100 : 1) *
      (p.mounted && stats.aspects.includes("trailblazer") ? 1.25 : 1);
    const damage = this.deal(enemy, amount);
    p.health = Math.min(stats.health, p.health + stats.leech);
    if (enemy.health > 0) {
      const effect = (c.effects[enemy.id] ??= {
        bleed: 0,
        scorch: 0,
        chill: 0,
        bleedDamage: 0,
        scorchDamage: 0,
      });
      const ember = stats.runes.filter((r) => r === "ember").length;
      if (ember) {
        effect.scorch = 3;
        effect.scorchDamage = (3 + c.progression.level) * ember;
      }
      if (stats.runes.includes("frost")) effect.chill = 3;
      if (critical && stats.aspects.includes("blood-price")) {
        effect.bleed = 3;
        effect.bleedDamage = amount * 0.18;
      }
    }
    const nearby = this.campaign
      .allEnemies()
      .filter(
        (e) =>
          e !== enemy &&
          e.health > 0 &&
          !("captured" in e && e.captured) &&
          distance(e, enemy) < 11 &&
          !lineBlocked(enemy, e, OBSTACLES),
      );
    if (
      stats.aspects.includes("ricochet") &&
      this.state.shots % 3 === 0 &&
      nearby[0]
    ) {
      this.deal(nearby[0], amount * 0.45);
      this.emit({
        type: "shot",
        from: enemy,
        to: nearby[0],
        hit: true,
        enemy: false,
      });
    }
    if (stats.aspects.includes("stormcaller") && c.procCooldown <= 0) {
      c.procCooldown = 4;
      for (const other of nearby.slice(0, 2)) {
        this.deal(other, amount * 0.55, "storm");
        this.emit({
          type: "shot",
          from: enemy,
          to: other,
          hit: true,
          enemy: false,
        });
      }
    }
    return { damage, critical };
  }
  damagePlayer(amount: number, element = "physical") {
    const p = this.state.player,
      c = this.state.campaign,
      stats = this.campaign.stats;
    if (p.health <= 0 || p.invulnerable > 0 || p.dodge > 0) return 0;
    let damage =
      amount *
      (element === "physical"
        ? 1 - Math.min(0.65, stats.armor / (stats.armor + 100))
        : 1 - stats.resist / 100);
    const absorbed = Math.min(c.shield, damage);
    c.shield -= absorbed;
    damage -= absorbed;
    p.invulnerable = 0.3;
    if (damage > 0) {
      p.health = Math.max(0, p.health - damage);
      this.emit({ type: "damage", amount: damage });
    }
    if (p.health <= 0) {
      this.state.deaths++;
      this.emit({ type: "death" });
    } else if (
      p.health < stats.health * 0.35 &&
      stats.aspects.includes("last-stand") &&
      c.shieldCooldown <= 0
    ) {
      c.shield = Math.min(100, stats.health * 0.3);
      c.shieldCooldown = 35;
      p.invulnerable = 1.3;
      this.emit({
        type: "toast",
        title: "Last Stand",
        text: "A relic barrier holds. Keep moving.",
      });
    }
    return damage;
  }
  tick(dt: number) {
    const c = this.state.campaign;
    for (const e of this.campaign.allEnemies()) {
      const f = c.effects[e.id];
      if (!f || e.health <= 0) continue;
      if (f.bleed > 0) this.deal(e, Math.min(dt, f.bleed) * f.bleedDamage);
      if (f.scorch > 0 && e.health > 0)
        this.deal(e, Math.min(dt, f.scorch) * f.scorchDamage, "fire");
      f.bleed = Math.max(0, f.bleed - dt);
      f.scorch = Math.max(0, f.scorch - dt);
      f.chill = Math.max(0, f.chill - dt);
      if (!f.bleed && !f.scorch && !f.chill) delete c.effects[e.id];
    }
    for (const hazard of c.hazards) {
      if (hazard.warning > 0 || hazard.hit || hazard.life <= 0) continue;
      let impacted = false;
      if (distance(this.state.player, hazard) < hazard.radius) {
        this.damagePlayer(
          hazard.damage *
            this.elementalScale(hazard.element, this.state.player),
          hazard.element,
        );
        impacted = true;
      }
      for (const obj of c.objects)
        if (
          obj.owner === hazard.owner &&
          (obj.kind === "survivor" || obj.kind === "wagon") &&
          distance(obj, hazard) < hazard.radius
        ) {
          obj.health = Math.max(0, obj.health - hazard.damage * 0.6);
          impacted = true;
        }
      if (impacted) hazard.hit = true;
    }
  }
  enemyAbility(
    enemy: CampaignEnemy,
    dt: number,
    target: { x: number; z: number },
  ) {
    if (!enemy.elite || enemy.captured) return;
    enemy.ability -= dt;
    if (
      enemy.ability > 0 ||
      distance(enemy, target) > 45 ||
      this.state.campaign.hazards.length >= 20
    )
      return;
    const element = enemy.modifiers.includes("stormbound")
      ? "storm"
      : enemy.modifiers.includes("venomous")
        ? "poison"
        : enemy.modifiers.includes("scorched")
          ? "fire"
          : null;
    enemy.ability = enemy.boss ? 5 : 7;
    if (!element) return;
    this.state.campaign.hazards.push({
      id: `hazard-${this.state.campaign.serial++}`,
      owner: enemy.owner,
      x: target.x,
      z: target.z,
      radius: enemy.boss ? 3.6 : 2.7,
      warning: 1.3,
      life: element === "storm" ? 1.2 : 4,
      damage: 8 + enemy.level * 0.7,
      element,
      hit: false,
    });
  }
}
