// Pace AI proxy - Cloudflare Worker.
// Holds the Anthropic API key so index.html never has to. The browser sends only
// { request, today, events }; the prompt, model and token cap live here, so the
// endpoint can't be used as a general-purpose Claude relay.
import Anthropic from '@anthropic-ai/sdk';

const MAX_REQUEST_CHARS = 300;
const MAX_EVENTS_IN = 300;
const MAX_EVENTS_OUT = 60;
const CATEGORIES = ['fitness', 'work', 'family', 'personal'];
const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SYSTEM_PROMPT = `You are the scheduling assistant inside Pace, a weekly calendar app for balanced living.
The user types a batch command (e.g. "add a 15 min break after each meeting"). You return the NEW events to add. Never repeat or modify existing events.

Events either repeat every week (no date) or happen once (date "YYYY-MM-DD"). day: 1=Monday ... 7=Sunday. time: "HH:MM", 24-hour. duration: minutes.
category is one of: fitness, work, family, personal.
date: "" for an event that repeats weekly, or "YYYY-MM-DD" for a one-time event.

Matching what the user refers to (be generous, match title substrings and categories):
- workouts / gym / lift / training / cardio / yoga / run -> category fitness, or a fitness word in the title
- meetings / calls / standups / syncs / reviews -> category work, or a work word in the title
- meals / lunch / dinner / breakfast -> meal words in the title
- focus / deep work -> work events with those words
- family time / date night / kids -> category family

Rules:
- "before each X": new event ends exactly when each X starts (start = X.time - duration).
- "after each X": new event starts exactly when each X ends (start = X.time + X.duration).
- "an hour of", "30 min", "hour and a half" are the NEW event's duration. Default 60 if not given; breaks and warmups default to 15.
- "every weekday" = days 1-5. "every day" = 1-7. morning ~07:00, afternoon ~14:00, evening ~19:00 unless a time is given.
- A new event attached to a one-time event ("after each X" where that X has a date) gets the same date. Attached to a weekly event, it is weekly too (date "").
- "tomorrow", "today", "next Friday" mean one-time events: set date from today's date provided. "every ..." means weekly (date "").
- Keep times within 00:00-23:59 of the same day. Skip an event rather than wrapping past midnight.
- Pick the most fitting category for each new event (breaks and rest are personal, warmups are fitness).
- Short titles, capitalized like the user's existing events.
- If the request is unclear or nothing in the schedule matches, return an empty events array.`;

// Structured output: guarantees the reply parses into this shape.
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          day: { type: 'integer' },
          time: { type: 'string' },
          duration: { type: 'integer' },
          category: { type: 'string', enum: CATEGORIES },
          notes: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['title', 'day', 'time', 'duration', 'category', 'notes', 'date'],
        additionalProperties: false,
      },
    },
  },
  required: ['events'],
  additionalProperties: false,
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' }
      : {};
    const reply = (status, body) => new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json', ...cors },
    });

    if (!cors['Access-Control-Allow-Origin']) return reply(403, { error: 'Origin not allowed.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    if (!env.ANTHROPIC_API_KEY) return reply(500, { error: 'AI server is missing its API key.' });

    // Optional per-IP limit; only active if the RATE_LIMITER binding is configured in wrangler.toml
    if (env.RATE_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return reply(429, { error: 'Too many AI requests. Wait a minute and try again.' });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return reply(400, { error: 'Invalid JSON.' });
    }

    const userRequest = typeof body.request === 'string' ? body.request.trim() : '';
    if (!userRequest) return reply(400, { error: 'Empty request.' });
    if (userRequest.length > MAX_REQUEST_CHARS) return reply(400, { error: `Keep requests under ${MAX_REQUEST_CHARS} characters.` });
    if (!Array.isArray(body.events) || body.events.length > MAX_EVENTS_IN) return reply(400, { error: 'Invalid schedule.' });

    const schedule = body.events.map(cleanEvent).filter(Boolean);
    const today = Number.isInteger(body.today) && body.today >= 1 && body.today <= 7 ? body.today : null;
    const todayDate = typeof body.todayDate === 'string' && DATE_RE.test(body.todayDate) ? body.todayDate : null;

    const userMessage = [
      today ? `Today is ${DAY_NAMES[today]} (day ${today})${todayDate ? `, ${todayDate}` : ''}.` : '',
      `Current schedule:\n${JSON.stringify(schedule.map(e => ({ ...e, dayName: DAY_NAMES[e.day] })))}`,
      `Request:\n"""${userRequest}"""`,
    ].filter(Boolean).join('\n\n');

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 25_000 });

    let response;
    try {
      response = await client.beta.messages.create({
        model: env.MODEL || 'claude-sonnet-5-5',
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        // Low effort keeps replies inside the app's 20s loading timeout; this task is simple arithmetic on a short list
        output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) return reply(429, { error: 'AI is busy right now. Try again in a minute.' });
      if (err instanceof Anthropic.AuthenticationError) {
        console.error('Anthropic rejected the API key');
        return reply(502, { error: 'AI server is misconfigured.' });
      }
      if (err instanceof Anthropic.BadRequestError) {
        console.error('Anthropic 400:', err.message);
        return reply(502, { error: 'AI request was rejected. Try rephrasing.' });
      }
      if (err instanceof Anthropic.APIError) {
        console.error(`Anthropic ${err.status}:`, err.message);
        return reply(502, { error: 'AI service error. Try again in a moment.' });
      }
      console.error('Proxy error:', err);
      return reply(502, { error: 'Could not reach the AI service.' });
    }

    if (response.stop_reason === 'refusal') return reply(422, { error: 'AI declined that request. Try rephrasing.' });
    if (response.stop_reason === 'max_tokens') return reply(422, { error: 'That would add too many events. Try a narrower request.' });

    const text = response.content.find(b => b.type === 'text')?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('Unparseable model output:', text.slice(0, 500));
      return reply(502, { error: 'AI returned an invalid format. Try rephrasing.' });
    }

    const events = (Array.isArray(parsed.events) ? parsed.events : []).map(cleanEvent).filter(Boolean).slice(0, MAX_EVENTS_OUT);
    return reply(200, { events });
  },
};

// Coerce an event to the app's shape, or null if it can't be made valid.
function cleanEvent(e) {
  if (!e || typeof e !== 'object') return null;
  const title = typeof e.title === 'string' ? e.title.trim().slice(0, 80) : '';
  // One-time events: the date decides the weekday (noon avoids any DST edge)
  const parsedDate = typeof e.date === 'string' && DATE_RE.test(e.date) ? new Date(`${e.date}T12:00:00Z`) : null;
  const date = parsedDate && !isNaN(parsedDate) ? e.date : null;
  const day = date ? (parsedDate.getUTCDay() || 7) : Number(e.day);
  const match = typeof e.time === 'string' ? e.time.match(/^(\d{1,2}):(\d{2})$/) : null;
  const duration = Math.round(Number(e.duration));
  if (!title || !Number.isInteger(day) || day < 1 || day > 7 || !match) return null;
  const hh = Number(match[1]), mm = Number(match[2]);
  if (hh > 23 || mm > 59) return null;
  const out = {
    title,
    day,
    time: `${String(hh).padStart(2, '0')}:${match[2]}`,
    duration: Number.isFinite(duration) && duration >= 5 && duration <= 720 ? duration : 60,
    category: CATEGORIES.includes(e.category) ? e.category : 'personal',
  };
  if (typeof e.notes === 'string' && e.notes.trim()) out.notes = e.notes.trim().slice(0, 200);
  if (date) out.date = date;
  return out;
}
