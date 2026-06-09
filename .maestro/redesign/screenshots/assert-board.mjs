// Headless computed-style assertions for P1e BOARD (no populated app / no Accessibility needed).
import { chromium } from 'playwright';

const BASE = 'http://localhost:4568';
// Expected token rgb per theme.
const E = {
  light: { paper: 'rgb(244, 242, 236)', surface: 'rgb(251, 250, 246)', card: 'rgb(255, 255, 255)', term: 'rgb(28, 26, 22)' },
  dark:  { paper: 'rgb(21, 19, 14)',    surface: 'rgb(27, 24, 16)',    card: 'rgb(34, 30, 21)',    term: 'rgb(16, 14, 10)' },
};

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('agents-ui-setup-complete-v1', 'true'); } catch {} });
await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(700);

async function run(theme) {
  return page.evaluate((theme) => {
    const el = document.documentElement;
    el.dataset.redesign = '';
    if (theme === 'dark') el.dataset.theme = 'dark'; else el.removeAttribute('data-theme');
    document.getElementById('__bfix')?.remove();
    const host = document.createElement('div');
    host.id = '__bfix';
    host.innerHTML = `
      <div class="taskBoardOverlay" id="b-tbo"></div>
      <div class="taskBoardContainer" id="b-tbc"></div>
      <div class="mpbOverlay" id="b-mpo"></div>
      <div class="mpbContainer" id="b-mpc"></div>
      <div class="pn-bcol" id="b-col"></div>
      <div class="pn-bcard" id="b-card"></div>
      <div class="pn-tv" id="b-tv"></div>
      <div class="pn-tv__term" id="b-term"></div>`;
    document.body.appendChild(host);
    const bg = (id) => getComputedStyle(document.getElementById(id)).backgroundColor;
    const out = {
      readbackTheme: el.getAttribute('data-theme') === null ? '<removed>' : el.getAttribute('data-theme'),
      tboBg: bg('b-tbo'), tbcBg: bg('b-tbc'), mpoBg: bg('b-mpo'), mpcBg: bg('b-mpc'),
      colBg: bg('b-col'), cardBg: bg('b-card'), tvBg: bg('b-tv'), termBg: bg('b-term'),
    };
    host.remove();
    return out;
  }, theme);
}

const report = {};
for (const theme of ['light', 'dark']) {
  const r = await run(theme);
  const x = E[theme];
  report[theme] = { raw: r, asserts: {
    'readback theme ok': theme === 'dark' ? r.readbackTheme === 'dark' : r.readbackTheme === '<removed>',
    '1a. .taskBoardOverlay == --pn-paper': r.tboBg === x.paper,
    '1b. .mpbOverlay == --pn-paper': r.mpoBg === x.paper,
    '2a. .taskBoardContainer == --pn-surface': r.tbcBg === x.surface,
    '2b. .mpbContainer == --pn-surface': r.mpcBg === x.surface,
    '3a. .pn-bcol == --pn-surface (flips)': r.colBg === x.surface,
    '3b. .pn-bcard == --pn-card (flips)': r.cardBg === x.card,
    '3c. .pn-tv == --pn-surface (flips)': r.tvBg === x.surface,
    '4. .pn-tv__term stays DARK (by-design)': r.termBg === x.term,
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
process.exit(allPass ? 0 : 5);
