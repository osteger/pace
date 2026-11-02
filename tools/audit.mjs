// Drives Pace's everyday flows in headless Chrome and reports what breaks. node audit.mjs <url> [--mobile]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const url = process.argv[2] || 'http://localhost:8080/';
const mobile = process.argv.includes('--mobile');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9334;
import { waitPortFree, stopChrome } from './chrome-port.mjs';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-audit-'));
await waitPortFree(PORT);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', `--window-size=${mobile ? '390,844' : '1440,900'}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));

let nextId = 1; const pending = new Map();
let stepErrors = []; let stepDialogs = [];
const send = (method, params = {}) => new Promise(r => { const id = nextId++; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; stepErrors.push((d.exception?.description || d.text).split('\n').slice(0, 2).join(' ')); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') stepErrors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 200));
  if (m.method === 'Page.javascriptDialogOpening') { stepDialogs.push(`${m.params.type}: ${m.params.message.slice(0, 100)}`); send('Page.handleJavaScriptDialog', { accept: true }); }
});
const ev = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.result?.exceptionDetails) return `THREW: ${(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).split('\n')[0]}`;
  return r.result?.result?.value;
};
const report = [];
async function step(name, expr, waitMs = 600) {
  stepErrors = []; stepDialogs = [];
  const out = await ev(expr);
  await sleep(waitMs);
  report.push({ name, out, errors: [...new Set(stepErrors)], dialogs: stepDialogs });
}
async function reload() { await send('Page.reload'); await sleep(2500); }

await send('Runtime.enable'); await send('Page.enable');
if (mobile) await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send('Page.navigate', { url }); await sleep(3000);

const { steps } = await import(new URL('./audit-steps.mjs', import.meta.url));
for (const [name, expr, wait, kind] of steps) {
  if (kind === 'reload') { await reload(); continue; }
  await step(name, expr, wait ?? 600);
}
for (const r of report) {
  const flag = r.errors.length ? 'ERR ' : r.dialogs.length ? 'DLG ' : '    ';
  console.log(`${flag}${r.name}\n      -> ${typeof r.out === 'string' ? r.out.slice(0, 1200) : JSON.stringify(r.out)}`);
  r.errors.forEach(e => console.log(`      !! ${e}`));
  r.dialogs.forEach(d => console.log(`      [dialog] ${d}`));
}
ws.close(); await stopChrome(chrome, PORT);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
// Fail on page exceptions or a step whose own code threw
const failed = report.filter(r => r.errors.length || (typeof r.out === 'string' && r.out.startsWith('THREW')));
console.log(`\n${report.length} steps, ${failed.length} failed${failed.length ? ': ' + failed.map(r => r.name).join('; ') : ''}`);
process.exit(failed.length ? 1 : 0);

