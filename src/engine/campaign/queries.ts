import type { GameState } from "../types";
import { distance, type Vec2 } from "../math";
import { HUBS } from "../../game/campaign/catalog";
import type { Contract } from "./types";

export function campaignNavigation(
  s: GameState,
): { position: Vec2; title: string; text: string; contract: Contract } | null {
  const c = [...s.campaign.active, ...s.campaign.events].find(
    (c) => c.id === s.campaign.tracked,
  );
  if (!c) return null;
  if (c.status === "ready" || c.status === "failed") {
    const hub = HUBS.find((h) => h.id === c.hubId)!;
    return {
      position: hub,
      title:
        c.status === "ready"
          ? "Collect your reward"
          : "Return to the dispatch board",
      text: `${c.title} · ${hub.name}`,
      contract: c,
    };
  }
  const o = c.objectives[c.index];
  if (!o) return null;
  let target: Vec2 = o;
  const object = s.campaign.objects
    .filter((v) => v.owner === c.id && v.stage === c.index && !v.used)
    .sort((a, b) => distance(a, s.player) - distance(b, s.player))[0];
  if (object) target = object;
  if (o.kind === "eliminate") {
    const foe = s.campaign.enemies
      .filter(
        (e) =>
          e.owner === c.id &&
          e.stage === c.index &&
          e.health > 0 &&
          !e.captured,
      )
      .sort((a, b) => distance(a, s.player) - distance(b, s.player))[0];
    if (foe) target = foe;
  }
  const health = object
    ? Math.ceil((object.health / object.maxHealth) * 100)
    : 100;
  const extra =
    o.kind === "defend"
      ? ` · ${Math.min(Math.floor(o.elapsed), o.duration)}/${o.duration}s · Wagon ${health}%`
      : o.kind === "escort"
        ? ` · Escort ${health}%`
        : o.amount > 1
          ? ` · ${o.progress}/${o.amount}`
          : "";
  return {
    position: target,
    title: c.title,
    text: o.label + extra,
    contract: c,
  };
}
