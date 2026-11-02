'use strict';

/* Aufgaben: einmalige To-dos mit optionalem Fälligkeitstag und Uhrzeit.
   state.tasks = [{ id, title, due: 'YYYY-MM-DD' | null, time: 'HH:MM' | null, note, prio, done, doneAt, createdAt }] */

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
  return `
  <div class="task-row ${t.done ? 'done' : ''} ${overdue ? 'overdue' : ''} ${t.prio ? 'prio' : ''}">
    <button class="task-check ${t.done ? 'on' : ''}" data-action="task-toggle" data-id="${t.id}" aria-pressed="${t.done}" aria-label="${esc(t.title)} erledigt">${icon('check')}</button>
    <button class="task-main" data-action="task-edit" data-id="${t.id}">
      <span class="task-title">${esc(t.title)}</span>
      ${t.due || t.note ? `<span class="task-meta">${t.due ? `<span class="${overdue ? 'late' : ''}">${icon('calendar')}${esc(dueLabel(t))}</span>` : ''}${t.note ? `<span>${icon('align-left')}Notiz</span>` : ''}</span>` : ''}
    </button>
    ${t.prio ? `<span class="task-flag" title="Wichtig">${icon('flag')}</span>` : ''}
  </div>`;
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
  const groups = taskGroups(open);
  return `
  <header class="head fade-in">
    <div><div class="eyebrow">${open.length} offen</div><h1>Aufgaben</h1></div>
  </header>
  <section class="grid">
    <article class="card s8 fade-in">
      ${quickAdd('task-new')}
      ${groups.length ? groups.map((g) => `
        <div class="task-group ${g.id}">
          <div class="daypart-head">${icon(g.icon)}<span>${g.label}</span><span class="daypart-count">${g.items.length}</span></div>
          <div class="task-list">${g.items.map(taskRow).join('')}</div>
        </div>`).join('')
        : `<div class="task-empty">${icon('party-popper')}<b>Alles erledigt.</b><span>Trag oben ein, was als Nächstes ansteht.</span></div>`}
    </article>
    <div class="col s4">
      <article class="card fade-in">
        <div class="card-head"><div><h2>Diese Woche</h2><div class="sub">Erledigte Aufgaben seit Montag</div></div><div class="icon-btn" style="color:var(--good)">${icon('circle-check')}</div></div>
        <div class="stat-row">
          <div class="big">${num(doneWeek)}<small> erledigt</small></div>
          <div style="text-align:right"><div class="sub">Überfällig</div><div class="num" style="font-size:18px;color:${overdue ? 'var(--bad)' : 'var(--fg)'}">${num(overdue)}</div></div>
        </div>
      </article>
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
  save();
  if (t.done) { btn?.classList.add('on', 'pop'); burst(btn, 'var(--good)'); xpPop(btn, XP.task + (t.prio ? XP.taskPrio : 0)); }
  setTimeout(() => render('update'), t.done ? 260 : 0);
}

/* ================= Bearbeiten ================= */

function openTaskEditor(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  ui.taskEdit = { ...t, confirmDelete: false };
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

function saveTask() {
  const e = ui.taskEdit;
  if (!e) return;
  const title = e.title.trim();
  if (!title) { e.error = 'Gib der Aufgabe einen Namen.'; renderTaskEditor(); return; }
  const t = state.tasks.find((x) => x.id === e.id);
  Object.assign(t, { title, due: e.due || null, time: e.due && e.time ? e.time : null, note: (e.note || '').trim(), prio: !!e.prio });
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
    case 'task-clear': ui.confirmClearTasks = true; render('update'); return true;
    case 'task-clear-yes':
      state.tasks = state.tasks.filter((t) => !t.done);
      ui.confirmClearTasks = false; save(); toast('Erledigte Aufgaben gelöscht'); render('update');
      return true;
  }
  return false;
}
