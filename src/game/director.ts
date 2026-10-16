import { ADA, BOSS, BRIDGE, CRATE, POST, WAGON } from "./content";
import { angleDelta, angleTo, distance, type Vec2 } from "../engine/math";
import { emptyControls } from "../engine/types";
import { Simulation } from "../engine/simulation";
import { CampaignDemo, type DemoFrame } from "./campaign/demo";

/** Retail demo: produces the same commands and dialogue responses as a player. */
export class Director {
  age = 0;
  stageAge = 0;
  lastStage = "";
  responseWait = 0;
  completionWait = 0;
  yaw = 2.35;
  private routeIndex = 0;
  private lastPos = { x: 0, z: 0 };
  private stuck = 0;
  private campaignDemo = new CampaignDemo();
  update(dt: number, sim: Simulation): DemoFrame {
    const c = emptyControls(),
      s = sim.state,
      p = s.player;
    this.age += dt;
    this.stageAge += dt;
    if (s.stage !== this.lastStage) {
      this.lastStage = s.stage;
      this.stageAge = 0;
      this.routeIndex = 0;
    }
    if (sim.pendingDialogue) {
      this.responseWait += dt;
      if (this.responseWait > 3.8) {
        sim.respond();
        this.responseWait = 0;
      }
      return { controls: c, yaw: this.yaw, restart: false };
    }
    if (sim.pendingChoice) {
      this.responseWait += dt;
      if (this.responseWait > 2.5) {
        sim.choose(true);
        this.responseWait = 0;
      }
      return { controls: c, yaw: this.yaw, restart: false };
    }
    if (p.health <= 0)
      return { controls: c, yaw: this.yaw, restart: this.stageAge > 3 };
    if (s.stage === "complete") {
      this.completionWait += dt;
      if (this.completionWait < 5)
        return { controls: c, yaw: this.yaw, restart: false };
      return this.campaignDemo.update(dt, sim);
    }
    let target: Vec2 = ADA;
    if (s.stage === "meet") target = ADA;
    if (s.stage === "mount") target = s.horse;
    if (s.stage === "trail") target = WAGON;
    if (s.stage === "outpost") {
      const route = [
        { x: -21, z: 6 },
        BRIDGE,
        { x: 7, z: 6 },
        { x: 24, z: -10 },
        POST,
      ];
      target = route[Math.min(this.routeIndex, route.length - 1)];
      if (distance(p, target) < 3) this.routeIndex++;
    }
    if (s.stage === "fight") {
      if (p.mounted) {
        c.interact = true;
        return { controls: c, yaw: this.yaw, restart: false };
      }
      const enemies = s.enemies
        .filter((e) => e.health > 0)
        .sort((a, b) => distance(p, a) - distance(p, b));
      const e = enemies[0];
      if (e) {
        target = e;
        const a = angleTo(p, e);
        this.yaw += angleDelta(this.yaw, a) * Math.min(1, dt * 9);
        c.aim = true;
        c.fire = Math.abs(angleDelta(this.yaw, a)) < 0.15;
        c.weapon = "rifle";
        if (p.ammo[p.weapon] === 0) c.reload = true;
        if (p.health < 60) c.tonic = true;
        if (!p.focusing && p.focus > 65) c.focus = true;
        const clear = sim.aimTarget(this.yaw);
        c.moveZ = clear && distance(p, e) < 25 ? 0 : 1;
        return { controls: c, yaw: this.yaw, restart: this.stageAge > 160 };
      }
    }
    if (s.stage === "choice") target = BOSS;
    if (s.stage === "medicine") target = CRATE;
    if (s.stage === "return") {
      if (!p.mounted) {
        if (distance(p, s.horse) > 3.7) {
          c.whistle = !s.horse.following;
          target = s.horse;
        } else {
          c.interact = true;
          return { controls: c, yaw: this.yaw, restart: false };
        }
      } else {
        const route = [
          { x: 27, z: -13 },
          { x: 7, z: 6 },
          BRIDGE,
          { x: -21, z: 6 },
          { x: -39, z: 30 },
          ADA,
        ];
        target = route[Math.min(this.routeIndex, route.length - 1)];
        if (distance(p, target) < 3) this.routeIndex++;
      }
    }
    const d = distance(p, target),
      a = angleTo(p, target);
    this.yaw += angleDelta(this.yaw, a) * Math.min(1, dt * 7);
    const isDestination =
      !["outpost", "return"].includes(s.stage) ||
      (s.stage === "return" && this.routeIndex >= 5 && p.mounted);
    if (d > (isDestination ? 2.5 : 1.2)) {
      c.moveZ = 1;
      c.sprint = p.mounted && d > 12;
      if (distance(this.lastPos, p) < 0.008) this.stuck += dt;
      else this.stuck = Math.max(0, this.stuck - dt * 0.2);
      if (this.stuck > 0.7) {
        c.moveX = 1;
        c.moveZ = 0.4;
        if (this.stuck > 2) this.stuck = 0;
      }
    } else if (isDestination) c.interact = true;
    this.lastPos = { x: p.x, z: p.z };
    return { controls: c, yaw: this.yaw, restart: this.stageAge > 180 };
  }
}
