import {
  HUBS,
  PACK_CAPACITY,
  STASH_CAPACITY,
  TALENTS,
} from "../../game/campaign/catalog";
import { distance } from "../math";
import type { GameState, GameEvent } from "../types";
import type { GearItem, HubId, MaterialId, RuneId } from "./types";
import { derivedStats, learnTalent } from "./progression";
import { gearPrice, reforgeItem, salvageYield, upgradeCost } from "./loot";

export const nearbyHub = (s: GameState) =>
  HUBS.find((h) => distance(s.player, h) < 7);
export function marketMultiplier(s: GameState, hubId: HubId = "cinder") {
  const c = s.campaign,
    hub = HUBS.find((h) => h.id === hubId)!,
    supply =
      Object.values(c.sites).reduce((a, b) => a + b.supply, 0) /
      Object.keys(c.sites).length;
  return Math.max(
    0.65,
    Math.min(
      1.4,
      1 +
        (50 - supply) * 0.004 -
        Math.floor(c.reputation[hub.faction] / 50) * 0.04,
    ),
  );
}
export const supplyPrice = (s: GameState, item: "tonic" | "ammo") =>
  Math.ceil((item === "tonic" ? 8 : 6) * marketMultiplier(s));
export const workshopCosts = {
  reforge: { scrap: 8, silver: 0, essence: 2, runes: 0, herbs: 0 },
  socket: { scrap: 0, silver: 3, essence: 0, runes: 1, herbs: 0 },
  brew: { scrap: 0, silver: 0, essence: 0, runes: 0, herbs: 3 },
};
export class GearService {
  constructor(
    readonly state: GameState,
    private emit: (e: GameEvent) => void,
  ) {}
  private note(title: string, text = "") {
    this.emit({ type: "toast", title, text });
  }
  private save() {
    this.state.player.health = Math.min(
      this.state.player.health,
      derivedStats(this.state.campaign, this.state.player.weapon).health,
    );
    this.emit({ type: "checkpoint" });
  }
  private hub() {
    if (nearbyHub(this.state)) return true;
    this.note(
      "Visit a dispatch hub",
      "Workshop and stash services are available at all three hubs.",
    );
    return false;
  }
  private pay(cost: Record<MaterialId, number>) {
    const m = this.state.campaign.materials;
    if (Object.entries(cost).some(([k, v]) => m[k as MaterialId] < v)) {
      this.note(
        "More materials needed",
        "Salvage equipment or complete field jobs for supplies.",
      );
      return false;
    }
    for (const [k, v] of Object.entries(cost)) m[k as MaterialId] -= v;
    return true;
  }
  equip(id: string) {
    const c = this.state.campaign,
      item = c.items.find((i) => i.id === id);
    if (!item) return false;
    c.equipped[item.slot] = id;
    this.note(`${item.name} equipped`);
    this.save();
    return true;
  }
  store(id: string) {
    if (!this.hub()) return false;
    const c = this.state.campaign,
      item = c.items.find((i) => i.id === id);
    if (
      !item ||
      Object.values(c.equipped).includes(id) ||
      c.stash.length >= STASH_CAPACITY
    ) {
      this.note(
        "Cannot store that item",
        "Replace equipped gear first. The stash holds 80 items.",
      );
      return false;
    }
    c.items = c.items.filter((i) => i.id !== id);
    c.stash.push(item);
    this.save();
    return true;
  }
  withdraw(id: string) {
    if (!this.hub()) return false;
    const c = this.state.campaign,
      item = c.stash.find((i) => i.id === id);
    if (!item || c.items.length >= PACK_CAPACITY) {
      this.note("The satchel is full");
      return false;
    }
    c.stash = c.stash.filter((i) => i.id !== id);
    c.items.push(item);
    this.save();
    return true;
  }
  receive(item: GearItem, allowStash = false) {
    const c = this.state.campaign;
    if (c.items.length < PACK_CAPACITY) c.items.push(item);
    else if (allowStash && c.stash.length < STASH_CAPACITY) {
      c.stash.push(item);
      this.note("Reward sent to your stash", item.name);
    } else {
      this.note(
        "Make room for your reward",
        "Salvage or store equipment at a hub.",
      );
      return false;
    }
    return true;
  }
  salvage(id: string) {
    if (!this.hub()) return false;
    const c = this.state.campaign,
      item = c.items.find((i) => i.id === id);
    if (!item || Object.values(c.equipped).includes(id)) {
      this.note(
        "Equipped gear is protected",
        "Equip another item in this slot before salvaging.",
      );
      return false;
    }
    const rewards = salvageYield(
      item,
      derivedStats(c, this.state.player.weapon).salvage,
    );
    c.items = c.items.filter((i) => i.id !== id);
    for (const [key, n] of Object.entries(rewards))
      c.materials[key as MaterialId] += n;
    this.note(
      "Equipment salvaged",
      Object.entries(rewards)
        .filter(([, n]) => n)
        .map(([k, n]) => `+${n} ${k}`)
        .join(" · "),
    );
    this.save();
    return true;
  }
  upgrade(id: string) {
    if (!this.hub()) return false;
    const item = this.state.campaign.items.find((i) => i.id === id);
    if (!item || item.upgrade >= 5) {
      this.note("Fully upgraded");
      return false;
    }
    if (!this.pay(upgradeCost(item))) return false;
    item.upgrade++;
    this.note(`Tempered to +${item.upgrade}`, item.name);
    this.save();
    return true;
  }
  reforge(id: string) {
    if (!this.hub()) return false;
    const c = this.state.campaign,
      index = c.items.findIndex((i) => i.id === id);
    if (index < 0 || !this.pay(workshopCosts.reforge)) return false;
    c.items[index] = reforgeItem(
      c.items[index],
      (c.seed + ++c.roll * 7919) >>> 0,
    );
    this.note("Final affix reforged", c.items[index].name);
    this.save();
    return true;
  }
  socket(id: string, rune: RuneId) {
    if (!this.hub() || !["ember", "frost", "vigor", "fortune"].includes(rune))
      return false;
    const item = this.state.campaign.items.find((i) => i.id === id);
    if (item?.rune === rune) {
      this.note("This rune is already etched");
      return false;
    }
    if (!item || !this.pay(workshopCosts.socket)) return false;
    item.rune = rune;
    this.note(
      `${rune[0].toUpperCase() + rune.slice(1)} rune etched`,
      item.name,
    );
    this.save();
    return true;
  }
  brew() {
    if (!this.hub() || !this.pay(workshopCosts.brew)) return false;
    this.state.inventory.tonics += 2;
    this.note("Two prairie tonics brewed");
    this.save();
    return true;
  }
  learn(id: string) {
    if (!learnTalent(this.state.campaign, id)) {
      this.note(
        "Talent unavailable",
        "Check the level, prerequisite and available point requirements.",
      );
      return false;
    }
    this.note("Talent learned", TALENTS.find((t) => t.id === id)!.name);
    this.save();
    return true;
  }
  respec() {
    if (!this.hub()) return false;
    const c = this.state.campaign,
      cost = c.progression.level * 5;
    if (!Object.values(c.progression.talents).some((n) => n > 0)) {
      this.note("No talents to refund");
      return false;
    }
    if (this.state.inventory.dollars < cost) {
      this.note("Not enough dollars");
      return false;
    }
    this.state.inventory.dollars -= cost;
    c.progression.points += Object.values(c.progression.talents).reduce(
      (a, b) => a + b,
      0,
    );
    c.progression.talents = {};
    this.note("Talents refunded", `−$${cost} · Choose a new path`);
    this.save();
    return true;
  }
  buy(hubId: HubId, id: string) {
    const h = nearbyHub(this.state);
    if (!h || h.id !== hubId) return false;
    const c = this.state.campaign,
      item = c.vendor[hubId].find((i) => i.id === id);
    if (!item) return false;
    const price = Math.ceil(
      gearPrice(item) * marketMultiplier(this.state, hubId),
    );
    if (this.state.inventory.dollars < price) {
      this.note("Not enough dollars");
      return false;
    }
    if (c.items.length >= PACK_CAPACITY) {
      this.note("The satchel is full");
      return false;
    }
    c.vendor[hubId] = c.vendor[hubId].filter((i) => i.id !== id);
    this.state.inventory.dollars -= price;
    c.items.push(item);
    this.note("Equipment purchased", item.name);
    this.save();
    return true;
  }
  payBounty() {
    if (!this.hub() || this.state.inventory.dollars < this.state.bounty) {
      this.note("Not enough dollars to settle the bounty");
      return false;
    }
    this.state.inventory.dollars -= this.state.bounty;
    this.state.bounty = 0;
    this.state.heat = 0;
    this.note("Your name is clear");
    this.save();
    return true;
  }
}
