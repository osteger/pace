// Shared by the test scripts, for starting and stopping headless Chrome reliably.
// Why this exists: on Windows the process Node spawns is NOT the browser (it hands off and exits), so chrome.kill()
// and taskkill on its PID never closed the real Chrome. Test Chromes piled up, and the next script (same port,
// new profile) could attach to a leftover one and inherit its data: wrong event counts, no welcome modal.
// So: ask the browser to close itself over its debugging connection, and wait for its port to be free.
import { execFileSync } from 'node:child_process';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const isOpen = async port => { try { await fetch(`http://127.0.0.1:${port}/json/version`); return true; } catch { return false; } };

export async function waitPortFree(port, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  while (await isOpen(port)) {
    if (Date.now() > end) throw new Error(`Chrome debugging port ${port} is still in use. Close leftover headless Chrome windows and retry.`);
    await sleep(200);
  }
}

// Last resort (Windows): kill whatever process listens on the port, with its children
function killByPort(port) {
  try {
    const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
    const pids = new Set(out.split('\n').filter(l => l.includes(`127.0.0.1:${port}`) && /LISTENING/.test(l)).map(l => l.trim().split(/\s+/).pop()));
    pids.forEach(pid => { try { execFileSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' }); } catch {} });
  } catch {}
}

export async function stopChrome(chrome, port) {
  try {
    const info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const ws = new WebSocket(info.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
  } catch {}
  try { await waitPortFree(port, 6000); return; } catch {}
  if (process.platform === 'win32') killByPort(port); else chrome.kill();
  await waitPortFree(port, 6000).catch(() => {});
}
