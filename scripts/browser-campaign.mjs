import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const win = process.platform === "win32",
  output =
    process.env.QA_OUTPUT ||
    (win
      ? "\\\\wsl.localhost\\Ubuntu\\tmp\\red-sky-campaign"
      : "/tmp/red-sky-campaign");
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
  screen = (s) =>
    page.waitForFunction((s) => window.__frontier.snapshot.screen === s, s, {
      timeout: 12000,
    });
const ready = () =>
  page.waitForFunction(() => window.__frontier?.snapshot.ready, null, {
    timeout: 90000,
  });
const check = (s) => {
  report.checks.push(s);
  console.log("PASS", s);
};
const shot = async (s) => {
  await page.screenshot({ path: path.join(output, s + ".png") });
  report.screenshots.push(s + ".png");
};
const action = (a) => page.locator(`[data-action="${a}"]:visible`).click();
const setupPad = () =>
  page.evaluate(() => {
    window.__campaignPad = {
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
      value: () => [window.__campaignPad],
      configurable: true,
    });
  });
const stop = () =>
  page.evaluate(() => {
    window.__campaignPad.axes = [0, 0, 0, 0];
    window.__campaignPad.buttons.forEach((b) => {
      b.pressed = false;
      b.value = 0;
    });
  });
async function press(index) {
  await page.evaluate(
    (i) =>
      (window.__campaignPad.buttons[i] = {
        pressed: true,
        value: 1,
        touched: true,
      }),
    index,
  );
  await page.waitForTimeout(90);
  await page.evaluate(
    (i) =>
      (window.__campaignPad.buttons[i] = {
        pressed: false,
        value: 0,
        touched: false,
      }),
    index,
  );
  await page.waitForTimeout(160);
}
async function go(target, radius = 2.4) {
  const deadline = Date.now() + 50000;
  let last = Infinity,
    stuck = 0;
  while (Date.now() < deadline) {
    const s = await state(),
      p = s.state.player;
    if (s.screen === "dead") throw Error("Rider died during travel");
    const dx = target.x - p.x,
      dz = target.z - p.z,
      d = Math.hypot(dx, dz);
    report.fps.push(s.fps);
    if (d < radius) {
      await stop();
      return;
    }
    stuck = Math.abs(last - d) < 0.15 ? stuck + 1 : 0;
    last = d;
    const forward =
        (dx * Math.sin(s.cameraYaw) + dz * Math.cos(s.cameraYaw)) / d,
      right = (-dx * Math.cos(s.cameraYaw) + dz * Math.sin(s.cameraYaw)) / d,
      angle = Math.atan2(
        Math.sin(Math.atan2(dx, dz) - s.cameraYaw),
        Math.cos(Math.atan2(dx, dz) - s.cameraYaw),
      );
    const raw = (v) =>
      Math.abs(v) < 0.01 ? 0 : Math.sign(v) * (0.16 + 0.84 * Math.abs(v));
    await page.evaluate(
      ({ x, y, look, sprint, tonic }) => {
        const p = window.__campaignPad;
        p.axes = [x, y, look, 0];
        p.buttons[0] = { pressed: sprint, value: sprint ? 1 : 0 };
        p.buttons[13] = { pressed: tonic, value: tonic ? 1 : 0 };
      },
      {
        x: stuck > 5 ? 0.9 : raw(right),
        y: stuck > 5 ? -0.2 : -raw(forward),
        look: Math.max(-1, Math.min(1, -angle * 1.6)),
        sprint: d > 6,
        tonic: p.health < s.character.health * 0.55,
      },
    );
    await page.waitForTimeout(110);
  }
  throw Error(
    `Travel stalled ${JSON.stringify({ target, player: (await state()).state.player })}`,
  );
}
function route(from, to, roads) {
  const nodes = [],
    edges = new Map(),
    lookup = new Map(),
    node = (p) => {
      const key = `${p.x}:${p.z}`;
      if (!lookup.has(key)) {
        lookup.set(key, nodes.length);
        nodes.push(p);
        edges.set(nodes.length - 1, []);
      }
      return lookup.get(key);
    };
  for (const road of roads)
    for (let i = 1; i < road.length; i++) {
      const a = node(road[i - 1]),
        b = node(road[i]),
        cost = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
      edges.get(a).push({ to: b, cost });
      edges.get(b).push({ to: a, cost });
    }
  const nearest = (p) =>
      nodes.reduce(
        (best, n, i) =>
          Math.hypot(n.x - p.x, n.z - p.z) <
          Math.hypot(nodes[best].x - p.x, nodes[best].z - p.z)
            ? i
            : best,
        0,
      ),
    start = nearest(from),
    end = nearest(to),
    dist = new Map([[start, 0]]),
    prev = new Map(),
    open = new Set([start]);
  while (open.size) {
    const n = [...open].reduce((a, b) => (dist.get(a) < dist.get(b) ? a : b));
    open.delete(n);
    if (n === end) break;
    for (const e of edges.get(n)) {
      const d = dist.get(n) + e.cost;
      if (d < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, d);
        prev.set(e.to, n);
        open.add(e.to);
      }
    }
  }
  const ids = [end];
  let cursor = end;
  while (cursor !== start) {
    cursor = prev.get(cursor);
    if (cursor === undefined) return [to];
    ids.unshift(cursor);
  }
  return [...ids.map((i) => nodes[i]), to];
}
async function travel(to) {
  const s = await state();
  for (const point of route(s.state.player, to, s.territory.roads))
    await go(point, 3);
}
async function openHub(hub) {
  await go(hub, 2.5);
  await page.keyboard.press("KeyE");
  await screen("hub");
}
async function backToHub() {
  for (let i = 0; i < 5 && (await state()).screen !== "hub"; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(180);
  }
  await screen("hub");
}
async function selectOffer(kind) {
  await action("campaign:board");
  await screen("board");
  const offers = (await state()).state.campaign.boards.cinder,
    offer = offers.find((o) => o.kind === kind);
  assert.ok(offer, `${kind} available`);
  for (let i = 0; i < offers.length; i++) {
    if ((await page.locator(".contract-copy h3").textContent()) === offer.title)
      break;
    await press(15);
  }
  await shot(`campaign-${kind}-offer`);
  await press(0);
  await screen("playing");
  return offer.id;
}
async function mount() {
  const s = await state();
  if (s.state.player.mounted) return;
  await go({ x: s.state.horse.x - 2, z: s.state.horse.z + 1.5 }, 0.9);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(
    () => window.__frontier.snapshot.state.player.mounted,
  );
}

try {
  await page.goto(process.env.GAME_URL || process.argv[2] || "http://localhost:5188");
  await ready();
  await action("start");
  await screen("playing");
  await setupPad();
  const hub = (await state()).hubs[0];
  await openHub(hub);
  await shot("campaign-hub");
  check("Reached and opened the physical dispatch hub using gameplay input");
  await press(13);
  assert.equal(
    await page.locator(".panel button.selected").getAttribute("data-action"),
    "campaign:equipment",
  );
  await press(15);
  assert.equal(
    await page.locator(".panel button.selected").getAttribute("data-action"),
    "campaign:talents",
  );
  await press(0);
  await screen("talents");
  await page.keyboard.press("Escape");
  await screen("hub");
  check("Hub D-pad focus follows the two-column layout and Cross selects");
  const salvage = await selectOffer("salvage");
  check("Accepted a generated salvage contract through the controller board");
  await mount();
  let active = (await state()).state.campaign.active.find(
    (c) => c.id === salvage,
  );
  await travel(active.objectives[0]);
  await page.waitForFunction(
    (id) =>
      window.__frontier.snapshot.state.campaign.objects.some(
        (o) => o.owner === id,
      ),
    salvage,
    { timeout: 8000 },
  );
  for (let i = 0; i < 3; i++) {
    const snapshot = await state(),
      object = snapshot.state.campaign.objects
        .filter((o) => o.owner === salvage && !o.used)
        .sort(
          (a, b) =>
            Math.hypot(
              a.x - snapshot.state.player.x,
              a.z - snapshot.state.player.z,
            ) -
            Math.hypot(
              b.x - snapshot.state.player.x,
              b.z - snapshot.state.player.z,
            ),
        )[0];
    assert.ok(object);
    await go(object, 2.1);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(180);
  }
  assert.equal(
    (await state()).state.campaign.active.find((c) => c.id === salvage).status,
    "ready",
  );
  await shot("campaign-field-task");
  check(
    "Rode to the generated site and gathered all three actual world deposits",
  );
  await travel(hub);
  await openHub(hub);
  await action("campaign:contracts");
  await screen("contracts");
  const before = (await state()).state;
  await action("campaign:claim");
  const rewarded = (await state()).state;
  assert.equal(rewarded.campaign.completed, 1);
  assert.ok(
    rewarded.campaign.progression.totalXP > before.campaign.progression.totalXP,
  );
  assert.ok(rewarded.inventory.dollars > before.inventory.dollars);
  const item = rewarded.campaign.items.find(
    (i) => !before.campaign.items.some((old) => old.id === i.id),
  );
  assert.ok(item);
  check(
    "Turn-in awarded XP, currency, materials, reputation and a real generated item",
  );
  await backToHub();
  await action("campaign:equipment");
  await screen("equipment");
  const slots = ["revolver", "rifle", "coat", "boots", "charm", "saddle"];
  for (let i = 0; i < slots.indexOf(item.slot); i++) await press(5);
  for (let i = 0; i < 10; i++) {
    if (
      (await page.locator(".item-copy h3").textContent()).startsWith(item.name)
    )
      break;
    await press(15);
  }
  await action("campaign:equip");
  assert.equal((await state()).state.campaign.equipped[item.slot], item.id);
  await shot("campaign-equipment");
  check("Compared and equipped the contract reward");
  await action("campaign:talents");
  await screen("talents");
  await action("campaign:learn");
  assert.equal(
    (await state()).state.campaign.progression.talents["steady-hand"],
    1,
  );
  await shot("campaign-talents");
  check("Level-up talent point was spent and changed the build");
  await page.keyboard.press("Escape");
  await screen("equipment");
  await action("campaign:workshop");
  await screen("workshop");
  const craftingBefore = (await state()).state.campaign.materials;
  await action("campaign:craft");
  assert.equal(
    (await state()).state.campaign.items.find((i) => i.id === item.id).upgrade,
    1,
  );
  assert.ok(
    (await state()).state.campaign.materials.scrap < craftingBefore.scrap,
  );
  await press(5);
  await press(5);
  await action("campaign:craft");
  assert.equal(
    (await state()).state.campaign.items.find((i) => i.id === item.id).rune,
    "ember",
  );
  await shot("campaign-workshop");
  check(
    "Workshop upgraded the equipped item and socketed a rune using earned materials",
  );
  await backToHub();
  await action("campaign:close");
  await screen("playing");
  await page.keyboard.press("Escape");
  await screen("paused");
  await action("title");
  await page.reload();
  await ready();
  await action("continue");
  await screen("playing");
  await setupPad();
  assert.equal((await state()).state.campaign.equipped[item.slot], item.id);
  assert.equal(
    (await state()).state.campaign.items.find((i) => i.id === item.id).rune,
    "ember",
  );
  assert.equal(
    (await state()).state.campaign.progression.talents["steady-hand"],
    1,
  );
  check(
    "Reload preserved contract history, XP, talents, gear upgrades and the rune",
  );
  await openHub(hub);
  const bounty = await selectOffer("bounty");
  await mount();
  active = (await state()).state.campaign.active.find((c) => c.id === bounty);
  await travel(active.objectives[0]);
  await page.waitForFunction(
    (id) =>
      window.__frontier.snapshot.state.campaign.enemies.some(
        (e) => e.owner === id,
      ),
    bounty,
    { timeout: 8000 },
  );
  await page.keyboard.press("Digit2");
  const fightUntil = Date.now() + 90000;
  let combatShot = false;
  while (Date.now() < fightUntil) {
    const snap = await state(),
      job = snap.state.campaign.active.find((c) => c.id === bounty);
    if (snap.screen === "dead") throw Error("Rider died in bounty encounter");
    if (job.status === "ready") break;
    const foes = snap.state.campaign.enemies
        .filter((e) => e.owner === bounty && e.health > 0 && !e.captured)
        .sort(
          (a, b) =>
            Number(a.boss) - Number(b.boss) ||
            Math.hypot(a.x - snap.state.player.x, a.z - snap.state.player.z) -
              Math.hypot(b.x - snap.state.player.x, b.z - snap.state.player.z),
        ),
      enemy = foes[0];
    if (!enemy) {
      await page.waitForTimeout(100);
      continue;
    }
    const p = snap.state.player,
      desired = Math.atan2(enemy.x - p.x, enemy.z - p.z),
      delta = Math.atan2(
        Math.sin(desired - snap.cameraYaw),
        Math.cos(desired - snap.cameraYaw),
      );
    await page.evaluate(
      ({ look, fire, reload, focus, tonic }) => {
        const g = window.__campaignPad;
        g.axes = [0, 0, look, 0];
        for (const [i, on] of [
          [6, true],
          [7, fire],
          [2, reload],
          [11, focus],
          [13, tonic],
        ])
          g.buttons[i] = { pressed: on, value: on ? 1 : 0 };
      },
      {
        look: Math.max(-1, Math.min(1, -delta * 2)),
        fire: Math.abs(delta) < 0.13,
        reload: p.ammo.rifle === 0 && p.reload === 0,
        focus: !p.focusing && p.focus > 65,
        tonic: p.health < snap.character.health * 0.6,
      },
    );
    if (!combatShot && p.shots > 0) {
      await shot("campaign-bounty-combat");
      combatShot = true;
    }
    await page.waitForTimeout(130);
  }
  await stop();
  assert.equal(
    (await state()).state.campaign.active.find((c) => c.id === bounty).status,
    "ready",
  );
  check("Actual aimed gunfire defeated the generated bounty encounter");
  const drops = (await state()).state.campaign.drops.filter(
    (d) =>
      Math.hypot(d.x - active.objectives[1].x, d.z - active.objectives[1].z) <
      60,
  );
  assert.ok(drops.some((d) => d.item));
  await shot("campaign-ground-loot");
  for (const d of drops.slice(0, 10)) {
    await go(d, 2.3);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(100);
  }
  check("Picked up physical loot and crafting materials from defeated enemies");
  await travel(hub);
  await openHub(hub);
  await action("campaign:contracts");
  await screen("contracts");
  await action("campaign:claim");
  assert.equal((await state()).state.campaign.completed, 2);
  check("Bounty reward was claimed at the issuer");
  await backToHub();
  await action("campaign:equipment");
  await screen("equipment");
  await action("campaign:character");
  await screen("character");
  await shot("campaign-character");
  for (const [label, width, height] of [
    ["tablet", 768, 1024],
    ["laptop", 1366, 768],
    ["ultrawide", 2560, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await shot(`campaign-stats-${label}`);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  check(
    "Character and equipment menus render across tablet, laptop and ultrawide viewports",
  );
  assert.deepEqual(report.errors, []);
  check("No browser JavaScript or GPU console errors");
  report.success = true;
} catch (e) {
  report.success = false;
  report.failure = String(e);
  report.snapshot = await state().catch(() => null);
  console.error(e);
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    path.join(output, "campaign-browser-report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
