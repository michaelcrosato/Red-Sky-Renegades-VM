import { newGame } from "./simulation";
import type { GameState } from "./types";
import { STAGES } from "../game/content";
import { SAVE_POSITION_LIMIT, landmarkById } from "../game/territory";
import { newCampaign } from "./campaign/state";
import { validCampaign } from "./campaign/validation";
import { derivedStats } from "./campaign/progression";
import { destinationById } from "../game/destinations";
export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}
export const SAVE_KEY = "red-sky-renegades-vm:save:1";
export const SETTINGS_KEY = "red-sky-renegades-vm:settings:1";
export interface Settings {
  volume: number;
  music: number;
  sensitivity: number;
  invertY: boolean;
  quality: "high" | "balanced";
  shake: boolean;
  subtitles: boolean;
}
export const defaultSettings: Settings = {
  volume: 0.65,
  music: 0.35,
  sensitivity: 1,
  invertY: false,
  quality: "high",
  shake: true,
  subtitles: true,
};
export function validSave(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const s = value as GameState;
  const finite = (n: unknown, min = -1e9, max = 1e9) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  const count = (n: unknown) => finite(n, 0, 1e6) && Number.isInteger(n);
  const position = (p: unknown) =>
    !!p &&
    typeof p === "object" &&
    finite((p as { x: number }).x, -SAVE_POSITION_LIMIT, SAVE_POSITION_LIMIT) &&
    finite((p as { z: number }).z, -SAVE_POSITION_LIMIT, SAVE_POSITION_LIMIT);
  const actor = (a: unknown) =>
    position(a) &&
    typeof (a as { id: unknown }).id === "string" &&
    ["yaw", "health", "animation", "speed"].every((k) =>
      finite((a as Record<string, unknown>)[k]),
    );
  const p = s.player,
    h = s.horse,
    i = s.inventory;
  return (
    s.version === 1 &&
    s.mode === "story" &&
    STAGES.some((t) => t.id === s.stage) &&
    actor(p) &&
    p.health > 0 &&
    p.health <= 1000 &&
    finite(p.stamina, 0, 100) &&
    finite(p.focus, 0, 100) &&
    ["focusing", "mounted", "aiming"].every(
      (k) => typeof (p as unknown as Record<string, unknown>)[k] === "boolean",
    ) &&
    ["revolver", "rifle"].includes(p.weapon) &&
    !!p.ammo &&
    !!p.reserve &&
    [p.ammo.revolver, p.ammo.rifle, p.reserve.revolver, p.reserve.rifle].every(
      count,
    ) &&
    [p.reload, p.shot, p.invulnerable].every((n) => finite(n, 0)) &&
    [p.dodge, p.dodgeCooldown].every((n) => finite(n, 0)) &&
    finite(p.evadeX, -1, 1) &&
    finite(p.evadeZ, -1, 1) &&
    actor(h) &&
    finite(h.stamina, 0, 100) &&
    finite(h.bond, 0, 100) &&
    typeof h.following === "boolean" &&
    Array.isArray(s.enemies) &&
    s.enemies.length === 5 &&
    s.enemies.every(
      (e) =>
        actor(e) &&
        position(e.home) &&
        finite(e.cooldown) &&
        finite(e.awareness, 0, 1) &&
        typeof e.loot === "boolean" &&
        ["patrol", "investigate", "attack", "flank", "dead"].includes(e.state),
    ) &&
    !!i &&
    [i.tonics, i.herbs].every(count) &&
    finite(i.dollars, 0) &&
    typeof i.medicine === "boolean" &&
    typeof i.relic === "boolean" &&
    Array.isArray(s.herbs) &&
    s.herbs.length === 3 &&
    s.herbs.every((v) => typeof v === "boolean") &&
    finite(s.honor) &&
    [s.bounty, s.heat, s.elapsed, s.weatherTime].every((n) => finite(n, 0)) &&
    finite(s.time, 0, 24) &&
    ["clear", "rain"].includes(s.weather) &&
    [null, "mercy", "revenge"].includes(s.choice) &&
    [s.shots, s.hits, s.kills, s.deaths].every(count) &&
    (s.completedAt === null || finite(s.completedAt, 0)) &&
    Array.isArray(s.targets) &&
    s.targets.length === 5 &&
    s.targets.every((t) => position(t) && finite(t.health)) &&
    Array.isArray(s.discovered) &&
    s.discovered.every((id) => typeof id === "string" && !!landmarkById(id)) &&
    new Set(s.discovered).size === s.discovered.length &&
    (s.explorationTarget === null ||
      (typeof s.explorationTarget === "string" &&
        !!destinationById(s.explorationTarget))) &&
    validCampaign(s.campaign)
  );
}
export class SaveStore {
  error = "";
  constructor(private storage: StorageLike) {}
  load(): GameState | null {
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Additive migration: existing version-1 stories keep their exact progress.
      if (data?.version === 1) {
        if (data.discovered === undefined) data.discovered = [];
        if (data.explorationTarget === undefined) data.explorationTarget = null;
        if (data.campaign === undefined) data.campaign = newCampaign();
        if (data.player) {
          for (const key of ["dodge", "dodgeCooldown", "evadeX", "evadeZ"])
            if (data.player[key] === undefined) data.player[key] = 0;
        }
      }
      return validSave(data) ? data : null;
    } catch {
      this.error = "Saved progress could not be read.";
      return null;
    }
  }
  write(s: GameState) {
    if (s.mode !== "story" || s.player.health <= 0) return false;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(s));
      return true;
    } catch {
      this.error = "Storage is unavailable. This session can still be played.";
      return false;
    }
  }
  clear() {
    try {
      this.storage.removeItem(SAVE_KEY);
    } catch {
      this.error = "Saved progress could not be removed.";
    }
  }
  settings(): Settings {
    try {
      const v = JSON.parse(this.storage.getItem(SETTINGS_KEY) || "{}");
      return {
        volume: Number.isFinite(v.volume)
          ? Math.max(0, Math.min(1, v.volume))
          : 0.65,
        music: Number.isFinite(v.music)
          ? Math.max(0, Math.min(1, v.music))
          : 0.35,
        sensitivity: Number.isFinite(v.sensitivity)
          ? Math.max(0.4, Math.min(2, v.sensitivity))
          : 1,
        invertY: v.invertY === true,
        quality: v.quality === "balanced" ? "balanced" : "high",
        shake: v.shake !== false,
        subtitles: v.subtitles !== false,
      };
    } catch {
      return { ...defaultSettings };
    }
  }
  writeSettings(s: Settings) {
    try {
      this.storage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      this.error = "Settings could not be saved.";
    }
  }
}
export function recoveredSave(s: GameState | null) {
  const next = structuredClone(s ?? newGame());
  next.player.health = Math.min(
    derivedStats(next.campaign, next.player.weapon).health,
    Math.max(
      derivedStats(next.campaign, next.player.weapon).health * 0.7,
      next.player.health,
    ),
  );
  next.player.focusing = false;
  next.player.reload = 0;
  next.player.invulnerable = 2;
  next.player.dodge = 0;
  next.player.dodgeCooldown = 0;
  next.player.evadeX = next.player.evadeZ = 0;
  return next;
}
