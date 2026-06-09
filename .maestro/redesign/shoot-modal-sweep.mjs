import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const harness = pathToFileURL(path.join(here, "modal-sweep-preview.html")).href;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 2080, height: 1400 }, deviceScaleFactor: 2 });
await page.goto(harness, { waitUntil: "networkidle" });
await page.waitForTimeout(800); // let Google Fonts settle

// Light
await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(here, "modal-sweep-light.png"), fullPage: true });

// Dark
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(here, "modal-sweep-dark.png"), fullPage: true });

await browser.close();
console.log("OK: wrote modal-sweep-light.png + modal-sweep-dark.png");
