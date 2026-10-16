import * as T from "three/webgpu";
import { addCampaignHubs } from "./campaign-view";
import {
  addTerrain,
  addRoadsAndBridges,
  addVegetation,
  addLandmarks,
} from "./frontier";
import { INTERIOR_MESAS, SCENERY_HALF_EXTENT } from "../game/territory";
import {
  attribute,
  color,
  dot,
  normalWorld,
  vec3,
  mix,
  positionWorld,
  sin,
  time,
} from "three/tsl";
import {
  ADA,
  BOSS,
  CRATE,
  FIRE,
  GRAVE,
  MERCHANT,
  OBSTACLES,
  TRAIL,
  WAGON,
  WILD_HERB,
} from "../game/content";
import { groundHeight, random, riverX, terrainHeight } from "../engine/math";
import {
  PALETTE as P,
  box,
  cone,
  cylinder,
  lowSphere,
  part,
  sphere,
  toon,
  waterMaterial,
  labelTexture,
} from "./materials";
import { building, human, tent, wagon, type HumanRig } from "./models";

export interface World {
  group: T.Group;
  ada: HumanRig;
  trader: HumanRig;
  boss: HumanRig;
  fire: T.Group;
  herbs: T.Group[];
  chest: T.Group;
  birds: T.Group[];
  deer: T.Group[];
  targets: T.Group[];
  sun: T.Mesh;
  sky: T.Mesh;
  vegetation: T.Group[];
  campfires: T.Group[];
  windmills: T.Group[];
}
export function makeWorld(): World {
  const group = new T.Group(),
    rng = random(8173),
    at = (o: T.Object3D, x: number, z: number, y = 0) => {
      o.position.set(x, groundHeight(x, z) + y, z);
      group.add(o);
      return o;
    };
  addTerrain(group);
  addCampaignHubs(group);
  // A continuous river ribbon and foam on the shallow banks.
  for (const [width, mat, y] of [
    [10, waterMaterial(), -0.9],
    [13, toon("#889a86"), -1.2],
  ] as const) {
    const verts: number[] = [],
      ids: number[] = [];
    for (let i = 0; i <= 500; i++) {
      const z = -SCENERY_HALF_EXTENT + (i * SCENERY_HALF_EXTENT * 2) / 500,
        x = riverX(z);
      verts.push(x - width / 2, y, z, x + width / 2, y, z);
      if (i < 500) {
        const n = i * 2;
        ids.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
    geo.setIndex(ids);
    geo.computeVertexNormals();
    group.add(new T.Mesh(geo, mat));
  }
  addRoadsAndBridges(group);
  // Layered eroded mesas; every formation is original procedural geometry.
  function mesa(x: number, z: number, r: number, h: number) {
    const g = new T.Group();
    const shades = ["#9e654d", "#b57a50", "#c18a59", "#ac6c46", "#d29d66"];
    for (let j = 0; j < 5; j++) {
      const geo = new T.CylinderGeometry(
        r * (1 - j * 0.09),
        r * (1.09 - j * 0.09),
        h * 0.22,
        7,
        1,
      );
      const m = part(
        g,
        geo,
        shades[j],
        [0, h * (0.11 + j * 0.2), 0],
        [1, 1, 0.73],
      );
      m.rotation.y = j * 0.025;
    }
    at(g, x, z);
    return g;
  }
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2,
      rad = 570 + rng() * 100;
    mesa(
      Math.sin(a) * rad,
      Math.cos(a) * rad,
      23 + rng() * 32,
      26 + rng() * 48,
    );
  }
  for (const m of INTERIOR_MESAS) mesa(m.x, m.z, m.r, m.h);
  const vegetation = addVegetation(group);
  const expansion = addLandmarks(group);
  for (const o of OBSTACLES) {
    if (o.kind === "rock") {
      const g = new T.Group();
      part(
        g,
        lowSphere,
        "#94816a",
        [0, o.height * 0.4, 0],
        [o.r, o.height * 0.62, o.r * 0.82],
        true,
      );
      part(
        g,
        lowSphere,
        "#b19a72",
        [o.r * 0.35, o.height * 0.7, 0.2],
        [o.r * 0.7, o.height * 0.4, o.r * 0.6],
      );
      at(g, o.x, o.z);
    } else if (o.kind === "crate") {
      const g = new T.Group();
      part(
        g,
        box,
        "#9e784c",
        [0, o.height / 2, 0],
        [o.r * 1.4, o.height, o.r * 1.4],
        true,
      );
      for (const side of [-1, 1])
        part(
          g,
          box,
          "#5c5039",
          [side * o.r * 0.5, o.height / 2, o.r * 0.71],
          [0.12, o.height, 0.04],
        );
      at(g, o.x, o.z);
    }
  }
  const station = building("MERCY STATION", 8, 6);
  at(station, 39, -44);
  const store = building("DRY GOODS", 6, 5);
  store.rotation.y = -Math.PI / 2;
  at(store, 61, -27);
  for (let i = 0; i < 9; i++) {
    const f = new T.Group();
    part(f, box, P.wood, [0, 0.8, 0], [0.16, 1.6, 0.16]);
    part(f, box, P.wood, [1.5, 1.1, 0], [3.1, 0.12, 0.12]);
    part(f, box, P.wood, [1.5, 0.55, 0], [3.1, 0.12, 0.12]);
    at(f, 27 + i * 3.3, -50);
  }
  // Camp: bedrolls, handcart, ropes, wash line, and a warm central fire.
  at(tent(), -64, 57);
  at(tent("#9a9d7c"), -66, 33);
  at(tent("#b58458"), -48, 53);
  at(wagon(), -70, 40);
  at(wagon(), WAGON.x, WAGON.z).rotation.y = -0.4;
  const fire = new T.Group();
  at(fire, FIRE.x, FIRE.z);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    part(
      fire,
      lowSphere,
      "#655d4b",
      [Math.sin(a) * 0.85, 0.15, Math.cos(a) * 0.85],
      [0.3, 0.2, 0.3],
    );
  }
  for (let i = 0; i < 3; i++) {
    const log = part(
      fire,
      cylinder,
      "#503a2b",
      [0, 0.18, 0],
      [0.15, 1.4, 0.15],
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = i;
  }
  for (let i = 0; i < 5; i++) {
    const flame = new T.Mesh(
      cone,
      new T.MeshBasicNodeMaterial({
        color: i % 2 ? "#ffcc72" : "#f19243",
        transparent: true,
        opacity: 0.8,
      }),
    );
    flame.position.set((i - 2) * 0.16, 0.65, Math.sin(i) * 0.16);
    flame.scale.set(0.28, 0.9 + i * 0.1, 0.28);
    fire.add(flame);
  }
  for (const x of [-62, -56]) {
    const log = part(
      group,
      cylinder,
      P.wood,
      [x, groundHeight(x, 48) + 0.3, 48],
      [0.3, 2.3, 0.3],
    );
    log.rotation.z = Math.PI / 2;
  }
  const ada = human("ada"),
    trader = human("trader"),
    boss = human("boss");
  at(ada.root, ADA.x, ADA.z);
  at(trader.root, MERCHANT.x, MERCHANT.z);
  at(boss.root, BOSS.x, BOSS.z);
  ada.root.rotation.y = 1.3;
  trader.root.rotation.y = 1.2;
  boss.root.rotation.y = -1;
  const table = new T.Group();
  part(table, box, "#806749", [0, 0.9, 0], [2.3, 0.13, 1.1]);
  for (const x of [-1, 1])
    for (const z of [-0.4, 0.4])
      part(table, box, "#806749", [x, 0.45, z], [0.1, 0.9, 0.1]);
  for (let i = 0; i < 5; i++)
    part(
      table,
      cylinder,
      i % 2 ? P.blue : P.gold,
      [-0.7 + i * 0.35, 1.12, 0],
      [0.08, 0.28, 0.08],
    );
  at(table, -65, 40);
  const chest = new T.Group();
  part(chest, box, "#c3b284", [0, 0.5, 0], [1.5, 1, 1], true);
  part(chest, box, "#f0d3a3", [0, 1.03, 0], [1.6, 0.12, 1.1]);
  part(chest, box, P.red, [0, 1.1, 0], [0.7, 0.025, 0.2]);
  part(chest, box, P.red, [0, 1.1, 0], [0.2, 0.025, 0.7]);
  at(chest, CRATE.x, CRATE.z);
  const herbs = WILD_HERB.map((p) => {
    const g = new T.Group();
    for (let j = 0; j < 5; j++) {
      part(
        g,
        cone,
        "#6d8060",
        [(j - 2) * 0.18, 0.35, Math.sin(j) * 0.2],
        [0.25, 0.8, 0.25],
      );
      part(
        g,
        sphere,
        "#d2b174",
        [(j - 2) * 0.18, 0.75, Math.sin(j) * 0.2],
        [0.08, 0.1, 0.08],
      );
    }
    at(g, p.x, p.z);
    return g;
  });
  const grave = new T.Group();
  part(grave, box, "#aca58a", [0, 0.9, 0], [0.25, 1.8, 0.2], true);
  part(grave, box, "#aca58a", [0, 1.35, 0], [1.05, 0.22, 0.2]);
  at(grave, GRAVE.x, GRAVE.z);
  // Windmill visible above the station.
  const windmill = new T.Group();
  for (const side of [-1, 1]) {
    const leg = part(
      windmill,
      box,
      "#6e6750",
      [side * 1.1, 4, 0],
      [0.16, 8, 0.16],
    );
    leg.rotation.z = side * 0.12;
  }
  part(windmill, cylinder, "#5a6559", [0, 7, 0], [0.4, 0.8, 0.4]);
  at(windmill, 67, -43);
  const blades = new T.Group();
  blades.position.set(0, 8, 0.6);
  windmill.add(blades);
  blades.name = "windmill";
  for (let i = 0; i < 8; i++) {
    const blade = part(
      blades,
      box,
      "#b3b5a0",
      [Math.sin((i * Math.PI) / 4) * 1.1, Math.cos((i * Math.PI) / 4) * 1.1, 0],
      [0.5, 1.5, 0.08],
    );
    blade.rotation.z = (-i * Math.PI) / 4;
  }
  // Animated wildlife.
  const birds: T.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const g = new T.Group();
    for (const side of [-1, 1]) {
      const w = part(g, box, P.ink, [side * 0.37, 0, 0], [0.7, 0.04, 0.17]);
      w.rotation.z = side * 0.2;
    }
    g.position.set(Math.sin(i) * 32, 20 + i, Math.cos(i) * 35);
    group.add(g);
    birds.push(g);
  }
  const deer: T.Group[] = [];
  for (let i = 0; i < 20; i++) {
    const g = new T.Group();
    part(g, sphere, "#a58b60", [0, 0.9, 0], [0.32, 0.42, 0.7]);
    part(g, cone, "#9b8059", [0, 1.2, 0.5], [0.23, 0.8, 0.25]);
    part(g, sphere, "#bda57e", [0, 1.64, 0.65], [0.2, 0.24, 0.32]);
    for (const x of [-0.2, 0.2])
      for (const z of [-0.4, 0.4])
        part(g, cylinder, "#786449", [x, 0.4, z], [0.045, 0.8, 0.045]);
    const homes = [
      { x: 19, z: 31 },
      { x: -190, z: -220 },
      { x: -220, z: 165 },
      { x: 185, z: 210 },
      { x: 210, z: -160 },
    ];
    const home = homes[Math.floor(i / 4)],
      x = home.x + (i % 4) * 3,
      z = home.z + (i % 4) * 2;
    at(g, x, z);
    g.userData.home = { x, z };
    deer.push(g);
  }
  const targets: T.Group[] = [];
  for (let i = 0; i < 5; i++) {
    const g = new T.Group();
    part(g, box, P.wood, [0, 1, 0], [0.15, 2, 0.15]);
    const target = part(g, cylinder, "#e5c993", [0, 2, 0], [0.65, 0.1, 0.65]);
    target.rotation.x = Math.PI / 2;
    for (const [r, c] of [
      [0.45, P.red],
      [0.22, P.cream],
      [0.08, P.ink],
    ] as const) {
      const ring = part(
        g,
        cylinder,
        c,
        [0, 2, 0.07 + (1 - r) * 0.04],
        [r, 0.02, r],
      );
      ring.rotation.x = Math.PI / 2;
    }
    at(g, 70 + i * 5, 30 - (i % 2) * 5);
    targets.push(g);
  }
  const rangeSign = new T.Mesh(
    new T.PlaneGeometry(4, 1),
    new T.MeshBasicNodeMaterial({ map: labelTexture("THE PROVING GROUND") }),
  );
  at(rangeSign, 84, 49, 2.5);
  const sky = new T.Mesh(
    new T.SphereGeometry(1200, 32, 16),
    new T.MeshBasicNodeMaterial({ side: T.BackSide, depthWrite: false }),
  );
  const skyMat = sky.material as T.MeshBasicNodeMaterial;
  skyMat.colorNode = mix(
    color("#edbb86"),
    color("#627c7a"),
    positionWorld.y.div(280).clamp(0, 1),
  );
  sky.renderOrder = -10;
  group.add(sky);
  const sun = new T.Mesh(
    new T.SphereGeometry(60, 32, 24),
    new T.MeshBasicNodeMaterial({ color: "#ffe5ab", fog: false }),
  );
  sun.position.set(-420, 248, -720);
  group.add(sun);
  for (let i = 0; i < 48; i++) {
    const cloud = new T.Group();
    for (let j = 0; j < 5; j++)
      part(
        cloud,
        lowSphere,
        "#e6b891",
        [(j - 2) * 9, Math.sin(j) * 1.2, 0],
        [13, 2.2, 5],
      );
    cloud.position.set(
      (rng() - 0.5) * 1100,
      65 + rng() * 45,
      (rng() - 0.5) * 1100,
    );
    group.add(cloud);
  }
  return {
    group,
    ada,
    trader,
    boss,
    fire,
    herbs,
    chest,
    birds,
    deer,
    targets,
    sun,
    sky,
    vegetation,
    campfires: expansion.campfires,
    windmills: expansion.windmills,
  };
}
