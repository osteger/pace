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
  ['backup restore round trip', `(async () => {
    const backup = { version: '1.0', scheduledEvents: [{ id: 1, title: 'Restored', day: 3, time: '10:00', duration: 30, category: 'work' }], workouts: [{ id: 9, date: '2026-10-30', workoutName: 'Legs', exercises: [] }], dailyHabits: [{ id: 1, name: 'Restored habit', category: 'personal', completedDates: [] }], partners: [] };
    const { importFromJSON } = enhanceExportImport();
    importFromJSON(new File([JSON.stringify(backup)], 'b.json'));
    await new Promise(r => setTimeout(r, 800));
    return JSON.stringify({ events: scheduledEvents.map(e => e.title), workouts: workoutLogs.length, habits: dailyHabits.map(h => h.name), habitsShown: document.querySelectorAll('#habitsList .habit-item').length, saved: JSON.parse(localStorage.getItem('paceWorkouts')).length });
  })()`, 1000],
  ['reload', null, 0, 'reload'],
  ['after reload: restored data persisted', `JSON.stringify({ events: scheduledEvents.map(e => e.title), workouts: workoutLogs.length, habits: dailyHabits.map(h => h.name) })`],
  ['layout: phone-relevant controls', `JSON.stringify({ width: innerWidth, viewOnlyBanner: !!document.getElementById('viewOnlyBanner'), fabVisible: !!document.getElementById('mobileFab')?.offsetParent, mobileQuickAdd: getComputedStyle(document.querySelector('.mobile-quick-add') || document.body).display, pageScrollsSideways: document.documentElement.scrollWidth > innerWidth + 1 })`],
  ['phone: FAB -> Add Event opens form that fits', `(() => { if (innerWidth > 768) return 'desktop, skipped'; document.getElementById('mobileFab').click(); const btn = [...document.querySelectorAll('.mobile-quick-btn')].find(b => b.textContent.includes('Add Event')); btn?.click(); const m = document.querySelector('#eventModal .modal'); const r = m.getBoundingClientRect(); const save = [...m.querySelectorAll('button')].find(b => b.textContent.includes('Save')); const out = JSON.stringify({ open: document.getElementById('eventModal').classList.contains('active'), modalWidth: Math.round(r.width), fitsWidth: r.left >= 0 && r.right <= innerWidth, saveReachable: !!save }); return out; })()`],
  ['phone: fill and save from the form', `(() => { if (innerWidth > 768) return 'desktop, skipped'; document.getElementById('eventTitle').value = 'Phone event'; saveEvent(); return JSON.stringify({ saved: scheduledEvents.some(e => e.title === 'Phone event'), stored: JSON.parse(localStorage.getItem('paceEvents')).some(e => e.title === 'Phone event') }); })()`],
  ['phone: resize (keyboard opening) does not reload', `(async () => { window.__marker = 'still-here'; document.getElementById('quickAddInput').value = 'typing...'; window.dispatchEvent(new Event('resize')); await new Promise(r => setTimeout(r, 700)); return JSON.stringify({ sameDocument: window.__marker === 'still-here', inputKept: document.getElementById('quickAddInput').value }); })()`, 200],
  ['duplicate ids left', `JSON.stringify(Object.entries([...document.querySelectorAll('[id]')].reduce((a, el) => (a[el.id] = (a[el.id] || 0) + 1, a), {})).filter(([, n]) => n > 1))`],
];
