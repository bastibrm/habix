'use strict';

/* Google Kalender: nach der Anmeldung erscheinen die eigenen Google-Kalender in Habix und bleiben live aktuell
   (jede Minute und sobald das Fenster wieder nach vorne kommt). Termine in Kalendern, in die man schreiben darf,
   lassen sich in Habix anlegen, ändern, verschieben und löschen, die Änderung geht sofort an Google.
   Serien liefert Google schon als einzelne Termine (singleEvents), geändert wird immer nur der eine Termin.
   Mehrere Google-Konten gehen gleichzeitig, verwaltet in den Einstellungen.
   Kalender in state.calendars: { id: 'g…', google: '<Google-ID>', gacc: '<E-Mail des Kontos>', name, color, visible, writable, lastSync } */

const gstat = { configured: false, accounts: [], busy: false };
const gPending = {}; // laufende Änderungen je Kalender: so lange wird nicht überschrieben, sonst springt der Termin zurück
let gLastSync = 0;

const isGoogleCal = (id) => !!state.calendars.find((c) => c.id === id && c.google);
const gWritable = (id) => !!state.calendars.find((c) => c.id === id && c.google && c.writable);
const gHash = (s) => { let h = 5381; for (const ch of s) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return h.toString(36); };
const gPath = (cal, rest = '') => `/calendars/${encodeURIComponent(cal.google)}/events${rest}`;
const gCalsOf = (acc) => state.calendars.filter((c) => c.google && c.gacc === acc);

async function gApi(acc, method, p, body) {
  const r = await window.api.googleApi(acc, method, p, body);
  if (r.error === 'signed-out') { gSignedOut(acc); throw new Error('signed-out'); }
  if (!r.ok) throw new Error(r.json?.error?.message || r.error || `HTTP ${r.status}`);
  return r.json;
}

async function gInit() {
  if (!window.api?.googleStatus) return;
  Object.assign(gstat, await window.api.googleStatus());
  // Kalender aus der Zeit mit nur einem Konto gehören dem ersten Konto
  for (const c of state.calendars) if (c.google && !c.gacc && gstat.accounts[0]) c.gacc = gstat.accounts[0];
  gSyncAll(true);
}

async function gConnect() {
  if (gstat.busy) { window.api.googleCancel(); return; }
  gstat.busy = true; gRefreshUi(true);
  const r = await window.api.googleLogin();
  gstat.busy = false;
  if (!r.ok) {
    gRefreshUi(true);
    if (r.error === 'not-configured') toast(dt('Die Google-Anmeldung ist in dieser Version noch nicht eingerichtet.', 'Google sign-in is not set up in this version yet.'));
    else if (r.error !== 'cancelled') toast(dt('Die Anmeldung bei Google hat nicht geklappt.', 'Signing in to Google did not work.'));
    return;
  }
  const again = gstat.accounts.includes(r.email);
  if (!again) gstat.accounts.push(r.email);
  if (ui.calImport) { ui.calImport = null; closeModal(); }
  await gSyncAll(true);
  toast(again ? dt(`${r.email} ist neu angemeldet.`, `${r.email} is signed in again.`)
    : dt(`${r.email} ist verbunden. Die Kalender sind jetzt in Habix.`, `${r.email} is connected. Its calendars are now in Habix.`));
}

async function gDisconnect(acc) {
  await window.api.googleLogout(acc);
  gSignedOut(acc);
  toast(dt(`${acc} abgemeldet`, `${acc} signed out`));
}

// Ein Konto ist weg (selbst abgemeldet oder Zugang bei Google widerrufen): seine Kalender raus, alles andere bleibt
function gSignedOut(acc) {
  const ids = new Set(gCalsOf(acc).map((c) => c.id));
  gstat.accounts = gstat.accounts.filter((a) => a !== acc);
  state.calendars = state.calendars.filter((c) => !ids.has(c.id));
  state.calEvents = state.calEvents.filter((e) => !ids.has(e.cal));
  if (state.google?.skip) state.google.skip = state.google.skip.filter((s) => !s.startsWith(`${acc}|`));
  if (ui.gConfirm === acc) ui.gConfirm = null;
  save();
  gRefreshUi(true);
}

// Kalenderliste eines Kontos von Google übernehmen: neue dazu, gelöschte raus, Namen aktuell halten
async function gLoadCalendars(acc) {
  const list = await gApi(acc, 'GET', '/users/me/calendarList?minAccessRole=reader&maxResults=250');
  const skip = new Set(state.google?.skip || []);
  const seen = new Set();
  for (const it of list.items || []) {
    if (skip.has(`${acc}|${it.id}`)) continue;
    seen.add(it.id);
    const name = it.summaryOverride || it.summary || 'Google';
    const writable = it.accessRole === 'owner' || it.accessRole === 'writer';
    const cal = state.calendars.find((c) => c.google === it.id && c.gacc === acc);
    if (cal) Object.assign(cal, { name, writable });
    else state.calendars.push({ id: `g${gHash(`${acc}|${it.id}`)}`, google: it.id, gacc: acc, name, color: it.backgroundColor || nextCalColor(), visible: it.selected !== false, writable, primary: !!it.primary });
  }
  const gone = new Set(gCalsOf(acc).filter((c) => !seen.has(c.google)).map((c) => c.id));
  if (gone.size) {
    state.calendars = state.calendars.filter((c) => !gone.has(c.id));
    state.calEvents = state.calEvents.filter((e) => !gone.has(e.cal));
  }
}

const gStrip = (html) => String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

function gToEvent(cal, g) {
  const allDay = !!g.start?.date;
  let start, end;
  if (allDay) {
    start = g.start.date;
    end = g.end?.date ? addDays(g.end.date, -1) : start; // Google zählt das Ende ganztägiger Termine exklusiv
    if (end < start) end = start;
  } else {
    start = Date.parse(g.start?.dateTime);
    end = g.end?.dateTime ? Date.parse(g.end.dateTime) : start + 3600000;
  }
  return { id: `${cal.id}:${g.id}`, cal: cal.id, gid: g.id, title: g.summary || dt('(Ohne Titel)', '(No title)'), allDay, start, end,
    note: gStrip(g.description).slice(0, 2000), location: g.location || '' };
}

// Termine eines Kalenders holen: ein Jahr zurück bis zwei Jahre voraus, damit auch die Jahresansicht stimmt
async function gSync(cal) {
  const today = todayKey();
  const from = new Date(parseKey(`${Number(today.slice(0, 4)) - 1}-01-01`)).toISOString();
  const to = new Date(parseKey(`${Number(today.slice(0, 4)) + 2}-01-01`)).toISOString();
  const events = [];
  let page = '';
  do {
    const q = new URLSearchParams({ singleEvents: 'true', timeMin: from, timeMax: to, maxResults: '2500', ...(page ? { pageToken: page } : {}) });
    const r = await gApi(cal.gacc, 'GET', gPath(cal, `?${q}`));
    for (const g of r.items || []) if (g.status !== 'cancelled' && (g.start?.date || g.start?.dateTime)) events.push(gToEvent(cal, g));
    page = r.nextPageToken || '';
  } while (page && events.length < 20000);
  if (gPending[cal.id]) return false; // während einer Änderung nicht dazwischenfunken, der nächste Abgleich holt es nach
  const before = state.calEvents.filter((e) => e.cal === cal.id);
  const changed = JSON.stringify(before) !== JSON.stringify(events);
  if (changed) state.calEvents = state.calEvents.filter((e) => e.cal !== cal.id).concat(events);
  cal.lastSync = Date.now();
  delete cal.error;
  return changed;
}

async function gSyncAll(withList = false) {
  if (!window.api?.googleApi || gSyncAll.running) return;
  gSyncAll.running = true;
  gLastSync = Date.now();
  let changed = false;
  // Kalender von Konten, die es nicht mehr gibt, räumen
  const orphan = new Set(state.calendars.filter((c) => c.google && !gstat.accounts.includes(c.gacc)).map((c) => c.id));
  if (orphan.size) {
    state.calendars = state.calendars.filter((c) => !orphan.has(c.id));
    state.calEvents = state.calEvents.filter((e) => !orphan.has(e.cal));
    changed = true;
  }
  for (const acc of [...gstat.accounts]) {
    try {
      if (withList || !gCalsOf(acc).length) { await gLoadCalendars(acc); changed = true; }
      for (const cal of gCalsOf(acc)) {
        try { if (await gSync(cal)) changed = true; }
        catch (e) { if (e.message === 'signed-out') break; if (!cal.error) changed = true; cal.error = true; }
      }
    } catch { /* offline oder abgemeldet: beim nächsten Mal */ }
  }
  gSyncAll.running = false;
  if (changed) { save(); gRefreshUi(); }
}

// Neu zeichnen nur, wenn gerade nichts bearbeitet oder gezogen wird
function gRefreshUi(force = false) {
  if (ui.calImport && document.querySelector('#modal .modal')) renderImport();
  if (!force && (ui.modal || ui.panel || (typeof wkDrag !== 'undefined' && wkDrag) || (typeof drag !== 'undefined' && drag))) return;
  if (['calendar', 'today', 'settings'].includes(ui.view)) render('update');
}

/* ---------- Schreiben ---------- */

function gBody(data) {
  const time = (ms) => ({ dateTime: new Date(ms).toISOString() });
  return {
    summary: data.title, description: data.note || '', location: data.location || '',
    start: data.allDay ? { date: data.start } : time(data.start),
    end: data.allDay ? { date: addDays(data.end, 1) } : time(data.end),
  };
}

async function gWrite(calId, fn) {
  gPending[calId] = (gPending[calId] || 0) + 1;
  try { await fn(); return true; }
  catch (e) {
    if (e.message !== 'signed-out') toast(dt('Google hat die Änderung nicht übernommen. Der Kalender wird neu geladen.', 'Google did not accept the change. Reloading the calendar.'));
    return false;
  } finally {
    gPending[calId]--;
    const cal = state.calendars.find((c) => c.id === calId);
    if (cal && !gPending[calId]) { try { await gSync(cal); } catch { /* später */ } save(); gRefreshUi(); }
  }
}

// Termin speichern: gleich in Habix zeigen, dann an Google schicken. Wechselt der Kalender, wird neu angelegt und alt gelöscht.
function gSave(old, data) {
  const target = state.calendars.find((c) => c.id === data.cal && c.google);
  const fields = { title: data.title, allDay: data.allDay, start: data.start, end: data.end, note: data.note, location: data.location };
  if (old && old.cal === data.cal) {
    Object.assign(old, fields);
    gWrite(target.id, () => gApi(target.gacc, 'PATCH', gPath(target, `/${encodeURIComponent(old.gid)}`), gBody(fields)));
    return;
  }
  if (old) gRemove(old);
  if (!target) { state.calEvents.push({ id: `local:${uid()}`, ...data }); return; }
  const tmp = { id: `${target.id}:neu${uid()}`, cal: target.id, gid: null, ...fields };
  state.calEvents.push(tmp);
  state.calLast = target.id;
  gWrite(target.id, async () => {
    const g = await gApi(target.gacc, 'POST', gPath(target), gBody(fields));
    Object.assign(tmp, gToEvent(target, g));
  });
}

// Termin entfernen (lokal sofort, bei Google im Hintergrund)
function gRemove(ev) {
  state.calEvents = state.calEvents.filter((x) => x !== ev);
  const cal = state.calendars.find((c) => c.id === ev.cal && c.google);
  if (cal && ev.gid) gWrite(cal.id, () => gApi(cal.gacc, 'DELETE', gPath(cal, `/${encodeURIComponent(ev.gid)}`)).catch((e) => {
    if (!/not found|deleted/i.test(e.message)) throw e; // war bei Google schon weg
  }));
}

// Nach Verschieben oder Längerziehen in der Wochenansicht
function gMoved(ev) {
  const cal = state.calendars.find((c) => c.id === ev.cal && c.google);
  if (!cal || !ev.gid) return;
  const time = (ms) => ({ dateTime: new Date(ms).toISOString() });
  gWrite(cal.id, () => gApi(cal.gacc, 'PATCH', gPath(cal, `/${encodeURIComponent(ev.gid)}`), { start: time(ev.start), end: time(ev.end) }));
}

/* ---------- Oberfläche ---------- */

const gConnectLabel = (more) => (gstat.busy
  ? `<span class="spinner"></span>${dt('Im Browser anmelden … (abbrechen)', 'Sign in in your browser … (cancel)')}`
  : `${more ? icon('plus') : gLogo()}${more ? dt('Weiteres Google-Konto', 'Add another Google account') : dt('Mit Google verbinden', 'Connect Google')}`);

// Unter der Kalenderliste: verbinden, wenn noch kein Konto da ist, sonst der Weg zu den Einstellungen
function gAccountRow() {
  if (!window.api?.googleStatus) return '';
  if (!gstat.accounts.length) return `<button class="btn g-btn" data-action="g-connect">${gConnectLabel(false)}</button>`;
  return `<button class="btn ghost small g-manage" data-action="goto" data-view="settings">${gLogo()}${dt('Google-Konten verwalten', 'Manage Google accounts')}</button>`;
}

// Karte in den Einstellungen: alle verbundenen Konten, abmelden, weitere hinzufügen
function googleSettingsCard() {
  if (!window.api?.googleStatus) return '';
  const rows = gstat.accounts.map((acc) => {
    const cals = gCalsOf(acc);
    const err = cals.some((c) => c.error);
    const last = Math.max(0, ...cals.map((c) => c.lastSync || 0));
    const sub = err ? dt('Gerade nicht erreichbar', 'Not reachable right now')
      : `${cals.length} ${cals.length === 1 ? dt('Kalender', 'calendar') : dt('Kalender', 'calendars')}${last ? ` · ${dt('aktualisiert', 'updated')} ${hhmm(last)}` : ''}`;
    return `
      <div class="g-acc">
        <span class="g-avatar">${esc(acc.slice(0, 1).toUpperCase())}</span>
        <div class="g-acc-text"><b>${esc(acc)}</b><span class="${err ? 'cal-err' : ''}">${sub}</span></div>
        ${ui.gConfirm === acc
          ? `<button class="btn small danger" data-action="g-logout-yes" data-acc="${esc(acc)}">${dt('Abmelden', 'Sign out')}</button>
             <button class="btn small ghost" data-action="g-logout-no">${dt('Nein', 'No')}</button>`
          : `<button class="btn small ghost" data-action="g-logout" data-acc="${esc(acc)}">${dt('Abmelden', 'Sign out')}</button>`}
      </div>`;
  }).join('');
  return `
    <article class="card s6 fade-in">
      <div class="card-head"><div><h2>Google Kalender</h2><div class="sub">${dt('Termine live in beide Richtungen, auch mit mehreren Konten', 'Events live both ways, also with several accounts')}</div></div><div class="icon-btn">${gLogo()}</div></div>
      ${rows ? `<div class="g-accs">${rows}</div>` : `<div class="muted">${dt('Noch kein Google-Konto verbunden.', 'No Google account connected yet.')}</div>`}
      <div class="btn-row">
        <button class="btn ${rows ? '' : 'primary'}" data-action="g-connect">${gConnectLabel(!!rows)}</button>
        ${rows ? `<button class="btn ghost" data-action="g-sync">${icon('refresh-cw')}${dt('Jetzt aktualisieren', 'Refresh now')}</button>` : ''}
      </div>
      ${ui.gConfirm ? `<div class="setting-note">${icon('info')}<span>${dt('Beim Abmelden verschwinden die Kalender dieses Kontos aus Habix. In Google bleibt alles erhalten.', 'Signing out removes this account’s calendars from Habix. Everything stays in Google.')}</span></div>` : ''}
    </article>`;
}

function gImportOption() {
  if (!window.api?.googleStatus) return '';
  return `
    <div class="import-opt">
      <div class="import-head">${gLogo()}<div><b>${dt('Google Kalender verbinden', 'Connect Google Calendar')}</b><span>${dt('Live in beide Richtungen: Termine aus Google erscheinen sofort, neue Termine aus Habix landen in Google', 'Live both ways: events from Google show up right away, new events from Habix go to Google')}</span></div></div>
      ${gstat.accounts.length ? `<p class="import-text">${dt(`Verbunden: ${esc(gstat.accounts.join(', '))}. Konten verwaltest du in den Einstellungen.`, `Connected: ${esc(gstat.accounts.join(', '))}. Manage accounts in Settings.`)}</p>` : ''}
      <button class="btn ${gstat.accounts.length ? '' : 'primary'}" data-action="g-connect">${gConnectLabel(!!gstat.accounts.length)}</button>
    </div>`;
}

const gLogo = () => `<svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#ffc107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#ff3d00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4caf50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976d2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

function gAction(action, el) {
  switch (action) {
    case 'g-connect': gConnect(); return true;
    case 'g-logout': ui.gConfirm = el.dataset.acc; render('update'); return true;
    case 'g-logout-no': ui.gConfirm = null; render('update'); return true;
    case 'g-logout-yes': ui.gConfirm = null; gDisconnect(el.dataset.acc); return true;
    case 'g-sync': toast(dt('Wird aktualisiert …', 'Refreshing …')); gSyncAll(true); return true;
  }
  return false;
}

// Live halten: jede Minute, solange das Fenster sichtbar ist, und sofort beim Zurückkommen
setInterval(() => { if (!document.hidden && gstat.accounts.length) gSyncAll(); }, 60 * 1000);
window.addEventListener('focus', () => { if (gstat.accounts.length && Date.now() - gLastSync > 15 * 1000) gSyncAll(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && gstat.accounts.length && Date.now() - gLastSync > 15 * 1000) gSyncAll(); });
