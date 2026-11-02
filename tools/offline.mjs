// Loads Pace online, then reloads offline: should still open from the service worker cache.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const url = process.argv[2] || 'http://localhost:8080/';
const PORT = 9336;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-off-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async e => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Page.navigate', { url }); await sleep(3500);
await ev(`skipWelcome(); openAddHabitModal(); document.getElementById('habitName').value = 'A'; saveNewHabit(); openAddHabitModal(); document.getElementById('habitName').value = 'B'; saveNewHabit(); 'ok'`);
await sleep(300);
console.log('badges, 2 habits open    :', await ev(`JSON.stringify({ habit: document.getElementById('habitBadge').textContent.trim(), habitShown: getComputedStyle(document.getElementById('habitBadge')).display !== 'none', bellShown: getComputedStyle(document.getElementById('notificationBadge')).display !== 'none' })`));
await ev(`document.querySelector('#habitsList input[type=checkbox]').click()`); await sleep(300);
console.log('badges, after ticking one:', await ev(`document.getElementById('habitBadge').textContent.trim()`));
console.log('sw controlling page      :', await ev(`navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller || 'not yet (first load)')`));
await send('Page.reload'); await sleep(2500); // second load is controlled by the SW
console.log('sw controlling page      :', await ev(`!!navigator.serviceWorker.controller`));

await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await send('Page.reload'); await sleep(3000);
const offline = await ev(`JSON.stringify({ title: document.title, appRendered: !!document.getElementById('quickAddInput'), habits: dailyHabits.length })`);
console.log('OFFLINE reload           :', offline);
ws.close(); chrome.kill(); await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(offline && JSON.parse(offline).appRendered ? 0 : 1);
