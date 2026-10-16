import type { Simulation } from "../../engine/simulation";
import { emptyControls, type Controls } from "../../engine/types";
import { angleDelta, angleTo, distance, type Vec2 } from "../../engine/math";
import { roadRoute, steerAround } from "../../engine/campaign/navigation";
import { HUBS } from "./catalog";

export interface DemoFrame {
  controls: Controls;
  yaw: number;
  restart: boolean;
  panel?: "playing" | "board" | "contracts" | "equipment";
  selection?: string;
}
/** A real contract, turn-in and gear upgrade after the original story demonstration. */
export class CampaignDemo {
  age = 0;
  phase: "ride-hub" | "offer" | "work" | "turn-in" | "reward" = "ride-hub";
  wait = 0;
  job = "";
  item = "";
  yaw = 2.35;
  private route: Vec2[] = [];
  private routeIndex = 0;
  private targetKey = "";
  update(dt: number, sim: Simulation): DemoFrame {
    this.age += dt;
    const c = emptyControls(),
      s = sim.state,
      p = s.player,
      hub = HUBS[0];
    const frame: DemoFrame = {
      controls: c,
      yaw: this.yaw,
      restart: this.age > 210 || p.health <= 0,
    };
    if (frame.restart) return frame;
    if (p.health < 65) c.tonic = true;
    if (p.focusing) c.focus = true;
    const threat = s.campaign.enemies
      .filter(
        (e) =>
          e.health > 0 &&
          !e.captured &&
          e.awareness > 0.6 &&
          distance(e, p) < 32,
      )
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (threat && this.phase === "work") {
      const angle = angleTo(p, threat);
      this.yaw += angleDelta(this.yaw, angle) * Math.min(1, dt * 9);
      c.weapon = "rifle";
      c.aim = true;
      c.focus = !p.focusing && p.focus > 65;
      c.fire = Math.abs(angleDelta(this.yaw, angle)) < 0.15;
      c.reload = p.ammo.rifle === 0;
      c.moveZ = sim.aimTarget(this.yaw) ? 0 : 0.5;
      return { ...frame, yaw: this.yaw };
    }
    if (sim.pendingDialogue) {
      this.wait += dt;
      if (this.wait > 1.5) {
        sim.respond();
        this.wait = 0;
        frame.panel = "playing";
      }
      return frame;
    }
    if (this.phase === "ride-hub") {
      frame.panel = "playing";
      if (distance(p, hub) > 3) this.move(c, p, hub, dt, "hub");
      else {
        this.job =
          s.campaign.boards.cinder.find((j) => j.kind === "salvage")?.id ?? "";
        if (!this.job) {
          frame.restart = true;
          return frame;
        }
        this.phase = "offer";
        this.wait = 0;
        frame.panel = "board";
        frame.selection = this.job;
      }
    } else if (this.phase === "offer") {
      this.wait += dt;
      if (this.wait > 3) {
        if (sim.campaign.accept("cinder", this.job)) {
          this.phase = "work";
          this.wait = 0;
          frame.panel = "playing";
        } else frame.restart = true;
      }
    } else if (this.phase === "work") {
      const job = s.campaign.active.find((j) => j.id === this.job);
      if (!job) {
        frame.restart = true;
        return frame;
      }
      if (job.status === "ready") {
        this.phase = "turn-in";
        this.targetKey = "";
      } else if (job.status === "failed") frame.restart = true;
      else {
        const o = job.objectives[job.index],
          object = s.campaign.objects
            .filter((v) => v.owner === job.id && !v.used)
            .sort((a, b) => distance(p, a) - distance(p, b))[0],
          target = object ?? o;
        if (!p.mounted && distance(p, s.horse) > 3.7)
          c.whistle = !s.horse.following;
        else if (!p.mounted) {
          c.interact = true;
          return { ...frame, yaw: this.yaw };
        }
        if (distance(p, target) > 2.8)
          this.move(c, p, target, dt, object?.id ?? `${job.id}:${job.index}`);
        else if (o.kind === "interact") c.interact = true;
      }
    } else if (this.phase === "turn-in") {
      if (distance(p, hub) > 3) this.move(c, p, hub, dt, "return-hub");
      else {
        this.wait += dt;
        frame.panel = "contracts";
        frame.selection = this.job;
        if (this.wait > 3 && sim.campaign.claim(this.job)) {
          const item = s.campaign.items.at(-1)!;
          this.item = item.id;
          sim.campaign.gear.equip(item.id);
          sim.campaign.gear.upgrade(item.id);
          this.phase = "reward";
          this.wait = 0;
          frame.panel = "equipment";
          frame.selection = this.item;
        }
      }
    } else {
      this.wait += dt;
      if (this.wait > 6) frame.restart = true;
    }
    frame.yaw = this.yaw;
    return frame;
  }
  private move(c: Controls, p: Vec2, target: Vec2, dt: number, key: string) {
    if (this.targetKey !== key) {
      this.targetKey = key;
      this.route = distance(p, target) > 45 ? roadRoute(p, target) : [target];
      this.routeIndex = 0;
    }
    let point = this.route[Math.min(this.routeIndex, this.route.length - 1)];
    if (distance(p, point) < 3.5 && this.routeIndex < this.route.length - 1)
      point = this.route[++this.routeIndex];
    const steered = steerAround(p, point),
      a = angleTo(p, steered);
    this.yaw += angleDelta(this.yaw, a) * Math.min(1, dt * 8);
    c.moveZ = 1;
    c.sprint = distance(p, target) > 15;
  }
}
