import type { GameState } from "../engine/types";
import type {
  Contract,
  GearItem,
  GearSlot,
  HubId,
} from "../engine/campaign/types";
import {
  ASPECTS,
  RELIC_SIGNATURES,
  CONTRACT_MODIFIERS,
  CONTRACT_NAMES,
  FACTIONS,
  GEAR_SLOTS,
  HUBS,
  PACK_CAPACITY,
  RARITIES,
  RUNES,
  SETS,
  SLOT_NAMES,
  STAT_NAMES,
  TALENTS,
} from "../game/campaign/catalog";
import {
  derivedStats,
  unlockedTier,
  xpToNext,
} from "../engine/campaign/progression";
import { gearPrice, upgradeCost } from "../engine/campaign/loot";
import {
  marketMultiplier,
  nearbyHub,
  workshopCosts,
} from "../engine/campaign/gear";
import { distance } from "../engine/math";
import { landmarkById } from "../game/territory";
import { WEAPONS } from "../game/content";

export type CampaignScreen =
  | "hub"
  | "board"
  | "contracts"
  | "equipment"
  | "talents"
  | "workshop"
  | "stash"
  | "stock"
  | "character"
  | "campaign-choice";
export const isCampaignScreen = (s: string): s is CampaignScreen =>
  [
    "hub",
    "board",
    "contracts",
    "equipment",
    "talents",
    "workshop",
    "stash",
    "stock",
    "character",
    "campaign-choice",
  ].includes(s);
export const craftActions = [
  "upgrade",
  "reforge",
  "ember",
  "frost",
  "vigor",
  "fortune",
  "brew",
  "salvage",
] as const;
export const html = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const button = (label: string, action: string, disabled = false) =>
  `<button data-action="campaign:${action}" ${disabled ? "disabled" : ""}><span class="menu-arrow">›</span><span>${label}</span></button>`;
const cycle = (label: string) =>
  `<div class="campaign-cycle"><button data-map-cycle tabindex="-1" data-action="campaign:prev" aria-label="Previous">‹</button><span>${label}</span><button data-map-cycle tabindex="-1" data-action="campaign:next" aria-label="Next">›</button></div>`;
const money = (n: number) => `$${n.toFixed(0)}`;
const materialLine = (cost: Record<string, number>) =>
  Object.entries(cost)
    .filter(([, n]) => n)
    .map(([k, n]) => `${n} ${k}`)
    .join(" · ");
export class CampaignUI {
  hub: HubId = "cinder";
  pendingChoice = "";
  slot = 0;
  branch = 0;
  recipe = 0;
  cursors: Record<string, number> = {
    board: 0,
    contracts: 0,
    equipment: 0,
    workshop: 0,
    stash: 0,
    stock: 0,
    talents: 0,
  };
  private state!: GameState;
  private screen: CampaignScreen = "hub";
  get selectedContract(): Contract | undefined {
    const list =
      this.screen === "board"
        ? this.state.campaign.boards[this.hub]
        : [...this.state.campaign.active, ...this.state.campaign.events];
    return list[this.cursors[this.screen] ?? 0];
  }
  get selectedItem(): GearItem | undefined {
    return this.itemList()[this.cursors[this.screen] ?? 0];
  }
  get selectedTalent() {
    return TALENTS.filter(
      (n) => n.branch === ["Gunslinger", "Warden", "Outrider"][this.branch],
    )[this.cursors.talents % 5];
  }
  private itemList() {
    const c = this.state.campaign;
    return this.screen === "stash"
      ? c.stash
      : this.screen === "stock"
        ? c.vendor[this.hub]
        : this.screen === "workshop"
          ? c.items
          : c.items.filter((i) => i.slot === GEAR_SLOTS[this.slot]);
  }
  cycle(direction: number) {
    if (
      this.screen === "hub" ||
      this.screen === "campaign-choice" ||
      this.screen === "character"
    )
      return;
    let length = 1;
    if (this.screen === "board")
      length = this.state.campaign.boards[this.hub].length;
    else if (this.screen === "contracts")
      length =
        this.state.campaign.active.length + this.state.campaign.events.length;
    else if (this.screen === "talents") length = 5;
    else length = this.itemList().length;
    this.cursors[this.screen] =
      (this.cursors[this.screen] + direction + Math.max(1, length)) %
      Math.max(1, length);
  }
  page(direction: number) {
    if (this.screen === "equipment") {
      this.slot = (this.slot + direction + 6) % 6;
      this.cursors.equipment = 0;
    } else if (this.screen === "talents") {
      this.branch = (this.branch + direction + 3) % 3;
      this.cursors.talents = 0;
    } else if (this.screen === "workshop")
      this.recipe =
        (this.recipe + direction + craftActions.length) % craftActions.length;
    else this.cycle(direction);
  }
  workshopItem(id?: string) {
    if (id)
      this.cursors.workshop = Math.max(
        0,
        this.state.campaign.items.findIndex((i) => i.id === id),
      );
  }
  private itemCard(item: GearItem, compare = true) {
    const s = this.state,
      c = s.campaign,
      rarity = RARITIES[item.rarity],
      equipped = c.equipped[item.slot] === item.id,
      weapon =
        item.slot === "rifle" || item.slot === "revolver"
          ? item.slot
          : s.player.weapon,
      before = derivedStats(c, weapon),
      after = derivedStats(c, weapon, item);
    const differences = (
      [
        "damage",
        "health",
        "armor",
        "crit",
        "reload",
        "move",
        "ride",
        "focus",
        "luck",
        "resist",
      ] as const
    )
      .map((k) => ({ key: k, value: after[k] - before[k] }))
      .filter((v) => Math.abs(v.value) > 0.1)
      .slice(0, 4);
    return `<div class="item-card" style="--rarity:${rarity.color}"><div class="item-art"><span>${{ revolver: "Ⅰ", rifle: "Ⅱ", coat: "◈", boots: "⌁", charm: "✦", saddle: "♞" }[item.slot]}</span><small>${SLOT_NAMES[item.slot].toUpperCase()}</small><b>${rarity.name.toUpperCase()} · ITEM LEVEL ${item.level}</b></div><div class="item-copy"><h3>${html(item.name)}${item.upgrade ? ` <em>+${item.upgrade}</em>` : ""}</h3><div class="item-affixes">${item.affixes.map((a) => `<p>+${Math.round(a.value * (1 + item.upgrade * 0.12))}${["health", "armor", "luck", "leech"].includes(a.stat) ? "" : "%"} ${STAT_NAMES[a.stat]} <small>T${a.tier}</small></p>`).join("") || "<p>Reliable frontier equipment.</p>"}</div>${item.aspect ? `<p class="item-power"><b>${ASPECTS[item.aspect].name}</b><br>${ASPECTS[item.aspect].description}${item.rarity === "unique" ? `<small class="relic-signature">${RELIC_SIGNATURES[item.aspect].description}</small>` : ""}</p>` : ""}${item.rune ? `<p class="item-rune">◆ ${RUNES[item.rune].name} rune · ${RUNES[item.rune].description}</p>` : ""}${item.set ? `<p class="item-set">${SETS[item.set].name} set · 2: ${SETS[item.set].two} · 3: ${SETS[item.set].three}</p>` : ""}${compare ? `<div class="comparison">${equipped ? "<span>EQUIPPED</span>" : differences.map((d) => `<span class="${d.value > 0 ? "gain" : "loss"}">${d.value > 0 ? "+" : ""}${d.value.toFixed(1)} ${STAT_NAMES[d.key]}</span>`).join("") || "<span>No base stat change; compare item powers.</span>"}</div>` : ""}</div></div>`;
  }
  private contractCard(c: Contract) {
    const s = this.state,
      site = landmarkById(
        c.objectives[Math.min(c.index, c.objectives.length - 1)].siteId,
      )!,
      pressure = s.campaign.sites[site.id];
    const current =
      c.status === "ready"
        ? `Return to ${HUBS.find((h) => h.id === c.hubId)!.name}`
        : c.status === "failed"
          ? c.failure
          : c.objectives[c.index]?.label;
    return `<div class="contract-card"><div class="contract-stamp"><span>${c.kind === "bounty" ? "★" : c.kind === "quest" ? "✦" : "◇"}</span><b>${CONTRACT_NAMES[c.kind].toUpperCase()}</b><small>TIER ${c.tier} · LEVEL ${c.level}</small><p>${FACTIONS[c.faction].name}</p></div><div class="contract-copy"><h3>${html(c.title)}</h3><p>${html(c.summary)}</p><div class="contract-conditions">${c.modifiers.map((id) => `<span>${CONTRACT_MODIFIERS[id as keyof typeof CONTRACT_MODIFIERS].name}</span>`).join("") || "<span>Standard conditions</span>"}</div><p class="contract-region">${site.name} · Threat ${Math.round(pressure.threat)} · Supply ${Math.round(pressure.supply)}</p>${c.status !== "offered" ? `<div class="contract-steps">${c.objectives.map((o, i) => `<i class="${i < c.index ? "done" : i === c.index ? "current" : ""}" title="${html(o.label)}"></i>`).join("")}</div><p class="contract-current ${c.status}">${html(current ?? "")} ${c.outcome === "captured" ? "· ALIVE BONUS" : ""}</p>` : `<p class="contract-current">${c.objectives.length} stages · ${Math.round(distance(s.player, c.objectives[0]))} m to first objective</p>`}<div class="reward-row"><span><b>${c.reward.xp}</b> XP</span><span><b>${money(c.reward.gold)}</b> PAY</span><span style="color:${RARITIES[c.reward.quality].color}"><b>${RARITIES[c.reward.quality].name}</b> GEAR</span><span><b>+${c.reward.reputation}</b> RENOWN</span></div></div></div>`;
  }
  render(screen: CampaignScreen, s: GameState) {
    this.state = s;
    this.screen = screen;
    const c = s.campaign,
      hub = HUBS.find((h) => h.id === this.hub)!,
      local = nearbyHub(s),
      back = button("Back", "back");
    let heading = "",
      kicker = "",
      body = "",
      buttons = "";
    if (screen === "hub") {
      heading = hub.name;
      kicker = `${FACTIONS[hub.faction].name} · RENOWN ${c.reputation[hub.faction]}`;
      body = `<p class="hub-description">${hub.description}</p><div class="hub-summary"><span>RIDER <b>LEVEL ${c.progression.level}</b></span><span>AVAILABLE <b>${money(s.inventory.dollars)}</b></span><span>CONTRACTS <b>${c.active.length}/3 ACTIVE</b></span></div>`;
      buttons =
        button("Dispatch board", "board") +
        button("Contract journal", "contracts") +
        button("Equipment", "equipment") +
        button("Talents", "talents") +
        button("Workshop", "workshop") +
        button("Shared stash", "stash") +
        button("Trading post", "stock") +
        (s.bounty
          ? button(`Settle bounty · ${money(s.bounty)}`, "pay-bounty")
          : "") +
        button("Return to the trail", "close");
    }
    if (screen === "board") {
      heading = "Work worth doing.";
      kicker = hub.name;
      const list = c.boards[this.hub];
      this.cursors.board = Math.min(
        this.cursors.board,
        Math.max(0, list.length - 1),
      );
      const job = this.selectedContract;
      body =
        cycle(
          `NOTICE ${list.length ? this.cursors.board + 1 : 0} / ${list.length}`,
        ) +
        (job
          ? this.contractCard(job)
          : "<p>The board is clear. Request fresh notices.</p>");
      buttons =
        (job
          ? button(
              "Accept & track",
              "accept",
              c.active.length >= 3 || s.mode !== "story",
            )
          : "") +
        button("New notices · $5", "refresh") +
        button(
          `Challenge tier ${c.difficulty}`,
          "difficulty",
          unlockedTier(c) === 1,
        ) +
        back;
      body += `<p class="campaign-hint">← → Browse notices · Up to 3 active · New challenge tiers at levels 5, 10 and 15</p>`;
    }
    if (screen === "contracts") {
      heading = "Your frontier ledger";
      kicker = `${c.completed} CONTRACTS FULFILLED · ${c.questsCompleted} QUESTS`;
      const list = [...c.active, ...c.events];
      this.cursors.contracts = Math.min(
        this.cursors.contracts,
        Math.max(0, list.length - 1),
      );
      const job = this.selectedContract;
      body =
        cycle(
          `CONTRACT ${list.length ? this.cursors.contracts + 1 : 0} / ${list.length}`,
        ) +
        (job
          ? this.contractCard(job)
          : '<div class="empty-campaign"><span>◇</span><h3>The frontier is full of work.</h3><p>Visit a dispatch board at Cinder Creek, Sundown Relay or Cottonwood Crossing. Field events also appear as you explore.</p></div>');
      if (job) {
        buttons = button("Track on the trail", "track");
        if (job.status === "ready" && local?.id === job.hubId)
          buttons += button("Collect rewards", "claim");
        if (job.status === "failed" && local?.id === job.hubId)
          buttons += button("Retry contract", "retry");
        if (job.status === "active" && job.origin === "board")
          buttons += button("Abandon contract", "abandon");
      }
      buttons += back;
    }
    if (["equipment", "stash", "stock", "workshop"].includes(screen)) {
      const list = this.itemList();
      this.cursors[screen] = Math.min(
        this.cursors[screen],
        Math.max(0, list.length - 1),
      );
      const item = this.selectedItem;
      heading =
        screen === "equipment"
          ? "The tools of your trade"
          : screen === "stash"
            ? "Keep it for another day"
            : screen === "stock"
              ? "The travelling stock"
              : "Made for the long road";
      kicker =
        screen === "equipment"
          ? `LEVEL ${c.progression.level} · ${SLOT_NAMES[GEAR_SLOTS[this.slot]].toUpperCase()} · SATCHEL ${c.items.length}/${PACK_CAPACITY}`
          : screen === "stash"
            ? `SHARED STASH · ${c.stash.length}/80`
            : hub.name;
      body =
        cycle(
          `${screen === "equipment" ? SLOT_NAMES[GEAR_SLOTS[this.slot]].toUpperCase() + " · " : ""}ITEM ${list.length ? this.cursors[screen] + 1 : 0} / ${list.length}`,
        ) +
        (item
          ? this.itemCard(item, screen !== "workshop")
          : '<div class="empty-campaign"><span>◇</span><p>No equipment here yet.</p></div>');
      if (screen === "equipment") {
        if (item) {
          buttons = button("Equip", "equip", c.equipped[item.slot] === item.id);
          if (local)
            buttons +=
              button(
                "Store in stash",
                "store",
                c.equipped[item.slot] === item.id,
              ) + button("Modify in workshop", "workshop");
        }
        buttons +=
          button("Talent paths", "talents") +
          button("Character stats", "character") +
          back;
        body +=
          '<p class="campaign-hint">← → Items · L1 / R1 ( [ / ] ) equipment slot</p>';
      }
      if (screen === "stash")
        buttons =
          (item
            ? button("Move to satchel", "withdraw", c.items.length >= 40)
            : "") + back;
      if (screen === "stock")
        buttons =
          (item
            ? button(
                `Buy · ${money(Math.ceil(gearPrice(item) * marketMultiplier(s, this.hub)))}`,
                "buy",
              )
            : "") +
          button("New stock · $5", "refresh") +
          back;
      if (screen === "workshop") {
        const recipe = craftActions[this.recipe],
          cost =
            item && recipe === "upgrade"
              ? upgradeCost(item)
              : recipe === "reforge"
                ? workshopCosts.reforge
                : recipe === "brew"
                  ? workshopCosts.brew
                  : recipe === "salvage"
                    ? null
                    : workshopCosts.socket;
        const titles: Record<string, string> = {
          upgrade: "Temper equipment",
          reforge: "Reforge the final affix",
          ember: "Etch an Ember rune",
          frost: "Etch a Frost rune",
          vigor: "Etch a Vigor rune",
          fortune: "Etch a Fortune rune",
          brew: "Brew two prairie tonics",
          salvage: "Salvage this item",
        };
        const detail =
          recipe === "upgrade"
            ? "Improve implicit stats and all rolled affixes, up to +5."
            : recipe === "reforge"
              ? "Reroll the last affix. Legendary power and other affixes stay intact."
              : recipe === "salvage"
                ? "Destroy unequipped gear and recover crafting materials."
                : recipe === "brew"
                  ? "Turn gathered sage into healing supplies."
                  : (RUNES[recipe as keyof typeof RUNES]?.description ?? "");
        body += `<div class="recipe"><strong>${titles[recipe]}</strong><p>${detail}</p><span>${cost ? materialLine(cost) : "Yields scrap; higher rarities yield silver and essence."}</span></div><div class="materials">${Object.entries(
          c.materials,
        )
          .map(([k, n]) => `<span><b>${n}</b> ${k}</span>`)
          .join(
            "",
          )}</div><p class="campaign-hint">← → Item · L1 / R1 ( [ / ] ) recipe · ${this.recipe + 1}/${craftActions.length}</p>`;
        buttons =
          button("Apply recipe", "craft", !item && recipe !== "brew") + back;
      }
    }
    if (screen === "character") {
      const st = derivedStats(c, s.player.weapon);
      heading = "A legend in the making";
      kicker = `LEVEL ${c.progression.level} · ${c.progression.totalXP} TOTAL XP · MASTERY ${c.progression.mastery}`;
      body = `<div class="character-stats"><div><h3>Firepower</h3><p>Base shot <b>${(WEAPONS[s.player.weapon].damage * (1 + st.damage / 100)).toFixed(1)}</b></p><p>Critical chance <b>${st.crit.toFixed(0)}%</b></p><p>Critical damage <b>${(100 + st.critDamage).toFixed(0)}%</b></p><p>Reload speed <b>+${st.reload.toFixed(0)}%</b></p></div><div><h3>Survival</h3><p>Maximum health <b>${st.health.toFixed(0)}</b></p><p>Armor <b>${st.armor.toFixed(0)}</b></p><p>Resistance <b>${st.resist.toFixed(0)}%</b></p><p>Life on hit <b>${st.leech.toFixed(0)}</b></p></div><div><h3>The long road</h3><p>Movement <b>+${st.move.toFixed(0)}%</b></p><p>Riding efficiency <b>${st.ride.toFixed(0)}</b></p><p>Focus efficiency <b>${st.focus.toFixed(0)}</b></p><p>Loot fortune <b>${st.luck.toFixed(0)}</b></p></div></div><p class="character-powers">${st.aspects.map((a) => ASPECTS[a].name).join(" · ") || "Legendary powers unlock through gear and capstone talents."}</p>${st.sets.length ? `<p class="item-set">${st.sets.join(" · ")}</p>` : ""}<p class="campaign-hint">Base shot excludes Focus, critical hits and conditional powers. Elemental resistance protects against telegraphed hazards.</p>`;
      buttons = back;
    }
    if (screen === "talents") {
      heading = "Choose your legend";
      kicker = `LEVEL ${c.progression.level} · ${c.progression.points} TALENT POINT${c.progression.points === 1 ? "" : "S"}`;
      const node = this.selectedTalent,
        branch = ["Gunslinger", "Warden", "Outrider"][this.branch],
        nodes = TALENTS.filter((t) => t.branch === branch),
        rank = c.progression.talents[node.id] ?? 0,
        available =
          c.progression.points > 0 &&
          c.progression.level >= node.level &&
          rank < node.max &&
          (!node.requires || (c.progression.talents[node.requires] ?? 0) > 0);
      body =
        cycle(`${branch.toUpperCase()} · L1 / R1 CHANGES PATH`) +
        `<div class="talent-layout"><div class="talent-path">${nodes.map((t) => `<div class="${t.id === node.id ? "current" : ""}"><i>${c.progression.talents[t.id] ?? 0}</i><span>${t.name}<small>${c.progression.talents[t.id] ?? 0} / ${t.max}</small></span></div>`).join("")}</div><div><h3>${node.name}</h3><p>${node.description}</p><p class="talent-requirement">Level ${node.level}${node.requires ? ` · Requires ${TALENTS.find((t) => t.id === node.requires)!.name}` : ""}</p><p class="talent-rank">RANK ${rank} / ${node.max}</p><p class="campaign-hint">Build across all three paths. Equipment and talent powers work together.</p></div></div>`;
      buttons =
        button("Learn next rank", "learn", !available) +
        (local
          ? button(
              `Refund talents · ${money(c.progression.level * 5)}`,
              "respec",
              !Object.keys(c.progression.talents).length,
            )
          : "") +
        back;
    }
    if (screen === "campaign-choice") {
      heading = "The names in the ledger";
      kicker = "A PRICE FOR EVERY SECRET";
      body =
        "<p>The ledger connects respectable names to outlaw money. You can expose the network, or sell the information and leave part of it intact.</p>";
      buttons =
        button("Expose the network · renown & honor", "choice-protect") +
        button("Sell the information · 25% more pay", "choice-profit") +
        back;
    }
    return { heading, kicker, body, buttons };
  }
}
