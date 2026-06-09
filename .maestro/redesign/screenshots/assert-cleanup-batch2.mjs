// P2 cleanup flip-asserts — batch 2: A3/A4 Sessions-view board (moved into
// styles-multi-project-board.css) + Middle-Coordinator residuals (docViewerMarkdown a,
// git-panel__file-list, dashTeamProgressFill brass gradient). Bidirectional: assert each
// surface resolves to a --pn-* token in BOTH light AND dark (reverse-leak guard), no legacy
// dark hex / no neon (#00ff41 / cyan rgb(0,217,255) / green rgb(74,222,128)).
// Headless, no populated app, no Accessibility. Re-runnable.
import { chromium } from 'playwright';

const BASE = 'http://localhost:4568';
const NEON = ['0, 217, 255', '0, 255, 65', '74, 222, 128']; // cyan / matrix-green / tailwind-green

const CHECKS = [
  // ---- A3/A4 board (bare classes, pn tokens; force data-redesign for resolution) ----
  { cluster: 'A3', label: '.mpbSessionProjectHeader bg', cls: 'mpbSessionProjectHeader', kind: 'bg', token: '--pn-brand-soft' },
  { cluster: 'A3', label: '.mpbSessionProjectName color', cls: 'mpbSessionProjectName', kind: 'color', token: '--pn-ink' },
  { cluster: 'A3', label: '.sessionBoardColumn bg (bidirectional)', cls: 'sessionBoardColumn', kind: 'bg', token: '--pn-surface' },
  { cluster: 'A3', label: '.sessionBoardColumn border-right (non-last)', kind: 'border', borderProp: 'borderRightColor', token: '--pn-line',
    html: `<div class="sessionBoardColumns"><div id="X" class="sessionBoardColumn"></div><div class="sessionBoardColumn"></div></div>`, sel: 'X' },
  { cluster: 'A3', label: '.sessionColumnName color', cls: 'sessionColumnName', kind: 'color', token: '--pn-ink' },
  { cluster: 'A3', label: '.sessionBoardColumn--working border (no cyan)', cls: 'sessionBoardColumn sessionBoardColumn--working', kind: 'border', token: '--pn-run-soft', noNeon: true },
  { cluster: 'A4', label: '.taskBoardCard bg', cls: 'taskBoardCard', kind: 'bg', token: '--pn-card' },
  // ---- Middle residuals ----
  { cluster: 'A1', label: '.docViewerMarkdown a color (no #00ff41)', kind: 'color', token: '--pn-brand', noNeon: true,
    html: `<div class="docViewerMarkdown"><a id="X" href="#">link</a></div>`, sel: 'X' },
  { cluster: 'A10', label: '.git-panel__file-list bg', cls: 'git-panel__file-list', kind: 'bg', token: '--pn-surface' },
  { cluster: 'A7', label: '.dashTeamProgressFill brass gradient (no neon)', cls: 'dashTeamProgressFill', kind: 'image', token: '--pn-brand', noNeon: true },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('agents-ui-setup-complete-v1', 'true'); } catch {} });
await page.goto(BASE, { waitUntil: 'networkidle' }).catch(() => {});
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.waitForTimeout(700);

async function run(theme, checks) {
  return await page.evaluate(({ theme, checks }) => {
    const el = document.documentElement;
    el.dataset.redesign = '';
    if (theme === 'dark') el.dataset.theme = 'dark'; else el.removeAttribute('data-theme');
    const readback = el.getAttribute('data-theme') === null ? '<removed>' : el.getAttribute('data-theme');

    const tokens = [...new Set(checks.filter(c => c.token).map(c => c.token))];
    const tokMap = {};
    const pbox = document.createElement('div');
    for (const t of tokens) { const p = document.createElement('div'); p.dataset.tok = t; p.style.cssText = `background:var(${t});color:var(${t});border-top:1px solid var(${t});`; pbox.appendChild(p); }
    document.body.appendChild(pbox); void pbox.offsetHeight;
    for (const p of pbox.children) { const cs = getComputedStyle(p); tokMap[p.dataset.tok] = { bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor }; }
    pbox.remove();
    const resolve = (token, kind) => { const m = tokMap[token]; return kind === 'color' ? m.color : kind === 'border' ? m.border : m.bg; };

    const host = document.createElement('div'); host.id = '__cb2'; document.body.appendChild(host);
    const out = [];
    for (const c of checks) {
      const wrap = document.createElement('div');
      let target;
      if (c.html) { wrap.innerHTML = c.html; host.appendChild(wrap); target = wrap.querySelector('#' + c.sel); }
      else { const d = document.createElement('div'); d.className = c.cls; d.textContent = 'Ag'; wrap.appendChild(d); host.appendChild(wrap); target = d; }
      void target.offsetHeight;
      const cs = getComputedStyle(target);
      let actual;
      if (c.kind === 'image') actual = cs.backgroundImage;
      else if (c.kind === 'color') actual = cs.color;
      else if (c.kind === 'border') actual = cs[c.borderProp || 'borderTopColor'];
      else actual = cs.backgroundColor;
      const expected = c.token ? resolve(c.token, c.kind === 'image' ? 'bg' : c.kind) : null;
      out.push({ actual, expected });
    }
    host.remove();
    return { readback, out };
  }, { theme, checks });
}

const L = await run('light', CHECKS);
const D = await run('dark', CHECKS);
await browser.close();

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
const rgbTriplet = (rgb) => { const m = (rgb || '').match(/(\d+),\s*(\d+),\s*(\d+)/); return m ? `${m[1]}, ${m[2]}, ${m[3]}` : null; };
let pass = 0, fail = 0; const rows = [];
for (let i = 0; i < CHECKS.length; i++) {
  const c = CHECKS[i], l = L.out[i], d = D.out[i];
  let lOk, dOk, neonOk = true;
  if (c.kind === 'image') {
    // gradient must REFERENCE the brand color and contain NO neon
    const lt = rgbTriplet(l.expected), dt = rgbTriplet(d.expected);
    lOk = lt && norm(l.actual).includes(lt);
    dOk = dt && norm(d.actual).includes(dt);
  } else {
    lOk = norm(l.actual) === norm(l.expected);
    dOk = norm(d.actual) === norm(d.expected);
  }
  if (c.noNeon) neonOk = !NEON.some(n => norm(l.actual).includes(n) || norm(d.actual).includes(n));
  const flips = norm(l.actual) !== norm(d.actual);
  const ok = lOk && dOk && neonOk && flips;
  if (ok) pass++; else fail++;
  rows.push({ c, l, d, lOk, dOk, neonOk, flips, ok });
}

console.log(`readback: light=${L.readback} dark=${D.readback}`);
let cur = '';
for (const r of rows) {
  if (r.c.cluster !== cur) { cur = r.c.cluster; console.log(`\n── ${cur} ──`); }
  console.log(`  [${r.ok ? 'PASS' : 'FAIL'}] ${r.c.label}  (${r.flips ? 'flips' : 'NO-FLIP'})`);
  console.log(`         light=${norm(r.l.actual)}  dark=${norm(r.d.actual)}`);
  if (!r.ok) {
    if (!r.lOk) console.log(`         light MISMATCH want ${norm(r.l.expected)}`);
    if (!r.dOk) console.log(`         dark MISMATCH want ${norm(r.d.expected)}`);
    if (!r.neonOk) console.log(`         NEON leak detected`);
    if (!r.flips) console.log(`         did NOT flip`);
  }
}
console.log(`\nOVERALL: ${fail === 0 ? 'ALL PASS' : fail + ' FAIL'} / ${CHECKS.length} checks`);
process.exit(fail === 0 ? 0 : 9);
