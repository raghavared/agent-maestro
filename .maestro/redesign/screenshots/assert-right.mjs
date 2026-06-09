// Headless computed-style assertions for P1c RIGHT (no populated app / no Accessibility).
import { chromium } from 'playwright';

const BASE = 'http://localhost:4568';
const E = {
  light: { surface: 'rgb(251, 250, 246)', paper: 'rgb(244, 242, 236)', card: 'rgb(255, 255, 255)' },
  dark:  { surface: 'rgb(27, 24, 16)', paper: 'rgb(21, 19, 14)', card: 'rgb(34, 30, 21)' },
};
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('agents-ui-setup-complete-v1', 'true'); } catch {} });
await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.waitForTimeout(700);

async function run(theme) {
  const res = await page.evaluate((theme) => {
    const el = document.documentElement;
    el.dataset.redesign = '';
    if (theme === 'dark') el.dataset.theme = 'dark'; else el.removeAttribute('data-theme');
    document.getElementById('__rfix')?.remove();
    const host = document.createElement('div');
    host.id = '__rfix';
    host.innerHTML = `
      <div class="pn-sp" id="r-sp"></div>
      <div class="pn-st" id="r-st"></div>
      <div class="pn-team" id="r-team"></div>
      <div class="pn-team__head" id="r-teamhead"></div>
      <div class="pn-srail" id="r-srail"></div>
      <div class="rightPanel" id="r-right"></div>
      <div class="pn-sp"><span id="r-font" style="font-family: var(--pn-ui);">Ag</span></div>`;
    document.body.appendChild(host);
    const g = (id) => getComputedStyle(document.getElementById(id));
    const out = {
      readbackTheme: el.getAttribute('data-theme') === null ? '<removed>' : el.getAttribute('data-theme'),
      spBg: g('r-sp').backgroundColor, stBg: g('r-st').backgroundColor, teamBg: g('r-team').backgroundColor,
      teamHeadBg: g('r-teamhead').backgroundColor, srailBg: g('r-srail').backgroundColor,
      rightPanelBg: g('r-right').backgroundColor, fontFamily: g('r-font').fontFamily,
    };
    host.remove();
    return out;
  }, theme);
  res.hankenLoaded = await page.evaluate(async () => {
    try { await document.fonts.load("16px 'Hanken Grotesk'"); return document.fonts.check("16px 'Hanken Grotesk'"); }
    catch { return null; }
  });
  return res;
}

const report = {};
for (const theme of ['light', 'dark']) {
  const r = await run(theme);
  const x = E[theme];
  report[theme] = { raw: r, asserts: {
    'readback theme ok': theme === 'dark' ? r.readbackTheme === 'dark' : r.readbackTheme === '<removed>',
    '1. .pn-sp == --pn-surface (flips)': r.spBg === x.surface,
    '2a. .pn-st base transparent (inherits surface, NOT stuck dark)': r.stBg === TRANSPARENT,
    '2b. .pn-team == --pn-card (flips)': r.teamBg === x.card,
    '2c. .pn-team__head == --pn-surface (flips)': r.teamHeadBg === x.surface,
    '3. .pn-srail == --pn-paper (flips)': r.srailBg === x.paper,
    '5. right-panel font == Hanken Grotesk': /Hanken Grotesk/i.test(r.fontFamily),
    '5b. Hanken Grotesk loaded': r.hankenLoaded === true,
  }};
}
await browser.close();

let allPass = true;
for (const theme of ['light', 'dark']) {
  console.log(`\n=== ${theme.toUpperCase()} ===`);
  console.log('  raw:', JSON.stringify(report[theme].raw));
  for (const [k, v] of Object.entries(report[theme].asserts)) {
    console.log(`  [${v ? 'PASS' : 'FAIL'}] ${k}`);
    if (!v) allPass = false;
  }
  console.log(`  [INFO] 4. .rightPanel (legacy wrapper, var(--panel)) computed bg = ${report[theme].raw.rightPanelBg}`);
}
console.log(`\nOVERALL: ${allPass ? 'ALL PASS' : 'HAS FAILURES'}`);
process.exit(allPass ? 0 : 8);
