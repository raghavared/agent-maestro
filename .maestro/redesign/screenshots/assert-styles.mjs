// Headless computed-style assertions for the P1a LEFT redesign (no populated app / no Accessibility needed).
// Forces html[data-redesign][data-theme] and reads getComputedStyle against the app's loaded stylesheets,
// using injected fixtures with the real classes.
import { chromium } from 'playwright';

const BASE = 'http://localhost:4568';
const EXPECT = {
  light: { surface: 'rgb(251, 250, 246)' /*#FBFAF6*/, paper: 'rgb(244, 242, 236)' /*#F4F2EC*/ },
  dark:  { surface: 'rgb(27, 24, 16)'   /*#1B1810*/, paper: 'rgb(21, 19, 14)'   /*#15130E*/ },
};

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('agents-ui-setup-complete-v1', 'true'); } catch {} });
await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.waitForTimeout(800);

async function run(theme) {
  const res = await page.evaluate((theme) => {
    const el = document.documentElement;
    el.dataset.redesign = '';
    if (theme === 'dark') el.dataset.theme = 'dark'; else el.removeAttribute('data-theme');
    const readbackTheme = el.getAttribute('data-theme');

    // clean prior fixture
    document.getElementById('__fix')?.remove();
    const host = document.createElement('div');
    host.id = '__fix';
    host.innerHTML = `
      <div class="pn-mp" id="f-mp"></div>
      <div class="pn-rail" id="f-rail"></div>
      <div class="pnLeakSkin" id="f-skin"><div id="f-leak" style="background: var(--panel);"></div></div>
      <div id="f-font" style="font-family: var(--pn-ui);">Ag</div>
    `;
    document.body.appendChild(host);
    const cs = (id) => getComputedStyle(document.getElementById(id));
    const tok = (name) => getComputedStyle(el).getPropertyValue(name).trim();
    const out = {
      readbackTheme: readbackTheme === null ? '<removed>' : readbackTheme,
      redesignOn: el.hasAttribute('data-redesign'),
      tokenSurface: tok('--pn-surface'),
      tokenPaper: tok('--pn-paper'),
      mpBg: cs('f-mp').backgroundColor,
      railBg: cs('f-rail').backgroundColor,
      leakBg: cs('f-leak').backgroundColor,
      uiToken: tok('--pn-ui'),
      fontFamily: cs('f-font').fontFamily,
      registeredFamilies: document.fonts ? [...document.fonts].map(f => f.family) : [],
    };
    host.remove();
    return out;
  }, theme);
  // Actually load the face, then check availability (lazy until used).
  const hankenLoaded = await page.evaluate(async () => {
    try { await document.fonts.load("16px 'Hanken Grotesk'"); return document.fonts.check("16px 'Hanken Grotesk'"); }
    catch { return null; }
  });
  res.hankenLoaded = hankenLoaded;
  return res;
}

const report = {};
for (const theme of ['light', 'dark']) {
  const r = await run(theme);
  const exp = EXPECT[theme];
  report[theme] = {
    raw: r,
    asserts: {
      'data-theme readback': theme === 'dark' ? r.readbackTheme === 'dark' : r.readbackTheme === '<removed>',
      'data-redesign on': r.redesignOn === true,
      '1. .pn-mp bg === --pn-surface': r.mpBg === exp.surface,
      '2. .pn-rail bg === --pn-paper': r.railBg === exp.paper,
      '3. .pnLeakSkin var(--panel) -> --pn-surface': r.leakBg === exp.surface,
      '4. var(--pn-ui) resolves font-family incl Hanken Grotesk': /Hanken Grotesk/i.test(r.fontFamily),
      '4b. Hanken Grotesk @font-face registered (bundled)': r.registeredFamilies.some(f => /Hanken Grotesk/i.test(f)),
      '4c. Hanken Grotesk loads (not system fallback)': r.hankenLoaded === true,
    },
  };
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
process.exit(allPass ? 0 : 4);
