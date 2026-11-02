// Headless Chrome smoke test over CDP, no deps. node check.mjs <url> [--ai "command"]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const url = process.argv[2] || 'http://localhost:8080/';
const aiIdx = process.argv.indexOf('--ai');
const aiCommand = aiIdx > 0 ? process.argv[aiIdx + 1] : null;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-chrome-'));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--window-size=1440,900', 'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (targets.length) break; } catch {}
  await sleep(200);
}
const page = targets.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));

let nextId = 1;
const pending = new Map();
const errors = [];
const logs = [];
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    errors.push(`EXCEPTION: ${d.exception?.description || d.text} @${d.lineNumber}`);
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
    if (msg.params.type === 'error') errors.push(`console.error: ${text}`);
    else logs.push(`${msg.params.type}: ${text}`);
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    errors.push(`log: ${msg.params.entry.text} ${msg.params.entry.url || ''}`);
  }
});
const send = (method, params = {}) => new Promise(r => {
  const id = nextId++; pending.set(id, r); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
  return r.result.result.value;
};
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');

const fakeIdx = process.argv.indexOf('--fake-date');
if (fakeIdx > 0) {
  // Freeze "now" to a given date (e.g. a Wednesday) before any page script runs
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const T = new Date(${JSON.stringify(process.argv[fakeIdx + 1])}).getTime(); const R = Date;
    globalThis.Date = class extends R { constructor(...a) { a.length ? super(...a) : super(T); } static now() { return T; } };
  })();` });
}

await send('Page.navigate', { url });
await sleep(3500); // welcome modal opens at load + 1000 + 500ms

check('welcome modal visible', await evaluate(`document.getElementById('welcomeModal')?.classList.contains('active')`));
check('quick add input rendered', await evaluate(`!!document.getElementById('quickAddInput')`));
check('spinner clear after load', !(await evaluate(`document.getElementById('loadingOverlay').classList.contains('active')`)));

await evaluate(`createDemoSchedule()`);
await sleep(500);
const demoCount = await evaluate(`scheduledEvents.length`);
check('demo schedule loaded', demoCount > 0, `${demoCount} events`);
const demoDays = await evaluate(`JSON.stringify([...new Set(scheduledEvents.map(e => e.day))].sort((a,b)=>a-b))`);
check('demo days are 1..7', demoDays === '[1,2,3,4,5,6,7]', `today=${await evaluate('new Date().toDateString()')} days=${demoDays}`);
// "Team Standup" (Mon) and "Week Review" (Sun) exist only in the demo data, not the static placeholder markup
const rendered = await evaluate(`(() => { const t = [...document.querySelectorAll('.event-title')].map(e => e.textContent.trim()); return ['Team Standup', 'Week Review'].filter(x => t.includes(x)).join(','); })()`);
check('Mon + Sun demo events rendered', rendered === 'Team Standup,Week Review', rendered || 'neither rendered');

if (process.argv.includes('--routing')) {
  // Spy on which path parseQuickAdd picks, without actually adding anything
  const routing = await evaluate(`(() => {
    const realAI = processAIScheduleRequest, realSimple = parseQuickAddSimple;
    let picked;
    processAIScheduleRequest = () => { picked = 'AI'; };
    parseQuickAddSimple = () => { picked = 'simple'; };
    const cases = {
      'call mom tomorrow 5pm': 'simple', 'small talk practice friday 3pm': 'simple',
      'football practice saturday 10am': 'simple', 'all day offsite friday': 'simple',
      'workout tomorrow 6am': 'simple', 'dinner with ball team thursday 7pm': 'simple',
      'add a break after each meeting': 'AI', 'warmup before every workout': 'AI',
      'add stretching after all workouts': 'AI', 'standup every weekday at 9am': 'simple', 'bedtime routine every evening 7:30pm': 'simple',
      'meditate each morning': 'AI', 'block all meetings for focus': 'AI'
    };
    const out = [];
    for (const [text, want] of Object.entries(cases)) {
      picked = null;
      document.getElementById('quickAddInput').value = text;
      parseQuickAdd();
      out.push({ text, want, got: picked });
    }
    processAIScheduleRequest = realAI; parseQuickAddSimple = realSimple;
    document.getElementById('quickAddInput').value = '';
    return out;
  })()`);
  for (const r of routing) check(`route "${r.text}" -> ${r.want}`, r.got === r.want, r.got === r.want ? '' : `got ${r.got}`);
}

await evaluate(`(() => { const i = document.getElementById('quickAddInput'); i.value = 'workout tomorrow 6am'; parseQuickAdd(); })()`);
await sleep(1500);
const afterSimple = await evaluate(`scheduledEvents.length`);
check('simple Quick Add adds event', afterSimple === demoCount + 1, `${demoCount} -> ${afterSimple}`);
check('spinner clear after Quick Add', !(await evaluate(`document.getElementById('loadingOverlay').classList.contains('active')`)));

if (aiCommand) {
  await evaluate(`(() => { const i = document.getElementById('quickAddInput'); i.value = ${JSON.stringify(aiCommand)}; parseQuickAdd(); })()`);
  for (let i = 0; i < 60; i++) { await sleep(500); if (!(await evaluate(`aiProcessing`))) break; }
  const afterAI = await evaluate(`scheduledEvents.length`);
  const added = await evaluate(`JSON.stringify(scheduledEvents.slice(${afterSimple}).map(e => [e.title, e.day, e.time, e.duration, e.category]))`);
  const toast = await evaluate(`[...document.querySelectorAll('.toast')].map(t => t.innerText.replace(/\\s+/g,' ')).join(' | ')`);
  check('AI batch command adds events', afterAI > afterSimple, `${afterSimple} -> ${afterAI} ${added}`);
  check('spinner clear after AI', !(await evaluate(`document.getElementById('loadingOverlay').classList.contains('active')`)));
  console.log('toasts:', toast);
}

const beforeReload = await evaluate(`scheduledEvents.length`);
await send('Page.reload');
await sleep(2500);
const afterReload = await evaluate(`scheduledEvents.length`);
check('data survives reload', afterReload === beforeReload, `${beforeReload} -> ${afterReload}`);
// manifest.json is optional per CLAUDE.md; favicon is cosmetic
const known = /manifest\.json|favicon\.ico/;
const ignored = errors.filter(e => known.test(e)).length;
const real = errors.filter(e => !known.test(e));
check('no console errors', real.length === 0, real.join('\n    ') || `${ignored} known manifest/favicon 404s ignored`);

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`);
if (process.argv.includes('--logs')) console.log(logs.join('\n'));
ws.close();
chrome.kill();
await sleep(500);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(results.every(r => r.ok) ? 0 : 1);
