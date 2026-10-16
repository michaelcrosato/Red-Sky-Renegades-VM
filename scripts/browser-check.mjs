import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const windows = process.platform === "win32";
const output =
  process.env.QA_OUTPUT ||
  (windows ? "\\\\wsl.localhost\\Ubuntu\\tmp\\red-sky-qa" : "/tmp/red-sky-qa");
await fs.mkdir(output, { recursive: true });
const connected = !!process.env.CDP_URL;
const browser = connected
  ? await chromium.connectOverCDP(process.env.CDP_URL)
  : await chromium.launch({
      executablePath:
        process.env.CHROME_PATH ||
        (windows
          ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
          : undefined),
      headless: true,
    });
const context = connected
  ? browser.contexts()[0]
  : await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = connected ? context.pages()[0] : await context.newPage();
const report = {
  browser: browser.version(),
  os: process.platform,
  checks: [],
  stages: [],
  errors: [],
  gpu: null,
  screenshots: [],
  fps: [],
};
const errors = report.errors;
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const state = () => page.evaluate(() => window.__frontier.snapshot);
const screen = (expected) =>
  page.waitForFunction(
    (s) => window.__frontier.snapshot.screen === s,
    expected,
    { timeout: 5000 },
  );
const check = (name) => {
  report.checks.push(name);
  console.log("PASS", name);
};
const shot = async (name) => {
  await page.screenshot({ path: path.join(output, `${name}.png`) });
  report.screenshots.push(`${name}.png`);
};
try {
  await page.goto(process.env.GAME_URL || "http://localhost:5188", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.__frontier?.snapshot.ready, {
    timeout: 120000,
  });
  report.gpu = await page.evaluate(async () => {
    const a = await navigator.gpu.requestAdapter();
    return {
      vendor: a.info.vendor,
      architecture: a.info.architecture,
      description: a.info.description,
    };
  });
  assert.equal((await state()).renderer, "WebGPUBackend");
  check("Exclusive WebGPU backend initialized");
  await page.keyboard.press("Escape");
  if ((await state()).screen !== "title") {
    await page.keyboard.press("Escape");
  }
  await shot("verified-title");
  if (await page.locator('[data-action="confirm-new"]:visible').isVisible()) {
    await page.locator('[data-action="confirm-new"]:visible').click();
    await page.locator('[data-action="start"]:visible').click();
  } else await page.locator('[data-action="start"]:visible').click();
  assert.equal((await state()).screen, "playing");
  await shot("verified-camp");
  check("New game starts from the title");
  const before = (await state()).state.player;
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(450);
  await page.keyboard.up("KeyW");
  const after = (await state()).state.player;
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) > 0.4);
  check("Keyboard movement changes world position");
  await page.keyboard.press("Escape");
  await screen("paused");
  assert.equal((await state()).screen, "paused");
  const frozen = (await state()).state.elapsed;
  await page.waitForTimeout(400);
  assert.equal((await state()).state.elapsed, frozen);
  check("Pause freezes simulation");
  await page.locator('[data-action="settings"]:visible').click();
  await page.getByLabel("Camera shake").uncheck();
  await page.keyboard.press("Escape");
  await screen("paused");
  assert.equal((await state()).screen, "paused");
  check("Settings accept and persist a changed value");
  await page.locator('[data-action="journal"]:visible').click();
  await shot("verified-journal");
  await page.keyboard.press("Escape");
  await screen("playing");
  assert.equal((await state()).screen, "playing");
  check("Journal and territory map open and return to play");
  await page.keyboard.down("KeyQ");
  await page.waitForTimeout(100);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(120);
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyQ");
  await page.waitForTimeout(100);
  assert.equal((await state()).state.player.weapon, "rifle");
  check("Equipment wheel selects the repeater");
  await page.keyboard.press("Escape");
  await screen("paused");
  await page.locator('[data-action="title"]:visible').click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("red-sky-renegades-vm:save:1"),
  );
  assert.ok(saved);
  await page.reload();
  await page.waitForFunction(() => window.__frontier?.snapshot.ready, {
    timeout: 120000,
  });
  await page.locator('[data-action="continue"]:visible').click();
  assert.equal((await state()).state.player.weapon, "rifle");
  check("Continue restores an actual saved session after reload");
  // Standard mapping DualSense input, delivered through the browser Gamepad API.
  await page.evaluate(() => {
    window.__testPad = {
      id: "DualSense Wireless Controller (standard gamepad)",
      index: 0,
      connected: true,
      mapping: "standard",
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({
        pressed: false,
        touched: false,
        value: 0,
      })),
    };
    Object.defineProperty(navigator, "getGamepads", {
      value: () => [window.__testPad],
      configurable: true,
    });
  });
  const pad = async (index, pressed) =>
    page.evaluate(
      ({ index, pressed }) => {
        const p = window.__testPad;
        p.buttons[index] = {
          pressed,
          touched: pressed,
          value: pressed ? 1 : 0,
        };
        p.timestamp = performance.now();
      },
      { index, pressed },
    );
  await pad(9, true);
  await screen("paused");
  await pad(9, false);
  await page.waitForTimeout(150);
  assert.equal((await state()).screen, "paused");
  await pad(0, true);
  await screen("playing");
  await pad(0, false);
  await page.waitForTimeout(150);
  assert.equal((await state()).screen, "playing");
  check("DualSense Options pauses and Cross resumes with focus navigation");
  const padBefore = (await state()).state.player;
  await page.evaluate(() => (window.__testPad.axes = [0.7, -0.7, 0, 0]));
  await page.waitForTimeout(400);
  await page.evaluate(() => (window.__testPad.axes = [0, 0, 0, 0]));
  const padAfter = (await state()).state.player;
  assert.ok(
    Math.hypot(padAfter.x - padBefore.x, padAfter.z - padBefore.z) > 0.4,
  );
  check("Analog gamepad movement drives the same simulation");
  await page.keyboard.press("Escape");
  await screen("paused");
  await page.locator('[data-action="title"]:visible').click();
  const saveBeforeDemo = await page.evaluate(() =>
    localStorage.getItem("red-sky-renegades-vm:save:1"),
  );
  const idleStart = Date.now();
  await page.waitForFunction(() => window.__frontier.snapshot.demo, {
    timeout: 15000,
  });
  const idleMs = Date.now() - idleStart;
  assert.ok(idleMs >= 9000 && idleMs < 13000, `attract entered in ${idleMs}ms`);
  check(`Attract mode enters after 10 seconds (${idleMs}ms observed)`);
  const startRuns = (await state()).demoRuns;
  let lastStage = "";
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    const s = await state();
    if (s.state.stage !== lastStage) {
      lastStage = s.state.stage;
      report.stages.push({
        stage: lastStage,
        elapsed: s.state.elapsed,
        health: s.state.player.health,
      });
      console.log(
        "DEMO",
        lastStage,
        Math.round(s.state.elapsed),
        s.state.player.health,
      );
      if (["trail", "fight", "return", "complete"].includes(lastStage))
        await shot(`verified-demo-${lastStage}`);
    }
    report.fps.push(s.fps);
    if (s.demoCompletions >= 1 && s.demoRuns > startRuns) break;
    await page.waitForTimeout(500);
  }
  const completed = await state();
  assert.ok(completed.demoCompletions >= 1, "attract completed a mission");
  assert.ok(
    completed.demoRuns > startRuns,
    "attract restarted after completion",
  );
  check(
    "Autonomous browser run completes all mission beats and starts another loop",
  );
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("red-sky-renegades-vm:save:1"),
    ),
    saveBeforeDemo,
  );
  check("Attract mode leaves the player save byte-for-byte unchanged");
  await page.mouse.move(100, 100);
  await page.waitForTimeout(100);
  assert.equal((await state()).demo, false);
  assert.equal((await state()).screen, "title");
  check("Pointer movement immediately interrupts demo to title");
  await page.waitForFunction(() => window.__frontier.snapshot.demo, {
    timeout: 15000,
  });
  await pad(0, true);
  await page.waitForTimeout(100);
  await pad(0, false);
  assert.equal((await state()).screen, "title");
  check("A gamepad button interrupts demo without starting a game");
  await page.waitForFunction(() => window.__frontier.snapshot.demo, {
    timeout: 15000,
  });
  await page.keyboard.press("KeyZ");
  await screen("title");
  assert.equal((await state()).screen, "title");
  check("Any keyboard input interrupts demo");
  await page.locator('[data-action="range"]:visible').click();
  assert.equal((await state()).state.mode, "range");
  await shot("verified-range");
  check("Separate proving ground starts with targets and full equipment");
  assert.equal(errors.length, 0, errors.join("\n"));
  check("No browser console or JavaScript errors");
  report.success = true;
} catch (e) {
  report.success = false;
  report.failure = String(e);
  console.error(e);
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    path.join(output, "browser-report.json"),
    JSON.stringify(report, null, 2),
  );
  if (!connected) await browser.close();
  else await browser.close();
  console.log("REPORT", path.join(output, "browser-report.json"));
}
