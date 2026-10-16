import * as T from "three/webgpu";
import { attribute, dot, normalWorld, vec3 } from "three/tsl";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { groundHeight, random, riverX, terrainHeight } from "../engine/math";
import { OBSTACLES, TRAIL } from "../game/content";
import {
  FRONTIER_ROADS,
  LANDMARKS,
  MAP_HALF_EXTENT,
  RIVER_CROSSINGS,
  SCENERY_HALF_EXTENT,
  distanceToRoad,
  regionAt,
} from "../game/territory";
import {
  box,
  cone,
  cylinder,
  lowSphere,
  sphere,
  part,
  toon,
  labelTexture,
  PALETTE as P,
} from "./materials";
import { building, tent, wagon } from "./models";

export function addTerrain(group: T.Group) {
  const material = toon("#ffffff").clone();
  material.colorNode = attribute("color", "vec3").mul(
    dot(normalWorld, vec3(-0.45, 0.82, 0.36))
      .mul(0.5)
      .add(0.5)
      .mul(4)
      .floor()
      .div(4)
      .mul(0.5)
      .add(0.57),
  );
  const tiles = 8,
    size = (SCENERY_HALF_EXTENT * 2) / tiles;
  for (let iz = 0; iz < tiles; iz++)
    for (let ix = 0; ix < tiles; ix++) {
      const cx = -SCENERY_HALF_EXTENT + (ix + 0.5) * size,
        cz = -SCENERY_HALF_EXTENT + (iz + 0.5) * size;
      const geometry = new T.PlaneGeometry(size, size, 60, 60);
      geometry.rotateX(-Math.PI / 2);
      const p = geometry.attributes.position,
        colors: number[] = [];
      for (let i = 0; i < p.count; i++) {
        const x = cx + p.getX(i),
          z = cz + p.getZ(i);
        p.setY(i, terrainHeight(x, z));
        const patch =
            Math.sin(x * 0.11 + Math.sin(z * 0.07) * 3) * Math.cos(z * 0.08),
          region = regionAt(x, z);
        const tint =
          region === "WHISPERING PINES"
            ? patch > 0
              ? "#89936b"
              : "#b5aa79"
            : region === "SALTWIND FLATS"
              ? patch > 0
                ? "#d6c295"
                : "#c7b486"
              : region === "REDWASH CANYON"
                ? patch > 0
                  ? "#b4895b"
                  : "#c09b68"
                : patch > 0.35
                  ? "#ad975f"
                  : patch < -0.5
                    ? "#c49a68"
                    : "#c8a26c";
        const c = new T.Color(tint);
        colors.push(c.r, c.g, c.b);
      }
      geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const mesh = new T.Mesh(geometry, material);
      mesh.position.set(cx, 0, cz);
      mesh.name = `terrain:${ix}:${iz}`;
      group.add(mesh);
    }
}

export function addRoadsAndBridges(group: T.Group) {
  for (const route of [TRAIL, ...FRONTIER_ROADS]) {
    const curve = new T.CatmullRomCurve3(
      route.map((p) => new T.Vector3(p.x, 0, p.z)),
    );
    const points = curve.getPoints(Math.ceil(curve.getLength() * 2)),
      verts: number[] = [],
      ids: number[] = [];
    points.forEach((p, i) => {
      const direction = points[Math.min(i + 1, points.length - 1)]
        .clone()
        .sub(points[Math.max(0, i - 1)])
        .normalize();
      for (const sign of [-1, 1]) {
        const x = p.x + direction.z * sign * 2.6,
          z = p.z - direction.x * sign * 2.6;
        verts.push(x, groundHeight(x, z) + 0.065, z);
      }
      if (i < points.length - 1) {
        const n = i * 2;
        ids.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
    geo.setIndex(ids);
    geo.computeVertexNormals();
    group.add(new T.Mesh(geo, toon("#ddba7d")));
  }
  for (const b of RIVER_CROSSINGS) {
    const bridge = new T.Group();
    bridge.position.set(riverX(b.z), b.height - 0.65, b.z);
    bridge.name = b.id;
    group.add(bridge);
    for (let x = -b.halfLength; x < b.halfLength; x += 0.62)
      part(bridge, box, "#9a754c", [x, 0.5, 0], [0.57, 0.3, 6.5]);
    for (const z of [-3.15, 3.15]) {
      part(
        bridge,
        box,
        "#564c3a",
        [0, 1.65, z],
        [b.halfLength * 2, 0.14, 0.15],
      );
      for (let x = -b.halfLength + 1; x < b.halfLength; x += 3)
        part(bridge, box, P.wood, [x, 0.8, z], [0.2, 2.5, 0.22]);
    }
  }
}

/** A constant density across the expanded map; distance-cull whole instance cells. */
export function addVegetation(group: T.Group): T.Group[] {
  const rng = random(8173),
    tiles = 8,
    size = ((MAP_HALF_EXTENT + 35) * 2) / tiles,
    chunks: T.Group[] = [];
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
  const pineGeometry = mergeGeometries([
    new T.ConeGeometry(1.5, 3.4, 7).translate(0, 3, 0),
    new T.ConeGeometry(1.1, 2.9, 7).translate(0, 4.4, 0),
    new T.ConeGeometry(0.7, 2.4, 7).translate(0, 5.6, 0),
  ]);
  const cactusGeometry = mergeGeometries([
    cylinder.clone().scale(0.22, 2.8, 0.22).translate(0, 1.4, 0),
    box.clone().scale(1.25, 0.24, 0.25).translate(0, 1.3, 0),
    cylinder.clone().scale(0.14, 0.9, 0.14).translate(-0.6, 1.7, 0),
    cylinder.clone().scale(0.14, 1.3, 0.14).translate(0.6, 1.9, 0),
  ]);
  const matrix = new T.Matrix4(),
    q = new T.Quaternion(),
    scale = new T.Vector3();
  const allRoads = [TRAIL, ...FRONTIER_ROADS];
  const clear = (x: number, z: number) =>
    Math.abs(x - riverX(z)) > 7 &&
    distanceToRoad(x, z, allRoads) > 3.2 &&
    LANDMARKS.every((p) => Math.hypot(x - p.x, z - p.z) > 15) &&
    OBSTACLES.every((o) => Math.hypot(x - o.x, z - o.z) > o.r + 1) &&
    Math.hypot(x + 57, z - 46) > 13;
  for (let iz = 0; iz < tiles; iz++)
    for (let ix = 0; ix < tiles; ix++) {
      const cx = -MAP_HALF_EXTENT - 35 + (ix + 0.5) * size,
        cz = -MAP_HALF_EXTENT - 35 + (iz + 0.5) * size;
      const chunk = new T.Group();
      chunk.position.set(cx, 0, cz);
      chunk.name = `foliage:${ix}:${iz}`;
      chunk.userData.radius = size * 0.72;
      group.add(chunk);
      chunks.push(chunk);
      const grass = new T.InstancedMesh(grassGeo, grassMat, 1000),
        rocks = new T.InstancedMesh(lowSphere, toon("#a68b64"), 24),
        cacti = new T.InstancedMesh(cactusGeometry, toon(P.darkSage), 10),
        pines = new T.InstancedMesh(pineGeometry, toon("#47624e"), 20),
        trunks = new T.InstancedMesh(cylinder, toon("#6b6048"), 20),
        crowns = new T.InstancedMesh(lowSphere, toon("#8c9761"), 20);
      const place = (
        mesh: T.InstancedMesh,
        index: number,
        x: number,
        z: number,
        sx: number,
        sy: number,
        sz: number,
        y = 0,
        yaw = 0,
      ) => {
        q.setFromAxisAngle(new T.Vector3(0, 1, 0), yaw);
        matrix.compose(
          new T.Vector3(x - cx, groundHeight(x, z) + y, z - cz),
          q,
          scale.set(sx, sy, sz),
        );
        mesh.setMatrixAt(index, matrix);
      };
      let ng = 0,
        nr = 0,
        nc = 0,
        np = 0,
        nt = 0,
        nl = 0;
      for (let i = 0; i < 1000; i++) {
        const x = cx + (rng() - 0.5) * size,
          z = cz + (rng() - 0.5) * size;
        if (!clear(x, z)) continue;
        const s = 0.4 + rng() * 1.3;
        place(grass, ng++, x, z, s, s, s, 0, rng() * 7);
      }
      for (let i = 0; i < 24; i++) {
        const x = cx + (rng() - 0.5) * size,
          z = cz + (rng() - 0.5) * size;
        if (!clear(x, z)) continue;
        const s = 0.25 + rng() * 1.4;
        place(rocks, nr++, x, z, s, s * 0.6, s * 0.8, s * 0.25);
      }
      for (let i = 0; i < 20; i++) {
        const x = cx + (rng() - 0.5) * size,
          z = cz + (rng() - 0.5) * size;
        if (!clear(x, z)) continue;
        const forest = regionAt(x, z) === "WHISPERING PINES",
          riverside = Math.abs(x - riverX(z)) < 32;
        const s = 0.7 + rng() * 0.7;
        if (forest) {
          place(pines, np++, x, z, s, s, s);
          place(trunks, nt++, x, z, 0.2 * s, 3.5 * s, 0.2 * s, 1.75 * s);
        } else if (riverside) {
          place(crowns, nl++, x, z, 2.4 * s, 1.3 * s, 2.1 * s, 4 * s);
          place(trunks, nt++, x, z, 0.23 * s, 4 * s, 0.23 * s, 2 * s);
        } else if (nc < 10) place(cacti, nc++, x, z, s, s, s, 0, rng() * 7);
      }
      for (const [mesh, count] of [
        [grass, ng],
        [rocks, nr],
        [cacti, nc],
        [pines, np],
        [trunks, nt],
        [crowns, nl],
      ] as const) {
        mesh.count = count;
        mesh.computeBoundingSphere();
        if (count) chunk.add(mesh);
      }
    }
  return chunks;
}

export function addLandmarks(group: T.Group) {
  const campfires: T.Group[] = [],
    windmills: T.Group[] = [];
  for (const l of LANDMARKS) {
    const g = new T.Group();
    g.position.set(l.x, groundHeight(l.x, l.z), l.z);
    g.name = `landmark:${l.id}`;
    group.add(g);
    const at = (o: T.Object3D, x: number, z: number) => {
      o.position.set(x, groundHeight(l.x + x, l.z + z) - g.position.y, z);
      g.add(o);
      return o;
    };
    // The journal destination and interaction point stay in front of the structures.
    for (const x of [-1.5, 1.5])
      part(g, box, "#67533e", [x, 1.35, 2], [0.12, 2.7, 0.14]);
    const sign = new T.Mesh(
      new T.PlaneGeometry(3.6, 0.9),
      new T.MeshBasicNodeMaterial({ map: labelTexture(l.name.toUpperCase()) }),
    );
    sign.position.set(0, 2.15, 2.05);
    g.add(sign);
    if (l.kind === "camp") {
      at(tent(l.id === "pine-watch" ? "#8d9878" : "#bf9866"), 0, -8);
      at(wagon(), 8, -5).rotation.y = 0.7;
      const fire = new T.Group();
      g.add(fire);
      campfires.push(fire);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        part(
          fire,
          lowSphere,
          "#726954",
          [Math.sin(a) * 0.85, 0.15, Math.cos(a) * 0.85],
          [0.28, 0.2, 0.28],
        );
      }
      for (let i = 0; i < 4; i++) {
        const flame = part(
          fire,
          cone,
          "#f9b55c",
          [(i - 1.5) * 0.15, 0.6, 0],
          [0.23, 0.8, 0.23],
        );
        flame.userData.flame = true;
      }
      part(g, box, P.wood, [-4, 0.25, -1], [3, 0.5, 0.7]);
    } else if (l.kind === "station") {
      at(building("SUNDOWN RELAY", 9, 6), 0, -8);
      for (let i = 0; i < 5; i++) {
        const x = -12 - i * 9,
          z = -2 + i * 4;
        part(g, cylinder, "#64503b", [x, 3.5, z], [0.15, 7, 0.15]);
        part(g, box, "#67533e", [x, 6.2, z], [2.7, 0.16, 0.16]);
        if (i < 4) {
          const wire = part(
            g,
            box,
            "#414b3c",
            [x - 4.5, 6.6, z + 2],
            [0.035, 0.035, Math.hypot(9, 4)],
          );
          wire.rotation.y = Math.atan2(-9, 4);
        }
      }
      at(wagon(), 10, -5);
    } else if (l.kind === "mine") {
      part(g, lowSphere, "#a0714b", [0, 4, -14], [11, 8, 8], true);
      part(g, box, "#27332c", [0, 2.5, -7.5], [5.5, 5, 0.15]);
      for (const x of [-3, 3])
        part(g, box, P.wood, [x, 2.5, -7], [0.5, 5, 0.5]);
      part(g, box, P.wood, [0, 5, -7], [6.7, 0.5, 0.5]);
      for (const x of [-0.7, 0.7])
        part(g, box, "#4d534b", [x, 0.12, -1], [0.08, 0.1, 11]);
      for (let z = -6; z < 5; z += 1)
        part(g, box, P.wood, [0, 0.07, z], [2.3, 0.12, 0.18]);
      at(wagon(), 6, -2).scale.setScalar(0.65);
    } else if (l.kind === "arch") {
      for (const x of [-12, 12]) {
        const base = groundHeight(l.x + x, l.z - 5) - g.position.y;
        part(
          g,
          new T.CylinderGeometry(3.6, 5.3, 18, 7),
          "#a96943",
          [x, base + 8.5, -5],
          [1, 1, 1],
          true,
        );
        part(g, lowSphere, "#c18a56", [x * 0.8, base + 17, -5], [7, 4, 5]);
      }
      part(g, lowSphere, "#bc8051", [0, 19, -5], [14, 3.5, 5], true);
    } else if (l.kind === "lookout") {
      for (const x of [-3, 3])
        for (const z of [-12, -6])
          part(g, box, P.wood, [x, 3.1, z], [0.28, 8.2, 0.28]);
      part(g, box, "#8b7250", [0, 5.2, -9], [7, 0.3, 7]);
      part(g, box, "#675e48", [0, 7.2, -9], [8, 0.3, 8]);
      for (const x of [-3.3, 3.3])
        part(g, box, P.wood, [x, 6.2, -9], [0.15, 0.2, 7]);
      for (const x of [-0.84, 0.84]) {
        const rail = part(g, box, P.wood, [x, 2.6, -5.2], [0.12, 5.2, 0.14]);
        rail.rotation.x = -Math.atan2(2.4, 4);
      }
      for (let i = 0; i < 9; i++)
        part(
          g,
          box,
          P.wood,
          [0, 0.6 + i * 0.5, -4 - i * 0.3],
          [1.6, 0.15, 0.2],
        );
    } else if (l.kind === "windmill") {
      for (const x of [-2, 2])
        for (const z of [-10, -6])
          part(g, box, P.wood, [x, 4, z], [0.25, 8, 0.25]);
      part(g, cylinder, "#8c7650", [0, 7.5, -8], [3, 3, 3], true);
      part(g, cylinder, P.wood, [0, 10.5, -8], [0.14, 5, 0.14]);
      const rotor = new T.Group();
      rotor.position.set(0, 12, -8);
      g.add(rotor);
      windmills.push(rotor);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          b = part(
            rotor,
            box,
            "#b8bdad",
            [Math.sin(a) * 1.7, Math.cos(a) * 1.7, 0],
            [0.65, 2, 0.08],
          );
        b.rotation.z = -a;
      }
      part(g, box, P.wood, [5, 0.4, -3], [2, 0.8, 3]);
    } else if (l.kind === "crossing") {
      part(g, box, "#94754e", [7, 0.5, 0], [10, 0.2, 4]);
      for (const x of [3, 11])
        for (const z of [-2, 2])
          part(g, cylinder, P.wood, [x, 0.8, z], [0.12, 2.5, 0.12]);
      at(wagon(), -8, -5);
    }
  }
  return { campfires, windmills };
}
