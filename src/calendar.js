'use strict';

/* Kalender: eigene Termine, Schichten aus dem Stundenplan und importierte Kalender (iCal-Abo oder .ics-Datei).
   Termine ganztägig: start/end als Tages-Schlüssel (end inklusive). Mit Uhrzeit: start/end in Millisekunden. */

const CAL_COLORS = ['#1e90ff', '#5ee0ff', '#8f7bff', '#ff7ab6', '#ffc46b', '#57e3b4', '#ff8f6b', '#7aa2ff', '#c4f06b'];
const SHIFT_COLOR = '#57e3b4';
const WD_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
const hhmm = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const calOf = (id) => (id === 'local' ? { id: 'local', name: 'Meine Termine', color: CAL_COLORS[0], visible: true } : state.calendars.find((c) => c.id === id));

/* ================= iCal lesen ================= */

const unescapeIcs = (v) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

// Offset einer Zeitzone zu einem Zeitpunkt in Millisekunden
function tzOffset(ms, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
}

// Uhrzeit "an der Wand" in einer Zeitzone in einen Zeitpunkt umrechnen
function zonedToMs(y, mo, d, h, mi, s, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  try {
    const o1 = tzOffset(guess, tz);
    const o2 = tzOffset(guess - o1, tz);
    return guess - o2;
  } catch {
    return new Date(y, mo - 1, d, h, mi, s).getTime(); // unbekannte Zone (z. B. Windows-Namen): als lokale Zeit
  }
}

function parseIcsDate(v, p) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h || p.VALUE === 'DATE') return { allDay: true, key: `${y}-${mo}-${d}` };
  if (z) return { allDay: false, ms: Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) };
  if (p.TZID) return { allDay: false, ms: zonedToMs(+y, +mo, +d, +h, +mi, +s, p.TZID.replace(/^"|"$/g, '')) };
  return { allDay: false, ms: new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime() };
}

function parseDuration(v) {
  const m = /^-?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return 3600000;
  const [, w = 0, d = 0, h = 0, mi = 0, s = 0] = m;
  return ((((+w * 7 + +d) * 24 + +h) * 60 + +mi) * 60 + +s) * 1000;
}

const ICS_WD = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
function parseRRule(v) {
  const r = Object.fromEntries(v.split(';').map((x) => x.split('=')));
  const out = { freq: r.FREQ, interval: Math.max(1, Number(r.INTERVAL) || 1) };
  if (r.COUNT) out.count = Number(r.COUNT);
  if (r.UNTIL) { const u = parseIcsDate(r.UNTIL, {}); out.until = u ? (u.allDay ? u.key : keyOf(new Date(u.ms))) : null; }
  if (r.BYDAY) {
    out.byday = r.BYDAY.split(',').map((x) => {
      const m = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(x);
      return m ? { n: m[1] ? Number(m[1]) : 0, wd: ICS_WD[m[2]] } : null;
    }).filter(Boolean);
  }
  return ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(out.freq) ? out : null;
}

function parseICS(text, calId) {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  const overrides = [];
  let cur = null, name = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { exdates: [] }; continue; }
    if (line === 'END:VEVENT') {
      if (cur?.dt && cur.status !== 'CANCELLED') events.push(cur);
      if (cur?.recurrenceId) overrides.push(cur);
      cur = null;
      continue;
    }
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [prop, ...params] = line.slice(0, i).split(';');
    const p = Object.fromEntries(params.map((x) => { const j = x.indexOf('='); return [x.slice(0, j), x.slice(j + 1)]; }));
    const value = line.slice(i + 1);
    if (!cur) { if (prop === 'X-WR-CALNAME') name = unescapeIcs(value); continue; }
    switch (prop) {
      case 'SUMMARY': cur.title = unescapeIcs(value); break;
      case 'DESCRIPTION': cur.note = unescapeIcs(value).slice(0, 2000); break;
      case 'LOCATION': cur.location = unescapeIcs(value); break;
      case 'UID': cur.uid = value; break;
      case 'STATUS': cur.status = value; break;
      case 'DTSTART': cur.dt = parseIcsDate(value, p); break;
      case 'DTEND': cur.dtEnd = parseIcsDate(value, p); break;
      case 'DURATION': cur.duration = parseDuration(value); break;
      case 'RRULE': cur.rrule = parseRRule(value); break;
      case 'RECURRENCE-ID': { const d = parseIcsDate(value, p); cur.recurrenceId = d && (d.allDay ? d.key : keyOf(new Date(d.ms))); break; }
      case 'EXDATE':
        for (const v of value.split(',')) {
          const d = parseIcsDate(v, p);
          if (d) cur.exdates.push(d.allDay ? d.key : keyOf(new Date(d.ms)));
        }
        break;
    }
  }
  // Geänderte Einzeltermine einer Serie: an dem Tag die Serie aussetzen
  for (const o of overrides) {
    const master = events.find((e) => e.uid === o.uid && e.rrule);
    if (master && o.recurrenceId) master.exdates.push(o.recurrenceId);
  }
  const out = events.map((e, n) => {
    const allDay = e.dt.allDay;
    let start, end;
    if (allDay) {
      start = e.dt.key;
      end = e.dtEnd?.allDay ? addDays(e.dtEnd.key, -1) : start; // DTEND ist bei ganztägigen Terminen exklusiv
      if (end < start) end = start;
    } else {
      start = e.dt.ms;
      end = e.dtEnd && !e.dtEnd.allDay ? e.dtEnd.ms : start + (e.duration ?? 3600000);
    }
    return {
      id: `${calId}:${e.uid || n}:${e.recurrenceId || ''}`, cal: calId, title: e.title || '(Ohne Titel)', allDay, start, end,
      note: e.note || '', location: e.location || '', rrule: e.recurrenceId ? null : e.rrule || null, exdates: e.exdates.length ? e.exdates : undefined,
    };
  });
  return { name, events: out };
}

/* ================= Termine eines Zeitraums ================= */

function instanceAt(ev, k) {
  if (ev.allDay) {
    const len = daysBetween(ev.start, ev.end);
    return { ev, allDay: true, startKey: k, endKey: addDays(k, len) };
  }
  const base = new Date(ev.start);
  const d = parseKey(k);
  d.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), 0);
  const s = d.getTime(), e = s + Math.max(0, ev.end - ev.start);
  return { ev, allDay: false, startMs: s, endMs: e, startKey: k, endKey: keyOf(new Date(Math.max(s, e - 1))) };
}

function nthWeekday(y, m, wd, n) {
  if (n > 0) {
    const first = new Date(y, m, 1);
    const off = (wd - ((first.getDay() + 6) % 7) + 7) % 7;
    const day = 1 + off + (n - 1) * 7;
    return day <= new Date(y, m + 1, 0).getDate() ? keyOf(new Date(y, m, day)) : null;
  }
  const last = new Date(y, m + 1, 0);
  const off = ((((last.getDay() + 6) % 7) - wd) + 7) % 7;
  const day = last.getDate() - off + (n + 1) * 7;
  return day >= 1 ? keyOf(new Date(y, m, day)) : null;
}

function* candidates(ev, baseKey, fromKey) {
  const r = ev.rrule;
  const iv = r.interval;
  const skip = !r.count; // ohne Zähler darf bis kurz vor den Zeitraum gesprungen werden
  if (r.freq === 'DAILY') {
    let k = baseKey;
    if (skip && fromKey > baseKey) k = addDays(baseKey, Math.max(0, Math.floor(daysBetween(baseKey, fromKey) / iv) - 1) * iv);
    for (;;) { yield k; k = addDays(k, iv); }
  }
  if (r.freq === 'WEEKLY') {
    const days = (r.byday?.length ? r.byday.map((b) => b.wd) : [wdOf(baseKey)]).sort((a, b) => a - b);
    let w = mondayOf(baseKey);
    if (skip && fromKey > baseKey) w = addDays(w, Math.max(0, Math.floor(daysBetween(w, fromKey) / (7 * iv)) - 1) * 7 * iv);
    for (;;) { for (const wd of days) yield addDays(w, wd); w = addDays(w, 7 * iv); }
  }
  const b = parseKey(baseKey);
  if (r.freq === 'MONTHLY') {
    for (let i = 0; ; i += iv) {
      const y = b.getFullYear(), m = b.getMonth() + i;
      if (r.byday?.length) {
        const list = r.byday.map((x) => nthWeekday(new Date(y, m, 1).getFullYear(), new Date(y, m, 1).getMonth(), x.wd, x.n || 1)).filter(Boolean).sort();
        for (const k of list) yield k;
      } else {
        const d = new Date(y, m, b.getDate());
        if (d.getDate() === b.getDate()) yield keyOf(d);
      }
    }
  }
  if (r.freq === 'YEARLY') {
    for (let i = 0; ; i += iv) {
      const d = new Date(b.getFullYear() + i, b.getMonth(), b.getDate());
      if (d.getDate() === b.getDate()) yield keyOf(d);
    }
  }
}

function occurrences(ev, fromKey, toKey) {
  const baseKey = ev.allDay ? ev.start : keyOf(new Date(ev.start));
  if (!ev.rrule) {
    const inst = instanceAt(ev, baseKey);
    return inst.endKey >= fromKey && inst.startKey <= toKey ? [inst] : [];
  }
  const out = [];
  const ex = new Set(ev.exdates || []);
  const r = ev.rrule;
  let count = 0, guard = 0;
  for (const k of candidates(ev, baseKey, fromKey)) {
    if (++guard > 4000 || k > toKey) break;
    if (k < baseKey) continue;
    if (r.until && k > r.until) break;
    count++;
    if (r.count && count > r.count) break;
    if (ex.has(k)) continue;
    const inst = instanceAt(ev, k);
    if (inst.endKey >= fromKey) out.push(inst);
  }
  return out;
}

// Schichten aus dem Stundenplan als Termine
function shiftInstances(fromKey, toKey) {
  const out = [];
  if (state.calShowShifts === false || !state.workEnabled) return out;
  for (const k of range(fromKey, toKey)) {
    const plan = state.plan[k];
    if (!plan?.length) continue;
    const set = new Set(plan);
    for (const i of plan) {
      if (set.has(i - 1)) continue;
      let e = i;
      while (set.has(e + 1)) e++;
      const s = slotStart(k, i), end = slotStart(k, e) + SLOT_MS;
      out.push({ ev: { id: `shift:${k}:${i}`, cal: 'shifts', title: dt('Arbeit', 'Work'), shift: true }, allDay: false, startMs: s, endMs: end, startKey: k, endKey: k });
    }
  }
  return out;
}

function instancesBetween(fromKey, toKey) {
  const visible = new Set(['local', ...state.calendars.filter((c) => c.visible !== false).map((c) => c.id)]);
  const list = [];
  for (const ev of state.calEvents) if (visible.has(ev.cal)) list.push(...occurrences(ev, fromKey, toKey));
  list.push(...shiftInstances(fromKey, toKey));
  list.push(...taskInstances(fromKey, toKey));
  return list.sort((a, b) => (a.startKey !== b.startKey ? (a.startKey < b.startKey ? -1 : 1)
    : a.allDay !== b.allDay ? (a.allDay ? -1 : 1) : (a.startMs || 0) - (b.startMs || 0)));
}

function byDay(list, fromKey, toKey) {
  const map = {};
  for (const inst of list) {
    const a = inst.startKey < fromKey ? fromKey : inst.startKey;
    const b = inst.endKey > toKey ? toKey : inst.endKey;
    for (let k = a; k <= b; k = addDays(k, 1)) (map[k] ||= []).push(inst);
  }
  return map;
}

const colorOf = (inst) => (inst.ev.task ? 'var(--sun)' : inst.ev.shift ? SHIFT_COLOR : inst.ev.color || calOf(inst.ev.cal)?.color || CAL_COLORS[0]);
const timeLabel = (inst, k) => {
  if (inst.allDay) return 'Ganztägig';
  const s = inst.startKey === k ? hhmm(inst.startMs) : '00:00';
  const e = inst.endKey === k ? hhmm(inst.endMs) : '24:00';
  return `${s} – ${e}`;
};

/* ================= Ansicht ================= */

function viewCalendar() {
  if (ui.calMode === 'week') return viewCalendarWeek();
  if (ui.calMode === 'year') return viewCalendarYear();
  const today = todayKey();
  const month = ui.calMonth || today.slice(0, 7);
  const first = `${month}-01`;
  const gridStart = mondayOf(first);
  const gridEnd = addDays(gridStart, 41);
  const sel = ui.calDay || today;
  const list = instancesBetween(gridStart, gridEnd);
  const map = byDay(list, gridStart, gridEnd);
  const selList = sel >= gridStart && sel <= gridEnd ? (map[sel] || []) : byDay(instancesBetween(sel, sel), sel, sel)[sel] || [];
  const title = new Intl.DateTimeFormat(LOCALE(), { month: 'long', year: 'numeric' }).format(parseKey(first));
  const isNow = month === today.slice(0, 7);
  const upcoming = instancesBetween(today, addDays(today, 30)).filter((i) => !i.ev.shift && (i.allDay ? i.endKey >= today : i.endMs > Date.now())).slice(0, 6);

  return `
  ${calHeader(title, isNow, sel)}

  <section class="grid">
    <article class="card s8 fade-in cal-card">
      <div class="cal-grid">
        ${WD.map((d) => `<div class="cal-wd">${d}</div>`).join('')}
        ${range(gridStart, gridEnd).map((k) => {
          const items = map[k] || [];
          const out = !k.startsWith(month);
          return `
          <div class="cal-day ${out ? 'out' : ''} ${k === today ? 'today' : ''} ${k === sel ? 'sel' : ''}" data-action="cal-day" data-day="${k}">
            <span class="cal-num">${parseKey(k).getDate()}</span>
            <div class="cal-items">
              ${items.slice(0, 3).map((i) => `<span class="cal-chip ${i.allDay && !i.ev.task ? 'all' : ''} ${i.ev.task ? 'task' : ''} ${i.ev.done ? 'done' : ''}" style="--c:${colorOf(i)}" title="${esc(i.ev.title)} · ${timeLabel(i, k)}">${i.allDay ? '' : `<b>${i.startKey === k ? hhmm(i.startMs) : '…'}</b>`}${esc(i.ev.title)}</span>`).join('')}
              ${items.length > 3 ? `<span class="cal-more">+${items.length - 3} weitere</span>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </article>

    <div class="col s4">
      <article class="card fade-in">
        <div class="card-head">
          <div><h2>${esc(fmtLong(sel))}</h2><div class="sub">${selList.length ? `${selList.length} ${selList.length === 1 ? 'Eintrag' : 'Einträge'}` : 'Nichts eingetragen'}</div></div>
          <button class="icon-btn" data-action="cal-new" data-day="${sel}" title="Termin an diesem Tag">${icon('plus')}</button>
        </div>
        <div class="agenda">
          ${selList.length ? selList.map((i) => agendaRow(i, sel)).join('') : `<button class="agenda-empty" data-action="cal-new" data-day="${sel}">${icon('calendar-plus')}Termin hinzufügen</button>`}
        </div>
      </article>

      <article class="card fade-in">
        <div class="card-head"><div><h2>Demnächst</h2><div class="sub">Die nächsten 30 Tage</div></div></div>
        <div class="agenda">
          ${upcoming.length ? upcoming.map((i) => agendaRow(i, i.startKey < today ? today : i.startKey, true)).join('') : '<div class="muted">Keine Termine in den nächsten 30 Tagen.</div>'}
        </div>
      </article>

      <article class="card fade-in">
        <div class="card-head"><div><h2>Kalender</h2><div class="sub">Ein- und ausblenden</div></div></div>
        <div class="cal-list">
          ${calRow({ id: 'local', name: 'Meine Termine', color: CAL_COLORS[0] }, true)}
          ${state.workEnabled ? `<label class="cal-src"><input type="checkbox" class="cal-toggle" data-cal="shifts" ${state.calShowShifts === false ? '' : 'checked'}><span class="cal-dot" style="--c:${SHIFT_COLOR}"></span><span class="cal-name">Arbeit aus dem Stundenplan</span></label>` : ''}
          ${state.calendars.map((c) => calRow(c)).join('')}
        </div>
        ${gAccountRow()}
      </article>
    </div>
  </section>`;
}

function agendaRow(i, k, withDate = false) {
  const cal = i.ev.task ? { name: 'Aufgabe' } : i.ev.shift ? { name: 'Stundenplan' } : calOf(i.ev.cal);
  const action = i.ev.task ? 'task-edit' : i.ev.shift ? 'goto' : 'cal-open';
  return `
  <button class="agenda-row ${i.ev.task ? 'is-task' : ''} ${i.ev.done ? 'done' : ''}" style="--c:${colorOf(i)}" data-action="${action}" data-view="schedule" data-id="${esc(i.ev.task ? i.ev.taskId : i.ev.id)}" data-day="${k}">
    <span class="agenda-bar"></span>
    <span class="agenda-time">${withDate ? `<b>${esc(fmtShort(k))}</b>` : ''}${timeLabel(i, k)}</span>
    <span class="agenda-title">${esc(i.ev.title)}${i.ev.location ? `<small>${icon('map-pin')}${esc(i.ev.location)}</small>` : ''}</span>
    <span class="agenda-cal">${esc(cal?.name || '')}</span>
  </button>`;
}

function calRow(c, local = false) {
  // Bei mehreren Google-Konten steht das Konto dabei, sonst nur „Google“
  const gname = c.google && gstat.accounts.length > 1 ? c.gacc : 'Google';
  const synced = c.google ? (c.error ? `<span class="cal-err">${icon('triangle-alert')}Nicht erreichbar</span>` : `${esc(gname)}${c.lastSync ? ` · aktualisiert ${hhmm(c.lastSync)}` : ''}`)
    : c.url ? (c.error ? `<span class="cal-err">${icon('triangle-alert')}Nicht erreichbar</span>` : c.lastSync ? `aktualisiert ${hhmm(c.lastSync)}` : 'wird geladen …') : local ? '' : 'aus Datei';
  return `
  <div class="cal-src">
    <input type="checkbox" class="cal-toggle" data-cal="${esc(c.id)}" ${c.visible === false ? '' : 'checked'} ${local ? 'disabled checked' : ''} aria-label="${esc(c.name)} anzeigen">
    <span class="cal-dot" style="--c:${c.color}"></span>
    <span class="cal-name">${esc(c.name)}<small>${synced}</small></span>
    ${local ? '' : `
      ${c.url ? `<button class="icon-btn small-icon" data-action="cal-sync" data-cal="${esc(c.id)}" title="Jetzt aktualisieren">${icon('refresh-cw')}</button>` : ''}
      ${ui.calConfirm === c.id
        ? `<button class="btn small danger" data-action="cal-remove-yes" data-cal="${esc(c.id)}">Entfernen</button>`
        : `<button class="icon-btn small-icon" data-action="cal-remove" data-cal="${esc(c.id)}" title="Kalender entfernen">${icon('trash-2')}</button>`}`}
  </div>`;
}

/* Termine heute für die Startseite */
function todayEventsCard() {
  const today = todayKey();
  const list = instancesBetween(today, today);
  if (!list.length) return '';
  return `
  <article class="card fade-in">
    <div class="card-head"><div><h2>Termine heute</h2><div class="sub">${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'} im Kalender</div></div>
      <button class="icon-btn" data-action="goto" data-view="calendar" title="Zum Kalender">${icon('calendar-days')}</button></div>
    <div class="agenda">${list.slice(0, 5).map((i) => agendaRow(i, today)).join('')}</div>
  </article>`;
}

/* ================= Termin anlegen und bearbeiten ================= */

function openEventEditor(ev, day, fromMin = null) {
  if (ev && ev.cal !== 'local' && !gWritable(ev.cal)) { openEventInfo(ev, day); return; }
  const now = new Date();
  const cal = ev ? ev.cal : gWritable(state.calLast) ? state.calLast : 'local';
  const h = Math.min(22, now.getHours() + 1);
  ui.calEdit = ev
    ? {
      id: ev.id, title: ev.title, allDay: ev.allDay, note: ev.note || '', location: ev.location || '', color: ev.color || CAL_COLORS[0],
      date: ev.allDay ? ev.start : keyOf(new Date(ev.start)), endDate: ev.allDay ? ev.end : keyOf(new Date(ev.start)),
      from: ev.allDay ? `${pad(h)}:00` : hhmm(ev.start), to: ev.allDay ? `${pad(h + 1)}:00` : hhmm(ev.end), remind: ev.remind ?? '', confirmDelete: false, cal,
    }
    : { id: null, cal, title: '', allDay: false, note: '', location: '', color: CAL_COLORS[0], date: day, endDate: day, from: fromMin !== null ? minLabel(fromMin) : `${pad(h)}:00`, to: fromMin !== null ? minLabel(Math.min(1439, fromMin + 60)) : `${pad(h + 1)}:00`, remind: '', confirmDelete: false };
  renderEventEditor(true);
}

function renderEventEditor(first = false) {
  const e = ui.calEdit;
  const html = `
    <div class="card-head">
      <h2 class="panel-title" style="font-size:20px">${e.id ? 'Termin bearbeiten' : 'Neuer Termin'}</h2>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button>
    </div>
    <div class="field"><label for="ce-title">Titel</label><input class="input" id="ce-title" data-cal-field="title" maxlength="120" placeholder="z. B. Zahnarzt" value="${esc(e.title)}" autocomplete="off"></div>
    <label class="setting" for="ce-allday" style="border:0;padding:0"><div><b>Ganztägig</b></div><input type="checkbox" class="switch" id="ce-allday" data-action="cal-allday" ${e.allDay ? 'checked' : ''}></label>
    <div class="ce-row">
      <div class="field"><label for="ce-date">${e.allDay ? 'Von' : 'Tag'}</label><input class="input" type="date" id="ce-date" data-cal-field="date" value="${e.date}"></div>
      ${e.allDay
        ? `<div class="field"><label for="ce-end">Bis</label><input class="input" type="date" id="ce-end" data-cal-field="endDate" value="${e.endDate}"></div>`
        : `<div class="field"><label for="ce-from">Von</label><input class="input" type="time" id="ce-from" data-cal-field="from" value="${e.from}"></div>
           <div class="field"><label for="ce-to">Bis</label><input class="input" type="time" id="ce-to" data-cal-field="to" value="${e.to}"></div>`}
    </div>
    ${calChoice(e)}
    ${e.allDay || isGoogleCal(e.cal) ? '' : `<div class="field"><label for="ce-remind">Erinnerung</label>
      <select class="input" id="ce-remind" data-cal-field="remind">
        ${[['', `Standard (${state.settings.remindEventsMin} Min. vorher)`], ['0', 'Keine'], ['5', '5 Min. vorher'], ['10', '10 Min. vorher'], ['15', '15 Min. vorher'], ['30', '30 Min. vorher'], ['60', '1 Std. vorher'], ['1440', '1 Tag vorher']]
          .map(([v, l]) => `<option value="${v}" ${String(e.remind) === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select></div>`}
    <div class="field"><label for="ce-loc">Ort</label><input class="input" id="ce-loc" data-cal-field="location" maxlength="120" placeholder="optional" value="${esc(e.location)}"></div>
    <div class="field"><label for="ce-note">Notiz</label><textarea class="input note" id="ce-note" data-cal-field="note" rows="2" maxlength="1000" placeholder="optional">${esc(e.note)}</textarea></div>
    ${isGoogleCal(e.cal) ? '' : `<div class="field"><div class="label">Farbe</div><div class="color-row">${CAL_COLORS.map((c) => `<button class="swatch ${e.color === c ? 'on' : ''}" style="--c:${c}" data-action="cal-color" data-color="${c}" aria-label="Farbe ${c}"></button>`).join('')}</div></div>`}
    ${e.error ? `<div class="error">${e.error}</div>` : ''}
    <div class="modal-foot">
      ${e.id ? (e.confirmDelete
        ? `<div class="btn-row"><span class="error">Termin löschen?</span><button class="btn small danger" data-action="cal-delete-yes">Löschen</button><button class="btn small ghost" data-action="cal-delete-no">Nein</button></div>`
        : `<button class="btn small danger" data-action="cal-delete">${icon('trash-2')}Löschen</button>`) : ''}
      <div class="right">
        <button class="btn ghost" data-action="close-modal">Abbrechen</button>
        <button class="btn primary" data-action="cal-save">${icon('check')}Speichern</button>
      </div>
    </div>`;
  if (first) openPanel(html);
  else {
    const m = document.querySelector('#modal .modal');
    if (m) { m.classList.remove('enter'); m.innerHTML = html; lucide.createIcons(); }
  }
  if (first) document.getElementById('ce-title')?.focus();
}

document.addEventListener('input', (e) => {
  const f = e.target.dataset?.calField;
  if (f && ui.calEdit) ui.calEdit[f] = e.target.value;
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'ce-cal' && ui.calEdit) { ui.calEdit.cal = e.target.value; renderEventEditor(); }
});

// Auswahl, in welchem Kalender der Termin steht (nur wenn Google-Kalender mit Schreibrecht verbunden sind)
function calChoice(e) {
  const google = state.calendars.filter((c) => c.google && c.writable);
  if (!google.length) return '';
  const opts = [{ id: 'local', name: 'Meine Termine' }, ...google];
  return `<div class="field"><label for="ce-cal">${dt('Kalender', 'Calendar')}</label>
    <select class="input" id="ce-cal">${opts.map((c) => `<option value="${esc(c.id)}" ${c.id === e.cal ? 'selected' : ''}>${esc(c.id === 'local' ? 'Meine Termine' : `Google · ${c.name}`)}</option>`).join('')}</select></div>`;
}

function saveEvent() {
  const e = ui.calEdit;
  if (!e) return;
  const title = e.title.trim();
  if (!title) { e.error = 'Gib dem Termin einen Titel.'; renderEventEditor(); return; }
  if (!e.date) { e.error = 'Wähle einen Tag.'; renderEventEditor(); return; }
  let start, end;
  if (e.allDay) {
    start = e.date;
    end = e.endDate && e.endDate >= e.date ? e.endDate : e.date;
  } else {
    start = new Date(`${e.date}T${e.from || '00:00'}`).getTime();
    end = new Date(`${e.date}T${e.to || e.from || '00:00'}`).getTime();
    if (end <= start) end += 86400000; // über Mitternacht
  }
  const data = { cal: e.cal || 'local', title, allDay: e.allDay, start, end, note: e.note.trim(), location: e.location.trim(), color: e.color, remind: e.remind === '' || e.remind === undefined ? null : Number(e.remind) };
  const old = e.id ? state.calEvents.find((x) => x.id === e.id) : null;
  state.calLast = data.cal;
  if (isGoogleCal(data.cal) || (old && isGoogleCal(old.cal))) gSave(old, data);
  else if (old) Object.assign(old, data);
  else state.calEvents.push({ id: `local:${uid()}`, ...data });
  ui.calDay = e.allDay ? start : keyOf(new Date(start));
  ui.calEdit = null;
  save();
  closeModal();
  toast(e.id ? 'Termin gespeichert' : 'Termin eingetragen');
  render('update');
}

function openEventInfo(ev, day) {
  const cal = calOf(ev.cal);
  const inst = instanceAt(ev, day || (ev.allDay ? ev.start : keyOf(new Date(ev.start))));
  openPanel(`
    <div class="card-head">
      <div><div class="eyebrow" style="color:${cal?.color}">${esc(cal?.name || 'Importiert')}</div><h2 class="panel-title" style="font-size:22px">${esc(ev.title)}</h2></div>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button>
    </div>
    <div class="info-list">
      <div>${icon('calendar')}<span>${esc(fmtLong(inst.startKey))}${inst.endKey !== inst.startKey ? ` bis ${esc(fmtLong(inst.endKey))}` : ''}</span></div>
      <div>${icon('clock')}<span>${inst.allDay ? 'Ganztägig' : `${hhmm(inst.startMs)} – ${hhmm(inst.endMs)} Uhr`}</span></div>
      ${ev.rrule ? `<div>${icon('repeat')}<span>Wiederholt sich</span></div>` : ''}
      ${ev.location ? `<div>${icon('map-pin')}<span>${esc(ev.location)}</span></div>` : ''}
      ${ev.note ? `<div>${icon('align-left')}<span class="info-note">${esc(ev.note)}</span></div>` : ''}
    </div>
    <div class="setting-note">${icon('info')}<span>Dieser Termin kommt aus einem importierten Kalender. Ändern kannst du ihn dort, zum Beispiel in Google Kalender.</span></div>
    <div class="modal-foot"><div class="right"><button class="btn primary" data-action="close-modal">Schließen</button></div></div>`, 'narrow');
}

/* ================= Import ================= */

function openImport() {
  ui.calImport = ui.calImport || { url: '', name: '', busy: false, error: '' };
  renderImport(true);
}

function renderImport(first = false) {
  const im = ui.calImport;
  const desktop = !!window.api?.calFetch;
  const html = `
    <div class="card-head">
      <div><h2 class="panel-title" style="font-size:22px">Kalender importieren</h2><div class="sub">Google, Outlook, Apple und alle anderen, die iCal können</div></div>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button>
    </div>
    ${desktop ? '' : '<div class="setting-note">Import ist nur in der Desktop-App verfügbar.</div>'}
    ${gImportOption()}
    <div class="import-opt">
      <div class="import-head">${icon('link')}<div><b>Kalender abonnieren</b><span>Bleibt automatisch aktuell, alle 30 Minuten</span></div></div>
      <div class="field"><label for="ci-url">iCal-Adresse</label><input class="input" id="ci-url" data-imp-field="url" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" value="${esc(im.url)}" autocomplete="off" spellcheck="false"></div>
      <div class="field"><label for="ci-name">Name (optional)</label><input class="input" id="ci-name" data-imp-field="name" placeholder="z. B. Privat" value="${esc(im.name)}" maxlength="40"></div>
      <details class="howto">
        <summary>Wo finde ich die Adresse?</summary>
        <ul>
          <li><b>Google Kalender:</b> Am PC auf calendar.google.com, links beim Kalender auf die drei Punkte, dann „Einstellungen und Freigabe“. Ganz unten „Privatadresse im iCal-Format“ kopieren.</li>
          <li><b>Outlook:</b> Einstellungen, Kalender, „Freigegebene Kalender“, Kalender veröffentlichen und den ICS-Link kopieren.</li>
          <li><b>Apple iCloud:</b> In der Kalender-App beim Kalender auf Teilen, „Öffentlicher Kalender“ einschalten und den Link kopieren.</li>
        </ul>
        <p>Die Adresse ist wie ein Passwort für deinen Kalender. Teile sie mit niemandem.</p>
      </details>
      <button class="btn primary" data-action="cal-subscribe" ${im.busy || !desktop ? 'disabled' : ''}>${im.busy ? '<span class="spinner"></span>Wird geladen …' : `${icon('link')}Abonnieren`}</button>
    </div>
    <div class="import-or"><span>oder</span></div>
    <div class="import-opt">
      <div class="import-head">${icon('file-up')}<div><b>Datei importieren</b><span>Einmaliger Import einer .ics-Datei</span></div></div>
      <p class="import-text">Bei Google: Einstellungen, „Importieren und exportieren“, Exportieren. Die heruntergeladene ZIP-Datei entpacken und die .ics-Datei hier auswählen.</p>
      <button class="btn" data-action="cal-file" ${im.busy || !desktop ? 'disabled' : ''}>${icon('file-up')}.ics-Datei auswählen</button>
    </div>
    ${im.error ? `<div class="error">${esc(im.error)}</div>` : ''}`;
  if (first) openPanel(html, 'wide');
  else {
    const m = document.querySelector('#modal .modal');
    if (m) { m.classList.remove('enter'); m.innerHTML = html; lucide.createIcons(); }
  }
}

document.addEventListener('input', (e) => {
  const f = e.target.dataset?.impField;
  if (f && ui.calImport) ui.calImport[f] = e.target.value;
});

function nextCalColor() {
  const used = new Set(state.calendars.map((c) => c.color));
  return CAL_COLORS.slice(1).find((c) => !used.has(c)) || CAL_COLORS[(state.calendars.length + 1) % CAL_COLORS.length];
}

function addCalendar(text, { url = null, name = '' } = {}) {
  const id = `cal${uid()}`;
  const parsed = parseICS(text, id);
  if (!parsed.events.length && !/BEGIN:VCALENDAR/.test(text)) throw new Error('Das ist keine Kalender-Datei.');
  const cal = { id, name: name.trim() || parsed.name || (url ? 'Abonnierter Kalender' : 'Importierter Kalender'), color: nextCalColor(), url, visible: true, lastSync: Date.now() };
  state.calendars.push(cal);
  state.calEvents.push(...parsed.events);
  save();
  return { cal, count: parsed.events.length };
}

async function subscribeCalendar() {
  const im = ui.calImport;
  const url = im.url.trim().replace(/^webcal:/i, 'https:');
  if (!/^https?:\/\//i.test(url)) { im.error = 'Bitte eine Adresse eingeben, die mit https:// oder webcal:// beginnt.'; renderImport(); return; }
  if (state.calendars.some((c) => c.url === url)) { im.error = 'Diesen Kalender hast du schon abonniert.'; renderImport(); return; }
  im.busy = true; im.error = ''; renderImport();
  try {
    const text = await window.api.calFetch(url);
    const { cal, count } = addCalendar(text, { url, name: im.name });
    ui.calImport = null;
    closeModal();
    toast(`„${cal.name}“ abonniert, ${count} Termine`);
    render('update');
  } catch (err) {
    im.busy = false;
    im.error = 'Der Kalender konnte nicht geladen werden. Prüf die Adresse und deine Internetverbindung.';
    renderImport();
  }
}

async function importCalendarFile() {
  const im = ui.calImport;
  try {
    const r = await window.api.calFile();
    if (!r) return;
    const { cal, count } = addCalendar(r.text, { name: im.name || r.name.replace(/\.ics$/i, '') });
    ui.calImport = null;
    closeModal();
    toast(`${count} Termine aus „${cal.name}“ importiert`);
    render('update');
  } catch {
    im.error = 'Die Datei konnte nicht gelesen werden. Wähle eine .ics-Datei aus.';
    renderImport();
  }
}

async function syncCalendar(cal) {
  if (!cal.url || !window.api?.calFetch) return;
  try {
    const text = await window.api.calFetch(cal.url);
    const parsed = parseICS(text, cal.id);
    state.calEvents = state.calEvents.filter((e) => e.cal !== cal.id).concat(parsed.events);
    cal.lastSync = Date.now();
    delete cal.error;
  } catch {
    cal.error = true;
  }
  save();
  if (ui.view === 'calendar' && !ui.modal && !ui.panel) render('update');
}

function syncAllCalendars() {
  for (const c of state.calendars) if (c.url) syncCalendar(c);
}

document.addEventListener('change', (e) => {
  if (!e.target.matches('.cal-toggle')) return;
  const id = e.target.dataset.cal;
  if (id === 'shifts') state.calShowShifts = e.target.checked;
  else { const c = state.calendars.find((x) => x.id === id); if (c) c.visible = e.target.checked; }
  save();
  render('update');
});


/* ================= Jahresansicht ================= */

/* Zwölf kleine Monate: farbige Punkte für die Termine des Tages, je voller ein Tag, desto stärker hinterlegt.
   Klick wählt den Tag (rechts stehen seine Einträge), Doppelklick oder Klick auf den Monatsnamen öffnet den Monat.
   Schichten aus dem Stundenplan zählen hier nicht mit, sonst wäre jeder Arbeitstag voll. */
function viewCalendarYear() {
  const today = todayKey();
  const year = ui.calYear || Number(today.slice(0, 4));
  const from = `${year}-01-01`, to = `${year}-12-31`;
  const list = instancesBetween(from, to).filter((i) => !i.ev.shift);
  const map = byDay(list, from, to);
  const sel = ui.calDay && ui.calDay.startsWith(String(year)) ? ui.calDay : (today.startsWith(String(year)) ? today : from);
  const selList = byDay(instancesBetween(sel, sel), sel, sel)[sel] || [];
  const isNow = year === Number(today.slice(0, 4));
  const monthName = (m, style = 'long') => new Intl.DateTimeFormat(LOCALE(), { month: style }).format(new Date(year, m, 1));
  const perMonth = Array.from({ length: 12 }, (_, m) => {
    const p = `${year}-${pad(m + 1)}`;
    return Object.entries(map).reduce((n, [k, v]) => n + (k.startsWith(p) ? v.length : 0), 0);
  });
  const maxMonth = Math.max(1, ...perMonth);
  const events = list.filter((i) => !i.ev.task).length, tasks = list.filter((i) => i.ev.task).length;

  const months = Array.from({ length: 12 }, (_, m) => {
    const first = `${year}-${pad(m + 1)}-01`;
    const days = new Date(year, m + 1, 0).getDate();
    const lead = wdOf(first);
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span class="yd out"></span>');
    for (let d = 1; d <= days; d++) {
      const k = `${year}-${pad(m + 1)}-${pad(d)}`;
      const items = map[k] || [];
      const heat = Math.min(3, items.length);
      const dots = items.slice(0, 3).map((i) => `<i style="--c:${colorOf(i)}"></i>`).join('');
      const tip = items.length ? `${fmtShort(k)}: ${items.slice(0, 4).map((i) => i.ev.title).join(', ')}${items.length > 4 ? ' …' : ''}` : fmtShort(k);
      cells.push(`<button class="yd h${heat} ${k === today ? 'today' : ''} ${k === sel ? 'sel' : ''} ${wdOf(k) > 4 ? 'we' : ''}" data-action="cal-yday" data-day="${k}" title="${esc(tip)}">${d}${dots ? `<span class="yd-dots">${dots}</span>` : ''}</button>`);
    }
    const now = today.slice(0, 7) === first.slice(0, 7);
    return `
    <div class="ym ${now ? 'now' : ''}" style="--i:${m}">
      <button class="ym-head" data-action="cal-ymonth" data-month="${first.slice(0, 7)}" title="${dt('Monat öffnen', 'Open month')}"><b>${esc(monthName(m))}</b>${perMonth[m] ? `<small>${perMonth[m]}</small>` : ''}</button>
      <div class="ym-grid">${WD.map((w) => `<span class="ym-wd">${esc(tr(w).slice(0, 2))}</span>`).join('')}${cells.join('')}</div>
    </div>`;
  }).join('');

  return `
  ${calHeader(String(year), isNow, sel)}

  <section class="grid">
    <article class="card s8 fade-in cal-card year-card">
      <div class="year-grid">${months}</div>
    </article>

    <div class="col s4">
      <article class="card fade-in">
        <div class="card-head">
          <div><h2>${esc(fmtLong(sel))}</h2><div class="sub">${selList.length ? `${selList.length} ${selList.length === 1 ? 'Eintrag' : 'Einträge'}` : 'Nichts eingetragen'}</div></div>
          <button class="icon-btn" data-action="cal-new" data-day="${sel}" title="Termin an diesem Tag">${icon('plus')}</button>
        </div>
        <div class="agenda">
          ${selList.length ? selList.map((i) => agendaRow(i, sel)).join('') : `<button class="agenda-empty" data-action="cal-new" data-day="${sel}">${icon('calendar-plus')}Termin hinzufügen</button>`}
        </div>
      </article>

      <article class="card fade-in">
        <div class="card-head"><div><h2>${dt('Dein Jahr', 'Your year')}</h2><div class="sub">${dt(`${events} Termine und ${tasks} Aufgaben mit Datum`, `${events} events and ${tasks} dated tasks`)}</div></div><div class="icon-btn">${icon('calendar-range')}</div></div>
        <div class="yr-bars">${perMonth.map((n, m) => `
          <button class="yr-bar ${isNow && m === new Date().getMonth() ? 'now' : ''}" data-action="cal-ymonth" data-month="${year}-${pad(m + 1)}" title="${esc(monthName(m))}: ${n}">
            <span class="yr-track"><i data-anim="h" style="height:${n ? 8 + (n / maxMonth) * 92 : 0}%"></i></span>
            <small>${esc(monthName(m, 'narrow'))}</small>
          </button>`).join('')}</div>
      </article>
    </div>
  </section>`;
}

/* ================= Wochenansicht mit Zeitleiste ================= */

const HOUR_PX = 48;
const minutesOf = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
const minLabel = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

function calHeader(title, isNow, sel) {
  const week = ui.calMode === 'week', year = ui.calMode === 'year';
  const prev = year ? dt('Voriges Jahr', 'Previous year') : week ? 'Vorige Woche' : 'Voriger Monat';
  const next = year ? dt('Nächstes Jahr', 'Next year') : week ? 'Nächste Woche' : 'Nächster Monat';
  return `
  <header class="head fade-in">
    <div><div class="eyebrow">${esc(title)}</div><h1>Kalender</h1></div>
    <div class="head-actions">
      <div class="segmented" aria-label="Ansicht">
        <button class="${year ? 'on' : ''}" data-action="cal-mode" data-mode="year">${dt('Jahr', 'Year')}</button>
        <button class="${week || year ? '' : 'on'}" data-action="cal-mode" data-mode="month">Monat</button>
        <button class="${week ? 'on' : ''}" data-action="cal-mode" data-mode="week">Woche</button>
      </div>
      <div class="week-nav">
        <button class="icon-btn" data-action="cal-month" data-dir="-1" aria-label="${prev}">${icon('chevron-left')}</button>
        ${navNowBtn('cal-month', year ? String(ui.calYear || new Date().getFullYear()) : week ? navWeekLabel(ui.calWeek || mondayOf(todayKey())) : navMonthLabel(ui.calMonth || todayKey().slice(0, 7)), isNow, dt('Zu heute', 'Go to today'))}
        <button class="icon-btn" data-action="cal-month" data-dir="1" aria-label="${next}">${icon('chevron-right')}</button>
      </div>
      <button class="btn" data-action="cal-import">${icon('calendar-plus')}Kalender importieren</button>
      <button class="btn primary" data-action="cal-new" data-day="${sel}">${icon('plus')}Termin</button>
    </div>
  </header>`;
}

// Überlappende Termine eines Tages nebeneinander in Spalten anordnen
function layoutDay(items, k) {
  const blocks = items.map((i) => {
    const s = i.startKey < k ? 0 : minutesOf(i.startMs);
    const e = i.endKey > k ? 1440 : (minutesOf(i.endMs) || 1440);
    return { i, s, e: Math.max(e, s + 15) };
  }).sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const cols = [];
    for (const b of cluster) {
      let c = cols.findIndex((end) => end <= b.s);
      if (c < 0) { c = cols.length; cols.push(b.e); } else cols[c] = b.e;
      b.col = c;
    }
    for (const b of cluster) b.cols = cols.length;
    out.push(...cluster);
    cluster = [];
  };
  for (const b of blocks) {
    if (cluster.length && b.s >= clusterEnd) flush();
    if (!cluster.length) clusterEnd = b.e;
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.e);
  }
  if (cluster.length) flush();
  return out;
}

function weekBlock(b, k) {
  const ev = b.i.ev;
  const movable = ev.task || ((ev.cal === 'local' || gWritable(ev.cal)) && b.i.startKey === b.i.endKey);
  const top = (b.s / 60) * HOUR_PX;
  const height = Math.max(20, ((b.e - b.s) / 60) * HOUR_PX - 2);
  const id = ev.task ? ev.taskId : ev.id;
  return `
  <div class="wk-ev ${ev.task ? 'task' : ''} ${ev.done ? 'done' : ''} ${movable ? 'movable' : ''} ${height < 34 ? 'short' : ''}"
    style="--c:${colorOf(b.i)};top:${top}px;height:${height}px;left:calc(${(b.col / b.cols) * 100}% + 2px);width:calc(${100 / b.cols}% - 4px)"
    data-id="${esc(id)}" data-kind="${ev.task ? 'task' : 'event'}" data-day="${k}" data-s="${b.s}" data-e="${b.e}"
    ${movable ? '' : `data-action="cal-open"`} title="${esc(ev.title)} · ${minLabel(b.s)} – ${minLabel(b.e)}">
    <b>${esc(ev.title)}</b><span class="wk-ev-time">${minLabel(b.s)} – ${minLabel(b.e)}</span>
    ${movable && !ev.task ? '<span class="wk-resize" aria-hidden="true"></span>' : ''}
  </div>`;
}

function viewCalendarWeek() {
  const today = todayKey();
  const ws = ui.calWeek || mondayOf(ui.calDay || today);
  const days = range(ws, addDays(ws, 6));
  const list = instancesBetween(ws, days[6]);
  const map = byDay(list, ws, days[6]);
  const nowD = new Date();
  const nowMin = nowD.getHours() * 60 + nowD.getMinutes();
  const title = `KW ${isoWeek(ws)} · ${fmtShort(ws)} – ${fmtShort(days[6])}`;
  return `
  ${calHeader(title, ws === mondayOf(today), ui.calDay || today)}
  <section class="grid">
    <article class="card s12 fade-in cal-card wk-card">
      <div class="wk-grid wk-head">
        <div></div>
        ${days.map((k) => `<div class="wk-dayhead ${k === today ? 'today' : ''}"><span>${WD[wdOf(k)]}</span><b>${parseKey(k).getDate()}</b></div>`).join('')}
      </div>
      <div class="wk-grid wk-allday">
        <div class="wk-allday-label">ganztägig</div>
        ${days.map((k) => `<div class="wk-allcell">${(map[k] || []).filter((i) => i.allDay).map((i) => `
          <button class="cal-chip ${i.ev.task ? 'task' : 'all'} ${i.ev.done ? 'done' : ''}" style="--c:${colorOf(i)}"
            data-action="${i.ev.task ? 'task-edit' : 'cal-open'}" data-id="${esc(i.ev.task ? i.ev.taskId : i.ev.id)}" data-day="${k}">${esc(i.ev.title)}</button>`).join('')}</div>`).join('')}
      </div>
      <div class="wk-scroll" id="wk-scroll">
        <div class="wk-grid wk-body" style="height:${24 * HOUR_PX}px">
          <div class="wk-times">${Array.from({ length: 24 }, (_, h) => `<div class="wk-time" style="top:${h * HOUR_PX}px">${h ? `${pad(h)}:00` : ''}</div>`).join('')}</div>
          ${days.map((k, di) => {
            const timed = (map[k] || []).filter((i) => !i.allDay);
            const shifts = timed.filter((i) => i.ev.shift);
            return `
            <div class="wk-col ${k === today ? 'today' : ''}" data-day="${k}" data-di="${di}">
              ${shifts.map((i) => { const s = minutesOf(i.startMs), e = minutesOf(i.endMs) || 1440; return `<div class="wk-shift" style="top:${(s / 60) * HOUR_PX}px;height:${((e - s) / 60) * HOUR_PX}px"><span>${icon('briefcase')}Arbeit ${minLabel(s)} – ${minLabel(e)}</span></div>`; }).join('')}
              ${layoutDay(timed.filter((i) => !i.ev.shift), k).map((b) => weekBlock(b, k)).join('')}
              ${k === today ? `<div class="now-line" style="top:${(nowMin / 60) * HOUR_PX}px"><span>${pad(nowD.getHours())}:${pad(nowD.getMinutes())}</span></div>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="wk-hint">${icon('mouse-pointer-click')}Klick in eine freie Stelle legt einen Termin an. Eigene Termine kannst du verschieben und unten an der Kante länger oder kürzer ziehen.</div>
    </article>
  </section>`;
}

// Nach dem Zeichnen: Wochenansicht zur passenden Uhrzeit scrollen
function afterRender(mode) {
  const sc = document.getElementById('wk-scroll');
  if (!sc) return;
  if (mode === 'update' && ui.wkScroll !== undefined) sc.scrollTop = ui.wkScroll;
  else sc.scrollTop = Math.max(0, (Math.min(new Date().getHours(), 17) - 2) * HOUR_PX);
  ui.wkScroll = sc.scrollTop;
}
document.addEventListener('scroll', (e) => { if (e.target.id === 'wk-scroll') ui.wkScroll = e.target.scrollTop; }, true);

/* Ziehen: verschieben (auch auf andere Tage) und Länge ändern. Die Box hebt sich schon beim Anfassen an und folgt der Maus
   frei. Wo sie landet (in 15-Minuten-Schritten), zeigt ein gestrichelter Rahmen, der weich mitspringt. Beim Loslassen
   gleitet die Box in diesen Rahmen. */
let wkDrag = null;
const wkSnap = (min) => Math.round(min / 15) * 15;

document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.wk-ev.movable');
  if (!el || e.button !== 0 || wkDrag) return;
  e.preventDefault();
  const col = el.closest('.wk-col');
  const cols = [...document.querySelectorAll('.wk-col')];
  const colW = cols.length > 1 ? cols[1].getBoundingClientRect().left - cols[0].getBoundingClientRect().left : col.offsetWidth;
  const mode = e.target.closest('.wk-resize') ? 'resize' : 'move';
  wkDrag = {
    el, mode, x: e.clientX, y: e.clientY, col,
    s: Number(el.dataset.s), e: Number(el.dataset.e), di: Number(col.dataset.di), colW, moved: false, dMin: 0, dDay: 0,
  };
  // Sofort beim Anfassen etwas größer werden
  el.classList.add('grabbed');
  if (mode === 'move') el.classList.add('lifted');
  try { el.setPointerCapture(e.pointerId); } catch { /* nicht jedes Zeigegerät unterstützt das */ }
});

function wkGhost(d) {
  const g = document.createElement('div');
  g.className = 'wk-snap';
  g.style.cssText = `top:${d.el.style.top};height:${d.el.style.height};left:${d.el.style.left};width:${d.el.style.width};--c:${d.el.style.getPropertyValue('--c')}`;
  d.col.appendChild(g);
  return g;
}

document.addEventListener('pointermove', (e) => {
  const d = wkDrag;
  if (!d || d.landing) return;
  const dx = e.clientX - d.x, dy = e.clientY - d.y;
  if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
  if (!d.moved) { d.moved = true; d.el.classList.add('dragging'); d.snap = wkGhost(d); }
  const timeEl = d.el.querySelector('.wk-ev-time');
  if (d.mode === 'move') {
    // Frei mitgehen, nur an den Rändern der Woche und des Tages begrenzt
    const fx = Math.max(-d.di * d.colW, Math.min((6 - d.di) * d.colW, dx));
    const fy = Math.max((-d.s / 60) * HOUR_PX, Math.min(((1440 - d.e) / 60) * HOUR_PX, dy));
    d.el.style.transform = `translate(${fx}px, ${fy}px)`;
    const dMin = Math.max(-d.s, Math.min(1440 - d.e, wkSnap((fy / HOUR_PX) * 60)));
    const dDay = Math.round(fx / d.colW);
    if (dMin !== d.dMin || dDay !== d.dDay) {
      d.dMin = dMin; d.dDay = dDay;
      d.snap.style.transform = `translate(${dDay * d.colW}px, ${(dMin / 60) * HOUR_PX}px)`;
      timeEl.textContent = `${minLabel(d.s + dMin)} – ${minLabel(d.e + dMin)}`;
    }
  } else {
    const rawEnd = Math.max(d.s + 15, Math.min(1440, d.e + (dy / HOUR_PX) * 60));
    d.el.style.height = `${Math.max(20, ((rawEnd - d.s) / 60) * HOUR_PX - 2)}px`;
    const ne = Math.max(d.s + 15, Math.min(1440, wkSnap(rawEnd)));
    if (ne - d.e !== d.dMin) {
      d.dMin = ne - d.e;
      d.snap.style.height = `${Math.max(20, ((ne - d.s) / 60) * HOUR_PX - 2)}px`;
      timeEl.textContent = `${minLabel(d.s)} – ${minLabel(ne)}`;
    }
  }
});

document.addEventListener('pointerup', () => {
  const d = wkDrag;
  if (!d || d.landing) return;
  const { id, kind, day } = d.el.dataset;
  if (!d.moved) {
    wkDrag = null;
    d.el.classList.remove('lifted');
    setTimeout(() => d.el.classList.remove('grabbed'), 250);
    if (kind === 'task') openTaskEditor(id);
    else { const ev = state.calEvents.find((x) => x.id === id); if (ev) openEventEditor(ev, day); }
    return;
  }
  // In den Rahmen gleiten und dabei wieder auf normale Größe gehen, erst danach speichern und neu zeichnen
  d.landing = true;
  d.el.classList.remove('lifted');
  d.el.classList.add('landing');
  if (d.mode === 'move') d.el.style.transform = `translate(${d.dDay * d.colW}px, ${(d.dMin / 60) * HOUR_PX}px)`;
  else d.el.style.height = d.snap.style.height;
  d.snap.classList.add('gone');
  setTimeout(() => wkCommit(d, id, kind, day), 330);
});

function wkCommit(d, id, kind, day) {
  wkDrag = null;
  const newDay = addDays(day, d.dDay);
  if (kind === 'task') {
    const t = state.tasks.find((x) => x.id === id);
    if (t) { t.due = newDay; t.time = minLabel(d.s + d.dMin); }
  } else {
    const ev = state.calEvents.find((x) => x.id === id);
    if (ev) {
      const start = parseKey(d.mode === 'move' ? newDay : day);
      start.setMinutes(d.mode === 'move' ? d.s + d.dMin : d.s);
      const len = d.mode === 'move' ? d.e - d.s : d.e + d.dMin - d.s;
      ev.start = start.getTime();
      ev.end = ev.start + len * 60000;
      gMoved(ev);
    }
  }
  save();
  toast(d.mode === 'move'
    ? `Verschoben auf ${new Intl.DateTimeFormat(LOCALE(), { weekday: 'short', day: 'numeric', month: 'short' }).format(parseKey(newDay))}, ${minLabel(d.s + d.dMin)}`
    : `Neue Dauer bis ${minLabel(d.e + d.dMin)}`);
  render('update');
}

// Klick auf eine freie Stelle der Zeitleiste: neuer Termin zur halben Stunde
document.addEventListener('click', (e) => {
  const col = e.target.closest('.wk-col');
  if (!col || e.target.closest('.wk-ev')) return;
  const y = e.clientY - col.getBoundingClientRect().top;
  const min = Math.max(0, Math.min(1410, Math.floor(((y / HOUR_PX) * 60) / 30) * 30));
  openEventEditor(null, col.dataset.day, min);
});

/* ================= Aktionen ================= */

function calendarAction(a, el) {
  switch (a) {
    case 'cal-mode': {
      const from = ui.calMode;
      ui.calMode = el.dataset.mode;
      // Aus der Jahresansicht kommend: im gewählten Tag des Jahres weitermachen
      const anchor = from === 'year' ? (ui.calDay && ui.calDay.startsWith(String(ui.calYear)) ? ui.calDay : `${ui.calYear}-01-01`)
        : from === 'week' ? ui.calWeek : ui.calDay || (ui.calMonth ? `${ui.calMonth}-01` : null);
      const k = anchor || todayKey();
      if (ui.calMode === 'week') ui.calWeek = mondayOf(ui.calDay && from !== 'year' ? ui.calDay : k);
      else if (ui.calMode === 'year') ui.calYear = Number(k.slice(0, 4));
      else ui.calMonth = k.slice(0, 7);
      ui.wkScroll = undefined;
      render('enter');
      return true;
    }
    case 'cal-month': {
      const dir = Number(el.dataset.dir);
      if (ui.calMode === 'year') {
        const from = ui.calYear || new Date().getFullYear();
        ui.calYear = dir === 0 ? new Date().getFullYear() : from + dir;
        if (dir === 0) ui.calDay = todayKey();
        slideRender(slideDir(from, ui.calYear));
        return true;
      }
      if (ui.calMode === 'week') {
        const from = ui.calWeek || mondayOf(todayKey());
        ui.calWeek = dir === 0 ? mondayOf(todayKey()) : addDays(from, dir * 7);
        if (dir === 0) ui.calDay = todayKey();
        slideRender(slideDir(from, ui.calWeek));
        return true;
      }
      const [y, mo] = (ui.calMonth || todayKey().slice(0, 7)).split('-').map(Number);
      const d = dir === 0 ? new Date() : new Date(y, mo - 1 + dir, 1);
      const from = `${y}-${pad(mo)}`;
      ui.calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      if (dir === 0) ui.calDay = todayKey();
      slideRender(slideDir(from, ui.calMonth));
      return true;
    }
    case 'cal-day': {
      // Zweiter Klick kurz nach dem ersten auf denselben Tag: neuer Termin
      const d = el.dataset.day, now = Date.now();
      if (ui.calLastClick?.day === d && now - ui.calLastClick.t < 450) { ui.calLastClick = null; openEventEditor(null, d); return true; }
      ui.calLastClick = { day: d, t: now };
      if (ui.calDay !== d) { ui.calDay = d; render('update'); }
      return true;
    }
    case 'cal-yday': {
      // Klick wählt den Tag, ein zweiter Klick kurz danach öffnet seinen Monat
      const d = el.dataset.day, now = Date.now();
      if (ui.calLastClick?.day === d && now - ui.calLastClick.t < 450) {
        ui.calLastClick = null; ui.calDay = d; ui.calMonth = d.slice(0, 7); ui.calMode = 'month'; render('enter'); return true;
      }
      ui.calLastClick = { day: d, t: now };
      if (ui.calDay !== d) { ui.calDay = d; render('update'); }
      return true;
    }
    case 'cal-ymonth': {
      const m = el.dataset.month;
      ui.calMonth = m; ui.calMode = 'month';
      if (!(ui.calDay || '').startsWith(m)) ui.calDay = todayKey().startsWith(m) ? todayKey() : `${m}-01`;
      render('enter');
      return true;
    }
    case 'cal-new': openEventEditor(null, el.dataset.day || ui.calDay || todayKey()); return true;
    case 'cal-open': {
      const ev = state.calEvents.find((x) => x.id === el.dataset.id);
      if (ev) openEventEditor(ev, el.dataset.day);
      return true;
    }
    case 'cal-allday': ui.calEdit.allDay = el.checked; renderEventEditor(); return true;
    case 'cal-color': ui.calEdit.color = el.dataset.color; renderEventEditor(); return true;
    case 'cal-save': saveEvent(); return true;
    case 'cal-delete': ui.calEdit.confirmDelete = true; renderEventEditor(); return true;
    case 'cal-delete-no': ui.calEdit.confirmDelete = false; renderEventEditor(); return true;
    case 'cal-delete-yes': {
      const ev = state.calEvents.find((x) => x.id === ui.calEdit.id);
      if (ev && isGoogleCal(ev.cal)) gRemove(ev);
      else state.calEvents = state.calEvents.filter((x) => x.id !== ui.calEdit.id);
      ui.calEdit = null; save(); closeModal(); toast('Termin gelöscht'); render('update');
      return true;
    }
    case 'cal-import': openImport(); return true;
    case 'cal-subscribe': subscribeCalendar(); return true;
    case 'cal-file': importCalendarFile(); return true;
    case 'cal-sync': { const c = state.calendars.find((x) => x.id === el.dataset.cal); if (c) { toast('Wird aktualisiert …'); syncCalendar(c); } return true; }
    case 'cal-remove': ui.calConfirm = el.dataset.cal; render('update'); return true;
    case 'cal-remove-yes': {
      const id = el.dataset.cal;
      // Google-Kalender bleiben beim nächsten Abgleich draußen
      const gc = state.calendars.find((c) => c.id === id && c.google);
      if (gc) state.google = { ...(state.google || {}), skip: [...(state.google?.skip || []), `${gc.gacc}|${gc.google}`] };
      state.calendars = state.calendars.filter((c) => c.id !== id);
      state.calEvents = state.calEvents.filter((e) => e.cal !== id);
      ui.calConfirm = null; save(); toast('Kalender entfernt'); render('update');
      return true;
    }
  }
  return false;
}

