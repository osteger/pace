// Asks Chrome whether Pace can be installed as an app (manifest, icons, service worker). node installable.mjs <url>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const url = process.argv[2] || 'http://localhost:8080/';
const PORT = 9338;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-install-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable');
await send('Page.navigate', { url }); await sleep(3000);
await send('Page.reload'); await sleep(2500); // second load: service worker is in control

const manifest = await send('Page.getAppManifest');
const errors = (await send('Page.getInstallabilityErrors')).result?.installabilityErrors || [];
const parsed = JSON.parse(manifest.result?.data || '{}');
// Every icon in the manifest must actually load
const iconChecks = await Promise.all((parsed.icons || []).map(async i => {
  const res = await fetch(new URL(i.src, url)).catch(() => null);
  return `${i.src}: ${res?.ok ? 'ok' : 'MISSING'}`;
}));

console.log('manifest url   :', manifest.result?.url || 'none');
console.log('manifest errors:', JSON.stringify(manifest.result?.errors || []));
console.log('name / display :', parsed.name, '/', parsed.display);
console.log('icons          :', iconChecks.join(', '));
console.log('installable    :', errors.length ? 'NO: ' + errors.map(e => e.errorId).join(', ') : 'yes');

ws.close(); chrome.kill(); await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
const ok = !errors.length && !(manifest.result?.errors || []).length && iconChecks.every(c => c.endsWith('ok'));
process.exit(ok ? 0 : 1);
