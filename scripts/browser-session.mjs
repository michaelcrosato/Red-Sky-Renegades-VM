import { chromium } from "@playwright/test";
import os from "node:os";
const windows = process.platform === "win32";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    (windows
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : `${os.homedir()}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`),
  headless: true,
  args: windows
    ? ["--remote-debugging-port=9239"]
    : [
        "--enable-unsafe-webgpu",
        "--use-angle=swiftshader",
        "--enable-features=Vulkan",
        "--disable-vulkan-surface",
        "--remote-debugging-port=9239",
      ],
});
browser.on("disconnected", () => process.exit(0));
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
page.on("console", (m) => {
  if (["error", "warn"].includes(m.type()))
    console.log(m.type(), m.text().slice(0, 2000));
});
await page.goto(process.env.GAME_URL || "http://localhost:5188", {
  waitUntil: "domcontentloaded",
});
console.log("PAGE OPEN");
await page.waitForFunction(() => window.__frontier?.snapshot.ready, {
  timeout: 120000,
});
console.log(
  "RENDERER READY",
  await page.evaluate(async () => {
    const a = await navigator.gpu.requestAdapter();
    return {
      vendor: a.info.vendor,
      architecture: a.info.architecture,
      description: a.info.description,
    };
  }),
);
await page.keyboard.press("Escape");
await page.waitForTimeout(1000);
await page.screenshot({
  path: windows
    ? "\\\\wsl.localhost\\Ubuntu\\tmp\\red-sky-qa\\native-title.png"
    : "/tmp/red-sky-qa/native-title.png",
});
console.log("TITLE SHOT");
setInterval(() => {}, 10000);
