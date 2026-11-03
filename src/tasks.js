'use strict';

/* Aufgaben: To-dos mit optionalem Fälligkeitstag und Uhrzeit, Teilschritten und Wiederholung.
   state.tasks = [{ id, title, due: 'YYYY-MM-DD' | null, time: 'HH:MM' | null, note, prio, done, doneAt, createdAt,
                    steps?: [{ id, title, done }], repeat?: 'day' | 'weekdays' | 'week' | 'month', nextId? }]
   Eine wiederkehrende Aufgabe legt beim Abhaken die nächste an (nextId merkt sie, damit Zurücknehmen sie wieder entfernt). */

const REPEAT = { day: ['Täglich', 'Daily'], weekdays: ['Werktags', 'Weekdays'], week: ['Wöchentlich', 'Weekly'], month: ['Monatlich', 'Monthly'] };

function nextTaskDue(due, rep) {
  if (rep === 'day') return addDays(due, 1);
  if (rep === 'week') return addDays(due, 7);
  if (rep === 'weekdays') { let k = addDays(due, 1); while (wdOf(k) > 4) k = addDays(k, 1); return k; }
  // Monatlich: gleicher Tag im nächsten Monat, am Monatsende der letzte Tag
  const d = parseKey(due), day = d.getDate();
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  n.setDate(Math.min(day, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()));
  return keyOf(n);
}
const stepsOf = (t) => t.steps || [];

const taskSort = (a, b) => (a.due || '9999-99-99').localeCompare(b.due || '9999-99-99')
  || (a.time || '99:99').localeCompare(b.time || '99:99') || Number(b.prio) - Number(a.prio) || a.createdAt - b.createdAt;

function dueLabel(t) {
  if (!t.due) return '';
  const today = todayKey();
  const d = t.due === today ? 'Heute' : t.due === addDays(today, 1) ? 'Morgen' : t.due === addDays(today, -1) ? 'Gestern'
    : new Intl.DateTimeFormat(LOCALE(), { weekday: 'short', day: 'numeric', month: 'short' }).format(parseKey(t.due));
  return t.time ? `${d}, ${t.time}` : d;
}

function taskGroups(list) {
  const today = todayKey();
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(mondayOf(today), 6);
  const groups = [
    { id: 'overdue', label: 'Überfällig', icon: 'alarm-clock', items: [] },
    { id: 'today', label: 'Heute', icon: 'sun', items: [] },
    { id: 'tomorrow', label: 'Morgen', icon: 'sunrise', items: [] },
    { id: 'week', label: 'Diese Woche', icon: 'calendar-range', items: [] },
    { id: 'later', label: 'Später', icon: 'calendar-days', items: [] },
    { id: 'nodate', label: 'Ohne Datum', icon: 'inbox', items: [] },
  ];
  const g = Object.fromEntries(groups.map((x) => [x.id, x]));
  for (const t of [...list].sort(taskSort)) {
    if (!t.due) g.nodate.items.push(t);
    else if (t.due < today) g.overdue.items.push(t);
    else if (t.due === today) g.today.items.push(t);
    else if (t.due === tomorrow) g.tomorrow.items.push(t);
    else if (t.due <= weekEnd) g.week.items.push(t);
    else g.later.items.push(t);
  }
  return groups.filter((x) => x.items.length);
}

function taskRow(t) {
  const overdue = !t.done && t.due && t.due < todayKey();
  const steps = stepsOf(t), stepsDone = steps.filter((s) => s.done).length;
  const meta = [
    t.due ? `<span class="${overdue ? 'late' : ''}">${icon('calendar')}${esc(dueLabel(t))}</span>` : '',
    t.repeat ? `<span>${icon('repeat')}${dt(...REPEAT[t.repeat])}</span>` : '',
    steps.length ? `<span class="${stepsDone === steps.length ? 'ok' : ''}">${icon('list-checks')}${stepsDone}/${steps.length}</span>` : '',
    t.note ? `<span>${icon('align-left')}Notiz</span>` : '',
  ].join('');
  return `
  <div class="task-row ${t.done ? 'done' : ''} ${overdue ? 'overdue' : ''} ${t.prio ? 'prio' : ''}" data-q="${esc(`${t.title} ${t.note || ''} ${steps.map((s) => s.title).join(' ')}`.toLowerCase())}">
    <button class="task-check ${t.done ? 'on' : ''}" data-action="task-toggle" data-id="${t.id}" aria-pressed="${t.done}" aria-label="${esc(t.title)} erledigt">${icon('check')}</button>
    <button class="task-main" data-action="task-edit" data-id="${t.id}">
      <span class="task-title">${esc(t.title)}</span>
      ${meta ? `<span class="task-meta">${meta}</span>` : ''}
      ${steps.length && !t.done ? `<span class="task-steps-bar"><i style="width:${(stepsDone / steps.length) * 100}%"></i></span>` : ''}
    </button>
    <span class="task-tools">
      ${!t.done && t.due !== addDays(todayKey(), 1) ? `<button class="task-tool" data-action="task-tomorrow" data-id="${t.id}" title="${dt('Auf morgen verschieben', 'Move to tomorrow')}">${icon('sunrise')}</button>` : ''}
      ${!t.done ? `<button class="task-tool ${t.prio ? 'on' : ''}" data-action="task-flag" data-id="${t.id}" title="${t.prio ? dt('Nicht mehr wichtig', 'Not important') : dt('Als wichtig markieren', 'Mark as important')}">${icon('flag')}</button>` : ''}
    </span>
    ${t.prio ? `<span class="task-flag" title="Wichtig">${icon('flag')}</span>` : ''}
  </div>`;
}

// Seitenspalte: erledigte Aufgaben der letzten 14 Tage und die Serie an Tagen mit mindestens einer erledigten Aufgabe
function taskStats() {
  const today = todayKey();
  const per = {};
  for (const t of state.tasks) if (t.done && t.doneAt) { const k = keyOf(new Date(t.doneAt)); per[k] = (per[k] || 0) + 1; }
  const days = range(addDays(today, -13), today);
  let run = 0, k = per[today] ? today : addDays(today, -1);
  while (per[k]) { run++; k = addDays(k, -1); }
  return { days: days.map((d) => ({ k: d, n: per[d] || 0 })), run, max: Math.max(1, ...days.map((d) => per[d] || 0)) };
}

function taskWeekCard(open) {
  const today = todayKey();
  const days = range(today, addDays(today, 6));
  const max = Math.max(1, ...days.map((k) => open.filter((t) => t.due === k).length));
  return `
  <article class="card fade-in">
    <div class="card-head"><div><h2>${dt('Die nächsten 7 Tage', 'Next 7 days')}</h2><div class="sub">${dt('Klick auf einen Tag, um dort etwas einzutragen', 'Click a day to add something there')}</div></div><div class="icon-btn">${icon('calendar-range')}</div></div>
    <div class="task-week">${days.map((k) => {
      const n = open.filter((t) => t.due === k).length;
      const label = k === today ? dt('Heute', 'Today') : new Intl.DateTimeFormat(LOCALE(), { weekday: 'short' }).format(parseKey(k));
      return `<button class="tw-day ${k === today ? 'today' : ''} ${ui.taskQuickDue === k ? 'on' : ''}" data-action="task-quick-due" data-due="${k}" title="${esc(fmtLong(k))}">
        <span class="tw-bar"><i style="height:${n ? 18 + (n / max) * 82 : 0}%"></i></span>
        <b>${n || '·'}</b><small>${esc(label)}</small><em>${parseKey(k).getDate()}.</em></button>`;
    }).join('')}</div>
  </article>`;
}


function quickAdd(id, due = null) {
  const today = todayKey();
  const chosen = ui.taskQuickDue !== undefined ? ui.taskQuickDue : due;
  const chips = [['Heute', today], ['Morgen', addDays(today, 1)], ['Nächste Woche', addDays(mondayOf(today), 7)], ['Ohne Datum', null]];
  return `
  <form class="task-add" data-task-form="${id}">
    <div class="task-add-row">
      ${icon('plus')}
      <input class="task-input" id="${id}" placeholder="Neue Aufgabe, z. B. Steuer abgeben" maxlength="140" autocomplete="off">
      <button class="btn small primary" type="submit">Hinzufügen</button>
    </div>
    ${due === null ? `<div class="task-chips">${chips.map(([l, k]) => `<button type="button" class="chip ${chosen === k ? 'on' : ''}" data-action="task-quick-due" data-due="${k ?? ''}">${l}</button>`).join('')}
      <input type="date" class="input task-date" data-task-date value="${chosen && !chips.some(([, k]) => k === chosen) ? chosen : ''}" aria-label="Datum wählen"></div>` : ''}
  </form>`;
}

function viewTasks() {
  const open = state.tasks.filter((t) => !t.done);
  const doneList = state.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const today = todayKey();
  const weekStart = dayStart(mondayOf(today));
  const doneWeek = doneList.filter((t) => (t.doneAt || 0) >= weekStart).length;
  const overdue = open.filter((t) => t.due && t.due < today).length;
  const filter = ui.taskFilter || 'all';
  const shown = open.filter((t) => filter === 'all' || (filter === 'prio' && t.prio) || (filter === 'repeat' && t.repeat) || (filter === 'steps' && stepsOf(t).length));
  const groups = taskGroups(shown);
  const st = taskStats();
  if (ui.taskSearch) queueMicrotask(applyTaskSearch); // Suchbegriff bleibt nach dem Neuzeichnen aktiv
  const filters = [['all', dt('Alle', 'All'), open.length], ['prio', dt('Wichtig', 'Important'), open.filter((t) => t.prio).length],
    ['repeat', dt('Wiederkehrend', 'Recurring'), open.filter((t) => t.repeat).length], ['steps', dt('Mit Teilschritten', 'With steps'), open.filter((t) => stepsOf(t).length).length]];
  return `
  <header class="head fade-in">
    <div><div class="eyebrow">${open.length} offen</div><h1>Aufgaben</h1></div>
  </header>
  <section class="grid">
    <article class="card s8 fade-in">
      ${quickAdd('task-new')}
      ${open.length ? `
      <div class="task-filter">
        <div class="task-chips">${filters.filter(([id, , n]) => id === 'all' || n || id === filter).map(([id, l, n]) => `<button type="button" class="chip ${filter === id ? 'on' : ''}" data-action="task-filter" data-filter="${id}">${l}<small>${n}</small></button>`).join('')}</div>
        <label class="task-search">${icon('search')}<input id="task-search" placeholder="${dt('Suchen …', 'Search …')}" autocomplete="off" value="${esc(ui.taskSearch || '')}"></label>
      </div>` : ''}
      ${groups.length ? groups.map((g) => `
        <div class="task-group ${g.id}">
          <div class="daypart-head">${icon(g.icon)}<span>${g.label}</span>${g.id === 'overdue' ? `<button class="task-head-btn" data-action="task-overdue-today">${icon('arrow-right')}${dt('Alle auf heute', 'All to today')}</button>` : ''}<span class="daypart-count">${g.items.length}</span></div>
          <div class="task-list">${g.items.map(taskRow).join('')}</div>
        </div>`).join('')
        : open.length ? `<div class="task-empty">${icon('filter-x')}<b>${dt('Nichts in diesem Filter', 'Nothing in this filter')}</b><span>${dt('Wähl oben „Alle“, um wieder alles zu sehen.', 'Choose “All” above to see everything again.')}</span></div>`
        : `<div class="task-empty">${icon('party-popper')}<b>Alles erledigt.</b><span>Trag oben ein, was als Nächstes ansteht.</span></div>`}
      <div class="task-empty task-nohit" hidden>${icon('search-x')}<b>${dt('Nichts gefunden', 'Nothing found')}</b></div>
    </article>
    <div class="col s4">
      <article class="card fade-in">
        <div class="card-head"><div><h2>Diese Woche</h2><div class="sub">Erledigte Aufgaben seit Montag</div></div><div class="icon-btn" style="color:var(--good)">${icon('circle-check')}</div></div>
        <div class="stat-row">
          <div class="big">${num(doneWeek)}<small> erledigt</small></div>
          <div style="text-align:right"><div class="sub">Überfällig</div><div class="num" style="font-size:18px;color:${overdue ? 'var(--bad)' : 'var(--fg)'}">${num(overdue)}</div></div>
        </div>
        <div class="task-spark" title="${dt('Erledigt pro Tag, letzte 14 Tage', 'Done per day, last 14 days')}">${st.days.map((d) => `<span class="${d.k === todayKey() ? 'today' : ''}" title="${esc(fmtShort(d.k))}: ${d.n}"><i data-anim="h" style="height:${d.n ? 12 + (d.n / st.max) * 88 : 4}%" class="${d.n ? '' : 'zero'}"></i></span>`).join('')}</div>
        <div class="task-spark-foot"><span>${dt('Letzte 14 Tage', 'Last 14 days')}</span><span class="${st.run ? 'hot' : ''}">${icon('flame')}${st.run ? dt(`${st.run} ${st.run === 1 ? 'Tag' : 'Tage'} in Folge`, `${st.run} ${st.run === 1 ? 'day' : 'days'} in a row`) : dt('Noch keine Serie', 'No streak yet')}</span></div>
      </article>
      ${taskWeekCard(open)}
      <article class="card fade-in">
        <div class="card-head">
          <div><h2>Erledigt</h2><div class="sub">${doneList.length ? 'Zuletzt abgehakt' : 'Noch nichts abgehakt'}</div></div>
          ${doneList.length ? (ui.confirmClearTasks
            ? `<button class="btn small danger" data-action="task-clear-yes">Alle löschen</button>`
            : `<button class="btn small ghost" data-action="task-clear">${icon('trash-2')}Aufräumen</button>`) : ''}
        </div>
        <div class="task-list">${doneList.slice(0, 12).map(taskRow).join('')}</div>
      </article>
    </div>
  </section>`;
}

// Karte für die Heute-Seite: Überfälliges und Heutiges
function todayTasksCard(span = 's8') {
  const today = todayKey();
  const list = state.tasks.filter((t) => !t.done && t.due && t.due <= today).sort(taskSort);
  const doneToday = state.tasks.filter((t) => t.done && t.doneAt && keyOf(new Date(t.doneAt)) === today);
  return `
  <article class="card ${span} fade-in">
    <div class="card-head">
      <div><h2>Aufgaben für heute</h2><div class="sub">${list.length ? `${list.length} offen${doneToday.length ? `, ${doneToday.length} erledigt` : ''}` : doneToday.length ? 'Alles für heute erledigt' : 'Nichts fällig'}</div></div>
      <button class="icon-btn" data-action="goto" data-view="tasks" title="Alle Aufgaben">${icon('list-todo')}</button>
    </div>
    ${quickAdd('task-today', today)}
    ${list.length || doneToday.length ? `<div class="task-list">${list.map(taskRow).join('')}${doneToday.map(taskRow).join('')}</div>` : ''}
  </article>`;
}

function addTask(title, due) {
  const t = { id: uid(), title, due: due || null, time: null, note: '', prio: false, done: false, doneAt: null, createdAt: Date.now() };
  state.tasks.push(t);
  save();
  return t;
}

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-task-form]');
  if (!form) return;
  e.preventDefault();
  const input = form.querySelector('.task-input');
  const title = input.value.trim();
  if (!title) { input.focus(); return; }
  const fixed = form.dataset.taskForm === 'task-today' ? todayKey() : null;
  const due = fixed || (ui.taskQuickDue !== undefined ? ui.taskQuickDue : null);
  addTask(title, due);
  toast(due ? `Aufgabe für ${dueLabel({ due })} angelegt` : 'Aufgabe angelegt');
  render('update');
  document.getElementById(form.dataset.taskForm)?.focus();
});

document.addEventListener('change', (e) => {
  if (!e.target.matches('[data-task-date]')) return;
  ui.taskQuickDue = e.target.value || null;
  render('update');
  document.getElementById('task-new')?.focus();
});

function toggleTask(id, btn) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : null;
  if (t.done && t.repeat && !t.nextId) {
    const n = { ...t, id: uid(), due: nextTaskDue(t.due || todayKey(), t.repeat), done: false, doneAt: null, nextId: null, createdAt: Date.now(),
      steps: stepsOf(t).map((s) => ({ ...s, id: uid(), done: false })) };
    state.tasks.push(n);
    t.nextId = n.id;
    toast(dt(`Nächstes Mal: ${dueLabel(n)}`, `Next time: ${dueLabel(n)}`));
  } else if (!t.done && t.nextId) {
    // Zurückgenommen: die schon angelegte nächste Aufgabe wieder entfernen, solange sie unberührt ist
    state.tasks = state.tasks.filter((x) => !(x.id === t.nextId && !x.done));
    t.nextId = null;
  }
  save();
  if (t.done) { btn?.classList.add('on', 'pop'); burst(btn, 'var(--good)'); xpPop(btn, XP.task + (t.prio ? XP.taskPrio : 0)); }
  setTimeout(() => render('update'), t.done ? 260 : 0);
}

/* ================= Bearbeiten ================= */

function openTaskEditor(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  ui.taskEdit = { ...t, steps: stepsOf(t).map((s) => ({ ...s })), repeat: t.repeat || '', confirmDelete: false };
  renderTaskEditor(true);
}

function renderTaskEditor(first = false) {
  const e = ui.taskEdit;
  const html = `
    <div class="card-head">
      <h2 class="panel-title" style="font-size:20px">Aufgabe</h2>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button>
    </div>
    <div class="field"><label for="te-title">Was ist zu tun?</label><input class="input" id="te-title" data-task-field="title" maxlength="140" value="${esc(e.title)}" autocomplete="off"></div>
    <div class="ce-row">
      <div class="field"><label for="te-due">Fällig am</label><input class="input" type="date" id="te-due" data-task-field="due" value="${e.due || ''}"></div>
      <div class="field"><label for="te-time">Uhrzeit (optional)</label><input class="input" type="time" id="te-time" data-task-field="time" value="${e.time || ''}" ${e.due ? '' : 'disabled'}></div>
    </div>
    <div class="field"><label for="te-repeat">${dt('Wiederholen', 'Repeat')}</label>
      <select class="input" id="te-repeat" data-task-field="repeat">
        <option value="">${dt('Nicht wiederholen', 'Does not repeat')}</option>
        ${Object.entries(REPEAT).map(([k, l]) => `<option value="${k}" ${e.repeat === k ? 'selected' : ''}>${dt(...l)}</option>`).join('')}
      </select>
      ${e.repeat ? `<small class="field-hint">${dt('Wenn du sie abhakst, wird die nächste automatisch angelegt.', 'When you tick it off, the next one is created automatically.')}</small>` : ''}
    </div>
    <div class="field"><label>${dt('Teilschritte', 'Steps')}${e.steps.length ? ` · ${e.steps.filter((s) => s.done).length}/${e.steps.length}` : ''}</label>
      <div class="te-steps">
        ${e.steps.map((s) => `<div class="te-step ${s.done ? 'done' : ''}">
          <button class="task-check small ${s.done ? 'on' : ''}" data-action="task-step-toggle" data-id="${s.id}" aria-label="${esc(s.title)}">${icon('check')}</button>
          <span>${esc(s.title)}</span>
          <button class="icon-btn" data-action="task-step-del" data-id="${s.id}" title="${dt('Entfernen', 'Remove')}">${icon('x')}</button>
        </div>`).join('')}
        <div class="te-step add">${icon('plus')}<input class="input" id="te-step-new" maxlength="120" placeholder="${dt('Teilschritt hinzufügen und Enter drücken', 'Add a step and press Enter')}" autocomplete="off"></div>
      </div>
    </div>
    <label class="setting" for="te-prio" style="border:0;padding:0"><div><b>Wichtig</b><span>Wird mit einer Fahne markiert und oben einsortiert</span></div><input type="checkbox" class="switch" id="te-prio" data-action="task-prio" ${e.prio ? 'checked' : ''}></label>
    <div class="field"><label for="te-note">Notiz</label><textarea class="input note" id="te-note" data-task-field="note" rows="3" maxlength="1000" placeholder="optional">${esc(e.note || '')}</textarea></div>
    ${e.error ? `<div class="error">${e.error}</div>` : ''}
    <div class="modal-foot">
      ${e.confirmDelete
        ? `<div class="btn-row"><span class="error">Aufgabe löschen?</span><button class="btn small danger" data-action="task-delete-yes">Löschen</button><button class="btn small ghost" data-action="task-delete-no">Nein</button></div>`
        : `<button class="btn small danger" data-action="task-delete">${icon('trash-2')}Löschen</button>`}
      <div class="right">
        <button class="btn ghost" data-action="close-modal">Abbrechen</button>
        <button class="btn primary" data-action="task-save">${icon('check')}Speichern</button>
      </div>
    </div>`;
  if (first) { openPanel(html); document.getElementById('te-title')?.focus(); return; }
  const m = document.querySelector('#modal .modal');
  if (m) { m.classList.remove('enter'); m.innerHTML = html; lucide.createIcons(); }
}

document.addEventListener('input', (e) => {
  const f = e.target.dataset?.taskField;
  if (!f || !ui.taskEdit) return;
  ui.taskEdit[f] = e.target.value;
  if (f === 'due') { const tm = document.getElementById('te-time'); if (tm) tm.disabled = !e.target.value; }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'te-repeat' && ui.taskEdit) { ui.taskEdit.repeat = e.target.value; renderTaskEditor(); }
});
document.addEventListener('keydown', (e) => {
  if (e.target.id !== 'te-step-new' || e.key !== 'Enter') return;
  e.preventDefault();
  const v = e.target.value.trim();
  if (!v || !ui.taskEdit) return;
  ui.taskEdit.steps.push({ id: uid(), title: v, done: false });
  renderTaskEditor();
  document.getElementById('te-step-new')?.focus();
});

// Suche filtert nur die sichtbaren Zeilen, ohne die Seite neu zu bauen
function applyTaskSearch() {
  const q = (ui.taskSearch || '').trim().toLowerCase();
  const card = document.querySelector('#task-search')?.closest('.card');
  if (!card) return;
  let hits = 0;
  card.querySelectorAll('.task-group').forEach((g) => {
    let n = 0;
    g.querySelectorAll('.task-row').forEach((r) => { const ok = !q || r.dataset.q.includes(q); r.hidden = !ok; if (ok) n++; });
    g.hidden = !n;
    hits += n;
  });
  const none = card.querySelector('.task-nohit');
  if (none) none.hidden = !q || hits > 0;
}
document.addEventListener('input', (e) => { if (e.target.id === 'task-search') { ui.taskSearch = e.target.value; applyTaskSearch(); } });

function saveTask() {
  const e = ui.taskEdit;
  if (!e) return;
  const title = e.title.trim();
  if (!title) { e.error = 'Gib der Aufgabe einen Namen.'; renderTaskEditor(); return; }
  const t = state.tasks.find((x) => x.id === e.id);
  const pending = document.getElementById('te-step-new')?.value.trim();
  if (pending) e.steps.push({ id: uid(), title: pending, done: false });
  Object.assign(t, { title, due: e.due || null, time: e.due && e.time ? e.time : null, note: (e.note || '').trim(), prio: !!e.prio,
    steps: e.steps, repeat: e.repeat || null });
  ui.taskEdit = null;
  save();
  closeModal();
  toast('Aufgabe gespeichert');
  render('update');
}

// Aufgaben mit Fälligkeit als Einträge für Kalender und Erinnerungen
function taskInstances(fromKey, toKey) {
  return state.tasks.filter((t) => t.due && t.due >= fromKey && t.due <= toKey).map((t) => {
    if (t.time) {
      const s = new Date(`${t.due}T${t.time}`).getTime();
      return { ev: { id: `task:${t.id}`, taskId: t.id, title: t.title, task: true, done: t.done }, allDay: false, startMs: s, endMs: s + 30 * 60000, startKey: t.due, endKey: t.due };
    }
    return { ev: { id: `task:${t.id}`, taskId: t.id, title: t.title, task: true, done: t.done }, allDay: true, startKey: t.due, endKey: t.due };
  });
}

function taskAction(a, el) {
  switch (a) {
    case 'task-toggle': toggleTask(el.dataset.id, el); return true;
    case 'task-edit': openTaskEditor(el.dataset.id); return true;
    case 'task-quick-due': ui.taskQuickDue = el.dataset.due || null; render('update'); document.getElementById('task-new')?.focus(); return true;
    case 'task-prio': ui.taskEdit.prio = el.checked; return true;
    case 'task-save': saveTask(); return true;
    case 'task-delete': ui.taskEdit.confirmDelete = true; renderTaskEditor(); return true;
    case 'task-delete-no': ui.taskEdit.confirmDelete = false; renderTaskEditor(); return true;
    case 'task-delete-yes':
      state.tasks = state.tasks.filter((t) => t.id !== ui.taskEdit.id);
      ui.taskEdit = null; save(); closeModal(); toast('Aufgabe gelöscht'); render('update');
      return true;
    case 'task-filter': ui.taskFilter = el.dataset.filter; render('update'); return true;
    case 'task-tomorrow': {
      const t = state.tasks.find((x) => x.id === el.dataset.id);
      if (t) { t.due = addDays(todayKey(), 1); save(); toast(dt(`„${t.title}“ auf morgen verschoben`, `“${t.title}” moved to tomorrow`)); render('update'); }
      return true;
    }
    case 'task-flag': {
      const t = state.tasks.find((x) => x.id === el.dataset.id);
      if (t) { t.prio = !t.prio; save(); render('update'); }
      return true;
    }
    case 'task-overdue-today': {
      const today = todayKey();
      const late = state.tasks.filter((t) => !t.done && t.due && t.due < today);
      late.forEach((t) => { t.due = today; });
      save(); toast(dt(`${late.length} ${late.length === 1 ? 'Aufgabe' : 'Aufgaben'} auf heute verschoben`, `Moved ${late.length} to today`)); render('update');
      return true;
    }
    case 'task-step-toggle': { const s = ui.taskEdit.steps.find((x) => x.id === el.dataset.id); if (s) s.done = !s.done; renderTaskEditor(); return true; }
    case 'task-step-del': ui.taskEdit.steps = ui.taskEdit.steps.filter((x) => x.id !== el.dataset.id); renderTaskEditor(); return true;
    case 'task-clear': ui.confirmClearTasks = true; render('update'); return true;
    case 'task-clear-yes':
      state.tasks = state.tasks.filter((t) => !t.done);
      ui.confirmClearTasks = false; save(); toast('Erledigte Aufgaben gelöscht'); render('update');
      return true;
  }
  return false;
}
