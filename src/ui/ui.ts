import {
  ADA,
  BOSS,
  CAMP,
  CRATE,
  FIELD_GUIDE,
  GRAVE,
  MERCHANT,
  STAGES,
  WEAPONS,
  TRAIL,
} from "../game/content";
import { angleTo, distance, riverX } from "../engine/math";
import {
  LANDMARKS,
  FRONTIER_ROADS,
  landmarkById,
  regionAt,
} from "../game/territory";
import { territoryMap } from "./territory-map";
import type { Controls, GameState } from "../engine/types";
import type { Settings } from "../engine/save";
import type { Simulation } from "../engine/simulation";
import type { FrontierRenderer } from "../render/renderer";
import {
  CampaignUI,
  isCampaignScreen,
  type CampaignScreen,
} from "./campaign-ui";
import {
  HUBS,
  RARITIES,
  CONTRACT_NAMES,
  ENEMY_MODIFIERS,
} from "../game/campaign/catalog";
import { campaignNavigation } from "../engine/campaign/queries";
import { derivedStats, xpToNext } from "../engine/campaign/progression";
import { supplyPrice, nearbyHub } from "../engine/campaign/gear";
import type { CampaignEnemy } from "../engine/campaign/types";
import { DESTINATIONS, destinationById } from "../game/destinations";
export type Screen =
  | CampaignScreen
  | "title"
  | "playing"
  | "paused"
  | "settings"
  | "guide"
  | "journal"
  | "dialogue"
  | "choice"
  | "shop"
  | "dead"
  | "complete"
  | "error"
  | "confirm-new";
export type UIAction =
  | `campaign:${string}`
  | "start"
  | "continue"
  | "resume"
  | "title"
  | "settings"
  | "guide"
  | "range"
  | "back"
  | "dialogue"
  | "mercy"
  | "revenge"
  | "buy-tonic"
  | "buy-ammo"
  | "retry"
  | "replay"
  | "journal"
  | "mark-location"
  | "map-next"
  | "map-prev"
  | "confirm-new"
  | "cancel-new";
const star = '<span class="star">✦</span>';
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export class UI {
  readonly campaign = new CampaignUI();
  screen: Screen = "title";
  private selected = 0;
  private focusItems: HTMLElement[] = [];
  private guidePage = 0;
  private hasSave = false;
  private ready = false;
  private toastTime = 0;
  private chapterTime = 0;
  private hitTime = 0;
  private lastStage = "";
  private lastRegion = "";
  private journalIndex = 0;
  private journalState?: GameState;
  private campaignState?: GameState;
  get selectedWaypoint() {
    return DESTINATIONS[this.journalIndex - 1]?.id ?? null;
  }
  private map: CanvasRenderingContext2D;
  onAction: (action: UIAction) => void = () => {};
  onSetting: (s: Settings) => void = () => {};
  private root = document.querySelector<HTMLElement>("#ui")!;
  settings: Settings;
  device: "controller" | "keyboard" = "controller";
  private overlay: HTMLElement;
  private title: HTMLElement;
  private hud: HTMLElement;
  constructor(settings: Settings) {
    this.settings = settings;
    this.root.innerHTML = `<section id="title" class="screen title-screen"><div class="title-wash"></div><div class="topline"><span>${star} A FRONTIER STORY</span><span class="edition">VOL. 01 <i></i> CINDER CREEK</span></div><div class="title-content"><div class="eyebrow"><i></i> THE WEST DOESN’T FORGET.</div><h1><span>RED SKY</span><strong>RENEGADES</strong></h1><p class="tagline">There’s still time to do one good thing.</p><nav id="main-menu" aria-label="Main menu"></nav><div id="loading"><span class="spinner"></span> RIDING INTO THE FRONTIER</div></div><div class="title-bottom"><div><b>THE LAST GOOD DEED</b><span>A story of dust, debt, and second chances.</span></div><div id="idle-label">AUTOMATIC DEMO IN <b>10</b></div></div><div class="corner-mark">R S R <span>✦</span> 1893</div></section>
    <section id="hud" class="hidden" aria-label="Game heads-up display"><div class="objective"><span class="objective-icon">◇</span><div><small id="mission-kicker">THE LAST GOOD DEED</small><strong id="objective-title"></strong><p id="objective-text"></p></div></div><div class="compass"><span id="compass-directions"></span><b>◆</b></div><div id="wanted" class="hidden"></div><div id="chapter"><small>THE FRONTIER · 1893</small><h2>CINDER CREEK</h2><i></i></div><div class="lower-left"><div class="cores"><div class="core health"><span>♥</span><i></i><small>HEALTH</small></div><div class="core stamina"><span>ϟ</span><i></i><small>STAMINA</small></div><div class="core focus"><span>◉</span><i></i><small>FOCUS</small></div></div><div class="map-wrap"><canvas id="minimap" width="260" height="260" aria-label="Compass map with objective and enemy positions"></canvas><span>N</span></div><div class="region-label">CINDER CREEK TERRITORY</div></div><div class="lower-right"><span id="weapon-label">CATTLEMAN</span><div class="ammo"><strong id="ammo-count">6</strong><i></i><span id="ammo-reserve">48</span></div><div id="reload-label"></div><span id="cash"></span></div><div id="reticle"><i></i><b></b><em></em></div><div id="waypoint"></div><div id="prompt"><kbd>△</kbd><div><b></b><small></small></div></div><div id="control-strip"></div><button id="pause-button" aria-label="Pause game">Ⅱ</button></section>
    <div id="toast" role="status"><span>✦</span><div><strong></strong><p></p></div></div><div id="demo-label" class="hidden"><span class="demo-dot"></span> TALES FROM THE FRONTIER <b>AUTONOMOUS DEMO</b><small>ANY INPUT RETURNS TO TITLE</small></div><div id="wheel" class="hidden"><div class="wheel-title">THE ESSENTIALS<small>Release to equip</small></div><div class="wheel-grid"><div data-wheel="revolver"><span>Ⅰ</span>CATTLEMAN<small>Revolver</small></div><div data-wheel="rifle"><span>Ⅱ</span>LONGSHADOW<small>Repeater</small></div><div data-wheel="tonic"><span>✚</span>PRAIRIE TONIC<small>Restore health</small></div></div></div><section id="overlay" class="hidden"></section><div id="save-indicator">◇ PROGRESS SAVED</div>`;
    this.overlay = this.root.querySelector("#overlay")!;
    this.title = this.root.querySelector("#title")!;
    this.hud = this.root.querySelector("#hud")!;
    this.map = this.root
      .querySelector<HTMLCanvasElement>("#minimap")!
      .getContext("2d")!;
    this.root.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (b) this.onAction(b.dataset.action as UIAction);
    });
    this.root
      .querySelector(".lower-left")!
      .insertAdjacentHTML(
        "beforeend",
        '<div id="rider-progress"><strong></strong><div><i></i></div><small></small></div>',
      );
    this.root
      .querySelector("#hud")!
      .insertAdjacentHTML(
        "beforeend",
        '<div id="target-info" class="hidden"><strong></strong><div><i></i></div><small></small></div><div id="evade-status"></div>',
      );
    this.root
      .querySelector("#pause-button")!
      .addEventListener("click", () => this.onAction("resume"));
    this.root.addEventListener("pointerover", (e) => {
      const i = this.focusItems.indexOf(
        (e.target as HTMLElement).closest<HTMLElement>("button")!,
      );
      if (i >= 0) {
        this.selected = i;
        this.paintFocus();
      }
    });
    this.renderTitle();
  }
  private button(label: string, action: UIAction, sub = "") {
    return `<button data-action="${action}"><span class="menu-arrow">›</span><span>${label}${sub ? `<small>${sub}</small>` : ""}</span></button>`;
  }
  setReady(ready: boolean, hasSave: boolean) {
    this.ready = ready;
    this.hasSave = hasSave;
    this.renderTitle();
  }
  private renderTitle() {
    const menu = this.root.querySelector("#main-menu")!;
    menu.innerHTML =
      (this.hasSave ? this.button("Continue the story", "continue") : "") +
      this.button(
        this.hasSave ? "A new beginning" : "Begin the story",
        this.hasSave ? "confirm-new" : "start",
      ) +
      this.button("The proving ground", "range") +
      this.button("Field guide", "guide") +
      this.button("Settings", "settings");
    menu.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      if (
        ["start", "continue", "confirm-new", "range"].includes(
          b.dataset.action!,
        )
      )
        b.disabled = !this.ready;
    });
    this.root.querySelector("#loading")!.classList.toggle("hidden", this.ready);
    if (this.screen === "title") this.collect(menu as HTMLElement);
  }
  private collect(parent: HTMLElement) {
    this.focusItems = Array.from(
      parent.querySelectorAll<HTMLElement>(
        "button:not(:disabled):not([data-map-cycle]),input",
      ),
    );
    this.selected = 0;
    this.paintFocus();
  }
  private paintFocus() {
    this.focusItems.forEach((b, i) => {
      b.classList.toggle("selected", i === this.selected);
      b.tabIndex = i === this.selected ? 0 : -1;
    });
  }
  show(
    screen: Screen,
    s?: GameState,
    detail?: { speaker?: string; text?: string },
  ) {
    if (s) this.campaignState = s;
    this.screen = screen;
    this.title.classList.toggle("hidden", screen !== "title");
    this.hud.classList.toggle(
      "hidden",
      screen === "title" || screen === "error",
    );
    this.overlay.classList.toggle(
      "hidden",
      ["title", "playing"].includes(screen),
    );
    this.root.querySelector("#wheel")!.classList.add("hidden");
    if (screen === "title") {
      this.renderTitle();
      return;
    }
    if (screen === "playing") return;
    let kicker = "RED SKY RENEGADES",
      heading = "",
      body = "",
      buttons = "";
    if (isCampaignScreen(screen)) {
      const frame = this.campaign.render(screen, s!);
      heading = frame.heading;
      kicker = frame.kicker;
      body = frame.body;
      buttons = frame.buttons;
    } else
      switch (screen) {
        case "paused":
          heading = "Take a breath.";
          kicker = "THE FRONTIER CAN WAIT";
          buttons =
            this.button("Return to the trail", "resume") +
            (nearbyHub(s!)
              ? this.button("Local dispatch hub", "campaign:hub")
              : "") +
            this.button("Journal & map", "journal") +
            this.button("Contract journal", "campaign:contracts") +
            this.button("Equipment & talents", "campaign:equipment") +
            this.button("Field guide", "guide") +
            this.button("Settings", "settings") +
            this.button("Save & return to title", "title");
          break;
        case "confirm-new":
          heading = "A new beginning?";
          body =
            "<p>Your current trail will be replaced when the new story begins.</p>";
          buttons =
            this.button("Begin a new story", "start") +
            this.button("Keep my current trail", "cancel-new");
          break;
        case "settings":
          heading = "Make yourself at home.";
          kicker = "SETTINGS";
          body = this.settingsBody();
          buttons = this.button("Back to the trail", "back");
          break;
        case "guide":
          heading = "The rider’s field guide";
          kicker = `FIELD NOTES · ${this.guidePage + 1} / ${FIELD_GUIDE.length}`;
          body = this.guideBody();
          buttons =
            this.button("Turn the page", "guide") + this.button("Back", "back");
          break;
        case "journal":
          heading =
            s?.mode === "range" ? "The proving ground" : "The last good deed";
          kicker = "YOUR JOURNAL";
          this.journalState = s!;
          this.journalIndex = s!.explorationTarget
            ? DESTINATIONS.findIndex((l) => l.id === s!.explorationTarget) + 1
            : 0;
          body = this.journalBody(s!);
          buttons =
            this.button("Track this destination", "mark-location") +
            this.button("Contracts", "campaign:contracts") +
            this.button("Back to the trail", "back");
          break;
        case "dialogue":
          heading = detail?.speaker ?? "";
          kicker = "A MOMENT ON THE FRONTIER";
          body = `<p class="dialogue-copy">${esc(detail?.text ?? "")}</p>`;
          buttons = this.button("Continue", "dialogue");
          break;
        case "choice":
          heading = "“I’ve got a family.”";
          kicker = "THE WEIGHT OF MERCY";
          body =
            "<p>The leader lets his revolver fall. The medicine is yours. Only one decision remains.</p>";
          buttons =
            this.button(
              "Let him walk",
              "mercy",
              "Mercy leaves a different kind of mark.",
            ) +
            this.button(
              "Settle the debt",
              "revenge",
              "Some debts follow you home.",
            );
          break;
        case "shop":
          heading = "Elias’s provisions";
          kicker = `CINDER CREEK · $${s!.inventory.dollars.toFixed(2)}`;
          body =
            "<p>“A full cylinder and a little medicine. That’s a fair start.”</p>";
          buttons =
            this.button(
              `Prairie tonic · $${supplyPrice(s!, "tonic")}`,
              "buy-tonic",
              "Restore 65 health and 25 focus",
            ) +
            this.button(
              `Ammunition bundle · $${supplyPrice(s!, "ammo")}`,
              "buy-ammo",
              "18 revolver rounds · 12 repeater rounds",
            ) +
            this.button("Leave the counter", "back");
          break;
        case "dead":
          heading = "The dust settles.";
          kicker = "YOUR STORY ISN’T OVER";
          body = "<p>Return to your last camp or mission checkpoint.</p>";
          buttons =
            this.button("Try again", "retry") +
            this.button("Return to title", "title");
          break;
        case "complete":
          heading = "One good thing.";
          kicker = "THE LAST GOOD DEED · COMPLETE";
          body = `<p>${s!.choice === "mercy" ? "You spared a life and saved a camp. The West might remember." : "The medicine made it home. So did the weight of your decision."}</p><div class="results"><div><b>${Math.floor(s!.elapsed / 60)}:${String(Math.floor(s!.elapsed % 60)).padStart(2, "0")}</b><small>TIME ON THE TRAIL</small></div><div><b>${s!.shots ? Math.round((s!.hits / s!.shots) * 100) : 0}%</b><small>ACCURACY</small></div><div><b>${s!.honor >= 0 ? "+" : ""}${s!.honor}</b><small>HONOR</small></div></div><p class="reward">+$65 · Camp supplies restored</p>`;
          buttons =
            this.button("Stay a while", "resume") +
            this.button("Ride it again", "replay") +
            this.button("Return to title", "title");
          break;
        case "error":
          heading = "The frontier needs WebGPU.";
          kicker = "RENDERER UNAVAILABLE";
          body = `<p>${esc(detail?.text ?? "A WebGPU-capable browser and GPU are required.")}</p><p class="muted">Enable hardware acceleration and open this page in a browser with WebGPU support. This edition renders exclusively with WebGPU.</p>`;
          buttons =
            '<button onclick="location.reload()"><span class="menu-arrow">›</span>Try again</button>';
          break;
      }
    this.overlay.innerHTML = `<div class="modal-backdrop"></div><div class="panel ${screen}"><div class="eyebrow">${star} ${kicker}</div><h2>${heading}</h2>${body}<nav aria-label="${screen} menu">${buttons}</nav><div class="panel-footer"><span><kbd>×</kbd> SELECT</span><span><kbd>○</kbd> BACK</span><span class="footer-star">✦</span></div></div>`;
    this.collect(this.overlay);
    this.overlay.querySelectorAll<HTMLInputElement>("input").forEach((input) =>
      input.addEventListener("input", () => {
        const key = input.dataset.setting as keyof Settings;
        (this.settings as unknown as Record<string, unknown>)[key] =
          input.type === "checkbox" ? input.checked : Number(input.value);
        this.onSetting(this.settings);
      }),
    );
    this.overlay
      .querySelector("[data-quality]")
      ?.addEventListener("click", () => {
        this.settings.quality =
          this.settings.quality === "high" ? "balanced" : "high";
        this.onSetting(this.settings);
        this.show("settings");
      });
  }
  private settingsBody() {
    const s = this.settings;
    return `<div class="settings-list"><label><span>Sound volume</span><input aria-label="Sound volume" data-setting="volume" type="range" min="0" max="1" step=".1" value="${s.volume}"></label><label><span>Music volume</span><input aria-label="Music volume" data-setting="music" type="range" min="0" max="1" step=".1" value="${s.music}"></label><label><span>Camera sensitivity</span><input aria-label="Camera sensitivity" data-setting="sensitivity" type="range" min=".4" max="2" step=".1" value="${s.sensitivity}"></label><label><span>Invert vertical look</span><input aria-label="Invert vertical look" data-setting="invertY" type="checkbox" ${s.invertY ? "checked" : ""}></label><label><span>Camera shake</span><input aria-label="Camera shake" data-setting="shake" type="checkbox" ${s.shake ? "checked" : ""}></label><label><span>Trail remarks</span><input aria-label="Trail remarks" data-setting="subtitles" type="checkbox" ${s.subtitles ? "checked" : ""}></label><button data-quality>Visual quality <b>${s.quality === "high" ? "HIGH" : "BALANCED"}</b></button></div>`;
  }
  private guideBody() {
    const p = FIELD_GUIDE[this.guidePage];
    return `<div class="guide-page"><span class="guide-number">0${this.guidePage + 1}</span><h3>${p.title}</h3><p>${p.copy}</p><small>KEYBOARD & MOUSE</small><p class="key-guide">${p.keys}</p></div>`;
  }
  nextGuide() {
    this.guidePage = (this.guidePage + 1) % FIELD_GUIDE.length;
    this.show("guide");
  }
  private journalBody(s: GameState) {
    const stage = STAGES.find((t) => t.id === s.stage)!;
    const place = DESTINATIONS[this.journalIndex - 1],
      target = place ?? stage.target;
    return `<div class="journal-layout"><div class="journal-map">${territoryMap(s, this.journalIndex)}</div><div class="destination"><div class="destination-cycle"><button data-map-cycle tabindex="-1" data-action="map-prev" aria-label="Previous destination">‹</button><span>${place ? (place.isHub ? "DISPATCH HUB" : `TRAIL MARKER ${this.journalIndex} / ${LANDMARKS.length}`) : "STORY OBJECTIVE"}</span><button data-map-cycle tabindex="-1" data-action="map-next" aria-label="Next destination">›</button></div><h3>${place?.name ?? stage.title}</h3><p>${place?.description ?? stage.text}</p><p class="destination-distance">${Math.round(distance(s.player, target))} m away${place ? ` · ${place.isHub ? "Services available" : s.discovered.includes(place.id) ? "Discovered" : "Unexplored"}` : ""}</p><p class="map-instructions">← → Choose a destination<br>× Track it on your compass</p><div class="journal-progress">${LANDMARKS.map((l) => `<i class="${s.discovered.includes(l.id) ? "done" : ""}"></i>`).join("")}</div><p class="discovery-count">${s.discovered.length} of ${LANDMARKS.length} frontier landmarks discovered</p><div class="inventory-line"><span>$${s.inventory.dollars.toFixed(2)}</span><span>${s.inventory.tonics} tonics</span><span>${s.inventory.herbs} sage</span></div></div></div>`;
  }
  cycleDestination(direction: number) {
    if (!this.journalState) return;
    this.journalIndex =
      (this.journalIndex + direction + DESTINATIONS.length + 1) %
      (DESTINATIONS.length + 1);
    this.overlay.querySelector(".journal-layout")!.outerHTML = this.journalBody(
      this.journalState,
    );
    this.collect(this.overlay);
  }
  navigate(c: Controls) {
    if (this.screen === "playing") return;
    if (this.screen === "hub") {
      const count = this.focusItems.length,
        rows = Math.ceil(count / 2),
        row = Math.floor(this.selected / 2),
        column = this.selected % 2;
      if (c.navY)
        this.selected = Math.min(
          count - 1,
          ((row + c.navY + rows) % rows) * 2 + column,
        );
      else if (c.navX)
        this.selected = Math.min(
          count - 1,
          row * 2 + ((column + c.navX + 2) % 2),
        );
      this.paintFocus();
      if (c.confirm) this.focusItems[this.selected]?.click();
      else if (c.back) this.onAction("campaign:back");
      return;
    }
    if (c.navY) {
      this.selected =
        (this.selected + c.navY + this.focusItems.length) %
        this.focusItems.length;
      this.paintFocus();
      this.focusItems[this.selected]?.scrollIntoView({ block: "nearest" });
    }
    const focused = this.focusItems[this.selected];
    if (
      c.navX &&
      focused instanceof HTMLInputElement &&
      focused.type === "range"
    ) {
      focused.value = String(
        Number(focused.value) + c.navX * Number(focused.step),
      );
      focused.dispatchEvent(new Event("input"));
    }
    if (c.navX && this.screen === "guide") {
      this.guidePage =
        (this.guidePage + c.navX + FIELD_GUIDE.length) % FIELD_GUIDE.length;
      this.show("guide");
    }
    if (c.navX && this.screen === "journal") this.cycleDestination(c.navX);
    if (isCampaignScreen(this.screen) && (c.navX || c.page)) {
      const screen = this.screen;
      if (c.page) this.campaign.page(c.page);
      else this.campaign.cycle(c.navX);
      this.show(screen, this.campaignState!);
      return;
    }
    if (c.confirm) focused?.click();
    else if (c.back && this.screen !== "title") this.onAction("back");
  }
  toast(title: string, text = "") {
    const el = this.root.querySelector("#toast")!;
    el.querySelector("strong")!.textContent = title;
    el.querySelector("p")!.textContent = text;
    el.classList.add("visible");
    this.toastTime = 4.5;
  }
  saved() {
    const el = this.root.querySelector("#save-indicator")!;
    el.classList.add("visible");
    setTimeout(() => el.classList.remove("visible"), 1700);
  }
  chapter(name: string) {
    const el = this.root.querySelector("#chapter")!;
    el.querySelector("h2")!.textContent = name;
    this.chapterTime = 5;
  }
  hit() {
    this.hitTime = 0.2;
  }
  wheel(show: boolean, selection: string) {
    const w = this.root.querySelector("#wheel")!;
    w.classList.toggle("hidden", !show);
    w.querySelectorAll<HTMLElement>("[data-wheel]").forEach((e) =>
      e.classList.toggle("selected", e.dataset.wheel === selection),
    );
  }
  demo(active: boolean) {
    this.root.querySelector("#demo-label")!.classList.toggle("hidden", !active);
    document.body.classList.toggle("demo", active);
  }
  tick(
    dt: number,
    sim: Simulation,
    view: FrontierRenderer | null,
    idleSeconds: number,
  ) {
    this.toastTime -= dt;
    this.chapterTime -= dt;
    this.hitTime -= dt;
    this.root
      .querySelector("#toast")!
      .classList.toggle("visible", this.toastTime > 0);
    this.root
      .querySelector("#chapter")!
      .classList.toggle("visible", this.chapterTime > 0);
    const idle = this.root.querySelector("#idle-label b");
    if (idle)
      idle.textContent = String(Math.max(0, Math.ceil(10 - idleSeconds)));
    if (this.screen === "title" || this.screen === "error") return;
    const s = sim.state,
      p = s.player,
      stage = STAGES.find((t) => t.id === s.stage)!,
      contract = campaignNavigation(s),
      exploration = destinationById(s.explorationTarget),
      way = contract?.position ?? exploration ?? stage.target,
      region = regionAt(p.x, p.z);
    if (`${s.mode}:${s.stage}` !== this.lastStage) {
      this.lastStage = `${s.mode}:${s.stage}`;
      this.chapter(s.mode === "range" ? "THE PROVING GROUND" : stage.location);
    }
    if (
      region !== this.lastRegion &&
      Math.max(Math.abs(p.x), Math.abs(p.z)) > 110
    )
      this.chapter(region);
    this.lastRegion = region;
    this.setText(".region-label", region);
    this.setText(
      "#mission-kicker",
      contract
        ? `${CONTRACT_NAMES[contract.contract.kind].toUpperCase()} · TIER ${contract.contract.tier}`
        : exploration
          ? "EXPLORING THE FRONTIER"
          : s.mode === "range"
            ? "THE PROVING GROUND"
            : "THE LAST GOOD DEED",
    );
    this.setText(
      "#objective-title",
      contract?.title ??
        exploration?.name ??
        (s.mode === "range" ? "Make every shot count" : stage.title),
    );
    this.setText(
      "#objective-text",
      contract
        ? contract.text
        : exploration
          ? exploration.description
          : s.mode === "range"
            ? "Aim at five targets. Use the range sign to reset."
            : stage.text,
    );
    const degrees =
      (((Math.PI - (view?.yaw ?? 0)) * 180) / Math.PI + 360) % 360;
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(degrees / 45) % 8;
    this.setText(
      "#compass-directions",
      `${directions[(index + 7) % 8]}           ${directions[index]}           ${directions[(index + 1) % 8]}`,
    );
    const wanted = this.root.querySelector("#wanted")!;
    wanted.classList.toggle("hidden", s.heat <= 0);
    wanted.textContent = `WANTED · $${s.bounty} · ${Math.ceil(s.heat)}s`;
    const stats = sim.campaign.stats;
    this.core("health", (p.health / stats.health) * 100);
    this.core("stamina", p.mounted ? s.horse.stamina : p.stamina);
    this.core("focus", p.focus);
    this.setText(
      "#weapon-label",
      (
        s.campaign.items.find((i) => i.id === s.campaign.equipped[p.weapon])
          ?.name ?? WEAPONS[p.weapon].name
      ).toUpperCase(),
    );
    this.setText("#ammo-count", String(p.ammo[p.weapon]).padStart(2, "0"));
    this.setText("#ammo-reserve", String(p.reserve[p.weapon]));
    this.setText(
      "#reload-label",
      p.reload > 0 ? "RELOADING" : p.focusing ? "FOCUS ACTIVE" : "",
    );
    this.setText("#cash", `$${s.inventory.dollars.toFixed(2)}`);
    const ret = this.root.querySelector("#reticle")!;
    ret.classList.toggle("aiming", p.aiming);
    ret.classList.toggle("hit", this.hitTime > 0);
    ret.classList.toggle("locked", !!view && !!sim.aimTarget(view.yaw));
    const target = view && p.aiming ? sim.aimTarget(view.yaw) : undefined,
      targetInfo = this.root.querySelector("#target-info")!;
    targetInfo.classList.toggle("hidden", !target);
    if (target) {
      const enemy = "owner" in target ? (target as CampaignEnemy) : null;
      targetInfo.querySelector("strong")!.textContent = enemy
        ? `Lv ${enemy.level} · ${enemy.name}${enemy.boss ? " ★" : ""}`
        : "Cinder outlaw";
      (targetInfo.querySelector("i") as HTMLElement).style.width =
        `${Math.max(0, (target.health / (enemy?.maxHealth ?? 100)) * 100)}%`;
      targetInfo.querySelector("small")!.textContent =
        enemy?.boss && enemy.health <= enemy.maxHealth * 0.3
          ? "HOLD FIRE · APPROACH TO CAPTURE"
          : (enemy?.modifiers
              .map(
                (m) => ENEMY_MODIFIERS[m as keyof typeof ENEMY_MODIFIERS].name,
              )
              .join(" · ") ?? "");
    }
    const progression = s.campaign.progression,
      xp = progression.level === 30 ? progression.masteryXP : progression.xp,
      next = progression.level === 30 ? 1500 : xpToNext(progression.level),
      xpEl = this.root.querySelector("#rider-progress")!;
    xpEl.querySelector("strong")!.textContent =
      `LV ${progression.level}${progression.level === 30 ? ` · M${progression.mastery}` : ""}`;
    (xpEl.querySelector("i") as HTMLElement).style.width =
      `${progression.mastery === 100 ? 100 : Math.min(100, (xp / next) * 100)}%`;
    xpEl.querySelector("small")!.textContent =
      `${progression.mastery === 100 ? "MAX MASTERY" : `${xp} / ${next} XP`}${progression.points ? ` · ${progression.points} TALENT POINT${progression.points === 1 ? "" : "S"}` : ""}`;
    this.setText(
      "#evade-status",
      s.campaign.shield > 0
        ? `BARRIER ${Math.ceil(s.campaign.shield)}`
        : p.dodgeCooldown > 0
          ? `EVADE ${p.dodgeCooldown.toFixed(1)}s`
          : "",
    );
    const interaction = sim.interactable(),
      prompt = this.root.querySelector("#prompt")!;
    prompt.classList.toggle(
      "visible",
      !!interaction && this.screen === "playing",
    );
    if (interaction) {
      prompt.querySelector("b")!.textContent = interaction.label;
      prompt.querySelector("small")!.textContent = interaction.hint;
      prompt.querySelector("kbd")!.textContent =
        this.device === "controller" ? "△" : "E";
    }
    this.setText(
      "#control-strip",
      this.device === "controller"
        ? "L2  AIM     R2  FIRE     ○  EVADE     L1  EQUIPMENT     ⊕  JOURNAL"
        : "RMB  AIM / LOOK     LMB  FIRE     V  EVADE     Q  EQUIPMENT     TAB  JOURNAL",
    );
    const marker = this.root.querySelector<HTMLElement>("#waypoint")!;
    if (view && (contract || exploration || s.stage !== "complete")) {
      const projected = view.project(way.x, way.z, 3.4);
      marker.style.left = projected.x + "px";
      marker.style.top = projected.y + "px";
      marker.classList.toggle(
        "visible",
        projected.visible && distance(p, way) > 8,
      );
      marker.innerHTML = `<span>◇</span><small>${Math.round(distance(p, way))} m</small>`;
    } else marker.classList.remove("visible");
    this.drawMap(s, view?.yaw ?? 0);
  }
  private setText(selector: string, text: string) {
    const el = this.root.querySelector(selector)!;
    if (el.textContent !== text) el.textContent = text;
  }
  private core(key: string, value: number) {
    this.root
      .querySelector<HTMLElement>(`.core.${key}`)!
      .style.setProperty("--value", `${value}%`);
  }
  private drawMap(s: GameState, yaw: number) {
    const c = this.map,
      w = 260,
      scale = 1.45,
      p = s.player;
    c.clearRect(0, 0, w, w);
    c.save();
    c.translate(130, 130);
    c.beginPath();
    c.arc(0, 0, 123, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = "#b9a984";
    c.fillRect(-130, -130, 260, 260);
    c.strokeStyle = "#8e9b8a";
    c.lineWidth = 12;
    c.beginPath();
    for (let z = p.z - 100; z <= p.z + 100; z += 2) {
      const x = riverX(z);
      const px = (x - p.x) * scale,
        pz = (z - p.z) * scale;
      z === p.z - 100 ? c.moveTo(px, pz) : c.lineTo(px, pz);
    }
    c.stroke();
    c.strokeStyle = "#d7c59c";
    c.lineWidth = 4;
    for (const points of [TRAIL, ...FRONTIER_ROADS]) {
      c.beginPath();
      points.forEach((v, i) =>
        i
          ? c.lineTo((v.x - p.x) * scale, (v.z - p.z) * scale)
          : c.moveTo((v.x - p.x) * scale, (v.z - p.z) * scale),
      );
      c.stroke();
    }
    for (const e of [...s.enemies, ...s.campaign.enemies])
      if (
        e.health > 0 &&
        !("captured" in e && e.captured) &&
        distance(p, e) < 55
      ) {
        c.fillStyle = "#a24d3b";
        c.beginPath();
        c.arc((e.x - p.x) * scale, (e.z - p.z) * scale, 4, 0, 7);
        c.fill();
      }
    c.fillStyle = "#384c48";
    for (const v of [CAMP, MERCHANT, GRAVE]) {
      c.fillRect((v.x - p.x) * scale - 3, (v.z - p.z) * scale - 3, 6, 6);
    }
    for (const hub of HUBS) {
      const x = (hub.x - p.x) * scale,
        z = (hub.z - p.z) * scale;
      c.fillStyle = "#e6ca83";
      c.fillRect(x - 4, z - 4, 8, 8);
      c.strokeStyle = "#475c41";
      c.strokeRect(x - 4, z - 4, 8, 8);
    }
    LANDMARKS.forEach((l, i) => {
      if (distance(p, l) < 90) {
        const x = (l.x - p.x) * scale,
          z = (l.z - p.z) * scale;
        c.fillStyle = s.discovered.includes(l.id) ? "#526446" : "#d7be86";
        c.beginPath();
        c.arc(x, z, 5, 0, 7);
        c.fill();
        c.fillStyle = "#283c30";
        c.font = "bold 8px Arial";
        c.textAlign = "center";
        c.fillText(String(i + 1), x, z + 3);
      }
    });
    if (!p.mounted) {
      c.fillStyle = "#65482b";
      c.beginPath();
      c.arc((s.horse.x - p.x) * scale, (s.horse.z - p.z) * scale, 4, 0, 7);
      c.fill();
    }
    const target =
      campaignNavigation(s)?.position ??
      destinationById(s.explorationTarget) ??
      (s.mode === "range"
        ? { x: 84, z: 49 }
        : STAGES.find((t) => t.id === s.stage)!.target);
    let tx = (target.x - p.x) * scale,
      tz = (target.z - p.z) * scale;
    const d = Math.hypot(tx, tz);
    if (d > 108) {
      tx *= 108 / d;
      tz *= 108 / d;
    }
    c.fillStyle = "#e7c16d";
    c.strokeStyle = "#6c5934";
    c.lineWidth = 2;
    c.save();
    c.translate(tx, tz);
    c.rotate(Math.PI / 4);
    c.fillRect(-5, -5, 10, 10);
    c.strokeRect(-5, -5, 10, 10);
    c.restore();
    c.rotate(-p.yaw + Math.PI);
    c.fillStyle = "#f9ead0";
    c.strokeStyle = "#33413a";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -9);
    c.lineTo(-6, 6);
    c.lineTo(0, 3);
    c.lineTo(6, 6);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }
}
