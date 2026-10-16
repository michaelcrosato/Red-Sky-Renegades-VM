import * as T from "three/webgpu";
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
}
export function makeWorld(): World {
  const group = new T.Group(),
    rng = random(8173),
    at = (o: T.Object3D, x: number, z: number, y = 0) => {
      o.position.set(x, groundHeight(x, z) + y, z);
      group.add(o);
      return o;
    };
  const terrain = new T.PlaneGeometry(650, 650, 180, 180);
  terrain.rotateX(-Math.PI / 2);
  const pos = terrain.attributes.position,
    colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
    const patch =
      Math.sin(x * 0.11 + Math.sin(z * 0.07) * 3) * Math.cos(z * 0.08);
    const c = new T.Color(
      patch > 0.35 ? "#ad975f" : patch < -0.5 ? "#c49a68" : "#c8a26c",
    );
    colors.push(c.r, c.g, c.b);
  }
  terrain.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  terrain.computeVertexNormals();
  const tm = toon("#ffffff").clone();
  tm.colorNode = attribute("color", "vec3").mul(
    dot(normalWorld, vec3(-0.45, 0.82, 0.36))
      .mul(0.5)
      .add(0.5)
      .mul(4)
      .floor()
      .div(4)
      .mul(0.5)
      .add(0.57),
  );
  group.add(new T.Mesh(terrain, tm));
  // A continuous river ribbon and foam on the shallow banks.
  for (const [width, mat, y] of [
    [10, waterMaterial(), -0.9],
    [13, toon("#889a86"), -1.2],
  ] as const) {
    const verts: number[] = [],
      ids: number[] = [];
    for (let i = 0; i <= 180; i++) {
      const z = -325 + (i * 650) / 180,
        x = riverX(z);
      verts.push(x - width / 2, y, z, x + width / 2, y, z);
      if (i < 180) {
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
  // Wagon road, built from a content spline.
  const curve = new T.CatmullRomCurve3(
      TRAIL.map((p) => new T.Vector3(p.x, 0, p.z)),
    ),
    points = curve.getPoints(180),
    rv: number[] = [],
    ri: number[] = [];
  points.forEach((p, i) => {
    const d = points[Math.min(i + 1, points.length - 1)]
      .clone()
      .sub(points[Math.max(0, i - 1)])
      .normalize();
    for (const side of [-1, 1]) {
      const x = p.x + d.z * side * 2.6,
        z = p.z - d.x * side * 2.6;
      rv.push(x, terrainHeight(x, z) + 0.055, z);
    }
    if (i < points.length - 1) {
      let n = i * 2;
      ri.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  });
  const road = new T.BufferGeometry();
  road.setAttribute("position", new T.Float32BufferAttribute(rv, 3));
  road.setIndex(ri);
  road.computeVertexNormals();
  group.add(new T.Mesh(road, toon("#ddba7d")));
  const bridge = new T.Group();
  bridge.position.set(riverX(6), 0, 6);
  group.add(bridge);
  for (let x = -10; x < 10; x += 0.62)
    part(
      bridge,
      box,
      x % 2 ? "#93704b" : "#9f7c50",
      [x, 0.5, 0],
      [0.57, 0.3, 6.5],
    );
  for (const z of [-3.15, 3.15]) {
    part(bridge, box, "#564c3a", [0, 1.65, z], [20, 0.14, 0.15]);
    for (let x = -9; x <= 9; x += 3)
      part(bridge, box, P.wood, [x, 0.8, z], [0.2, 2.5, 0.22]);
  }
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
      rad = 150 + rng() * 85;
    mesa(
      Math.sin(a) * rad,
      Math.cos(a) * rad,
      14 + rng() * 27,
      15 + rng() * 36,
    );
  }
  mesa(91, -60, 17, 36);
  mesa(101, -80, 12, 49);
  mesa(-91, -62, 15, 29);
  mesa(65, -105, 21, 27);
  mesa(-93, 93, 22, 32);
  // Scenic scattered rock, brush, cactus, and windswept grass.
  const rockInst = new T.InstancedMesh(lowSphere, toon("#a68b64"), 180);
  const matrix = new T.Matrix4(),
    q = new T.Quaternion(),
    scale = new T.Vector3();
  for (let i = 0; i < 180; i++) {
    const x = (rng() - 0.5) * 260,
      z = (rng() - 0.5) * 260,
      s = 0.25 + rng() * 1.4;
    matrix.compose(
      new T.Vector3(x, terrainHeight(x, z) + s * 0.25, z),
      q,
      scale.set(s, s * 0.6, s * 0.8),
    );
    rockInst.setMatrixAt(i, matrix);
  }
  group.add(rockInst);
  const grassGeo = new T.BufferGeometry();
  grassGeo.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [
        -0.25, 0, 0, 0.08, 0.8, 0, 0.22, 0, 0, 0, 0, -0.24, 0, 0.58, 0.08, 0, 0,
        0.24, -0.14, 0, -0.14, 0.15, 0.62, 0.15, 0.14, 0, 0.14,
      ],
      3,
    ),
  );
  grassGeo.computeVertexNormals();
  const grassMat = toon("#898450", true).clone();
  grassMat.side = T.DoubleSide;
  const grass = new T.InstancedMesh(grassGeo, grassMat, 6500);
  let grassIndex = 0;
  for (let i = 0; i < 6500; i++) {
    const x = (rng() - 0.5) * 280,
      z = (rng() - 0.5) * 280;
    if (Math.abs(x - riverX(z)) < 7) continue;
    const s = 0.4 + rng() * 1.3;
    matrix.compose(
      new T.Vector3(x, terrainHeight(x, z), z),
      new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), rng() * 7),
      scale.set(s, s, s),
    );
    grass.setMatrixAt(grassIndex++, matrix);
  }
  grass.count = grassIndex;
  group.add(grass);
  for (let i = 0; i < 55; i++) {
    const x = (rng() - 0.5) * 210,
      z = (rng() - 0.5) * 210;
    if (
      Math.abs(x - riverX(z)) < 12 ||
      TRAIL.some((p) => Math.hypot(p.x - x, p.z - z) < 6)
    )
      continue;
    const g = new T.Group(),
      h = 1.6 + rng() * 2.4;
    part(g, cylinder, P.darkSage, [0, h / 2, 0], [0.2, h, 0.2]);
    part(g, sphere, P.darkSage, [0, h, 0], [0.2, 0.23, 0.2]);
    for (const side of [-1, 1]) {
      const y = h * (side === 1 ? 0.6 : 0.38);
      part(g, box, P.darkSage, [side * 0.35, y, 0], [0.65, 0.24, 0.25]);
      part(
        g,
        cylinder,
        P.darkSage,
        [side * 0.65, y + 0.35, 0],
        [0.14, 0.8, 0.14],
      );
      part(
        g,
        sphere,
        P.darkSage,
        [side * 0.65, y + 0.75, 0],
        [0.14, 0.15, 0.14],
      );
    }
    at(g, x, z);
  }
  for (let i = 0; i < 20; i++) {
    const z = (rng() - 0.5) * 200,
      x = riverX(z) + (rng() > 0.5 ? 1 : -1) * (10 + rng() * 7);
    const g = new T.Group();
    const trunk = part(g, cylinder, "#64543c", [0, 2.5, 0], [0.25, 5, 0.25]);
    trunk.rotation.z = 0.1;
    for (let j = 0; j < 5; j++)
      part(
        g,
        lowSphere,
        j % 2 ? "#78824e" : "#9b9c60",
        [(rng() - 0.5) * 3, 4 + rng() * 1.4, (rng() - 0.5) * 3],
        [1.5 + rng(), 0.8 + rng() * 0.6, 1.4 + rng()],
      );
    at(g, x, z);
  }
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
  for (let i = 0; i < 4; i++) {
    const g = new T.Group();
    part(g, sphere, "#a58b60", [0, 0.9, 0], [0.32, 0.42, 0.7]);
    part(g, cone, "#9b8059", [0, 1.2, 0.5], [0.23, 0.8, 0.25]);
    part(g, sphere, "#bda57e", [0, 1.64, 0.65], [0.2, 0.24, 0.32]);
    for (const x of [-0.2, 0.2])
      for (const z of [-0.4, 0.4])
        part(g, cylinder, "#786449", [x, 0.4, z], [0.045, 0.8, 0.045]);
    at(g, 19 + i * 3, 31 + i * 2);
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
    new T.SphereGeometry(480, 32, 16),
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
    new T.SphereGeometry(15, 32, 24),
    new T.MeshBasicNodeMaterial({ color: "#ffe5ab", fog: false }),
  );
  sun.position.set(-105, 62, -180);
  group.add(sun);
  for (let i = 0; i < 14; i++) {
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
      (rng() - 0.5) * 380,
      45 + rng() * 35,
      -100 - rng() * 160,
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
  };
}
