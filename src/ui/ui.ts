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
} from "../game/content";
import { angleTo, distance } from "../engine/math";
import type { Controls, GameState } from "../engine/types";
import type { Settings } from "../engine/save";
import type { Simulation } from "../engine/simulation";
import type { FrontierRenderer } from "../render/renderer";
export type Screen =
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
      parent.querySelectorAll<HTMLElement>("button:not(:disabled),input"),
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
    switch (screen) {
      case "paused":
        heading = "Take a breath.";
        kicker = "THE FRONTIER CAN WAIT";
        buttons =
          this.button("Return to the trail", "resume") +
          this.button("Journal & map", "journal") +
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
        body = this.journalBody(s!);
        buttons = this.button("Back to the trail", "back");
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
            "Prairie tonic · $8",
            "buy-tonic",
            "Restore 65 health and 25 focus",
          ) +
          this.button(
            "Ammunition bundle · $6",
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
    const step = STAGES.indexOf(stage);
    return `<div class="journal-layout"><div class="journal-map"><svg viewBox="0 0 400 300" role="img" aria-label="Territory map: Cinder Creek to Mercy Station"><path class="map-river" d="M170 -20 Q230 65 180 140 T180 330"/><path class="map-trail" d="M75 236 Q110 145 173 140 T302 72"/><path class="map-mesa" d="m280 160 30-45 28 45zm-245-90 32-40 30 40z"/><circle cx="75" cy="236" r="7"/><circle cx="302" cy="72" r="7"/><text x="22" y="266">CINDER CREEK</text><text x="230" y="52">MERCY STATION</text><text x="174" y="127">BRIDGE</text><text x="130" y="185">WAGON</text><text x="365" y="30">N ↑</text><circle class="map-player" cx="${(s.player.x + 85) * 2}" cy="${(s.player.z + 65) * 2}" r="5"/></svg></div><div><h3>${stage.title}</h3><p>${stage.text}</p><div class="journal-progress">${STAGES.slice(
      0,
      8,
    )
      .map((t, i) => `<i class="${i <= step ? "done" : ""}"></i>`)
      .join(
        "",
      )}</div><div class="inventory-line"><span>$${s.inventory.dollars.toFixed(2)}</span><span>${s.inventory.tonics} tonics</span><span>${s.inventory.herbs} sage</span></div><p class="muted">Honor ${s.honor >= 0 ? "+" : ""}${s.honor} · Bounty $${s.bounty}<br>Juniper’s bond ${Math.floor(s.horse.bond)}%${s.inventory.relic ? "<br>✓ Forgotten memorial discovered" : ""}</p></div></div>`;
  }
  navigate(c: Controls) {
    if (this.screen === "playing") return;
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
      way = stage.target;
    if (`${s.mode}:${s.stage}` !== this.lastStage) {
      this.lastStage = `${s.mode}:${s.stage}`;
      this.chapter(s.mode === "range" ? "THE PROVING GROUND" : stage.location);
    }
    this.setText(
      "#mission-kicker",
      s.mode === "range" ? "THE PROVING GROUND" : "THE LAST GOOD DEED",
    );
    this.setText(
      "#objective-title",
      s.mode === "range" ? "Make every shot count" : stage.title,
    );
    this.setText(
      "#objective-text",
      s.mode === "range"
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
    this.core("health", p.health);
    this.core("stamina", p.mounted ? s.horse.stamina : p.stamina);
    this.core("focus", p.focus);
    this.setText("#weapon-label", WEAPONS[p.weapon].name.toUpperCase());
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
        ? "L2  AIM     R2  FIRE     L1  EQUIPMENT     ⊕  JOURNAL"
        : "RMB  AIM / LOOK     LMB  FIRE     Q  EQUIPMENT     TAB  JOURNAL",
    );
    const marker = this.root.querySelector<HTMLElement>("#waypoint")!;
    if (view && s.stage !== "complete") {
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
    for (let z = -160; z <= 160; z += 2) {
      const x = -8 + Math.sin(z * 0.028) * 8;
      const px = (x - p.x) * scale,
        pz = (z - p.z) * scale;
      z === -160 ? c.moveTo(px, pz) : c.lineTo(px, pz);
    }
    c.stroke();
    const points = [
      CAMP,
      { x: -28, z: 18 },
      { x: -21, z: 6 },
      { x: 7, z: 6 },
      { x: 27, z: -14 },
      { x: 39, z: -29 },
    ];
    c.strokeStyle = "#d7c59c";
    c.lineWidth = 4;
    c.beginPath();
    points.forEach((v, i) =>
      i
        ? c.lineTo((v.x - p.x) * scale, (v.z - p.z) * scale)
        : c.moveTo((v.x - p.x) * scale, (v.z - p.z) * scale),
    );
    c.stroke();
    for (const e of s.enemies)
      if (e.health > 0 && distance(p, e) < 55) {
        c.fillStyle = "#a24d3b";
        c.beginPath();
        c.arc((e.x - p.x) * scale, (e.z - p.z) * scale, 4, 0, 7);
        c.fill();
      }
    c.fillStyle = "#384c48";
    for (const v of [CAMP, MERCHANT, GRAVE]) {
      c.fillRect((v.x - p.x) * scale - 3, (v.z - p.z) * scale - 3, 6, 6);
    }
    if (!p.mounted) {
      c.fillStyle = "#65482b";
      c.beginPath();
      c.arc((s.horse.x - p.x) * scale, (s.horse.z - p.z) * scale, 4, 0, 7);
      c.fill();
    }
    const target =
      s.mode === "range"
        ? { x: 84, z: 49 }
        : STAGES.find((t) => t.id === s.stage)!.target;
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
