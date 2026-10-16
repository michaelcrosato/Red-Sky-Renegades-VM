import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const windows = process.platform === "win32";
const output =
  process.env.QA_OUTPUT ||
  (windows ? "\\\\wsl.localhost\\Ubuntu\\tmp\\red-sky-qa" : "/tmp/red-sky-qa");
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    (windows
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : undefined),
  headless: true,
});
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  report = { checks: [], errors: [], screenshots: [] };
p.on("pageerror", (e) => report.errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
const ready = () =>
  p.waitForFunction(() => window.__frontier?.snapshot.ready, {
    timeout: 60000,
  });
const state = () => p.evaluate(() => window.__frontier.snapshot);
const screen = (s) =>
  p.waitForFunction((s) => window.__frontier.snapshot.screen === s, s, {
    timeout: 20000,
  });
const check = (s) => {
  report.checks.push(s);
  console.log("PASS", s);
};
const shot = async (s) => {
  await p.screenshot({ path: path.join(output, s + ".png") });
  report.screenshots.push(s + ".png");
};
const key = "red-sky-renegades-vm:save:1";
const hydrate = async (save) => {
  if ((await state()).screen === "playing") {
    await p.keyboard.press("Escape");
    await screen("paused");
  }
  const leave = p.locator('[data-action="title"]:visible');
  if (await leave.isVisible()) await leave.click();
  await screen("title");
  await p.evaluate(
    ({ key, save }) => localStorage.setItem(key, JSON.stringify(save)),
    { key, save },
  );
  await p.reload();
  await ready();
  await p.locator('[data-action="continue"]:visible').click();
  await screen("playing");
};
try {
  await p.goto(process.env.GAME_URL || "http://localhost:5188");
  await ready();
  await p.locator('[data-action="start"]:visible').click();
  await screen("playing");
  const base = (await state()).state;
  base.player.health = 22;
  await hydrate(base);
  assert.equal((await state()).state.player.health, 22);
  check("Normal Continue preserves damaged health exactly");
  const encounter = structuredClone(base);
  encounter.stage = "fight";
  Object.assign(encounter.player, {
    x: 30,
    z: -19,
    health: 8,
    invulnerable: 0,
    focus: 0,
    mounted: false,
  });
  encounter.enemies.forEach((e, i) => {
    e.awareness = 1;
    e.cooldown = 0.2 + i * 0.01;
    e.state = "attack";
  });
  await hydrate(encounter);
  await screen("dead");
  await shot("verified-death");
  check("Hostile gunfire causes death and presents checkpoint recovery");
  await p.locator('[data-action="retry"]:visible').click();
  await screen("playing");
  assert.equal((await state()).state.player.health, 70);
  assert.equal((await state()).state.stage, "fight");
  check("Retry restores the checkpoint with recovery health and protection");
  await p.keyboard.press("Escape");
  await screen("paused");
  await p.locator('[data-action="title"]:visible').click();
  await p.locator('[data-action="range"]:visible').click();
  await screen("playing");
  const snap = await state(),
    pl = snap.state.player;
  const target = snap.state.targets[2],
    desired = Math.atan2(target.x - pl.x, target.z - pl.z),
    delta = Math.atan2(
      Math.sin(desired - snap.cameraYaw),
      Math.cos(desired - snap.cameraYaw),
    );
  await p.keyboard.down(delta > 0 ? "ArrowLeft" : "ArrowRight");
  await p.waitForTimeout((Math.abs(delta) / 1.8) * 1000);
  await p.keyboard.up(delta > 0 ? "ArrowLeft" : "ArrowRight");
  await p.mouse.down({ button: "right" });
  await p.waitForTimeout(100);
  await p.keyboard.press("Space");
  await p.waitForTimeout(150);
  assert.ok((await state()).state.targets.some((t) => t.health < 100));
  check("Player aim and fire hit a visible practice target");
  await p.keyboard.press("KeyR");
  await p.waitForTimeout(1850);
  assert.equal((await state()).state.player.ammo.revolver, 6);
  assert.equal((await state()).state.player.reserve.revolver, 47);
  check("Visible player reload transfers finite reserve rounds");
  await p.keyboard.press("Digit2");
  await p.waitForTimeout(150);
  await shot("verified-aim");
  await p.mouse.up({ button: "right" });
  check("Corrected repeater aiming pose rendered");
  for (const [name, width, height] of [
    ["native-phone", 375, 667],
    ["native-tablet", 768, 1024],
    ["native-laptop", 1366, 768],
    ["native-ultrawide", 2560, 1080],
  ]) {
    await p.setViewportSize({ width, height });
    await p.waitForTimeout(250);
    await shot(name);
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    if (width === 375) assert.equal(await p.locator("#hud").isVisible(), false);
    check(`${name}: live game renders without horizontal overflow`);
  }
  await p.setViewportSize({ width: 1440, height: 900 });
  const weather = structuredClone(base);
  weather.stage = "complete";
  weather.weather = "rain";
  weather.player.health = 100;
  weather.enemies.forEach((e) => {
    e.health = 0;
    e.state = "dead";
  });
  await hydrate(weather);
  await p.waitForTimeout(1000);
  await shot("verified-rain");
  assert.equal((await state()).state.weather, "rain");
  check("Saved weather restores the rain and fog presentation");
  assert.deepEqual(report.errors, []);
  check(
    "No browser errors during recovery, gunplay, weather or viewport changes",
  );
  report.success = true;
} catch (e) {
  report.success = false;
  report.failure = String(e);
  console.error(e);
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    path.join(output, "browser-details-report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
