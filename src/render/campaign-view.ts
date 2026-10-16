import * as T from "three/webgpu";
import { groundHeight, distance } from "../engine/math";
import type { GameState } from "../engine/types";
import { ENEMY_FAMILIES, HUBS, RARITIES } from "../game/campaign/catalog";
import { human, animateHuman, wagon, type HumanRig } from "./models";
import {
  box,
  cone,
  cylinder,
  sphere,
  lowSphere,
  part,
  toon,
  labelTexture,
  shadow,
  PALETTE,
} from "./materials";
import type { CampaignObject, GroundLoot } from "../engine/campaign/types";

const diamond = new T.OctahedronGeometry(0.2),
  disc = new T.CircleGeometry(1, 32),
  ring = new T.RingGeometry(0.87, 1, 40);
const hazardWarn = new T.MeshBasicNodeMaterial({
  color: "#f1ca65",
  transparent: true,
  opacity: 0.65,
  side: T.DoubleSide,
  depthWrite: false,
});
const hazardHot = new T.MeshBasicNodeMaterial({
  color: "#c94b32",
  transparent: true,
  opacity: 0.65,
  side: T.DoubleSide,
  depthWrite: false,
});
const hazardFill = new T.MeshBasicNodeMaterial({
  color: "#c94731",
  transparent: true,
  opacity: 0.12,
  side: T.DoubleSide,
  depthWrite: false,
});
const beamMaterials = Object.fromEntries(
  Object.entries(RARITIES).map(([id, r]) => [
    id,
    new T.MeshBasicNodeMaterial({
      color: r.color,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    }),
  ]),
);
const gemMaterials = Object.fromEntries(
  Object.entries(RARITIES).map(([id, r]) => [
    id,
    new T.MeshBasicNodeMaterial({ color: r.color }),
  ]),
);
const eliteMaterial = new T.MeshBasicNodeMaterial({ color: "#e6bf6c" });
const objectShadowMaterial = new T.MeshBasicNodeMaterial({
  color: "#292b2b",
  transparent: true,
  opacity: 0.23,
  depthWrite: false,
});
const wagonTemplate = wagon();
function disposeRig(rig: HumanRig) {
  rig.poncho.geometry.dispose();
  for (const child of rig.root.children)
    if (child instanceof T.Mesh && child.geometry.type === "CircleGeometry") {
      child.geometry.dispose();
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of materials) material.dispose();
    }
}

export function addCampaignHubs(group: T.Group) {
  for (const hub of HUBS) {
    const g = new T.Group();
    g.position.set(hub.x, groundHeight(hub.x, hub.z), hub.z);
    g.name = `hub:${hub.id}`;
    group.add(g);
    for (const x of [-1.6, 1.6])
      part(g, box, "#67513a", [x, 1.6, 0], [0.18, 3.2, 0.18]);
    part(g, box, "#776044", [0, 2, 0], [3.6, 2.2, 0.18], true);
    const title = new T.Mesh(
      new T.PlaneGeometry(3.15, 0.55),
      new T.MeshBasicNodeMaterial({ map: labelTexture("DISPATCH & BOUNTIES") }),
    );
    title.position.set(0, 2.65, 0.11);
    g.add(title);
    for (let i = 0; i < 3; i++) {
      const paper = part(
        g,
        box,
        i === 1 ? "#e3c990" : "#e9d8b1",
        [-1.05 + i * 1.05, 1.7, 0.13],
        [0.8, 1.05, 0.025],
      );
      paper.rotation.z = (i - 1) * 0.04;
      part(
        g,
        diamond,
        "#7b5035",
        [-1.05 + i * 1.05, 1.8, 0.17],
        [0.7, 0.7, 0.15],
      );
    }
    part(g, diamond, "#e9bd72", [0, 3.65, 0], [1.3, 1.3, 1.3]);
  }
}

interface EnemyView {
  rig: HumanRig;
  badge: T.Mesh;
  family: string;
}
export class CampaignView {
  private enemies = new Map<string, EnemyView>();
  private pool: EnemyView[] = [];
  private objects = new Map<string, { root: T.Group; rig?: HumanRig }>();
  private drops = new Map<string, T.Group>();
  private hazards = new Map<string, T.Group>();
  private root = new T.Group();
  constructor(scene: T.Scene) {
    scene.add(this.root);
  }
  private enemy(family: string) {
    let index = this.pool.findIndex((v) => v.family === family);
    if (index < 0 && this.pool.length) index = 0;
    if (index >= 0) {
      const view = this.pool.splice(index, 1)[0];
      if (view.family !== family) {
        const old = toon(
            ENEMY_FAMILIES[view.family as keyof typeof ENEMY_FAMILIES].color,
          ),
          next = toon(
            ENEMY_FAMILIES[family as keyof typeof ENEMY_FAMILIES].color,
          );
        view.rig.root.traverse((o) => {
          if (o instanceof T.Mesh && o.material === old) o.material = next;
        });
        view.family = family;
      }
      return view;
    }
    const rig = human(
        "enemy",
        ENEMY_FAMILIES[family as keyof typeof ENEMY_FAMILIES].color,
      ),
      badge = new T.Mesh(diamond, eliteMaterial);
    badge.position.y = 2.5;
    rig.root.add(badge);
    this.root.add(rig.root);
    return { rig, badge, family };
  }
  private makeObject(object: CampaignObject) {
    const root = new T.Group();
    let rig: HumanRig | undefined;
    if (object.kind === "survivor") {
      rig = human("trader", "#4f8078");
      root.add(rig.root);
      part(root, diamond, "#92c7ac", [0, 2.6, 0], [0.7, 0.7, 0.7]);
    } else if (object.kind === "wagon") {
      root.add(wagonTemplate.clone(true));
      part(root, box, "#b9874d", [0, 1.5, 0], [1.5, 0.7, 2], true);
    } else if (object.kind === "ore") {
      part(root, lowSphere, "#7b8275", [0, 0.45, 0], [0.9, 0.65, 0.8], true);
      for (let i = 0; i < 3; i++)
        part(
          root,
          cone,
          "#c3b77f",
          [(i - 1) * 0.3, 0.8, 0.1],
          [0.18, 0.7, 0.18],
        );
    } else if (object.kind === "sage") {
      for (let i = 0; i < 4; i++)
        part(
          root,
          cone,
          "#6f8e62",
          [(i - 1.5) * 0.2, 0.45, Math.sin(i) * 0.15],
          [0.24, 0.9, 0.24],
        );
    } else if (object.kind === "clue" || object.kind === "ledger") {
      part(root, box, "#776149", [0, 0.7, 0], [1.1, 0.1, 0.7]);
      part(root, box, "#e5d2a8", [0, 0.77, 0], [0.7, 0.03, 0.45]);
      for (const x of [-0.4, 0.4])
        part(root, box, "#5b5340", [x, 0.35, 0], [0.12, 0.7, 0.12]);
    } else {
      part(root, box, "#9b7750", [0, 0.4, 0], [1.1, 0.8, 0.8], true);
      part(root, box, "#e6c583", [0, 0.85, 0], [1.2, 0.1, 0.9]);
    }
    if (!rig) part(root, diamond, "#ebc279", [0, 1.65, 0], [0.7, 0.7, 0.7]);
    const groundShadow = new T.Mesh(disc, objectShadowMaterial);
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.position.y = 0.035;
    groundShadow.scale.set(1, 0.7, 1);
    root.add(groundShadow);
    this.root.add(root);
    return { root, rig };
  }
  private makeDrop(drop: GroundLoot) {
    const root = new T.Group(),
      rarity = drop.item?.rarity ?? "common",
      color = RARITIES[rarity].color;
    part(
      root,
      box,
      drop.item ? "#695441" : "#9a8060",
      [0, 0.16, 0],
      [0.42, 0.32, 0.3],
      true,
    );
    const beam = new T.Mesh(cylinder, beamMaterials[rarity]);
    beam.position.y = 1.2;
    beam.scale.set(0.065, 2.2, 0.065);
    root.add(beam);
    const gem = new T.Mesh(diamond, gemMaterials[rarity]);
    gem.position.y = 0.55;
    gem.scale.setScalar(0.65);
    root.add(gem);
    this.root.add(root);
    return root;
  }
  update(state: GameState, time: number) {
    const c = state.campaign,
      p = state.player;
    const liveIds = new Set(c.enemies.map((e) => e.id));
    for (const [id, v] of this.enemies)
      if (!liveIds.has(id)) {
        v.rig.root.visible = false;
        this.enemies.delete(id);
        if (this.pool.length < 48) this.pool.push(v);
        else {
          this.root.remove(v.rig.root);
          disposeRig(v.rig);
        }
      }
    for (const enemy of c.enemies) {
      let v = this.enemies.get(enemy.id);
      if (!v && distance(enemy, p) > 150) continue;
      if (!v) {
        v = this.enemy(enemy.family);
        this.enemies.set(enemy.id, v);
      }
      const { rig, badge } = v;
      rig.root.visible = distance(enemy, p) < 145;
      rig.root.position.set(enemy.x, groundHeight(enemy.x, enemy.z), enemy.z);
      rig.root.rotation.y = enemy.yaw;
      rig.root.scale.setScalar(enemy.boss ? 1.17 : 1);
      animateHuman(
        rig,
        enemy.animation,
        enemy.speed,
        false,
        enemy.awareness > 0.7,
        enemy.health <= 0,
      );
      badge.visible = enemy.elite && enemy.health > 0;
      badge.rotation.y = time;
      rig.gun.visible = !enemy.captured;
      if (
        enemy.health > 0 &&
        (enemy.captured ||
          (enemy.boss && enemy.health <= enemy.maxHealth * 0.3))
      ) {
        rig.arms.forEach((a, i) => (a.rotation.z = i === 0 ? -2.5 : 2.5));
        rig.gun.visible = false;
      }
    }
    const objectIds = new Set(c.objects.map((o) => o.id));
    for (const [id, v] of this.objects)
      if (!objectIds.has(id)) {
        this.root.remove(v.root);
        if (v.rig) disposeRig(v.rig);
        this.objects.delete(id);
      }
    for (const o of c.objects) {
      let v = this.objects.get(o.id);
      if (!v && distance(o, p) > 150) continue;
      if (!v) {
        v = this.makeObject(o);
        this.objects.set(o.id, v);
      }
      v.root.visible = !o.used && distance(o, p) < 150;
      v.root.position.set(o.x, groundHeight(o.x, o.z), o.z);
      v.root.rotation.y = o.yaw;
      if (v.rig)
        animateHuman(v.rig, o.animation, 1.5, false, false, o.health <= 0);
    }
    const lootIds = new Set(c.drops.map((d) => d.id));
    for (const [id, v] of this.drops)
      if (!lootIds.has(id)) {
        this.root.remove(v);
        this.drops.delete(id);
      }
    for (const drop of c.drops) {
      let root = this.drops.get(drop.id);
      if (!root && distance(drop, p) > 100) continue;
      if (!root) {
        root = this.makeDrop(drop);
        this.drops.set(drop.id, root);
      }
      root.visible = distance(drop, p) < 100;
      root.position.set(drop.x, groundHeight(drop.x, drop.z), drop.z);
      root.children[root.children.length - 1].rotation.y = time;
    }
    const hazardIds = new Set(c.hazards.map((h) => h.id));
    for (const [id, v] of this.hazards)
      if (!hazardIds.has(id)) {
        this.root.remove(v);
        this.hazards.delete(id);
      }
    for (const h of c.hazards) {
      let root = this.hazards.get(h.id);
      if (!root) {
        root = new T.Group();
        const outline = new T.Mesh(ring, hazardWarn),
          fill = new T.Mesh(disc, hazardFill);
        outline.rotation.x = fill.rotation.x = -Math.PI / 2;
        outline.position.y = 0.08;
        fill.position.y = 0.06;
        root.add(outline, fill);
        this.root.add(root);
        this.hazards.set(h.id, root);
      }
      root.position.set(h.x, groundHeight(h.x, h.z), h.z);
      root.scale.set(h.radius, 1, h.radius);
      (root.children[0] as T.Mesh).material =
        h.warning > 0 ? hazardWarn : hazardHot;
      root.children[1].visible = h.warning <= 0;
    }
  }
}
