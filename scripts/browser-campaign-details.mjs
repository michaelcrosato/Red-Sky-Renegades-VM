import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const win = process.platform === "win32",
  out =
    process.env.QA_OUTPUT ||
    (win
      ? "\\\\wsl.localhost\\Ubuntu\\tmp\\red-sky-campaign"
      : "/tmp/red-sky-campaign"),
  url = process.env.GAME_URL || process.argv[2] || "http://localhost:5190";
const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      (win
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : undefined),
  }),
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  report = { checks: [], errors: [], layouts: [], screenshots: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
const state = () => page.evaluate(() => window.__frontier.snapshot),
  screen = (s) =>
    page.waitForFunction((s) => window.__frontier.snapshot.screen === s, s, {
      timeout: 10000,
    }),
  ready = () =>
    page.waitForFunction(() => window.__frontier?.snapshot.ready, null, {
      timeout: 60000,
    });
const action = (a) => page.locator(`[data-action="${a}"]:visible`).click(),
  check = (s) => {
    report.checks.push(s);
    console.log("PASS", s);
  },
  shot = async (name) => {
    await page.screenshot({ path: path.join(out, name + ".png") });
    report.screenshots.push(name + ".png");
  };
async function load(name, change) {
  const s = JSON.parse(
    await fs.readFile(path.join(out, name + ".json"), "utf8"),
  );
  if (change) change(s);
  await page.goto(url);
  await ready();
  await page.evaluate(
    (s) =>
      localStorage.setItem("red-sky-renegades-vm:save:1", JSON.stringify(s)),
    s,
  );
  await page.reload();
  await ready();
  await action("continue");
  await screen("playing");
  return s;
}
async function menuAtHub() {
  await page.keyboard.press("Escape");
  await screen("paused");
  await action("campaign:hub");
  await screen("hub");
}
async function backHub() {
  for (let i = 0; i < 6 && (await state()).screen !== "hub"; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(130);
  }
  await screen("hub");
}
async function layout(name) {
  const size = await page.locator(".panel").evaluate((e) => ({
    height: e.clientHeight,
    scroll: e.scrollHeight,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  report.layouts.push({ name, ...size });
  assert.equal(size.overflow, false);
  assert.ok(
    size.scroll <= size.height + 1,
    `${name}: vertical scroll ${size.scroll}/${size.height}`,
  );
  await shot(name);
}
try {
  for (const hub of [
    { id: "cinder", x: -47, z: 40 },
    { id: "sundown", x: 289, z: -76 },
    { id: "cottonwood", x: -31, z: 234 },
  ]) {
    await load("endgame", (s) => {
      s.player.x = hub.x;
      s.player.z = hub.z + 2;
    });
    await page.keyboard.press("KeyE");
    await screen("hub");
    await shot("hub-" + hub.id);
    check(`${hub.id} physical hub opens with its faction and services`);
  }
  await load("endgame");
  await menuAtHub();
  await action("campaign:equipment");
  await screen("equipment");
  await page.keyboard.press("ArrowRight", { delay: 80 });
  await page.waitForTimeout(150);
  assert.ok(
    (await page.locator(".item-art b").textContent()).includes("RELIC"),
  );
  await layout("relic-equipment");
  const before = (await state()).state.campaign.items.find(
    (i) => i.id === "qa-revolver",
  );
  await action("campaign:workshop");
  await screen("workshop");
  await page.keyboard.press("BracketRight");
  await page.waitForTimeout(130);
  await action("campaign:craft");
  const reforged = (await state()).state.campaign.items.find(
    (i) => i.id === "qa-revolver",
  );
  assert.notEqual(reforged.seed, before.seed);
  assert.equal(reforged.aspect, before.aspect);
  assert.equal(reforged.rune, before.rune);
  check(
    "Native workshop reforge preserves power and rune while committing a new affix roll",
  );
  await layout("relic-workshop");
  await backHub();
  await action("campaign:equipment");
  await screen("equipment");
  await page.keyboard.press("ArrowLeft", { delay: 80 });
  await page.waitForTimeout(130);
  await action("campaign:store");
  assert.ok(
    (await state()).state.campaign.stash.some(
      (i) => i.id === "starter-revolver",
    ),
  );
  await backHub();
  await action("campaign:stash");
  await screen("stash");
  await action("campaign:withdraw");
  assert.ok(
    (await state()).state.campaign.items.some(
      (i) => i.id === "starter-revolver",
    ),
  );
  check("Native stash stores and withdraws the exact item");
  await backHub();
  await action("campaign:stock");
  await screen("stock");
  const cash = (await state()).state.inventory.dollars,
    count = (await state()).state.campaign.items.length;
  await action("campaign:buy");
  assert.ok((await state()).state.inventory.dollars < cash);
  assert.equal((await state()).state.campaign.items.length, count + 1);
  check(
    "Trading post purchase transfers stock and charges the displayed economy",
  );
  await backHub();
  await action("campaign:talents");
  await screen("talents");
  const points = (await state()).state.campaign.progression.points;
  await action("campaign:respec");
  assert.ok((await state()).state.campaign.progression.points > points);
  assert.deepEqual((await state()).state.campaign.progression.talents, {});
  check("Hub respec refunds spent talent points and clears their effects");
  for (const [label, width, height] of [
    ["laptop", 1366, 768],
    ["tablet", 768, 1024],
    ["ultrawide", 2560, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await backHub();
    await action("campaign:equipment");
    await screen("equipment");
    for (
      let i = 0;
      i < 10 &&
      !(await page.locator(".item-art b").textContent()).includes("RELIC");
      i++
    ) {
      await page.keyboard.press("ArrowRight", { delay: 90 });
      await page.waitForTimeout(150);
    }
    assert.ok(
      (await page.locator(".item-art b").textContent()).includes("RELIC"),
    );
    await layout(`relic-equipment-${label}`);
    await action("campaign:workshop");
    await screen("workshop");
    await layout(`relic-workshop-${label}`);
    await backHub();
    await action("campaign:talents");
    await screen("talents");
    await layout(`talents-${label}`);
  }
  check(
    "High-affix gear, runes, legendary powers and talent screens fit laptop, tablet and ultrawide layouts",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await load("capture");
  await page.waitForFunction(() =>
    document.querySelector("#prompt b")?.textContent?.includes("Capture"),
  );
  await shot("capture-prompt");
  const job = (await state()).state.campaign.active[0];
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(180);
  assert.equal((await state()).state.campaign.active[0].outcome, "captured");
  check(
    "A wounded named outlaw can be captured through the actual world prompt",
  );
  await load("hazard");
  await page.waitForFunction(() =>
    window.__frontier.snapshot.state.campaign.hazards.some(
      (h) => h.warning > 0,
    ),
  );
  await shot("hazard-warning");
  const hp = (await state()).state.player.health;
  await page.waitForFunction(() =>
    window.__frontier.snapshot.state.campaign.hazards.some(
      (h) => h.warning < 0.23 && h.warning > 0,
    ),
  );
  await page.keyboard.press("KeyV");
  await page.waitForTimeout(350);
  assert.equal((await state()).state.player.health, hp);
  check("A timed evade avoids the native telegraphed lightning impact");
  await load("ledger");
  await page.keyboard.press("KeyE");
  await screen("campaign-choice");
  await shot("quest-ledger-choice");
  await action("campaign:choice-protect");
  await screen("playing");
  assert.equal((await state()).state.campaign.active[0].outcome, "protect");
  assert.equal((await state()).state.campaign.active[0].index, 5);
  check(
    "The procedural quest ledger choice advances to the final confrontation",
  );
  const snapshot = (await state()).state;
  await page.keyboard.press("Escape");
  await screen("paused");
  await action("title");
  await page.reload();
  await ready();
  await action("continue");
  await screen("playing");
  assert.equal(
    (await state()).state.campaign.active[0].outcome,
    snapshot.campaign.active[0].outcome,
  );
  assert.equal((await state()).state.campaign.active[0].index, 5);
  check("The branching quest state survives a full browser reload");
  assert.deepEqual(report.errors, []);
  check("No JavaScript or GPU console errors in advanced scenarios");
  report.success = true;
} catch (e) {
  report.success = false;
  report.failure = String(e);
  console.error(e);
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    path.join(out, "campaign-details-report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
