import type { Vec2 } from "./math";
import type { StageId, WeaponId } from "../game/content";
export interface Controls {
  moveX: number;
  moveZ: number;
  lookX: number;
  lookY: number;
  sprint: boolean;
  aim: boolean;
  fire: boolean;
  interact: boolean;
  reload: boolean;
  focus: boolean;
  whistle: boolean;
  tonic: boolean;
  wheel: boolean;
  pause: boolean;
  journal: boolean;
  confirm: boolean;
  back: boolean;
  navX: number;
  navY: number;
  weapon?: WeaponId;
}
export const emptyControls = (): Controls => ({
  moveX: 0,
  moveZ: 0,
  lookX: 0,
  lookY: 0,
  sprint: false,
  aim: false,
  fire: false,
  interact: false,
  reload: false,
  focus: false,
  whistle: false,
  tonic: false,
  wheel: false,
  pause: false,
  journal: false,
  confirm: false,
  back: false,
  navX: 0,
  navY: 0,
});
export interface Actor extends Vec2 {
  id: string;
  yaw: number;
  health: number;
  animation: number;
  speed: number;
}
export interface Enemy extends Actor {
  home: Vec2;
  state: "patrol" | "investigate" | "attack" | "flank" | "dead";
  cooldown: number;
  awareness: number;
  loot: boolean;
}
export interface Player extends Actor {
  stamina: number;
  focus: number;
  focusing: boolean;
  mounted: boolean;
  aiming: boolean;
  weapon: WeaponId;
  ammo: Record<WeaponId, number>;
  reserve: Record<WeaponId, number>;
  reload: number;
  shot: number;
  invulnerable: number;
}
export interface Inventory {
  tonics: number;
  herbs: number;
  medicine: boolean;
  dollars: number;
  relic: boolean;
}
export interface GameState {
  version: 1;
  player: Player;
  horse: Actor & { stamina: number; following: boolean; bond: number };
  enemies: Enemy[];
  stage: StageId;
  inventory: Inventory;
  honor: number;
  bounty: number;
  heat: number;
  time: number;
  elapsed: number;
  weather: "clear" | "rain";
  weatherTime: number;
  herbs: boolean[];
  choice: "mercy" | "revenge" | null;
  shots: number;
  hits: number;
  kills: number;
  deaths: number;
  mode: "story" | "range";
  targets: { x: number; z: number; health: number }[];
  completedAt: number | null;
}
export type GameEvent =
  | { type: "toast"; title: string; text?: string }
  | { type: "dialogue"; speaker: string; text: string; next?: StageId }
  | {
      type: "shot";
      from: Vec2;
      to: Vec2;
      hit: boolean;
      enemy: boolean;
      mounted?: boolean;
    }
  | { type: "damage"; amount: number }
  | {
      type: "sound";
      name:
        | "step"
        | "hoof"
        | "reload"
        | "empty"
        | "pickup"
        | "whistle"
        | "tonic"
        | "click"
        | "hit"
        | "mount"
        | "complete";
    }
  | { type: "checkpoint" }
  | { type: "death" }
  | { type: "complete" }
  | { type: "choice" }
  | { type: "shop" }
  | { type: "stage"; stage: StageId };
