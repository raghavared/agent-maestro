// Headless computed-style assertions for P1f VIEWS (no populated app / no Accessibility).
import { chromium } from 'playwright';

const BASE = 'http://localhost:4568';
const E = {
  light: { paper: 'rgb(244, 242, 236)', surface: 'rgb(251, 250, 246)', card: 'rgb(255, 255, 255)',
           block: 'rgb(187, 77, 61)', wait: 'rgb(189, 138, 42)' },
  dark:  { paper: 'rgb(21, 19, 14)', surface: 'rgb(27, 24, 16)', card: 'rgb(34, 30, 21)',
           block: 'rgb(218, 125, 106)', wait: 'rgb(217, 170, 73)' },
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
    document.getElementById('__vfix')?.remove();
    const host = document.createElement('div');
    host.id = '__vfix';
    host.innerHTML = `
      <div class="pn-vstage" id="v-stage"></div>
      <div class="pn-vframe" id="v-frame"></div>
      <div class="pn-dlg" id="v-dlg"></div>
      <div class="pn-dlg__icon--danger" id="v-danger"></div>
      <div class="pn-dlg__icon--warn" id="v-warn"></div>
      <div class="pn-vframe"><span id="v-font" style="font-family: var(--pn-ui);">Ag</span></div>`;
    document.body.appendChild(host);
    const g = (id) => getComputedStyle(document.getElementById(id));
    const out = {
      readbackTheme: el.getAttribute('data-theme') === null ? '<removed>' : el.getAttribute('data-theme'),
      stageBg: g('v-stage').backgroundColor, frameBg: g('v-frame').backgroundColor,
      dlgBg: g('v-dlg').backgroundColor, dangerColor: g('v-danger').color, warnColor: g('v-warn').color,
      fontFamily: g('v-font').fontFamily,
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
    '1a. .pn-vstage == --pn-paper (flips)': r.stageBg === x.paper,
    '1b. .pn-vframe (panel container) == --pn-surface (flips)': r.frameBg === x.surface,
    '2a. .pn-dlg == --pn-card (flips)': r.dlgBg === x.card,
    '2b. .pn-dlg__icon--danger color == --pn-block': r.dangerColor === x.block,
    '2c. .pn-dlg__icon--warn color == --pn-wait': r.warnColor === x.wait,
    '3. Views font-family incl Hanken Grotesk': /Hanken Grotesk/i.test(r.fontFamily),
    '3b. Hanken Grotesk loaded (not system)': r.hankenLoaded === true,
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
process.exit(allPass ? 0 : 6);
