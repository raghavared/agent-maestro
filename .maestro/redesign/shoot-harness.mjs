import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const OUT = "/Users/subhang/Desktop/Projects/maestro/agent-maestro/.maestro/redesign/screenshots";
mkdirSync(OUT, { recursive: true });
const FILE = "file:///Users/subhang/Desktop/Projects/maestro/agent-maestro/.maestro/redesign/spaces-harness.html";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 760, height: 760 }, deviceScaleFactor: 2 });
for (const theme of ["light", "dark"]) {
  await page.goto(FILE, { waitUntil: "domcontentloaded" });
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-redesign", "");
    if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
  }, theme);
  await page.waitForTimeout(400);
  const stage = await page.$(".stage");
  const box = await stage.boundingBox();
  await page.screenshot({
    path: `${OUT}/SpacesLayout-harness-${theme}.png`,
    clip: { x: box.x + box.width - 420, y: box.y, width: 420, height: box.height },
  });
}
await browser.close();
console.log("done");
