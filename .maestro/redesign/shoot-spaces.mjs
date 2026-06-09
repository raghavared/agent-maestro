import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "/Users/subhang/Desktop/Projects/maestro/agent-maestro/.maestro/redesign/screenshots";
mkdirSync(OUT, { recursive: true });

const URL = "http://localhost:4568";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(4000);

// redesign is default-on; confirm the flag is present.
await page.evaluate(() => document.documentElement.setAttribute("data-redesign", ""));

// Click through onboarding if present (Next / Finish / Get Started ...).
async function advanceOnboarding() {
  for (let i = 0; i < 5; i++) {
    const btn = await page.$('button:has-text("Next"), button:has-text("Finish"), button:has-text("Get Started"), button:has-text("Continue"), button:has-text("Done"), button:has-text("Enter")');
    if (!btn) break;
    await btn.click().catch(() => {});
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(1500);
}
await advanceOnboarding();

async function tryExpandSpaces() {
  // If the Spaces panel is collapsed (rail visible), click the expand button.
  const rail = await page.$(".pn-srail, .spacesRail");
  if (rail) {
    const expand = await page.$('.pn-srail button[title="Expand Spaces"]');
    if (expand) { await expand.click().catch(() => {}); await page.waitForTimeout(800); }
  }
}

async function shoot(theme) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-redesign", "");
    if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
  }, theme);
  await page.waitForTimeout(600);

  await page.screenshot({ path: `${OUT}/SpacesLayout-full-${theme}.png` });

  // Crop to the right region (spaces panel + rail) if present.
  const panel = await page.$(".pn-sp, .spacesPanel");
  if (panel) {
    const box = await panel.boundingBox();
    if (box) {
      await page.screenshot({
        path: `${OUT}/SpacesLayout-panel-${theme}.png`,
        clip: { x: Math.max(0, box.x - 8), y: box.y, width: Math.min(box.width + 16, 1440 - box.x), height: box.height },
      });
    }
  }
}

await tryExpandSpaces();
await shoot("light");
await shoot("dark");

await browser.close();
console.log("done");
