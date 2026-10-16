import * as T from "three/webgpu";
import {
  PALETTE as P,
  part,
  box,
  sphere,
  lowSphere,
  cylinder,
  cone,
  shadow,
  toon,
  labelTexture,
} from "./materials";

export interface HumanRig {
  root: T.Group;
  body: T.Group;
  legs: T.Group[];
  arms: T.Group[];
  head: T.Group;
  gun: T.Group;
  poncho: T.Mesh;
}
export function human(
  kind: "player" | "enemy" | "ada" | "trader" | "boss" = "player",
  tint?: string,
): HumanRig {
  const root = new T.Group(),
    body = new T.Group();
  root.add(body);
  const isPlayer = kind === "player",
    ada = kind === "ada";
  const coat =
    tint ??
    (isPlayer
      ? "#405553"
      : ada
        ? "#b67c4c"
        : kind === "trader"
          ? "#879080"
          : kind === "boss"
            ? "#875b47"
            : "#865145");
  const legs: T.Group[] = [],
    arms: T.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(side * 0.16, 0.86, 0);
    body.add(leg);
    part(leg, box, "#333c3b", [0, -0.3, 0], [0.24, 0.61, 0.27], true);
    part(leg, box, P.leather, [0, -0.69, 0.07], [0.27, 0.25, 0.4], true);
    legs.push(leg);
    const arm = new T.Group();
    arm.position.set(side * 0.36, 1.43, 0);
    body.add(arm);
    part(arm, box, coat, [side * 0.015, -0.26, 0], [0.22, 0.52, 0.26], true);
    part(arm, box, P.skin, [side * 0.015, -0.54, 0.015], [0.17, 0.18, 0.18]);
    arms.push(arm);
  }
  part(body, box, "#3d4240", [0, 0.9, 0], [0.5, 0.2, 0.33], true);
  part(body, box, coat, [0, 1.23, 0], [0.61, 0.59, 0.39], true);
  part(body, box, P.leather, [0, 0.99, 0.015], [0.66, 0.09, 0.44]);
  part(body, box, P.gold, [0, 0.99, 0.25], [0.11, 0.1, 0.03]);
  part(body, box, P.leather, [0.33, 0.85, 0.02], [0.15, 0.3, 0.16]);
  const poncho = part(
    body,
    new T.CylinderGeometry(0.35, 0.51, 0.53, 4, 1, true),
    isPlayer ? "#b17a4c" : coat,
    [0, 1.37, 0],
    [1, 1, 0.85],
    true,
  );
  poncho.rotation.y = Math.PI / 4;
  if (isPlayer) {
    for (let i = 0; i < 6; i++)
      part(
        body,
        box,
        P.cream,
        [-0.29 + i * 0.11, 1.18, 0.325],
        [0.04, 0.05, 0.025],
      );
    part(body, box, P.red, [0, 1.49, 0.27], [0.58, 0.06, 0.04]);
  }
  const head = new T.Group();
  head.position.y = 1.61;
  body.add(head);
  part(head, box, P.skin, [0, 0.14, 0], [0.34, 0.38, 0.32], true);
  part(head, box, "#45362c", [0, 0.24, -0.1], [0.36, 0.23, 0.17]);
  part(head, box, P.skin, [0, 0.13, 0.185], [0.08, 0.11, 0.09]);
  part(head, box, P.ink, [-0.09, 0.18, 0.167], [0.04, 0.035, 0.015]);
  part(head, box, P.ink, [0.09, 0.18, 0.167], [0.04, 0.035, 0.015]);
  part(
    head,
    box,
    isPlayer ? P.red : "#9a7c56",
    [0, -0.04, 0.055],
    [0.37, 0.1, 0.35],
  );
  if (!ada) {
    part(
      head,
      cylinder,
      isPlayer ? "#323b37" : "#6c5038",
      [0, 0.35, 0],
      [0.43, 0.065, 0.36],
      true,
    );
    part(
      head,
      cylinder,
      isPlayer ? "#4d5748" : "#6c5038",
      [0, 0.48, -0.025],
      [0.26, 0.24, 0.23],
      true,
    );
    part(head, cylinder, P.leather, [0, 0.405, -0.025], [0.265, 0.06, 0.235]);
  } else {
    part(head, sphere, "#49372b", [0, 0.28, -0.1], [0.22, 0.25, 0.2]);
    part(head, sphere, "#49372b", [0, 0.1, -0.25], [0.16, 0.18, 0.16]);
  }
  const gun = new T.Group();
  gun.position.set(0, -0.55, 0.03);
  arms[1].add(gun);
  part(gun, box, "#293638", [0, 0.04, 0.23], [0.1, 0.11, 0.43], true);
  part(gun, box, P.leather, [0, -0.07, 0.055], [0.1, 0.19, 0.12]);
  if (ada || kind === "trader") gun.visible = false;
  shadow(root, 0.8, 0.48);
  return { root, body, legs, arms, head, gun, poncho };
}
export function animateHuman(
  r: HumanRig,
  phase: number,
  speed: number,
  mounted: boolean,
  aiming: boolean,
  dead: boolean,
) {
  r.body.rotation.z = dead ? 1.5 : 0;
  r.body.position.y = dead
    ? 0.35
    : mounted
      ? 1.55
      : Math.sin(phase * 2) * 0.025 * Math.min(speed, 1);
  r.legs.forEach((leg, i) => {
    leg.rotation.x = mounted
      ? -0.95
      : Math.sin(phase + i * Math.PI) * Math.min(speed * 0.16, 0.65);
    leg.rotation.z = mounted ? (i === 0 ? 0.33 : -0.33) : 0;
  });
  r.arms.forEach((arm, i) => {
    arm.rotation.x = aiming
      ? -1.38
      : mounted
        ? -0.58
        : Math.sin(phase + i * Math.PI + Math.PI) * Math.min(speed * 0.12, 0.5);
    arm.rotation.z = aiming ? (i === 0 ? -0.4 : 0.08) : 0;
  });
  r.gun.rotation.x = aiming ? 1.38 : 0;
  r.poncho.rotation.x = Math.sin(phase) * Math.min(speed * 0.007, 0.07);
}
export interface HorseRig {
  root: T.Group;
  body: T.Group;
  legs: T.Group[];
  neck: T.Group;
  tail: T.Group;
}
export function horse(): HorseRig {
  const root = new T.Group(),
    body = new T.Group();
  root.add(body);
  const hide = "#a6744e",
    legs: T.Group[] = [];
  part(body, sphere, hide, [0, 1.5, 0], [0.52, 0.66, 1.12], true);
  part(body, sphere, "#996340", [0, 1.4, -0.76], [0.52, 0.58, 0.54]);
  const neck = new T.Group();
  neck.position.set(0, 1.65, 0.72);
  body.add(neck);
  neck.rotation.x = -0.28;
  part(neck, sphere, hide, [0, 0.38, 0.08], [0.31, 0.65, 0.36], true);
  part(neck, sphere, hide, [0, 0.88, 0.3], [0.28, 0.32, 0.53], true);
  part(neck, box, "#d5b184", [0, 0.8, 0.68], [0.43, 0.31, 0.27], true);
  part(neck, box, "#e2c49a", [0, 1, 0.55], [0.1, 0.25, 0.14]);
  for (const side of [-1, 1]) {
    part(neck, cone, hide, [side * 0.18, 1.24, 0.14], [0.1, 0.38, 0.12]);
    part(neck, sphere, P.ink, [side * 0.268, 0.98, 0.4], [0.045, 0.05, 0.045]);
    part(neck, box, P.leather, [side * 0.285, 0.89, 0.28], [0.025, 0.12, 0.6]);
  }
  for (let i = 0; i < 7; i++)
    part(neck, box, "#40362d", [0, 0.05 + i * 0.14, -0.25], [0.18, 0.18, 0.19]);
  for (const x of [-0.34, 0.34])
    for (const z of [-0.7, 0.66]) {
      const leg = new T.Group();
      leg.position.set(x, 1.22, z);
      body.add(leg);
      part(leg, cylinder, hide, [0, -0.37, 0], [0.105, 0.8, 0.105], true);
      part(leg, box, "#493b30", [0, -0.93, 0.04], [0.2, 0.32, 0.27], true);
      legs.push(leg);
    }
  part(body, box, P.red, [0, 1.99, -0.12], [0.88, 0.1, 0.88], true);
  part(body, box, P.leather, [0, 2.08, -0.14], [0.57, 0.13, 0.67], true);
  part(body, box, "#473b30", [0, 2.22, -0.48], [0.58, 0.25, 0.12]);
  part(body, box, P.cream, [0, 2.12, -0.79], [0.66, 0.22, 0.25], true);
  for (const side of [-1, 1]) {
    part(
      body,
      box,
      P.leather,
      [side * 0.49, 1.58, -0.5],
      [0.22, 0.48, 0.49],
      true,
    );
    part(body, box, P.gold, [side * 0.61, 1.58, -0.49], [0.025, 0.1, 0.1]);
  }
  const tail = new T.Group();
  tail.position.set(0, 1.75, -1.02);
  body.add(tail);
  part(tail, cone, "#43372d", [0, -0.45, -0.14], [0.19, 0.9, 0.22]);
  tail.rotation.x = 0.4;
  shadow(root, 1, 1.5);
  return { root, body, legs, neck, tail };
}
export function animateHorse(r: HorseRig, phase: number, speed: number) {
  const gallop = speed > 10;
  r.body.position.y = Math.sin(phase * 2) * Math.min(speed * 0.007, 0.1);
  r.legs.forEach((l, i) => {
    l.rotation.x =
      Math.sin(
        phase + (gallop ? (i % 2) * 0.8 : i === 0 || i === 3 ? 0 : Math.PI),
      ) * Math.min(speed * 0.06, 0.7);
  });
  r.neck.rotation.x = -0.28 + Math.sin(phase) * Math.min(speed * 0.008, 0.1);
  r.tail.rotation.z = Math.sin(phase * 0.6) * 0.16;
}
export function building(name: string, width = 8, depth = 6) {
  const g = new T.Group();
  part(g, box, "#936f4b", [0, 2, 0], [width, 4, depth], true);
  for (let y = 0.25; y < 4; y += 0.38)
    part(g, box, "#70553e", [0, y, depth / 2 + 0.025], [width, 0.035, 0.035]);
  part(g, box, "#524a3b", [0, 4.13, 0], [width + 0.7, 0.25, depth + 0.6], true);
  part(
    g,
    box,
    "#ac8a57",
    [0, 4.3, depth / 2 - 0.2],
    [width + 0.3, 1.6, 0.3],
    true,
  );
  for (const x of [-width * 0.31, width * 0.31]) {
    part(g, box, "#293d3f", [x, 2.1, depth / 2 + 0.07], [1.3, 1.55, 0.07]);
    part(g, box, "#c4a376", [x, 2.1, depth / 2 + 0.12], [1.4, 0.07, 0.1]);
    part(g, box, "#c4a376", [x, 2.1, depth / 2 + 0.12], [0.07, 1.6, 0.1]);
  }
  part(g, box, "#3f3d31", [0, 1.3, depth / 2 + 0.1], [1.45, 2.6, 0.12]);
  part(g, box, P.gold, [0.45, 1.25, depth / 2 + 0.18], [0.08, 0.08, 0.08]);
  part(
    g,
    box,
    "#836b49",
    [0, 0.17, depth / 2 + 1],
    [width + 0.6, 0.3, 2.2],
    true,
  );
  for (const x of [-width * 0.48, width * 0.48])
    part(g, cylinder, "#4d4839", [x, 1.7, depth / 2 + 1.8], [0.1, 3.4, 0.1]);
  part(g, box, "#6a6046", [0, 3.6, depth / 2 + 1], [width + 0.7, 0.18, 2.5]);
  const sign = new T.Mesh(
    new T.PlaneGeometry(width * 0.86, 1),
    new T.MeshBasicNodeMaterial({ map: labelTexture(name) }),
  );
  sign.position.set(0, 4.5, depth / 2 + 0.01);
  g.add(sign);
  return g;
}
export function tent(color = "#cfb17c") {
  const g = new T.Group();
  const geo = new T.CylinderGeometry(0, 2.4, 3, 3, 1);
  geo.rotateY(Math.PI / 6);
  part(g, geo, color, [0, 1.5, 0], [1, 1, 1.5], true);
  part(g, box, "#3d4038", [0, 0.85, 1.7], [0.7, 1.65, 0.05]);
  for (const z of [-2.7, 2.7])
    part(g, cylinder, P.wood, [0, 1.7, z], [0.06, 3.4, 0.06]);
  return g;
}
export function wagon() {
  const g = new T.Group();
  part(g, box, P.wood, [0, 1, 0], [2.1, 0.35, 3.4], true);
  for (const x of [-1.08, 1.08]) {
    part(g, box, "#a17a4e", [x, 1.5, 0], [0.14, 0.8, 3.5], true);
    for (const z of [-1.05, 1.05]) {
      const w = part(
        g,
        new T.TorusGeometry(0.65, 0.065, 5, 12),
        P.ink,
        [x, 0.7, z],
        [1, 1, 1],
      );
      w.rotation.y = Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        const s = part(w, box, "#63503a", [0, 0, 0], [0.055, 1.26, 0.055]);
        s.rotation.z = (i * Math.PI) / 3;
      }
    }
  }
  part(g, box, P.wood, [0, 1.4, -1.65], [2.2, 0.7, 0.13]);
  return g;
}
