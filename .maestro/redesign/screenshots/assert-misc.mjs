// Headless computed-style assertions for P1d MISC (no populated app / no Accessibility).
import { chromium } from 'playwright';

const BASE = 'http://localhost:4568';
const E = {
  light: { paper: 'rgb(244, 242, 236)', surface: 'rgb(251, 250, 246)', card: 'rgb(255, 255, 255)',
           block: 'rgb(187, 77, 61)', ink: 'rgb(35, 32, 27)' },
  dark:  { paper: 'rgb(21, 19, 14)', surface: 'rgb(27, 24, 16)', card: 'rgb(34, 30, 21)',
           block: 'rgb(218, 125, 106)', ink: 'rgb(239, 233, 219)' },
};

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
    document.getElementById('__mfix')?.remove();
    const host = document.createElement('div');
    host.id = '__mfix';
    host.innerHTML = `
      <div class="pn-top" id="m-top"></div>
      <div class="pn-mdl" id="m-mdl"></div>
      <div class="pn-input" id="m-input"></div>
      <div class="pn-textarea" id="m-textarea"></div>
      <div class="pn-btn--danger" id="m-danger"></div>
      <div class="terminalLaunchDropdown" id="m-dd"></div>
      <div class="terminalLaunchDropdown__detailsTitle" id="m-ddtext"></div>
      <div class="pn-mdl"><span id="m-font" style="font-family: var(--pn-ui);">Ag</span></div>`;
    document.body.appendChild(host);
    const g = (id) => getComputedStyle(document.getElementById(id));
    const out = {
      readbackTheme: el.getAttribute('data-theme') === null ? '<removed>' : el.getAttribute('data-theme'),
      topBg: g('m-top').backgroundColor, mdlBg: g('m-mdl').backgroundColor,
      inputBg: g('m-input').backgroundColor, textareaBg: g('m-textarea').backgroundColor,
      dangerBg: g('m-danger').backgroundColor, ddBg: g('m-dd').backgroundColor,
      ddText: g('m-ddtext').color, fontFamily: g('m-font').fontFamily,
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
    '1. .pn-top == --pn-paper (flips)': r.topBg === x.paper,
    '2a. .pn-mdl == --pn-card (flips)': r.mdlBg === x.card,
    '2b. .pn-input == --pn-surface (flips)': r.inputBg === x.surface,
    '2c. .pn-textarea == --pn-surface (flips)': r.textareaBg === x.surface,
    '3. .pn-btn--danger bg == --pn-block': r.dangerBg === x.block,
    '4a. .terminalLaunchDropdown bg == --pn-card (was #0a0a0a, flips)': r.ddBg === x.card,
    '4b. .terminalLaunchDropdown text == --pn-ink (flips)': r.ddText === x.ink,
    '5. modal/topbar font == Hanken Grotesk': /Hanken Grotesk/i.test(r.fontFamily),
    '5b. Hanken Grotesk loaded (not system)': r.hankenLoaded === true,
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
}
console.log(`\nOVERALL: ${allPass ? 'ALL PASS' : 'HAS FAILURES'}`);
process.exit(allPass ? 0 : 7);
