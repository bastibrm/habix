'use strict';

/* ================= Konstanten ================= */

const ICONS = [
  'droplets', 'book-open', 'dumbbell', 'footprints', 'moon', 'brain', 'salad', 'pen-line', 'music', 'bike',
  'heart-pulse', 'coffee', 'leaf', 'timer', 'bed', 'languages', 'code', 'phone-off', 'wallet', 'sprout',
];
const COLORS = ['#5ee0ff', '#8f7bff', '#ff7ab6', '#ffc46b', '#57e3b4', '#7aa2ff', '#ff8f6b', '#c4f06b'];
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const SUGGESTIONS = [
  { name: 'Wasser trinken', icon: 'droplets', color: '#5ee0ff', type: 'amount', target: 2, unit: 'L', step: 0.25, time: 'any' },
  { name: '20 Minuten lesen', icon: 'book-open', color: '#8f7bff', time: 'evening' },
  { name: 'Sport', icon: 'dumbbell', color: '#ff7ab6', time: 'midday' },
  { name: 'Schritte', icon: 'footprints', color: '#57e3b4', type: 'amount', target: 10000, unit: 'Schritte', step: 1000, time: 'any' },
  { name: 'Vor 23 Uhr schlafen', icon: 'moon', color: '#7aa2ff', time: 'evening' },
  { name: '10 Minuten meditieren', icon: 'brain', color: '#ffc46b', time: 'morning' },
  { name: 'Kein Handy nach 22 Uhr', icon: 'phone-off', color: '#ff8f6b', time: 'evening' },
  { name: 'Vokabeln lernen', icon: 'languages', color: '#c4f06b', time: 'morning' },
];
const DAYPARTS = [
  { id: 'night', label: 'Nachts', icon: 'moon' },
  { id: 'morning', label: 'Morgens', icon: 'sunrise' },
  { id: 'midday', label: 'Mittags', icon: 'sun' },
  { id: 'evening', label: 'Abends', icon: 'moon-star' },
  { id: 'any', label: 'Jederzeit', icon: 'infinity' },
];
const MILESTONES = [
  { days: 7, name: 'Erste Woche', color: '#d99a5b' },
  { days: 30, name: 'Ein Monat', color: '#aab3c2' },
  { days: 66, name: 'Sitzt', color: '#f2b84b' },
  { days: 100, name: 'Hundert', color: '#9585ff' },
  { days: 365, name: 'Ein Jahr', color: '#3fc6f2' },
];
const MOODS = [
  { v: 1, label: 'Mies', icon: 'angry' },
  { v: 2, label: 'Schlecht', icon: 'frown' },
  { v: 3, label: 'Okay', icon: 'meh' },
  { v: 4, label: 'Gut', icon: 'smile' },
  { v: 5, label: 'Super', icon: 'laugh' },
];
const DEFAULT_SETTINGS = {
  remindHabits: true, remindHabitsAt: '20:00', remindShift: true, remindShiftMin: 10, remindClockOut: true,
  weeklyReview: true, morningCheck: true, closeToTray: true, autostart: false, timeZone: 'system', remindEvents: true, remindEventsMin: 15, lang: 'de',
  xpGoal: 60, jokersPerMonth: 2,
};

/* ================= Zustand ================= */

// plan: geplante Halbstunden je Tag (0 = 00:00–00:30 … 47 = 23:30–24:00)
// sessions: Stempelzeiten { start, end, breaks: [{ start, end }] } als ISO-Zeit, end = null solange offen
// amounts: Mengen je Tag { habitId: Wert }, journal: { mood, note } je Tag, badges: { habitId: { 7: Datum } }
const emptyState = () => ({
  version: 1, habits: [], log: {}, amounts: {}, journal: {}, badges: {}, demo: false, plan: {}, sessions: [],
  calendars: [], calEvents: [], calShowShifts: true, tasks: [], workEnabled: false, onboarded: false, levelSeen: null,
  jokers: {}, pauses: [], cosmetic: { title: null, color: null },
  finance: { enabled: false, tx: [], rules: {}, subs: [], dismissed: [], budgets: {}, imports: [] },
  fitness: { enabled: false, profile: null, goals: null, weights: {}, plans: [], workouts: [], live: null, food: {}, foods: [], water: {}, weekGoal: 3, stepGoal: 8000, restSec: 90, measures: {}, cardio: [], steps: {}, sleep: {}, mealTpls: [], recipes: [], supps: [], suppLog: {}, fasting: { start: null, goal: 16, log: [] }, achSeen: null },
  settings: { ...DEFAULT_SETTINGS }, notified: {}, lastReview: null, lastBackup: null,
});
let state = emptyState();
const ui = { view: 'today', period: 30, modal: null, panel: null, confirmReset: false, weekStart: null, month: null, confirmSession: null, paint: null, pendingImport: null };

/* ================= Datum ================= */

const pad = (n) => String(n).padStart(2, '0');
const LOCALE = () => (state.settings?.lang === 'en' ? 'en-GB' : 'de-DE');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const todayKey = () => keyOf(new Date());
const wdOf = (k) => (parseKey(k).getDay() + 6) % 7; // 0 = Montag
function range(from, to) { const out = []; for (let k = from; k <= to; k = addDays(k, 1)) out.push(k); return out; }
const fmtLong = (k) => new Intl.DateTimeFormat(LOCALE(), { weekday: 'long', day: 'numeric', month: 'long' }).format(parseKey(k));
const fmtShort = (k) => new Intl.DateTimeFormat(LOCALE(), { day: 'numeric', month: 'short' }).format(parseKey(k));

/* ================= Berechnungen ================= */

const active = () => state.habits.filter((h) => !h.archived);
const scheduled = (h, k) => k >= h.createdAt && h.days.includes(wdOf(k));
const isAmount = (h) => h.type === 'amount';
const amountOf = (h, k) => state.amounts[k]?.[h.id] || 0;
const done = (h, k) => (isAmount(h) ? amountOf(h, k) >= h.target : (state.log[k] || []).includes(h.id));
const daypartOf = (h) => h.time || 'any';
const fmtNum = (v) => Number(v).toLocaleString(LOCALE(), { maximumFractionDigits: 2 });
// Deutsche Zahlen lesen: "1,5" → 1.5, "10.000" → 10000, "0.25" → 0.25
function parseNum(str) {
  const t = String(str).trim().replace(/\s/g, '');
  if (state.settings?.lang === 'en') return Number(t.replace(/,/g, ''));
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''));
  return Number(t);
}
function currentDaypart() {
  const h = new Date().getHours();
  return h < 6 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'midday' : 'evening';
}

// Joker-Tage und Pausen (Urlaub, krank): solche Tage zählen nicht als verpasst, Serien laufen einfach weiter.
// Was man an so einem Tag trotzdem schafft, zählt ganz normal. Eine Pause ohne Ende läuft bis heute.
let excusedCache = null;
function excusedDays() {
  const j = state.jokers || {}, p = state.pauses || [], t = todayKey();
  if (excusedCache && excusedCache.j === j && excusedCache.p === p && excusedCache.t === t) return excusedCache.set;
  const set = new Set(Object.keys(j));
  for (const x of p) for (let k = x.from, end = x.to || t; k <= end; k = addDays(k, 1)) set.add(k);
  excusedCache = { j, p, t, set };
  return set;
}
const excused = (k) => excusedDays().has(k);

// An geschützten Tagen zählt nur ein perfekter Tag, alles andere ist neutral (null)
function dayRate(k, habits = active()) {
  const s = habits.filter((h) => scheduled(h, k));
  if (!s.length) return null;
  const r = s.filter((h) => done(h, k)).length / s.length;
  return r < 1 && excused(k) ? null : r;
}

function periodRate(from, to, habits = active()) {
  let s = 0, d = 0;
  for (const k of range(from, to)) {
    const ex = excused(k);
    for (const h of habits) if (scheduled(h, k)) { const ok = done(h, k); if (ex && !ok) continue; s++; if (ok) d++; }
  }
  return { rate: s ? d / s : null, done: d, scheduled: s };
}

const habitRate = (h, from, to) => periodRate(from, to, [h]).rate;

// Heute zählt erst mit, wenn es erledigt ist; ein offener heutiger Tag bricht die Serie nicht
function streak(h) {
  let k = todayKey(), n = 0;
  if (scheduled(h, k) && !done(h, k)) k = addDays(k, -1);
  while (k >= h.createdAt) {
    if (scheduled(h, k)) { if (done(h, k)) n++; else if (!excused(k)) break; }
    k = addDays(k, -1);
  }
  return n;
}

function bestStreak(h) {
  let best = 0, cur = 0;
  const today = todayKey();
  for (const k of range(h.createdAt, today)) {
    if (!scheduled(h, k)) continue;
    if (done(h, k)) { cur++; best = Math.max(best, cur); } else if (k !== today && !excused(k)) cur = 0;
  }
  return best;
}

function firstDay() {
  const hs = active();
  return hs.length ? hs.map((h) => h.createdAt).sort()[0] : null;
}

function perfectStreak() {
  const first = firstDay();
  if (!first) return 0;
  let k = todayKey(), n = 0;
  const r0 = dayRate(k);
  if (r0 !== null && r0 < 1) k = addDays(k, -1);
  while (k >= first) {
    const r = dayRate(k);
    if (r !== null) { if (r === 1) n++; else break; }
    k = addDays(k, -1);
  }
  return n;
}

function bestPerfectStreak() {
  const first = firstDay();
  if (!first) return 0;
  let best = 0, cur = 0;
  for (const k of range(first, todayKey())) {
    const r = dayRate(k);
    if (r === null) continue;
    if (r === 1) { cur++; best = Math.max(best, cur); } else if (k !== todayKey()) cur = 0;
  }
  return best;
}

/* Vergleich: aktueller Zeitraum gegen den Zeitraum direkt davor (in Prozentpunkten) */
function compare(h, days) {
  const to = todayKey();
  const from = addDays(to, -(days - 1));
  const pTo = addDays(from, -1);
  const pFrom = addDays(pTo, -(days - 1));
  const cur = h ? habitRate(h, from, to) : periodRate(from, to).rate;
  const prev = h ? habitRate(h, pFrom, pTo) : periodRate(pFrom, pTo).rate;
  return { cur, prev, delta: cur !== null && prev !== null ? (cur - prev) * 100 : null };
}

/* ================= Speichern ================= */

let saveTimer;
function save() {
  if (typeof onDataChanged === 'function') onDataChanged();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      if (window.api) await window.api.save(state);
      else localStorage.setItem('tageswerk', JSON.stringify(state));
    } catch (e) {
      toast('Speichern hat nicht geklappt. Bitte die App neu starten.');
    }
  }, 250);
}

async function load() {
  try {
    const data = window.api ? await window.api.load() : JSON.parse(localStorage.getItem('tageswerk') || 'null');
    if (data && Array.isArray(data.habits)) state = { ...emptyState(), ...data, settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) } };
  } catch { /* leere Daten */ }
}

/* ================= Helfer ================= */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (r) => (r === null || r === undefined ? '–' : `${Math.round(r * 100)}%`);
// Zahl, die beim Anzeigen hochzählt (nur im Text verwenden, nie in Attributen)
const num = (v, suffix = '') => `<span class="count" data-to="${v}" data-suffix="${suffix}">${v}${suffix}</span>`;
// Minuten als Stunden:Minuten, z. B. 450 → 7:30
const fmtMin = (m) => { const a = Math.abs(Math.round(m)); return `${m < 0 ? '−' : ''}${Math.floor(a / 60)}:${pad(a % 60)}`; };
const hm = (mins) => `<span class="count" data-to="${Math.round(mins)}" data-fmt="hm">${fmtMin(mins)}</span>`;
const progHue = (v) => Math.round(Math.max(0, Math.min(1, v)) * 130);
const pctN = (r) => (r === null || r === undefined ? '–' : num(Math.round(r * 100), '%'));
const uid = () => Math.random().toString(36).slice(2, 10);
const icon = (name) => `<i data-lucide="${name}"></i>`;

function deltaPill(delta, isNew) {
  if (isNew || delta === null) return `<span class="delta new">${icon('sparkles')}neu</span>`;
  const d = Math.round(delta);
  if (Math.abs(d) < 3) return `<span class="delta flat">${icon('minus')}stabil</span>`;
  return d > 0
    ? `<span class="delta up">${icon('trending-up')}+${num(d)} Pp</span>`
    : `<span class="delta down">${icon('trending-down')}${num(d)} Pp</span>`;
}

function countPill(diff) {
  if (diff === null) return `<span class="delta new">${icon('sparkles')}neu</span>`;
  if (diff === 0) return `<span class="delta flat">${icon('minus')}gleich</span>`;
  return diff > 0
    ? `<span class="delta up">${icon('trending-up')}+${num(diff)}</span>`
    : `<span class="delta down">${icon('trending-down')}${num(diff)}</span>`;
}

function habitIcon(h) {
  return `<div class="habit-icon" style="--c:${h.color}">${icon(h.icon)}</div>`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  clearTimeout(toastTimer);
  el.classList.remove('out');
  el.hidden = true;
  void el.offsetWidth; // Animation neu starten
  el.textContent = msg;
  el.hidden = false;
  toastTimer = setTimeout(() => {
    el.classList.add('out');
    toastTimer = setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 230);
  }, 2600);
}

/* ================= Diagramme ================= */

function ring(value, size = 96) {
  const r = 46, c = 2 * Math.PI * r;
  const v = value === null ? 0 : value;
  return `
  <div class="ring" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 112 112" aria-hidden="true">
      <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--cyan)"/><stop offset="1" style="stop-color:var(--violet)"/></linearGradient></defs>
      <circle cx="56" cy="56" r="${r}" fill="none" style="stroke:var(--track)" stroke-width="10"/>
      <circle class="prog" data-anim="ring" data-full="${c}" cx="56" cy="56" r="${r}" fill="none" stroke="url(#ringGrad)" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${c}" style="stroke-dashoffset:${c * (1 - v)}px"/>
    </svg>
    <div class="ring-label">${pctN(value)}</div>
  </div>`;
}

function bars(items) {
  return `<div class="bars" style="--n:${items.length}">${items.map((it) => `
    <div class="bar-col ${it.today ? 'today' : ''} ${it.value === null ? 'empty' : ''}" title="${esc(it.title)}">
      <div class="bar-val">${it.text ?? pct(it.value)}</div>
      <div class="bar-track"><div class="bar-fill" data-anim="h" style="height:${Math.max(4, (it.value || 0) * 100)}%"></div></div>
      <div class="bar-label">${it.label}</div>
    </div>`).join('')}</div>`;
}

// Weiche Kurve durch die Punkte, Kontrollpunkte innerhalb der Achsen gehalten
function smoothPath(pts, yMin, yMax) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const clamp = (y) => Math.min(yMax, Math.max(yMin, y));
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = clamp(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = clamp(p2.y - (p3.y - p1.y) / 6);
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

let chartSeq = 0;
// Breite Diagramme in echter Pixelbreite zeichnen, damit sie nicht mit dem Fenster in die Höhe wachsen
function fullChartW() {
  const v = document.getElementById('view');
  return Math.max(560, Math.round((v?.clientWidth || 1000) - 36));
}

function lineChart({ series, labels, w = 800, h = 240, axis = true, avg = null, tickEvery = 5, fmtY = (g) => `${g * 100}%`, fmtTip = pct }) {
  const id = `lc${chartSeq++}`;
  const L = axis ? 40 : 4, R = 10, T = 12, B = axis ? 26 : 6;
  const n = series.length;
  const x = (i) => L + (n === 1 ? 0 : (i * (w - L - R)) / (n - 1));
  const y = (v) => T + (1 - v) * (h - T - B);
  const pts = series.map((v, i) => (v === null ? null : { x: x(i), y: y(v), v, i })).filter(Boolean);
  const line = smoothPath(pts, T, h - B);
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1].x},${h - B} L${pts[0].x},${h - B} Z` : '';
  const avgPts = avg ? avg.map((v, i) => (v === null ? null : { x: x(i), y: y(v) })).filter(Boolean) : [];
  const last = pts[pts.length - 1];

  let grid = '';
  if (axis) {
    for (const g of [0, 0.5, 1]) {
      grid += `<line class="grid-line" x1="${L}" x2="${w - R}" y1="${y(g)}" y2="${y(g)}"/>`;
      grid += `<text x="${L - 10}" y="${y(g) + 3.5}" text-anchor="end">${fmtY(g)}</text>`;
    }
    labels.forEach((lb, i) => {
      if (i % tickEvery === 0 || i === n - 1) {
        if (i !== n - 1 && n - 1 - i < tickEvery / 2) return;
        grid += `<text x="${x(i)}" y="${h - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${lb}</text>`;
      }
    });
  }

  const hits = axis ? pts.map((p) => `
    <rect class="hit" x="${p.x - (w - L - R) / (2 * Math.max(1, n - 1))}" y="${T}" width="${(w - L - R) / Math.max(1, n - 1)}" height="${h - T - B}" fill="transparent"><title>${labels[p.i]}: ${fmtTip(p.v)}</title></rect>
    <circle class="hit-dot" cx="${p.x}" cy="${p.y}" r="4" style="fill:var(--surface);stroke:var(--cyan)" stroke-width="2"/>`).join('') : '';

  return `
  <svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Verlauf der Erfüllungsquote">
    <defs>
      <linearGradient id="${id}s" x1="0" x2="1" y1="0" y2="0"><stop offset="0" style="stop-color:var(--cyan)"/><stop offset="1" style="stop-color:var(--violet)"/></linearGradient>
      <linearGradient id="${id}a" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--cyan);stop-opacity:.26"/><stop offset="1" style="stop-color:var(--violet);stop-opacity:0"/></linearGradient>
      <filter id="${id}g" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
    </defs>
    ${grid}
    ${area ? `<path class="a-area" d="${area}" fill="url(#${id}a)"/>` : ''}
    ${avgPts.length > 1 ? `<path class="a-area" d="${smoothPath(avgPts, T, h - B)}" fill="none" style="stroke:var(--sun)" stroke-width="1.6" stroke-dasharray="4 5" opacity=".85"/>` : ''}
    <path class="a-draw" pathLength="1" d="${line}" fill="none" stroke="url(#${id}s)" stroke-width="5" opacity=".35" filter="url(#${id}g)"/>
    <path class="a-draw" pathLength="1" d="${line}" fill="none" stroke="url(#${id}s)" stroke-width="2.6" stroke-linecap="round"/>
    ${hits}
    ${last ? `<circle class="a-last" cx="${last.x}" cy="${last.y}" r="5" style="fill:var(--violet);stroke:var(--fg)" stroke-width="2"/>` : ''}
  </svg>`;
}

/* ================= Ansicht: Heute ================= */

function viewToday() {
  const today = todayKey();
  const habits = active();

  if (!habits.length) return viewEmpty(state.tasks.some((t) => !t.done) ? todayTasksCard('s12') : '');

  const due = habits.filter((h) => scheduled(h, today));
  const free = habits.filter((h) => !scheduled(h, today));
  const doneCount = due.filter((h) => done(h, today)).length;
  const rate = due.length ? doneCount / due.length : null;

  // aktuelle Woche Mo–So
  const monday = addDays(today, -wdOf(today));
  const week = range(monday, addDays(monday, 6)).map((k) => ({
    label: WD[wdOf(k)], value: k > today ? null : dayRate(k), today: k === today,
    title: `${fmtShort(k)}: ${k > today ? 'kommt noch' : pct(dayRate(k))}`,
  }));

  const trendKeys = range(addDays(today, -29), today);
  const wk = compare(null, 7);
  const ps = perfectStreak();
  const best = bestPerfectStreak();

  // Gewohnheit mit der niedrigsten Quote der letzten 14 Tage
  const focus = habits
    .map((h) => ({ h, r: habitRate(h, addDays(today, -13), today) }))
    .filter((x) => x.r !== null)
    .sort((a, b) => a.r - b.r)[0];

  const message = rate === null ? 'Heute steht nichts an. Genieß den freien Tag.'
    : rate === 1 ? 'Alles erledigt. Stark!'
      : doneCount === 0 ? `${due.length} Gewohnheiten warten auf dich.`
        : `Noch ${due.length - doneCount} bis zum perfekten Tag.`;

  const cards = {
    done: `
    <article class="card fade-in">
      <div class="card-head"><div><h2>Heute geschafft</h2><div class="sub">${message}</div></div></div>
      <div class="stat-row">
        <div class="big">${num(doneCount)}<small> / ${num(due.length)}</small></div>
        ${ring(rate)}
      </div>
    </article>`,
    perfect: `
    <article class="card fade-in">
      <div class="card-head">
        <div><h2>Perfekte Tage in Folge</h2><div class="sub">Tage, an denen du alles geschafft hast</div></div>
        <div class="icon-btn" style="color:var(--sun)">${icon('flame')}</div>
      </div>
      <div class="stat-row">
        <div class="big">${num(ps)}<small> ${ps === 1 ? 'Tag' : 'Tage'}</small></div>
        <div style="text-align:right">
          <div class="sub">Rekord</div>
          <div class="num" style="font-size:18px">${num(best)}</div>
        </div>
      </div>
      <div class="meter"><span data-anim="w" style="width:${best ? Math.min(100, (ps / best) * 100) : 0}%"></span></div>
    </article>`,
    week: `
    <article class="card fade-in">
      <div class="card-head"><div><h2>Diese Woche</h2><div class="sub">Erfüllung pro Tag</div></div></div>
      ${bars(week)}
    </article>`,
    xp: xpCard(),
    challenges: challengesCard(),
    timeline: timelineCard(),
    habits: `
    <article class="card fade-in">
      <div class="card-head">
        <div><h2>Heute dran</h2><div class="sub">Abhaken oder Menge eintragen. Die Kästchen sind die letzten 7 Tage, die kannst du nachtragen.</div></div>
      </div>
      ${due.length ? groupedRows(due) : '<div class="muted">Für heute ist nichts geplant.</div>'}
      ${free.length ? `
        <div class="sub" style="margin-top:4px">Heute frei</div>
        <div class="free-list">${free.map((h) => `<span class="chip" style="--c:${h.color}">${icon(h.icon)}${esc(h.name)}</span>`).join('')}</div>` : ''}
    </article>`,
    tasks: todayTasksCard(''),
    events: todayEventsCard(),
    training: trainingTodayCard(),
    food: foodTodayCard(),
    work: workTodayCard(),
    money: moneyTodayCard(),
    month: monthCard(),
    journal: journalCard(today),
    trend: `
    <article class="card fade-in">
      <div class="card-head">
        <div><h2>Trend</h2><div class="sub">Letzte 30 Tage</div></div>
        ${deltaPill(compare(null, 30).delta)}
      </div>
      ${lineChart({ series: trendKeys.map((k) => dayRate(k)), labels: trendKeys.map(fmtShort), w: 360, h: 88, axis: false })}
    </article>`,
    compare: `
    <article class="card fade-in">
      <div class="card-head"><div><h2>Wochenvergleich</h2><div class="sub">Letzte 7 Tage gegen die 7 davor</div></div></div>
      <div class="stat-row">
        <div>
          <div class="big" style="font-size:30px">${pctN(wk.cur)}</div>
          <div class="sub">vorher ${pctN(wk.prev)}</div>
        </div>
        ${deltaPill(wk.delta)}
      </div>
    </article>`,
    focus: focus ? `
    <article class="card fade-in">
      <div class="card-head"><div><h2>Mehr Luft nach oben</h2><div class="sub">Schwächste Gewohnheit der letzten 14 Tage</div></div></div>
      <div class="focus-card">
        ${habitIcon(focus.h)}
        <div style="min-width:0;flex:1">
          <div class="habit-name">${esc(focus.h.name)}</div>
          <div class="rate-bar" style="--c:${focus.h.color}"><span data-anim="w" style="width:${focus.r * 100}%"></span></div>
        </div>
        <div class="num">${pctN(focus.r)}</div>
      </div>
    </article>` : '',
  };

  return `
  ${state.demo ? demoBanner() : ''}
  ${dashHead()}
  ${dashGrid(cards)}`;
}

// Heute-Liste nach Tageszeit gruppiert, die aktuelle Tageszeit hervorgehoben
function groupedRows(due) {
  const now = currentDaypart();
  const today = todayKey();
  const groups = DAYPARTS.map((p) => ({ ...p, items: due.filter((h) => daypartOf(h) === p.id) })).filter((g) => g.items.length);
  return groups.map((g) => {
    const d = g.items.filter((h) => done(h, today)).length;
    return `
    <div class="daypart ${g.id === now ? 'now' : ''} ${d === g.items.length ? 'complete' : ''}">
      <div class="daypart-head">${icon(g.icon)}<span>${g.label}</span>${g.id === now ? '<span class="now-tag">jetzt</span>' : ''}<span class="daypart-count">${d} / ${g.items.length}</span></div>
      <div class="habit-list">${g.items.map(habitRow).join('')}</div>
    </div>`;
  }).join('');
}

function amountControl(h, k) {
  const v = amountOf(h, k);
  return `
  <div class="amount ${v >= h.target ? 'on' : ''}">
    <button class="amt-btn" data-action="amount" data-id="${h.id}" data-day="${k}" data-delta="-1" aria-label="Weniger">${icon('minus')}</button>
    <label class="amt-val"><input class="amt-input" id="amt-${h.id}" data-id="${h.id}" data-day="${k}" value="${fmtNum(v)}" inputmode="decimal" aria-label="${esc(h.name)} Menge"><span>/ ${fmtNum(h.target)} ${esc(h.unit || '')}</span></label>
    <button class="amt-btn plus" data-action="amount" data-id="${h.id}" data-day="${k}" data-delta="1" aria-label="Mehr">${icon('plus')}</button>
  </div>`;
}

function habitRow(h) {
  const today = todayKey();
  const isDone = done(h, today);
  const s = streak(h);
  const r30 = habitRate(h, addDays(today, -29), today);
  const last7 = range(addDays(today, -6), today);
  const amt = isAmount(h);
  return `
  <div class="habit-row ${isDone ? 'is-done' : ''} ${amt ? 'is-amount' : ''}" style="--c:${h.color}" data-habit="${h.id}">
    ${habitIcon(h)}
    <div style="min-width:0">
      <div class="habit-name">${esc(h.name)}</div>
      <div class="habit-meta">
        <span class="${s >= 3 ? 'hot' : ''}">${icon('flame')}${num(s)} ${s === 1 ? 'Tag' : 'Tage'} Serie</span>
        <span>${icon('target')}${pctN(r30)} in 30 Tagen</span>
        ${badgeMini(h)}
      </div>
      ${amt ? `<div class="rate-bar amt-bar"><span data-anim="w" style="width:${Math.min(100, (amountOf(h, today) / h.target) * 100)}%"></span></div>` : ''}
    </div>
    <div class="dots">
      ${last7.map((k) => {
        const sch = scheduled(h, k);
        const part = amt && !done(h, k) && amountOf(h, k) > 0;
        const ex = sch && !done(h, k) && excused(k);
        return `<button class="dot ${done(h, k) ? 'on' : ''} ${part ? 'part' : ''} ${sch ? '' : 'off'} ${ex ? 'excused' : ''} ${k === today ? 'today' : ''}"
          ${part ? `style="--fill:${Math.round((amountOf(h, k) / h.target) * 100)}%"` : ''}
          ${sch ? `data-action="toggle" data-id="${h.id}" data-day="${k}"` : 'disabled'}
          title="${esc(fmtLong(k))}${sch ? (amt ? ` · ${fmtNum(amountOf(h, k))} / ${fmtNum(h.target)} ${esc(h.unit || '')}` : '') : ' (nicht geplant)'}${ex ? ` · ${dt('geschützt', 'protected')}` : ''}">${WD[wdOf(k)][0]}</button>`;
      }).join('')}
    </div>
    ${amt ? amountControl(h, today) : `<button class="check ${isDone ? 'on' : ''}" data-action="toggle" data-id="${h.id}" data-day="${today}"
      aria-pressed="${isDone}" aria-label="${esc(h.name)} heute erledigt">${icon('check')}</button>`}
  </div>`;
}

// Willkommensseite, solange es noch keine Gewohnheiten gibt. Alle Vorschauen sind Beispiele.
function viewEmpty(extra = '') {
  const sampleWeek = [0.6, 0.8, 1, 0.4, 0.8, 1, 0.7].map((v, i) => ({ label: WD[i], value: v, today: i === 6, title: `${WD[i]}: ${pct(v)}` }));
  const sampleTrend = [0.35, 0.4, 0.38, 0.5, 0.45, 0.55, 0.52, 0.6, 0.58, 0.66, 0.62, 0.7, 0.74, 0.72, 0.8];
  // Mini-Stundenplan: 5 Tage × 8 Halbstunden
  const sched = [
    'ok ok ok ok ok ok ok ok', 'miss miss ok ok ok ok ok ok', 'ok ok ok ok ok ok extra extra',
    'ok ok ok ok miss miss miss miss', 'plan plan plan plan plan plan plan plan',
  ];
  const mockRows = [
    { ...SUGGESTIONS[0], on: true }, { ...SUGGESTIONS[1], on: true }, { ...SUGGESTIONS[2], on: false },
  ];
  return `
  <section class="grid welcome">
    ${extra}
    <article class="card s8 hero fade-in">
      <div class="eyebrow">${esc(fmtLong(todayKey()))} · Willkommen bei Habix</div>
      <h1 class="hero-title">Kleine Schritte.<br><span>Jeden Tag.</span></h1>
      <p class="hero-text">Habix hilft dir, Gewohnheiten aufzubauen und deine Arbeitszeit im Blick zu behalten.
        Du hakst ab, was du geschafft hast, planst deine Woche in halben Stunden und siehst schwarz auf weiß, wo du besser wirst.</p>
      <div class="hero-actions">
        <button class="btn primary" data-action="new-habit">${icon('plus')}Erste Gewohnheit anlegen</button>
        <button class="btn" data-action="demo">${icon('sparkles')}Mit Beispieldaten ausprobieren</button>
      </div>
      <div>
        <div class="sub" style="margin-bottom:8px">Oder mit einem Klick starten:</div>
        <div class="suggestions">
          ${SUGGESTIONS.map((s, i) => `<button class="chip" style="--c:${s.color}" data-action="suggest" data-i="${i}">${icon(s.icon)}${esc(s.name)}</button>`).join('')}
        </div>
      </div>
    </article>

    <article class="card s4 fade-in preview-card">
      <div class="card-head"><div><h2>So sieht Fortschritt aus</h2><div class="sub">Beispiel einer guten Woche</div></div><span class="tag">Beispiel</span></div>
      <div class="stat-row">
        <div><div class="big">${num(5)}<small> / 6</small></div><div class="sub">heute geschafft</div></div>
        ${ring(0.83)}
      </div>
      ${bars(sampleWeek)}
    </article>

    <article class="card s4 fade-in feature">
      <div class="feature-icon" style="--c:var(--violet)">${icon('sun')}</div>
      <h2>Heute abhaken</h2>
      <p>Jeden Tag siehst du, was ansteht. Ein Klick, und die Gewohnheit ist erledigt. Deine Serie wächst mit.</p>
      <div class="mock">
        ${mockRows.map((r) => `
          <div class="mock-row" style="--c:${r.color}">
            <div class="habit-icon">${icon(r.icon)}</div>
            <span>${esc(r.name)}</span>
            <span class="mock-check ${r.on ? 'on' : ''}">${r.on ? icon('check') : ''}</span>
          </div>`).join('')}
      </div>
      <button class="btn small ghost feature-link" data-action="new-habit">Gewohnheit anlegen ${icon('arrow-right')}</button>
    </article>

    <article class="card s4 fade-in feature">
      <div class="feature-icon" style="--c:var(--good)">${icon('calendar-clock')}</div>
      <h2>Stundenplan &amp; Stempeluhr</h2>
      <p>Trag deine Arbeitszeiten ein und stempel dich oben rechts ein. Grün heißt gearbeitet, rot heißt verpasst.</p>
      <div class="mock mock-sched">
        ${sched.map((col) => `<div class="mock-col">${col.split(' ').map((st) => `<span class="mk mk-${st}"></span>`).join('')}</div>`).join('')}
      </div>
      <button class="btn small ghost feature-link" data-action="goto" data-view="schedule">Zum Stundenplan ${icon('arrow-right')}</button>
    </article>

    <article class="card s4 fade-in feature">
      <div class="feature-icon" style="--c:var(--cyan)">${icon('activity')}</div>
      <h2>Statistiken</h2>
      <p>Verläufe, Serien und ein Vergleich mit dem Zeitraum davor zeigen dir, wo du dich verbesserst und wo du nachlässt.</p>
      <div class="mock">
        <div class="stat-row"><span class="sub" style="margin:0">Erfüllung, 15 Tage</span>${deltaPill(18)}</div>
        ${lineChart({ series: sampleTrend, labels: sampleTrend.map(() => ''), w: 360, h: 96, axis: false })}
      </div>
      <button class="btn small ghost feature-link" data-action="demo">Mit Beispieldaten ansehen ${icon('arrow-right')}</button>
    </article>

    <article class="card s8 fade-in">
      <div class="card-head"><div><h2>So startest du</h2><div class="sub">In drei Schritten zur ersten Serie</div></div></div>
      <ol class="steps">
        <li><b>1</b><div><h3>Wenige Gewohnheiten wählen</h3><p>Fang mit zwei oder drei an. Lieber klein und durchziehen als zu viel auf einmal.</p></div></li>
        <li><b>2</b><div><h3>Tage festlegen</h3><p>Nicht alles muss täglich sein. Sport an drei Tagen zählt nur an diesen Tagen.</p></div></li>
        <li><b>3</b><div><h3>Täglich abhaken</h3><p>Abends kurz reinschauen. Vergessene Tage trägst du in der Monatsübersicht nach.</p></div></li>
      </ol>
    </article>

    <article class="card s4 fade-in fact">
      <div class="card-head"><h2>Gut zu wissen</h2>${icon('brain')}</div>
      <div class="big fact-num">${num(66)}<small> Tage</small></div>
      <p>So lange dauerte es in einer Studie im Schnitt, bis eine neue Gewohnheit automatisch lief. Je nach Person lag es zwischen 18 und 254 Tagen. Dranbleiben lohnt sich also, auch wenn mal ein Tag fehlt.</p>
      <div class="sub">Lally u. a., University College London, 2009</div>
    </article>
  </section>`;
}

function demoBanner() {
  return `<div class="demo-banner">${'Du siehst Beispieldaten. Wenn du loslegen willst, setz die App zurück.'}
    <button class="btn small" data-action="clear-demo">${icon('rotate-ccw')}Beispieldaten löschen</button></div>`;
}

/* ================= Ansicht: Statistiken ================= */

function viewStats() {
  const habits = active();
  if (!habits.length) return viewEmpty();

  const days = ui.period;
  const today = todayKey();
  const from = addDays(today, -(days - 1));
  const keys = range(from, today);
  const pTo = addDays(from, -1), pFrom = addDays(pTo, -(days - 1));

  const cur = periodRate(from, today);
  const prev = periodRate(pFrom, pTo);
  const rateDelta = cur.rate !== null && prev.rate !== null ? (cur.rate - prev.rate) * 100 : null;
  const perfect = keys.filter((k) => dayRate(k) === 1).length;
  const prevPerfect = range(pFrom, pTo).filter((k) => dayRate(k) === 1).length;

  const series = keys.map((k) => dayRate(k));
  // gleitender 7-Tage-Schnitt
  const avg = keys.map((k) => periodRate(addDays(k, -6), k).rate);

  const rows = habits.map((h) => {
    const c = compare(h, days);
    return { h, ...c, isNew: h.createdAt > pTo, streak: streak(h), best: bestStreak(h) };
  });
  const ranked = [...rows].sort((a, b) => (b.delta ?? -999) - (a.delta ?? -999));
  const bestHabit = [...rows].sort((a, b) => b.best - a.best)[0];

  // Wochentage über die letzten 12 Wochen
  const wdFrom = addDays(today, -83);
  const wdRates = WD.map((label, i) => {
    let s = 0, d = 0;
    for (const k of range(wdFrom, today)) if (wdOf(k) === i) for (const h of habits) if (scheduled(h, k)) { s++; if (done(h, k)) d++; }
    return { label, value: s ? d / s : null, title: `${label}: ${s ? pct(d / s) : 'keine Daten'}` };
  });
  const strongest = wdRates.filter((x) => x.value !== null).sort((a, b) => b.value - a.value)[0];

  return `
  <header class="head fade-in">
    <div><div class="eyebrow">${fmtShort(from)} bis ${fmtShort(today)}</div><h1>Statistiken</h1></div>
    <div class="head-actions">
      <button class="btn" data-action="review">${icon('calendar-range')}Wochenrückblick</button>
      <div class="segmented" role="tablist" aria-label="Zeitraum">
        ${[7, 30, 90].map((d) => `<button class="${days === d ? 'on' : ''}" data-action="period" data-days="${d}" id="period-${d}">${d} Tage</button>`).join('')}
      </div>
    </div>
  </header>

  <section class="grid">
    ${tile('Erfüllungsquote', pctN(cur.rate), deltaPill(rateDelta), `vorher ${pctN(prev.rate)}`)}
    ${tile('Perfekte Tage', num(perfect), countPill(prev.scheduled ? perfect - prevPerfect : null), `vorher ${num(prevPerfect)}`)}
    ${tile('Erledigt', num(cur.done), countPill(prev.scheduled ? cur.done - prev.done : null), `von ${num(cur.scheduled)} geplant`)}
    ${tile('Längste Serie', num(bestHabit.best), '', esc(bestHabit.h.name))}

    <article class="card s12 fade-in">
      <div class="card-head">
        <div><h2>Verlauf</h2><div class="sub">Anteil erledigter Gewohnheiten pro Tag</div></div>
        <div class="legend"><span><i style="background:var(--grad)"></i>Tageswert</span><span><i style="background:var(--sun)"></i>7-Tage-Schnitt</span></div>
      </div>
      ${lineChart({ series, labels: keys.map(fmtShort), avg, w: fullChartW(), h: 130, tickEvery: days <= 7 ? 1 : days <= 30 ? 5 : 15 })}
    </article>

    <article class="card s7 fade-in">
      <div class="card-head">
        <div><h2>Besser oder schlechter?</h2><div class="sub">Letzte ${days} Tage gegen die ${days} Tage davor, in Prozentpunkten</div></div>
      </div>
      <div class="trend-list">
        ${ranked.map((r) => `
          <div class="trend-item" style="--c:${r.h.color}">
            ${habitIcon(r.h)}
            <div style="min-width:0">
              <div class="habit-name" style="font-size:14px">${esc(r.h.name)}</div>
              <div class="rate-bar"><span data-anim="w" style="width:${(r.cur || 0) * 100}%"></span></div>
            </div>
            <div class="num muted" style="text-align:right">${pctN(r.prev)} → <span style="color:var(--fg)">${pctN(r.cur)}</span></div>
            ${deltaPill(r.delta, r.isNew)}
          </div>`).join('')}
      </div>
    </article>

    <div class="col s5">
      <article class="card fade-in">
        <div class="card-head">
          <div><h2>Stärkste Wochentage</h2><div class="sub">Letzte 12 Wochen${strongest ? ` · am besten ${strongest.label}` : ''}</div></div>
        </div>
        ${bars(wdRates)}
      </article>

      <article class="card fade-in">
        <div class="card-head"><div><h2>Aktivität</h2><div class="sub">Letzte 20 Wochen</div></div></div>
        ${heatmap()}
      </article>
    </div>

    ${moodSection(days)}

    <article class="card s12 fade-in">
      <div class="card-head"><div><h2>Alle Gewohnheiten</h2><div class="sub">Quote im gewählten Zeitraum, Serien und Verlauf der letzten 8 Wochen</div></div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Gewohnheit</th><th>Quote</th><th>Veränderung</th><th>Serie</th><th>Rekord</th><th>8 Wochen</th></tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td><div class="name-cell">${habitIcon(r.h)}${esc(r.h.name)}</div></td>
                <td class="n">${pctN(r.cur)}</td>
                <td>${deltaPill(r.delta, r.isNew)}</td>
                <td class="n">${num(r.streak)}</td>
                <td class="n">${num(r.best)}</td>
                <td style="width:180px">${weekSpark(r.h)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </article>
  </section>`;
}

function tile(label, value, pill, sub) {
  return `
  <article class="card s3 fade-in">
    <div class="card-head"><h2 class="muted" style="font-weight:600">${label}</h2>${pill}</div>
    <div class="big" style="font-size:32px">${value}</div>
    <div class="sub" style="margin-top:-6px">${sub}</div>
  </article>`;
}

function weekSpark(h) {
  const today = todayKey();
  const vals = [];
  for (let i = 7; i >= 0; i--) {
    const to = addDays(today, -i * 7);
    vals.push(habitRate(h, addDays(to, -6), to));
  }
  const w = 160, hh = 34, n = vals.length;
  const pts = vals.map((v, i) => (v === null ? null : { x: 3 + (i * (w - 6)) / (n - 1), y: 3 + (1 - v) * (hh - 6) })).filter(Boolean);
  if (pts.length < 2) return '<span class="muted">zu wenig Daten</span>';
  const last = pts[pts.length - 1];
  return `<svg class="chart" viewBox="0 0 ${w} ${hh}" aria-hidden="true">
    <path class="a-draw" pathLength="1" d="${smoothPath(pts, 3, hh - 3)}" fill="none" stroke="${h.color}" stroke-width="2" stroke-linecap="round"/>
    <circle class="a-last" cx="${last.x}" cy="${last.y}" r="3" fill="${h.color}"/></svg>`;
}

function heatmap() {
  const today = todayKey();
  const start = addDays(today, -(wdOf(today) + 19 * 7)); // Montag vor 19 Wochen
  const cells = range(start, addDays(today, 6 - wdOf(today))).map((k) => {
    if (k > today) return '<div class="heat-cell" style="opacity:.25"></div>';
    const r = dayRate(k);
    const style = r === null ? '' : `background:hsl(${progHue(r)} 68% 50% / ${(0.3 + r * 0.7).toFixed(2)})`;
    return `<div class="heat-cell" style="${style}" title="${esc(fmtLong(k))}: ${r === null ? 'nichts geplant' : pct(r)}"></div>`;
  }).join('');
  return `
    <div class="heat-wrap">
      <div class="heat-days">${WD.map((d, i) => `<span>${i % 2 === 0 ? d : ''}</span>`).join('')}</div>
      <div class="heat">${cells}</div>
    </div>
    <div class="heat-scale">weniger
      ${[0, 0.25, 0.5, 0.75, 1].map((r) => `<div class="heat-cell" style="background:hsl(${progHue(r)} 68% 50% / ${(0.3 + r * 0.7).toFixed(2)})"></div>`).join('')}
      mehr</div>`;
}

/* ================= Ansicht: Gewohnheiten ================= */

// Monatsübersicht: Gewohnheiten als Zeilen, Tage als Spalten, gruppiert nach Kalenderwoche
function monthMatrix() {
  const today = todayKey();
  const [y, m] = (ui.month || today.slice(0, 7)).split('-').map(Number);
  const first = `${y}-${pad(m)}-01`;
  const days = range(first, `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`);
  const order = DAYPARTS.map((p) => p.id);
  const habits = [...active()].sort((a, b) => order.indexOf(daypartOf(a)) - order.indexOf(daypartOf(b)));

  const groups = [];
  const groupOf = {};
  for (const k of days) {
    const w = isoWeek(k);
    const g = groups[groups.length - 1];
    if (g && g.w === w) g.n++; else groups.push({ w, n: 1 });
    groupOf[k] = (groups.length - 1) % 2 ? 'alt' : '';
  }

  const stats = days.map((k) => {
    const s = habits.filter((h) => scheduled(h, k));
    const d = s.filter((h) => done(h, k)).length;
    return { k, s: s.length, d, r: s.length && k <= today ? d / s.length : null };
  });
  const rows = habits.map((h) => {
    const goal = days.filter((k) => scheduled(h, k)).length;
    const actual = days.filter((k) => done(h, k)).length;
    return { h, goal, actual };
  });
  const totalGoal = rows.reduce((t, r) => t + r.goal, 0);
  const totalActual = rows.reduce((t, r) => t + r.actual, 0);
  const multi = new Set(rows.map((r) => daypartOf(r.h))).size > 1;
  // Neue Tageszeit beginnt: feine Linie statt eigener Zeile, damit keine Lücken entstehen
  const groupStart = (ri) => multi && ri > 0 && daypartOf(rows[ri - 1].h) !== daypartOf(rows[ri].h);
  const partIcon = (h) => { const dp = DAYPARTS.find((x) => x.id === daypartOf(h)); return multi ? `<span class="m-part" title="${dp.label}">${icon(dp.icon)}</span>` : ''; };
  const dayHead = (k) => `${k === today ? 'today' : ''} ${groupOf[k]} ${k > today ? 'future' : ''}`;

  const matrix = `
  <div class="matrix-scroll">
    <table class="matrix">
      <colgroup><col class="c-name">${days.map(() => '<col>').join('')}<col class="c-ana"><col class="c-ana"><col class="c-prog"></colgroup>
      <thead>
        <tr class="m-weeks">
          <th class="m-name m-corner" rowspan="2">Meine Gewohnheiten</th>
          ${groups.map((g, i) => `<th class="m-week ${i % 2 ? 'alt' : ''}" colspan="${g.n}">${g.n > 2 ? 'KW ' : ''}${g.w}</th>`).join('')}
          <th class="m-ana-head" colspan="3">Auswertung</th>
        </tr>
        <tr class="m-days">
          ${days.map((k) => `<th class="${dayHead(k)}"><span>${WD[wdOf(k)]}</span><b>${parseKey(k).getDate()}</b></th>`).join('')}
          <th class="m-ana">Ziel</th><th class="m-ana">Ist</th><th class="m-ana m-prog-h">Fortschritt</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(({ h, goal, actual }, ri) => `
          <tr style="--c:${h.color}" class="${groupStart(ri) ? 'm-split' : ''}">
            <th class="m-name"><button data-action="edit" data-id="${h.id}" title="Bearbeiten">${habitIcon(h)}<span>${esc(h.name)}</span>${partIcon(h)}</button></th>
            ${days.map((k) => {
              const sch = scheduled(h, k), on = done(h, k);
              const cls = `${groupOf[k]} ${k === today ? 'today' : ''}`;
              if (!sch) return `<td class="${cls}"><span class="mfree" title="Nicht geplant"></span></td>`;
              if (k > today) return `<td class="${cls}"><span class="mcheck future" title="${esc(fmtLong(k))}"></span></td>`;
              if (isAmount(h)) {
                const f = Math.min(1, amountOf(h, k) / h.target);
                return `<td class="${cls}"><button class="mcheck amt ${on ? 'on' : ''}" style="--fill:${Math.round(f * 100)}%" data-action="toggle" data-id="${h.id}" data-day="${k}"
                  title="${esc(h.name)} · ${esc(fmtLong(k))} · ${fmtNum(amountOf(h, k))} / ${fmtNum(h.target)} ${esc(h.unit || '')}"></button></td>`;
              }
              return `<td class="${cls}"><button class="mcheck ${on ? 'on' : ''}" data-action="toggle" data-id="${h.id}" data-day="${k}"
                aria-pressed="${on}" title="${esc(h.name)} · ${esc(fmtLong(k))}"></button></td>`;
            }).join('')}
            <td class="m-ana n">${num(goal)}</td>
            <td class="m-ana n">${num(actual)}</td>
            <td class="m-ana m-prog"><div class="rate-bar"><span data-anim="w" style="width:${goal ? (actual / goal) * 100 : 0}%"></span></div><span class="n">${pctN(goal ? actual / goal : null)}</span></td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr class="m-gap"><td colspan="${days.length + 4}"></td></tr>
        <tr>
          <th class="m-name">Fortschritt in %</th>
          ${stats.map((s) => `<td class="${groupOf[s.k]} ${s.k === today ? 'today' : ''} n ${s.r === 1 ? 'full' : ''}">${s.r === null ? '–' : Math.round(s.r * 100)}</td>`).join('')}
          <td class="m-ana n">${num(totalGoal)}</td><td class="m-ana n">${num(totalActual)}</td>
          <td class="m-ana m-prog"><div class="rate-bar" style="--c:var(--cyan)"><span data-anim="w" style="width:${totalGoal ? (totalActual / totalGoal) * 100 : 0}%"></span></div><span class="n">${pctN(totalGoal ? totalActual / totalGoal : null)}</span></td>
        </tr>
        <tr>
          <th class="m-name">Erledigt</th>
          ${stats.map((s) => `<td class="${groupOf[s.k]} ${s.k === today ? 'today' : ''} n">${s.k > today ? '' : s.d}</td>`).join('')}
          <td class="m-ana" colspan="3"></td>
        </tr>
        <tr>
          <th class="m-name">Offen</th>
          ${stats.map((s) => `<td class="${groupOf[s.k]} ${s.k === today ? 'today' : ''} n ${s.k <= today && s.s - s.d ? 'open' : ''}">${s.k > today ? '' : s.s - s.d}</td>`).join('')}
          <td class="m-ana" colspan="3"></td>
        </tr>
        <tr>
          <th class="m-name">Stimmung</th>
          ${days.map((k) => { const m = state.journal[k]?.mood; return `<td class="${groupOf[k]} ${k === today ? 'today' : ''}">${m ? `<span class="mood-dot mood-${m}" title="${MOODS[m - 1].label}"></span>` : ''}</td>`; }).join('')}
          <td class="m-ana" colspan="3"></td>
        </tr>
      </tfoot>
    </table>
  </div>`;

  const chart = lineChart({
    series: stats.map((s) => s.r), labels: days.map((k) => `${parseKey(k).getDate()}.`), w: fullChartW(), h: 110, tickEvery: 3,
  });
  return { matrix, chart, first, title: new Intl.DateTimeFormat(LOCALE(), { month: 'long', year: 'numeric' }).format(parseKey(first)) };
}

function viewHabits() {
  if (!active().length && !state.habits.length) return viewEmpty();
  const list = [...state.habits].sort((a, b) => Number(a.archived) - Number(b.archived));
  const mm = monthMatrix();
  const isNow = mm.first.slice(0, 7) === todayKey().slice(0, 7);
  return `
  ${state.demo ? demoBanner() : ''}
  <header class="head fade-in">
    <div><div class="eyebrow">${active().length} aktiv · ${esc(mm.title)}</div><h1>Gewohnheiten</h1></div>
    <div class="head-actions">
      <div class="week-nav">
        <button class="icon-btn" data-action="month" data-dir="-1" aria-label="Voriger Monat">${icon('chevron-left')}</button>
        ${navNowBtn('month', navMonthLabel(mm.first.slice(0, 7)), isNow, dt('Zum aktuellen Monat', 'Go to this month'))}
        <button class="icon-btn" data-action="month" data-dir="1" aria-label="Nächster Monat">${icon('chevron-right')}</button>
      </div>
      <button class="btn primary" data-action="new-habit">${icon('plus')}Neue Gewohnheit</button>
    </div>
  </header>
  <section class="grid">
    <article class="card s12 fade-in matrix-card">
      <div class="card-head">
        <div><h2>${esc(mm.title)}</h2><div class="sub">Häkchen setzen für jeden Tag. Graue Punkte sind Tage, an denen die Gewohnheit nicht geplant ist.</div></div>
      </div>
      ${active().length ? mm.matrix : '<div class="muted">Alle Gewohnheiten sind pausiert.</div>'}
    </article>

    <article class="card s12 fade-in">
      <div class="card-head"><div><h2>Monatsverlauf</h2><div class="sub">Anteil erledigter Gewohnheiten pro Tag</div></div></div>
      ${mm.chart}
    </article>

    <article class="card s12 fade-in">
      <div class="card-head"><div><h2>Verwalten</h2><div class="sub">Bearbeiten, pausieren oder fortsetzen</div></div></div>
      ${list.length ? `<div class="manage-list">${list.map((h) => `
        <div class="manage-row ${h.archived ? 'archived' : ''}" style="--c:${h.color}">
          ${habitIcon(h)}
          <div style="min-width:0">
            <div class="habit-name">${esc(h.name)}${h.archived ? ' <span class="muted" style="font-weight:500;font-size:12px">· pausiert</span>' : ''}</div>
            <div class="habit-meta"><span>${icon('calendar')}seit ${fmtShort(h.createdAt)}</span><span>${icon('trophy')}Rekord ${bestStreak(h)}</span></div>
          </div>
          <div class="weekday-tags">${WD.map((d, i) => `<span class="${h.days.includes(i) ? 'on' : ''}">${d}</span>`).join('')}</div>
          <div class="row-actions">
            <button class="icon-btn" data-action="archive" data-id="${h.id}" title="${h.archived ? 'Fortsetzen' : 'Pausieren'}">${icon(h.archived ? 'archive-restore' : 'archive')}</button>
            <button class="icon-btn" data-action="edit" data-id="${h.id}" title="Bearbeiten">${icon('pencil')}</button>
          </div>
        </div>`).join('')}</div>`
        : '<div class="muted">Noch keine Gewohnheiten. Leg oben deine erste an.</div>'}
    </article>

    ${milestonesCard()}
  </section>`;
}

/* ================= Ansicht: Stundenplan ================= */

const SLOT_MS = 30 * 60000;
const slotTime = (i) => (i >= 48 ? '24:00' : `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`);
const slotRange = (a, b) => `${slotTime(a)} – ${slotTime(b)}`;
const activeSession = () => state.sessions.find((s) => !s.end);
const mondayOf = (k) => addDays(k, -wdOf(k));
const dayStart = (k) => parseKey(k).getTime();
const timeOf = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtClock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
const sessionEnd = (s, now) => (s.end ? Date.parse(s.end) : now);

function slotStart(k, i) {
  const d = parseKey(k);
  d.setHours(Math.floor(i / 2), i % 2 ? 30 : 0, 0, 0);
  return d.getTime();
}

// Arbeitsabschnitte einer Stempelzeit: Beginn bis Ende ohne die Pausen
function workIntervals(s, now) {
  const a = Date.parse(s.start), b = sessionEnd(s, now);
  const out = [];
  let cur = a;
  const breaks = [...(s.breaks || [])].sort((x, y) => Date.parse(x.start) - Date.parse(y.start));
  for (const br of breaks) {
    const x = Math.max(a, Date.parse(br.start)), y = Math.min(b, br.end ? Date.parse(br.end) : now);
    if (y <= x) continue;
    if (x > cur) out.push([cur, x]);
    cur = Math.max(cur, y);
  }
  if (b > cur) out.push([cur, b]);
  return out;
}

function workedMs(from, to, sessions = state.sessions, now = Date.now()) {
  let ms = 0;
  for (const s of sessions) {
    for (const [x, y] of workIntervals(s, now)) {
      const a = Math.max(from, x), b = Math.min(to, y);
      if (b > a) ms += b - a;
    }
  }
  return ms;
}

function breakMs(from, to, sessions = state.sessions, now = Date.now()) {
  let ms = 0;
  for (const s of sessions) {
    for (const br of s.breaks || []) {
      const a = Math.max(from, Date.parse(br.start), Date.parse(s.start));
      const b = Math.min(to, br.end ? Date.parse(br.end) : now, sessionEnd(s, now));
      if (b > a) ms += b - a;
    }
  }
  return ms;
}

function isoWeek(k) {
  const d = parseKey(k);
  d.setDate(d.getDate() + 3 - wdOf(k));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

// Status einer Halbstunde: geplant + gearbeitet = grün, geplant + verpasst = rot, nur gearbeitet = extra
function slotStatus(planned, worked, a, now, paused = 0) {
  const past = a + SLOT_MS <= now, current = a <= now && now < a + SLOT_MS;
  if (paused >= 0.5 || (current && paused > 0 && worked < 0.5)) return 'pause';
  if (planned) {
    if (worked >= 0.5 || (current && worked > 0)) return 'ok';
    if (past) return 'miss';
    return current ? 'plan now' : 'plan';
  }
  return worked >= 0.1 ? 'extra' : '';
}

const STATUS_TEXT = { pause: 'Pause', ok: 'gearbeitet', miss: 'verpasst', plan: 'geplant', 'plan now': 'geplant, läuft gerade', extra: 'extra gearbeitet', '': 'frei' };

function viewSchedule() {
  const today = todayKey();
  const ws = ui.weekStart || mondayOf(today);
  const days = range(ws, addDays(ws, 6));
  const now = Date.now();
  const from = dayStart(ws), to = dayStart(addDays(ws, 7));
  const sess = state.sessions.filter((s) => Date.parse(s.start) < to && sessionEnd(s, now) > from);

  let plannedMin = 0, dueMin = 0, missedMin = 0;
  const cols = days.map((k) => {
    const plan = new Set(state.plan[k] || []);
    const cells = [];
    for (let i = 0; i < 48; i++) {
      const a = slotStart(k, i);
      const worked = workedMs(a, a + SLOT_MS, sess, now) / SLOT_MS;
      const planned = plan.has(i);
      const paused = breakMs(a, a + SLOT_MS, sess, now) / SLOT_MS;
      const st = slotStatus(planned, worked, a, now, paused);
      if (planned) { plannedMin += 30; if (a < now) dueMin += 30; }
      if (st === 'miss') missedMin += 30;
      cells.push({ i, planned, worked, st });
    }
    const dayPlan = plan.size * 30;
    const dayWorked = workedMs(dayStart(k), dayStart(addDays(k, 1)), sess, now) / 60000;
    let tone = '';
    if (dayPlan && k < today) tone = dayWorked >= dayPlan * 0.95 ? 'd-ok' : dayWorked > 0 ? 'd-part' : 'd-miss';
    if (k === today) tone = 'd-today';
    return { k, cells, plan, dayPlan, dayWorked, tone };
  });
  const workedMin = workedMs(from, to, sess, now) / 60000;
  const balance = workedMin - dueMin;
  const running = activeSession();

  const nowD = new Date();
  const nowPct = ((nowD.getHours() * 60 + nowD.getMinutes()) / 1440) * 100;

  return `
  <header class="head fade-in">
    <div>
      <div class="eyebrow">KW ${isoWeek(ws)} · ${fmtShort(ws)} bis ${fmtShort(addDays(ws, 6))}</div>
      <h1>Stundenplan</h1>
    </div>
    <div class="head-actions">
      <div class="week-nav">
        <button class="icon-btn" data-action="week" data-dir="-1" aria-label="Vorige Woche">${icon('chevron-left')}</button>
        ${navNowBtn('week', navWeekLabel(ws), ws === mondayOf(today), dt('Zur aktuellen Woche', 'Go to this week'))}
        <button class="icon-btn" data-action="week" data-dir="1" aria-label="Nächste Woche">${icon('chevron-right')}</button>
      </div>
      <button class="btn ${running ? 'danger' : 'primary'}" data-action="clock">${icon(running ? 'log-out' : 'log-in')}${running ? 'Ausstempeln' : 'Einstempeln'}</button>
    </div>
  </header>

  <section class="grid">
    <article class="card s3 fade-in">
      <div class="card-head"><h2 class="muted" style="font-weight:600">Geplant</h2><div class="icon-btn" style="color:var(--violet)">${icon('calendar-clock')}</div></div>
      <div class="big" style="font-size:32px">${hm(plannedMin)}<small> h</small></div>
      <div class="sub" style="margin-top:-6px">in dieser Woche eingetragen</div>
    </article>
    <article class="card s3 fade-in">
      <div class="card-head"><h2 class="muted" style="font-weight:600">Gearbeitet</h2><div class="icon-btn" style="color:var(--good)">${icon('briefcase')}</div></div>
      <div class="big" style="font-size:32px">${hm(workedMin)}<small> h</small></div>
      <div class="meter"><span data-anim="w" style="width:${plannedMin ? Math.min(100, (workedMin / plannedMin) * 100) : 0}%"></span></div>
    </article>
    <article class="card s3 fade-in">
      <div class="card-head"><h2 class="muted" style="font-weight:600">Bilanz bis jetzt</h2>
        ${dueMin || workedMin ? (balance >= 0 ? `<span class="delta up">${icon('trending-up')}im Plan</span>` : `<span class="delta down">${icon('trending-down')}hinterher</span>`) : ''}</div>
      <div class="big" style="font-size:32px;color:${balance < 0 ? 'var(--bad)' : 'var(--fg)'}">${balance > 0 ? '+' : ''}${hm(balance)}<small> h</small></div>
      <div class="sub" style="margin-top:-6px">gearbeitet minus bisher geplant</div>
    </article>
    <article class="card s3 fade-in">
      <div class="card-head"><h2 class="muted" style="font-weight:600">Verpasst</h2><div class="icon-btn" style="color:var(--bad)">${icon('hourglass')}</div></div>
      <div class="big" style="font-size:32px">${hm(missedMin)}<small> h</small></div>
      <div class="sub" style="margin-top:-6px">geplant, aber nicht eingestempelt</div>
    </article>

    <article class="card s12 fade-in sched-card">
      <div class="card-head">
        <div><h2>Wochenplan</h2><div class="sub">Klicken oder ziehen, um halbe Stunden einzutragen oder zu entfernen.</div></div>
        <div class="legend">
          <span><i class="lg lg-plan"></i>Geplant</span>
          <span><i class="lg lg-ok"></i>Gearbeitet</span>
          <span><i class="lg lg-miss"></i>Verpasst</span>
          <span><i class="lg lg-extra"></i>Extra</span>
          <span><i class="lg lg-pause"></i>Pause</span>
        </div>
      </div>
      <div class="sched-scroll" id="sched-scroll">
        <div class="sched">
          <div class="sched-corner">Zeitraum</div>
          ${cols.map((c) => `
            <div class="sched-day ${c.k === today ? 'today' : ''}">
              <div class="sd-name">${['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'][wdOf(c.k)]}</div>
              <div class="sd-date">${pad(parseKey(c.k).getDate())}.${pad(parseKey(c.k).getMonth() + 1)}.</div>
              <div class="sd-sum"><span>Plan ${hm(c.dayPlan)}</span><span class="${c.dayWorked >= c.dayPlan && c.dayPlan ? 'good' : ''}">Ist ${hm(c.dayWorked)}</span></div>
            </div>`).join('')}
          <div class="sched-times">
            ${Array.from({ length: 48 }, (_, i) => `<div class="t ${i % 2 ? 'half' : ''}">${slotRange(i, i + 1)}</div>`).join('')}
          </div>
          ${cols.map((c, ci) => `
            <div class="sched-col ${c.tone}">
              ${c.cells.map((s) => {
                const rs = s.planned && !c.plan.has(s.i - 1), re = s.planned && !c.plan.has(s.i + 1);
                let label = '';
                if (rs) { let e = s.i; while (c.plan.has(e + 1)) e++; label = `<span class="slot-label">${slotRange(s.i, e + 1)}</span>`; }
                const extraStart = s.st === 'extra' && (s.i === 0 || c.cells[s.i - 1].st !== 'extra');
                if (extraStart) label = '<span class="slot-label">extra</span>';
                return `<div class="slot ${s.st.split(' ').map((x) => `st-${x}`).join(' ')} ${s.planned ? 'planned' : ''} ${rs ? 'rs' : ''} ${re ? 're' : ''} ${s.i % 2 ? 'half' : ''}"
                  data-day="${c.k}" data-slot="${s.i}" style="--d:${ci * 35 + s.i * 6}ms"
                  title="${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][wdOf(c.k)]} ${slotRange(s.i, s.i + 1)} · ${STATUS_TEXT[s.st]}">${label}</div>`;
              }).join('')}
              ${c.k === today ? `<div class="now-line" style="top:${nowPct}%"><span>${pad(nowD.getHours())}:${pad(nowD.getMinutes())}</span></div>` : ''}
            </div>`).join('')}
        </div>
      </div>
    </article>

    <article class="card s12 fade-in">
      <div class="card-head">
        <div><h2>Stempelzeiten</h2><div class="sub">Deine Ein- und Ausstempel-Zeiten in dieser Woche. Vergessen? Trag die Zeit hier nach.</div></div>
      </div>
      <form class="add-session" id="add-session">
        <div class="field"><label for="as-day">Tag</label><input class="input" type="date" id="as-day" value="${today >= ws && today <= addDays(ws, 6) ? today : ws}" required></div>
        <div class="field"><label for="as-from">Von</label><input class="input" type="time" id="as-from" value="08:00" step="300" required></div>
        <div class="field"><label for="as-to">Bis</label><input class="input" type="time" id="as-to" value="16:00" step="300" required></div>
        <div class="field"><label for="as-pause">Pause in Min.</label><input class="input" type="number" id="as-pause" value="0" min="0" max="600" step="5"></div>
        <button class="btn" type="submit">${icon('plus')}Nachtragen</button>
        <span class="error" id="as-error"></span>
      </form>
      <div class="session-list">
        ${sess.length ? [...sess].sort((a, b) => Date.parse(b.start) - Date.parse(a.start)).map((s) => {
          const dur = workedMs(Date.parse(s.start), sessionEnd(s, now) + 1, [s], now) / 60000;
          const pauseMin = breakMs(Date.parse(s.start), sessionEnd(s, now) + 1, [s], now) / 60000;
          const k = keyOf(new Date(s.start));
          return `
          <div class="session-row ${s.end ? '' : 'running'}">
            <div class="habit-icon" style="--c:${s.end ? 'var(--good)' : 'var(--cyan)'}">${icon(s.end ? 'briefcase' : 'timer')}</div>
            <div><div class="habit-name" style="font-size:14px">${esc(fmtLong(k))}</div>
              <div class="habit-meta"><span>${icon('log-in')}${timeOf(s.start)}</span><span>${icon('log-out')}${s.end ? timeOf(s.end) : 'läuft'}</span>${pauseMin >= 1 ? `<span>${icon('coffee')}${Math.round(pauseMin)} Min. Pause</span>` : ''}</div></div>
            <div class="num">${fmtMin(dur)} h</div>
            ${ui.confirmSession === s.id
              ? `<div class="row-actions"><button class="btn small danger" data-action="session-del-yes" data-id="${s.id}">Löschen</button><button class="btn small ghost" data-action="session-del-no">Nein</button></div>`
              : `<button class="icon-btn" data-action="session-del" data-id="${s.id}" title="Eintrag löschen">${icon('trash-2')}</button>`}
          </div>`;
        }).join('') : '<div class="muted">In dieser Woche hast du dich noch nicht eingestempelt.</div>'}
      </div>
    </article>
  </section>`;
}

/* ================= Stempeluhr ================= */

function clockToggle() {
  const s = activeSession();
  const nowIso = new Date().toISOString();
  if (s) {
    const br = s.breaks?.find((b) => !b.end);
    if (br) br.end = nowIso;
    s.end = nowIso;
    const mins = workedMs(Date.parse(s.start), Date.parse(s.end) + 1, [s]) / 60000;
    if (mins < 1) {
      state.sessions = state.sessions.filter((x) => x !== s);
      toast('Ausgestempelt. Unter einer Minute, daher nicht gezählt.');
    } else toast(`Ausgestempelt · ${fmtMin(mins)} h gearbeitet`);
  } else {
    state.sessions.push({ id: uid(), start: nowIso, end: null, breaks: [] });
    toast('Eingestempelt. Deine Arbeitszeit läuft.');
  }
  save();
  renderClock();
  if (ui.view === 'schedule') render('update');
}

function pauseToggle() {
  const s = activeSession();
  if (!s) return;
  const br = (s.breaks ||= []).find((b) => !b.end);
  const nowIso = new Date().toISOString();
  if (br) {
    br.end = nowIso;
    toast(`Pause beendet nach ${Math.max(1, Math.round((Date.parse(br.end) - Date.parse(br.start)) / 60000))} Min. Weiter geht's.`);
  } else {
    s.breaks.push({ start: nowIso, end: null });
    toast('Pause gestartet. Sie zählt nicht als Arbeitszeit.');
  }
  save();
  renderClock();
  if (ui.view === 'schedule') render('update');
}

function renderClock() {
  const s = activeSession();
  const now = Date.now();
  const today = todayKey();
  const todayMs = workedMs(dayStart(today), dayStart(addDays(today, 1)), state.sessions, now);
  const br = s?.breaks?.find((b) => !b.end);
  const pill = document.getElementById('clock-pill');
  pill.hidden = !state.workEnabled;
  if (!state.workEnabled) { if (typeof syncTray === 'function') syncTray(); return; }
  const want = !s ? 'idle' : br ? 'pause' : 'run';
  // Inhalt nur beim Wechsel neu bauen, danach nur die Zeit aktualisieren
  if (pill.dataset.state !== want) {
    pill.dataset.state = want;
    pill.classList.toggle('running', want === 'run');
    pill.classList.toggle('paused', want === 'pause');
    pill.innerHTML = want === 'idle'
      ? `<button class="clock-main" data-action="clock" title="Arbeitszeit starten">${icon('timer')}<span class="clock-label">Einstempeln</span><span class="clock-today" id="clock-time"></span></button>`
      : `<span class="live-dot"></span>${want === 'pause' ? '<span class="clock-label">Pause</span>' : ''}<span class="clock-time" id="clock-time"></span>
         <button class="clock-icon" data-action="pause" title="${want === 'pause' ? 'Weiterarbeiten' : 'Pause machen'}" aria-label="${want === 'pause' ? 'Weiterarbeiten' : 'Pause machen'}">${icon(want === 'pause' ? 'play' : 'pause')}</button>
         <button class="clock-stop" data-action="clock" title="Ausstempeln" aria-label="Ausstempeln"><span></span></button>`;
    lucide.createIcons();
  }
  const t = document.getElementById('clock-time');
  if (want === 'run') t.textContent = fmtClock(workedMs(Date.parse(s.start), now + 1, [s], now));
  else if (want === 'pause') t.textContent = fmtClock(now - Date.parse(br.start));
  else t.textContent = todayMs >= 60000 ? `${fmtMin(todayMs / 60000)} h` : '';
  pill.title = s ? `Eingestempelt seit ${timeOf(s.start)} Uhr · heute ${fmtMin(todayMs / 60000)} h gearbeitet` : '';
  if (typeof syncTray === 'function') syncTray();
}

function addSession(e) {
  e.preventDefault();
  const day = document.getElementById('as-day').value;
  const f = document.getElementById('as-from').value, t = document.getElementById('as-to').value;
  const err = document.getElementById('as-error');
  if (!day || !f || !t) { err.textContent = 'Bitte Tag, Beginn und Ende ausfüllen.'; return; }
  const start = new Date(`${day}T${f}`), end = new Date(`${day}T${t}`);
  if (end <= start) end.setDate(end.getDate() + 1); // Nachtschicht über Mitternacht
  if (end.getTime() > Date.now()) { err.textContent = 'Das Ende liegt in der Zukunft. Für jetzt bitte einstempeln.'; return; }
  const overlap = state.sessions.some((s) => Date.parse(s.start) < end.getTime() && sessionEnd(s, Date.now()) > start.getTime());
  if (overlap) { err.textContent = 'Diese Zeit überschneidet sich mit einem vorhandenen Eintrag.'; return; }
  const pause = Math.max(0, Number(document.getElementById('as-pause').value) || 0);
  if (pause * 60000 >= end - start) { err.textContent = 'Die Pause ist länger als die Arbeitszeit.'; return; }
  const mid = (start.getTime() + end.getTime()) / 2;
  const breaks = pause ? [{ start: new Date(mid - pause * 30000).toISOString(), end: new Date(mid + pause * 30000).toISOString() }] : [];
  state.sessions.push({ id: uid(), start: start.toISOString(), end: end.toISOString(), breaks });
  save();
  toast(`${fmtMin((end - start) / 60000 - pause)} h nachgetragen`);
  render('update');
}

/* ================= Planen per Klicken und Ziehen ================= */

/* Vom ersten Feld bis zum Feld unter der Maus wird alles gesetzt (bzw. gelöscht). Zieht man wieder zurück, bekommen die
   Felder außerhalb dieses Bereichs ihren Zustand von vorher zurück, ohne dass man loslassen muss. */
function paintRange(cell) {
  const p = ui.paint;
  const d = cell.dataset.day, s = Number(cell.dataset.slot);
  if (p.cur === `${d}|${s}`) return;
  p.cur = `${d}|${s}`;
  const [d0, d1] = [p.day, d].sort(), [s0, s1] = [Math.min(p.slot, s), Math.max(p.slot, s)];
  const sets = {};
  for (const el of document.querySelectorAll('.slot')) {
    const k = el.dataset.day, i = Number(el.dataset.slot);
    const want = k >= d0 && k <= d1 && i >= s0 && i <= s1 ? p.value : (p.orig[k] || []).includes(i);
    const set = (sets[k] ||= new Set(state.plan[k] || []));
    if (want === set.has(i)) continue;
    if (want) set.add(i); else set.delete(i);
    el.classList.add('painting');
    el.classList.toggle('planned', want);
  }
  for (const [k, set] of Object.entries(sets)) if (set.size) state.plan[k] = [...set].sort((a, b) => a - b); else delete state.plan[k];
  p.changed = JSON.stringify(state.plan) !== p.origJson;
}

document.addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('.slot');
  if (!cell || e.button !== 0) return;
  e.preventDefault();
  const origJson = JSON.stringify(state.plan);
  ui.paint = { value: !(state.plan[cell.dataset.day] || []).includes(Number(cell.dataset.slot)), changed: false,
    day: cell.dataset.day, slot: Number(cell.dataset.slot), orig: JSON.parse(origJson), origJson, cur: null };
  paintRange(cell);
});
document.addEventListener('pointerover', (e) => {
  if (!ui.paint) return;
  const cell = e.target.closest('.slot');
  if (cell) paintRange(cell);
});
window.addEventListener('pointerup', () => {
  if (!ui.paint) return;
  const changed = ui.paint.changed;
  ui.paint = null;
  if (changed) { save(); render('update'); }
});

/* ================= Modal ================= */

function openModal(habit, preset) {
  const base = habit || {
    id: null, name: preset ? tr(preset.name) : '', icon: preset?.icon || ICONS[0], color: preset?.color || COLORS[0],
    days: [0, 1, 2, 3, 4, 5, 6], type: preset?.type || 'check', target: preset?.target || 1, unit: tr(preset?.unit || ''),
    step: preset?.step || 1, time: preset?.time || 'any',
  };
  ui.modal = { type: 'check', target: 1, unit: '', step: 1, time: 'any', ...base, days: [...base.days], confirmDelete: false, error: '' };
  const el = document.getElementById('modal');
  el.classList.remove('closing');
  renderModal(true);
}

function closeModal() {
  const el = document.getElementById('modal');
  ui.modal = null;
  ui.panel = null;
  if (ui.onb !== undefined && ui.onb !== null) { ui.onb = null; state.onboarded = true; save(); }
  if (el.hidden) return;
  if (reduceMotion) { el.hidden = true; el.innerHTML = ''; return; }
  el.classList.add('closing');
  setTimeout(() => {
    if (ui.modal || ui.panel) return;
    el.classList.remove('closing');
    el.hidden = true;
    el.innerHTML = '';
  }, 220);
}

function renderModal(opening = false) {
  const el = document.getElementById('modal');
  const m = ui.modal;
  if (!m) { closeModal(); return; }
  el.hidden = false;
  el.innerHTML = `
  <div class="modal ${opening ? 'enter' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title" style="--c:${m.color}">
    <div class="card-head">
      <h2 id="modal-title" style="font-size:20px;font-weight:800">${m.id ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit'}</h2>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button>
    </div>

    <div class="field">
      <label for="habit-name">Was willst du tun?</label>
      <input class="input" id="habit-name" maxlength="60" placeholder="z. B. 20 Minuten lesen" value="${esc(m.name)}" autocomplete="off">
      ${m.error ? `<div class="error">${m.error}</div>` : ''}
    </div>

    <div class="field">
      <div class="label">Wann am Tag?</div>
      <div class="seg-row">${DAYPARTS.map((p) => `<button class="${m.time === p.id ? 'on' : ''}" data-action="pick-time" data-time="${p.id}">${icon(p.icon)}${p.label}</button>`).join('')}</div>
    </div>

    <div class="field">
      <div class="label">Wie zählst du?</div>
      <div class="seg-row">
        <button class="${m.type !== 'amount' ? 'on' : ''}" data-action="pick-type" data-type="check">${icon('check')}Abhaken</button>
        <button class="${m.type === 'amount' ? 'on' : ''}" data-action="pick-type" data-type="amount">${icon('gauge')}Menge</button>
      </div>
      ${m.type === 'amount' ? `
      <div class="amount-fields">
        <div class="field"><label for="habit-target">Ziel pro Tag</label><input class="input" id="habit-target" inputmode="decimal" value="${esc(String(m.targetRaw ?? fmtNum(m.target)))}"></div>
        <div class="field"><label for="habit-unit">Einheit</label><input class="input" id="habit-unit" maxlength="16" placeholder="z. B. L, Seiten" value="${esc(m.unit)}"></div>
        <div class="field"><label for="habit-step">Pro Klick</label><input class="input" id="habit-step" inputmode="decimal" value="${esc(String(m.stepRaw ?? fmtNum(m.step)))}"></div>
      </div>` : ''}
    </div>

    <div class="field">
      <div class="label">Symbol</div>
      <div class="icon-grid">${ICONS.map((ic) => `<button class="${m.icon === ic ? 'on' : ''}" data-action="pick-icon" data-icon="${ic}" aria-label="${ic}">${icon(ic)}</button>`).join('')}</div>
    </div>

    <div class="field">
      <div class="label">Farbe</div>
      <div class="color-row">${COLORS.map((c) => `<button class="swatch ${m.color === c ? 'on' : ''}" style="--c:${c}" data-action="pick-color" data-color="${c}" aria-label="Farbe ${c}"></button>`).join('')}</div>
    </div>

    <div class="field">
      <div class="label">An welchen Tagen?</div>
      <div class="day-row">${WD.map((d, i) => `<button class="${m.days.includes(i) ? 'on' : ''}" data-action="pick-day" data-day="${i}" aria-pressed="${m.days.includes(i)}">${d}</button>`).join('')}</div>
      <div class="presets">
        <button class="btn small ghost" data-action="days-preset" data-set="all">Jeden Tag</button>
        <button class="btn small ghost" data-action="days-preset" data-set="work">Mo bis Fr</button>
        <button class="btn small ghost" data-action="days-preset" data-set="weekend">Wochenende</button>
      </div>
    </div>

    <div class="modal-foot">
      ${m.id ? (m.confirmDelete
        ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="error">Inklusive aller Einträge löschen?</span>
            <button class="btn small danger" data-action="delete-yes">Löschen</button>
            <button class="btn small ghost" data-action="delete-no">Nein</button></div>`
        : `<button class="btn small danger" data-action="delete">${icon('trash-2')}Löschen</button>`) : ''}
      <div class="right">
        <button class="btn ghost" data-action="close-modal">Abbrechen</button>
        <button class="btn primary" data-action="save-habit">${icon('check')}Speichern</button>
      </div>
    </div>
  </div>`;
  lucide.createIcons();
  const input = document.getElementById('habit-name');
  input.addEventListener('input', () => { ui.modal.name = input.value; });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveHabit(); });
  for (const [id, key] of [['habit-target', 'targetRaw'], ['habit-unit', 'unit'], ['habit-step', 'stepRaw']]) {
    document.getElementById(id)?.addEventListener('input', (e) => { ui.modal[key] = e.target.value; });
  }
  if (opening) input.focus();
}

function saveHabit() {
  const m = ui.modal;
  if (!m) return; // Doppelklick während das Fenster schon zugeht
  const name = m.name.trim();
  if (!name) { m.error = 'Gib der Gewohnheit einen Namen.'; renderModal(); return; }
  if (!m.days.length) { m.error = 'Wähle mindestens einen Tag aus.'; renderModal(); return; }
  const target = m.targetRaw !== undefined ? parseNum(m.targetRaw) : m.target;
  const step = m.stepRaw !== undefined ? parseNum(m.stepRaw) : m.step;
  if (m.type === 'amount' && !(target > 0)) { m.error = 'Gib ein Ziel größer als 0 ein, z. B. 2 oder 1,5.'; renderModal(); return; }
  if (m.type === 'amount' && !(step > 0)) { m.error = 'Gib an, wie viel ein Klick auf + zählt, z. B. 0,25.'; renderModal(); return; }
  const days = [...m.days].sort();
  const fields = { name, icon: m.icon, color: m.color, days, type: m.type, time: m.time, target: m.type === 'amount' ? target : 1, unit: m.type === 'amount' ? m.unit.trim() : '', step: m.type === 'amount' ? step : 1 };
  if (m.id) {
    const h = state.habits.find((x) => x.id === m.id);
    Object.assign(h, fields);
    toast('Gespeichert');
  } else {
    if (state.demo) clearDemo(false);
    state.habits.push({ id: uid(), ...fields, createdAt: todayKey(), archived: false });
    toast(`„${name}“ angelegt`);
  }
  closeModal();
  save();
  render('enter');
}

/* ================= Beispieldaten ================= */

function loadDemo() {
  const today = todayKey();
  const start = addDays(today, -120);
  const defs = [
    { ...SUGGESTIONS[0], days: [0, 1, 2, 3, 4, 5, 6], p0: 0.55, p1: 0.9 },
    { ...SUGGESTIONS[1], days: [0, 1, 2, 3, 4, 5, 6], p0: 0.4, p1: 0.75 },
    { ...SUGGESTIONS[2], days: [0, 2, 4], p0: 0.85, p1: 0.55 },
    { ...SUGGESTIONS[4], days: [6, 0, 1, 2, 3], p0: 0.6, p1: 0.4 },
    { ...SUGGESTIONS[5], days: [0, 1, 2, 3, 4, 5, 6], p0: 0.5, p1: 0.65 },
    { ...SUGGESTIONS[6], days: [0, 1, 2, 3, 4, 5, 6], p0: 0.7, p1: 0.72, late: 50 },
  ];
  state = { ...state, habits: [], log: {}, amounts: {}, badges: {}, demo: true, demoDays: [], journal: Object.fromEntries(Object.entries(state.journal).filter(([, j]) => !j.demo)) };
  const keys = range(start, addDays(today, -1));
  for (const d of defs) {
    const h = {
      id: uid(), name: tr(d.name), icon: d.icon, color: d.color, days: d.days, createdAt: d.late ? addDays(today, -d.late) : start, archived: false,
      type: d.type || 'check', target: d.target || 1, unit: tr(d.unit || ''), step: d.step || 1, time: d.time || 'any',
    };
    state.habits.push(h);
    keys.forEach((k, i) => {
      if (!scheduled(h, k)) return;
      const p = d.p0 + (d.p1 - d.p0) * (i / keys.length) - (wdOf(k) >= 5 ? 0.12 : 0);
      if (isAmount(h)) {
        const v = Math.random() < p ? h.target : Math.round((Math.random() * 0.8 * h.target) / h.step) * h.step;
        if (v > 0) (state.amounts[k] ||= {})[h.id] = v;
      } else if (Math.random() < p) (state.log[k] ||= []).push(h.id);
    });
  }
  // Stimmung hängt im Beispiel ein wenig an den erledigten Gewohnheiten
  const sport = state.habits.find((h) => h.name === tr('Sport'));
  for (const k of range(addDays(today, -75), addDays(today, -1))) {
    if (Math.random() < 0.15) continue;
    const r = dayRate(k) ?? 0.5;
    const m = Math.round(1.6 + r * 2.4 + (sport && done(sport, k) ? 0.6 : 0) + (Math.random() - 0.5) * 1.4);
    state.journal[k] = { mood: Math.min(5, Math.max(1, m)), demo: true };
  }

  // Arbeitszeiten: Mo–Fr 8:00–16:30 geplant, in der Vergangenheit meist gestempelt
  for (const k of range(addDays(mondayOf(today), -7), addDays(mondayOf(today), 6))) {
    if (wdOf(k) >= 5 || state.plan[k]) continue;
    state.plan[k] = Array.from({ length: 17 }, (_, n) => 16 + n);
    state.demoDays.push(k);
    if (k >= today) continue;
    const r = Math.random();
    if (r < 0.12) continue; // ganzer Tag verpasst
    const startMin = 8 * 60 + (r < 0.4 ? 60 + Math.round(Math.random() * 30) : Math.round(Math.random() * 10));
    const endMin = 16 * 60 + 30 + (r > 0.75 ? 45 : -Math.round(Math.random() * 20));
    const d0 = parseKey(k); d0.setMinutes(startMin);
    const d1 = parseKey(k); d1.setMinutes(endMin);
    const b0 = parseKey(k); b0.setMinutes(12 * 60);
    const b1 = parseKey(k); b1.setMinutes(12 * 60 + 30);
    const breaks = Math.random() < 0.8 ? [{ start: b0.toISOString(), end: b1.toISOString() }] : [];
    state.sessions.push({ id: uid(), start: d0.toISOString(), end: d1.toISOString(), breaks, demo: true });
  }
  syncBadges(false);
  if (typeof loadFinanceDemo === 'function') loadFinanceDemo();
  if (typeof loadFitnessDemo === 'function') loadFitnessDemo();
  save();
  toast('Beispieldaten geladen');
  render('enter');
}

function clearDemo(notify = true) {
  for (const k of state.demoDays || []) delete state.plan[k];
  state = {
    ...state, habits: [], log: {}, amounts: {}, badges: {}, demo: false, demoDays: [], sessions: state.sessions.filter((s) => !s.demo),
    journal: Object.fromEntries(Object.entries(state.journal).filter(([, j]) => !j.demo)),
  };
  if (typeof clearFinanceDemo === 'function') clearFinanceDemo();
  if (typeof clearFitnessDemo === 'function') clearFitnessDemo();
  save();
  if (notify) { toast('Beispieldaten gelöscht'); render('enter'); renderClock(); }
}

/* ================= Animationen ================= */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const memo = {}; // zuletzt angezeigte Werte je Ansicht, damit Zahlen von alt nach neu laufen

// Inhalte starten, wenn ihre Karte gerade sichtbar wird (passend zur Karten-Staffelung im CSS)
const STAGGER = 80;
function delayOf(el) {
  const card = el.closest('[data-i]');
  return card ? Number(card.dataset.i) * STAGGER + 260 : 200;
}
// weich auslaufend, ohne harten Stopp am Ende
const easeOut = (t) => 1 - Math.pow(1 - t, 5);

function tweenCount(el, from, to, dur, delay) {
  const hmFmt = el.dataset.fmt === 'hm';
  const suffix = el.dataset.suffix || '';
  const show = (v) => { el.textContent = hmFmt ? fmtMin(v) : `${Math.round(v)}${suffix}`; };
  const start = performance.now() + delay;
  show(from);
  const step = (now) => {
    if (!el.isConnected) return;
    const t = Math.min(1, Math.max(0, (now - start) / dur));
    show(from + (to - from) * easeOut(t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function runAnimations(root, mode, scope) {
  const enter = mode === 'enter';
  const store = (memo[scope] ||= { counts: [], anims: [] });
  [...root.querySelectorAll('.fade-in')].forEach((el, i) => {
    el.dataset.i = Math.min(i, 9);
    el.style.setProperty('--i', Math.min(i, 9));
  });
  root.classList.toggle('enter', enter && !reduceMotion);

  root.querySelectorAll('.count').forEach((el, i) => {
    const to = Number(el.dataset.to);
    const from = enter ? 0 : (store.counts[i] ?? to);
    store.counts[i] = to;
    if (!reduceMotion && from !== to) tweenCount(el, from, to, enter ? 2800 : 800, enter ? delayOf(el) : 0);
  });

  root.querySelectorAll('[data-anim]').forEach((el, i) => {
    const kind = el.dataset.anim;
    const prop = kind === 'h' ? 'height' : kind === 'w' ? 'width' : 'stroke-dashoffset';
    const to = el.style.getPropertyValue(prop);
    const from = enter ? (kind === 'ring' ? `${el.dataset.full}px` : '0%') : (store.anims[i] ?? to);
    store.anims[i] = to;
    if (reduceMotion || from === to) return;
    el.style.setProperty('--from', from);
    el.style.setProperty('--delay', `${enter ? delayOf(el) : 0}ms`);
    el.style.setProperty('--dur', enter ? '2.8s' : '.8s');
    el.classList.add(`a-${kind}`);
  });

  if (enter) {
    root.querySelectorAll('.a-draw, .a-area, .a-last').forEach((el) => el.style.setProperty('--delay', `${delayOf(el)}ms`));
    root.querySelectorAll('.heat').forEach((h) => {
      const base = delayOf(h);
      [...h.children].forEach((c, i) => c.style.setProperty('--d', `${base + i * 4}ms`));
    });
    // Haken der Monatsübersicht als Welle von links nach rechts
    root.querySelectorAll('.matrix tbody tr').forEach((tr, r) => {
      const base = delayOf(tr);
      tr.querySelectorAll('.mcheck').forEach((c) => c.style.setProperty('--d', `${base + c.parentElement.cellIndex * 14 + r * 30}ms`));
    });
  }
}

function burst(el, color) {
  if (reduceMotion || !el) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('span');
    p.className = 'spark';
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
    const d = 30 + Math.random() * 30;
    p.style.cssText = `left:${cx}px;top:${cy}px;--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px;background:${i % 2 ? color : 'var(--cyan)'}`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 750);
  }
}

/* ================= Rendern ================= */

// Jede Fortschrittsanzeige bekommt ihren Farbton aus dem Wert (Breite, Höhe oder Ring)
function applyProgress(root) {
  root.querySelectorAll('[data-anim="w"], [data-anim="h"], .meter > span').forEach((el) => {
    const v = parseFloat(el.style.width || el.style.height);
    if (el.dataset.hue) el.style.setProperty('--p', el.dataset.hue);
    else if (Number.isFinite(v)) el.style.setProperty('--p', progHue(v / 100));
  });
  root.querySelectorAll('[data-anim="ring"]').forEach((el) => {
    const full = Number(el.dataset.full), off = parseFloat(el.style.strokeDashoffset);
    if (el.dataset.hue) el.style.setProperty('--p', el.dataset.hue);
    else if (full) el.style.setProperty('--p', progHue(1 - off / full));
  });
}

// Der Lichtschein der Karten bleibt nach dem Neuzeichnen bei der Maus statt in die Mitte zu springen
const lastPtr = { x: -1, y: -1 };
function refreshSpot() {
  if (lastPtr.x < 0) return;
  const card = document.elementFromPoint(lastPtr.x, lastPtr.y)?.closest('.card');
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${lastPtr.x - r.left}px`);
  card.style.setProperty('--my', `${lastPtr.y - r.top}px`);
}

function moveNavIndicator() {
  let a = document.querySelector('.nav .nav-item.active');
  if (!state.sidebarMini && a?.closest('.nav-group.collapsed')) a = null;
  const ind = document.querySelector('.nav-indicator');
  if (!ind) return;
  ind.style.opacity = a ? '1' : '0';
  if (!a) return;
  ind.style.transform = `translateY(${a.offsetTop}px)`;
  ind.style.height = `${a.offsetHeight}px`;
}

// Menü-Bereiche auf- und zuklappen; welche zu sind, steht in state.navCollapsed
function applyNavGroups() {
  const closed = state.navCollapsed || [];
  document.querySelectorAll('[data-nav-group]').forEach((h) => {
    const id = h.dataset.navGroup;
    const g = document.querySelector(`.nav-group[data-group="${id}"]`);
    const c = closed.includes(id);
    h.setAttribute('aria-expanded', String(!c));
    h.classList.toggle('collapsed', c);
    g.classList.toggle('collapsed', c);
    // Eingefahren zeigt das Menü immer alle Symbole
    g.inert = c && !state.sidebarMini;
    // Zugeklappt, aber man ist gerade auf einer Seite darin: Überschrift hervorheben
    h.classList.toggle('has-active', c && !!g.querySelector('.nav-item.active'));
  });
  // Animation erst nach dem ersten Zeichnen, damit beim Start nichts zuklappt
  const nav = document.querySelector('.nav');
  if (!nav.classList.contains('nav-ready')) requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.add('nav-ready')));
}

function toggleNavGroup(id) {
  const closed = new Set(state.navCollapsed || []);
  if (closed.has(id)) closed.delete(id); else closed.add(id);
  state.navCollapsed = [...closed];
  save();
  applyNavGroups();
  followNavIndicator(360);
}

// Die Markierung läuft während einer Animation mit
function followNavIndicator(ms, done) {
  const nav = document.querySelector('.nav');
  nav.classList.add('nav-moving');
  const t0 = performance.now();
  const step = () => {
    moveNavIndicator();
    if (performance.now() - t0 < ms) requestAnimationFrame(step);
    else { nav.classList.remove('nav-moving'); moveNavIndicator(); done?.(); }
  };
  requestAnimationFrame(step);
}

// Ganzes Menü nach links einfahren, dann bleiben nur die Symbole (state.sidebarMini)
function applySidebarMini() {
  const mini = !!state.sidebarMini;
  document.querySelector('.app').classList.toggle('sb-mini', mini);
  const t = document.getElementById('sb-toggle');
  t.setAttribute('aria-expanded', String(!mini));
  t.setAttribute('aria-label', mini ? dt('Menü ausfahren', 'Expand menu') : dt('Menü einfahren', 'Collapse menu'));
  t.title = mini ? dt('Menü ausfahren (Strg+B)', 'Expand menu (Ctrl+B)') : dt('Menü einfahren (Strg+B)', 'Collapse menu (Ctrl+B)');
  // Eingefahren gibt es die Namen als Tooltip
  document.querySelectorAll('.sidebar .nav-item').forEach((b) => {
    const label = b.querySelector('span')?.textContent.trim();
    if (mini && label) b.title = label; else b.removeAttribute('title');
  });
}

function toggleSidebarMini() {
  state.sidebarMini = !state.sidebarMini;
  save();
  applySidebarMini();
  applyNavGroups();
  // Inhalte, die sich an der Breite ausrichten, nach der Animation neu messen lassen
  followNavIndicator(380, () => window.dispatchEvent(new Event('resize')));
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b' && !e.target.closest('input, textarea, [contenteditable="true"]')) {
    e.preventDefault();
    toggleSidebarMini();
  }
});

function renderSidebar() {
  const today = todayKey();
  const due = active().filter((h) => scheduled(h, today));
  const d = due.filter((h) => done(h, today)).length;
  document.getElementById('sb-value').textContent = due.length ? `${d} von ${due.length} erledigt` : 'Nichts geplant';
  const sb = document.getElementById('sb-meter');
  sb.style.width = `${due.length ? (d / due.length) * 100 : 0}%`;
  sb.style.setProperty('--p', progHue(due.length ? d / due.length : 0));
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === ui.view));
  document.getElementById('nav-schedule').classList.toggle('locked', !state.workEnabled);
  document.getElementById('nav-finance').classList.toggle('locked', !state.finance?.enabled);
  for (const v of ['fitness', 'training', 'nutrition']) document.getElementById(`nav-${v}`).classList.toggle('locked', !state.fitness?.enabled);
  applySidebarMini();
  applyNavGroups();
  const dueTasks = state.tasks.filter((t) => !t.done && t.due && t.due <= today).length;
  const tc = document.getElementById('nav-task-count');
  tc.textContent = dueTasks || '';
  tc.hidden = !dueTasks;
  moveNavIndicator();
  renderClock();
}

function render(mode = 'enter') {
  const view = document.getElementById('view');
  const main = document.querySelector('.scroller');
  const scroll = main.scrollTop;
  const schedScroll = document.getElementById('sched-scroll')?.scrollTop;
  view.innerHTML = ui.view === 'stats' ? viewStats() : ui.view === 'habits' ? viewHabits() : ui.view === 'schedule' ? viewSchedule()
    : ui.view === 'finance' ? viewFinance() : ui.view === 'fitness' ? viewFitness() : ui.view === 'training' ? viewTraining() : ui.view === 'nutrition' ? viewNutrition() : ui.view === 'calendar' ? viewCalendar() : ui.view === 'tasks' ? viewTasks() : ui.view === 'settings' ? viewSettings() : viewToday();
  renderSidebar();
  if (typeof syncTitleThought === 'function') syncTitleThought();
  lucide.createIcons();
  if (ui.view === 'settings') layoutSettings();
  runAnimations(view, mode, ui.view);
  applyProgress(view);
  refreshSpot();
  if (typeof afterRender === 'function') afterRender(mode);
  if (mode === 'update') main.scrollTop = scroll;

  const sc = document.getElementById('sched-scroll');
  if (sc) {
    if (mode === 'update' && schedScroll !== undefined) sc.scrollTop = schedScroll;
    else {
      // Zur aktuellen Uhrzeit (bzw. 7 Uhr) scrollen
      const row = sc.querySelector('.slot').offsetHeight;
      const h = new Date().getHours();
      sc.scrollTop = Math.max(0, (Math.min(h, 20) - 2) * 2 * row);
      if (h < 7) sc.scrollTop = 7 * 2 * row - row * 4;
    }
    document.getElementById('add-session')?.addEventListener('submit', addSession);
  }
}

/* Mittlerer Knopf beim Blättern: zeigt, welcher Tag, welche Woche oder welcher Monat gerade zu sehen ist.
   Ein Klick springt trotzdem zurück zu jetzt. Ist man woanders, steht ein kleiner Zurück-Pfeil davor. */
function navNowBtn(action, label, isNow, hint) {
  return `<button class="btn small nav-now ${isNow ? 'ghost' : ''}" data-action="${action}" data-dir="0" title="${esc(hint)}" aria-label="${esc(`${label} · ${hint}`)}">${isNow ? '' : icon('undo-2')}<span>${esc(label)}</span></button>`;
}
// „November“ im laufenden Jahr, sonst „November 2027“
function navMonthLabel(ym) {
  const d = parseKey(`${ym}-01`);
  const sameYear = ym.slice(0, 4) === todayKey().slice(0, 4);
  return new Intl.DateTimeFormat(LOCALE(), sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' }).format(d);
}
const navWeekLabel = (monday) => dt(`KW ${isoWeek(monday)}`, `Week ${isoWeek(monday)}`);
function navDayLabel(k) {
  const t = todayKey();
  if (k === t) return dt('Heute', 'Today');
  if (k === addDays(t, -1)) return dt('Gestern', 'Yesterday');
  if (k === addDays(t, 1)) return dt('Morgen', 'Tomorrow');
  return new Intl.DateTimeFormat(LOCALE(), { weekday: 'short', day: 'numeric', month: 'short' }).format(parseKey(k));
}

/* Blättern (Tag, Woche, Monat, Jahr): Boxen, deren Inhalt sich ändert, gleiten von ihrem Platz nach links hinaus,
   die neuen kommen von rechts herein. Zurückblättern läuft andersherum. Boxen, die gleich bleiben, stehen still.
   Dafür bleibt eine Kopie der alten Ansicht kurz über der neuen liegen. */
const SLIDE_SEL = '.card';
const slideDir = (from, to) => (to > from ? 1 : to < from ? -1 : 0);
// Was eine Box zeigt: Text und die Tage, auf die sie sich bezieht
const slideSig = (el) => el.textContent.replace(/\s+/g, ' ') + [...el.querySelectorAll('[data-day],[data-date],[data-month]')].map((x) => x.dataset.day || x.dataset.date || x.dataset.month).join(',');
const topCards = (root) => [...root.querySelectorAll(SLIDE_SEL)].filter((el) => !el.parentElement.closest(SLIDE_SEL));
let slideGhost = null, slideTimer;

function slideRender(dir) {
  const view = document.getElementById('view');
  slideGhost?.remove();
  slideGhost = null;
  if (reduceMotion || !dir) { render('update'); return; }
  const oldCards = topCards(view);
  const sigs = oldCards.map(slideSig);
  const oldEyebrow = view.querySelector('.head .eyebrow')?.textContent;
  const oldNow = [...view.querySelectorAll('.nav-now span')].map((s) => s.textContent);
  // Kopie der alten Ansicht samt Scroll-Positionen innerer Bereiche
  const scrolled = [...view.querySelectorAll('*')].map((el, i) => [i, el.scrollTop, el.scrollLeft]).filter(([, t, l]) => t || l);
  const ghost = view.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.classList.remove('enter');
  ghost.classList.add('slide-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  ghost.style.top = `${view.offsetTop}px`;
  ghost.style.left = `${view.offsetLeft}px`;
  ghost.style.width = `${view.offsetWidth}px`;

  render('update');

  const newCards = topCards(view);
  const all = newCards.length !== oldCards.length;
  const changed = newCards.map((el, i) => all || slideSig(el) !== sigs[i]);
  if (!changed.some(Boolean)) return;
  view.parentElement.appendChild(ghost);
  const ghostEls = ghost.querySelectorAll('*');
  for (const [i, t, l] of scrolled) { if (ghostEls[i]) { ghostEls[i].scrollTop = t; ghostEls[i].scrollLeft = l; } }
  const ghostCards = topCards(ghost);
  // Die alten Boxen sind schon fast weg, wenn die neuen sichtbar werden, so liegen kaum zwei halb durchsichtig übereinander.
  // Kurze Wege, sanftes Abbremsen und ein Hauch Tiefe (leicht verkleinert) wirken ruhiger als weite Sprünge.
  const leave = 'cubic-bezier(.4, 0, .7, .2)', arrive = 'cubic-bezier(.22, 1, .36, 1)';
  view.classList.add('sliding');
  let n = 0, last = 0;
  ghostCards.forEach((el, i) => {
    if (!all && !changed[i]) return;
    el.classList.add('slide-out');
    el.animate([
      { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
      { transform: `translate3d(${-dir * 22}px, 0, 0) scale(.99)`, opacity: 0, offset: .8 },
      { transform: `translate3d(${-dir * 28}px, 0, 0) scale(.985)`, opacity: 0 },
    ], { duration: 200, easing: leave, fill: 'both' });
  });
  n = 0;
  newCards.forEach((el, i) => {
    if (!changed[i]) return;
    const delay = 110 + Math.min(n++, 5) * 24;
    last = Math.max(last, delay + 560);
    el.style.willChange = 'transform, opacity';
    el.animate([
      { transform: `translate3d(${dir * 56}px, 0, 0) scale(.985)`, opacity: 0 },
      { transform: `translate3d(${dir * 10}px, 0, 0) scale(.997)`, opacity: 1, offset: .55 },
      { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
    ], { duration: 560, delay, easing: arrive, fill: 'backwards' }).finished.then(() => { el.style.willChange = ''; }, () => {});
  });
  view.querySelectorAll('.nav-now span').forEach((s, i) => {
    if (s.textContent === oldNow[i]) return;
    s.animate([{ transform: `translate3d(${dir * 10}px, 0, 0)`, opacity: 0 }, { transform: 'translate3d(0, 0, 0)', opacity: 1 }],
      { duration: 320, easing: arrive, fill: 'backwards' });
  });
  // Monat oder Woche oben in der Überschrift gleitet mit
  const eb = view.querySelector('.head .eyebrow');
  if (eb && oldEyebrow !== undefined && eb.textContent !== oldEyebrow) {
    eb.animate([{ transform: `translate3d(${dir * 14}px, 0, 0)`, opacity: 0 }, { transform: 'translate3d(0, 0, 0)', opacity: 1 }],
      { duration: 380, delay: 40, easing: arrive, fill: 'backwards' });
  }
  slideGhost = ghost;
  setTimeout(() => { if (slideGhost === ghost) slideGhost = null; ghost.remove(); }, 340);
  clearTimeout(slideTimer);
  slideTimer = setTimeout(() => view.classList.remove('sliding'), last);
}

let navTimer;
function go(view) {
  if (view === 'schedule' && !state.workEnabled) { openWorkUnlock(); return; }
  if (view === 'finance' && !state.finance?.enabled) { openFinanceUnlock(); return; }
  if (['fitness', 'training', 'nutrition'].includes(view) && !state.fitness?.enabled) { openFitnessUnlock(); return; }
  if (view === ui.view) return;
  ui.view = view;
  ui.confirmReset = false;
  ui.confirmSession = null;
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  moveNavIndicator();
  const el = document.getElementById('view');
  const main = document.querySelector('.scroller');
  clearTimeout(navTimer);
  slideGhost?.remove();
  if (reduceMotion) { main.scrollTop = 0; render('enter'); return; }
  el.classList.add('leave');
  navTimer = setTimeout(() => {
    el.classList.remove('leave');
    main.scrollTop = 0;
    render('enter');
  }, 180);
}

function quickToggle(id, day, btn) {
  const h = state.habits.find((x) => x.id === id);
  if (!h) return;
  toggle(h, day);
  if (ui.view !== 'today' && ui.view !== 'habits') return;
  const mScroll = document.querySelector('.matrix-scroll')?.scrollLeft;
  render('update');
  const ms = document.querySelector('.matrix-scroll');
  if (ms && mScroll !== undefined) ms.scrollLeft = mScroll;
  if (!done(h, day)) return;
  const kind = ['check', 'mcheck'].find((c) => btn?.classList.contains(c)) || 'dot';
  const again = document.querySelector(`.${kind}[data-id="${id}"][data-day="${day}"]`);
  if (!again) return;
  again.classList.add('pop');
  if (kind === 'check') again.closest('.habit-row')?.classList.add('just-done');
  burst(again, h.color);
  xpPop(again, XP.habit);
}

function setAmount(h, k, v) {
  const day = { ...(state.amounts[k] || {}) };
  if (v > 0) day[h.id] = Math.round(v * 1000) / 1000; else delete day[h.id];
  if (Object.keys(day).length) state.amounts[k] = day; else delete state.amounts[k];
}

function toggle(h, k) {
  const was = done(h, k);
  if (isAmount(h)) setAmount(h, k, was ? 0 : h.target);
  else {
    const arr = (state.log[k] || []).filter((id) => id !== h.id);
    if (!was) arr.push(h.id);
    if (arr.length) state.log[k] = arr; else delete state.log[k];
  }
  afterChange(h, k, was);
}

function afterChange(h, k, was) {
  save();
  const today = todayKey();
  if (was || !done(h, k)) return;
  checkBadges(h);
  if (k === today) {
    const due = active().filter((x) => scheduled(x, today));
    if (due.length && due.every((x) => done(x, today))) toast('Perfekter Tag! Alles erledigt.');
  }
}

function changeAmount(id, k, value) {
  const h = state.habits.find((x) => x.id === id);
  if (!h || !Number.isFinite(value)) return;
  const was = done(h, k);
  setAmount(h, k, Math.max(0, value));
  afterChange(h, k, was);
  const mScroll = document.querySelector('.matrix-scroll')?.scrollLeft;
  render('update');
  if (!was && done(h, k)) {
    const el = document.querySelector(`.amount .amt-btn.plus[data-id="${id}"]`);
    el?.closest('.habit-row')?.classList.add('just-done');
    burst(el, h.color);
    xpPop(el, XP.habit);
  }
  const ms = document.querySelector('.matrix-scroll');
  if (ms && mScroll !== undefined) ms.scrollLeft = mScroll;
}

/* ================= Hell / Dunkel ================= */

function markTheme(mode) {
  if (mode === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
  document.querySelectorAll('[data-theme-mode]').forEach((b) => b.classList.toggle('on', b.dataset.themeMode === mode));
}

function applyTheme(mode, fromEl) {
  state.theme = mode;
  save();
  const update = async () => { try { await window.api?.setTheme(mode); } catch { /* nur Fensterknöpfe */ } markTheme(mode); };
  if (!fromEl || !document.startViewTransition || reduceMotion) { update(); return; }
  const r = fromEl.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const t = document.startViewTransition(update);
  t.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' },
    );
  });
}

/* ================= Events ================= */

document.addEventListener('click', (e) => {
  if (e.target.closest('#sb-toggle')) { toggleSidebarMini(); return; }
  const navGroup = e.target.closest('[data-nav-group]');
  if (navGroup) { toggleNavGroup(navGroup.dataset.navGroup); return; }
  const nav = e.target.closest('.nav-item');
  if (nav) { go(nav.dataset.view); return; }

  const themeBtn = e.target.closest('[data-theme-mode]');
  if (themeBtn) { if (themeBtn.dataset.themeMode !== (state.theme || 'system')) applyTheme(themeBtn.dataset.themeMode, themeBtn); return; }

  const el = e.target.closest('[data-action]');
  if (!el) {
    if (e.target.id === 'modal') closeModal();
    return;
  }
  const a = el.dataset.action;
  const m = ui.modal;
  switch (a) {
    case 'toggle': quickToggle(el.dataset.id, el.dataset.day, el); break;
    case 'new-habit': openModal(null); break;
    case 'suggest': openModal(null, SUGGESTIONS[Number(el.dataset.i)]); break;
    case 'edit': openModal(state.habits.find((h) => h.id === el.dataset.id)); break;
    case 'archive': {
      const h = state.habits.find((x) => x.id === el.dataset.id);
      h.archived = !h.archived;
      save(); render('update');
      toast(h.archived ? 'Pausiert. Sie zählt nicht mehr in die Statistik.' : 'Weiter geht’s');
      break;
    }
    case 'period': ui.period = Number(el.dataset.days); render('enter'); break;
    case 'demo': loadDemo(); break;
    case 'clear-demo': clearDemo(); break;
    case 'reveal': window.api?.revealData(); break;
    case 'reset': ui.confirmReset = true; render('update'); break;
    case 'reset-no': ui.confirmReset = false; render('update'); break;
    case 'reset-yes':
      ui.confirmReset = false;
      state = { ...emptyState(), theme: state.theme };
      save(); toast('Alles gelöscht'); render('enter');
      break;
    case 'clock': clockToggle(); break;
    case 'pause': pauseToggle(); break;
    case 'amount': {
      const h = state.habits.find((x) => x.id === el.dataset.id);
      if (h) changeAmount(h.id, el.dataset.day, amountOf(h, el.dataset.day) + Number(el.dataset.delta) * h.step);
      break;
    }
    case 'pick-time': m.time = el.dataset.time; renderModal(); break;
    case 'pick-type': m.type = el.dataset.type; renderModal(); break;
    case 'goto': go(el.dataset.view); break;
    case 'week': {
      const dir = Number(el.dataset.dir);
      const cur = ui.weekStart || mondayOf(todayKey());
      ui.weekStart = dir === 0 ? mondayOf(todayKey()) : addDays(cur, dir * 7);
      slideRender(slideDir(cur, ui.weekStart));
      break;
    }
    case 'month': {
      const dir = Number(el.dataset.dir);
      const [y, mo] = (ui.month || todayKey().slice(0, 7)).split('-').map(Number);
      const d = dir === 0 ? new Date() : new Date(y, mo - 1 + dir, 1);
      const from = `${y}-${pad(mo)}`;
      ui.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      slideRender(slideDir(from, ui.month));
      break;
    }
    case 'session-del': ui.confirmSession = el.dataset.id; render('update'); break;
    case 'session-del-no': ui.confirmSession = null; render('update'); break;
    case 'session-del-yes':
      state.sessions = state.sessions.filter((s) => s.id !== el.dataset.id);
      ui.confirmSession = null; save(); renderClock(); render('update'); toast('Eintrag gelöscht');
      break;
    case 'close-modal': closeModal(); break;
    case 'pick-icon': m.icon = el.dataset.icon; renderModal(); break;
    case 'pick-color': m.color = el.dataset.color; renderModal(); break;
    case 'pick-day': {
      const d = Number(el.dataset.day);
      m.days = m.days.includes(d) ? m.days.filter((x) => x !== d) : [...m.days, d];
      renderModal(); break;
    }
    case 'days-preset':
      m.days = { all: [0, 1, 2, 3, 4, 5, 6], work: [0, 1, 2, 3, 4], weekend: [5, 6] }[el.dataset.set];
      renderModal(); break;
    case 'save-habit': saveHabit(); break;
    case 'delete': m.confirmDelete = true; renderModal(); break;
    case 'delete-no': m.confirmDelete = false; renderModal(); break;
    case 'delete-yes': {
      state.habits = state.habits.filter((h) => h.id !== m.id);
      for (const k of Object.keys(state.log)) {
        state.log[k] = state.log[k].filter((id) => id !== m.id);
        if (!state.log[k].length) delete state.log[k];
      }
      closeModal(); save(); render('enter'); toast('Gelöscht');
      break;
    }
    default: extrasAction(a, el);
  }
});

// Mengen direkt eintippen
document.addEventListener('change', (e) => {
  if (!e.target.matches('.amt-input')) return;
  const v = parseNum(e.target.value || '0');
  if (!Number.isFinite(v)) { toast('Bitte eine Zahl eingeben, z. B. 1,5'); render('update'); return; }
  changeAmount(e.target.dataset.id, e.target.dataset.day, v);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('.amt-input')) e.target.blur();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (ui.modal || ui.panel)) closeModal();
});

// Lichtschein auf den Karten folgt der Maus
document.addEventListener('pointermove', (e) => {
  lastPtr.x = e.clientX;
  lastPtr.y = e.clientY;
  const card = e.target.closest?.('.card');
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${e.clientX - r.left}px`);
  card.style.setProperty('--my', `${e.clientY - r.top}px`);
});

window.addEventListener('resize', moveNavIndicator);
// Breite Diagramme nach dem Ändern der Fenstergröße neu zeichnen
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (['stats', 'habits'].includes(ui.view) && !ui.modal) render('update'); }, 250);
});

// Uhr jede Sekunde, Stundenplan jede Minute, neuer Tag um Mitternacht
let lastDay = todayKey();
let tick = 0;
setInterval(() => {
  renderClock();
  tick++;
  if (todayKey() !== lastDay) { lastDay = todayKey(); render('enter'); return; }
  if (tick % 60 === 0 && ui.view === 'schedule' && !ui.paint && !ui.modal) render('update');
}, 1000);

