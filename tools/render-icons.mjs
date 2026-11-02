// Renders icons/*.svg to the PNG sizes the manifest and iOS need, using headless Chrome.
// Run after editing an SVG:  node tools/render-icons.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const iconsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const outputs = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  ['icon-maskable.svg', 'apple-touch-icon.png', 180], // iOS rounds the corners itself, so full-bleed
];
const icoSizes = [16, 32, 48, 256]; // pace.ico, for Windows shortcuts

const PORT = 9337;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-icons-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable');
async function render(svgName, size) {
  const svg = fs.readFileSync(path.join(iconsDir, svgName), 'utf8');
  await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } }); // keep rounded corners transparent
  const html = `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`;
  await send('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') });
  await sleep(400);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
  return Buffer.from(shot.result.data, 'base64');
}

for (const [svgName, pngName, size] of outputs) {
  fs.writeFileSync(path.join(iconsDir, pngName), await render(svgName, size));
  console.log(`icons/${pngName} (${size}px)`);
}

// ICO = 6-byte header + 16-byte directory entry per size + the PNGs themselves (PNG-in-ICO, Windows Vista+)
const pngs = [];
for (const size of icoSizes) pngs.push(await render('icon.svg', size));
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach((png, i) => {
  const e = 6 + 16 * i, size = icoSizes[i];
  header.writeUInt8(size >= 256 ? 0 : size, e);     // 0 means 256
  header.writeUInt8(size >= 256 ? 0 : size, e + 1);
  header.writeUInt16LE(1, e + 4);                   // colour planes
  header.writeUInt16LE(32, e + 6);                  // bits per pixel
  header.writeUInt32LE(png.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
fs.writeFileSync(path.join(iconsDir, 'pace.ico'), Buffer.concat([header, ...pngs]));
console.log(`icons/pace.ico (${icoSizes.join(', ')}px)`);
ws.close(); chrome.kill(); await sleep(300);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
