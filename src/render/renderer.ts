import * as T from "three/webgpu";
import {
  pass,
  screenUV,
  vec4,
  color,
  mix,
  uniform,
  sin,
  time,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import {
  angleDelta,
  clamp,
  groundHeight,
  lineBlocked,
  distance,
} from "../engine/math";
import { OBSTACLES } from "../game/content";
import { MAP_HALF_EXTENT } from "../game/territory";
import type { GameEvent, GameState } from "../engine/types";
import type { Settings } from "../engine/save";
import {
  animateHorse,
  animateHuman,
  horse,
  human,
  type HumanRig,
} from "./models";
import { makeWorld, type World } from "./world";
import { box, sphere, toon } from "./materials";

interface Particle {
  mesh: T.Mesh;
  velocity: T.Vector3;
  life: number;
  max: number;
}
export class FrontierRenderer {
  renderer: T.WebGPURenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(55, 1, 0.15, 1500);
  post!: T.PostProcessing;
  world!: World;
  player = human();
  horse = horse();
  enemies: HumanRig[] = [];
  particles: Particle[] = [];
  focus = uniform(0);
  hurt = uniform(0);
  yaw = 2.35;
  pitch = 0.26;
  private target = new T.Vector3();
  private first = true;
  private lastDust = 0;
  private shake = 0;
  private elapsed = 0;
  private lastFrame = performance.now();
  private bossExit = 0;
  settings: Settings;
  ready = false;
  fps = 0;
  private frameTime = 0;
  private frames = 0;
  private bulletMaterial = new T.MeshBasicNodeMaterial({
    color: "#ffe5a5",
    transparent: true,
    opacity: 0.9,
  });
  constructor(canvas: HTMLCanvasElement, settings: Settings) {
    this.settings = settings;
    this.renderer = new T.WebGPURenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer._getFallback = null;
    this.renderer.setClearColor("#d5aa7d");
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene.fog = new T.FogExp2("#d5a57f", 0.0042);
  }
  async init() {
    if (!("gpu" in navigator))
      throw new Error(
        "This browser does not expose WebGPU. Use a WebGPU-capable browser with hardware acceleration enabled.",
      );
    await this.renderer.init();
    if (
      !(this.renderer.backend as unknown as { isWebGPUBackend: boolean })
        .isWebGPUBackend
    )
      throw new Error("A WebGPU adapter is required.");
    this.world = makeWorld();
    this.scene.add(this.world.group, this.player.root, this.horse.root);
    for (let i = 0; i < 5; i++) {
      const rig = human("enemy");
      this.enemies.push(rig);
      this.scene.add(rig.root);
    }
    const scenePass = pass(this.scene, this.camera);
    const output = scenePass.getTextureNode("output");
    const glow = bloom(output, 0.14, 0.35, 0.88);
    const vignette = screenUV.sub(0.5).length().smoothstep(0.15, 0.74).mul(0.3);
    const base = output.rgb.add(glow.rgb).mul(vignette.oneMinus());
    const focused = mix(base, base.mul(color("#e6c091")), this.focus.mul(0.65));
    this.post = new T.PostProcessing(this.renderer);
    this.post.outputNode = vec4(
      mix(focused, color("#a42b24"), this.hurt.mul(vignette).mul(1.3)),
      1,
    );
    this.configure(this.settings);
    this.resize();
    this.ready = true;
    const device = (
      this.renderer.backend as unknown as {
        device?: { lost: Promise<{ message: string }> };
      }
    ).device;
    device?.lost.then((info) => {
      if (this.ready) {
        this.ready = false;
        window.dispatchEvent(
          new CustomEvent("gpu-lost", { detail: info.message }),
        );
      }
    });
  }
  configure(s: Settings) {
    this.settings = s;
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, s.quality === "high" ? 1.8 : 1),
    );
    if (this.ready) this.resize();
  }
  resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  resetCamera() {
    this.first = true;
    this.yaw = 2.35;
    this.pitch = 0.26;
  }
  effects(e: GameEvent) {
    if (e.type === "damage") {
      this.hurt.value = 0.9;
      this.shake = 0.16;
    }
    if (e.type === "shot") {
      if (!e.enemy) this.shake = 0.06;
      const a = new T.Vector3(
          e.from.x,
          groundHeight(e.from.x, e.from.z) + (e.mounted ? 3.1 : 1.4),
          e.from.z,
        ),
        b = new T.Vector3(e.to.x, groundHeight(e.to.x, e.to.z) + 1.25, e.to.z);
      const direction = b.clone().sub(a),
        length = direction.length();
      const bullet = new T.Mesh(box, this.bulletMaterial);
      bullet.position.copy(a).addScaledVector(direction, 0.5);
      bullet.scale.set(0.025, 0.025, length);
      bullet.lookAt(b);
      this.scene.add(bullet);
      this.particles.push({
        mesh: bullet,
        velocity: new T.Vector3(),
        life: 0.085,
        max: 0.085,
      });
      this.puff(b, e.hit ? "#a96645" : "#d4b587", e.hit ? 6 : 3);
      this.puff(a, "#f1cf83", 3);
    }
  }
  private puff(at: T.Vector3, hex: string, n: number) {
    for (let i = 0; i < n; i++) {
      const mesh = new T.Mesh(sphere, toon(hex));
      mesh.position.copy(at);
      mesh.scale.setScalar(0.04 + Math.random() * 0.09);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new T.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random() * 1.5,
          (Math.random() - 0.5) * 2,
        ),
        life: 0.5 + Math.random() * 0.4,
        max: 1,
      });
    }
  }
  update(
    dt: number,
    s: GameState,
    mode: "menu" | "play" | "demo",
    lookX = 0,
    lookY = 0,
    directorYaw?: number,
  ) {
    if (!this.ready) return;
    this.elapsed += dt;
    const clock = performance.now();
    this.frameTime += (clock - this.lastFrame) / 1000;
    this.lastFrame = clock;
    this.frames++;
    if (this.frameTime > 0.5) {
      this.fps = Math.round(this.frames / this.frameTime);
      this.frameTime = this.frames = 0;
    }
    const p = s.player;
    if (mode === "menu") {
      const t = this.elapsed * 0.025;
      this.camera.position.set(
        -75 + Math.sin(t) * 3,
        6.2,
        67 + Math.cos(t) * 3,
      );
      this.camera.lookAt(-44, 6, -3);
      this.first = true;
    } else {
      if (directorYaw !== undefined)
        this.yaw += angleDelta(this.yaw, directorYaw) * Math.min(1, dt * 4);
      else this.yaw += lookX * this.settings.sensitivity;
      this.pitch = clamp(
        this.pitch +
          lookY * this.settings.sensitivity * (this.settings.invertY ? -1 : 1),
        -0.15,
        0.9,
      );
      const height = groundHeight(p.x, p.z) + (p.mounted ? 2.9 : 1.55),
        dist = p.aiming ? 3.6 : p.mounted ? 8.5 : 6.8;
      const target = new T.Vector3(p.x, height, p.z);
      if (this.first) {
        this.target.copy(target);
        this.first = false;
      }
      this.target.lerp(target, 1 - Math.exp(-dt * 12));
      const shoulder = p.aiming ? 0.72 : 0.45;
      let cameraPos = new T.Vector3(
        this.target.x -
          Math.sin(this.yaw) * dist * Math.cos(this.pitch) +
          Math.cos(this.yaw) * shoulder,
        this.target.y + Math.sin(this.pitch) * dist,
        this.target.z -
          Math.cos(this.yaw) * dist * Math.cos(this.pitch) -
          Math.sin(this.yaw) * shoulder,
      );
      // Sweep the camera inward before an opaque world collider.
      for (let i = 1; i <= 12; i++) {
        const u = i / 12,
          probe = this.target.clone().lerp(cameraPos, u);
        if (
          OBSTACLES.some(
            (o) =>
              Math.hypot(o.x - probe.x, o.z - probe.z) < o.r + 0.2 &&
              probe.y < groundHeight(o.x, o.z) + o.height + 0.35,
          )
        ) {
          cameraPos = this.target
            .clone()
            .lerp(cameraPos, Math.max(0.18, u - 0.1));
          break;
        }
      }
      cameraPos.y = Math.max(
        cameraPos.y,
        groundHeight(cameraPos.x, cameraPos.z) + 0.65,
      );
      this.camera.position.copy(cameraPos);
      if (this.settings.shake && this.shake > 0) {
        this.camera.position.x += (Math.random() - 0.5) * this.shake;
        this.camera.position.y += (Math.random() - 0.5) * this.shake;
      }
      const aimPoint = this.target
        .clone()
        .add(
          new T.Vector3(
            Math.sin(this.yaw) * 20,
            -this.pitch * 4,
            Math.cos(this.yaw) * 20,
          ),
        );
      this.camera.lookAt(aimPoint);
      this.camera.fov = T.MathUtils.damp(
        this.camera.fov,
        p.aiming ? 45 : p.speed > 12 ? 62 : 55,
        4,
        dt,
      );
      this.camera.updateProjectionMatrix();
    }
    this.player.root.position.set(p.x, groundHeight(p.x, p.z), p.z);
    this.player.root.rotation.y = p.yaw;
    animateHuman(
      this.player,
      p.animation,
      p.speed,
      p.mounted,
      p.aiming,
      p.health <= 0,
    );
    this.player.gun.scale.z = p.weapon === "rifle" ? 2.3 : 1;
    this.player.gun.rotation.x -= p.shot * 0.35;
    const h = s.horse;
    this.horse.root.position.set(h.x, groundHeight(h.x, h.z), h.z);
    this.horse.root.rotation.y = h.yaw;
    animateHorse(this.horse, h.animation, h.speed);
    this.enemies.forEach((r, i) => {
      const e = s.enemies[i];
      r.root.visible = !!e;
      if (!e) return;
      r.root.position.set(e.x, groundHeight(e.x, e.z), e.z);
      r.root.rotation.y = e.yaw;
      animateHuman(
        r,
        e.animation,
        e.speed,
        false,
        e.awareness > 0.7,
        e.health <= 0,
      );
    });
    this.world.boss.root.visible =
      ["choice", "medicine", "return", "complete"].includes(s.stage) &&
      s.mode !== "range";
    this.world.boss.arms.forEach(
      (arm, i) => (arm.rotation.z = i === 0 ? -2.6 : 2.6),
    );
    if (s.choice === "revenge")
      animateHuman(this.world.boss, 0, 0, false, false, true);
    else if (s.choice === "mercy") {
      this.bossExit = Math.min(30, this.bossExit + dt * 1.6);
      this.world.boss.root.position.set(
        56 + this.bossExit,
        groundHeight(56 + this.bossExit, -34 - this.bossExit),
        -34 - this.bossExit,
      );
      this.world.boss.root.rotation.y = 2.35;
      animateHuman(this.world.boss, this.elapsed * 3, 2, false, false, false);
    } else {
      this.bossExit = 0;
      this.world.boss.root.position.set(56, groundHeight(56, -34), -34);
      this.world.boss.body.rotation.z = 0;
    }
    this.world.herbs.forEach((h, i) => (h.visible = !s.herbs[i]));
    this.world.chest.visible = !s.inventory.medicine && s.stage !== "complete";
    this.world.targets.forEach((t, i) => {
      t.rotation.x = s.targets[i]?.health <= 0 ? -1.3 : 0;
    });
    this.world.fire.children.forEach((c, i) => {
      if (i >= 12) {
        c.scale.y = 0.75 + Math.sin(this.elapsed * 7 + i) * 0.2;
        c.rotation.y = this.elapsed + i;
      }
    });
    this.world.group.getObjectByName("windmill")!.rotation.z =
      this.elapsed * 0.4;
    this.world.sky.position.copy(this.camera.position);
    this.world.sun.position
      .copy(this.camera.position)
      .add(new T.Vector3(-420, 248, -720));
    const vegetationRange = this.settings.quality === "high" ? 300 : 210;
    for (const cell of this.world.vegetation)
      cell.visible =
        Math.hypot(
          cell.position.x - this.camera.position.x,
          cell.position.z - this.camera.position.z,
        ) <
        vegetationRange + cell.userData.radius;
    for (const rotor of this.world.windmills)
      rotor.rotation.z = this.elapsed * 0.4;
    for (const fire of this.world.campfires)
      for (const flame of fire.children)
        if (flame.userData.flame)
          flame.scale.y = 0.7 + Math.sin(this.elapsed * 7 + flame.id) * 0.15;
    this.world.birds.forEach((b, i) => {
      b.position.set(
        Math.sin(this.elapsed * 0.07 + i) * 43,
        23 + i * 0.6,
        Math.cos(this.elapsed * 0.07 + i) * 40,
      );
      b.rotation.y = -this.elapsed * 0.07 - i;
      b.children.forEach(
        (w, j) =>
          (w.rotation.z =
            Math.sin(this.elapsed * 2 + i) * (j === 0 ? 1 : -1) * 0.3),
      );
    });
    this.world.deer.forEach((d, i) => {
      const near = distance({ x: d.position.x, z: d.position.z }, p) < 18;
      if (near) {
        d.position.x += dt * 4;
        d.position.z -= dt * 2;
        d.rotation.y = 2;
        d.position.y =
          groundHeight(d.position.x, d.position.z) +
          Math.abs(Math.sin(this.elapsed * 8)) * 0.15;
      } else d.rotation.y = 1 + Math.sin(this.elapsed * 0.2 + i) * 0.1;
      if (
        Math.abs(d.position.x) > MAP_HALF_EXTENT - 5 ||
        Math.abs(d.position.z) > MAP_HALF_EXTENT - 5
      ) {
        const home = d.userData.home;
        d.position.set(home.x, groundHeight(home.x, home.z), home.z);
      }
    });
    this.lastDust += dt;
    if (p.speed > 3 && this.lastDust > 0.14) {
      this.lastDust = 0;
      this.puff(
        new T.Vector3(p.x, groundHeight(p.x, p.z) + 0.15, p.z),
        "#c8ab7e",
        2,
      );
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        this.particles.splice(i, 1);
      } else {
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        if (particle.max > 0.1)
          particle.mesh.scale.multiplyScalar(1 + dt * 0.8);
      }
    }
    if (s.weather === "rain" && this.particles.length < 100) {
      for (let i = 0; i < 3; i++) {
        const at = new T.Vector3(
            p.x + (Math.random() - 0.5) * 30,
            groundHeight(p.x, p.z) + 10 + Math.random() * 6,
            p.z + (Math.random() - 0.5) * 30,
          ),
          m = new T.Mesh(box, toon("#b7bdad"));
        m.position.copy(at);
        m.scale.set(0.015, 0.45, 0.015);
        this.scene.add(m);
        this.particles.push({
          mesh: m,
          velocity: new T.Vector3(-1, -18, 0),
          life: 0.8,
          max: 0.8,
        });
      }
    }
    (this.scene.fog as T.FogExp2).density = T.MathUtils.damp(
      (this.scene.fog as T.FogExp2).density,
      s.weather === "rain" ? 0.008 : 0.0042,
      1,
      dt,
    );
    this.focus.value = T.MathUtils.damp(
      this.focus.value,
      p.focusing ? 1 : 0,
      5,
      dt,
    );
    this.hurt.value = Math.max(0, this.hurt.value - dt * 1.5);
    this.shake = Math.max(0, this.shake - dt * 0.5);
  }
  render() {
    if (this.ready) this.post.render();
  }
  project(x: number, z: number, y = 2) {
    const v = new T.Vector3(x, groundHeight(x, z) + y, z).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * innerWidth,
      y: (-0.5 * v.y + 0.5) * innerHeight,
      visible:
        v.z < 1 && v.z > 0 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9,
    };
  }
}
