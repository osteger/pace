// Everyday-flow steps for audit.mjs. Each: [name, expression, waitMs?, 'reload'?]
export const steps = [
  ['fresh start: what does a new user see', `JSON.stringify({ events: scheduledEvents.length, habitsShown: document.querySelectorAll('#habitsList .habit-item').length, workoutLogs: workoutLogs.length, notifications: notifications.length, partnerEvents: partnerEvents.length, welcome: document.getElementById('welcomeModal').classList.contains('active'), fakeTextVisible: ['Jamie', 'Alex Lee', 'Anniversary Dinner', '95% completion'].filter(t => document.body.innerText.includes(t)) })`],
  ['skip welcome', `skipWelcome(); 'ok'`],

  ['add ONE-OFF via form: Dentist, Thu of next week 15:00, with notes', `(() => {
    const d = getWeekStart(new Date()); d.setDate(d.getDate() + 7 + 3); // next week's Thursday
    openModal();
    document.getElementById('eventTitle').value = 'Dentist';
    document.getElementById('eventRepeatMode').value = 'once'; updateRepeatFields();
    document.getElementById('eventDate').value = toDateKey(d);
    document.getElementById('eventTime').value = '15:00';
    document.getElementById('eventDuration').value = '60';
    document.getElementById('eventNotes').value = 'Bring insurance card';
    saveEvent();
    const e = scheduledEvents.find(e => e.title === 'Dentist');
    return JSON.stringify({ event: e, inLocalStorage: JSON.parse(localStorage.getItem('paceEvents') || '[]').some(e => e.title === 'Dentist') });
  })()`],
  ['add WEEKLY via form: Gym every Tuesday 18:00', `(() => {
    openModal();
    document.getElementById('eventTitle').value = 'Gym';
    document.getElementById('eventRepeatMode').value = 'weekly'; updateRepeatFields();
    document.getElementById('eventDay').value = '2';
    document.getElementById('eventTime').value = '18:00';
    saveEvent();
    return JSON.stringify(scheduledEvents.filter(e => e.title === 'Gym'));
  })()`],
  ['add DAILY via form: Walk every day 07:00', `(() => {
    openModal();
    document.getElementById('eventTitle').value = 'Walk';
    document.getElementById('eventRepeatMode').value = 'daily'; updateRepeatFields();
    document.getElementById('eventTime').value = '07:00';
    saveEvent();
    return JSON.stringify(scheduledEvents.filter(e => e.title === 'Walk').map(e => e.day));
  })()`],
  ['reload', null, 0, 'reload'],
  ['after reload: all three persisted?', `JSON.stringify({ dentist: scheduledEvents.filter(e => e.title === 'Dentist').length, gym: scheduledEvents.filter(e => e.title === 'Gym').length, walks: scheduledEvents.filter(e => e.title === 'Walk').length, notes: scheduledEvents.find(e => e.title === 'Dentist')?.notes })`],

  ['this week: Dentist hidden, Gym shown', `(() => { navigateToday(); const t = [...document.querySelectorAll('.event-title')].map(x => x.textContent); return JSON.stringify({ dentist: t.some(x => x.includes('Dentist')), gym: t.some(x => x.includes('Gym')), walks: t.filter(x => x.includes('Walk')).length }); })()`],
  ['next week: Dentist shown, Gym shown', `(() => { navigateNext(); const t = [...document.querySelectorAll('.event-title')].map(x => x.textContent); return JSON.stringify({ week: document.querySelector('.calendar-title')?.textContent, dentist: t.some(x => x.includes('Dentist')), gym: t.some(x => x.includes('Gym')) }); })()`],
  ['week after: Dentist hidden again', `(() => { navigateNext(); const t = [...document.querySelectorAll('.event-title')].map(x => x.textContent); return JSON.stringify({ dentist: t.some(x => x.includes('Dentist')), gym: t.some(x => x.includes('Gym')) }); })()`],
  ['back to today', `navigateToday(); 'ok'`],

  ['edit Dentist: form prefilled correctly?', `(() => { const e = scheduledEvents.find(e => e.title === 'Dentist'); editEvent(e.id); return JSON.stringify({ title: document.getElementById('eventTitle').value, mode: document.getElementById('eventRepeatMode').value, date: document.getElementById('eventDate').value, notes: document.getElementById('eventNotes').value, dateVisible: document.getElementById('eventDateGroup').style.display !== 'none' }); })()`],
  ['save edit (rename)', `(() => { document.getElementById('eventTitle').value = 'Dentist (moved)'; saveEvent(); return JSON.stringify(scheduledEvents.filter(e => e.title.startsWith('Dentist')).map(e => [e.title, e.date, e.notes])); })()`],
  ['reload', null, 0, 'reload'],
  ['after reload: edit persisted?', `JSON.stringify(scheduledEvents.filter(e => e.title.startsWith('Dentist')).map(e => e.title))`],
  ['delete it', `(() => { const e = scheduledEvents.find(e => e.title.startsWith('Dentist')); deleteEvent(e.id); return scheduledEvents.filter(e => e.title.startsWith('Dentist')).length; })()`, 800],
  ['reload', null, 0, 'reload'],
  ['after reload: delete persisted?', `scheduledEvents.filter(e => e.title.startsWith('Dentist')).length`],

  ['click empty day cell (Wed 10am) prefills that date', `(() => { const cell = [...document.querySelectorAll('.day-cell')][2 + 7 * 4]; if (!cell) return 'no cell'; cell.click(); const open = document.getElementById('eventModal').classList.contains('active'); const r = JSON.stringify({ open, date: document.getElementById('eventDate').value, time: document.getElementById('eventTime').value }); closeModal(); return r; })()`],

  ['upcoming panel is real', `document.getElementById('upcomingList')?.innerText.replace(/\\s+/g, ' ').slice(0, 200)`],
  ['month view', `switchView('month'); [...document.querySelectorAll('.main-calendar *')].filter(x => x.textContent === 'Gym').length + ' Gym entries in month'`],
  ['day view', `switchView('day'); 'ok'`],
  ['back to week view', `switchView('week'); 'ok'`],

  ['add habit via sidebar button', `(() => { document.querySelector('[onclick="openAddHabitModal()"]').click(); const input = document.getElementById('habitName'); input.value = 'Read 20 min'; saveNewHabit(); return JSON.stringify({ dailyHabits: dailyHabits.map(h => h.name), shown: document.querySelectorAll('#habitsList .habit-item').length }); })()`],
  ['add second habit via "Create first habit"/alias', `(() => { openHabitModal(); document.getElementById('habitName').value = 'Vitamins'; saveNewHabit(); return JSON.stringify(dailyHabits.map(h => h.name)); })()`],
  ['check off first habit', `(() => { const cb = document.querySelector('#habitsList .habit-item input[type=checkbox]'); if (!cb) return 'no habit checkbox'; cb.click(); return JSON.stringify(dailyHabits.map(h => [h.name, h.completedDates])); })()`],
  ['reload', null, 0, 'reload'],
  ['after reload: habits + completion persisted and shown?', `JSON.stringify({ dailyHabits: dailyHabits.map(h => [h.name, h.completedDates.length]), shown: document.querySelectorAll('#habitsList .habit-item').length, checked: document.querySelectorAll('#habitsList input:checked').length, progressPanel: document.getElementById('habitCategoryProgress')?.innerText.replace(/\\s+/g, ' ').slice(0, 80) })`],
  ['uncheck habit', `(() => { document.querySelector('#habitsList input:checked')?.click(); return JSON.stringify(dailyHabits.map(h => h.completedDates.length)); })()`],

  ['workout log modal opens', `openWorkoutLogModal(); document.getElementById('workoutLogModal')?.classList.contains('active') ?? 'no modal'`],
  ['close workout modal', `closeWorkoutLogModal(); 'ok'`],
  ['bulk edit on/off', `toggleBulkEdit(); const on = bulkEditMode; cancelBulkEdit(); JSON.stringify({ wasOn: on, nowOn: bulkEditMode })`],
  ['notifications panel', `toggleNotifications(); const n = notifications.length; toggleNotifications(); n + ' notifications'`],

  ['backup export works', `(() => { let downloaded = null; const orig = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { downloaded = this.download; }; try { const { exportToJSON } = enhanceExportImport(); exportToJSON(); } finally { HTMLAnchorElement.prototype.click = orig; } return JSON.stringify({ downloaded, lastExport: !!localStorage.getItem('pace_last_export') }); })()`],
  ['sharing UI hidden', `JSON.stringify(['[onclick*="openAddPartnerModal"]', '[onclick*="openShareModal"]', '.partners-section', '.feed-section', '.visibility-group'].map(s => [s, [...document.querySelectorAll(s)].filter(el => el.offsetParent !== null).length]))`],
  ['fake content gone', `JSON.stringify(['Jamie', 'Alex Lee', 'Anniversary Dinner', '5K Race', '95% completion', 'crushing it'].filter(t => document.body.innerText.includes(t)))`],
  ['quick add phrasing', `(() => {
    const cases = ['dentist thursday 3pm', 'gym every monday 6am', 'yoga mondays 7pm', 'read 20 min 8pm', 'wedding saturday 2pm', "dinner at Mario's tomorrow 7pm", 'call mom 5pm'];
    const out = [];
    for (const c of cases) {
      const before = scheduledEvents.length;
      document.getElementById('quickAddInput').value = c;
      parseQuickAdd();
      const e = scheduledEvents[scheduledEvents.length - 1];
      out.push(scheduledEvents.length > before ? \`\${c} => [\${e.title}] \${e.date || 'weekly day ' + e.day} \${e.time} \${e.duration}m \${e.category}\` : \`\${c} => NOT ADDED\`);
    }
    return out.join('\\n         ');
  })()`, 1500],
  // A dad of 3: 5:30am workouts, 8-5 job, kid stuff, bedtime routine. Each assertion throws, which fails the step.
  ['dad week: Quick Add phrasing', `(async () => {
    window.__saved = JSON.parse(JSON.stringify(scheduledEvents)); scheduledEvents = [];
    const add = text => { document.getElementById('quickAddInput').value = text; parseQuickAdd(); return scheduledEvents.slice(); };
    const need = (ok, msg) => { if (!ok) throw new Error('dad week: ' + msg); };
    add('Work every weekday 8am to 5pm');
    let w = scheduledEvents.filter(e => e.title === 'Work');
    need(w.length === 5 && w.every(e => e.time === '08:00' && e.duration === 540 && e.category === 'work' && !e.date), 'work 8-5 weekdays: ' + JSON.stringify(w));
    add('Bedtime routine every evening 7:30pm');
    let b = scheduledEvents.filter(e => e.title === 'Bedtime routine');
    need(b.length === 7 && b.every(e => e.time === '19:30' && e.category === 'family'), 'bedtime every evening: ' + JSON.stringify(b));
    add('6-7:30pm soccer practice monday');
    let s = scheduledEvents[scheduledEvents.length - 1];
    need(s.time === '18:00' && s.duration === 90 && s.category === 'family', 'time range 6-7:30pm: ' + JSON.stringify(s));
    add('Dentist for Emma Nov 12');
    let d = scheduledEvents[scheduledEvents.length - 1];
    need(/-11-12$/.test(d.date || '') && d.category === 'family' && d.title === 'Dentist for Emma', 'typed date Nov 12: ' + JSON.stringify(d));
    add('Dentist 11/13 3pm');
    d = scheduledEvents[scheduledEvents.length - 1];
    need(/-11-13$/.test(d.date || '') && d.time === '15:00', 'typed date 11/13: ' + JSON.stringify(d));
    const cats = {};
    for (const c of ['Call mom 5pm', 'Kids swim lessons saturday 9am', 'Soccer practice thursday 5pm']) cats[c] = add(c).pop().category;
    need(Object.values(cats).every(c => c === 'family'), 'family categories: ' + JSON.stringify(cats));
    return JSON.stringify({ work: w.length, bedtime: b.length, range: [s.time, s.duration], cats });
  })()`, 800],
  ['dad week: early rows, time order, month starts Monday', `(async () => {
    const need = (ok, msg) => { if (!ok) throw new Error('dad week: ' + msg); };
    document.getElementById('quickAddInput').value = 'Workout 5:30am every weekday'; parseQuickAdd();
    document.getElementById('quickAddInput').value = 'Drop-off 7:30am every weekday'; parseQuickAdd();
    switchView('week'); renderWeekView();
    await new Promise(r => setTimeout(r, 300));
    const phone = innerWidth <= 768; // phones get a day-by-day agenda instead of the hourly grid
    const labels = [...document.querySelectorAll('.week-grid .time-label')].map(e => e.textContent.trim());
    let order;
    if (phone) {
      need(!!document.querySelector('.week-agenda'), 'phone has no agenda');
      const monday = document.querySelector('.agenda-day[data-day="1"]');
      order = [...monday.querySelectorAll('.agenda-title')].map(e => e.textContent.replace('↻', '').trim());
      need(order.indexOf('Workout') === 0, 'workout (5:30) should be first on Monday: ' + order);
    } else {
      need(labels.includes('5 AM') && labels.includes('6 AM') && labels.includes('10 PM'), 'hourly rows incl. 5 AM for a 5:30am workout: ' + labels);
      need([...document.querySelectorAll('.event-title')].some(e => e.textContent.trim() === 'Workout'), 'workout not drawn');
      // two events in the same hour: earlier start first, whatever order they were added in
      scheduledEvents.push({ id: 6001, title: 'Late', category: 'work', day: 1, time: '07:45', duration: 15 }, { id: 6002, title: 'Early', category: 'work', day: 1, time: '07:15', duration: 15 });
      renderWeekView();
      const cell = document.querySelector('.day-cell[data-day="1"][data-hour="7"]');
      order = [...cell.querySelectorAll('.event-title')].map(e => e.textContent.trim());
      need(order.join() === 'Early,Drop-off,Late', 'same-hour events not sorted by time: ' + order);
      // the second event in a busy hour must be fully visible, not squeezed under the first
      const blocks = [...cell.querySelectorAll('.event-block')];
      const cellBox = cell.getBoundingClientRect();
      need(blocks.every(b => b.getBoundingClientRect().bottom <= cellBox.bottom + 1), 'events overflow their cell (clipped)');
      scheduledEvents = scheduledEvents.filter(e => e.id !== 6001 && e.id !== 6002);
    }
    currentDate = getWeekStart(new Date()); // a Monday: the workout is weekdays only
    switchView('day'); renderDayView();
    const dayHours = [...document.querySelectorAll('div')].some(e => e.children.length === 0 && /^\\s*5:00 AM\\s*$/.test(e.textContent));
    need(dayHours, 'day view has no 5:00 AM row');
    switchView('month'); renderMonthView();
    await new Promise(r => setTimeout(r, 200));
    const txt = document.body.innerText;
    need(/MON\\s+TUE\\s+WED\\s+THU\\s+FRI\\s+SAT\\s+SUN/i.test(txt), 'month view does not start on Monday');
    switchView('week'); renderWeekView();
    return JSON.stringify({ labels, order });
  })()`, 800],
  ['dad week: edit one day vs the whole series', `(async () => {
    const need = (ok, msg) => { if (!ok) throw new Error('dad week: ' + msg); };
    const mon = scheduledEvents.find(e => e.title === 'Work' && e.day === 1);
    editEvent(mon.id);
    need(getComputedStyle(document.getElementById('eventApplyOthersGroup')).display !== 'none', 'no "also change other days" option');
    const label = document.getElementById('eventApplyOthersLabel').textContent;
    need(/4 days/.test(label) && /Tue/.test(label) && !/Mon/.test(label), 'label: ' + label);
    document.getElementById('eventTitle').value = 'Office'; // checkbox left off: only Monday changes
    saveEvent();
    need(scheduledEvents.filter(e => e.title === 'Office').length === 1, 'unticked edit changed more than one day');
    const tue = scheduledEvents.find(e => e.title === 'Work' && e.day === 2);
    editEvent(tue.id);
    document.getElementById('eventApplyOthers').checked = true;
    document.getElementById('eventDuration').value = '480';
    saveEvent();
    const work = scheduledEvents.filter(e => e.title === 'Work');
    need(work.length === 4 && work.every(e => e.duration === 480), 'ticked edit did not change the other days: ' + JSON.stringify(work.map(e => [e.day, e.duration])));
    need(!!document.querySelector('#eventDuration option[value="720"]'), 'no 12 hour duration');
    return JSON.stringify({ label, work: work.map(e => e.day) });
  })()`, 600],
  ['dad week: habits panel (the phone path), Escape, reminders, toast cap', `(async () => {
    const need = (ok, msg) => { if (!ok) throw new Error('dad week: ' + msg); };
    if (!dailyHabits.length) { dailyHabits.push({ id: 77, name: 'Read 20 min', category: 'personal', completedDates: [] }); }
    toggleHabitTracker();
    const inPanel = document.querySelectorAll('#habitTrackerContent .habit-item').length;
    need(inPanel === dailyHabits.length, 'habit panel shows ' + inPanel + ' of ' + dailyHabits.length);
    need(!!document.querySelector('#habitTrackerContent [onclick*="openAddHabitModal"]'), 'no Add Habit button in the panel');
    document.querySelector('#habitTrackerContent .habit-item input').click();
    need(habitsLeftToday() === dailyHabits.length - 1 || dailyHabits.length > 1, 'ticking in the panel did nothing');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); // used to throw closeHabitModal is not defined
    need(!document.getElementById('habitTrackerPanel').classList.contains('active'), 'Escape did not close the habit panel');
    // Reminder: an event starting in 10 minutes
    const now = new Date(); const mins = now.getHours() * 60 + now.getMinutes() + 10;
    let reminder = 'skipped (too close to midnight)';
    if (mins < 24 * 60) {
      const t = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
      scheduledEvents.push({ id: 5000, title: 'Soccer pickup', category: 'family', day: now.getDay() || 7, time: t, duration: 60, date: toDateKey(now) });
      const before = notifications.length;
      generateSmartNotifications(); generateSmartNotifications();
      need(notifications.length === before + 1, 'expected exactly one reminder, got ' + (notifications.length - before));
      need(/Soccer pickup in \\d+ min/.test(notifications[0].title), 'reminder title: ' + notifications[0].title);
      reminder = notifications[0].title;
    }
    for (let i = 0; i < 6; i++) showToast('t' + i, 'm', 'info');
    const toasts = [...document.querySelectorAll('#toastContainer .toast')];
    need(toasts.length <= 3, 'more than 3 toasts: ' + toasts.length);
    need(new Set(toasts.map(t => t.id)).size === toasts.length, 'duplicate toast ids');
    scheduledEvents = window.__saved; // put the earlier events back for the steps after this one
    saveToLocalStorage();
    return JSON.stringify({ inPanel, reminder, toasts: toasts.length });
  })()`, 600],
  // A 25 year old: first job, gym, friends. Quick Add must understand them or say what it did.
  ['first job: Quick Add understands real phrasing', `(() => {
    const need = (ok, msg) => { if (!ok) throw new Error('first job: ' + msg); };
    const P = t => parseQuickAddText(t);
    const key = d => toDateKey(d);
    const today = new Date(), tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    let r = P('gym monday wednesday friday 6:30pm');
    need(r.days.join() === '1,3,5' && r.time === '18:30' && r.title === 'Gym', 'multi-day list: ' + JSON.stringify(r));
    r = P('gym mon/wed/fri 6am');
    need(r.days.join() === '1,3,5' && r.time === '06:00', 'slash list: ' + JSON.stringify(r));
    r = P('standup mon-fri 9:30am 15 min');
    need(r.days.join() === '1,2,3,4,5' && r.duration === 15 && r.title === 'Standup', 'day range: ' + JSON.stringify(r));
    r = P('coffee with Alex tonight 8pm');
    need(r.date === key(today) && r.time === '20:00' && r.title === 'Coffee with Alex' && r.category === 'family', 'tonight: ' + JSON.stringify(r));
    r = P('lunch w/ Dana tmrw noon');
    need(r.date === key(tomorrow) && r.time === '12:00' && r.title === 'Lunch w/ Dana', 'tmrw noon: ' + JSON.stringify(r));
    r = P('dentist next friday 2pm');
    const nf = new Date(r.date + 'T12:00'), days = Math.round((nf - new Date(key(today) + 'T12:00')) / 864e5);
    need(nf.getDay() === 5 && days >= 5 && days <= 11 && r.title === 'Dentist' && r.category === 'personal', 'next friday: ' + JSON.stringify(r) + ' in ' + days + ' days');
    r = P('happy hour after work thursday');
    need(r.time === '18:00' && r.title === 'Happy hour' && new Date(r.date + 'T12:00').getDay() === 4, 'after work: ' + JSON.stringify(r));
    r = P('yoga in 2 hours');
    need(r.title === 'Yoga' && !r.usedDefaultTime, 'in 2 hours: ' + JSON.stringify(r));
    r = P('call parents sundays 5pm');
    need(r.days.join() === '7' && r.category === 'family', 'call parents: ' + JSON.stringify(r));
    r = P('Taylor Swift concert 11/20 8pm');
    need(/-11-20$/.test(r.date) && r.time === '20:00' && r.category === 'family', 'slash date: ' + JSON.stringify(r));
    r = P('drinks with Sam friday 7pm');
    need(r.category === 'family' && r.title === 'Drinks with Sam', 'drinks is social: ' + JSON.stringify(r));
    r = P('sleep by 11pm every night');
    need(r.title === 'Sleep' && r.days.length === 7 && r.time === '23:00', 'sleep: ' + JSON.stringify(r));
    // every other week: exactly alternate weeks
    r = P('therapy every other tuesday 6pm');
    need(r.repeatEvery === 2 && r.days.join() === '2' && !!r.anchor, 'every other: ' + JSON.stringify(r));
    const e2 = { id: 1, title: 'T', day: 2, time: '18:00', duration: 60, category: 'personal', repeatEvery: 2, anchor: r.anchor };
    const tues = [0, 1, 2, 3].map(w => { const d = new Date(r.anchor + 'T12:00'); d.setDate(d.getDate() + 7 * w); return occursOn(e2, d); });
    need(tues.join() === 'true,false,true,false', 'every other week alternates: ' + tues);
    // monthly on the 1st
    r = P('pay rent monthly on the 1st');
    need(r.monthDay === 1 && r.title === 'Pay rent', 'monthly: ' + JSON.stringify(r));
    const m = { id: 2, title: 'R', day: 1, time: '09:00', duration: 60, category: 'personal', monthDay: 1 };
    need(occursOn(m, new Date(2026, 11, 1)) && !occursOn(m, new Date(2026, 11, 2)), 'monthly occursOn');
    r = P('pay rent on the 1st');
    need(r.date && new Date(r.date + 'T12:00').getDate() === 1 && r.monthDay === null,'on the 1st is a one-off on the next 1st: ' + JSON.stringify(r));
    return 'ok';
  })()`, 300],
  ['first job: Quick Add shows what it understood, jumps to the week, undoes', `(async () => {
    const need = (ok, msg) => { if (!ok) throw new Error('first job: ' + msg); };
    const saved = JSON.parse(JSON.stringify(scheduledEvents));
    currentDate = new Date(); switchView('week');
    const viewed = toDateKey(getWeekStart(currentDate));
    document.getElementById('quickAddInput').value = 'Priya birthday dinner Nov 14 7:30pm';
    // pick a date in another week regardless of today's date
    const far = new Date(); far.setDate(far.getDate() + 21);
    document.getElementById('quickAddInput').value = 'Priya birthday dinner ' + far.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' 7:30pm';
    const before = scheduledEvents.length;
    parseQuickAdd();
    need(scheduledEvents.length === before + 1, 'event not added');
    need(toDateKey(getWeekStart(currentDate)) !== viewed, 'did not jump to the week the event landed in');
    const toast = document.querySelector('#toastContainer .toast:last-child');
    need(toast && /Priya birthday dinner/.test(toast.textContent) && /7:30 PM/.test(toast.textContent) && /Family & Friends/.test(toast.textContent), 'toast: ' + (toast && toast.textContent));
    toast.querySelector('.toast-action-btn').click(); // Undo
    need(scheduledEvents.length === before, 'undo did not remove it');
    scheduledEvents = saved; saveToLocalStorage(); currentDate = new Date(); renderCurrentView();
    return toast.textContent.replace(/\\s+/g, ' ').slice(0, 120);
  })()`, 400],
  ['first job: week view layout (today, hourly, phone agenda)', `(async () => {
    const need = (ok, msg) => { if (!ok) throw new Error('first job: ' + msg); };
    currentDate = new Date(); switchView('week'); renderWeekView();
    await new Promise(r => setTimeout(r, 200));
    if (innerWidth <= 768) {
      need(document.querySelectorAll('.agenda-day').length === 7, 'agenda should list 7 days');
      need(document.querySelectorAll('.agenda-day.today').length === 1, 'agenda should mark today');
      need(!!document.querySelector('.mobile-quick-add button'), 'no Add button next to the phone Quick Add');
      document.getElementById('mobileQuickAddInput').value = 'phone test 3pm';
      const before = scheduledEvents.length;
      document.querySelector('.mobile-quick-add button').click();
      need(scheduledEvents.length === before + 1, 'Add button did nothing');
      scheduledEvents.pop(); saveToLocalStorage(); renderWeekView();
      need(document.documentElement.scrollWidth <= innerWidth + 1, 'page scrolls sideways on the phone');
    } else {
      need(document.querySelectorAll('.week-grid .day-header.today').length === 1, 'week grid should mark today');
      const rows = document.querySelectorAll('.week-grid .time-label').length;
      need(rows >= 17, 'expected hourly rows, got ' + rows);
      need(getComputedStyle(document.querySelector('.week-grid')).flexShrink === '0', 'week grid can shrink and clip events');
      need(getComputedStyle(document.querySelector('.calendar-title')).whiteSpace === 'nowrap', 'title can wrap');
    }
    return 'ok';
  })()`, 300],
  ['first job: targets are editable, sleep is not counted, nothing says Family-only', `(async () => {
    const need = (ok, msg) => { if (!ok) throw new Error('first job: ' + msg); };
    const saved = JSON.parse(JSON.stringify(scheduledEvents)); const old = { ...WEEKLY_TARGETS };
    const ws = getWeekStart(new Date());
    scheduledEvents = [
      { id: 1, title: 'Gym', category: 'fitness', day: 1, time: '18:00', duration: 360 },
      { id: 2, title: 'Sleep', category: 'personal', day: 1, time: '23:00', duration: 600 },
    ];
    need(calculateBalance(ws).hours.personal === 0, 'sleep was counted as personal time: ' + calculateBalance(ws).hours.personal);
    currentDate = new Date(); switchView('goals');
    need(!!document.getElementById('target-fitness'), 'no targets editor on Goals');
    document.getElementById('target-fitness').value = '6';
    saveTargets();
    need(WEEKLY_TARGETS.fitness === 6 && JSON.parse(localStorage.getItem('paceTargets')).fitness === 6, 'target did not save');
    need(calculateBalance(ws).percentages.fitness === 100, 'score ignores new target');
    need(/Family & Friends/.test(document.body.innerText), 'category not renamed to Family & Friends');
    saveTargets(true); // reset
    need(WEEKLY_TARGETS.fitness === 12, 'reset failed');
    Object.assign(WEEKLY_TARGETS, old); scheduledEvents = saved; saveToLocalStorage(); switchView('week'); renderWeekView();
    return 'ok';
  })()`, 300],
  ['first job: double-booking is flagged, back-to-back is not', `(async () => {
    const need = (ok, msg) => { if (!ok) throw new Error('first job: ' + msg); };
    const saved = JSON.parse(JSON.stringify(scheduledEvents)); scheduledEvents = [];
    const add = t => { document.getElementById('quickAddInput').value = t; parseQuickAdd(); return document.querySelector('#toastContainer .toast:last-child').textContent; };
    add('gym every monday 6:30pm');
    let t = add('gym every monday 6:30pm');
    need(/Overlaps Gym \\(6:30 PM\\)/.test(t), 'duplicate gym not flagged: ' + t);
    t = add('drinks every monday 7:30pm'); // starts exactly when gym ends
    need(!/Overlaps/.test(t), 'back-to-back flagged as overlap: ' + t);
    t = add('standup every monday 7pm 45 min');
    need(/Overlaps/.test(t), 'partial overlap not flagged: ' + t);
    scheduledEvents = saved; saveToLocalStorage(); renderCurrentView();
    return 'ok';
  })()`, 300],
  // Rewards: scheduling nudge, per-date completion, garden, week in review, balanced weeks, records, share card
  ['rewards: nudge, per-date completion, garden growth', `(async () => {
    const need = (ok, msg) => { if (!ok) throw new Error('rewards: ' + msg); };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const saved = JSON.parse(JSON.stringify(scheduledEvents)), savedDone = { ...eventDone }, savedHabits = JSON.parse(JSON.stringify(dailyHabits));
    scheduledEvents = []; eventDone = {}; dailyHabits = [];
    currentDate = new Date(); switchView('week');
    document.getElementById('quickAddInput').value = 'workout tomorrow 6am'; parseQuickAdd();
    await sleep(1000);
    const texts = [...document.querySelectorAll('#toastContainer .toast')].map(t => t.textContent);
    need(REWARD_LINES.schedule.fitness.some(l => texts.some(t => t.includes(l))), 'no scheduling nudge in: ' + JSON.stringify(texts));

    scheduledEvents = [{ id: 1, title: 'Gym', category: 'fitness', day: 1, time: '18:00', duration: 60 }];
    const mon = getWeekStart(new Date()), nextMon = new Date(mon); nextMon.setDate(nextMon.getDate() + 7);
    window.actionDate = toDateKey(mon);
    markAsComplete(1);
    need(isDone(scheduledEvents[0], toDateKey(mon)) && !isDone(scheduledEvents[0], toDateKey(nextMon)), 'completion is not per date');
    let g = gardenState().find(p => p.cat === 'fitness');
    need(g.care === 1 && g.stage === 1, 'first completion should sprout the fitness plant: ' + JSON.stringify(g));
    await sleep(900);
    need([...document.querySelectorAll('#toastContainer .toast')].some(t => /plant grew/.test(t.textContent)), 'no growth message');
    markAsComplete(1); // second tap undoes it
    need(!isDone(scheduledEvents[0], toDateKey(mon)) && gardenState().find(p => p.cat === 'fitness').care === 0, 'undo failed');
    for (let i = 0; i < 6; i++) eventDone['1@2026-0' + (1 + i) + '-10'] = 'fitness';
    g = gardenState().find(p => p.cat === 'fitness');
    need(g.stage === 2 && g.thirsty === true, 'old care: stage 2 and thirsty expected: ' + JSON.stringify(g)); // plants get thirsty, never shrink
    dailyHabits = [{ id: 1, name: 'Read', category: 'personal', completedDates: [new Date().toDateString()] }];
    need(gardenState().find(p => p.cat === 'personal').care === 1, 'a ticked habit should feed its plant');

    scheduledEvents = saved; eventDone = savedDone; dailyHabits = savedHabits; window.actionDate = null;
    saveToLocalStorage(); renderCurrentView();
    return 'ok';
  })()`, 300],
  ['rewards: week in review, balanced weeks, records, share card', `(async () => {
    const need = (ok, msg) => { if (!ok) throw new Error('rewards: ' + msg); };
    const keys = ['paceStart', 'paceWeeks', 'paceReviewSeen'], backup = {}; keys.forEach(k => { backup[k] = localStorage.getItem(k); });
    const saved = JSON.parse(JSON.stringify(scheduledEvents)), savedDone = { ...eventDone }, nBefore = notifications.length;
    const thisMon = getWeekStart(new Date());
    const monday = n => { const d = new Date(thisMon); d.setDate(d.getDate() + 7 * n); return d; };
    localStorage.setItem('paceStart', JSON.stringify(toDateKey(monday(-2))));
    localStorage.removeItem('paceWeeks'); localStorage.removeItem('paceReviewSeen');
    // A week that hits every target exactly: fitness 12h, work 40h, family 15h, personal 10h
    scheduledEvents = []; let id = 1;
    for (let d = 1; d <= 6; d++) scheduledEvents.push({ id: id++, title: 'Run', category: 'fitness', day: d, time: '07:00', duration: 120 });
    for (let d = 1; d <= 5; d++) scheduledEvents.push({ id: id++, title: 'Work', category: 'work', day: d, time: '09:00', duration: 480 });
    for (let d = 1; d <= 5; d++) scheduledEvents.push({ id: id++, title: 'Family', category: 'family', day: d, time: '18:00', duration: 180 });
    for (let d = 1; d <= 5; d++) scheduledEvents.push({ id: id++, title: 'Read', category: 'personal', day: d, time: '21:00', duration: 120 });
    eventDone = {};
    const lastMon = monday(-1);
    // last Monday's run (id 1), work (id 7) and family time (id 12) are done
    [[1, 'fitness'], [7, 'work'], [12, 'family']].forEach(([eid, cat]) => { eventDone[eid + '@' + toDateKey(lastMon)] = cat; });
    const weeks = snapshotPastWeeks();
    need(Object.keys(weeks).length === 2, 'expected 2 finished weeks, got ' + Object.keys(weeks).length);
    const w = weeks[toDateKey(lastMon)];
    need(w.balanced === true && w.planned === 21 && w.done === 3 && w.rate === 14, 'last week snapshot: ' + JSON.stringify({ b: w.balanced, p: w.planned, d: w.done, r: w.rate }));
    // changing the schedule afterwards must not rewrite history
    scheduledEvents = []; need(snapshotPastWeeks()[toDateKey(lastMon)].planned === 21, 'snapshot changed after the schedule did');
    scheduledEvents = saved;

    const n0 = notifications.length;
    initRewards(); initRewards();
    need(notifications.length === n0 + 1, 'last week announcement should happen exactly once, got ' + (notifications.length - n0));
    openWeekReview(-1);
    const modal = document.getElementById('reviewModal'), text = modal.textContent;
    need(modal.classList.contains('active') && /Balanced week/.test(text) && /21/.test(text) && /2 balanced weeks in a row/.test(text), 'review content: ' + text.replace(/\\s+/g, ' ').slice(0, 300));
    need(!!modal.querySelector('.garden-grid'), 'review has no garden');

    const cv = buildShareCanvas(currentReview);
    need(cv.width === 1080 && cv.height === 1350 && cv.toDataURL('image/png').length > 8000, 'share canvas');
    need(!/\\.title\\b/.test(buildShareCanvas.toString()), 'share card must not read event titles');
    let downloaded = null; const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { downloaded = this.download; };
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
    try { await shareReview(); } finally { HTMLAnchorElement.prototype.click = origClick; delete navigator.canShare; }
    need(downloaded === 'pace-week.png', 'share without Web Share should download the image, got ' + downloaded);
    closeReview();

    // Records are only announced when they beat earlier weeks
    const wk = (balanced, done, fit) => ({ balanced, done, planned: 10, rate: done * 10, byCat: { fitness: { done: fit } } });
    const fake = { '2026-01-05': wk(false, 3, 1), '2026-01-12': wk(true, 5, 3), '2026-01-19': wk(true, 9, 4) };
    const rec = newRecordsFor(fake, '2026-01-19');
    need(rec.some(t => /2 balanced weeks in a row/.test(t)) && rec.some(t => /4 workouts/.test(t)) && rec.some(t => /9 things done/.test(t)), 'records: ' + JSON.stringify(rec));
    need(newRecordsFor({ '2026-01-05': wk(true, 9, 4) }, '2026-01-05').length === 0, 'first ever week should not announce records');

    keys.forEach(k => { if (backup[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, backup[k]); });
    scheduledEvents = saved; eventDone = savedDone; notifications.length = nBefore; saveToLocalStorage(); renderCurrentView();
    return 'ok';
  })()`, 300],
  ['rewards: finish-line message, streak moments, day closed', `(async () => {
    const need = (ok, msg) => { if (!ok) throw new Error('rewards: ' + msg); };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const toasts = () => [...document.querySelectorAll('#toastContainer .toast')].map(t => t.textContent);
    const saved = JSON.parse(JSON.stringify(scheduledEvents)), savedDone = { ...eventDone }, savedHabits = JSON.parse(JSON.stringify(dailyHabits));
    const savedClosed = localStorage.getItem('paceDayClosed');
    const day = n => new Date(Date.now() - n * 864e5).toDateString();
    need(!/broke|fail|missed|lost|disappoint/i.test(JSON.stringify(REWARD_LINES)), 'a reward line talks about failing');
    currentDate = new Date(); switchView('week');

    // finish-line message + day closed (one event today, no habits)
    localStorage.removeItem('paceDayClosed'); dailyHabits = []; eventDone = {};
    const today = new Date();
    scheduledEvents = [{ id: 1, title: 'Run', category: 'fitness', day: today.getDay() || 7, time: '07:00', duration: 60, date: toDateKey(today) }];
    markAsComplete(1);
    await sleep(1700);
    let t = toasts();
    need(REWARD_LINES.finish.fitness.some(l => t.some(x => x.includes(l))), 'no finish-line message: ' + JSON.stringify(t));
    need(t.some(x => /Day closed/.test(x)), 'no day-closed message when the only thing today is done: ' + JSON.stringify(t));
    need(localStorage.getItem('paceDayClosed') === JSON.stringify(toDateKey(today)), 'day-closed not remembered');
    document.querySelectorAll('#toastContainer .toast').forEach(x => x.remove());
    markAsComplete(1); markAsComplete(1); await sleep(1500); // undo then redo: must not announce a second time today
    need(!toasts().some(x => /Day closed/.test(x)), 'day closed announced twice');
    // a habit still open keeps the day open
    localStorage.removeItem('paceDayClosed'); eventDone = {}; dailyHabits = [{ id: 5, name: 'Stretch', category: 'fitness', completedDates: [] }];
    markAsComplete(1); await sleep(1500);
    need(!toasts().some(x => /Day closed/.test(x)) , 'day closed while a habit is still open');

    // streak moment at 3 days, comeback after a gap
    document.querySelectorAll('#toastContainer .toast').forEach(x => x.remove());
    dailyHabits = [{ id: 6, name: 'Read', category: 'personal', completedDates: [day(1), day(2)] }];
    toggleHabitComplete(6); await sleep(700);
    t = toasts();
    need(REWARD_LINES.streak[3].some(l => t.some(x => x.includes(l))), 'no 3-day streak message: ' + JSON.stringify(t));
    document.querySelectorAll('#toastContainer .toast').forEach(x => x.remove());
    dailyHabits = [{ id: 7, name: 'Meditate', category: 'personal', completedDates: [day(9), day(8), day(7)] }];
    toggleHabitComplete(7); await sleep(700);
    t = toasts();
    need(REWARD_LINES.comeback.some(l => t.some(x => x.includes(l))), 'no welcome-back message after a gap: ' + JSON.stringify(t));

    scheduledEvents = saved; eventDone = savedDone; dailyHabits = savedHabits;
    if (savedClosed === null) localStorage.removeItem('paceDayClosed'); else localStorage.setItem('paceDayClosed', savedClosed);
    saveToLocalStorage(); renderCurrentView();
    return 'ok';
  })()`, 300],
  ['rewards: your own rewards (set, progress, unlock, claim)', `(async () => {
    const need = (ok, msg) => { if (!ok) throw new Error('rewards: ' + msg); };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const saved = JSON.parse(JSON.stringify(scheduledEvents)), savedDone = { ...eventDone }, savedRewards = localStorage.getItem('paceRewards');
    localStorage.removeItem('paceRewards'); eventDone = {};
    const today = new Date(), key = toDateKey(today);
    scheduledEvents = [1, 2, 3].map(i => ({ id: i, title: 'Lift ' + i, category: 'fitness', day: today.getDay() || 7, time: '0' + (5 + i) + ':00', duration: 60, date: key }));
    currentDate = new Date(); switchView('goals');
    need(!!document.getElementById('rewardsCard'), 'no rewards card on Goals');
    document.getElementById('rewardName').value = 'New shoes';
    document.getElementById('rewardGoal').value = '2';
    document.getElementById('rewardCategory').value = 'fitness';
    addReward();
    let list = getRewards();
    need(list.length === 1 && list[0].goal === 2 && list[0].since === key, 'reward not saved: ' + JSON.stringify(list));
    need(/2 to go/.test(document.getElementById('rewardsCard').textContent), 'card should say 2 to go');
    addReward(); need(getRewards().length === 1, 'empty reward should be rejected');
    markAsComplete(1); await sleep(200);
    need(rewardProgress(getRewards()[0]) === 1 && !getRewards()[0].reached, 'one done: progress 1, not reached');
    switchView('goals'); need(/1 to go/.test(document.getElementById('rewardsCard').textContent), 'card should say 1 to go');
    markAsComplete(2); await sleep(1300);
    need(getRewards()[0].reached === true, 'goal met but reward not unlocked');
    need([...document.querySelectorAll('#toastContainer .toast')].some(t => /Reward unlocked/.test(t.textContent)), 'no unlock message');
    switchView('goals'); need(!!document.querySelector('#rewardsCard button[onclick^="claimReward"]'), 'no Claim button');
    claimReward(getRewards()[0].id);
    need(getRewards()[0].claimed === true, 'claim failed');
    deleteReward(getRewards()[0].id); need(getRewards().length === 0, 'delete failed');
    // work things do not count toward a fitness reward
    eventDone = { ['9@' + key]: 'work' };
    need(rewardProgress({ since: key, category: 'fitness' }) === 0 && rewardProgress({ since: key, category: 'any' }) === 1, 'category filter');
    if (savedRewards === null) localStorage.removeItem('paceRewards'); else localStorage.setItem('paceRewards', savedRewards);
    scheduledEvents = saved; eventDone = savedDone; saveToLocalStorage(); switchView('week'); renderWeekView();
    return 'ok';
  })()`, 300],
  ['rewards: completion marker saved before reload',`(() => { eventDone['9999@2026-01-01'] = 'work'; saveToLocalStorage(); return 'set'; })()`],
  ['backup restore round trip', `(async () => {
    const backup = { version: '1.0', scheduledEvents: [{ id: 1, title: 'Restored', day: 3, time: '10:00', duration: 30, category: 'work' }], workouts: [{ id: 9, date: '2026-10-30', workoutName: 'Legs', exercises: [] }], dailyHabits: [{ id: 1, name: 'Restored habit', category: 'personal', completedDates: [] }], partners: [] };
    const { importFromJSON } = enhanceExportImport();
    importFromJSON(new File([JSON.stringify(backup)], 'b.json'));
    await new Promise(r => setTimeout(r, 800));
    return JSON.stringify({ events: scheduledEvents.map(e => e.title), workouts: workoutLogs.length, habits: dailyHabits.map(h => h.name), habitsShown: document.querySelectorAll('#habitsList .habit-item').length, saved: JSON.parse(localStorage.getItem('paceWorkouts')).length });
  })()`, 1000],
  ['reload', null, 0, 'reload'],
  ['rewards: completion survived the reload', `(() => { if (eventDone['9999@2026-01-01'] !== 'work') throw new Error('rewards: completion not persisted'); delete eventDone['9999@2026-01-01']; saveToLocalStorage(); return 'ok'; })()`],
  ['after reload: restored data persisted',`JSON.stringify({ events: scheduledEvents.map(e => e.title), workouts: workoutLogs.length, habits: dailyHabits.map(h => h.name) })`],
  // Known week: fitness 6h/12 (50), work 40h/40 (100), family 20h/15 one-offs (33% over -> 67), personal 5h/10 (50) => 67.
  // Next week the family one-offs are gone (0) => 50. Every widget must show the same numbers.
  ['balance: every widget agrees with the real calculation', `(() => {
    const ws = getWeekStart(new Date());
    const dateIn = n => { const d = new Date(ws); d.setDate(d.getDate() + n); return toDateKey(d); };
    let id = 1000; const ev = [];
    for (let d = 1; d <= 6; d++) ev.push({ id: id++, title: 'Run', category: 'fitness', day: d, time: '07:00', duration: 60 });
    for (let d = 1; d <= 5; d++) ev.push({ id: id++, title: 'Work', category: 'work', day: d, time: '09:00', duration: 480 });
    for (let d = 0; d < 5; d++) ev.push({ id: id++, title: 'Family', category: 'family', day: d + 1, time: '18:00', duration: 240, date: dateIn(d) });
    ev.push({ id: id++, title: 'Read', category: 'personal', day: 6, time: '10:00', duration: 300 });
    scheduledEvents = ev; saveToLocalStorage();
    navigateToday();
    const read = () => ({
      calc: calculateBalance().score,
      sidebarScores: [...document.querySelectorAll('.balance-indicator .balance-score')].map(e => e.textContent.trim()),
      rightScore: document.querySelector('#balanceContent .score-value')?.textContent.trim(),
      hours: [...document.querySelectorAll('.sidebar .category-hours')].map(e => e.textContent),
      bars: [...document.querySelectorAll('.sidebar .bar-percentage')].map(e => e.textContent),
      trendBars: document.querySelectorAll('.sidebar .sparkline-bar').length,
      weekStats: document.getElementById('weekStats')?.innerText.replace(/\\s+/g, ' ').trim()
    });
    const thisWeek = read();
    switchView('goals');
    const goalsScore = document.querySelector('.goals-balance-score')?.textContent.trim();
    const goalsFake = ['26:34', 'Date Night', 'Milestones', '12 days'].filter(t => document.querySelector('.main-calendar').innerText.includes(t));
    switchView('week');
    navigateNext();
    const nextWeek = read();
    navigateToday();
    const fake = ['87', '6/6', '30 Day Trend'].filter(t => document.body.innerHTML.includes('>' + t + '<')).concat(goalsFake);
    const ok = thisWeek.calc === 67 && nextWeek.calc === 50 && goalsScore === '67' && fake.length === 0
      && [thisWeek, nextWeek].every(r => r.sidebarScores.every(s => s === String(r.calc)) && r.rightScore === String(r.calc))
      && thisWeek.hours.join() === '6h,40h,20h,5h' && thisWeek.bars.join() === '50%,100%,133%,50%' && thisWeek.trendBars === 8;
    if (!ok) throw new Error('balance mismatch: ' + JSON.stringify({ thisWeek, goalsScore, nextWeek, fake }));
    return JSON.stringify({ thisWeek, goalsScore, nextWeek: { calc: nextWeek.calc, sidebar: nextWeek.sidebarScores, right: nextWeek.rightScore, hours: nextWeek.hours }, fake });
  })()`],
  ['layout: phone-relevant controls', `JSON.stringify({ width: innerWidth, viewOnlyBanner: !!document.getElementById('viewOnlyBanner'), fabVisible: !!document.getElementById('mobileFab')?.offsetParent, mobileQuickAdd: getComputedStyle(document.querySelector('.mobile-quick-add') || document.body).display, pageScrollsSideways: document.documentElement.scrollWidth > innerWidth + 1 })`],
  ['phone: FAB -> Add Event opens form that fits', `(() => { if (innerWidth > 768) return 'desktop, skipped'; document.getElementById('mobileFab').click(); const btn = [...document.querySelectorAll('.mobile-quick-btn')].find(b => b.textContent.includes('Add Event')); btn?.click(); const m = document.querySelector('#eventModal .modal'); const r = m.getBoundingClientRect(); const save = [...m.querySelectorAll('button')].find(b => b.textContent.includes('Save')); const out = JSON.stringify({ open: document.getElementById('eventModal').classList.contains('active'), modalWidth: Math.round(r.width), fitsWidth: r.left >= 0 && r.right <= innerWidth, saveReachable: !!save }); return out; })()`],
  ['phone: fill and save from the form', `(() => { if (innerWidth > 768) return 'desktop, skipped'; document.getElementById('eventTitle').value = 'Phone event'; saveEvent(); return JSON.stringify({ saved: scheduledEvents.some(e => e.title === 'Phone event'), stored: JSON.parse(localStorage.getItem('paceEvents')).some(e => e.title === 'Phone event') }); })()`],
  ['phone: resize (keyboard opening) does not reload', `(async () => { window.__marker = 'still-here'; document.getElementById('quickAddInput').value = 'typing...'; window.dispatchEvent(new Event('resize')); await new Promise(r => setTimeout(r, 700)); return JSON.stringify({ sameDocument: window.__marker === 'still-here', inputKept: document.getElementById('quickAddInput').value }); })()`, 200],
  ['duplicate ids left', `JSON.stringify(Object.entries([...document.querySelectorAll('[id]')].reduce((a, el) => (a[el.id] = (a[el.id] || 0) + 1, a), {})).filter(([, n]) => n > 1))`],
];
