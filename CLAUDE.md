# Pace — project context

Pace is a desktop-first calendar PWA for balanced living (fitness, work, family, personal).
Owner: Onno. Live at https://osteger.github.io/pace/ (GitHub Pages, repo `osteger/pace`, branch `main`, root folder).

## Files
- `index.html` — the entire app: HTML, CSS and JS in one ~12k-line file. No build step.
- `service-worker.js` — PWA offline caching, network-first (online gets the latest deploy, offline the cached copy). Only registers over HTTPS or localhost. Bump `CACHE_NAME` if you ever change caching strategy.
- `manifest.json` + `icons/` — make Pace installable as an app (Chrome/Edge "Install", iPhone "Add to Home Screen"). Icons are rendered from `icons/icon.svg` and `icons/icon-maskable.svg` by `node tools/render-icons.mjs`; edit the SVGs, never the PNGs. It also writes `icons/pace.ico`, used by Onno's desktop/Start menu shortcuts (copied to `%LOCALAPPDATA%\Pace\pace.ico`; they run `chrome.exe --app=https://osteger.github.io/pace/`). The installed app shares localStorage with the site in that browser, so it sees the same data.
- `worker/` — Cloudflare Worker AI proxy (`src/index.js`, `wrangler.toml`). Holds the Anthropic API key as a Wrangler secret, owns the prompt/model/token cap, validates events in and out. The browser sends only `{ request, today, events }` and gets back `{ events }`. Origin allowlist + 10 req/min/IP rate limit live in `wrangler.toml`.

## AI proxy
- `AI_ENDPOINT` in `index.html` points at `http://localhost:8787` when the page is on localhost, otherwise at `AI_PROXY_URL` (null until deployed → AI commands show "coming soon").
- Deploy: `cd worker`, `npm install`, `npx wrangler login`, `npx wrangler secret put ANTHROPIC_API_KEY`, `npx wrangler deploy`, then paste the printed `https://pace-ai.<subdomain>.workers.dev` into `AI_PROXY_URL`.
- Local: put `ANTHROPIC_API_KEY=...` in `worker/.dev.vars` (git-ignored), `npm run dev`, serve the app on `http://localhost:8080`.
- Model is the `MODEL` var in `wrangler.toml` (default `claude-sonnet-5-5`). Prompt changes go in `worker/src/index.js`, not `index.html`.

## How the file is laid out (read before editing)
- The real stylesheet is the FIRST `<style>` block in `<head>` (ends around line 4500).
  There is a SECOND `</style>` inside a JS template string (print view, `generatePrintView`).
  Past edits that appended CSS "before the last `</style>`" landed in that template and silently did nothing. Always add CSS to the first block.
- One main `<script>` block. Global state: `scheduledEvents`, `dailyHabits`, `workoutLogs`, `partners`.
- The print view's HTML is a JS template string in `generatePrintView`, with its own `</body>`. Past edits pasted modals "before the last `</body>`" into it, so those modals never existed on the page (that's why Add Habit was broken). New modals go next to the others, before the main `<script>`.
- Habits: `dailyHabits` is the only habit list (`{ id, name, category, completedDates: [toDateString…] }`); streaks are computed from `completedDates`. The old unsaved `habits` array is gone; `openHabitModal`/`toggleHabit` are aliases for old buttons.
- Saving: `saveToLocalStorage()` is a no-op until `loadFromLocalStorage()` has run (`dataLoaded`), so an early save can't wipe stored data. A debounced autosave also runs after any click/change/keyup and on tab hide, as a safety net, because many code paths (bulk edit, undo, templates) mutate data without saving. Still call `saveToLocalStorage()` explicitly in new code.
- Sharing/partner UI is hidden by one CSS rule at the end of the first `<style>` block (no backend yet). Delete that rule to bring it back.
- Balance: `calculateBalance(weekStart)` is the ONLY score/hours calculation (targets in `WEEKLY_TARGETS`: fitness 12, work 40, family 15, personal 10). Per category: at target = 100, under = share reached, over loses points (2x target = 0); score = average. `updateBalanceDisplay()` fills every widget from it (sidebar + mobile-menu copies by class, right panel, "This Week" cards, 8-week trend), and `getGoalsViewHTML()` uses it too. It follows the week being viewed. Never put numbers in the HTML: the sidebar, right panel and Goals view were all hardcoded demo values (87, 12h/48h/18h/8h, "6/6 workouts", "Run 5K 26:34") until Nov 2026.
- Two widgets once shared the class `.balance-score` and broke each other's styling; the CSS is now scoped to `.balance-indicator .balance-score` (sidebar) and `#balanceContent .balance-score` (right panel).
- Startup runs in a `window.addEventListener('load', ...)` handler that calls `loadFromLocalStorage()`, `renderHabits()`, `renderWeekView()`, etc.
- The Quick Add input (`#quickAddInput`) is created by `getWeekViewHTML()`, so it only exists once the week view has rendered.
- Data persists in localStorage keys `paceEvents`, `paceWorkouts`, `paceHabits`, `pacePartners`, `pace_auto_backup`.
- Event shape: `{ id, title, category, day (1=Mon … 7=Sun), time 'HH:MM', duration (min), notes?, date? }`.
  - No `date` = repeats every week on `day`. With `date: 'YYYY-MM-DD'` = one-off on that date (and `day` is that date's weekday). Old data has no dates, so it all stays weekly.
  - Rendering goes through `occursOn(event, date)`; week totals through `eventsInWeek(weekStart)`. Never filter on `e.day === x` alone for display, or one-offs show up every week.
  - Build date keys with `toDateKey(date)` (local time). `toISOString()` is UTC and lands on the wrong day near midnight.
  - `day` is never a date offset. Don't derive it from `new Date().getDay()` arithmetic (that's what broke the demo schedule on Tue–Sat).
- Event form: one Repeat select (`eventRepeatMode`: once / weekly / daily). "Daily" creates 7 weekly events. Quick Add: "tomorrow"/"today"/bare weekday → one-off; "every monday"/"mondays"/"weekly" → weekly.
- Date-dependent bugs hide on the day you test. When touching anything date-related, also test with a faked date (e.g. a Wednesday).

- Rewards (Nov 2026), all in one `// Rewards` block in the main script (before "Mobile menu functions"):
  - Messages live in `REWARD_LINES` at the top of that block; edit there. Tone rule: warm, never scolding, plants never die.
  - Completion is per date: `eventDone['<eventId>@<YYYY-MM-DD>'] = category` (localStorage `paceDone`). `markAsComplete(id)` uses `window.actionDate`, set by `handleEventClick` from the clicked column/day (`[data-day]`). The old per-event `streak` counter was removed (it ticked every week at once). Not in the JSON backup yet.
  - Scheduling nudge: `scheduleNudge(category)` after Quick Add and new events from the form.
  - Garden: `gardenState()`; care = completed occurrences + habit check-ins per category; stages at `GARDEN_STEPS`; "thirsty" after 7 days without care, never shrinks. Shown on Goals and in the review.
  - Week in review: `openWeekReview(offset)`; finished weeks are frozen once into `paceWeeks` (`snapshotPastWeeks`, from `paceStart` on) so records/streaks don't change when the schedule does. `initRewards()` announces last week once (`paceReviewSeen`).
  - Balanced week = every category within 70–130% of its target (your own targets) and something planned. Records (`newRecordsFor`) only count against earlier weeks; the first week never announces one.
  - Share card (`buildShareCanvas`, `shareReview`): scores and counts only, never event titles (a test checks the function doesn't read `.title`). Uses Web Share with a file where available, else downloads `pace-week.png`.
- "First job at 25" fixes (Nov 2026):
  - Quick Add is `parseQuickAddText(input, now)`, a pure function (no DOM; call it from the console to test). It cuts each recognised phrase out of the text and what's left is the title. Handles day lists/ranges ("mon wed fri", "mon-fri"), "tonight/tmrw/noon/after work", "next/this <day>", "in 2 hours", "Nov 12"/"11/12", "on the 1st", "monthly", "every other tuesday", ranges and durations. After adding, a toast says what it understood (`describeQuickAdd`) with Undo; a one-off landing in another week jumps the view there. Add new phrasing to the `first job: Quick Add understands real phrasing` audit step.
  - Event kinds in `occursOn`: `date` (one-off), `monthDay` (monthly), `repeatEvery: 2` + `anchor` (every other week), else weekly on `day`. `eventsInWeek` is "any day of the week matches occursOn".
  - Category `family` is shown as "Family & Friends" (drinks, brunch, concerts, parties all land there). Never match category by label text (it broke once): use the class or the onclick attribute.
  - Weekly targets are editable on the Goals page (`paceTargets` in localStorage, `saveTargets()`); events titled "Sleep…"/"Bedtime…" don't count toward balance (`NOT_COUNTED_RE`).
  - Week grid: one row per hour (`gridHourRange`). `.week-grid` MUST keep `flex-shrink: 0`: it's a flex child of `.main-calendar`, and shrinking squeezed rows under their events so the second event in a busy hour was clipped. Today's column is highlighted.
  - Phones (≤768px) get `getWeekAgendaHTML()`: a day-by-day list instead of the grid. It has no bulk-edit bar (`toggleBulkEdit` says so and returns) and carries a hidden `#quickAddInput` that the mobile Add button feeds. The mobile Quick Add has an Add button.
- "Dad of 3" fixes (rebuilt Nov 2026 from a cloud-chat review; its commit never reached GitHub):
  - Week and day views run from 6 AM to 10 PM and widen when an event starts outside that. Events in a cell sort by time.
  - Habits render into BOTH `#habitsList` (desktop sidebar) and `#habitTrackerContent` (the ✓ panel, the only one on phones). So never address habit elements by id; `toggleHabitCategory(this)` uses the clicked header.
  - Repeat select has once / weekly / weekdays (Mon–Fri) / daily; durations go to 12h; default duration 1h. Editing one day of a series offers "Also change the other N days" (`seriesSiblings()`: same title, time, length, category, no date).
  - `generateSmartNotifications()` is now an every-minute reminder: bell + toast (+ system notification if allowed) once per event per day, within 30 min of start. Only runs while Pace is open.
  - Toasts: max 3 on screen, unique ids. `updateNotificationCount` is null-safe because the bell only exists in week view.

## Current state (Nov 2026)
Usable day to day. Verified in headless Chrome at desktop and phone width, including after reloads:
- Events: add/edit/delete through the form and Quick Add, notes, one-off vs weekly vs daily, week/month/day views.
- Habits: add, tick off, streaks, the "habits left today" badge.
- Backup export + restore. Real "Upcoming" panel. Works offline via the service worker.
- Phone editing (view-only mode removed), no reload on resize.
- No fake demo data (partners, notifications, insights, habits, workouts, balance numbers and Goals were all hardcoded before), no duplicate IDs. The audit has a balance test that builds a known week and checks every widget shows the same score.

Not verified: real-key AI calls, the deployed site, iOS Safari specifically.

## Known gaps / next work
1. **AI batch commands**: proxy built and tested locally (Nov 2026) against a mocked Anthropic API and in `wrangler dev`. Not yet deployed and not yet run against a real key; `AI_PROXY_URL` is still null. Never put an API key in `index.html` — the site is public.
   - AI routing (`parseQuickAdd` → `batchPatterns`) matches `each` / `all` / `before|after each|all|every` / `every weekday|morning|evening|day` as whole words. Don't go back to substring checks: `'all '` matched "call mom", "football".
2. Data lives only in this browser's localStorage: no sync between devices, and Safari can clear site data for sites not added to the Home Screen after a stretch without visits. Export a backup regularly; accounts (item 4) are the real fix.
3. Several features use `alert()`/`confirm()`; move to toasts/modals.
4. Planned: user accounts + partner/family sharing (Firebase or Supabase). Sharing UI is already built but hidden (see layout notes).
5. Reminders only fire while Pace is open in a tab; with the app closed they'd need a backend (push).
8. UX wishlist from hands-on reviews (Nov 2026): "Mark as Completed" on a repeating event marks every week (store completion per date); habits are buried at the bottom of the right panel; AI errors show raw "Failed to fetch"; event menu doesn't say whether it repeats; week-view blocks don't scale with event length; bulk edit is desktop-only; events can't span days ("weekend trip" is one hour on Saturday). Overlaps are flagged (not blocked) by `conflictsFor()` in Quick Add and the event form.
6. Editing one day of an "every day" event only edits that day (they're 7 separate weekly events).
7. The file is too large to maintain safely as one blob; consider splitting into `styles.css` / `app.js` modules.

## Tests (`tools/`)
- `node tools/run-tests.mjs` runs everything in headless Chrome (no installs beyond `npm install` in `worker/`; uses ports 8080, 8787, 9333-9336). `--quick` skips the phone-width and offline passes. Exit code 0 = all passed.
- `check.mjs`: core smoke checks; `--fake-date`, `--routing`, `--ai "<command>"` options. `audit.mjs` + `audit-steps.mjs`: ~40 everyday flows (form events, one-off vs weekly, habits, backup, phone layout), each step re-checked after reloads; add new flows to `audit-steps.mjs`. `mock-proxy.mjs`: runs the real `worker/src/index.js` against a fake Anthropic API. `offline.mjs`: service worker + badges. `installable.mjs`: asks Chrome whether the app can be installed (manifest, icons, SW). `snap.mjs <url> <out.png> <w> <h>`: screenshot with demo data.
- The scripts drive Chrome over the DevTools protocol directly (Node 22 has `WebSocket` built in), so there's no selenium/puppeteer. Chrome path is hardcoded to the standard Windows install.

## Working rules
- After any change, run `node tools/run-tests.mjs`. Syntax checks alone missed every major bug so far. For UI changes, also take a `snap.mjs` screenshot and look at it: hidden or moved sections can leave gaps the checks don't see.
- Prefer targeted edits over regex/string replacement scripts on the whole file — that's how the earlier breakage happened.
- Owner prefers casual, direct communication and explanations of *why* something broke.
