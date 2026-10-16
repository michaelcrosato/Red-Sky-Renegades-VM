import { chromium } from "@playwright/test";
import { CatmullRomCurve3, Vector3 } from "three";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const win = process.platform === "win32";
const output =
  process.env.QA_OUTPUT ||
  (win
    ? "\\\\wsl.localhost\\Ubuntu\\tmp\\red-sky-expansion"
    : "/tmp/red-sky-expansion");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    (win
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : undefined),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  report = { checks: [], errors: [], fps: [], screenshots: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
const state = () => page.evaluate(() => window.__frontier.snapshot),
  ready = () =>
    page.waitForFunction(() => window.__frontier?.snapshot.ready, null, {
      timeout: 90000,
    });
const screen = (s) =>
  page.waitForFunction((s) => window.__frontier.snapshot.screen === s, s, {
    timeout: 5000,
  });
const check = (s) => {
  report.checks.push(s);
  console.log("PASS", s);
};
const shot = async (name) => {
  await page.screenshot({ path: path.join(output, name + ".png") });
  report.screenshots.push(name + ".png");
};
const key = "red-sky-renegades-vm:save:1";
const title = async () => {
  if ((await state()).screen === "playing") {
    await page.keyboard.press("Escape");
    await screen("paused");
  }
  await page.locator('[data-action="title"]:visible').click();
  await screen("title");
};
const hydrate = async (save) => {
  await title();
  await page.evaluate(
    ({ key, save }) => localStorage.setItem(key, JSON.stringify(save)),
    { key, save },
  );
  await page.reload();
  await ready();
  await page.locator('[data-action="continue"]:visible').click();
  await screen("playing");
};
const padSetup = () =>
  page.evaluate(() => {
    window.__territoryPad = {
      id: "DualSense Standard Mapping",
      index: 0,
      connected: true,
      mapping: "standard",
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({
        pressed: false,
        value: 0,
        touched: false,
      })),
    };
    Object.defineProperty(navigator, "getGamepads", {
      value: () => [window.__territoryPad],
      configurable: true,
    });
  });
const stop = () =>
  page.evaluate(() => {
    window.__territoryPad.axes = [0, 0, 0, 0];
    window.__territoryPad.buttons.forEach((b) => {
      b.value = 0;
      b.pressed = false;
    });
  });
async function ride(target, stopping = 2.5) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const s = await state(),
      p = s.state.player,
      dx = target.x - p.x,
      dz = target.z - p.z,
      d = Math.hypot(dx, dz);
    report.fps.push(s.fps);
    if (d < stopping) {
      await stop();
      return;
    }
    const forward =
        (dx * Math.sin(s.cameraYaw) + dz * Math.cos(s.cameraYaw)) / d,
      right = (-dx * Math.cos(s.cameraYaw) + dz * Math.sin(s.cameraYaw)) / d;
    const raw = (v) =>
      Math.abs(v) < 0.01 ? 0 : Math.sign(v) * (0.16 + 0.84 * Math.abs(v));
    const desired = Math.atan2(dx, dz),
      angle = Math.atan2(
        Math.sin(desired - s.cameraYaw),
        Math.cos(desired - s.cameraYaw),
      );
    await page.evaluate(
      ({ x, y, look, sprint }) => {
        const g = window.__territoryPad;
        g.axes = [x, y, look, 0];
        g.buttons[0] = {
          pressed: sprint,
          value: sprint ? 1 : 0,
          touched: sprint,
        };
      },
      {
        x: raw(right),
        y: -raw(forward),
        look: Math.max(-1, Math.min(1, -angle * 2)),
        sprint: p.mounted && d > 4,
      },
    );
    await page.waitForTimeout(120);
  }
  throw Error(
    `Could not reach ${JSON.stringify(target)}; ${JSON.stringify((await state()).state.player)}`,
  );
}
try {
  await page.goto(process.env.GAME_URL || "http://localhost:5188");
  await ready();
  await page.locator('[data-action="start"]:visible').click();
  await screen("playing");
  const initial = await state();
  assert.equal(initial.renderer, "WebGPUBackend");
  assert.ok(Math.abs(initial.territory.area / 46656 - 10) < 1e-12);
  check("Live world reports exactly 10× the playable area");
  await page.keyboard.press("Tab");
  await screen("journal");
  await shot("territory-atlas");
  assert.equal(await page.locator(".landmark-map-point").count(), 8);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(100);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.press("Enter");
  await screen("playing");
  assert.equal((await state()).state.explorationTarget, "pine-watch");
  check("Controller-style journal cycling tracks an outer destination");
  await padSetup();
  await ride((await state()).state.horse, 2.6);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(
    () => window.__frontier.snapshot.state.player.mounted,
  );
  check("Mounted Juniper through normal controls");
  const roads = initial.territory.roads;
  for (const road of [roads[0].slice(0, 2), roads[1]]) {
    const curve = new CatmullRomCurve3(
      road.map((p) => new Vector3(p.x, 0, p.z)),
    );
    for (const p of curve
      .getSpacedPoints(Math.ceil(curve.getLength() / 12))
      .slice(1))
      await ride(p, 3);
  }
  await ride(initial.territory.landmarks[0], 8);
  await stop();
  await page.waitForTimeout(300);
  assert.ok((await state()).state.discovered.includes("pine-watch"));
  assert.ok((await state()).state.player.z < -230);
  await shot("pinewatch-ridden");
  check(
    "Physically rode beyond the old boundary to Pinewatch and discovered it",
  );
  const before = (await state()).state;
  await title();
  await page.reload();
  await ready();
  await page.locator('[data-action="continue"]:visible').click();
  await screen("playing");
  const after = (await state()).state;
  assert.ok(
    Math.hypot(
      after.player.x - before.player.x,
      after.player.z - before.player.z,
    ) < 1,
  );
  assert.ok(after.discovered.includes("pine-watch"));
  assert.equal(after.explorationTarget, "pine-watch");
  check(
    "Reload restores a rider, horse and discovery outside the original map",
  );
  const legacy = structuredClone(after);
  delete legacy.discovered;
  delete legacy.explorationTarget;
  legacy.player.x = -54;
  legacy.player.z = 48;
  legacy.player.mounted = false;
  legacy.horse.x = -51;
  legacy.horse.z = 44;
  legacy.player.health = 63;
  await hydrate(legacy);
  assert.equal((await state()).state.player.health, 63);
  assert.deepEqual((await state()).state.discovered, []);
  check(
    "Original version-1 saves migrate without losing health or story progress",
  );
  for (const place of initial.territory.landmarks) {
    const arranged = (await state()).state;
    Object.assign(arranged.player, {
      x: place.x,
      z: place.z + 12,
      yaw: Math.PI,
      mounted: true,
    });
    Object.assign(arranged.horse, {
      x: place.x,
      z: place.z + 12,
      yaw: Math.PI,
    });
    arranged.explorationTarget = place.id;
    await hydrate(arranged);
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(440);
    await page.keyboard.up("ArrowLeft");
    await page.waitForTimeout(250);
    assert.ok((await state()).state.discovered.includes(place.id));
    await shot(place.id);
    check(`Rendered and discovered ${place.name}`);
  }
  await page.keyboard.press("Tab");
  await screen("journal");
  assert.ok((await state()).state.discovered.length === 8);
  await shot("territory-all-discovered");
  for (const [label, width, height] of [
    ["tablet", 768, 1024],
    ["laptop", 1366, 768],
    ["ultrawide", 2560, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    await shot(`atlas-${label}`);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    check(`${label} atlas fits the viewport`);
  }
  await page.keyboard.press("Escape");
  await screen("playing");
  await page.setViewportSize({ width: 375, height: 667 });
  await shot("expanded-phone");
  assert.equal(await page.locator("#hud").isVisible(), false);
  check("Phone remains world plus menu button");
  assert.deepEqual(report.errors, []);
  check("No JavaScript or GPU console errors");
  report.success = true;
} catch (e) {
  report.success = false;
  report.failure = String(e);
  report.lastState = await state().catch(() => null);
  console.error(e);
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    path.join(output, "territory-report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
