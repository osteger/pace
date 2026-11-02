// Runs every Pace check in headless Chrome. From the project folder:  node tools/run-tests.mjs
// Needs: Google Chrome installed, and `npm install` done once in worker/ (the AI test runs the real proxy code).
// Uses ports 8080 (app), 8787 (proxy) and 9333-9336 (Chrome), so stop any dev servers first.
//   --quick   skip the phone-width audit and the offline test
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const quick = process.argv.includes('--quick');
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (!fs.existsSync(path.join(root, 'worker', 'node_modules', '@anthropic-ai', 'sdk'))) {
  console.error('Run `npm install` in worker/ first (the AI test loads the real proxy code).');
  process.exit(1);
}

// App server, plus the proxy backed by a mock Anthropic API (no key, no cost)
const background = [
  spawn(process.execPath, [path.join(here, 'serve.mjs'), root, '8080'], { stdio: 'ignore' }),
  spawn(process.execPath, [path.join(here, 'mock-proxy.mjs'), path.join(root, 'worker', 'src', 'index.js'), 'ok'], { stdio: 'ignore' }),
];
const stopAll = () => background.forEach(p => p.kill());
process.on('exit', stopAll);
process.on('SIGINT', () => process.exit(130));
await sleep(1500);

const run = (label, script, args) => new Promise(resolve => {
  console.log(`\n===== ${label} =====`);
  const p = spawn(process.execPath, [path.join(here, script), 'http://localhost:8080/', ...args], { stdio: 'inherit' });
  p.on('exit', code => resolve({ label, ok: code === 0 }));
});

const results = [];
// A Wednesday, because date bugs hide on the day you test (the demo-schedule bug only showed Tue-Sat)
results.push(await run('Core checks (faked Wednesday, AI routing, AI batch via proxy)', 'check.mjs',
  ['--fake-date', '2026-11-04T12:00:00', '--routing', '--ai', 'add a 15 min break after each meeting']));
results.push(await run('Core checks (real date)', 'check.mjs', []));
results.push(await run('Everyday-flow audit, desktop', 'audit.mjs', []));
if (!quick) {
  results.push(await run('Everyday-flow audit, phone width', 'audit.mjs', ['--mobile']));
  results.push(await run('Offline + badges', 'offline.mjs', []));
}

console.log('\n===== Summary =====');
results.forEach(r => console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}`));
stopAll();
process.exit(results.every(r => r.ok) ? 0 : 1);
