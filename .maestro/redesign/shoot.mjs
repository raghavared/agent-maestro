import { chromium } from '/opt/homebrew/lib/node_modules/playwright/index.js';
import { pathToFileURL } from 'url';

const file = pathToFileURL(process.argv[2]).href;
const out = process.argv[3];
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 760, height: 520 } });
await page.goto(file, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log('wrote', out);
