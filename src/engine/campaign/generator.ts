import { random, distance, type Vec2 } from "../math";
import { LANDMARKS } from "../../game/territory";
import {
  CONTRACT_MODIFIERS,
  ENEMY_FAMILIES,
  HUBS,
} from "../../game/campaign/catalog";
import { freePosition } from "./navigation";
import type {
  CampaignState,
  Contract,
  ContractKind,
  HubId,
  Objective,
  ObjectiveKind,
} from "./types";

export const CONTRACT_KINDS: ContractKind[] = [
  "bounty",
  "raid",
  "recovery",
  "courier",
  "escort",
  "defense",
  "salvage",
  "survey",
  "supply",
  "quest",
];
export function generateContract(
  c: CampaignState,
  hubId: HubId,
  kind: ContractKind,
  seed: number,
  tier = c.difficulty,
  origin: "board" | "event" = "board",
  siteOverride?: string,
): Contract {
  seed = seed >>> 0;
  const rng = random(seed),
    pick = <T>(a: readonly T[]) => a[Math.floor(rng() * a.length)],
    hub = HUBS.find((h) => h.id === hubId)!;
  const weighted = LANDMARKS.flatMap((l) =>
    Array.from(
      {
        length:
          1 +
          Math.floor(
            (kind === "supply" || kind === "courier"
              ? 100 - c.sites[l.id].supply
              : c.sites[l.id].threat) / 30,
          ),
      },
      () => l,
    ),
  );
  const site = LANDMARKS.find((l) => l.id === siteOverride) ?? pick(weighted),
    neighbors = LANDMARKS.filter((l) => l.id !== site.id).sort(
      (a, b) => distance(a, site) - distance(b, site),
    ),
    other = neighbors[Math.floor(rng() * Math.min(2, neighbors.length))];
  const family = pick(Object.keys(ENEMY_FAMILIES)),
    level = Math.max(1, Math.min(40, c.progression.level + tier - 1));
  const modifiers: string[] = [],
    modPool = Object.keys(CONTRACT_MODIFIERS);
  let modCount = Math.min(
    3,
    tier - 1 + (c.sites[site.id].threat >= 65 ? 1 : 0),
  );
  while (modCount-- > 0) {
    const i = Math.floor(rng() * modPool.length);
    modifiers.push(modPool.splice(i, 1)[0]);
  }
  const bonus =
    1 +
    modifiers.reduce(
      (sum, id) =>
        sum + CONTRACT_MODIFIERS[id as keyof typeof CONTRACT_MODIFIERS].reward,
      0,
    );
  const targetName = `${pick(["Silas", "Nell", "Harlan", "Merrin", "Jeb", "Kellan", "Rook", "Vera"])} “${pick(["Cinder", "Crow", "Long Reach", "Glass Eye", "Red Jack", "Wolfsong"])}” ${pick(["Vale", "Mercer", "Pike", "Holt", "Voss", "Creed"])}`;
  const beat = (
    objective: ObjectiveKind,
    label: string,
    where: typeof site | Vec2,
    extra: Partial<Objective> = {},
  ): Objective => ({
    kind: objective,
    label,
    siteId: "id" in where ? String(where.id) : site.id,
    ...freePosition(where),
    amount: 1,
    progress: 0,
    duration: 0,
    elapsed: 0,
    wave: 0,
    spawned: false,
    started: false,
    prop: "cache",
    encounter: 0,
    elite: false,
    boss: false,
    destination: null,
    ...extra,
  });
  const reach = (where: typeof site) =>
    beat("reach", `Ride to ${where.name}`, where);
  const kill = (where: typeof site, count: number, boss = false) =>
    beat(
      "eliminate",
      boss
        ? `Confront ${targetName}`
        : `Defeat the ${ENEMY_FAMILIES[family as keyof typeof ENEMY_FAMILIES].name}`,
      where,
      { amount: count, encounter: count, elite: tier >= 2 || boss, boss },
    );
  let objectives: Objective[] = [],
    title = "",
    summary = "";
  switch (kind) {
    case "bounty":
      title = `Wanted: ${targetName}`;
      summary = `A dangerous name was sighted at ${site.name}. Capture the leader alive for an extra reward, or bring proof of the kill.`;
      objectives = [reach(site), kill(site, 2 + Math.min(2, tier - 1), true)];
      break;
    case "raid":
      title = `Smoke over ${site.name}`;
      summary = `Break the gang’s hold and recover their supply cache. The region’s threat will fall.`;
      objectives = [
        reach(site),
        kill(site, 3 + Math.min(2, tier - 1)),
        beat("interact", "Secure the gang’s supplies", site, { prop: "cache" }),
      ];
      break;
    case "recovery":
      title = `The missing ${pick(["payroll", "dispatch", "shipment", "relic"])}`;
      summary = `Follow clues at ${site.name}, deal with whoever took the cargo, and recover it.`;
      objectives = [
        reach(site),
        beat("interact", "Search the abandoned trail", site, {
          prop: "clue",
          amount: 2,
        }),
        kill(site, 2 + tier),
        beat("interact", "Recover the stolen cargo", site, { prop: "cache" }),
      ];
      break;
    case "courier":
      title = `A letter for ${site.name}`;
      summary = `Collect the sealed parcel at the dispatch board, then deliver it. Dangerous roads may have an ambush.`;
      objectives = [
        beat(
          "interact",
          "Collect the sealed parcel",
          { x: hub.x + 3, z: hub.z + 5 },
          { prop: "parcel" },
        ),
        reach(site),
      ];
      if (tier > 1 || c.sites[site.id].threat > 65)
        objectives.push(kill(site, 2));
      objectives.push(
        beat("interact", "Deliver the sealed parcel", site, { prop: "parcel" }),
      );
      break;
    case "escort":
      title = `One rider short`;
      summary = `A stranded prospector at ${site.name} needs safe passage to ${other.name}. Stay close and keep the escort alive.`;
      objectives = [
        reach(site),
        beat("escort", `Escort the prospector to ${other.name}`, site, {
          prop: "survivor",
          destination: { x: other.x, z: other.z },
          encounter: 2 + tier,
        }),
      ];
      break;
    case "defense":
      title = `Hold ${site.name}`;
      summary = `Protect a supply wagon through three enemy waves. If the wagon falls, the contract fails.`;
      objectives = [
        reach(site),
        beat("defend", "Protect the supply wagon", site, {
          prop: "wagon",
          amount: 3,
          duration: 35 + tier * 5,
          encounter: 2 + tier,
        }),
      ];
      break;
    case "salvage":
      title = `Silver in the dust`;
      summary = `Salvage three deposits at ${site.name}. Recovered materials can improve your equipment.`;
      objectives = [
        reach(site),
        beat("interact", "Salvage the scattered deposits", site, {
          prop: "ore",
          amount: 3,
        }),
      ];
      break;
    case "survey":
      title = `Put it on the map`;
      summary = `Survey three frontier locations for the ${hub.faction}. Exploration earns XP and improves regional intelligence.`;
      objectives = [
        beat("interact", `Survey ${site.name}`, site, { prop: "clue" }),
        beat("interact", `Survey ${other.name}`, other, { prop: "clue" }),
        beat("interact", `Survey ${neighbors[2].name}`, neighbors[2], {
          prop: "clue",
        }),
      ];
      break;
    case "supply":
      title = `Medicine for ${other.name}`;
      summary = `Gather prairie sage at ${site.name} and deliver a field-medicine bundle to ${other.name}. This restores regional supply.`;
      objectives = [
        reach(site),
        beat("interact", "Gather three bundles of prairie sage", site, {
          prop: "sage",
          amount: 3,
        }),
        reach(other),
        beat("interact", "Deliver the field medicine", other, {
          prop: "parcel",
        }),
      ];
      break;
    case "quest":
      title = pick([
        "The Broken Wire",
        "A Debt Beneath the Dust",
        "The Names in the Ledger",
        "Ashes of a Promise",
      ]);
      summary = `Investigate ${site.name}, uncover a gang network, choose what to do with its ledger, then confront its leader at ${other.name}. A legendary reward awaits.`;
      objectives = [
        reach(site),
        beat("interact", "Find the missing dispatches", site, {
          prop: "clue",
          amount: 2,
        }),
        kill(site, 2 + tier),
        reach(other),
        beat("choice", "Decide the fate of the ledger", other, {
          prop: "ledger",
        }),
        kill(other, 2 + tier, true),
        beat("interact", "Recover the hidden relic", other, { prop: "cache" }),
      ];
      break;
  }
  if (modifiers.includes("dangerous"))
    for (const o of objectives)
      if (o.kind === "eliminate") {
        o.amount++;
        o.encounter++;
      }
  if (origin === "event") {
    title = `Roadside: ${title}`;
    objectives = objectives.filter((o) => o.kind !== "reach");
  }
  return {
    id: `contract-${c.serial++}`,
    seed,
    hubId,
    faction: hub.faction,
    kind,
    title,
    summary,
    targetName,
    tier,
    level,
    family,
    modifiers,
    objectives,
    index: 0,
    status: origin === "event" ? "active" : "offered",
    origin,
    expires: origin === "event" ? c.clock + 240 : 0,
    reward: {
      xp: Math.round((70 + objectives.length * 25 + level * 8) * tier * bonus),
      gold: Math.round(
        (20 + level * 6 + tier * 12 + objectives.length * 6) * bonus,
      ),
      reputation: kind === "quest" ? 20 : 8 + tier * 2,
      material: 3 + tier * 2,
      quality:
        kind === "quest"
          ? c.reputation[hub.faction]>=100?"unique":"legendary"
          : kind === "bounty"
            ? "rare"
            : tier >= 3
              ? "rare"
              : "magic",
    },
    outcome: "none",
    failure: "",
  };
}
export function refreshOffers(c: CampaignState, hub: HubId) {
  const cycle = c.boardCycle[hub]++,
    offset = HUBS.findIndex((h) => h.id === hub) * 3;
  const initial: Record<HubId, ContractKind[]> = {
    cinder: ["bounty", "salvage", "courier", "defense", "quest"],
    sundown: ["raid", "bounty", "recovery", "survey", "quest"],
    cottonwood: ["escort", "supply", "salvage", "courier", "quest"],
  };
  const kinds =
    cycle === 0
      ? initial[hub]
      : [
          ...Array.from(
            { length: 4 },
            (_, i) => CONTRACT_KINDS[(cycle * 4 + offset + i) % 9],
          ),
          "quest" as ContractKind,
        ];
  c.boards[hub] = kinds.map((kind, i) =>
    generateContract(
      c,
      hub,
      kind,
      (c.seed + cycle * 8191 + offset * 997 + i * 101) >>> 0,
    ),
  );
}
