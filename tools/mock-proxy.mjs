// Runs worker/src/index.js on :8787 under Node with a mocked Anthropic API.
// node mock-proxy.mjs <path-to-worker-index.js> [mode]   mode: ok | refusal | autherr | garbage
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const worker = (await import(pathToFileURL(process.argv[2]).href)).default;
const mode = process.argv[3] || 'ok';
const env = {
  ANTHROPIC_API_KEY: 'sk-test-not-real',
  ALLOWED_ORIGINS: 'http://localhost:8080',
  MODEL: 'claude-sonnet-5-5',
};

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('https://api.anthropic.com/')) return realFetch(input, init);
  const body = JSON.parse(init.body);
  const headers = new Headers(init.headers);
  console.log('[mock anthropic] model=%s effort=%s format=%s fallbacks=%s beta=%s key=%s',
    body.model, body.output_config?.effort, body.output_config?.format?.type, body.fallbacks,
    headers.get('anthropic-beta'), headers.get('x-api-key') ? 'present' : 'MISSING');
  if (mode === 'autherr') {
    return new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  // Pretend to be the model: a 15 min break after each work event, plus one invalid event the proxy must drop
  const schedule = JSON.parse(body.messages[0].content.match(/Current schedule:\n(.*)/)[1]);
  const events = schedule.filter(e => e.category === 'work').map(e => {
    const [h, m] = e.time.split(':').map(Number);
    const t = h * 60 + m + e.duration;
    return { title: 'Break', day: e.day, time: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, duration: 15, category: 'personal', notes: '' };
  });
  events.push({ title: 'Bad', day: 9, time: '25:99', duration: 15, category: 'personal', notes: '' });
  const text = mode === 'garbage' ? 'not json' : JSON.stringify({ events });
  const msg = {
    id: 'msg_mock', type: 'message', role: 'assistant', model: body.model,
    content: mode === 'refusal' ? [] : [{ type: 'text', text }],
    stop_reason: mode === 'refusal' ? 'refusal' : 'end_turn', stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
  return new Response(JSON.stringify(msg), { status: 200, headers: { 'content-type': 'application/json' } });
};

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(`http://localhost:8787${req.url}`, {
    method: req.method, headers: req.headers,
    body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  const response = await worker.fetch(request, env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(8787, () => console.log(`mock proxy (${mode}) on :8787`));
