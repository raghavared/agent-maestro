import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
const errs = [], fails = [];
p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
p.on('requestfailed', r => fails.push(`${r.url()} :: ${r.failure()?.errorText}`));
await p.addInitScript(() => { try{localStorage.setItem('agents-ui-setup-complete-v1','true');}catch{} });
await p.goto('http://localhost:4568', { waitUntil:'networkidle' }).catch(()=>{});
await p.waitForTimeout(3000);
const probe = await p.evaluate(async () => {
  const out = {};
  for (const port of [4567, 4569]) {
    try {
      const r = await fetch(`http://localhost:${port}/api/projects`);
      const j = await r.json();
      out[port] = { status: r.status, count: Array.isArray(j) ? j.length : 'not-array' };
    } catch(e){ out[port] = { fetchErr: String(e) }; }
  }
  out.bodyText = document.body.innerText.slice(0,160);
  return out;
});
console.log('PROBE', JSON.stringify(probe,null,2));
console.log('CONSOLE_ERRORS', JSON.stringify(errs.slice(0,8),null,2));
console.log('REQ_FAILED', JSON.stringify(fails.slice(0,8),null,2));
await b.close();
