import { clamp } from "./math";
import { emptyControls, type Controls } from "./types";

export class Input {
  keys = new Set<string>();
  private pressed = new Set<string>();
  private mouse = new Set<number>();
  private pointerPressed = new Set<number>();
  private dx = 0;
  private dy = 0;
  private previousButtons: boolean[] = [];
  private previousAxes: number[] = [];
  private navTime = 0;
  device: "controller" | "keyboard" = "controller";
  gamepadName = "";
  lastActivity = performance.now();
  onActivity: () => void = () => {};
  onBlur: () => void = () => {};
  constructor(private canvas: HTMLElement) {
    window.addEventListener("keydown", (e) => {
      if (
        [
          "Enter",
          "Space",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Tab",
        ].includes(e.code)
      )
        e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.activity("keyboard");
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      this.activity("keyboard");
    });
    window.addEventListener("pointerdown", (e) => {
      this.mouse.add(e.button);
      this.pointerPressed.add(e.button);
      this.activity("keyboard");
    });
    window.addEventListener("pointerup", (e) => {
      this.mouse.delete(e.button);
      this.activity("keyboard");
    });
    window.addEventListener("pointermove", (e) => {
      if (e.movementX || e.movementY) {
        if (this.mouse.has(2) || document.pointerLockElement === canvas) {
          this.dx += e.movementX;
          this.dy += e.movementY;
        }
        this.activity("keyboard");
      }
    });
    window.addEventListener("wheel", () => this.activity("keyboard"), {
      passive: true,
    });
    window.addEventListener("touchstart", () => this.activity("keyboard"), {
      passive: true,
    });
    window.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("blur", () => {
      this.clear();
      this.onBlur();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.clear();
        this.onBlur();
      }
    });
    window.addEventListener("gamepadconnected", () =>
      this.activity("controller"),
    );
    window.addEventListener("gamepaddisconnected", () => {
      this.previousButtons = [];
      this.gamepadName = "";
      this.clear();
      this.onBlur();
    });
  }
  private activity(device: "controller" | "keyboard") {
    this.device = device;
    this.lastActivity = performance.now();
    this.onActivity();
  }
  clear() {
    this.keys.clear();
    this.pressed.clear();
    this.mouse.clear();
    this.pointerPressed.clear();
    this.dx = this.dy = 0;
  }
  poll(dt: number): Controls {
    const c = emptyControls(),
      k = (s: string) => this.keys.has(s),
      edge = (s: string) => this.pressed.has(s);
    c.moveX = Number(k("KeyD")) - Number(k("KeyA"));
    c.moveZ = Number(k("KeyW")) - Number(k("KeyS"));
    c.lookX =
      this.dx * 0.003 +
      (Number(k("ArrowRight")) - Number(k("ArrowLeft"))) * dt * 1.8;
    c.lookY =
      this.dy * 0.003 +
      (Number(k("ArrowDown")) - Number(k("ArrowUp"))) * dt * 1.2;
    c.sprint = k("ShiftLeft") || k("ShiftRight");
    c.aim = this.mouse.has(2);
    c.fire =
      this.mouse.has(0) ||
      this.pointerPressed.has(0) ||
      k("Space") ||
      edge("Space");
    c.interact = edge("KeyE");
    c.reload = edge("KeyR");
    c.focus = edge("KeyF");
    c.whistle = edge("KeyH");
    c.tonic = edge("KeyC");
    c.wheel = k("KeyQ");
    c.pause = edge("Escape");
    c.journal = edge("Tab");
    c.confirm = edge("Enter") || edge("Space") || edge("KeyE");
    c.back = edge("Escape") || edge("Backspace");
    if (edge("Digit1")) c.weapon = "revolver";
    if (edge("Digit2")) c.weapon = "rifle";
    let navX =
      Number(k("ArrowRight") || k("KeyD")) -
      Number(k("ArrowLeft") || k("KeyA"));
    let navY =
      Number(k("ArrowDown") || k("KeyS")) - Number(k("ArrowUp") || k("KeyW"));
    const gp = Array.from(navigator.getGamepads?.() ?? []).find(
      (g) => g?.connected,
    );
    if (gp) {
      this.gamepadName = gp.id;
      const b = gp.buttons.map((b) => b.pressed || b.value > 0.35),
        rise = (i: number) => !!b[i] && !this.previousButtons[i];
      const dead = (v: number) =>
        Math.abs(v) < 0.16 ? 0 : (Math.sign(v) * (Math.abs(v) - 0.16)) / 0.84;
      const axes = gp.axes.map(dead);
      if (b.some(Boolean) || axes.some((v) => Math.abs(v) > 0.03))
        this.activity("controller");
      c.moveX += axes[0] || 0;
      c.moveZ -= axes[1] || 0;
      c.lookX += (axes[2] || 0) * dt * 2.3;
      c.lookY += (axes[3] || 0) * dt * 1.6;
      c.sprint ||= !!b[0];
      c.aim ||= !!b[6];
      c.fire ||= !!b[7];
      c.wheel ||= !!b[4];
      c.interact ||= rise(3);
      c.reload ||= rise(2);
      c.focus ||= rise(11);
      c.whistle ||= rise(12);
      c.tonic ||= rise(13);
      c.pause ||= rise(9);
      c.journal ||= rise(8);
      c.confirm ||= rise(0);
      c.back ||= rise(1);
      if (rise(5)) c.weapon = "rifle";
      if (rise(14)) c.weapon = "revolver";
      if (rise(15)) c.weapon = "rifle";
      navX +=
        Number(b[15]) -
        Number(b[14]) +
        (Math.abs(axes[0] || 0) > 0.5 ? Math.sign(axes[0]) : 0);
      navY +=
        Number(b[13]) -
        Number(b[12]) +
        (Math.abs(axes[1] || 0) > 0.5 ? Math.sign(axes[1]) : 0);
      this.previousButtons = b;
      this.previousAxes = axes;
    }
    this.navTime -= dt;
    if ((navX || navY) && this.navTime <= 0) {
      c.navX = Math.sign(navX);
      c.navY = Math.sign(navY);
      this.navTime = 0.2;
    } else if (!navX && !navY) this.navTime = 0;
    const length = Math.hypot(c.moveX, c.moveZ);
    if (length > 1) {
      c.moveX /= length;
      c.moveZ /= length;
    }
    c.lookX = clamp(c.lookX, -0.4, 0.4);
    c.lookY = clamp(c.lookY, -0.3, 0.3);
    this.pressed.clear();
    this.pointerPressed.clear();
    this.dx = this.dy = 0;
    return c;
  }
  rumble(strength = 0.3, duration = 120) {
    const g = Array.from(navigator.getGamepads?.() ?? []).find(
      (g) => g?.connected,
    );
    const actuator = (
      g as Gamepad & {
        vibrationActuator?: {
          playEffect: (kind: string, p: unknown) => Promise<unknown>;
        };
      }
    )?.vibrationActuator;
    actuator
      ?.playEffect("dual-rumble", {
        duration,
        weakMagnitude: strength,
        strongMagnitude: strength * 0.7,
      })
      .catch(() => {});
  }
}
