import "./ui/style.css";
import { Simulation, newGame } from "./engine/simulation";
import { Input } from "./engine/input";
import { AudioEngine } from "./engine/audio";
import { SaveStore, recoveredSave } from "./engine/save";
import { emptyControls } from "./engine/types";
import { Director } from "./game/director";
import { FrontierRenderer } from "./render/renderer";
import { UI, type UIAction, type Screen } from "./ui/ui";
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

function save() {
  if (!demo && sim.state.mode === "story" && sim.state.player.health > 0) {
    if (storage.write(sim.state)) ui.saved();
    else ui.toast("Progress could not be saved", storage.error);
  }
}
function start(mode: "story" | "range" = "story", continuing = false) {
  demo = false;
  ui.demo(false);
  sim = new Simulation(
    continuing ? (storage.load() ?? newGame(mode)) : newGame(mode),
  );
  renderer?.resetCamera();
  ui.show("playing");
  input.clear();
  input.lastActivity = performance.now();
  document.body.classList.remove("menu-open");
  lastSave = 0;
  if (mode === "story" && !continuing) save();
  ui.chapter(mode === "range" ? "THE PROVING GROUND" : "CINDER CREEK");
}
function title(saveFirst = true) {
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
  audio.unlock();
  audio.play("click");
  if (demo) {
    title(false);
    return;
  }
  switch (a) {
    case "start":
    case "replay":
      if (ready) start();
      break;
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
        !sim.state.enemies.some((e) => e.health > 0 && e.awareness > 0.7)
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
  audio.update(sim.state.stage === "fight", sim.state.weather === "rain");
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
        },
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
