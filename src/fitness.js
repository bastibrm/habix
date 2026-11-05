'use strict';

/* Fitness: Übersicht, Trainingsplan mit Mitschreiben der Sätze und Ernährung mit Kalorien und Makros.
   Alles bleibt lokal. state.fitness = { enabled, profile, goals, weights: { Tag: kg }, plans: [], workouts: [], live,
   food: { Tag: [Eintrag] }, foods: [eigene Lebensmittel], water: { Tag: ml } } */

const MEALS = [
  { id: 'breakfast', name: 'Frühstück', icon: 'croissant' },
  { id: 'lunch', name: 'Mittagessen', icon: 'soup' },
  { id: 'dinner', name: 'Abendessen', icon: 'utensils' },
  { id: 'snack', name: 'Snacks', icon: 'cookie' },
];
const ACTIVITY = [
  [1.2, 'Kaum Bewegung', 'Bürojob, wenig Sport'],
  [1.375, 'Leicht aktiv', '1 bis 2 Trainings pro Woche'],
  [1.55, 'Aktiv', '3 bis 4 Trainings pro Woche'],
  [1.725, 'Sehr aktiv', '5 bis 6 Trainings pro Woche'],
  [1.9, 'Extrem aktiv', 'Täglich Sport oder körperliche Arbeit'],
];
const FIT_GOALS = { lose: ['Abnehmen', -500], keep: ['Gewicht halten', 0], gain: ['Muskeln aufbauen', 300] };
const MACRO = { p: ['Eiweiß', '#5ee0ff'], c: ['Kohlenhydrate', '#ffc46b'], f: ['Fett', '#ff7ab6'] };

// Nährwerte je 100 g oder 100 ml: Name, kcal, Eiweiß, Kohlenhydrate, Fett, übliche Portion, Einheit
const FOOD_DB = [
  ['Haferflocken', 372, 13.5, 58.7, 7, 50], ['Vollkornbrot', 214, 7, 39, 1.8, 50], ['Brötchen', 260, 9, 51, 1.6, 60], ['Toastbrot', 265, 8, 48, 4, 25],
  ['Müsli', 360, 9, 63, 6, 60], ['Cornflakes', 378, 7, 84, 0.9, 40], ['Reis, gekocht', 130, 2.7, 28, 0.3, 200], ['Nudeln, gekocht', 150, 5.5, 30, 0.9, 250],
  ['Kartoffeln, gekocht', 77, 2, 17, 0.1, 250], ['Pommes', 290, 3.4, 36, 15, 150], ['Süßkartoffel', 86, 1.6, 20, 0.1, 200], ['Wrap (Tortilla)', 310, 8, 51, 7.5, 60],
  ['Ei', 155, 13, 1.1, 11, 60], ['Hähnchenbrust', 110, 23, 0, 1.5, 150], ['Putenbrust', 105, 24, 0, 1, 150], ['Rinderhack', 250, 18, 0, 20, 125],
  ['Rindersteak', 180, 26, 0, 8, 200], ['Lachs', 208, 20, 0, 13, 125], ['Thunfisch (Dose, Wasser)', 116, 26, 0, 1, 130], ['Schinken, gekocht', 107, 20, 1, 3, 30],
  ['Salami', 380, 22, 1, 32, 20], ['Tofu', 120, 13, 2, 7, 150], ['Linsen, gekocht', 116, 9, 20, 0.4, 200], ['Kichererbsen, gekocht', 164, 9, 27, 2.6, 150],
  ['Milch 1,5 %', 47, 3.4, 4.8, 1.5, 250, 'ml'], ['Milch 3,5 %', 64, 3.3, 4.8, 3.5, 250, 'ml'], ['Haferdrink', 46, 0.5, 6.7, 1.5, 250, 'ml'], ['Joghurt 1,5 %', 50, 4, 5, 1.5, 150],
  ['Skyr', 63, 11, 4, 0.2, 150], ['Magerquark', 67, 12, 4, 0.3, 250], ['Hüttenkäse', 98, 12, 3, 4.3, 200], ['Gouda', 356, 25, 0, 28, 30],
  ['Mozzarella', 250, 18, 1, 19, 125], ['Frischkäse', 250, 6, 4, 23, 30], ['Butter', 741, 0.7, 0.6, 83, 10], ['Olivenöl', 884, 0, 0, 100, 10, 'ml'],
  ['Erdnussbutter', 590, 25, 14, 49, 20], ['Mandeln', 600, 21, 7, 52, 30], ['Walnüsse', 654, 15, 7, 65, 30], ['Proteinpulver (Whey)', 380, 78, 6, 5, 30],
  ['Proteinriegel', 360, 32, 30, 12, 60], ['Banane', 89, 1.1, 20, 0.3, 120], ['Apfel', 52, 0.3, 11.4, 0.2, 150], ['Orange', 47, 0.9, 9.2, 0.1, 150],
  ['Beeren', 45, 1, 8, 0.4, 125], ['Weintrauben', 69, 0.7, 16, 0.2, 125], ['Avocado', 160, 2, 1.9, 15, 80], ['Tomate', 18, 0.9, 2.6, 0.2, 100],
  ['Gurke', 12, 0.6, 1.8, 0.1, 100], ['Paprika', 30, 1, 5, 0.3, 120], ['Brokkoli', 34, 2.8, 4, 0.4, 200], ['Karotte', 41, 0.9, 7.6, 0.2, 100],
  ['Salat, gemischt', 17, 1.3, 1.6, 0.2, 100], ['Pizza Margherita', 250, 10, 30, 10, 350], ['Döner', 215, 12, 20, 10, 400], ['Burger', 255, 13, 25, 11, 220],
  ['Spaghetti Bolognese', 140, 7, 17, 4.5, 400], ['Schnitzel, paniert', 230, 20, 10, 12, 180], ['Currywurst mit Soße', 250, 9, 10, 20, 250], ['Sushi', 150, 6, 28, 1.5, 200],
  ['Schokolade (Vollmilch)', 535, 7.7, 59, 30, 25], ['Chips', 536, 6, 50, 34, 30], ['Gummibärchen', 343, 6.9, 77, 0.1, 25], ['Eis', 200, 3.5, 24, 10, 100],
  ['Kuchen', 380, 5, 50, 18, 100], ['Croissant', 406, 8, 46, 21, 60], ['Honig', 304, 0.3, 82, 0, 20], ['Marmelade', 250, 0.4, 60, 0.1, 20],
  ['Cola', 42, 0, 10.6, 0, 330, 'ml'], ['Cola Zero', 0.3, 0, 0, 0, 330, 'ml'], ['Orangensaft', 45, 0.7, 10, 0.2, 250, 'ml'], ['Bier', 43, 0.5, 3.6, 0, 500, 'ml'],
  ['Wein', 83, 0.1, 2.6, 0, 200, 'ml'], ['Kaffee mit Milch', 20, 1.2, 1.7, 0.9, 250, 'ml'], ['Cappuccino', 40, 2.2, 3.3, 2, 200, 'ml'], ['Energydrink', 45, 0, 11, 0, 250, 'ml'],
].map(([name, kcal, p, c, f, portion, unit = 'g']) => ({ name, kcal, p, c, f, portion, unit, per: 100 }));

const EXERCISES = ['Bankdrücken', 'Schrägbankdrücken', 'Kurzhantel-Bankdrücken', 'Butterfly', 'Dips', 'Liegestütze', 'Schulterdrücken', 'Seitheben', 'Trizepsdrücken am Kabel',
  'French Press', 'Klimmzüge', 'Latzug', 'Rudern am Kabel', 'Langhantelrudern', 'Kurzhantelrudern', 'Face Pulls', 'Bizepscurls', 'Hammercurls', 'Kniebeugen', 'Beinpresse',
  'Kreuzheben', 'Rumänisches Kreuzheben', 'Ausfallschritte', 'Beinstrecker', 'Beinbeuger', 'Wadenheben', 'Hip Thrusts', 'Plank', 'Crunches', 'Beinheben', 'Laufen', 'Radfahren', 'Rudergerät'];

const PLAN_TEMPLATES = {
  full: { name: 'Ganzkörper', icon: 'activity', text: '3 Tage pro Woche, ideal zum Einstieg', plans: [
    ['Ganzkörper', [0, 2, 4], [['Kniebeugen', 3, '8-10'], ['Bankdrücken', 3, '8-10'], ['Langhantelrudern', 3, '8-10'], ['Schulterdrücken', 3, '10-12'], ['Rumänisches Kreuzheben', 3, '10-12'], ['Plank', 3, '45 s']]],
  ] },
  ppl: { name: 'Push, Pull, Beine', icon: 'dumbbell', text: '3 oder 6 Tage, jeder Muskel einmal pro Runde', plans: [
    ['Push', [0], [['Bankdrücken', 4, '6-8'], ['Schrägbankdrücken', 3, '8-10'], ['Schulterdrücken', 3, '8-10'], ['Seitheben', 3, '12-15'], ['Trizepsdrücken am Kabel', 3, '10-12']]],
    ['Pull', [2], [['Klimmzüge', 4, '6-8'], ['Langhantelrudern', 3, '8-10'], ['Latzug', 3, '10-12'], ['Face Pulls', 3, '12-15'], ['Bizepscurls', 3, '10-12']]],
    ['Beine', [4], [['Kniebeugen', 4, '6-8'], ['Rumänisches Kreuzheben', 3, '8-10'], ['Beinpresse', 3, '10-12'], ['Beinbeuger', 3, '10-12'], ['Wadenheben', 4, '12-15']]],
  ] },
  ul: { name: 'Oberkörper, Unterkörper', icon: 'repeat', text: '4 Tage pro Woche, viel Volumen', plans: [
    ['Oberkörper', [0, 3], [['Bankdrücken', 4, '6-8'], ['Langhantelrudern', 4, '6-8'], ['Schulterdrücken', 3, '8-10'], ['Latzug', 3, '10-12'], ['Bizepscurls', 2, '10-12'], ['Trizepsdrücken am Kabel', 2, '10-12']]],
    ['Unterkörper', [1, 4], [['Kniebeugen', 4, '6-8'], ['Rumänisches Kreuzheben', 3, '8-10'], ['Ausfallschritte', 3, '10-12'], ['Beinstrecker', 3, '12-15'], ['Wadenheben', 4, '12-15']]],
  ] },
};

const fit = () => {
  const f = (state.fitness ||= {});
  for (const [k, v] of Object.entries({ enabled: false, profile: null, goals: null, weights: {}, plans: [], workouts: [], live: null, food: {}, foods: [], water: {},
    weekGoal: 3, stepGoal: 8000, restSec: 90, measures: {}, cardio: [], steps: {}, sleep: {}, mealTpls: [], recipes: [], supps: [], suppLog: {}, achSeen: null })) if (f[k] === undefined) f[k] = v;
  if (!f.fasting) f.fasting = { start: null, goal: 16, log: [] };
  return f;
};
const r1 = (v) => Math.round(v * 10) / 10;
const kg = (v) => `${fmtNum(r1(v))} kg`;
const kcalOf = (list) => list.reduce((a, e) => a + (e.kcal || 0), 0);
const sumOf = (list, k) => list.reduce((a, e) => a + (e[k] || 0), 0);
const dayFood = (k) => fit().food[k] || [];

/* ================= Berechnungen ================= */

function currentWeight() {
  const f = fit();
  const k = Object.keys(f.weights).sort().pop();
  return k ? f.weights[k] : f.profile?.weight || null;
}

function weightAt(day) {
  const f = fit();
  const k = Object.keys(f.weights).filter((x) => x <= day).sort().pop();
  return k ? f.weights[k] : null;
}

// Bedarf nach Mifflin-St Jeor, dazu Ziel und Makros
function needs() {
  const f = fit();
  const p = f.profile;
  let auto = null;
  if (p && p.age && p.height && currentWeight()) {
    const w = currentWeight();
    const bmr = 10 * w + 6.25 * p.height - 5 * p.age + (p.sex === 'w' ? -161 : 5);
    const tdee = bmr * (p.activity || 1.375);
    const kcal = Math.round((tdee + FIT_GOALS[p.goal || 'keep'][1]) / 10) * 10;
    const protein = Math.round(w * (p.goal === 'keep' ? 1.6 : 1.8));
    const fat = Math.round((kcal * 0.27) / 9);
    auto = { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, p: protein, f: fat, c: Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)), water: Math.round((w * 35) / 250) * 250, bmi: w / ((p.height / 100) ** 2) };
  }
  const base = auto || { kcal: 2000, p: 100, c: 240, f: 65, water: 2000 };
  return { ...base, ...(f.goals || {}), auto, custom: !!f.goals };
}

const thisMonday = () => addDays(todayKey(), -wdOf(todayKey()));
const workoutsIn = (from, to) => fit().workouts.filter((w) => w.date >= from && w.date <= to);
// Feste Wochentage, dazu einzelne Tage: dayPlans (nur an diesem Datum dazu), daySkip (an diesem Datum ausgelassen)
const plannedOn = (k) => {
  const f = fit(), extra = f.dayPlans?.[k] || [], skip = f.daySkip?.[k] || [];
  return f.plans.filter((p) => (p.days.includes(wdOf(k)) && !skip.includes(p.id)) || extra.includes(p.id));
};
const doneSets = (w) => w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
const volumeOf = (w) => w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).reduce((b, s) => b + (s.kg || 0) * (s.reps || 0), 0), 0);
const durOf = (w) => (w.end && w.start ? Math.max(1, Math.round((new Date(w.end) - new Date(w.start)) / 60000)) : null);

// Letzte erledigte Sätze einer Übung, für Vorschläge beim nächsten Mal
function lastSets(name) {
  const n = name.trim().toLowerCase();
  for (const w of [...fit().workouts].sort((a, b) => (b.end || b.date).localeCompare(a.end || a.date))) {
    const e = w.exercises.find((x) => x.name.trim().toLowerCase() === n);
    const sets = e?.sets.filter((s) => s.done);
    if (sets?.length) return { date: w.date, sets };
  }
  return null;
}

// Bestleistung je Übung: schwerster Satz, dazu geschätztes Maximum (Epley)
function personalBests() {
  const best = {};
  for (const w of fit().workouts) for (const e of w.exercises) for (const s of e.sets) {
    if (!s.done || !s.kg || !s.reps) continue;
    const orm = s.kg * (1 + s.reps / 30);
    const k = e.name.trim();
    if (!best[k] || orm > best[k].orm) best[k] = { name: k, kg: s.kg, reps: s.reps, orm, date: w.date };
  }
  return Object.values(best).sort((a, b) => b.orm - a.orm);
}

/* ================= Freischalten ================= */

function openFitnessUnlock() {
  openPanel(`
    <div class="unlock">
      <div class="unlock-icon">${icon('dumbbell')}<span class="unlock-lock">${icon('lock')}</span></div>
      <div class="eyebrow">Bereich Fitness</div>
      <h2 class="panel-title">Fitness aktivieren?</h2>
      <p>Für alle, die trainieren, ihr Gewicht verfolgen oder auf ihre Ernährung achten wollen. Wenn du das nicht brauchst, bleibt der Bereich einfach aus.</p>
      <ul class="unlock-list">
        <li>${icon('layout-dashboard')}<div><b>Übersicht</b><span>Kalorien, Training, Gewicht und Wasser auf einen Blick</span></div></li>
        <li>${icon('clipboard-list')}<div><b>Trainingsplan</b><span>Eigene Trainingstage oder fertige Vorlagen, Sätze und Gewichte mitschreiben</span></div></li>
        <li>${icon('apple')}<div><b>Ernährung</b><span>Essen eintragen, Kalorien und Makros zählen, mit über 80 Lebensmitteln zum Start</span></div></li>
        <li>${icon('trophy')}<div><b>Fortschritt</b><span>Gewichtsverlauf und Bestleistungen je Übung</span></div></li>
      </ul>
      <div class="btn-row unlock-actions">
        <button class="btn ghost" data-action="close-modal">Nicht jetzt</button>
        <button class="btn primary" data-action="fit-enable">${icon('lock-open')}Bereich aktivieren</button>
      </div>
    </div>`, 'narrow');
}

/* ================= Übersicht ================= */

function macroBars(eaten, goal) {
  return `<div class="macro-bars">${Object.entries(MACRO).map(([k, [name, color]]) => {
    const v = sumOf(eaten, k), g = goal[k] || 0;
    return `
    <div class="macro">
      <div class="macro-top"><span><i class="macro-dot" style="--c:${color}"></i>${name}</span><b>${fmtNum(Math.round(v))} <small>/ ${fmtNum(g)} g</small></b></div>
      <div class="rate-bar" style="--c:${color}"><span class="plain" data-anim="w" style="width:${g ? Math.min(100, (v / g) * 100) : 0}%"></span></div>
    </div>`;
  }).join('')}</div>`;
}

function kcalRing(eaten, goal, size = 132) {
  const r = 46, c = 2 * Math.PI * r;
  const v = goal ? Math.min(1, eaten / goal) : 0;
  const over = eaten > goal;
  return `
  <div class="ring kcal-ring ${over ? 'over' : ''}" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 112 112" aria-hidden="true">
      <circle cx="56" cy="56" r="${r}" fill="none" style="stroke:var(--track)" stroke-width="10"/>
      <circle class="prog" data-anim="ring" data-full="${c}" cx="56" cy="56" r="${r}" fill="none" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${c}" style="stroke-dashoffset:${c * (1 - v)}px"${over ? ' data-hue="0"' : ''}/>
    </svg>
    <div class="ring-label kcal-label"><b>${num(Math.round(Math.abs(goal - eaten)))}</b><small>${over ? 'kcal zu viel' : 'kcal übrig'}</small></div>
  </div>`;
}

function weightChart() {
  const f = fit();
  const keys = Object.keys(f.weights).sort();
  if (keys.length < 2) return `<div class="muted fit-empty-chart">${keys.length ? 'Trag an einem weiteren Tag dein Gewicht ein, dann siehst du hier deinen Verlauf.' : 'Noch kein Gewicht eingetragen. Am besten morgens nach dem Aufstehen wiegen.'}</div>`;
  const from = keys.length > 1 && keys[0] < addDays(todayKey(), -90) ? addDays(todayKey(), -90) : keys[0];
  const pts = keys.filter((k) => k >= from).map((k) => ({ k, v: f.weights[k] }));
  const target = f.profile?.targetWeight;
  const vals = [...pts.map((p) => p.v), ...(target ? [target] : [])];
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const W = 640, H = 170, pad = 8;
  const span = Math.max(1, (parseKey(todayKey()) - parseKey(from)) / 86400000);
  const x = (k) => pad + ((parseKey(k) - parseKey(from)) / 86400000 / span) * (W - pad * 2);
  const y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2);
  const xy = pts.map((p) => ({ x: x(p.k), y: y(p.v) }));
  const line = smoothPath(xy, pad, H - pad);
  const id = `wg${++chartSeq}`;
  return `
  <div class="fit-chart">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--violet);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--violet);stop-opacity:0"/></linearGradient></defs>
      ${target ? `<line x1="0" x2="${W}" y1="${y(target)}" y2="${y(target)}" class="fit-target" vector-effect="non-scaling-stroke"/>` : ''}
      <path d="${line} L${xy[xy.length - 1].x},${H} L${xy[0].x},${H} Z" fill="url(#${id})"/>
      <path d="${line}" fill="none" class="fit-line" vector-effect="non-scaling-stroke"/>
    </svg>
    <div class="fit-chart-axis"><span>${esc(fmtShort(from))}</span>${target ? `<span class="fit-target-label">Ziel ${kg(target)}</span>` : ''}<span>Heute</span></div>
  </div>`;
}

function weekStrip(from) {
  const g = needs();
  const days = range(from, addDays(from, 6));
  const max = Math.max(...days.map((k) => goalFor(k) * 1.25), ...days.map((k) => kcalOf(dayFood(k))));
  return `<div class="fit-week">${days.map((k, i) => {
    const eaten = kcalOf(dayFood(k));
    const trained = workoutsIn(k, k).length;
    const planned = plannedOn(k).length;
    const goal = goalFor(k);
    const ratio = goal ? eaten / goal : 0;
    return `
    <div class="fit-day ${k === todayKey() ? 'today' : ''}" title="${esc(fmtLong(k))}: ${fmtNum(Math.round(eaten))} kcal">
      <div class="fit-day-bar"><span data-anim="h" style="height:${(eaten / max) * 100}%" data-hue="${ratio > 1.1 ? 0 : progHue(Math.min(1, ratio))}"></span><i style="bottom:${(goal / max) * 100}%"></i></div>
      <span class="fit-day-dot ${trained ? 'done' : planned ? 'planned' : ''}">${trained ? icon('check') : ''}</span>
      <span class="fit-day-label">${WD[i]}</span>
    </div>`;
  }).join('')}</div>`;
}

function viewFitness() {
  const f = fit();
  const today = todayKey();
  const g = needs();
  const eaten = dayFood(today);
  const kcal = kcalOf(eaten);
  const goal = goalFor(today);
  const burned = burnedOn(today);
  const mon = thisMonday();
  const weekDone = activeDays(mon, addDays(mon, 6));
  const weekPlanned = f.weekGoal;
  const cw = currentWeight();
  const w30 = weightAt(addDays(today, -30));
  const water = f.water[today] || 0;
  const todayPlans = plannedOn(today);
  const trainedToday = workoutsIn(today, today);
  const nextDay = range(addDays(today, 1), addDays(today, 7)).find((k) => plannedOn(k).length);
  const recent = [...f.workouts].sort((a, b) => (b.end || b.date).localeCompare(a.end || a.date)).slice(0, 5);
  const pbs = personalBests().slice(0, 5);
  const p = f.profile;

  return `
  <header class="head fade-in">
    <div><div class="eyebrow">${esc(fmtLong(today))}</div><h1>Fitness</h1></div>
    <div class="head-actions">
      <button class="btn" data-action="fit-profile">${icon('user-round')}Profil und Ziele</button>
      <button class="btn primary" data-action="fit-weight">${icon('scale')}Gewicht eintragen</button>
    </div>
  </header>

  <section class="grid">
    ${p ? '' : `
    <article class="card s12 fade-in fit-setup">
      <div class="fit-setup-icon">${icon('target')}</div>
      <div><h2>Richte kurz dein Profil ein</h2><div class="sub">Mit Größe, Gewicht, Alter und Ziel rechnet Habix deinen Kalorienbedarf und deine Makros aus. Bis dahin gelten 2.000 kcal.</div></div>
      <button class="btn primary" data-action="fit-profile">${icon('arrow-right')}Profil einrichten</button>
    </article>`}

    ${fitLevelCard()}

    <article class="card s3 fade-in fin-tile">
      <div class="card-head"><h2 class="muted">Kalorien heute</h2><div class="icon-btn" style="color:var(--sun)">${icon('flame')}</div></div>
      <div class="fin-num">${num(Math.round(kcal))} <small class="fit-unit">/ ${fmtNum(goal)}</small></div>
      <div class="meter"><span data-anim="w" style="width:${Math.min(100, (kcal / goal) * 100)}%"${kcal > goal * 1.05 ? ' data-hue="0"' : ''}></span></div>
      <div class="sub">${kcal > goal ? `${fmtNum(Math.round(kcal - goal))} kcal über dem Ziel` : `Noch ${fmtNum(Math.round(goal - kcal))} kcal übrig`}${burned ? ` · +${fmtNum(burned)} durch Sport` : ''}</div>
    </article>
    <article class="card s3 fade-in fin-tile">
      <div class="card-head"><h2 class="muted">Training diese Woche</h2><div class="icon-btn" style="color:var(--violet)">${icon('dumbbell')}</div></div>
      <div class="fin-num">${num(weekDone)} <small class="fit-unit">/ ${weekPlanned} Tagen</small></div>
      <div class="meter"><span data-anim="w" style="width:${Math.min(100, (weekDone / weekPlanned) * 100)}%"></span></div>
      <div class="sub">${nextDay ? `Nächstes: ${esc(plannedOn(nextDay).map((x) => x.name).join(', '))} am ${WD[wdOf(nextDay)]}` : f.plans.length ? 'Diese Woche nichts mehr geplant' : 'Noch kein Trainingsplan'}</div>
    </article>
    <article class="card s3 fade-in fin-tile">
      <div class="card-head"><h2 class="muted">Gewicht</h2><div class="icon-btn" style="color:var(--cyan)">${icon('scale')}</div></div>
      <div class="fin-num">${cw ? `${fmtNum(r1(cw))} <small class="fit-unit">kg</small>` : '–'}</div>
      <div class="sub">${cw && w30 && w30 !== cw ? `${cw > w30 ? '+' : '−'}${kg(Math.abs(cw - w30))} in 30 Tagen` : 'Noch kein Verlauf'}${p?.targetWeight && cw ? ` · Ziel ${kg(p.targetWeight)}` : ''}</div>
    </article>
    <article class="card s3 fade-in fin-tile">
      <div class="card-head"><h2 class="muted">Wasser heute</h2><button class="icon-btn" style="color:var(--cyan)" data-action="fit-water" data-ml="250" title="Ein Glas (250 ml) dazu">${icon('plus')}</button></div>
      <div class="fin-num">${fmtNum(r1(water / 1000))} <small class="fit-unit">/ ${fmtNum(r1(g.water / 1000))} L</small></div>
      <div class="meter"><span data-anim="w" style="width:${Math.min(100, (water / g.water) * 100)}%"></span></div>
      <div class="sub">${water >= g.water ? 'Ziel erreicht' : `Noch ${Math.ceil((g.water - water) / 250)} Gläser`}</div>
    </article>

    <article class="card s4 fade-in">
      <div class="card-head"><div><h2>Training heute</h2><div class="sub">${trainedToday.length ? 'Erledigt, stark!' : todayPlans.length ? 'Laut deinem Plan' : 'Ruhetag laut Plan'}</div></div><div class="icon-btn">${icon('calendar-check')}</div></div>
      ${f.live ? `<button class="fit-today-row live" data-action="fit-go-training">${icon('timer')}<span><b>${esc(f.live.name)}</b><small>Training läuft</small></span>${icon('chevron-right')}</button>` : ''}
      ${trainedToday.map((w) => `<div class="fit-today-row done">${icon('circle-check')}<span><b>${esc(w.name)}</b><small>${doneSets(w)} Sätze${durOf(w) ? ` · ${durOf(w)} min` : ''}</small></span></div>`).join('')}
      ${f.live ? '' : todayPlans.filter((pl) => !trainedToday.some((w) => w.planId === pl.id)).map((pl) => `
        <div class="fit-today-row"><span class="fit-plan-dot" style="--c:${pl.color}"></span><span><b>${esc(pl.name)}</b><small>${pl.exercises.length} Übungen</small></span><button class="btn small primary" data-action="fit-start" data-id="${pl.id}">${icon('play')}Starten</button></div>`).join('')}
      ${!f.live && !todayPlans.length && !trainedToday.length ? `<button class="btn small" data-action="fit-start" data-id="" style="align-self:flex-start">${icon('play')}Freies Training starten</button>` : ''}
    </article>
    <article class="card s4 fade-in">
      <div class="card-head"><div><h2>Makros heute</h2><div class="sub">${eaten.length ? `${eaten.length} Einträge` : 'Noch nichts gegessen eingetragen'}</div></div><button class="icon-btn" data-action="fit-go-nutrition" title="Zur Ernährung">${icon('apple')}</button></div>
      ${macroBars(eaten, g)}
    </article>
    <article class="card s4 fit-last fade-in">
      <div class="card-head"><div><h2>Dein Bedarf</h2><div class="sub">${p ? `${FIT_GOALS[p.goal || 'keep'][0]}${g.custom ? ' · eigene Werte' : ''}` : 'Profil noch nicht eingerichtet'}</div></div><button class="icon-btn" data-action="fit-profile" title="Bearbeiten">${icon('pencil')}</button></div>
      <div class="plan-list">
        ${g.auto ? `
        <div><span>Grundumsatz</span><b>${fmtNum(g.auto.bmr)} kcal</b></div>
        <div><span>Mit Alltag und Sport</span><b>${fmtNum(g.auto.tdee)} kcal</b></div>
        <div><span>BMI</span><b>${fmtNum(r1(g.auto.bmi))}</b></div>` : ''}
        <div class="plan-total"><span>Tagesziel</span><b>${fmtNum(g.kcal)} kcal</b></div>
      </div>
    </article>

    ${weekGoalCard()}
    ${cardioCard()}
    ${sleepCard('fit-last')}

    <article class="card s8 fade-in">
      <div class="card-head"><div><h2>Gewichtsverlauf</h2><div class="sub">Die letzten 90 Tage</div></div>
        <form class="fit-inline" data-fit-weight-form><input class="input small-input" id="fit-weight-in" inputmode="decimal" placeholder="${cw ? fmtNum(r1(cw)) : 'z. B. 75,5'}"><span class="muted">kg</span><button class="btn small" type="submit">Eintragen</button></form>
      </div>
      ${weightChart()}
    </article>
    <article class="card s4 fade-in">
      <div class="card-head"><div><h2>Diese Woche</h2><div class="sub">Kalorien je Tag, Strich ist dein Ziel</div></div></div>
      ${weekStrip(mon)}
      <div class="fit-legend"><span><i class="fit-day-dot done">${icon('check')}</i>trainiert</span><span><i class="fit-day-dot planned"></i>geplant</span></div>
    </article>

    ${yearCard()}
    ${measuresCard()}
    ${achCard()}

    <article class="card s6 fade-in">
      <div class="card-head"><div><h2>Letzte Trainings</h2><div class="sub">${f.workouts.length ? `${f.workouts.length} insgesamt` : 'Noch keins'}</div></div><button class="icon-btn" data-action="fit-go-training" title="Zum Trainingsplan">${icon('clipboard-list')}</button></div>
      ${recent.length ? `<div class="fit-hist">${recent.map(histRow).join('')}</div>` : '<div class="muted">Starte dein erstes Training im Trainingsplan. Deine Sätze und Gewichte erscheinen dann hier.</div>'}
    </article>
    <article class="card s6 fade-in">
      <div class="card-head"><div><h2>Bestleistungen</h2><div class="sub">Schwerster Satz je Übung, dazu dein geschätztes Maximum für 1 Wiederholung</div></div><div class="icon-btn" style="color:var(--sun)">${icon('trophy')}</div></div>
      ${pbs.length ? `<div class="fit-pbs">${pbs.map((b, i) => `
        <button class="fit-pb fit-ex-link" data-action="fit-ex-open" data-name="${esc(b.name)}"><span class="fit-pb-rank ${i === 0 ? 'gold' : ''}">${i + 1}</span><span class="fit-pb-name"><b>${esc(b.name)}</b><small>${esc(fmtShort(b.date))}</small></span><span class="fit-pb-val"><b>${kg(b.kg)} × ${b.reps}</b><small>≈ ${kg(Math.round(b.orm))} max</small></span></button>`).join('')}</div>`
        : '<div class="muted">Sobald du Sätze mit Gewicht abhakst, siehst du hier deine Rekorde.</div>'}
    </article>
  </section>`;
}

function histRow(w) {
  return `
  <div class="fit-hist-row">
    <span class="fit-plan-dot" style="--c:${fit().plans.find((p) => p.id === w.planId)?.color || 'var(--muted)'}"></span>
    <span class="fit-hist-main"><b>${esc(w.name)}${w.feel ? `<span class="fit-feel-ico mood-${w.feel}" title="${MOODS[w.feel - 1].label}">${icon(MOODS[w.feel - 1].icon)}</span>` : ''}</b><small>${esc(fmtShort(w.date))} · ${w.exercises.filter((e) => e.sets.some((s) => s.done)).length} Übungen · ${doneSets(w)} Sätze${durOf(w) ? ` · ${durOf(w)} min` : ''}${w.note ? ` · „${esc(w.note)}“` : ''}</small></span>
    <span class="fit-hist-vol">${volumeOf(w) ? `${fmtNum(Math.round(volumeOf(w)))} kg` : ''}</span>
    ${ui.fitDelWorkout === w.id
      ? `<span class="btn-row"><button class="btn small danger" data-action="fit-workout-del-yes" data-id="${w.id}">Löschen</button><button class="btn small ghost" data-action="fit-workout-del-no">Nein</button></span>`
      : `<button class="icon-btn fit-hist-del" data-action="fit-workout-del" data-id="${w.id}" title="Training löschen">${icon('trash-2')}</button>`}
  </div>`;
}

/* ================= Trainingsplan ================= */

function liveCard() {
  const l = fit().live;
  const doneN = l.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  const allN = l.exercises.reduce((a, e) => a + e.sets.length, 0);
  return `
  <article class="card s12 fade-in fit-live">
    <div class="card-head">
      <div><div class="eyebrow fit-live-badge"><span class="fit-pulse"></span>Training läuft · <span id="fit-elapsed">${elapsed(l)}</span></div><h2>${esc(l.name)}</h2><div class="sub">${doneN} von ${allN} Sätzen erledigt</div></div>
      <div class="btn-row">
        ${ui.fitCancel ? `<span class="error">Training verwerfen?</span><button class="btn small danger" data-action="fit-cancel-yes">Verwerfen</button><button class="btn small ghost" data-action="fit-cancel-no">Nein</button>`
          : `<button class="btn ghost" data-action="fit-cancel">Abbrechen</button><button class="btn primary" data-action="fit-finish">${icon('flag')}Training beenden</button>`}
      </div>
    </div>
    <div class="meter"><span data-anim="w" style="width:${allN ? (doneN / allN) * 100 : 0}%"></span></div>
    <div class="fit-rest-pick"><span>${icon('timer')}Satzpause nach jedem Haken</span>
      <div class="segmented">${[[0, 'Aus'], [60, '1 min'], [90, '1:30'], [120, '2 min'], [180, '3 min']].map(([s, t]) => `<button class="${fit().restSec === s ? 'on' : ''}" data-action="fit-rest-pick" data-s="${s}">${t}</button>`).join('')}</div></div>
    <div class="fit-ex-list">
      ${l.exercises.map((e, ei) => {
        const last = lastSets(e.name);
        const up = progressHint(e);
        return `
        <div class="fit-ex">
          <div class="fit-ex-head"><button class="fit-ex-name" data-action="fit-ex-open" data-name="${esc(e.name)}" title="Verlauf ansehen">${esc(e.name)}</button><span class="muted">${e.target ? `Ziel ${esc(e.target)} Wdh.` : ''}${last ? `${e.target ? ' · ' : ''}Letztes Mal ${last.sets.map((s) => `${fmtNum(s.kg || 0)}×${s.reps || 0}`).join(', ')}` : ''}</span>
            <button class="icon-btn small" data-action="fit-ex-remove" data-ei="${ei}" title="Übung entfernen">${icon('x')}</button></div>
          ${up ? `<div class="fit-up">${icon('trending-up')}<span>Letztes Mal alles geschafft. Heute ${kg(up.to)} statt ${kg(up.from)}?</span><button class="btn small primary" data-action="fit-ex-up" data-ei="${ei}">Ja</button><button class="icon-btn small" data-action="fit-ex-up-no" data-ei="${ei}" aria-label="Nein danke">${icon('x')}</button></div>` : ''}
          <div class="fit-sets">
            <div class="fit-set fit-set-head"><span>Satz</span><span>kg</span><span>Wdh.</span><span></span></div>
            ${e.sets.map((s, si) => `
            <div class="fit-set ${s.done ? 'done' : ''}">
              <span class="fit-set-n">${si + 1}</span>
              <input class="input" inputmode="decimal" data-fit-set="kg" data-ei="${ei}" data-si="${si}" value="${s.kg != null ? fmtNum(s.kg) : ''}" placeholder="0">
              <input class="input" inputmode="numeric" data-fit-set="reps" data-ei="${ei}" data-si="${si}" value="${s.reps ?? ''}" placeholder="0">
              <button class="fit-check ${s.done ? 'on' : ''}" data-action="fit-set-done" data-ei="${ei}" data-si="${si}" aria-pressed="${!!s.done}" aria-label="Satz abhaken">${icon('check')}</button>
            </div>`).join('')}
          </div>
          <div class="btn-row"><button class="btn small ghost" data-action="fit-set-add" data-ei="${ei}">${icon('plus')}Satz</button>${e.sets.length > 1 ? `<button class="btn small ghost" data-action="fit-set-remove" data-ei="${ei}">${icon('minus')}Satz</button>` : ''}</div>
        </div>`;
      }).join('')}
      <form class="fit-ex fit-ex-add" data-fit-ex-add>
        <input class="input" id="fit-ex-new" list="fit-ex-names" placeholder="Übung hinzufügen, z. B. Bizepscurls" maxlength="60">
        <button class="btn small" type="submit">${icon('plus')}Hinzufügen</button>
      </form>
    </div>
    <div class="fit-feel">
      <span class="label">Wie lief's?</span>
      <div class="fit-feel-row">${MOODS.map((m) => `<button class="mood mood-${m.v} ${l.feel === m.v ? 'on' : ''}" data-action="fit-feel" data-v="${m.v}" title="${m.label}" aria-pressed="${l.feel === m.v}">${icon(m.icon)}</button>`).join('')}</div>
      <input class="input" data-fit-note maxlength="200" placeholder="Notiz zum Training, z. B. Schulter gezwickt oder super Pump" value="${esc(l.note || '')}">
    </div>
    <datalist id="fit-ex-names">${EXERCISES.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
  </article>`;
}

function viewTraining() {
  const f = fit();
  const mon = addDays(thisMonday(), (ui.fitWeek || 0) * 7);
  const days = range(mon, addDays(mon, 6));
  const weekDone = workoutsIn(mon, addDays(mon, 6)).length;
  const recent = [...f.workouts].sort((a, b) => (b.end || b.date).localeCompare(a.end || a.date)).slice(0, ui.fitHistLimit || 8);

  return `
  <header class="head fade-in">
    <div><div class="eyebrow">${weekDone} ${weekDone === 1 ? 'Training' : 'Trainings'} ${ui.fitWeek ? 'in dieser Woche' : 'diese Woche'}</div><h1>Trainingsplan</h1></div>
    <div class="head-actions">
      ${f.live ? '' : `<button class="btn" data-action="fit-start" data-id="">${icon('play')}Freies Training</button>`}
      <button class="btn primary" data-action="fit-plan-new">${icon('plus')}Neuer Trainingstag</button>
    </div>
  </header>

  <section class="grid">
    ${f.live ? liveCard() : ''}

    <article class="card s12 fade-in">
      <div class="card-head"><div><h2>Deine Woche</h2><div class="sub">Welcher Trainingstag wann dran ist</div></div>
        <div class="week-nav">
          <button class="icon-btn" data-action="fit-week" data-dir="-1" aria-label="Vorige Woche">${icon('chevron-left')}</button>
          ${navNowBtn('fit-week', navWeekLabel(addDays(mondayOf(todayKey()), (ui.fitWeek || 0) * 7)), !ui.fitWeek, dt('Zur aktuellen Woche', 'Go to this week'))}
          <button class="icon-btn" data-action="fit-week" data-dir="1" aria-label="Nächste Woche">${icon('chevron-right')}</button>
        </div>
      </div>
      <div class="fit-plan-week">${days.map((k, i) => {
        const done = workoutsIn(k, k);
        const planned = plannedOn(k).filter((p) => !done.some((w) => w.planId === p.id));
        return `
        <div class="fit-pw-day ${k === todayKey() ? 'today' : ''} ${k < todayKey() && planned.length ? 'missed' : ''}" data-action="fit-pw-open" data-day="${k}" role="button" tabindex="0" title="${dt('Tag planen', 'Plan this day')}">
          <div class="fit-pw-head"><b>${WD[i]}</b><span>${esc(fmtShort(k))}</span><i class="fit-pw-plus">${icon('plus')}</i></div>
          ${done.map((w) => `<span class="fit-pw-item done" style="--c:${f.plans.find((p) => p.id === w.planId)?.color || 'var(--good)'}">${icon('check')}${esc(w.name)}</span>`).join('')}
          ${planned.map((p) => `<span class="fit-pw-item" style="--c:${p.color}">${esc(p.name)}</span>`).join('')}
          ${!done.length && !planned.length ? '<span class="fit-pw-rest">Ruhetag</span>' : ''}
        </div>`;
      }).join('')}</div>
    </article>

    ${f.plans.length ? `<div class="s12 fit-plans">${f.plans.map((p) => `
    <article class="card fade-in fit-plan" style="--c:${p.color}">
      <div class="card-head">
        <div><h2><span class="fit-plan-dot"></span>${esc(p.name)}</h2><div class="sub">${p.days.length ? [...p.days].sort().map((d) => WD[d]).join(', ') : 'Ohne festen Tag'} · ${p.exercises.length} Übungen</div></div>
        <button class="icon-btn" data-action="fit-plan-edit" data-id="${p.id}" title="Bearbeiten">${icon('pencil')}</button>
      </div>
      <div class="fit-plan-ex">${p.exercises.map((e) => `<div class="fit-ex-link" data-action="fit-ex-open" data-name="${esc(e.name)}"><span>${esc(e.name)}</span><b>${e.sets} × ${esc(e.reps || '–')}${e.kg ? ` · ${kg(e.kg)}` : ''}</b></div>`).join('') || '<div class="muted">Noch keine Übungen</div>'}</div>
      ${f.live ? '' : `<button class="btn small primary" data-action="fit-start" data-id="${p.id}" style="align-self:flex-start">${icon('play')}Training starten</button>`}
    </article>`).join('')}</div>` : `
    <article class="card s12 fade-in">
      <div class="card-head"><div><h2>Starte mit einer Vorlage</h2><div class="sub">Ein Klick legt die Trainingstage an. Übungen, Sätze und Tage kannst du danach frei ändern.</div></div></div>
      <div class="fit-templates">${Object.entries(PLAN_TEMPLATES).map(([id, t]) => `
        <button class="fit-template" data-action="fit-template" data-id="${id}">
          <span class="fin-cat-ico" style="--c:var(--violet)">${icon(t.icon)}</span>
          <span><b>${t.name}</b><small>${t.text}</small><small class="muted">${t.plans.map((p) => p[0]).join(' · ')}</small></span>
        </button>`).join('')}</div>
    </article>`}

    ${muscleCard(mon)}
    ${exerciseListCard()}

    <article class="card s12 fade-in">
      <div class="card-head"><div><h2>Verlauf</h2><div class="sub">${f.workouts.length ? `${f.workouts.length} Trainings · ${fmtNum(Math.round(f.workouts.reduce((a, w) => a + volumeOf(w), 0) / 1000))} Tonnen bewegt` : 'Noch keine Trainings'}</div></div></div>
      ${recent.length ? `<div class="fit-hist">${recent.map(histRow).join('')}</div>` : '<div class="muted">Wenn du ein Training beendest, landet es hier mit allen Sätzen.</div>'}
      ${f.workouts.length > recent.length ? `<button class="btn small ghost" data-action="fit-hist-more" style="align-self:flex-start">Weitere anzeigen</button>` : ''}
    </article>
  </section>`;
}

/* ================= Einen Tag der Woche planen ================= */

// Klick auf einen Tag in „Deine Woche“: Trainingstage für dieses Datum oder jede Woche an- und abwählen,
// dazu neuer Trainingstag, Cardio eintragen oder heute direkt starten
function fitDayHtml(k) {
  const f = fit();
  const wd = wdOf(k), today = todayKey();
  const planned = plannedOn(k);
  const done = workoutsIn(k, k);
  const cardio = f.cardio.filter((c) => c.date === k);
  const wdLong = new Intl.DateTimeFormat(LOCALE(), { weekday: 'long' }).format(parseKey(k));
  return `
  <div class="fit-day-panel" data-day="${k}">
    <div class="card-head">
      <div><div class="eyebrow">${dt('Trainingsplan', 'Training plan')}</div><h2 class="panel-title" style="font-size:22px">${esc(fmtLong(k))}</h2></div>
      <button class="icon-btn" data-action="close-modal" aria-label="${dt('Schließen', 'Close')}">${icon('x')}</button>
    </div>
    ${done.length || cardio.length ? `<div class="fit-day-done">${done.map((w) => `<span class="fit-pw-item done" style="--c:${f.plans.find((p) => p.id === w.planId)?.color || 'var(--good)'}">${icon('check')}${esc(w.name)}</span>`).join('')}${cardio.map((c) => `<span class="fit-pw-item done" style="--c:var(--cyan)">${icon(cardioType(c.type).icon || 'heart-pulse')}${esc(cardioType(c.type).name)} · ${c.min} min</span>`).join('')}</div>` : ''}
    <div class="label-sm">${dt('Was steht an?', 'What’s planned?')}</div>
    ${f.plans.length ? `<div class="fit-day-plans">${f.plans.map((p) => {
      const on = planned.includes(p);
      const weekly = p.days.includes(wd);
      return `
      <div class="fit-day-plan ${on ? 'on' : ''}" style="--c:${p.color}">
        <button class="fit-day-toggle" data-action="fit-pw-toggle" data-day="${k}" data-id="${p.id}" aria-pressed="${on}">
          <span class="fit-day-check">${icon(on ? 'check' : 'plus')}</span>
          <span class="fit-day-name"><b>${esc(p.name)}</b><small>${p.exercises.length} ${dt('Übungen', 'exercises')}${on && !weekly ? ` · ${dt('nur an diesem Tag', 'this day only')}` : ''}</small></span>
        </button>
        <button class="chip fit-day-weekly ${weekly ? 'on' : ''}" data-action="fit-pw-weekly" data-day="${k}" data-id="${p.id}" title="${dt(`Jede Woche am ${wdLong}`, `Every ${wdLong}`)}">${icon('repeat')}${dt(`jeden ${WD[wd]}`, `every ${WD[wd]}`)}</button>
      </div>`;
    }).join('')}</div>` : `<div class="muted">${dt('Du hast noch keine Trainingstage. Leg einen an, dann kannst du ihn hier einplanen.', 'You have no training days yet. Create one to plan it here.')}</div>`}
    <div class="btn-row fit-day-actions">
      ${k === today && !f.live ? `<button class="btn primary" data-action="fit-start" data-id="${planned[0]?.id || ''}">${icon('play')}${planned[0] ? dt(`${esc(planned[0].name)} starten`, `Start ${esc(planned[0].name)}`) : dt('Freies Training', 'Free workout')}</button>` : ''}
      <button class="btn" data-action="fit-pw-new" data-day="${k}">${icon('plus')}${dt('Neuer Trainingstag', 'New training day')}</button>
      ${k <= today ? `<button class="btn" data-action="fit-pw-cardio" data-day="${k}">${icon('heart-pulse')}${dt('Cardio eintragen', 'Log cardio')}</button>` : ''}
    </div>
  </div>`;
}
const refreshFitDay = (k) => { render('update'); if (document.querySelector('#modal .fit-day-panel')) updatePanel(fitDayHtml(k), '', '.fit-day-panel'); };

/* ================= Trainingstag bearbeiten ================= */

function openPlanEditor(plan) {
  const p = plan || { id: null, name: '', color: COLORS[(fit().plans.length + 1) % COLORS.length], days: [], exercises: [{ name: '', sets: 3, reps: '8-12', kg: '' }] };
  ui.planEdit = { ...p, days: [...p.days], exercises: p.exercises.map((e) => ({ ...e, kg: e.kg ?? '' })), confirmDelete: false, error: '' };
  renderPlanEditor(true);
}

function renderPlanEditor(first = false) {
  const e = ui.planEdit;
  const html = `
    <div class="card-head"><h2 class="panel-title" style="font-size:20px">${e.id ? 'Trainingstag bearbeiten' : 'Neuer Trainingstag'}</h2>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    <div class="field"><label for="pe-name">Name</label><input class="input" id="pe-name" data-plan-field="name" maxlength="40" placeholder="z. B. Push, Oberkörper, Laufen" value="${esc(e.name)}"></div>
    <div class="field">
      <div class="label">An welchen Tagen?</div>
      <div class="day-row">${WD.map((d, i) => `<button class="${e.days.includes(i) ? 'on' : ''}" data-action="fit-pe-day" data-day="${i}" aria-pressed="${e.days.includes(i)}">${d}</button>`).join('')}</div>
    </div>
    <div class="field">
      <div class="label">Farbe</div>
      <div class="color-row">${COLORS.map((c) => `<button class="swatch ${e.color === c ? 'on' : ''}" style="--c:${c}" data-action="fit-pe-color" data-color="${c}" aria-label="Farbe ${c}"></button>`).join('')}</div>
    </div>
    <div class="field">
      <div class="label">Übungen</div>
      <div class="pe-ex">
        <div class="pe-row pe-head"><span>Übung</span><span>Sätze</span><span>Wdh.</span><span>kg</span><span></span></div>
        ${e.exercises.map((x, i) => `
        <div class="pe-row">
          <input class="input" list="fit-ex-names" data-pe-ex="name" data-i="${i}" maxlength="60" placeholder="z. B. Kniebeugen" value="${esc(x.name)}">
          <input class="input" inputmode="numeric" data-pe-ex="sets" data-i="${i}" value="${esc(String(x.sets))}">
          <input class="input" data-pe-ex="reps" data-i="${i}" maxlength="10" placeholder="8-12" value="${esc(x.reps || '')}">
          <input class="input" inputmode="decimal" data-pe-ex="kg" data-i="${i}" placeholder="–" value="${esc(String(x.kg ?? ''))}">
          <button class="icon-btn" data-action="fit-pe-ex-del" data-i="${i}" aria-label="Übung entfernen">${icon('x')}</button>
        </div>`).join('')}
      </div>
      <button class="btn small ghost" data-action="fit-pe-ex-add" style="align-self:flex-start">${icon('plus')}Übung</button>
      <datalist id="fit-ex-names">${EXERCISES.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
    </div>
    ${e.error ? `<div class="error">${e.error}</div>` : ''}
    <div class="modal-foot">
      ${e.id ? (e.confirmDelete
        ? `<div class="btn-row"><span class="error">Trainingstag löschen?</span><button class="btn small danger" data-action="fit-pe-delete-yes">Löschen</button><button class="btn small ghost" data-action="fit-pe-delete-no">Nein</button></div>`
        : `<button class="btn small danger" data-action="fit-pe-delete">${icon('trash-2')}Löschen</button>`) : ''}
      <div class="right"><button class="btn ghost" data-action="close-modal">Abbrechen</button><button class="btn primary" data-action="fit-pe-save">${icon('check')}Speichern</button></div>
    </div>`;
  if (first) { openPanel(html, 'wide'); return; }
  const m = document.querySelector('#modal .modal');
  if (m) { m.classList.remove('enter'); m.innerHTML = html; lucide.createIcons(); }
}

function savePlan() {
  const e = ui.planEdit;
  if (!e.name.trim()) { e.error = 'Gib dem Trainingstag einen Namen.'; renderPlanEditor(); return; }
  const exercises = e.exercises.filter((x) => x.name.trim()).map((x) => {
    const w = parseNum(String(x.kg || '').replace(/kg/i, ''));
    return { name: x.name.trim(), sets: Math.max(1, Math.min(20, parseInt(x.sets, 10) || 3)), reps: String(x.reps || '').trim(), kg: w > 0 ? r1(w) : null };
  });
  const f = fit();
  const data = { name: e.name.trim(), color: e.color, days: [...e.days].sort(), exercises };
  if (e.id) Object.assign(f.plans.find((p) => p.id === e.id), data);
  else f.plans.push({ id: uid(), ...data });
  ui.planEdit = null;
  save();
  closeModal();
  toast('Trainingstag gespeichert');
  render('update');
}

/* ================= Training mitschreiben ================= */

function startWorkout(planId) {
  const f = fit();
  const p = f.plans.find((x) => x.id === planId);
  const exercises = (p?.exercises || []).map((e) => {
    const last = lastSets(e.name);
    const reps = parseInt(e.reps, 10) || null;
    return {
      name: e.name, target: e.reps,
      sets: Array.from({ length: e.sets }, (_, i) => { const l = last?.sets[i] || last?.sets[last.sets.length - 1]; return { kg: l?.kg ?? e.kg ?? null, reps: l?.reps ?? reps, done: false }; }),
    };
  });
  f.live = { id: uid(), planId: p?.id || null, name: p?.name || 'Freies Training', start: new Date().toISOString(), exercises };
  save();
  if (ui.view === 'training') render('update'); else go('training');
  toast(p ? `${p.name} gestartet. Hake jeden Satz ab, wenn er geschafft ist.` : 'Training gestartet. Füge unten deine Übungen hinzu.');
}

function finishWorkout() {
  const f = fit();
  const l = f.live;
  if (!l) return;
  if (!l.exercises.some((e) => e.sets.some((s) => s.done))) { toast('Hake mindestens einen Satz ab, oder brich das Training ab.'); return; }
  const end = new Date();
  const w = { id: l.id, planId: l.planId, name: l.name, date: keyOf(new Date(l.start)), start: l.start, end: end.toISOString(), feel: l.feel || null, note: (l.note || '').trim() || null,
    exercises: l.exercises.filter((e) => e.sets.some((s) => s.done)).map((e) => ({ name: e.name, sets: e.sets.map((s) => ({ kg: s.kg || 0, reps: s.reps || 0, done: !!s.done })) })) };
  const before = personalBests();
  const xp0 = computeFitLevel().total;
  f.workouts.push(w);
  f.live = null;
  stopRest();
  save();
  confetti();
  const after = personalBests().filter((b) => b.date === w.date && !before.some((x) => x.name === b.name && x.orm >= b.orm));
  fitLvCache = null;
  const gain = computeFitLevel().total - xp0;
  const xpNote = gain > 0 ? ` · +${gain} Fitness-XP` : '';
  toast(after.length ? `Training gespeichert. Neue Bestleistung: ${after[0].name}!${xpNote}` : `Training gespeichert: ${doneSets(w)} Sätze in ${durOf(w)} min${xpNote}`);
  render('update');
}

function elapsed(l) {
  const m = Math.floor((Date.now() - new Date(l.start)) / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

setInterval(() => {
  const el = document.getElementById('fit-elapsed');
  const l = state.fitness?.live;
  if (el && l) el.textContent = elapsed(l);
}, 15000);

/* ================= Ernährung ================= */

function viewNutrition() {
  const f = fit();
  const day = ui.fitDay || todayKey();
  const g = needs();
  const eaten = dayFood(day);
  const kcal = kcalOf(eaten);
  const goal = goalFor(day);
  const burned = burnedOn(day);
  const prev = dayFood(addDays(day, -1));
  const water = f.water[day] || 0;
  const glasses = Math.max(8, Math.ceil(g.water / 250));
  const mon = addDays(day, -wdOf(day));
  const weekDays = range(mon, addDays(mon, 6)).filter((k) => k <= todayKey() && dayFood(k).length);
  const avg = weekDays.length ? weekDays.reduce((a, k) => a + kcalOf(dayFood(k)), 0) / weekDays.length : null;

  return `
  <header class="head fade-in">
    <div><div class="eyebrow">${esc(fmtLong(day))}</div><h1>Ernährung</h1></div>
    <div class="head-actions">
      <div class="week-nav">
        <button class="icon-btn" data-action="fit-day" data-dir="-1" aria-label="Voriger Tag">${icon('chevron-left')}</button>
        ${navNowBtn('fit-day', navDayLabel(day), day === todayKey(), dt('Zu heute', 'Go to today'))}
        <button class="icon-btn" data-action="fit-day" data-dir="1" aria-label="Nächster Tag">${icon('chevron-right')}</button>
      </div>
      ${prev.length && !eaten.length ? `<button class="btn" data-action="fit-copy-day">${icon('copy')}Vortag übernehmen</button>` : ''}
      <button class="btn primary" data-action="fit-food-add" data-meal="${defaultMeal()}">${icon('plus')}Essen eintragen</button>
    </div>
  </header>

  <section class="grid">
    <article class="card s4 fade-in fit-kcal-card">
      <div class="card-head"><div><h2>Kalorien</h2><div class="sub">Ziel ${fmtNum(goal)} kcal${burned ? `, davon ${fmtNum(burned)} durch Sport` : g.auto ? '' : ' (Standard)'}</div></div><button class="icon-btn" data-action="fit-profile" title="Ziel anpassen">${icon('target')}</button></div>
      <div class="fit-kcal">
        ${kcalRing(kcal, goal)}
        <div class="plan-list">
          <div><span>Gegessen</span><b>${fmtNum(Math.round(kcal))} kcal</b></div>
          ${burned ? `<div><span>Sport</span><b>+${fmtNum(burned)} kcal</b></div>` : ''}
          <div><span>Ziel</span><b>${fmtNum(goal)} kcal</b></div>
          <div class="plan-total"><span>${kcal > goal ? 'Zu viel' : 'Übrig'}</span><b class="${kcal > goal ? 'bad' : 'good'}">${fmtNum(Math.round(Math.abs(goal - kcal)))} kcal</b></div>
        </div>
      </div>
    </article>
    <article class="card s4 fade-in">
      <div class="card-head"><div><h2>Makros</h2><div class="sub">Eiweiß, Kohlenhydrate und Fett in Gramm</div></div></div>
      ${macroBars(eaten, g)}
    </article>
    <article class="card s4 fit-last fade-in">
      <div class="card-head"><div><h2>Wasser</h2><div class="sub">${fmtNum(r1(water / 1000))} von ${fmtNum(r1(g.water / 1000))} Litern · ein Glas sind 250 ml</div></div>
        ${water ? `<button class="icon-btn" data-action="fit-water" data-ml="-250" title="Ein Glas weniger">${icon('minus')}</button>` : ''}</div>
      <div class="fit-glasses">${Array.from({ length: glasses }, (_, i) => `<button class="fit-glass ${i < water / 250 ? 'on' : ''}" data-action="fit-water-set" data-ml="${(i + 1) * 250}" aria-label="${(i + 1) * 250} ml">${icon('glass-water')}</button>`).join('')}</div>
    </article>

    ${fastCard()}
    ${suppCard()}

    ${MEALS.map((m) => {
      const list = eaten.filter((e) => e.meal === m.id);
      const prevList = prev.filter((e) => e.meal === m.id);
      return `
    <article class="card s6 fade-in fit-meal">
      <div class="card-head"><div><h2>${icon(m.icon)}${m.name}</h2><div class="sub">${list.length ? `${fmtNum(Math.round(kcalOf(list)))} kcal · E ${fmtNum(Math.round(sumOf(list, 'p')))} g · K ${fmtNum(Math.round(sumOf(list, 'c')))} g · F ${fmtNum(Math.round(sumOf(list, 'f')))} g` : 'Noch nichts eingetragen'}</div></div>
        <div class="btn-row fit-meal-actions">
          ${prevList.length && !list.length ? `<button class="icon-btn" data-action="fit-copy-meal" data-meal="${m.id}" title="Wie am Vortag">${icon('copy')}</button>` : ''}
          ${list.length ? `<button class="icon-btn" data-action="fit-tpl-save" data-meal="${m.id}" title="Als Vorlage speichern">${icon('bookmark')}</button>` : ''}
          <button class="icon-btn" data-action="fit-food-add" data-meal="${m.id}" title="${m.name} eintragen">${icon('plus')}</button>
        </div></div>
      ${list.length ? `<div class="fit-food-list">${list.map((e) => `
        <div class="fit-food-row">
          <span class="fit-food-main"><b>${esc(e.name)}</b><small>${e.amount ? `${fmtNum(e.amount)} ${e.unit || 'g'} · ` : ''}E ${fmtNum(r1(e.p || 0))} · K ${fmtNum(r1(e.c || 0))} · F ${fmtNum(r1(e.f || 0))}</small></span>
          <span class="fit-food-kcal">${fmtNum(Math.round(e.kcal))} kcal</span>
          <button class="icon-btn fit-hist-del" data-action="fit-food-del" data-id="${e.id}" title="Entfernen">${icon('x')}</button>
        </div>`).join('')}</div>` : ''}
    </article>`;
    }).join('')}

    ${tplCard()}
    ${recipeCard()}

    <article class="card s12 fade-in">
      <div class="card-head"><div><h2>Woche im Überblick</h2><div class="sub">${avg ? `Im Schnitt ${fmtNum(Math.round(avg))} kcal an ${weekDays.length} ${weekDays.length === 1 ? 'Tag' : 'Tagen'} mit Einträgen` : 'In dieser Woche noch keine Einträge'}</div></div></div>
      ${weekStrip(mon)}
    </article>
  </section>`;
}

function defaultMeal() {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
}

/* ================= Essen eintragen ================= */

function foodSuggestions(q) {
  const f = fit();
  const seen = new Set();
  const out = [];
  const push = (it, tag) => { const k = it.name.toLowerCase(); if (seen.has(k)) return; seen.add(k); out.push({ ...it, tag }); };
  // Zuletzt gegessen, eigene Lebensmittel, dann die eingebaute Liste
  const recent = Object.keys(f.food).sort().reverse().flatMap((k) => f.food[k]).filter((e) => e.base);
  const match = (n) => !q || n.toLowerCase().includes(q);
  for (const e of recent) if (match(e.name)) push({ ...e.base, name: e.name }, 'Zuletzt');
  for (const r of f.recipes) if (match(r.name)) push(recipeFood(r), 'Rezept');
  for (const it of f.foods) if (match(it.name)) push(it, 'Eigenes');
  for (const it of FOOD_DB) if (match(it.name)) push(it, '');
  if (q) out.sort((a, b) => (b.name.toLowerCase().startsWith(q) ? 1 : 0) - (a.name.toLowerCase().startsWith(q) ? 1 : 0));
  return out.slice(0, q ? 30 : 14);
}

function openFoodAdd(meal) {
  ui.foodAdd = { meal, day: ui.fitDay || todayKey(), q: '', sel: null, amount: '', tab: 'search', name: '', kcal: '', p: '', c: '', f: '', remember: true, error: '' };
  renderFoodAdd(true);
}

function foodCalc(sel, amount) {
  const a = parseNum(String(amount)) || 0;
  const k = sel.per === 1 ? a : a / sel.per;
  return { kcal: sel.kcal * k, p: sel.p * k, c: sel.c * k, f: sel.f * k };
}

function renderFoodAdd(first = false) {
  const e = ui.foodAdd;
  const active = document.activeElement;
  const focusId = active?.id, caret = active?.selectionStart;
  const list = [...foodSuggestions(e.q.trim().toLowerCase()), ...(e.online || []).map((x) => ({ ...x, tag: 'Online' }))];
  const isCode = /^\d{8,14}$/.test(e.q.trim());
  const sel = e.sel;
  const calc = sel ? foodCalc(sel, e.amount) : null;
  const html = `
    <div class="card-head"><div><div class="eyebrow">${esc(fmtShort(e.day))}</div><h2 class="panel-title" style="font-size:20px">Essen eintragen</h2></div>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    <div class="seg-row">${MEALS.map((m) => `<button class="${e.meal === m.id ? 'on' : ''}" data-action="fit-fa-meal" data-meal="${m.id}">${icon(m.icon)}${m.name}</button>`).join('')}</div>
    <div class="segmented"><button class="${e.tab === 'search' ? 'on' : ''}" data-action="fit-fa-tab" data-tab="search">Suchen</button><button class="${e.tab === 'manual' ? 'on' : ''}" data-action="fit-fa-tab" data-tab="manual">Selbst eingeben</button></div>
    ${e.tab === 'search' ? (sel ? `
      <div class="fit-sel">
        <div class="card-head"><div><b>${esc(sel.name)}</b><div class="sub">${sel.per === 1 ? `${fmtNum(Math.round(sel.kcal))} kcal pro Portion` : `${fmtNum(Math.round(sel.kcal))} kcal pro 100 ${sel.unit}`}</div></div><button class="btn small ghost" data-action="fit-fa-back">${icon('arrow-left')}Andere Auswahl</button></div>
        <div class="ce-row">
          <div class="field"><label for="fa-amount">${sel.per === 1 ? 'Portionen' : `Menge in ${sel.unit}`}</label><input class="input" id="fa-amount" data-fa-field="amount" inputmode="decimal" value="${esc(String(e.amount))}"></div>
          ${sel.portion && sel.per !== 1 ? `<div class="field"><div class="label">Schnell</div><div class="btn-row">${[0.5, 1, 2].map((m) => `<button class="btn small ghost" data-action="fit-fa-portion" data-amount="${Math.round(sel.portion * m)}">${fmtNum(Math.round(sel.portion * m))} ${sel.unit}</button>`).join('')}</div></div>` : ''}
        </div>
        <div class="fit-calc" id="fa-calc">${foodCalcHtml(calc)}</div>
      </div>` : `
      <label class="fin-search">${icon('search')}<input id="fa-q" data-fa-field="q" placeholder="Suchen, z. B. Haferflocken" value="${esc(e.q)}" autocomplete="off"></label>
      <div class="fit-results">${list.map((it, i) => `
        <button class="fit-result" data-action="fit-fa-pick" data-i="${i}">
          <span><b>${esc(it.name)}</b>${it.tag ? `<small class="fit-tag">${it.tag}</small>` : ''}</span>
          <small>${it.per === 1 ? `${fmtNum(Math.round(it.kcal))} kcal pro Portion` : `${fmtNum(Math.round(it.kcal))} kcal / 100 ${it.unit}`}</small>
        </button>`).join('') || `<div class="muted">${isCode ? 'Ein Barcode. Schlag ihn unten online nach.' : 'Nichts gefunden. Probier die Online-Suche oder leg es unter „Selbst eingeben“ an.'}</div>`}</div>
      <div class="fit-online">
        ${e.q.trim().length >= 2 && window.api?.foodSearch ? `<button class="btn small ghost" data-action="fit-fa-online" ${e.onlineState === 'loading' ? 'disabled' : ''}>${icon(isCode ? 'scan-barcode' : 'globe')}${isCode ? 'Barcode nachschlagen' : `Online nach „${esc(e.q.trim())}“ suchen`}</button>` : '<span class="muted">Tipp: Markenprodukte findest du mit der Online-Suche, auch per Barcode-Nummer.</span>'}
        ${e.onlineState === 'loading' ? '<span class="muted">Suche läuft …</span>' : e.onlineState === 'error' ? '<span class="error">Keine Verbindung zu Open Food Facts. Bist du online?</span>' : e.onlineState === 'empty' ? '<span class="muted">Online nichts gefunden.</span>' : e.onlineState === 'done' ? `<span class="muted">${e.online.length} Treffer von Open Food Facts</span>` : ''}
      </div>`) : `
      <div class="field"><label for="fa-name">Was hast du gegessen?</label><input class="input" id="fa-name" data-fa-field="name" maxlength="60" placeholder="z. B. Omas Lasagne" value="${esc(e.name)}"></div>
      <div class="fit-manual">
        <div class="field"><label for="fa-kcal">kcal</label><input class="input" id="fa-kcal" data-fa-field="kcal" inputmode="decimal" value="${esc(e.kcal)}"></div>
        <div class="field"><label for="fa-p">Eiweiß g</label><input class="input" id="fa-p" data-fa-field="p" inputmode="decimal" value="${esc(e.p)}"></div>
        <div class="field"><label for="fa-c">Kohlenh. g</label><input class="input" id="fa-c" data-fa-field="c" inputmode="decimal" value="${esc(e.c)}"></div>
        <div class="field"><label for="fa-f">Fett g</label><input class="input" id="fa-f" data-fa-field="f" inputmode="decimal" value="${esc(e.f)}"></div>
      </div>
      <label class="setting" for="fa-remember" style="border:0;padding:0"><div><b>Für später merken</b><span>Erscheint dann bei der Suche als eigenes Lebensmittel (eine Portion)</span></div><input type="checkbox" class="switch" id="fa-remember" data-action="fit-fa-remember" ${e.remember ? 'checked' : ''}></label>`}
    ${e.error ? `<div class="error">${e.error}</div>` : ''}
    <div class="modal-foot"><div class="right"><button class="btn ghost" data-action="close-modal">Abbrechen</button>
      ${e.tab === 'manual' || sel ? `<button class="btn primary" data-action="fit-fa-save">${icon('check')}Eintragen</button>` : ''}</div></div>`;
  ui.foodList = list;
  if (first) openPanel(html);
  else {
    const m = document.querySelector('#modal .modal');
    if (m) { m.classList.remove('enter'); m.innerHTML = html; lucide.createIcons(); }
  }
  const el = focusId ? document.getElementById(focusId) : document.getElementById(sel ? 'fa-amount' : e.tab === 'manual' ? 'fa-name' : 'fa-q');
  if (el) { el.focus(); if (caret !== undefined && caret !== null && focusId && el.setSelectionRange) try { el.setSelectionRange(caret, caret); } catch { /* Zahlenfeld */ } }
}

function foodCalcHtml(c) {
  if (!c) return '';
  return `<span><b>${fmtNum(Math.round(c.kcal))}</b> kcal</span><span>E <b>${fmtNum(r1(c.p))}</b> g</span><span>K <b>${fmtNum(r1(c.c))}</b> g</span><span>F <b>${fmtNum(r1(c.f))}</b> g</span>`;
}

function saveFood() {
  const e = ui.foodAdd;
  const f = fit();
  let entry;
  if (e.tab === 'manual') {
    const n = (v) => Math.max(0, parseNum(String(v || '0')) || 0);
    if (!e.name.trim()) { e.error = 'Gib an, was du gegessen hast.'; renderFoodAdd(); return; }
    if (!(n(e.kcal) > 0)) { e.error = 'Gib die Kalorien ein, z. B. 450.'; renderFoodAdd(); return; }
    const base = { kcal: n(e.kcal), p: n(e.p), c: n(e.c), f: n(e.f), per: 1, unit: 'Portion' };
    entry = { name: e.name.trim(), amount: 1, unit: 'Portion', ...base, base };
    if (e.remember) f.foods = [{ name: entry.name, ...base }, ...f.foods.filter((x) => x.name.toLowerCase() !== entry.name.toLowerCase())].slice(0, 200);
  } else {
    const a = parseNum(String(e.amount));
    if (!(a > 0)) { e.error = 'Gib eine Menge größer als 0 ein.'; renderFoodAdd(); return; }
    const s = e.sel;
    const c = foodCalc(s, a);
    entry = { name: s.name, amount: r1(a), unit: s.per === 1 ? (a === 1 ? 'Portion' : 'Portionen') : s.unit, kcal: c.kcal, p: c.p, c: c.c, f: c.f,
      base: { kcal: s.kcal, p: s.p, c: s.c, f: s.f, per: s.per, unit: s.unit, portion: s.portion } };
  }
  (f.food[e.day] ||= []).push({ id: uid(), meal: e.meal, ...entry, kcal: Math.round(entry.kcal * 10) / 10 });
  const meal = MEALS.find((m) => m.id === e.meal).name;
  ui.foodAdd = null;
  save();
  closeModal();
  toast(`${entry.name} bei ${meal} eingetragen`);
  render('update');
}

/* ================= Profil und Gewicht ================= */

function openProfile() {
  const f = fit();
  const p = f.profile || { sex: 'm', age: '', height: '', weight: currentWeight() || '', goal: 'keep', activity: 1.375, targetWeight: '' };
  const g = f.goals || {};
  const raw = (v) => (v === '' || v === null || v === undefined ? '' : fmtNum(v));
  ui.fitProfile = { ...p, weight: raw(p.weight), targetWeight: raw(p.targetWeight), custom: !!f.goals, gkcal: g.kcal ?? '', gp: g.p ?? '', gc: g.c ?? '', gf: g.f ?? '', gwater: g.water ?? '', stepGoal: String(f.stepGoal), weekGoal: String(f.weekGoal), error: '' };
  renderProfile(true);
}

function renderProfile(first = false) {
  const e = ui.fitProfile;
  const auto = needs().auto;
  const html = `
    <div class="card-head"><h2 class="panel-title" style="font-size:20px">Profil und Ziele</h2>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    <div class="ce-row">
      <div class="field"><div class="label">Geschlecht</div><div class="segmented"><button class="${e.sex === 'm' ? 'on' : ''}" data-action="fit-pr-sex" data-sex="m">Männlich</button><button class="${e.sex === 'w' ? 'on' : ''}" data-action="fit-pr-sex" data-sex="w">Weiblich</button></div></div>
      <div class="field"><label for="pr-age">Alter</label><input class="input" id="pr-age" data-pr-field="age" inputmode="numeric" value="${esc(String(e.age))}" placeholder="z. B. 28"></div>
    </div>
    <div class="ce-row">
      <div class="field"><label for="pr-height">Größe in cm</label><input class="input" id="pr-height" data-pr-field="height" inputmode="numeric" value="${esc(String(e.height))}" placeholder="z. B. 180"></div>
      <div class="field"><label for="pr-weight">Gewicht in kg</label><input class="input" id="pr-weight" data-pr-field="weight" inputmode="decimal" value="${esc(String(e.weight))}" placeholder="z. B. 78,5"></div>
    </div>
    <div class="field"><div class="label">Ziel</div><div class="seg-row">${Object.entries(FIT_GOALS).map(([k, [name]]) => `<button class="${e.goal === k ? 'on' : ''}" data-action="fit-pr-goal" data-goal="${k}">${icon({ lose: 'trending-down', keep: 'equal', gain: 'trending-up' }[k])}${name}</button>`).join('')}</div></div>
    <div class="field"><label for="pr-target">Wunschgewicht in kg (optional)</label><input class="input" id="pr-target" data-pr-field="targetWeight" inputmode="decimal" value="${esc(String(e.targetWeight))}" placeholder="z. B. 75"></div>
    <div class="field"><label for="pr-activity">Wie aktiv bist du?</label><select class="input" id="pr-activity" data-pr-field="activity">
      ${ACTIVITY.map(([v, name, text]) => `<option value="${v}" ${Number(e.activity) === v ? 'selected' : ''}>${name}: ${text}</option>`).join('')}</select></div>
    <div class="ce-row">
      <div class="field"><label for="pr-week">Trainingstage pro Woche</label><input class="input" id="pr-week" data-pr-field="weekGoal" inputmode="numeric" value="${esc(e.weekGoal)}" placeholder="3"></div>
      <div class="field"><label for="pr-steps">Schrittziel pro Tag</label><input class="input" id="pr-steps" data-pr-field="stepGoal" inputmode="numeric" value="${esc(e.stepGoal)}" placeholder="8000"></div>
    </div>
    <label class="setting" for="pr-custom" style="border:0;padding:0"><div><b>Eigene Ziele festlegen</b><span>${auto ? `Berechnet: ${fmtNum(auto.kcal)} kcal, ${auto.p} g Eiweiß, ${auto.c} g Kohlenhydrate, ${auto.f} g Fett` : 'Statt der berechneten Werte, zum Beispiel vom Ernährungsberater'}</span></div><input type="checkbox" class="switch" id="pr-custom" data-action="fit-pr-custom" ${e.custom ? 'checked' : ''}></label>
    ${e.custom ? `<div class="fit-manual">
      <div class="field"><label for="pr-gkcal">kcal</label><input class="input" id="pr-gkcal" data-pr-field="gkcal" inputmode="numeric" value="${esc(String(e.gkcal))}" placeholder="${auto?.kcal || 2000}"></div>
      <div class="field"><label for="pr-gp">Eiweiß g</label><input class="input" id="pr-gp" data-pr-field="gp" inputmode="numeric" value="${esc(String(e.gp))}" placeholder="${auto?.p || 100}"></div>
      <div class="field"><label for="pr-gc">Kohlenh. g</label><input class="input" id="pr-gc" data-pr-field="gc" inputmode="numeric" value="${esc(String(e.gc))}" placeholder="${auto?.c || 240}"></div>
      <div class="field"><label for="pr-gf">Fett g</label><input class="input" id="pr-gf" data-pr-field="gf" inputmode="numeric" value="${esc(String(e.gf))}" placeholder="${auto?.f || 65}"></div>
    </div>` : ''}
    ${e.error ? `<div class="error">${e.error}</div>` : ''}
    <div class="modal-foot"><div class="right"><button class="btn ghost" data-action="close-modal">Abbrechen</button><button class="btn primary" data-action="fit-pr-save">${icon('check')}Speichern</button></div></div>`;
  if (first) { openPanel(html); return; }
  const m = document.querySelector('#modal .modal');
  if (m) { m.classList.remove('enter'); m.innerHTML = html; lucide.createIcons(); }
}

function saveProfile() {
  const e = ui.fitProfile;
  const age = parseInt(e.age, 10), height = parseInt(e.height, 10), weight = parseNum(String(e.weight)), target = parseNum(String(e.targetWeight || ''));
  if (!(age >= 12 && age <= 100)) { e.error = 'Gib dein Alter ein (12 bis 100).'; renderProfile(); return; }
  if (!(height >= 120 && height <= 230)) { e.error = 'Gib deine Größe in Zentimetern ein, z. B. 180.'; renderProfile(); return; }
  if (!(weight >= 30 && weight <= 300)) { e.error = 'Gib dein Gewicht in Kilogramm ein, z. B. 78,5.'; renderProfile(); return; }
  const f = fit();
  f.weekGoal = Math.max(1, Math.min(7, parseInt(e.weekGoal, 10) || f.weekGoal));
  f.stepGoal = Math.max(1000, Math.min(50000, parseInt(String(e.stepGoal).replace(/\D/g, ''), 10) || f.stepGoal));
  f.profile = { sex: e.sex, age, height, weight: r1(weight), goal: e.goal, activity: Number(e.activity), targetWeight: target > 0 ? r1(target) : null };
  if (weightAt(todayKey()) !== r1(weight)) f.weights[todayKey()] = r1(weight);
  if (e.custom) {
    const n = (v) => parseInt(v, 10) || undefined;
    const g = Object.fromEntries(Object.entries({ kcal: n(e.gkcal), p: n(e.gp), c: n(e.gc), f: n(e.gf) }).filter(([, v]) => v));
    f.goals = Object.keys(g).length ? g : null;
  } else f.goals = null;
  ui.fitProfile = null;
  save();
  closeModal();
  toast(`Gespeichert. Dein Tagesziel: ${fmtNum(needs().kcal)} kcal`);
  render('update');
}

function openWeight() {
  ui.fitWeightEdit = { day: todayKey(), kg: weightAt(todayKey()) === fit().weights[todayKey()] && fit().weights[todayKey()] ? fmtNum(fit().weights[todayKey()]) : '' };
  openPanel(`
    <div class="card-head"><h2 class="panel-title" style="font-size:20px">Gewicht eintragen</h2>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    <div class="ce-row">
      <div class="field"><label for="we-kg">Gewicht in kg</label><input class="input" id="we-kg" inputmode="decimal" value="${esc(ui.fitWeightEdit.kg)}" placeholder="${currentWeight() ? fmtNum(r1(currentWeight())) : 'z. B. 78,5'}"></div>
      <div class="field"><label for="we-day">Tag</label><input class="input" type="date" id="we-day" value="${todayKey()}" max="${todayKey()}"></div>
    </div>
    <div class="sub" style="margin:0">Tipp: Wieg dich am besten immer zur gleichen Zeit, morgens nach dem Aufstehen.</div>
    <div class="modal-foot"><div class="right"><button class="btn ghost" data-action="close-modal">Abbrechen</button><button class="btn primary" data-action="fit-weight-save">${icon('check')}Speichern</button></div></div>`, 'narrow');
  setTimeout(() => document.getElementById('we-kg')?.focus(), 60);
}

function saveWeight(value, day = todayKey()) {
  const w = parseNum(String(value).replace(/kg/i, ''));
  if (!(w >= 30 && w <= 300)) { toast('Gib dein Gewicht in Kilogramm ein, z. B. 78,5.'); return false; }
  fit().weights[day] = r1(w);
  save();
  const cw = currentWeight(), target = fit().profile?.targetWeight;
  toast(target && Math.abs(cw - target) < 0.3 ? 'Wunschgewicht erreicht, stark!' : `${kg(w)} eingetragen`);
  return true;
}

/* ================= Aktionen ================= */

function fitnessAction(a, el) {
  const f = fit();
  const live = f.live;
  switch (a) {
    case 'fit-pw-open': openPanel(fitDayHtml(el.dataset.day)); return true;
    case 'fit-pw-toggle': {
      const k = el.dataset.day, id = el.dataset.id, p = f.plans.find((x) => x.id === id);
      const on = plannedOn(k).includes(p);
      const list = (o) => (o?.[k] || []).filter((x) => x !== id);
      f.dayPlans = { ...(f.dayPlans || {}), [k]: list(f.dayPlans) };
      f.daySkip = { ...(f.daySkip || {}), [k]: list(f.daySkip) };
      // Fester Wochentag: an diesem Datum auslassen oder wieder rein; sonst nur für dieses Datum dazu
      if (p.days.includes(wdOf(k))) { if (on) f.daySkip[k].push(id); } else if (!on) f.dayPlans[k].push(id);
      if (!f.dayPlans[k].length) delete f.dayPlans[k];
      if (!f.daySkip[k].length) delete f.daySkip[k];
      save();
      refreshFitDay(k);
      return true;
    }
    case 'fit-pw-weekly': {
      const k = el.dataset.day, id = el.dataset.id, p = f.plans.find((x) => x.id === id), wd = wdOf(k);
      p.days = p.days.includes(wd) ? p.days.filter((d) => d !== wd) : [...p.days, wd];
      // Ausnahmen für dieses Datum fallen weg, es gilt jetzt der Wochentag
      for (const o of [f.dayPlans, f.daySkip]) if (o?.[k]) { o[k] = o[k].filter((x) => x !== id); if (!o[k].length) delete o[k]; }
      save();
      refreshFitDay(k);
      return true;
    }
    case 'fit-pw-new': closeModal(); openPlanEditor(null); ui.planEdit.days = [wdOf(el.dataset.day)]; renderPlanEditor(); return true;
    case 'fit-pw-cardio': closeModal(); openCardio(); ui.cardioEdit.day = el.dataset.day; renderCardio(); return true;
    case 'fit-enable':
      f.enabled = true;
      save();
      closeModal();
      renderSidebar();
      confetti();
      toast('Bereich Fitness ist aktiv. Richte zuerst kurz dein Profil ein.');
      setTimeout(() => go('fitness'), 250);
      return true;
    case 'fit-toggle':
      if (!el.checked && f.live) { el.checked = true; toast('Bitte erst das laufende Training beenden.'); return true; }
      f.enabled = el.checked;
      save();
      renderSidebar();
      toast(el.checked ? 'Bereich Fitness ist aktiv' : 'Bereich Fitness ist aus. Deine Daten bleiben gespeichert.');
      return true;
    case 'fit-go-training': go('training'); return true;
    case 'fit-go-nutrition': go('nutrition'); return true;
    case 'fit-profile': openProfile(); return true;
    case 'fit-pr-sex': ui.fitProfile.sex = el.dataset.sex; renderProfile(); return true;
    case 'fit-pr-goal': ui.fitProfile.goal = el.dataset.goal; renderProfile(); return true;
    case 'fit-pr-custom': ui.fitProfile.custom = el.checked; renderProfile(); return true;
    case 'fit-pr-save': saveProfile(); return true;
    case 'fit-weight': openWeight(); return true;
    case 'fit-weight-save': {
      const day = document.getElementById('we-day')?.value || todayKey();
      if (saveWeight(document.getElementById('we-kg')?.value || '', day > todayKey() ? todayKey() : day)) { closeModal(); render('update'); }
      return true;
    }
    case 'fit-water': case 'fit-water-set': {
      const day = ui.view === 'nutrition' ? ui.fitDay || todayKey() : todayKey();
      const cur = f.water[day] || 0;
      const ml = Number(el.dataset.ml);
      const next = a === 'fit-water' ? Math.max(0, cur + ml) : (cur === ml ? ml - 250 : ml);
      if (next) f.water[day] = next; else delete f.water[day];
      save();
      if (next >= needs().water && cur < needs().water) toast('Trinkziel erreicht');
      render('update');
      return true;
    }
    case 'fit-start':
      if (live) { go('training'); return true; }
      startWorkout(el.dataset.id || null);
      return true;
    case 'fit-set-done': {
      const s = live?.exercises[el.dataset.ei]?.sets[el.dataset.si];
      if (!s) return true;
      s.done = !s.done;
      save();
      render('update');
      if (s.done) startRest();
      if (s.done) { const again = document.querySelector(`.fit-check[data-ei="${el.dataset.ei}"][data-si="${el.dataset.si}"]`); if (again) { again.classList.add('pop'); burst(again, 'var(--good)'); } }
      return true;
    }
    case 'fit-set-add': {
      const e = live?.exercises[el.dataset.ei];
      if (!e) return true;
      const prev = e.sets[e.sets.length - 1];
      e.sets.push({ kg: prev?.kg ?? null, reps: prev?.reps ?? null, done: false });
      save(); render('update');
      return true;
    }
    case 'fit-set-remove': { const e = live?.exercises[el.dataset.ei]; if (e && e.sets.length > 1) { e.sets.pop(); save(); render('update'); } return true; }
    case 'fit-ex-remove': live?.exercises.splice(Number(el.dataset.ei), 1); save(); render('update'); return true;
    case 'fit-finish': finishWorkout(); return true;
    case 'fit-cancel': ui.fitCancel = true; render('update'); return true;
    case 'fit-cancel-no': ui.fitCancel = false; render('update'); return true;
    case 'fit-cancel-yes': ui.fitCancel = false; f.live = null; stopRest(); save(); toast('Training verworfen'); render('update'); return true;
    case 'fit-week': { const d = Number(el.dataset.dir), from = ui.fitWeek || 0; ui.fitWeek = d === 0 ? 0 : from + d; slideRender(slideDir(from, ui.fitWeek)); return true; }
    case 'fit-hist-more': ui.fitHistLimit = (ui.fitHistLimit || 8) + 10; render('update'); return true;
    case 'fit-workout-del': ui.fitDelWorkout = el.dataset.id; render('update'); return true;
    case 'fit-workout-del-no': ui.fitDelWorkout = null; render('update'); return true;
    case 'fit-workout-del-yes': f.workouts = f.workouts.filter((w) => w.id !== el.dataset.id); ui.fitDelWorkout = null; save(); toast('Training gelöscht'); render('update'); return true;
    case 'fit-template': {
      const t = PLAN_TEMPLATES[el.dataset.id];
      t.plans.forEach(([name, days, ex], i) => f.plans.push({ id: uid(), name, color: COLORS[(f.plans.length + i + 1) % COLORS.length], days, exercises: ex.map(([n, sets, reps]) => ({ name: n, sets, reps, kg: null })) }));
      save(); confetti(); toast(`Vorlage „${t.name}“ angelegt. Tage und Übungen kannst du jederzeit ändern.`); render('update');
      return true;
    }
    case 'fit-plan-new': openPlanEditor(null); return true;
    case 'fit-plan-edit': openPlanEditor(f.plans.find((p) => p.id === el.dataset.id)); return true;
    case 'fit-pe-day': { const d = Number(el.dataset.day), e = ui.planEdit; e.days = e.days.includes(d) ? e.days.filter((x) => x !== d) : [...e.days, d]; renderPlanEditor(); return true; }
    case 'fit-pe-color': ui.planEdit.color = el.dataset.color; renderPlanEditor(); return true;
    case 'fit-pe-ex-add': ui.planEdit.exercises.push({ name: '', sets: 3, reps: '8-12', kg: '' }); renderPlanEditor(); document.querySelector(`[data-pe-ex="name"][data-i="${ui.planEdit.exercises.length - 1}"]`)?.focus(); return true;
    case 'fit-pe-ex-del': ui.planEdit.exercises.splice(Number(el.dataset.i), 1); renderPlanEditor(); return true;
    case 'fit-pe-save': savePlan(); return true;
    case 'fit-pe-delete': ui.planEdit.confirmDelete = true; renderPlanEditor(); return true;
    case 'fit-pe-delete-no': ui.planEdit.confirmDelete = false; renderPlanEditor(); return true;
    case 'fit-pe-delete-yes':
      f.plans = f.plans.filter((p) => p.id !== ui.planEdit.id);
      ui.planEdit = null; save(); closeModal(); toast('Trainingstag gelöscht'); render('update');
      return true;
    case 'fit-day': {
      const d = Number(el.dataset.dir), from = ui.fitDay || todayKey();
      ui.fitDay = d === 0 ? null : addDays(from, d);
      if (ui.fitDay === todayKey()) ui.fitDay = null;
      slideRender(slideDir(from, ui.fitDay || todayKey()));
      return true;
    }
    case 'fit-food-add': openFoodAdd(el.dataset.meal || defaultMeal()); return true;
    case 'fit-food-del': {
      const day = ui.fitDay || todayKey();
      f.food[day] = dayFood(day).filter((e) => e.id !== el.dataset.id);
      if (!f.food[day].length) delete f.food[day];
      save(); render('update');
      return true;
    }
    case 'fit-fa-meal': ui.foodAdd.meal = el.dataset.meal; renderFoodAdd(); return true;
    case 'fit-fa-tab': ui.foodAdd.tab = el.dataset.tab; ui.foodAdd.error = ''; if (el.dataset.tab === 'manual' && !ui.foodAdd.name) ui.foodAdd.name = ui.foodAdd.q; renderFoodAdd(); return true;
    case 'fit-fa-pick': {
      const it = ui.foodList[Number(el.dataset.i)];
      ui.foodAdd.sel = it;
      ui.foodAdd.amount = it.per === 1 ? '1' : String(it.portion || 100);
      ui.foodAdd.error = '';
      document.activeElement?.blur();
      renderFoodAdd();
      document.getElementById('fa-amount')?.select();
      return true;
    }
    case 'fit-fa-back': ui.foodAdd.sel = null; ui.foodAdd.error = ''; document.activeElement?.blur(); renderFoodAdd(); return true;
    case 'fit-fa-portion': ui.foodAdd.amount = el.dataset.amount; renderFoodAdd(); return true;
    case 'fit-fa-remember': ui.foodAdd.remember = el.checked; return true;
    case 'fit-fa-save': saveFood(); return true;
  }
  return fitMoreAction(a, el);
}

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.planField && ui.planEdit) ui.planEdit[t.dataset.planField] = t.value;
  if (t.dataset.peEx && ui.planEdit) ui.planEdit.exercises[Number(t.dataset.i)][t.dataset.peEx] = t.value;
  if (t.dataset.prField && ui.fitProfile) ui.fitProfile[t.dataset.prField] = t.value;
  if (t.dataset.faField && ui.foodAdd) {
    ui.foodAdd[t.dataset.faField] = t.value;
    if (t.dataset.faField === 'q') { ui.foodAdd.online = null; ui.foodAdd.onlineState = null; renderFoodAdd(); }
    if (t.dataset.faField === 'amount' && ui.foodAdd.sel) { const c = document.getElementById('fa-calc'); if (c) c.innerHTML = foodCalcHtml(foodCalc(ui.foodAdd.sel, t.value)); }
  }
  if (t.dataset.fitSet && state.fitness?.live) {
    const s = state.fitness.live.exercises[t.dataset.ei]?.sets[t.dataset.si];
    if (!s) return;
    const v = t.dataset.fitSet === 'kg' ? parseNum(t.value.replace(/kg/i, '')) : parseInt(t.value, 10);
    s[t.dataset.fitSet] = Number.isFinite(v) && v >= 0 ? (t.dataset.fitSet === 'kg' ? r1(v) : v) : null;
    save();
  }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.prField && ui.fitProfile) ui.fitProfile[t.dataset.prField] = t.value;
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !ui.foodAdd || !e.target.closest?.('#modal') || !document.querySelector('#modal [data-fa-field]')) return;
  if (e.target.id === 'fa-q') { if (ui.foodList?.length) { e.preventDefault(); fitnessAction('fit-fa-pick', { dataset: { i: '0' } }); } return; }
  if (e.target.matches('input:not([type=checkbox])')) { e.preventDefault(); saveFood(); }
});
document.addEventListener('submit', (e) => {
  const t = e.target;
  if (t.matches('[data-fit-weight-form]')) {
    e.preventDefault();
    if (saveWeight(t.querySelector('input').value)) render('update');
  } else if (t.matches('[data-fit-ex-add]')) {
    e.preventDefault();
    const name = t.querySelector('input').value.trim();
    const l = state.fitness?.live;
    if (!name || !l) return;
    const last = lastSets(name);
    l.exercises.push({ name, target: '', sets: (last?.sets || [{}, {}, {}]).map((s) => ({ kg: s.kg ?? null, reps: s.reps ?? null, done: false })) });
    save();
    render('update');
    document.getElementById('fit-ex-new')?.focus();
  }
});

/* ================= Beispieldaten ================= */

function loadFitnessDemo() {
  const f = fit();
  const today = todayKey();
  f.enabled = true;
  f.demo = true;
  f.profile ||= { sex: 'm', age: 29, height: 181, weight: 82, goal: 'lose', activity: 1.55, targetWeight: 77, demo: true };
  f.plans = f.plans.filter((p) => !p.demo);
  PLAN_TEMPLATES.ppl.plans.forEach(([name, days, ex], i) => f.plans.push({ id: `demo-${name}`, demo: true, name, color: COLORS[i + 1], days, exercises: ex.map(([n, sets, reps], j) => ({ name: n, sets, reps, kg: j < 2 ? [60, 40, 80][i] : null })) }));
  for (let i = 60; i >= 0; i -= 2) f.weights[addDays(today, -i)] ??= r1(82 - (60 - i) * 0.05 + Math.sin(i) * 0.3);
  f.demoWeights = true;
  for (let i = 27; i >= 1; i--) {
    const k = addDays(today, -i);
    const p = plannedOn(k)[0];
    if (!p || i % 9 === 0) continue;
    const prog = (27 - i) / 27;
    f.workouts.push({ id: `demo-w${i}`, demo: true, planId: p.id, name: p.name, date: k, start: `${k}T17:30:00`, end: `${k}T18:${30 + (i % 20)}:00`,
      exercises: p.exercises.map((e, j) => ({ name: e.name, sets: Array.from({ length: e.sets }, () => ({ kg: Math.round(((e.kg || [20, 25, 30, 12, 15][j % 5]) + prog * 7.5) * 2) / 2, reps: 8, done: true })) })) });
  }
  const meals = [['breakfast', 'Haferflocken', 70], ['breakfast', 'Milch 1,5 %', 200], ['breakfast', 'Banane', 120], ['lunch', 'Hähnchenbrust', 180], ['lunch', 'Reis, gekocht', 220], ['lunch', 'Brokkoli', 150],
    ['dinner', 'Vollkornbrot', 100], ['dinner', 'Gouda', 40], ['dinner', 'Tomate', 150], ['snack', 'Skyr', 250], ['snack', 'Apfel', 150]];
  for (let i = 6; i >= 0; i--) {
    const k = addDays(today, -i);
    if (f.food[k]?.length) continue;
    f.food[k] = meals.filter((_, j) => i > 0 || j < 6).map(([meal, name, amount], j) => {
      const it = FOOD_DB.find((x) => x.name === name);
      const a = Math.round(amount * (0.8 + ((i + j) % 4) * 0.12));
      const c = foodCalc(it, a);
      return { id: `demo-f${i}-${j}`, demo: true, meal, name, amount: a, unit: it.unit, kcal: Math.round(c.kcal * 10) / 10, p: c.p, c: c.c, f: c.f, base: { ...it } };
    });
    f.water[k] ??= i ? 1750 + (i % 3) * 250 : 1000;
  }
  f.demoExtra = true;
  for (let i = 25; i >= 0; i--) {
    const k = addDays(today, -i);
    f.steps[k] ??= 5200 + ((i * 2797) % 7300);
    f.sleep[k] ??= { h: 6.25 + ((i * 7) % 9) * 0.25, q: 2 + (i % 4) };
    if (i % 4 === 1) f.cardio.push({ id: `demo-c${i}`, demo: true, date: k, type: i % 8 === 1 ? 'bike' : 'run', min: 25 + (i % 3) * 10, km: i % 8 === 1 ? 14 : r1(4.5 + (i % 3)), kcal: i % 8 === 1 ? 380 : 420 + (i % 3) * 60, at: `${k}T07:30:00` });
  }
  for (let i = 56; i >= 0; i -= 14) f.measures[addDays(today, -i)] ??= { waist: r1(92 - (56 - i) * 0.06), chest: 104, arm: r1(36 + (56 - i) * 0.01), thigh: 59, fat: r1(21 - (56 - i) * 0.04) };
  if (!f.supps.length) {
    f.supps = [{ id: 'demo-s1', name: 'Kreatin 5 g' }, { id: 'demo-s2', name: 'Vitamin D' }, { id: 'demo-s3', name: 'Magnesium' }];
    f.suppLog[today] = ['demo-s1'];
  }
  if (!f.mealTpls.length) f.mealTpls = [{ id: 'demo-t1', name: 'Mein Frühstück', meal: 'breakfast', items: f.food[addDays(today, -1)].filter((e) => e.meal === 'breakfast').map(({ id, demo, ...x }) => x) }];
  if (!f.recipes.length) {
    const items = [['Nudeln, gekocht', 1000], ['Rinderhack', 500], ['Tomate', 400], ['Olivenöl', 20]].map(([name, amount]) => { const it = FOOD_DB.find((x) => x.name === name); return { name, amount, base: { kcal: it.kcal, p: it.p, c: it.c, f: it.f, per: it.per, unit: it.unit } }; });
    const t = items.reduce((a, i) => { const c = foodCalc(i.base, i.amount); return { kcal: a.kcal + c.kcal, p: a.p + c.p, c: a.c + c.c, f: a.f + c.f }; }, { kcal: 0, p: 0, c: 0, f: 0 });
    f.recipes = [{ id: 'demo-r1', name: 'Spaghetti Bolognese (selbst gemacht)', portions: 4, items, kcal: r1(t.kcal / 4), p: r1(t.p / 4), c: r1(t.c / 4), f: r1(t.f / 4) }];
  }
  if (!f.fasting.log.length) for (let i = 6; i >= 1; i--) { const k = addDays(today, -i); f.fasting.log.push({ start: `${addDays(k, -1)}T20:00:00`, end: `${k}T${i % 3 ? '12' : '10'}:15:00`, goal: 16 }); }
  f.workouts.slice(-4).forEach((w, i) => { if (w.demo) { w.feel = [4, 5, 3, 4][i]; if (i === 1) w.note = 'Neuer Rekord, lief richtig gut'; } });
}

function clearFitnessDemo() {
  const f = state.fitness;
  if (!f?.demo) return;
  f.plans = f.plans.filter((p) => !p.demo);
  f.workouts = f.workouts.filter((w) => !w.demo);
  for (const k of Object.keys(f.food)) { f.food[k] = f.food[k].filter((e) => !e.demo); if (!f.food[k].length) { delete f.food[k]; delete f.water[k]; } }
  if (f.demoWeights) f.weights = {};
  if (f.profile?.demo) f.profile = null;
  f.cardio = f.cardio.filter((c) => !c.demo);
  if (f.demoExtra) {
    f.steps = {}; f.sleep = {}; f.measures = {}; f.fasting = { start: null, goal: 16, log: [] };
    f.supps = f.supps.filter((s) => !s.id.startsWith('demo-')); f.suppLog = {};
    f.mealTpls = f.mealTpls.filter((t) => !t.id.startsWith('demo-')); f.recipes = f.recipes.filter((r) => !r.id.startsWith('demo-'));
  }
  f.demoExtra = false;
  f.demo = false;
  f.demoWeights = false;
  if (!f.plans.length && !f.workouts.length && !Object.keys(f.food).length) f.enabled = false;
}
