import "./ui/style.css";
import { Simulation, newGame } from "./engine/simulation";
import { Input } from "./engine/input";
import { AudioEngine } from "./engine/audio";
import { SaveStore, recoveredSave } from "./engine/save";
import { emptyControls } from "./engine/types";
import { Director } from "./game/director";
import { FrontierRenderer } from "./render/renderer";
import { UI, type UIAction, type Screen } from "./ui/ui";
import {
  isCampaignScreen,
  craftActions,
  type CampaignScreen,
} from "./ui/campaign-ui";
import { HUBS, RARITIES, GEAR_SLOTS } from "./game/campaign/catalog";
import { TRAIL } from "./game/content";
import { unlockedTier, derivedStats } from "./engine/campaign/progression";
import type { RuneId } from "./engine/campaign/types";
import identity from "./game/identity.json";
import {
  MAP_AREA,
  MAP_HALF_EXTENT,
  MAP_AREA_MULTIPLIER,
  LANDMARKS,
  FRONTIER_ROADS,
} from "./game/territory";

const canvas = document.querySelector<HTMLCanvasElement>("#world")!;
const storage = new SaveStore({
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
  removeItem: (k) => localStorage.removeItem(k),
});
const settings = storage.settings(),
  ui = new UI(settings),
  input = new Input(canvas),
  audio = new AudioEngine(settings);
let sim = new Simulation(),
  renderer: FrontierRenderer | null = null,
  demo = false,
  director = new Director(),
  ready = false;
let previous = performance.now(),
  lastSave = 0,
  wheelOpen = false,
  wheelChoice = "revolver",
  interrupted = false,
  returnScreen: Screen = "title";
let demoRuns = 0,
  demoCompletions = 0,
  playedSeconds = 0;
const campaignStack: Screen[] = [];
function openCampaign(screen: CampaignScreen) {
  const hub = HUBS.find(
    (h) => Math.hypot(h.x - sim.state.player.x, h.z - sim.state.player.z) < 7,
  );
  if (hub) ui.campaign.hub = hub.id;
  campaignStack.push(ui.screen);
  ui.show(screen, sim.state);
}
function campaignAction(action: string) {
  const c = ui.campaign;
  if (isCampaignScreen(action)) {
    if (action === "workshop" && ui.screen === "equipment")
      c.workshopItem(c.selectedItem?.id);
    openCampaign(action);
    return;
  }
  const job = c.selectedContract,
    item = c.selectedItem,
    gear = sim.campaign.gear;
  switch (action) {
    case "prev":
      c.cycle(-1);
      break;
    case "next":
      c.cycle(1);
      break;
    case "page-prev":
      c.page(-1);
      break;
    case "page-next":
      c.page(1);
      break;
    case "back":
      goBack();
      return;
    case "close":
      campaignStack.length = 0;
      ui.show("playing");
      return;
    case "accept":
      if (job && sim.campaign.accept(c.hub, job.id)) {
        campaignStack.length = 0;
        ui.show("playing");
        return;
      }
      break;
    case "track":
      if (job && sim.campaign.track(job.id)) {
        campaignStack.length = 0;
        ui.show("playing");
        return;
      }
      break;
    case "claim":
      if (job) sim.campaign.claim(job.id);
      break;
    case "retry":
      if (job && sim.campaign.retry(job.id)) {
        campaignStack.length = 0;
        ui.show("playing");
        return;
      }
      break;
    case "abandon":
      if (job) sim.campaign.abandon(job.id);
      break;
    case "refresh":
      sim.campaign.refresh(c.hub);
      break;
    case "difficulty":
      sim.campaign.setDifficulty(
        (sim.state.campaign.difficulty % unlockedTier(sim.state.campaign)) + 1,
      );
      break;
    case "equip":
      if (item) gear.equip(item.id);
      break;
    case "store":
      if (item) gear.store(item.id);
      break;
    case "withdraw":
      if (item) gear.withdraw(item.id);
      break;
    case "buy":
      if (item) gear.buy(c.hub, item.id);
      break;
    case "learn":
      gear.learn(c.selectedTalent.id);
      break;
    case "respec":
      gear.respec();
      break;
    case "pay-bounty":
      gear.payBounty();
      break;
    case "craft": {
      const recipe = craftActions[c.recipe];
      if (recipe === "brew") gear.brew();
      else if (item) {
        if (recipe === "upgrade") gear.upgrade(item.id);
        else if (recipe === "reforge") gear.reforge(item.id);
        else if (recipe === "salvage") gear.salvage(item.id);
        else gear.socket(item.id, recipe as RuneId);
      }
      break;
    }
    case "choice-protect":
    case "choice-profit":
      if (
        sim.campaign.choose(
          c.pendingChoice,
          action === "choice-protect" ? "protect" : "profit",
        )
      ) {
        campaignStack.length = 0;
        ui.show("playing");
        return;
      }
      break;
  }
  if (isCampaignScreen(ui.screen)) ui.show(ui.screen, sim.state);
}

function save() {
  if (!demo && sim.state.mode === "story" && sim.state.player.health > 0) {
    if (storage.write(sim.state)) ui.saved();
    else ui.toast("Progress could not be saved", storage.error);
  }
}
function start(mode: "story" | "range" = "story", continuing = false) {
  campaignStack.length = 0;
  demo = false;
  ui.demo(false);
  sim = new Simulation(
    continuing
      ? (storage.load() ?? newGame(mode))
      : newGame(mode, crypto.getRandomValues(new Uint32Array(1))[0]),
  );
  renderer?.resetCamera();
  ui.show("playing");
  input.clear();
  input.lastActivity = performance.now();
  document.body.classList.remove("menu-open");
  lastSave = 0;
  if (mode === "story" && !continuing) save();
  ui.chapter(mode === "range" ? "THE PROVING GROUND" : "CINDER CREEK");
  if (mode === "story" && !continuing)
    ui.toast(
      "Work waits at the dispatch board",
      "The board beside Juniper offers contracts, gear and talents.",
    );
}
function title(saveFirst = true) {
  campaignStack.length = 0;
  if (saveFirst) save();
  demo = false;
  ui.demo(false);
  sim = new Simulation();
  ui.setReady(ready, !!storage.load());
  ui.show("title");
  input.clear();
  input.lastActivity = performance.now();
  wheelOpen = false;
}
function startDemo() {
  if (!ready) return;
  demo = true;
  demoRuns++;
  director = new Director();
  sim = new Simulation();
  renderer?.resetCamera();
  ui.show("playing");
  ui.demo(true);
  document.body.classList.remove("menu-open");
}
function goBack() {
  if (isCampaignScreen(ui.screen)) {
    ui.show(campaignStack.pop() ?? "playing", sim.state);
    return;
  }
  if (
    ui.screen === "paused" ||
    ui.screen === "journal" ||
    ui.screen === "shop"
  ) {
    ui.show("playing");
    return;
  }
  if (ui.screen === "settings" || ui.screen === "guide") {
    ui.show(returnScreen, sim.state);
    return;
  }
  if (ui.screen === "dialogue") {
    sim.respond();
    ui.show("playing");
    return;
  }
  if (ui.screen === "confirm-new") {
    ui.show("title");
    return;
  }
  if (ui.screen === "complete") {
    ui.show("playing");
    return;
  }
  if (ui.screen === "choice") {
    return;
  }
  if (ui.screen === "dead") {
    title(false);
    return;
  }
}
function action(a: UIAction) {
  // A menu click/confirm must never become a gunshot when play resumes.
  input.clear();
  audio.unlock();
  audio.play("click");
  if (demo) {
    title(false);
    return;
  }
  if (a.startsWith("campaign:")) {
    campaignAction(a.slice(9));
    return;
  }
  switch (a) {
    case "start":
      if (ready) start();
      break;
    case "replay": {
      const previous = sim.state,
        next = newGame("story");
      next.campaign = structuredClone(previous.campaign);
      next.campaign.tracked = null;
      next.inventory = { ...previous.inventory, medicine: false };
      next.discovered = [...previous.discovered];
      next.honor = previous.honor;
      next.player.health = derivedStats(
        next.campaign,
        next.player.weapon,
      ).health;
      sim = new Simulation(next);
      campaignStack.length = 0;
      renderer?.resetCamera();
      ui.show("playing");
      save();
      break;
    }
    case "continue":
      if (ready) start("story", true);
      break;
    case "range":
      if (ready) start("range");
      break;
    case "title":
      title(ui.screen !== "dead");
      break;
    case "resume":
      ui.show(ui.screen === "playing" ? "paused" : "playing", sim.state);
      break;
    case "settings":
      returnScreen = ui.screen === "title" ? "title" : "paused";
      ui.show("settings");
      break;
    case "guide":
      if (ui.screen === "guide") ui.nextGuide();
      else {
        returnScreen = ui.screen === "title" ? "title" : "paused";
        ui.show("guide");
      }
      break;
    case "journal":
      ui.show("journal", sim.state);
      break;
    case "mark-location":
      sim.navigateTo(ui.selectedWaypoint);
      ui.show("playing");
      break;
    case "map-next":
      ui.cycleDestination(1);
      break;
    case "map-prev":
      ui.cycleDestination(-1);
      break;
    case "back":
      goBack();
      break;
    case "dialogue":
      sim.respond();
      ui.show("playing");
      break;
    case "mercy":
      sim.choose(true);
      ui.show("playing");
      break;
    case "revenge":
      sim.choose(false);
      ui.show("playing");
      break;
    case "buy-tonic":
      sim.buy("tonic");
      ui.show("shop", sim.state);
      break;
    case "buy-ammo":
      sim.buy("ammo");
      ui.show("shop", sim.state);
      break;
    case "retry":
      sim = new Simulation(recoveredSave(storage.load()));
      sim.state.deaths++;
      renderer?.resetCamera();
      ui.show("playing");
      break;
    case "confirm-new":
      ui.show("confirm-new");
      break;
    case "cancel-new":
      ui.show("title");
      break;
  }
}
ui.onAction = action;
ui.onSetting = (s) => {
  storage.writeSettings(s);
  audio.configure(s);
  renderer?.configure(s);
};
input.onActivity = () => {
  audio.unlock();
  if (demo) {
    title(false);
    interrupted = true;
  }
};
input.onBlur = () => {
  if (ui.screen === "playing" && !demo) ui.show("paused", sim.state);
};
document.querySelector("#mobile-menu")!.addEventListener("click", () => {
  document.body.classList.toggle("menu-open");
  if (ui.screen === "playing") ui.show("paused", sim.state);
});
window.addEventListener("resize", () => renderer?.resize());
window.addEventListener("beforeunload", () => {
  if (
    !demo &&
    sim.state.mode === "story" &&
    !["title", "error", "dead"].includes(ui.screen)
  )
    storage.write(sim.state);
});
window.addEventListener("gpu-lost", (e) => {
  ready = false;
  ui.show("error", undefined, {
    text: `The graphics device was disconnected. ${(e as CustomEvent).detail || ""} Your last checkpoint is safe.`,
  });
});

function events() {
  for (const e of sim.drain()) {
    renderer?.effects(e);
    switch (e.type) {
      case "dialogue":
        ui.show("dialogue", sim.state, e);
        break;
      case "choice":
        ui.show("choice", sim.state);
        break;
      case "shop":
        ui.show("shop", sim.state);
        break;
      case "toast":
        ui.toast(e.title, e.text);
        break;
      case "sound":
        audio.play(e.name);
        break;
      case "shot":
        audio.play(
          e.enemy ? "enemyShot" : "shot",
          e.enemy
            ? -Math.sin(
                Math.atan2(
                  e.from.x - sim.state.player.x,
                  e.from.z - sim.state.player.z,
                ) - (renderer?.yaw ?? 0),
              )
            : 0,
        );
        if (!e.enemy) {
          input.rumble(0.25, 100);
          if (e.hit) ui.hit();
        }
        break;
      case "damage":
        audio.play("damage");
        input.rumble(0.6, 200);
        break;
      case "checkpoint":
        if (!demo) save();
        break;
      case "death":
        if (!demo) ui.show("dead", sim.state);
        break;
      case "complete":
        if (demo) demoCompletions++;
        else save();
        ui.show("complete", sim.state);
        break;
      case "stage":
        if (settings.subtitles) {
          const remarks: Record<string, string> = {
            trail: "“Easy, Juniper. One more good deed.”",
            outpost: "“Fresh tracks. They can’t be far.”",
            return: "“Let’s take the long way home, girl.”",
          };
          if (remarks[e.stage]) ui.toast("The rider", remarks[e.stage]);
        }
        break;
      case "hub":
        ui.campaign.hub = e.hub;
        openCampaign("hub");
        break;
      case "campaign-choice":
        ui.campaign.pendingChoice = e.contract;
        openCampaign("campaign-choice");
        break;
      case "level-up":
        ui.toast(
          `Level ${e.level}`,
          `${sim.state.campaign.progression.points} talent points available · Open Equipment & talents`,
        );
        audio.play("complete");
        break;
      case "loot":
        ui.toast(
          `${RARITIES[e.rarity as keyof typeof RARITIES].name} equipment`,
          e.name,
        );
        break;
    }
  }
}
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - previous) / 1000);
  previous = now;
  if (document.hidden) {
    previous = now;
    return;
  }
  let c = input.poll(dt);
  ui.device = input.device;
  if (interrupted) {
    interrupted = false;
    c = emptyControls();
  }
  if (!ready) {
    ui.navigate(c);
    ui.tick(dt, sim, null, 0);
    return;
  }
  const titleLike =
    ["title", "settings", "guide", "confirm-new"].includes(ui.screen) &&
    returnScreen === "title";
  if (
    !demo &&
    (ui.screen === "title" || titleLike) &&
    now - input.lastActivity >= 10000
  )
    startDemo();
  let driverYaw: number | undefined;
  if (demo) {
    const d = director.update(dt, sim);
    driverYaw = d.yaw;
    if (d.panel && ui.screen !== d.panel) {
      ui.campaign.hub = "cinder";
      if (d.panel === "board" && d.selection)
        ui.campaign.cursors.board = Math.max(
          0,
          sim.state.campaign.boards.cinder.findIndex(
            (c) => c.id === d.selection,
          ),
        );
      if (d.panel === "contracts" && d.selection)
        ui.campaign.cursors.contracts = Math.max(
          0,
          sim.state.campaign.active.findIndex((c) => c.id === d.selection),
        );
      if (d.panel === "equipment" && d.selection) {
        const item = sim.state.campaign.items.find((i) => i.id === d.selection);
        if (item) {
          ui.campaign.slot = GEAR_SLOTS.indexOf(item.slot);
          ui.campaign.cursors.equipment = sim.state.campaign.items
            .filter((i) => i.slot === item.slot)
            .findIndex((i) => i.id === item.id);
        }
      }
      ui.show(d.panel, sim.state);
    }
    if (d.restart) {
      startDemo();
    } else {
      sim.update(dt, d.controls, d.yaw);
      if (
        (ui.screen === "dialogue" && !sim.pendingDialogue) ||
        (ui.screen === "choice" && !sim.pendingChoice)
      )
        ui.show("playing");
    }
  } else if (ui.screen === "playing") {
    playedSeconds += dt;
    lastSave += dt;
    if (c.pause) {
      ui.show("paused", sim.state);
      input.clear();
    } else if (c.journal) {
      ui.show("journal", sim.state);
      input.clear();
    } else {
      if (c.wheel) {
        wheelOpen = true;
        if (c.moveX < -0.3) wheelChoice = "revolver";
        if (c.moveX > 0.3) wheelChoice = "rifle";
        if (c.moveZ < -0.3) wheelChoice = "tonic";
        ui.wheel(true, wheelChoice);
        c = emptyControls();
      } else if (wheelOpen) {
        wheelOpen = false;
        ui.wheel(false, wheelChoice);
        if (wheelChoice === "tonic") c.tonic = true;
        else c.weapon = wheelChoice as "revolver" | "rifle";
      }
      renderer!.yaw -= c.lookX * settings.sensitivity;
      renderer!.pitch = Math.max(
        -0.15,
        Math.min(
          0.9,
          renderer!.pitch +
            c.lookY * settings.sensitivity * (settings.invertY ? -1 : 1),
        ),
      );
      sim.update(wheelOpen ? dt * 0.15 : dt, c, renderer!.yaw);
      if (
        lastSave > 30 &&
        !sim.allEnemies().some((e) => e.health > 0 && e.awareness > 0.7)
      ) {
        save();
        lastSave = 0;
      }
    }
  } else ui.navigate(c);
  events();
  const menu = ui.screen === "title" || (titleLike && !demo);
  renderer!.update(
    dt,
    sim.state,
    menu ? "menu" : demo ? "demo" : "play",
    0,
    0,
    driverYaw,
  );
  renderer!.render();
  audio.update(
    sim.state.stage === "fight" ||
      sim.state.campaign.enemies.some((e) => e.health > 0 && e.awareness > 0.7),
    sim.state.weather === "rain",
  );
  ui.tick(dt, sim, renderer, (now - input.lastActivity) / 1000);
}

async function boot() {
  try {
    renderer = new FrontierRenderer(canvas, settings);
    await renderer.init();
    ready = true;
    ui.setReady(true, !!storage.load());
    input.lastActivity = performance.now();
    if (storage.error) ui.toast("Local storage", storage.error);
  } catch (e) {
    console.warn("WebGPU initialization:", e);
    ui.show("error", undefined, {
      text: e instanceof Error ? e.message : String(e),
    });
  }
  requestAnimationFrame(frame);
}

// Read-only diagnostics are available to handoff tools. No production teleport, damage, or mission cheats.
Object.defineProperty(window, "__frontier", {
  value: {
    get snapshot() {
      return {
        identity,
        territory: {
          halfExtent: MAP_HALF_EXTENT,
          area: MAP_AREA,
          areaMultiplier: MAP_AREA_MULTIPLIER,
          landmarks: LANDMARKS.map(({ id, name, x, z }) => ({
            id,
            name,
            x,
            z,
          })),
          roads: FRONTIER_ROADS.map((road) =>
            road.map((point) => ({ ...point })),
          ),
          storyRoad: TRAIL.map((point) => ({ ...point })),
        },
        hubs: HUBS.map((h) => ({ ...h })),
        character: derivedStats(sim.state.campaign, sim.state.player.weapon),
        ready,
        screen: ui.screen,
        demo,
        demoRuns,
        demoCompletions,
        playedSeconds,
        renderer: renderer
          ? (
              renderer.renderer.backend as unknown as {
                isWebGPUBackend?: boolean;
              }
            ).isWebGPUBackend
            ? "WebGPUBackend"
            : "unsupported"
          : undefined,
        fps: renderer?.fps,
        cameraYaw: renderer?.yaw,
        cameraPitch: renderer?.pitch,
        state: structuredClone(sim.state),
        pendingDialogue: !!sim.pendingDialogue,
        pendingChoice: sim.pendingChoice,
        storageError: storage.error,
        gamepad: input.gamepadName,
      };
    },
  },
  writable: false,
});
void boot();
