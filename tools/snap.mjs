// Screenshot Pace with the demo schedule + a habit. node snap.mjs <url> <out.png> <width> <height>
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [url, out, w = '1440', h = '900'] = process.argv.slice(2);
const mobile = Number(w) < 768;
const PORT = 9335;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-snap-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile });
await send('Page.navigate', { url }); await sleep(3000);
await send('Runtime.evaluate', { expression: `createDemoSchedule(); openAddHabitModal(); document.getElementById('habitName').value = 'Drink water'; saveNewHabit(); document.querySelectorAll('.toast').forEach(t => t.remove()); 'ok'` });
await sleep(4500); // let toasts expire
await send('Runtime.evaluate', { expression: `document.querySelectorAll('.toast').forEach(t => t.remove())` });
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
ws.close(); chrome.kill(); await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
console.log('saved', out);
