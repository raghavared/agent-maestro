// Deterministic headless test of the redesign data-theme PERSISTENCE fix.
// Proves: a persisted 'dark' choice survives a reload (initRedesignTheme reads
// localStorage['maestro-redesign-theme-v1'] at startup and re-applies data-theme).
// No populated app needed — exercised on the empty-state screen.
import { chromium } from 'playwright';

const BASE = 'http://localhost:4568';
const DIR = '/Users/subhang/Desktop/Projects/maestro/agent-maestro/.maestro/redesign/screenshots';
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1440, height: 900 } });

// Only seed setup-complete (NOT the theme — that must survive the reload on its own).
await page.addInitScript(() => {
  try { localStorage.setItem('agents-ui-setup-complete-v1', 'true'); } catch {}
});

await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
// Establish a clean light baseline (no persisted choice -> initRedesignTheme defaults light).
await page.evaluate(() => localStorage.removeItem('maestro-redesign-theme-v1'));
await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(1500);
const before = await page.evaluate(() => ({
  theme: document.documentElement.getAttribute('data-theme'),
  redesign: document.documentElement.hasAttribute('data-redesign'),
  persisted: localStorage.getItem('maestro-redesign-theme-v1'),
}));
await page.screenshot({ path: `${DIR}/_persist-1-before-light.png`, fullPage: true });

// Simulate the TopBar toggle -> dark: persist exactly what persistTheme() writes.
await page.evaluate(() => localStorage.setItem('maestro-redesign-theme-v1', 'dark'));

// Reload — initRedesignTheme() should read 'dark' and re-apply data-theme="dark".
await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(1500);
const afterReload = await page.evaluate(() => ({
  theme: document.documentElement.getAttribute('data-theme'),
  redesign: document.documentElement.hasAttribute('data-redesign'),
  persisted: localStorage.getItem('maestro-redesign-theme-v1'),
}));
await page.screenshot({ path: `${DIR}/_persist-2-afterreload-dark.png`, fullPage: true });

await browser.close();

const pass = (before.theme === null || before.theme === '') && before.redesign === true
  && afterReload.theme === 'dark' && afterReload.redesign === true;
console.log('BEFORE (persisted=light):', JSON.stringify(before));
console.log('AFTER RELOAD (persisted=dark):', JSON.stringify(afterReload));
console.log('PERSISTENCE TEST:', pass ? 'PASS — dark survived reload, data-redesign stayed on' : 'FAIL');
process.exit(pass ? 0 : 3);
