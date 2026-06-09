// P2 cleanup flip-asserts — batch 1 (A1 DocViewer, A5 Modals, A6 SessionLogModal, A7-A10).
// Headless: force html[data-redesign][data-theme], inject bare fixtures, getComputedStyle vs the
// SAME-page resolved value of each --pn-* token (probe). Assert per-theme match + light<->dark flip.
// No populated app, no Accessibility. Re-runnable.
import { chromium } from 'playwright';

const BASE = 'http://localhost:4568';

// Each check: surface fixture + which computed prop to read + which token it must equal.
// kind: 'bg'|'color'|'border'(borderTopColor)|'font'. flip:false => theme-independent (scrim/font).
// html: optional custom fixture markup; sel: id of the element to measure (default the root fixture).
const CHECKS = [
  // ---- A1 Doc Viewer ----
  { cluster: 'A1', label: '.docViewerPanel bg', cls: 'docViewerPanel', kind: 'bg', token: '--pn-card' },
  { cluster: 'A1', label: '.docViewerOverlay--fullscreen bg', cls: 'docViewerOverlay docViewerOverlay--fullscreen', kind: 'bg', token: '--pn-paper' },
  { cluster: 'A1', label: '.mermaidZoomControls bg', cls: 'mermaidZoomControls', kind: 'bg', token: '--pn-card' },
  { cluster: 'A1', label: '.docsListCard bg', cls: 'docsListCard', kind: 'bg', token: '--pn-card' },
  { cluster: 'A1', label: '.docViewerIcon color', cls: 'docViewerIcon', kind: 'color', token: '--pn-brand' },
  { cluster: 'A1', label: '.docViewerExtBadge color', cls: 'docViewerExtBadge', kind: 'color', token: '--pn-brand' },
  { cluster: 'A1', label: '.docViewerMarkdown color', cls: 'docViewerMarkdown', kind: 'color', token: '--pn-ink' },
  { cluster: 'A1', label: '.projectDocsListItem__icon bg (brand-soft)', cls: 'projectDocsListItem__icon', kind: 'bg', token: '--pn-brand-soft' },
  { cluster: 'A1', label: '.projectDocsListItem__icon color', cls: 'projectDocsListItem__icon', kind: 'color', token: '--pn-brand' },
  // ---- A5 Modal system ----
  { cluster: 'A5', label: '.themedModal bg', cls: 'themedModal', kind: 'bg', token: '--pn-card' },
  { cluster: 'A5', label: '.themedModal border', cls: 'themedModal', kind: 'border', token: '--pn-line-2' },
  { cluster: 'A5', label: '.modal bg', cls: 'modal', kind: 'bg', token: '--pn-card' },
  { cluster: 'A5', label: '.modal border', cls: 'modal', kind: 'border', token: '--pn-line-2' },
  { cluster: 'A5', label: '.themedModalBackdrop scrim', cls: 'themedModalBackdrop', kind: 'bg', literal: 'rgba(40, 34, 24, 0.45)', flip: false },
  { cluster: 'A5', label: '.modalBackdrop scrim', cls: 'modalBackdrop', kind: 'bg', literal: 'rgba(40, 34, 24, 0.45)', flip: false },
  { cluster: 'A5', label: '.agent-modal-overlay remaps --color-bg-primary', kind: 'bg', token: '--pn-card',
    html: `<div class="agent-modal-overlay"><div id="M" style="background: var(--color-bg-primary)"></div></div>`, sel: 'M' },
  // ---- A6 SessionLogModal ----
  { cluster: 'A6', label: '.terminalTaskModal bg', cls: 'terminalTaskModal', kind: 'bg', token: '--pn-card' },
  { cluster: 'A6', label: '.terminalTaskModal border', cls: 'terminalTaskModal', kind: 'border', token: '--pn-line-2' },
  { cluster: 'A6', label: '.sessionLogModal remaps --style-font-ui->Hanken', kind: 'font', flip: false,
    html: `<div class="sessionLogModal"><span id="F" style="font-family: var(--style-font-ui)">Ag</span></div>`, sel: 'F' },
  // ---- A7-A10 ----
  { cluster: 'A7', label: '.dashMetricCard bg', cls: 'dashMetricCard', kind: 'bg', token: '--pn-card' },
  { cluster: 'A8', label: '.spellPicker bg', cls: 'spellPicker', kind: 'bg', token: '--pn-card' },
  { cluster: 'A8', label: '.spellPicker__title color', cls: 'spellPicker__title', kind: 'color', token: '--pn-brand' },
  { cluster: 'A9', label: '.claudeCodeSkillCard bg', cls: 'claudeCodeSkillCard', kind: 'bg', token: '--pn-surface' },
  { cluster: 'A9', label: '.claudeCodeSkillsLoading bg', cls: 'claudeCodeSkillsLoading', kind: 'bg', token: '--pn-surface' },
  { cluster: 'A10', label: '.git-panel__branch color', cls: 'git-panel__branch', kind: 'color', token: '--pn-ink' },
  { cluster: 'A10', label: '.git-panel__section-title color', cls: 'git-panel__section-title', kind: 'color', token: '--pn-ink-3' },
  { cluster: 'A10', label: '.git-panel border', cls: 'git-panel', kind: 'border', token: '--pn-line' },
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

    // Pre-resolve every token used (once) to its computed serialization for bg/color/border.
    // Done up front so no probe is created/removed between fixture measurements (that DOM
    // thrash caused transient style-recalc misreads — e.g. border falling back to currentColor).
    const tokens = [...new Set(checks.filter(c => c.token).map(c => c.token))];
    const tokMap = {};
    {
      const pbox = document.createElement('div');
      pbox.id = '__pb';
      for (const t of tokens) {
        const p = document.createElement('div');
        p.dataset.tok = t;
        p.style.cssText = `background:var(${t});color:var(${t});border-top:1px solid var(${t});`;
        pbox.appendChild(p);
      }
      document.body.appendChild(pbox);
      void pbox.offsetHeight; // force layout/style flush
      for (const p of pbox.children) {
        const cs = getComputedStyle(p);
        tokMap[p.dataset.tok] = { bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor };
      }
      pbox.remove();
    }
    const resolve = (token, kind) => {
      const m = tokMap[token];
      return kind === 'color' ? m.color : kind === 'border' ? m.border : m.bg;
    };

    document.getElementById('__cb')?.remove();
    const host = document.createElement('div');
    host.id = '__cb';
    document.body.appendChild(host);

    const out = [];
    for (const c of checks) {
      const wrap = document.createElement('div');
      let target;
      if (c.html) { wrap.innerHTML = c.html; host.appendChild(wrap); target = wrap.querySelector('#' + c.sel); }
      else { const d = document.createElement('div'); d.className = c.cls; d.textContent = 'Ag'; wrap.appendChild(d); host.appendChild(wrap); target = d; }
      void target.offsetHeight; // force layout before read
      const cs = getComputedStyle(target);
      let actual;
      if (c.kind === 'font') actual = cs.fontFamily;
      else if (c.kind === 'color') actual = cs.color;
      else if (c.kind === 'border') actual = cs[c.borderProp || 'borderTopColor'];
      else actual = cs.backgroundColor;
      const expected = c.literal ? c.literal : c.token ? resolve(c.token, c.kind) : null;
      out.push({ label: c.label, cluster: c.cluster, actual, expected, kind: c.kind });
    }
    host.remove();
    return { readback, out };
  }, { theme, checks });
}

const L = await run('light', CHECKS);
const D = await run('dark', CHECKS);
const hanken = await page.evaluate(async () => { try { await document.fonts.load("16px 'Hanken Grotesk'"); return document.fonts.check("16px 'Hanken Grotesk'"); } catch { return null; } });
await browser.close();

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
let pass = 0, fail = 0;
const rows = [];
for (let i = 0; i < CHECKS.length; i++) {
  const c = CHECKS[i], l = L.out[i], d = D.out[i];
  const flipExpected = c.flip !== false; // default true
  let lOk, dOk;
  if (c.kind === 'font') { lOk = /Hanken Grotesk/i.test(l.actual); dOk = /Hanken Grotesk/i.test(d.actual); }
  else { lOk = norm(l.actual) === norm(l.expected); dOk = norm(d.actual) === norm(d.expected); }
  const flips = norm(l.actual) !== norm(d.actual);
  const flipOk = flipExpected ? flips : true;
  const ok = lOk && dOk && flipOk;
  if (ok) pass++; else fail++;
  rows.push({ c, l, d, lOk, dOk, flips, flipExpected, flipOk, ok });
}

console.log(`readback: light=${L.readback} dark=${D.readback}  Hanken loaded=${hanken}`);
let cur = '';
for (const r of rows) {
  if (r.c.cluster !== cur) { cur = r.c.cluster; console.log(`\n── ${cur} ──`); }
  const tag = r.ok ? 'PASS' : 'FAIL';
  const flipNote = r.flipExpected ? (r.flips ? 'flips' : 'NO-FLIP') : 'static';
  console.log(`  [${tag}] ${r.c.label}  (${flipNote})`);
  if (!r.ok) {
    if (!r.lOk) console.log(`         light: got ${norm(r.l.actual)}  want ${norm(r.l.expected)}`);
    if (!r.dOk) console.log(`         dark:  got ${norm(r.d.actual)}  want ${norm(r.d.expected)}`);
    if (r.flipExpected && !r.flips) console.log(`         did NOT flip (light===dark: ${norm(r.l.actual)})`);
  }
}
console.log(`\nOVERALL: ${fail === 0 ? 'ALL PASS' : fail + ' FAIL'} / ${CHECKS.length} checks`);
process.exit(fail === 0 ? 0 : 9);
