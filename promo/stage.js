'use strict';

/* Bühne (Version 3): ruhiger Produktfilm mit Gesamtansichten und gezielten Zooms. Zu jeder Zeit t berechnet renderAt(t) das komplette Bild.
   Die Kamera richtet sich auf Elemente der echten App aus, Aktionen und Klicks laufen in der App selbst. */

const TL = window.TIMELINE;
const { E } = TL;
const bar = TL.bar;
const W = TL.width, H = TL.height;
const FW = 1600, FH = 960; // Größe des App-Fensters
const $ = (id) => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 4);
const easeOutBack = (k) => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const prog = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = (n = 2) => new Promise((r) => { const step = () => (--n <= 0 ? r() : requestAnimationFrame(step)); requestAnimationFrame(step); });

// Fester Zufall, damit jedes Rendern gleich aussieht
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }

let appWin = null, appDoc = null;
const P = () => appWin.__promo;

/* ================= Vorbereitung ================= */

async function prepare() {
  localStorage.clear();
  localStorage.setItem('tageswerk', JSON.stringify({
    habits: [], onboarded: true, workEnabled: false,
    settings: { lang: 'de', weeklyReview: false, remindHabits: false, remindShift: false, remindEvents: false, remindClockOut: false },
  }));
  const ifr = $('app');
  const loaded = new Promise((r) => { ifr.onload = r; });
  ifr.src = '../src/index.html';
  await loaded;
  appWin = ifr.contentWindow;
  appDoc = ifr.contentDocument;
  await sleep(1200);
  // Keine Feiern oder Hinweise mitten im Video
  appWin.celebrateBadge = () => {};
  appWin.checkLevelUp = () => appWin.renderLevelCard();
  appWin.maybeShowReview = () => {};
  appWin.closeModal();
  appWin.loadDemo();
  // state und ui sind in der App mit let/const angelegt: Zugriff über eine kleine Skript-Datei im App-Fenster
  await new Promise((r) => { const sc = appDoc.createElement('script'); sc.src = '../promo/bridge.js'; sc.onload = r; appDoc.head.appendChild(sc); });
  const st = appDoc.createElement('style');
  st.textContent = '.demo-banner, .toast { display: none !important; } ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }';
  appDoc.head.appendChild(st);
  P().setup();
  appWin.renderSidebar();
  appWin.renderLevelCard();
  await sleep(400);
  await document.fonts.ready;
  await appDoc.fonts.ready;
  $('intro-title').innerHTML = [...'Tageswerk'].map((c) => `<span>${c}</span>`).join('');
  buildCaptions();
  buildOutro();
  return 'bereit';
}

const words = (text) => text.split(' ').map((w) => `<span class="word">${w} </span>`).join('');

function buildCaptions() {
  $('captions').innerHTML = TL.captions.map((c, i) => {
    if (c.side === 'tag') return `<div class="cap tag" id="cap-${i}"><div class="cap-title word">${c.title[0]}</div></div>`;
    const title = c.title.length === 1
      ? `<span class="cap-line grad">${words(c.title[0])}</span>`
      : `<span class="cap-line">${words(c.title[0])}</span><span class="cap-line grad">${words(c.title[1])}</span>`;
    return `<div class="cap ${c.side}" id="cap-${i}"><span class="cap-eyebrow word">${c.eyebrow}</span><div class="cap-title">${title}</div>${c.sub ? `<div class="cap-sub">${words(c.sub)}</div>` : ''}</div>`;
  }).join('');
}

function buildOutro() {
  const f = ['Gewohnheiten', 'Aufgaben', 'Kalender', 'Arbeitszeit', 'Finanzen', 'Level'];
  $('outro-features').innerHTML = f.map((x, i) => `<span>${x}</span>${i < f.length - 1 ? '<i>·</i>' : ''}`).join('');
}

/* ================= Elemente der App finden ================= */

const q = (sel) => appDoc.querySelector(sel);
const qa = (sel) => [...appDoc.querySelectorAll(sel)];
const card = (title) => () => qa('.card').find((c) => c.querySelector('h2')?.textContent.trim().startsWith(title));
const meeting = () => qa('.wk-ev.movable').find((e) => e.textContent.includes('Team-Meeting'));

// Zeile der Monatsübersicht mit einem offenen Tag weit rechts, zum Nachtragen
let ovRow = null, ovCell = null;
function pickMatrixRow() {
  let best = null;
  for (const tr of qa('.matrix tbody tr')) {
    const open = [...tr.querySelectorAll('button.mcheck:not(.on):not(.amt)')];
    const on = tr.querySelectorAll('.mcheck.on').length;
    const cell = open.filter((c) => c.parentElement.cellIndex > 14).pop();
    if (cell && (!best || on > best.on)) best = { tr, cell, on };
  }
  ovRow = best?.tr || q('.matrix tbody tr');
  ovCell = best?.cell || ovRow?.querySelector('.mcheck');
}

// Mittelpunkt eines Elements in Koordinaten des App-Fensters
function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

// Element in den sichtbaren Bereich scrollen
function bring(el) {
  const sc = el.closest('#scroller');
  if (!sc) return;
  const r = el.getBoundingClientRect();
  sc.scrollTop += r.top + Math.min(r.height, 700) / 2 - FH / 2 - 20;
}

function resolve(f, doBring) {
  if (!f) return { x: FW / 2, y: FH / 2 };
  if (f === 'cursor') return { x: cur.x, y: cur.y };
  if (typeof f === 'object' && 'x' in f) return f;
  const el = typeof f === 'function' ? f() : q(f);
  if (!el) return null;
  if (el.x !== undefined) return el;
  if (doBring) bring(el);
  return centerOf(el);
}

/* ================= Aktionen in der App ================= */

let build = null;
// Aufbau-Animation nachgebaut: Balken, Ringe, Linien und Zahlen wachsen von 0 auf ihren Wert
function startBuild(t0, dur = 1.5) {
  const items = [];
  const delay = (el) => { const r = el.getBoundingClientRect(); return clamp(r.top / FH) * 0.3 + clamp(r.left / FW) * 0.3; };
  for (const el of qa('[data-anim="w"], .fin-cat-bar > span')) items.push({ el, kind: 'w', to: el.style.width, d: delay(el) });
  for (const el of qa('[data-anim="h"]')) items.push({ el, kind: 'h', to: el.style.height, d: delay(el) });
  for (const el of qa('[data-anim="ring"]')) items.push({ el, kind: 'ring', to: parseFloat(el.style.strokeDashoffset) || 0, full: Number(el.dataset.full) || 0, d: delay(el) });
  for (const el of qa('.a-draw')) { try { items.push({ el, kind: 'draw', len: el.getTotalLength(), d: delay(el) * 0.5 }); } catch { /* kein Pfad */ } }
  for (const el of qa('.a-area, .a-last')) items.push({ el, kind: 'fade', d: delay(el) * 0.5 + 0.2 });
  for (const el of qa('.mcheck.on, .heat > *')) items.push({ el, kind: 'pop', d: delay(el) });
  for (const el of qa('.count')) {
    const txt = el.textContent;
    const m = el.children.length ? null : txt.match(/-?\d{1,3}(?:\.\d{3})+(?:,\d+)?|-?\d+(?:,\d+)?/);
    if (!m || txt.includes(':')) continue;
    const dec = m[0].includes(',') ? m[0].split(',')[1].length : 0;
    items.push({ el, kind: 'count', txt, raw: m[0], dec, val: parseFloat(m[0].replace(/\./g, '').replace(',', '.')), d: delay(el) * 0.6 });
  }
  build = { t0, dur, items };
}

function applyBuild(t) {
  if (!build) return;
  const p = ((t - build.t0) / build.dur) * 1.15;
  const done = p >= 1.15;
  for (const it of build.items) {
    const k = done ? 1 : easeOut(clamp((p - it.d) / 0.55));
    const el = it.el;
    if (it.kind === 'w') el.style.width = done ? it.to : `calc(${it.to} * ${k})`;
    else if (it.kind === 'h') el.style.height = done ? it.to : `calc(${it.to} * ${k})`;
    else if (it.kind === 'ring') el.style.strokeDashoffset = `${lerp(it.full, it.to, k)}px`;
    else if (it.kind === 'draw') { el.style.strokeDasharray = done ? '' : `${it.len} ${it.len}`; el.style.strokeDashoffset = done ? '' : `${it.len * (1 - k)}`; }
    else if (it.kind === 'fade') el.style.opacity = done ? '' : k;
    else if (it.kind === 'pop') { el.style.transform = done ? '' : `scale(${easeOutBack(k) * 0.999 + 0.001})`; el.style.opacity = done ? '' : clamp(k * 2); }
    else if (it.kind === 'count') {
      el.textContent = done ? it.txt : it.txt.replace(it.raw, (it.val * k).toLocaleString('de-DE', { minimumFractionDigits: it.dec, maximumFractionDigits: it.dec }));
    }
  }
  if (done) build = null;
}

// Zeiger-Ereignisse für das Verschieben im Kalender
function pointer(type, target, x, y) {
  target.dispatchEvent(new appWin.PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
}

/* ================= Drehbuch: Aktionen, Kamera, Mauszeiger ================= */

const C = { x: FW / 2, y: FH / 2 };

// Aktionen in der App, jeweils einmal zur Zeit t
const ACTS = [
  { t: 15, fn: (t) => { P().go('stats'); startBuild(t, 2.2); } },
  { t: 22.5, fn: (t) => { P().habitsPrevMonth(); pickMatrixRow(); startBuild(t, 2.2); } },
  { t: 31.25, fn: () => { P().calMode('week'); const s = q('#wk-scroll'); if (s) s.scrollTop = 8 * 48 - 10; } },
  { t: 40, fn: () => P().go('today') },
  { t: E.workCut, fn: (t) => { P().enableWork(); startBuild(t, 1.8); } },
  { t: 52.5, fn: () => P().go('today') },
  { t: 60, fn: (t) => { P().enableFinance(); startBuild(t, 2.2); } },
  { t: 67.5, fn: () => P().go('today') },
  { t: 75, fn: (t) => { P().go('tasks'); startBuild(t, 1.2); } },
  { t: 77.5, fn: (t) => { P().theme('light'); P().go('today'); startBuild(t, 1.5); } },
  { t: 80, fn: () => { P().theme('dark'); P().calMode('month'); } },
];

/* Kamera-Punkte. f: worauf gezielt wird (Selektor, Funktion, 'cursor' oder Punkt), s: Zoom,
   sx/sy: wo dieser Punkt auf dem Bild landet, rx/ry/rz: Neigung, cut: Schnitt statt Fahrt,
   bring: Element vorher in den sichtbaren Bereich scrollen, o/blur: Deckkraft und Unschärfe des Fensters. */
const K = [];
const key = (t, o) => K.push({ t, sx: W / 2, sy: H / 2, s: 1, rx: 0, ry: 0, rz: 0, o: 1, blur: 0, ...o });
// Gesamtansicht: Fenster neben dem Text, leicht zum Text gedreht
const WIDE = { left: { f: C, s: 0.72, sx: 1290, sy: 560, ry: -9, rx: 3 }, right: { f: C, s: 0.72, sx: 630, sy: 560, ry: 9, rx: 3 } };
const wide = (t, side, o = {}) => key(t, { ...WIDE[side], ...o });
const near = (sx) => ({ sx, sy: 560, ry: 0, rx: 0 });

key(0, { f: C, s: 0.6, o: 0 });
// Heute: Fenster gleitet herein, dann Abhaken und Stimmung aus der Nähe
key(5.0, { f: C, s: 0.55, sx: 1290, sy: 620, rx: 18, ry: -24, o: 0, cut: true });
wide(6.4, 'left', { ease: 'soft' });
wide(7.6, 'left', { s: 0.74 });
const CHECK = '.habit-row:not(.is-done):not(.is-amount) .check';
key(8.8, { f: CHECK, s: 1.7, ...near(1240) });
key(10.2, { f: CHECK, s: 1.75, ...near(1240) });
wide(11.4, 'left');
key(12.6, { f: '.mood-4', s: 1.55, ...near(1240) });
key(15 - 0.01, { f: '.mood-4', s: 1.6, ...near(1240) });
// Statistiken
wide(15, 'right', { cut: true });
wide(17.4, 'right', { s: 0.74, ry: 6 });
key(18.8, { f: card('Verlauf'), s: 1.2, ...near(660) });
key(20.6, { f: card('Verlauf'), s: 1.24, ...near(660) });
wide(22.5 - 0.01, 'right', { s: 0.76 });
// Übersicht: Monat zeigen, eine Zeile entlang zum offenen Tag, nachtragen, wieder zurück
wide(22.5, 'left', { cut: true });
wide(25, 'left', { s: 0.74 });
key(26.4, { f: () => ovCell, s: 1.7, ...near(1240) });
key(28.2, { f: () => ovCell, s: 1.75, ...near(1240) });
wide(29.5, 'left');
wide(31.25 - 0.01, 'left', { s: 0.74 });
// Kalender: Termin verschieben, Kamera folgt dem Zeiger
wide(31.25, 'right', { cut: true });
wide(32.9, 'right', { s: 0.74 });
key(34.3, { f: meeting, s: 1.45, ...near(680) });
key(E.dragStart, { f: 'cursor', s: 1.45, ...near(680) });
key(E.dragEnd, { f: 'cursor', s: 1.45, ...near(680) });
key(37.6, { f: 'cursor', s: 1.45, ...near(680) });
wide(38.8, 'right');
wide(40 - 0.01, 'right', { s: 0.74 });
// Arbeit freischalten
wide(40, 'left', { cut: true });
wide(41.2, 'left', { s: 0.74 });
key(42.4, { f: '#nav-schedule', s: 1.8, ...near(1200) });
key(E.lockClick + 0.35, { f: '#nav-schedule', s: 1.85, ...near(1200) });
key(45.0, { f: '.modal', s: 1.15, ...near(1260) });
key(46.3, { f: '.modal', s: 1.17, ...near(1260) });
key(E.activateClick, { f: '[data-action="work-enable"]', s: 1.4, ...near(1260) });
key(E.workCut - 0.01, { f: '[data-action="work-enable"]', s: 1.42, ...near(1260) });
wide(E.workCut, 'left', { cut: true });
wide(49.8, 'left', { s: 0.74 });
key(50.8, { f: '#clock-pill', s: 1.6, ...near(1200), sy: 520 });
key(52.5 - 0.01, { f: '#clock-pill', s: 1.65, ...near(1200), sy: 520 });
// Finanzen freischalten
wide(52.5, 'left', { cut: true });
key(53.6, { f: '#nav-finance', s: 1.8, ...near(1200) });
key(E.finLockClick + 0.35, { f: '#nav-finance', s: 1.85, ...near(1200) });
key(55.8, { f: '.modal', s: 1.15, ...near(1260) });
key(57.0, { f: '.modal', s: 1.17, ...near(1260) });
key(E.fileDrop, { f: '[data-action="fin-unlock-import"]', s: 1.4, ...near(1260) });
key(60 - 0.01, { f: '[data-action="fin-unlock-import"]', s: 1.42, ...near(1260) });
// Finanzen
wide(60, 'right', { cut: true });
wide(62.0, 'right', { s: 0.74 });
key(63.4, { f: card('Ausgaben nach Kategorie'), s: 1.1, ...near(660) });
key(65.4, { f: card('Ausgaben nach Kategorie'), s: 1.13, ...near(660) });
wide(67.5 - 0.01, 'right');
// Level
key(67.5, { f: C, s: 0.8, sx: 960, sy: 560, rx: 6, cut: true });
key(68.4, { f: '#level-card', s: 2.0, sx: 960, sy: 560 });
key(E.levelPanel - 0.01, { f: '#level-card', s: 2.05, sx: 960, sy: 560 });
key(E.levelPanel, { f: '.modal', s: 1.25, sx: 960, sy: 640, rx: 4, cut: true });
key(75 - 0.01, { f: '.modal', s: 1.3, sx: 960, sy: 640, rx: 1 });
// Ruhige Folge: Aufgaben, heller Modus, Monatskalender
key(75, { f: C, s: 0.8, sy: 500, rx: 6, ry: -8, cut: true });
key(77.5 - 0.01, { f: C, s: 0.84, sy: 500, rx: 3, ry: -4 });
key(77.5, { f: C, s: 0.8, sy: 500, rx: 6, ry: 8, cut: true });
key(80 - 0.01, { f: C, s: 0.84, sy: 500, rx: 3, ry: 4 });
key(80, { f: C, s: 0.8, sy: 500, rx: 6, ry: -6, cut: true });
key(82.5 - 0.01, { f: C, s: 0.84, sy: 500, rx: 3, ry: -2 });
// Outro: Fenster kippt nach hinten weg
key(82.5, { f: C, s: 0.84, sy: 500, rx: 3 });
key(84.5, { f: C, s: 0.75, sy: 860, rx: 56, o: 0.15, blur: 8 });
key(TL.duration, { f: C, s: 0.72, sy: 880, rx: 58, o: 0.12, blur: 8 });
K.sort((a, b) => a.t - b.t);
const CUTS = K.filter((k) => k.cut && k.t > 5.5).map((k) => k.t);

/* Mauszeiger. to: Ziel, from: Startversatz zum Ziel, click: echter Klick (delay: etwas später),
   drag: Verschieben um [dx, dy], carry: trägt die Datei, hold: wie lange der Zeiger danach bleibt */
const CURSOR = [
  { t0: 8.0, t1: E.checkClick, to: CHECK, from: [-240, 150], click: true, xp: 10, hold: 0.9 },
  { t0: 12.2, t1: E.moodClick, to: '.mood-4', from: [200, 130], click: true, xp: 3, hold: 0.9 },
  { t0: 25.8, t1: E.matrixClick, to: () => ovCell, from: [-160, 170], click: true, xp: 10, hold: 0.9 },
  { t0: 33.6, t1: E.dragStart, to: meeting, from: [-200, 170], hold: 0 },
  { t0: E.dragStart, t1: E.dragEnd, drag: () => { const c = qa('.wk-col'); return [c.length > 1 ? centerOf(c[1]).x - centerOf(c[0]).x : 180, 72]; }, hold: 0.8 },
  { t0: 42.3, t1: E.lockClick, to: '#nav-schedule', from: [200, 150], click: true, delay: 0.4, lock: true, hold: 0.3 },
  { t0: 46.2, t1: E.activateClick, to: '[data-action="work-enable"]', from: [140, 160], burst: true, hold: 0.8 },
  { t0: 50.3, t1: E.clockClick, to: '.clock-main', from: [-190, 170], click: true, hold: 0.8 },
  { t0: 53.0, t1: E.finLockClick, to: '#nav-finance', from: [200, 150], click: true, delay: 0.4, lock: true, hold: 0.3 },
  { t0: 57.2, t1: E.fileDrop, to: '[data-action="fin-unlock-import"]', from: [460, 260], carry: true, burst: true, hold: 0.8 },
  { t0: 68.0, t1: E.levelClick, to: '#level-card', from: [-170, 150], click: true, delay: 0.3, hold: 0.3 },
];

/* ================= Kamera ================= */

const cache = new Map();
function keyParams(k, t, atCut) {
  let p = k.f === 'cursor' ? resolve('cursor') : cache.get(k);
  if (!p) {
    p = resolve(k.f, atCut && k.bring);
    if (!p) return null;
    cache.set(k, p);
  }
  return { tx: k.sx - W / 2 - k.s * (p.x - FW / 2), ty: k.sy - H / 2 - k.s * (p.y - FH / 2), s: k.s, rx: k.rx, ry: k.ry, rz: k.rz, o: k.o, blur: k.blur };
}

let lastCam = null;
function cameraAt(t) {
  let i = K.length - 1;
  while (i > 0 && K[i].t > t) i--;
  const a = K[i], b = K[i + 1];
  const pa = keyParams(a, t, true);
  if (!pa) return lastCam;
  let out = pa;
  if (b && !b.cut && t > a.t) {
    const pb = keyParams(b, t, false);
    if (pb) {
      const raw = (t - a.t) / (b.t - a.t);
      const e = b.ease === 'out' ? easeOutBack(clamp(raw)) : easeInOut(clamp(raw));
      out = {};
      for (const k of Object.keys(pa)) out[k] = lerp(pa[k], pb[k], e);
    }
  }
  lastCam = out;
  return out;
}

/* ================= Mauszeiger und Klicks ================= */

const cur = { x: 800, y: 480, scale: 1 };
const segState = CURSOR.map(() => ({ started: false, done: false }));
const fxEvents = []; // { kind, t, x, y, n, w, h }
const pending = []; // verzögerte Klicks, damit der Effekt vorher zu sehen ist

function updateCursor(t) {
  let vis = 0;
  CURSOR.forEach((seg, i) => {
    const st = segState[i];
    if (t >= seg.t0 && !st.started) {
      st.started = true;
      if (seg.drag) {
        const [dx, dy] = seg.drag();
        st.from = { x: cur.x, y: cur.y };
        st.to = { x: cur.x + dx, y: cur.y + dy };
        st.el = appDoc.elementFromPoint(cur.x, cur.y)?.closest('.wk-ev') || meeting();
        if (st.el) pointer('pointerdown', st.el, cur.x, cur.y);
      } else {
        const el = typeof seg.to === 'function' ? seg.to() : q(seg.to);
        const p = el ? centerOf(el) : { x: cur.x, y: cur.y };
        st.el = el;
        st.to = { x: p.x, y: p.y };
        st.from = seg.from ? { x: p.x + seg.from[0], y: p.y + seg.from[1] } : { x: cur.x, y: cur.y };
      }
    }
    const hold = seg.hold ?? 0.45;
    if (t >= seg.t0 - 0.12 && t <= seg.t1 + hold + 0.12) vis = Math.max(vis, Math.min(prog(t, seg.t0 - 0.12, seg.t0), 1 - prog(t, seg.t1 + hold, seg.t1 + hold + 0.12)));
    if (st.started && t < seg.t1) {
      const k = seg.drag ? easeInOut(prog(t, seg.t0, seg.t1)) : easeInOut(prog(t, seg.t0, seg.t1));
      const arc = seg.drag ? 0 : Math.sin(k * Math.PI) * Math.min(60, Math.hypot(st.to.x - st.from.x, st.to.y - st.from.y) * 0.15);
      cur.x = lerp(st.from.x, st.to.x, k);
      cur.y = lerp(st.from.y, st.to.y, k) - arc;
      if (seg.drag && st.el) pointer('pointermove', appDoc, cur.x, cur.y);
    }
    if (t >= seg.t1 && !st.done) {
      st.done = true;
      cur.x = st.to.x; cur.y = st.to.y;
      if (seg.drag) { if (st.el) pointer('pointermove', appDoc, cur.x, cur.y); pointer('pointerup', appDoc, cur.x, cur.y); }
      if (seg.click && st.el) { if (seg.delay) pending.push({ t: seg.t1 + seg.delay, el: st.el }); else st.el.click(); }
      fxEvents.push({ kind: 'ripple', t: seg.t1, x: cur.x, y: cur.y });
      if (seg.xp) { fxEvents.push({ kind: 'xp', t: seg.t1, x: cur.x, y: cur.y - 30, n: seg.xp }); fxEvents.push({ kind: 'sparks', t: seg.t1, x: cur.x, y: cur.y }); }
      if (seg.lock && st.el) { const r = st.el.getBoundingClientRect(); fxEvents.push({ kind: 'lock', t: seg.t1, x: r.left, y: r.top, w: r.width, h: r.height }); }
      if (seg.burst) { fxEvents.push({ kind: 'burst', t: seg.t1, x: cur.x, y: cur.y }); fxEvents.push({ kind: 'sparks', t: seg.t1, x: cur.x, y: cur.y, big: true }); }
    }
  });
  const lastClick = [...fxEvents].reverse().find((e) => e.kind === 'ripple' && t >= e.t);
  const since = lastClick ? t - lastClick.t : 9;
  cur.scale = since < 0.18 ? 1 - 0.2 * Math.sin((since / 0.18) * Math.PI) : 1;
  return vis;
}

// Die Datei „Kontoauszug.csv“, die auf den Knopf gezogen wird
function fileHtml(t) {
  const seg = CURSOR.find((s) => s.carry);
  if (t < seg.t0 - 0.12 || t > seg.t1 + 0.3) return '';
  const drop = prog(t, seg.t1, seg.t1 + 0.25);
  const k = 1 - easeOut(drop);
  return `<div class="file" style="transform:translate(${cur.x + 18}px, ${cur.y + 14}px) scale(${k}) rotate(${(1 - prog(t, seg.t0, seg.t1)) * -8}deg);opacity:${k};transform-origin:0 0">
    <i>CSV</i><div>Kontoauszug.csv<small>Sparkasse · 3 Monate</small></div></div>`;
}

function renderFx(t, camS) {
  let html = '';
  for (const e of fxEvents) {
    const a = t - e.t;
    if (a < 0) continue;
    if (e.kind === 'ripple' && a < 0.6) {
      const k = easeOut(a / 0.6);
      html += `<div class="ripple" style="left:${e.x}px;top:${e.y}px;transform:scale(${(0.3 + k * 1.3) / Math.max(1, camS * 0.6)});opacity:${1 - k}"></div>`;
    }
    if (e.kind === 'xp' && a < 1.3) {
      const k = a / 1.3;
      html += `<div class="xp-float" style="left:${e.x}px;top:${e.y - (easeOut(k) * 90) / camS}px;opacity:${k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4)};transform:translate(-50%,-50%) scale(${(0.7 + 0.3 * easeOutBack(Math.min(1, k * 3))) * 1.4 / camS})">+${e.n} XP</div>`;
    }
    if (e.kind === 'sparks' && a < 0.8) {
      const k = easeOut(a / 0.8);
      const r = rng(Math.round(e.t * 100));
      const n = e.big ? 26 : 14;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + r() * 0.5, d = ((e.big ? 90 : 40) + r() * (e.big ? 120 : 50)) / camS * 1.6;
        const col = ['#5ad8ff', '#9585ff', '#ffc46b', '#4fd6a4'][i % 4];
        html += `<span class="spark" style="left:${e.x + Math.cos(ang) * d * k}px;top:${e.y + Math.sin(ang) * d * k}px;background:${col};opacity:${1 - k};transform:scale(${(1 - k * 0.6) * 1.5 / camS})"></span>`;
      }
    }
    if (e.kind === 'burst' && a < 0.9) {
      for (const [delay, max] of [[0, 260], [0.12, 420]]) {
        const k = easeOut(clamp((a - delay) / 0.7));
        if (a < delay) continue;
        const r = (20 + k * max) / camS;
        html += `<div class="burst" style="left:${e.x - r}px;top:${e.y - r}px;width:${r * 2}px;height:${r * 2}px;opacity:${1 - k};border-width:${4 / camS}px"></div>`;
      }
    }
    if (e.kind === 'lock' && a < 0.7) {
      const k = a / 0.7;
      const pad = 4 + easeOut(k) * 10;
      const shake = Math.sin(a * 60) * 5 * (1 - k);
      html += `<div class="lockring" style="left:${e.x - pad + shake}px;top:${e.y - pad}px;width:${e.w + pad * 2}px;height:${e.h + pad * 2}px;opacity:${1 - k};border-width:${3 / Math.max(1, camS * 0.7)}px"></div>`;
    }
  }
  html += fileHtml(t);
  $('fx-frame').innerHTML = html;
}

/* ================= Hintergrund ================= */

const stars = (() => { const r = rng(7); return Array.from({ length: 110 }, () => ({ x: r() * W, y: r() * H, s: 0.6 + r() * 1.8, sp: 6 + r() * 18, ph: r() * 6.28 })); })();
function drawBackground(t, pulse) {
  const c = $('bg').getContext('2d');
  c.fillStyle = '#0b0c0f';
  c.fillRect(0, 0, W, H);
  const glow = (x, y, r, col) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  };
  glow(W * 0.78 + Math.sin(t * 0.5) * 160, H * 0.18 + Math.cos(t * 0.37) * 70, 780, `rgba(149,133,255,${0.3 + pulse * 0.15})`);
  glow(W * 0.16 + Math.cos(t * 0.42) * 140, H * 0.86 + Math.sin(t * 0.5) * 60, 720, `rgba(90,216,255,${0.2 + pulse * 0.1})`);
  glow(W * 0.5 + Math.sin(t * 0.3) * 320, H * 0.5, 540, 'rgba(255,122,182,0.09)');
  for (const s of stars) {
    const y = (s.y - t * s.sp + H * 20) % H;
    c.fillStyle = `rgba(220,225,255,${0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.4 + s.ph))})`;
    c.beginPath(); c.arc(s.x, y, s.s, 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = 'rgba(255,255,255,0.035)';
  c.lineWidth = 1;
  for (let x = 0; x <= W; x += 80) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y <= H; y += 80) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
}

/* ================= Texte und Überlagerungen ================= */

function renderIntro(t) {
  const el = $('intro');
  const [t0, t1] = TL.T.logo;
  if (t > t1) { el.style.display = 'none'; return; }
  el.style.display = '';
  const exit = prog(t, t1 - 0.7, t1);
  el.style.opacity = prog(t, 0, 0.6) * (1 - easeInOut(exit));
  el.style.transform = `scale(${1 + easeInOut(exit) * 0.25})`;
  el.style.filter = `blur(${exit * 10}px)`;
  const k = easeOut(prog(t, t0 + 0.3, t0 + 1.8));
  $('logo-ring').setAttribute('stroke-dasharray', `${61 * k} 82`);
  $('logo-dot').setAttribute('r', Math.max(0, 5 * easeOutBack(prog(t, t0 + 1.0, t0 + 1.6))));
  document.querySelector('.intro-logo').style.transform = `rotate(${(1 - k) * -120}deg) scale(${0.7 + 0.3 * easeOut(prog(t, t0 + 0.2, t0 + 1.6))})`;
  document.querySelectorAll('#intro-title span').forEach((s, n) => {
    const kk = prog(t, t0 + 1.0 + n * 0.07, t0 + 1.8 + n * 0.07);
    s.style.opacity = kk;
    s.style.transform = `translateY(${(1 - easeOut(kk)) * 50}px)`;
    s.style.filter = `blur(${(1 - kk) * 8}px)`;
  });
  const tag = $('intro-tag');
  const tk = prog(t, t0 + 2.3, t0 + 3.2);
  tag.style.opacity = tk;
  tag.style.transform = `translateY(${(1 - easeOut(tk)) * 20}px)`;
}

// Beim Hineinzoomen tritt der Text zurück, in der Gesamtansicht ist er wieder da
function renderCaptions(t, camS) {
  const zoomFade = clamp((1.65 - camS) / 0.25);
  TL.captions.forEach((c, i) => {
    const el = $(`cap-${i}`);
    const show = t >= c.t0 - 0.02 && t <= c.t1 + 0.02;
    el.style.display = show ? '' : 'none';
    if (!show) return;
    const inK = prog(t, c.t0, c.t0 + 1.1);
    const outK = prog(t, c.t1 - 0.5, c.t1);
    if (c.side === 'tag') {
      el.style.opacity = easeOut(prog(t, c.t0, c.t0 + 0.4)) * (1 - outK);
      el.style.transform = `translateX(-50%) translateY(${(1 - easeOut(prog(t, c.t0, c.t0 + 0.5))) * 20}px)`;
      return;
    }
    el.style.opacity = c.side === 'top' ? 1 : zoomFade;
    el.querySelectorAll('.word').forEach((w, n) => {
      const k = easeOut(clamp((inK - n * 0.035) / 0.6));
      const dir = c.side === 'right' ? 1 : c.side === 'left' ? -1 : 0;
      w.style.opacity = clamp((inK - n * 0.035) / 0.5) * (1 - outK);
      w.style.transform = `translate(${(1 - k) * 30 * dir}px, ${(1 - k) * 24 - outK * 12}px)`;
      w.style.filter = `blur(${(1 - k) * 6 + outK * 6}px)`;
    });
  });
}

function renderStamp(t) {
  const el = $('stamp');
  let on = false;
  for (const [t0, t1] of [[E.activateClick, E.workCut - 0.1], [E.fileDrop, 59.9]]) {
    if (t < t0 || t > t1 + 0.3) continue;
    const k = easeOutBack(prog(t, t0, t0 + 0.4));
    const out = prog(t, t1, t1 + 0.3);
    el.style.opacity = clamp(prog(t, t0, t0 + 0.1)) * (1 - out);
    el.style.transform = `translate(-50%, -50%) translate(300px, 330px) scale(${0.6 + 0.4 * k})`;
    on = true;
  }
  if (!on) el.style.opacity = 0;
}

// Ranglisten-Zeilen der Level-Szene nacheinander einblenden
function renderLevelPanel(t) {
  const t0 = E.levelPanel;
  if (t < t0 - 0.05 || t > 75) return;
  const hero = q('.modal .lv-hero');
  if (hero) hero.style.transform = `scale(${0.92 + 0.08 * easeOutBack(prog(t, t0, t0 + 0.6))})`;
  qa('.modal .rank-row').forEach((r, i) => {
    const k = easeOut(prog(t, t0 + 0.3 + i * 0.16, t0 + 0.9 + i * 0.16));
    r.style.opacity = k;
    r.style.transform = `translateX(${(1 - k) * 40}px)`;
  });
}

function renderOutro(t) {
  const el = $('outro');
  const t0 = TL.T.outro[0] + 1.2;
  if (t < t0 - 0.01) { el.style.opacity = 0; return; }
  const k = prog(t, t0, t0 + 1.2);
  el.style.opacity = easeOut(k);
  el.style.transform = `translateY(${(1 - easeOut(k)) * 30}px)`;
  el.style.filter = `blur(${(1 - k) * 8}px)`;
  document.querySelectorAll('#outro-features span, #outro-features i').forEach((s, i) => {
    const kk = prog(t, t0 + 1.0 + i * 0.1, t0 + 1.7 + i * 0.1);
    s.style.opacity = kk;
    s.style.transform = `translateY(${(1 - easeOut(kk)) * 16}px)`;
  });
  const cta = document.querySelector('.outro-cta');
  const ck = prog(t, t0 + 2.4, t0 + 3.1);
  cta.style.opacity = ck;
  cta.style.transform = `scale(${0.9 + 0.1 * easeOut(ck)})`;
}

const confetti = (() => {
  const r = rng(42);
  return Array.from({ length: 150 }, (_, i) => {
    const left = i % 2 === 0;
    return {
      x: left ? 300 + r() * 80 : 1540 + r() * 80, y: 1100,
      vx: (left ? 1 : -1) * (160 + r() * 480), vy: -950 - r() * 400,
      rot: r() * 6.28, vr: (r() - 0.5) * 10,
      c: ['#5ad8ff', '#9585ff', '#ff7ab6', '#ffc46b', '#4fd6a4'][Math.floor(r() * 5)], w: 8 + r() * 8, h: 5 + r() * 5,
    };
  });
})();
function renderConfetti(t) {
  const c = $('confetti').getContext('2d');
  c.clearRect(0, 0, W, H);
  for (const t0 of [E.activateClick, E.fileDrop, E.levelPanel]) {
    const a = t - t0;
    if (a < 0 || a > 2.6) continue;
    for (const p of confetti) {
      c.save();
      c.globalAlpha = Math.max(0, 1 - a / 2.6);
      c.translate(p.x + p.vx * a * 0.7, p.y + p.vy * a + 820 * a * a);
      c.rotate(p.rot + p.vr * a);
      c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c.restore();
    }
  }
}

/* ================= Ein Einzelbild ================= */

let actIdx = 0;
async function renderAt(t) {
  while (actIdx < ACTS.length && t >= ACTS[actIdx].t) { ACTS[actIdx].fn(t); actIdx++; }
  applyBuild(t);
  while (pending.length && t >= pending[0].t) pending.shift().el.click();
  const curVis = updateCursor(t);
  renderLevelPanel(t);

  const cam = cameraAt(t) || { tx: 0, ty: 0, s: 1, rx: 0, ry: 0, rz: 0, o: 1, blur: 0 };
  // Schnitt-Übergang: kurzer, weicher Wisch mit etwas Unschärfe
  const lastCut = CUTS.filter((c) => c <= t).pop() ?? -9;
  const nextCut = CUTS.find((c) => c > t) ?? 999;
  const since = t - lastCut, until = nextCut - t;
  const whipK = since < 0.35 ? 1 - easeOut(since / 0.35) : 0;
  const preK = until < 0.12 ? 1 - until / 0.12 : 0;
  const dir = Math.round(lastCut * 10) % 2 ? 1 : -1;
  const tx = cam.tx + dir * whipK * 90 - dir * preK * 40, ty = cam.ty;

  const tf = `translate3d(${tx}px, ${ty}px, 0) rotateX(${cam.rx}deg) rotateY(${cam.ry}deg) rotateZ(${cam.rz}deg) scale(${cam.s})`;
  $('frame').style.transform = tf;
  $('frame').style.opacity = cam.o * (1 - whipK * 0.35) * (1 - preK * 0.3);
  const blur = cam.blur + whipK * 6 + preK * 4;
  $('frame').style.filter = blur > 0.05 ? `blur(${blur}px)` : 'none';
  $('frame-glow').style.transform = `${tf} translateZ(-80px) scale(0.94)`;
  $('frame-glow').style.opacity = cam.o * clamp(1.4 - cam.s) * 0.7;
  const gx = 30 + 40 * Math.sin(t * 0.2 + cam.ry / 30);
  $('glare').style.background = `linear-gradient(${115 + cam.ry}deg, transparent ${gx - 18}%, rgba(255,255,255,0.05) ${gx}%, transparent ${gx + 18}%)`;

  const c = $('cursor');
  c.style.opacity = curVis;
  c.style.transform = `translate(${cur.x}px, ${cur.y}px) scale(${(cur.scale * 1.35) / cam.s})`;
  renderFx(t, cam.s);

  const hit = [E.activateClick, E.fileDrop, E.levelPanel].reduce((m, h) => Math.max(m, t >= h ? 0.22 * Math.exp(-(t - h) * 8) : 0), 0);
  $('flash').style.opacity = hit;

  drawBackground(t, 0);
  renderIntro(t);
  renderCaptions(t, cam.s);
  renderStamp(t);
  renderConfetti(t);
  renderOutro(t);
  $('fade').style.opacity = Math.max(1 - prog(t, 0, 0.8), prog(t, TL.duration - 1.5, TL.duration));
  await frames(2);
  return true;
}

window.prepare = prepare;
window.renderAt = renderAt;
