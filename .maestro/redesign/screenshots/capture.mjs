// Reusable screenshot capture for the redesign staging UI.
// Usage:
//   node capture.mjs --label <label> --theme <light|dark> --out <path> \
//        [--route <path>] [--wait <ms>] [--selector <css>] \
//        [--click "<css>" ...] [--full] [--width N] [--height N]
//
// Drives http://localhost:4568 (Vite). Sets redesign theme via data-theme.
import { chromium } from 'playwright';

function parseArgs(argv) {
  const a = { clicks: [], wait: 1200, width: 1440, height: 900, full: false, route: '/', theme: 'light' };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--label') a.label = argv[++i];
    else if (k === '--theme') a.theme = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--route') a.route = argv[++i];
    else if (k === '--wait') a.wait = parseInt(argv[++i], 10);
    else if (k === '--selector') a.selector = argv[++i];
    else if (k === '--click') a.clicks.push(argv[++i]);
    else if (k === '--full') a.full = true;
    else if (k === '--width') a.width = parseInt(argv[++i], 10);
    else if (k === '--height') a.height = parseInt(argv[++i], 10);
  }
  return a;
}

const args = parseArgs(process.argv);
if (!args.out) { console.error('missing --out'); process.exit(1); }

const BASE = process.env.STAGING_URL || 'http://localhost:4568';
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: args.width, height: args.height } });

// Skip the first-run startup/onboarding overlay before the app mounts.
await page.addInitScript(() => {
  try { localStorage.setItem('agents-ui-setup-complete-v1', 'true'); } catch {}
});

const url = BASE + (args.route.startsWith('/') ? args.route : '/' + args.route);
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});

await page.waitForTimeout(300);

for (const sel of args.clicks) {
  try { await page.click(sel, { timeout: 5000 }); await page.waitForTimeout(400); }
  catch (e) { console.error('click failed:', sel, e.message); }
}

await page.waitForTimeout(args.wait);

// DETERMINISTIC theme set + read-back assertion (coordinator root-cause fix).
// Redesign dark tokens live under html[data-redesign][data-theme=dark].
// LIGHT = data-redesign present, data-theme removed. DARK = data-theme='dark'.
// Done LAST (after nav/settle) so the app's theme store can't overwrite it before capture.
const verified = await page.evaluate((theme) => {
  const el = document.documentElement;
  el.dataset.redesign = '';
  if (theme === 'dark') el.dataset.theme = 'dark';
  else el.removeAttribute('data-theme');
  return { theme: el.getAttribute('data-theme'), redesign: el.hasAttribute('data-redesign') };
}, args.theme);
const expected = args.theme === 'dark' ? 'dark' : null;
if (!verified.redesign || verified.theme !== expected) {
  console.error(`THEME ASSERT FAILED — expected data-theme=${expected} redesign=true, got`, verified);
  await browser.close();
  process.exit(2);
}
console.log(`theme verified: ${args.theme} (data-theme=${verified.theme === null ? '<removed>' : verified.theme}, data-redesign=on)`);
await page.waitForTimeout(250);

let target = page;
if (args.selector) {
  const el = await page.$(args.selector);
  if (el) target = el;
  else console.error('selector not found, falling back to page:', args.selector);
}

await target.screenshot({ path: args.out, fullPage: args.selector ? false : args.full });
await browser.close();
console.log('wrote', args.out);
