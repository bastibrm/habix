'use strict';

/* Fitness, zweiter Teil: Wochenziel, Trainingskalender, Körpermaße, Cardio und Schritte, Schlaf, Erfolge mit XP,
   Satzpause, Übungsdetails, Muskelgruppen, Steigerungs-Hinweis, Mahlzeit-Vorlagen, Rezepte, Online-Suche,
   Intervallfasten und Supplements. Die drei Seiten in fitness.js holen sich ihre zusätzlichen Karten von hier. */

// MET-Werte für die Kalorienschätzung: kcal = MET × Körpergewicht × Stunden
const CARDIO = [
  { id: 'run', name: 'Laufen', icon: 'footprints', met: 9.8 },
  { id: 'bike', name: 'Radfahren', icon: 'bike', met: 7.5 },
  { id: 'walk', name: 'Spazieren', icon: 'tree-pine', met: 3.5 },
  { id: 'swim', name: 'Schwimmen', icon: 'waves', met: 7 },
  { id: 'row', name: 'Rudern', icon: 'sailboat', met: 7 },
  { id: 'cross', name: 'Crosstrainer', icon: 'activity', met: 5 },
  { id: 'hike', name: 'Wandern', icon: 'mountain', met: 6 },
  { id: 'other', name: 'Sonstiges', icon: 'heart-pulse', met: 5 },
];
const cardioType = (id) => CARDIO.find((c) => c.id === id) || CARDIO[CARDIO.length - 1];

const MEASURES = [['waist', 'Bauchumfang', 'cm'], ['chest', 'Brust', 'cm'], ['arm', 'Arm', 'cm'], ['thigh', 'Oberschenkel', 'cm'], ['hip', 'Hüfte', 'cm'], ['fat', 'Körperfett', '%']];

const MUSCLES = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Beine', 'Po', 'Waden', 'Bauch'];
const MUSCLE_OF = {
  'Bankdrücken': 'Brust', 'Schrägbankdrücken': 'Brust', 'Kurzhantel-Bankdrücken': 'Brust', 'Butterfly': 'Brust', 'Liegestütze': 'Brust', 'Dips': 'Trizeps',
  'Schulterdrücken': 'Schultern', 'Seitheben': 'Schultern', 'Face Pulls': 'Schultern', 'Trizepsdrücken am Kabel': 'Trizeps', 'French Press': 'Trizeps',
  'Klimmzüge': 'Rücken', 'Latzug': 'Rücken', 'Rudern am Kabel': 'Rücken', 'Langhantelrudern': 'Rücken', 'Kurzhantelrudern': 'Rücken', 'Kreuzheben': 'Rücken',
  'Bizepscurls': 'Bizeps', 'Hammercurls': 'Bizeps', 'Kniebeugen': 'Beine', 'Beinpresse': 'Beine', 'Rumänisches Kreuzheben': 'Beine', 'Ausfallschritte': 'Beine',
  'Beinstrecker': 'Beine', 'Beinbeuger': 'Beine', 'Wadenheben': 'Waden', 'Hip Thrusts': 'Po', 'Plank': 'Bauch', 'Crunches': 'Bauch', 'Beinheben': 'Bauch',
  'Laufen': null, 'Radfahren': null, 'Rudergerät': null,
};
// Für eigene Übungen: grob am Namen erkennen
const MUSCLE_GUESS = [[/wade/i, 'Waden'], [/hip|glute|\bpo\b/i, 'Po'], [/plank|crunch|bauch|sit-?up|core/i, 'Bauch'], [/curl|bizeps/i, 'Bizeps'], [/trizeps|dips|french|skull/i, 'Trizeps'],
  [/bank|brust|butterfly|fly|liegest|chest/i, 'Brust'], [/rudern|latzug|klimm|row|pull|rücken/i, 'Rücken'], [/schulter|seitheb|overhead|military/i, 'Schultern'],
  [/knie|bein|squat|ausfall|lunge|kreuzheb/i, 'Beine']];
function muscleOf(name) {
  const n = name.trim();
  if (n in MUSCLE_OF) return MUSCLE_OF[n];
  return MUSCLE_GUESS.find(([re]) => re.test(n))?.[1] || null;
}

const fmtH = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${pad(m % 60)} h`; };
const fmtDur = (h) => { const m = Math.max(0, Math.floor(h * 60)); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
const plural = (n, one, many) => `${fmtNum(n)} ${n === 1 ? one : many}`;

/* ================= Berechnungen ================= */

const cardioOn = (k) => fit().cardio.filter((c) => c.date === k);
const burnedOn = (k) => Math.round(cardioOn(k).reduce((a, c) => a + (c.kcal || 0), 0));
// Tagesziel plus das, was beim Sport verbrannt wurde
const goalFor = (k) => needs().kcal + burnedOn(k);

function activeSet() {
  const f = fit();
  return new Set([...f.workouts.map((w) => w.date), ...f.cardio.map((c) => c.date)]);
}
const activeDays = (from, to, set = activeSet()) => range(from, to).filter((k) => set.has(k)).length;

// Wochen am Stück mit erreichtem Wochenziel; die laufende Woche unterbricht nicht, solange sie offen ist
function weekStreaks() {
  const f = fit();
  const set = activeSet();
  const now = thisMonday();
  if (!set.size) return { cur: 0, best: 0 };
  let best = 0, run = 0;
  for (let m = mondayOf([...set].sort()[0]); m <= now; m = addDays(m, 7)) {
    const need = weekNeed(m, f.weekGoal);
    if (need === null) continue;
    if (activeDays(m, addDays(m, 6), set) >= need) { run++; best = Math.max(best, run); } else if (m !== now) run = 0;
  }
  return { cur: run, best };
}

// Längste Folge aufeinanderfolgender Tage
function maxRun(keys) {
  let best = 0, run = 0, prev = null;
  for (const k of [...keys].sort()) { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; }
  return best;
}

function exerciseHistory(name) {
  const n = name.trim().toLowerCase();
  return fit().workouts
    .filter((w) => w.exercises.some((e) => e.name.trim().toLowerCase() === n))
    .sort((a, b) => (a.end || a.date).localeCompare(b.end || b.date))
    .map((w) => {
      const sets = w.exercises.find((e) => e.name.trim().toLowerCase() === n).sets.filter((s) => s.done);
      return {
        id: w.id, date: w.date, sets,
        orm: sets.reduce((m, s) => Math.max(m, (s.kg || 0) * (1 + (s.reps || 0) / 30)), 0),
        top: sets.reduce((m, s) => Math.max(m, s.kg || 0), 0),
        vol: sets.reduce((a, s) => a + (s.kg || 0) * (s.reps || 0), 0),
        reps: sets.reduce((a, s) => a + (s.reps || 0), 0),
      };
    })
    .filter((h) => h.sets.length);
}

// Letztes Mal alle Sätze bis zum oberen Ende des Ziels geschafft: etwas mehr Gewicht vorschlagen
function progressHint(e) {
  if (e.upDone || !e.target) return null;
  const m = String(e.target).match(/^\s*(\d+)\s*(?:-|–|bis)\s*(\d+)\s*$|^\s*(\d+)\s*$/);
  const top = m && Number(m[2] || m[3]);
  const last = lastSets(e.name);
  if (!top || !last) return null;
  const lastKg = Math.max(...last.sets.map((s) => s.kg || 0));
  if (!lastKg || !last.sets.every((s) => (s.reps || 0) >= top)) return null;
  if (e.sets.some((s) => s.done || (s.kg || 0) > lastKg)) return null;
  return { from: lastKg, to: r1(lastKg + 2.5) };
}

/* ================= Erfolge und XP ================= */

const ACH = [
  { id: 'w1', icon: 'dumbbell', name: 'Erster Schritt', text: 'Erstes Training beendet', key: 'workouts', need: 1, xp: 25 },
  { id: 'w10', icon: 'dumbbell', name: 'Dranbleiber', text: '10 Trainings', key: 'workouts', need: 10, xp: 75 },
  { id: 'w50', icon: 'medal', name: 'Stammgast', text: '50 Trainings', key: 'workouts', need: 50, xp: 200 },
  { id: 'w100', icon: 'crown', name: 'Eisenfresser', text: '100 Trainings', key: 'workouts', need: 100, xp: 400 },
  { id: 't1', icon: 'weight', name: 'Erste Tonne', text: '1 Tonne insgesamt bewegt', key: 'volume', need: 1000, xp: 25, div: 1000, unit: 't' },
  { id: 't10', icon: 'weight', name: 'Schwergewicht', text: '10 Tonnen insgesamt bewegt', key: 'volume', need: 10000, xp: 100, div: 1000, unit: 't' },
  { id: 't100', icon: 'weight', name: 'Kran', text: '100 Tonnen insgesamt bewegt', key: 'volume', need: 100000, xp: 300, div: 1000, unit: 't' },
  { id: 'ex10', icon: 'list-checks', name: 'Allrounder', text: '10 verschiedene Übungen trainiert', key: 'exercises', need: 10, xp: 50 },
  { id: 'week4', icon: 'calendar-check', name: 'Wochenserie', text: '4 Wochen am Stück Wochenziel geschafft', key: 'weekBest', need: 4, xp: 100 },
  { id: 'cardio10', icon: 'heart-pulse', name: 'Ausdauernd', text: '10 Cardio-Einheiten', key: 'cardio', need: 10, xp: 50 },
  { id: 'km42', icon: 'footprints', name: 'Marathon', text: '42 km insgesamt gelaufen', key: 'runKm', need: 42, xp: 150, unit: 'km' },
  { id: 'steps', icon: 'footprints', name: 'Zehntausend', text: '10.000 Schritte an einem Tag', key: 'stepsMax', need: 10000, xp: 30 },
  { id: 'water7', icon: 'glass-water', name: 'Gut gewässert', text: '7 Tage am Stück Trinkziel erreicht', key: 'water', need: 7, xp: 50 },
  { id: 'food7', icon: 'apple', name: 'Buchhalter', text: '7 Tage am Stück Essen eingetragen', key: 'food', need: 7, xp: 50 },
  { id: 'sleep7', icon: 'moon', name: 'Ausgeschlafen', text: '7 Nächte mit mindestens 7 Stunden Schlaf', key: 'sleep', need: 7, xp: 50 },
  { id: 'fast5', icon: 'hourglass', name: 'Fastenprofi', text: '5 Fastenzeiten bis zum Ziel durchgehalten', key: 'fasts', need: 5, xp: 50 },
  { id: 'target', icon: 'target', name: 'Ziel erreicht', text: 'Wunschgewicht erreicht', key: 'target', need: 1, xp: 300 },
];
const FIT_XP = { workout: 15, cardio: 5, food: 4, water: 2 };

function fitStats() {
  const f = fit();
  const p = f.profile;
  const wv = Object.values(f.weights);
  const water = needs().water;
  let target = 0;
  if (p?.targetWeight && wv.length) {
    if (p.goal === 'lose') target = Math.min(...wv) <= p.targetWeight + 0.1 ? 1 : 0;
    else if (p.goal === 'gain') target = Math.max(...wv) >= p.targetWeight - 0.1 ? 1 : 0;
    else target = Math.abs(currentWeight() - p.targetWeight) < 0.5 ? 1 : 0;
  }
  return {
    workouts: f.workouts.length,
    volume: f.workouts.reduce((a, w) => a + volumeOf(w), 0),
    exercises: new Set(f.workouts.flatMap((w) => w.exercises.map((e) => e.name.trim().toLowerCase()))).size,
    weekBest: weekStreaks().best,
    cardio: f.cardio.length,
    runKm: f.cardio.filter((c) => c.type === 'run').reduce((a, c) => a + (c.km || 0), 0),
    stepsMax: Math.max(0, ...Object.values(f.steps)),
    water: maxRun(Object.keys(f.water).filter((k) => f.water[k] >= water)),
    food: maxRun(Object.keys(f.food).filter((k) => f.food[k].length)),
    sleep: Object.values(f.sleep).filter((s) => s.h >= 7).length,
    fasts: f.fasting.log.filter((x) => (Date.parse(x.end) - Date.parse(x.start)) / 3600000 >= x.goal).length,
    target,
  };
}

function achievements() {
  const s = fitStats();
  return ACH.map((a) => ({ ...a, have: Math.min(a.need, s[a.key] || 0), done: (s[a.key] || 0) >= a.need }));
}

const achProgress = (a) => (a.div ? `${fmtNum(r1(a.have / a.div))} / ${fmtNum(a.need / a.div)} ${a.unit}` : `${fmtNum(Math.floor(a.have))} / ${fmtNum(a.need)}${a.unit ? ` ${a.unit}` : ''}`);

// XP aus dem Fitness-Bereich, fließen ins Level ein (nur wenn der Bereich aktiv ist)
function fitnessXp() {
  const f = state.fitness;
  if (!f?.enabled) return 0;
  fit();
  let xp = f.workouts.length * FIT_XP.workout + f.cardio.length * FIT_XP.cardio;
  for (const k of Object.keys(f.food)) if (f.food[k].length >= 3) xp += FIT_XP.food;
  const wg = needs().water;
  for (const k of Object.keys(f.water)) if (f.water[k] >= wg) xp += FIT_XP.water;
  return xp + achievements().filter((a) => a.done).reduce((a, b) => a + b.xp, 0);
}

// Neue Erfolge einmal feiern, beim ersten Mal und mit Beispieldaten still übernehmen
function fitAchCheck() {
  const f = state.fitness;
  if (!f?.enabled) return;
  const done = achievements().filter((a) => a.done).map((a) => a.id);
  const seen = f.achSeen;
  const fresh = seen ? done.filter((id) => !seen.includes(id)) : [];
  if (seen && seen.length === done.length && !fresh.length) return;
  f.achSeen = done;
  save();
  if (!fresh.length || state.demo || f.demo) return;
  const a = ACH.find((x) => x.id === fresh[0]);
  toast(`Erfolg freigeschaltet: ${a.name} (+${a.xp} XP)`);
  confetti();
}

/* ================= Karten: Übersicht ================= */

function fitRing(v, label, size = 112, hue = null) {
  const r = 46, c = 2 * Math.PI * r;
  return `
  <div class="ring kcal-ring" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 112 112" aria-hidden="true">
      <circle cx="56" cy="56" r="${r}" fill="none" style="stroke:var(--track)" stroke-width="10"/>
      <circle class="prog" data-anim="ring" data-full="${c}" cx="56" cy="56" r="${r}" fill="none" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${c}" style="stroke-dashoffset:${c * (1 - Math.max(0, Math.min(1, v)))}px"${hue !== null ? ` data-hue="${hue}"` : ''}/>
    </svg>
    <div class="ring-label kcal-label">${label}</div>
  </div>`;
}

function weekGoalCard() {
  const f = fit();
  const mon = thisMonday();
  const have = activeDays(mon, addDays(mon, 6));
  const goal = f.weekGoal;
  const s = weekStreaks();
  const left = 7 - wdOf(todayKey());
  return `
  <article class="card s4 fade-in">
    <div class="card-head"><div><h2>Wochenziel</h2><div class="sub">Trainingstage pro Woche, Cardio zählt mit</div></div>
      <div class="fit-stepper"><button class="icon-btn" data-action="fit-goal" data-dir="-1" aria-label="Ziel senken">${icon('minus')}</button><b>${goal}</b><button class="icon-btn" data-action="fit-goal" data-dir="1" aria-label="Ziel erhöhen">${icon('plus')}</button></div></div>
    <div class="fit-kcal">
      ${fitRing(have / goal, `<b>${have}/${goal}</b><small>Tage</small>`)}
      <div class="plan-list">
        <div><span>Serie</span><b>${plural(s.cur, 'Woche', 'Wochen')}</b></div>
        <div><span>Beste Serie</span><b>${plural(s.best, 'Woche', 'Wochen')}</b></div>
        <div class="plan-total"><span>${have >= goal ? 'Diese Woche' : 'Noch nötig'}</span><b class="${have >= goal ? 'good' : ''}">${have >= goal ? 'Geschafft' : `${goal - have} in ${plural(left, 'Tag', 'Tagen')}`}</b></div>
      </div>
    </div>
  </article>`;
}

function cardioRow(c) {
  const t = cardioType(c.type);
  const pace = c.km && c.min && ['run', 'walk', 'hike'].includes(c.type) ? ` · ${fmtDur(c.min / c.km / 60)} min/km` : '';
  return `
  <div class="fit-hist-row">
    <span class="fit-cardio-ico">${icon(t.icon)}</span>
    <span class="fit-hist-main"><b>${t.name}</b><small>${esc(fmtShort(c.date))} · ${c.min} min${c.km ? ` · ${fmtNum(c.km)} km` : ''}${pace}</small></span>
    <span class="fit-hist-vol">${fmtNum(Math.round(c.kcal))} kcal</span>
    <button class="icon-btn fit-hist-del" data-action="fit-cardio-del" data-id="${c.id}" title="Entfernen">${icon('x')}</button>
  </div>`;
}

function cardioCard(cls = '') {
  const f = fit();
  const today = todayKey();
  const steps = f.steps[today] || 0;
  const burned = burnedOn(today);
  const recent = [...f.cardio].sort((a, b) => b.date.localeCompare(a.date) || (b.at || '').localeCompare(a.at || '')).slice(0, 3);
  return `
  <article class="card s4 fade-in ${cls}">
    <div class="card-head"><div><h2>Cardio und Schritte</h2><div class="sub">${burned ? `Heute ${fmtNum(burned)} kcal verbrannt, die kommen aufs Tagesziel` : 'Verbrannte Kalorien kommen aufs Tagesziel drauf'}</div></div>
      <button class="icon-btn" data-action="fit-cardio-add" title="Cardio eintragen">${icon('plus')}</button></div>
    <form class="fit-steps" data-fit-steps-form>
      <span class="fit-cardio-ico">${icon('footprints')}</span>
      <div class="fit-steps-main">
        <div class="macro-top"><span>Schritte heute</span><b>${fmtNum(steps)} <small>/ ${fmtNum(f.stepGoal)}</small></b></div>
        <div class="meter"><span data-anim="w" style="width:${Math.min(100, (steps / f.stepGoal) * 100)}%"></span></div>
      </div>
      <input class="input small-input" id="fit-steps-in" inputmode="numeric" placeholder="${steps ? fmtNum(steps) : 'z. B. 6500'}" aria-label="Schritte heute">
    </form>
    ${recent.length ? `<div class="fit-hist">${recent.map(cardioRow).join('')}</div>` : '<div class="muted fit-small">Laufen, Radfahren oder Spazieren eintragen. Die Dauer reicht, die Kalorien rechnet Habix aus deinem Gewicht.</div>'}
  </article>`;
}

function sleepCard(cls = '') {
  const f = fit();
  const today = todayKey();
  const days = range(addDays(today, -6), today);
  const last = f.sleep[today];
  const logged = days.map((k) => f.sleep[k]).filter(Boolean);
  const avg = logged.length ? logged.reduce((a, s) => a + s.h, 0) / logged.length : null;
  return `
  <article class="card s4 fade-in ${cls}">
    <div class="card-head"><div><h2>Schlaf</h2><div class="sub">${avg ? `Im Schnitt ${fmtH(avg)} in den letzten 7 Nächten` : 'Empfohlen sind 7 bis 9 Stunden'}</div></div>
      <button class="icon-btn" data-action="fit-sleep" title="Schlaf eintragen">${icon('plus')}</button></div>
    <div class="fit-sleep">
      <button class="fit-sleep-now" data-action="fit-sleep">
        <span class="fit-cardio-ico">${icon('moon')}</span>
        <div><b>${last ? fmtH(last.h) : '–'}</b><small>${last ? `Letzte Nacht${last.q ? ` · ${MOODS[last.q - 1].label}` : ''}` : 'Letzte Nacht noch nicht eingetragen'}</small></div>
      </button>
      <div class="fit-sleep-bars">${days.map((k) => {
        const s = f.sleep[k];
        return `<div class="fit-sleep-col" title="${esc(fmtLong(k))}${s ? `: ${fmtH(s.h)}` : ''}"><div class="fit-sleep-bar"><span class="${s?.q ? `mood-${s.q}` : ''}" style="height:${s ? Math.min(100, (s.h / 10) * 100) : 0}%"></span><i></i></div><small>${WD[wdOf(k)]}</small></div>`;
      }).join('')}</div>
    </div>
  </article>`;
}

function spark(vals) {
  if (vals.length < 2) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * 100).toFixed(1)},${(22 - ((v - lo) / span) * 20).toFixed(1)}`).join(' ');
  return `<svg class="fit-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" vector-effect="non-scaling-stroke"/></svg>`;
}

function measuresCard() {
  const f = fit();
  const keys = Object.keys(f.measures).sort();
  return `
  <article class="card s6 fade-in">
    <div class="card-head"><div><h2>Körpermaße</h2><div class="sub">${keys.length ? `Zuletzt gemessen am ${esc(fmtShort(keys[keys.length - 1]))}${keys.length > 1 ? `, Veränderung seit ${esc(fmtShort(keys[0]))}` : ''}` : 'Mit dem Maßband messen, einmal im Monat reicht'}</div></div>
      <button class="icon-btn" data-action="fit-measure" title="Maße eintragen">${icon('ruler')}</button></div>
    <div class="fit-measures">${MEASURES.map(([id, name, unit]) => {
      const ks = keys.filter((k) => f.measures[k][id] != null);
      if (!ks.length) return `<button class="fit-measure empty" data-action="fit-measure"><small>${name}</small><b>–</b><span class="fit-delta">noch offen</span></button>`;
      const cur = f.measures[ks[ks.length - 1]][id], d = r1(cur - f.measures[ks[0]][id]);
      return `<div class="fit-measure"><small>${name}</small><b>${fmtNum(cur)} <em>${unit}</em></b><span class="fit-delta">${ks.length < 2 ? 'erster Wert' : d ? `${d > 0 ? '+' : '−'}${fmtNum(Math.abs(d))} ${unit}` : 'gleich'}</span>${spark(ks.map((k) => f.measures[k][id]))}</div>`;
    }).join('')}</div>
  </article>`;
}

function achCard() {
  const list = achievements();
  const got = list.filter((a) => a.done);
  const next = list.filter((a) => !a.done).sort((a, b) => b.have / b.need - a.have / a.need).slice(0, 3);
  return `
  <article class="card s6 fade-in">
    <div class="card-head"><div><h2>Erfolge</h2><div class="sub">${got.length} von ${list.length} freigeschaltet · ${fmtNum(got.reduce((a, b) => a + b.xp, 0))} XP</div></div>
      <button class="icon-btn" data-action="fit-ach-all" title="Alle Erfolge" style="color:var(--sun)">${icon('award')}</button></div>
    <div class="fit-badges">${list.map((a) => `<button class="fit-badge ${a.done ? 'on' : ''}" data-action="fit-ach-all" title="${esc(a.name)}: ${esc(a.text)}">${icon(a.done ? a.icon : 'lock')}</button>`).join('')}</div>
    ${next.length ? `<div class="fit-next">${next.map((a) => `
      <div class="fit-next-row"><span class="fit-cardio-ico">${icon(a.icon)}</span>
        <div><div class="macro-top"><span><b>${a.name}</b>${a.text}</span><b>${achProgress(a)}</b></div><div class="meter"><span data-anim="w" style="width:${(a.have / a.need) * 100}%"></span></div></div></div>`).join('')}</div>`
      : '<div class="muted fit-small">Alles freigeschaltet. Respekt!</div>'}
  </article>`;
}

function openAchievements() {
  const list = achievements();
  openPanel(`
    <div class="card-head"><div><div class="eyebrow">Fitness</div><h2 class="panel-title" style="font-size:20px">Erfolge</h2></div>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    <div class="fit-ach-list">${list.map((a) => `
      <div class="fit-ach ${a.done ? 'on' : ''}">
        <span class="fit-badge ${a.done ? 'on' : ''}">${icon(a.done ? a.icon : 'lock')}</span>
        <div><div class="macro-top"><span><b>${a.name}</b>${a.text}</span><b>+${a.xp} XP</b></div>
          ${a.done ? '<small class="good">Geschafft</small>' : `<div class="meter"><span data-anim="w" style="width:${(a.have / a.need) * 100}%"></span></div><small>${achProgress(a)}</small>`}</div>
      </div>`).join('')}</div>
    <div class="setting-note">${icon('info')}<span>Erfolge und Fitness geben XP für dein Level: Training +${FIT_XP.workout}, Cardio +${FIT_XP.cardio}, Tag mit mindestens 3 Einträgen beim Essen +${FIT_XP.food}, Trinkziel erreicht +${FIT_XP.water}.</span></div>`, 'wide');
}

function yearCard() {
  const f = fit();
  const today = todayKey();
  const start = addDays(today, -(wdOf(today) + 52 * 7));
  const end = addDays(today, 6 - wdOf(today));
  const byW = {}, byC = {};
  for (const w of f.workouts) (byW[w.date] ||= []).push(w.name);
  for (const c of f.cardio) (byC[c.date] ||= []).push(cardioType(c.type).name);
  let count = 0;
  const cells = range(start, end).map((k) => {
    if (k > today) return '<span class="fy-cell future"></span>';
    const w = byW[k] || [], c = byC[k] || [];
    const lv = Math.min(3, w.length * 2 + c.length);
    if (lv) count++;
    const what = [...w, ...c].join(', ');
    return `<span class="fy-cell l${lv} ${k === today ? 'today' : ''}" title="${esc(fmtLong(k))}${what ? `: ${esc(what)}` : ''}"></span>`;
  }).join('');
  const months = Array.from({ length: 53 }, (_, i) => {
    const d = parseKey(addDays(start, i * 7));
    return `<span>${d.getDate() <= 7 ? new Intl.DateTimeFormat(LOCALE(), { month: 'short' }).format(d) : ''}</span>`;
  }).join('');
  return `
  <article class="card s12 fade-in">
    <div class="card-head"><div><h2>Trainingskalender</h2><div class="sub">${count ? `${plural(count, 'aktiver Tag', 'aktive Tage')} in den letzten 12 Monaten · längste Serie ${plural(maxRun(activeSet()), 'Tag', 'Tage')}` : 'Jeder Tag mit Training oder Cardio färbt hier ein Kästchen'}</div></div>
      <div class="heat-scale">weniger<span class="fy-cell"></span><span class="fy-cell l1"></span><span class="fy-cell l2"></span><span class="fy-cell l3"></span>mehr</div></div>
    <div class="fy">
      <div class="fy-days"><span></span>${WD.map((d, i) => `<span>${i % 2 === 0 ? d : ''}</span>`).join('')}</div>
      <div class="fy-main"><div class="fy-months">${months}</div><div class="fy-grid">${cells}</div></div>
    </div>
  </article>`;
}

/* ================= Karten: Training ================= */

function muscleCard(mon) {
  const sets = Object.fromEntries(MUSCLES.map((m) => [m, 0]));
  for (const w of workoutsIn(mon, addDays(mon, 6))) for (const e of w.exercises) {
    const m = muscleOf(e.name);
    if (m) sets[m] += e.sets.filter((s) => s.done).length;
  }
  const max = Math.max(24, ...Object.values(sets));
  const total = Object.values(sets).reduce((a, b) => a + b, 0);
  return `
  <article class="card s6 fade-in">
    <div class="card-head"><div><h2>Muskelgruppen</h2><div class="sub">${total ? `Sätze ${ui.fitWeek ? 'in dieser Woche' : 'diese Woche'}, der helle Bereich zeigt die empfohlenen 10 bis 20` : `${ui.fitWeek ? 'In dieser Woche' : 'Diese Woche'} noch keine Sätze. Empfohlen sind 10 bis 20 pro Muskel und Woche.`}</div></div></div>
    <div class="fit-muscles">${MUSCLES.map((m) => {
      const v = sets[m];
      const st = v === 0 ? '' : v < 10 ? 'low' : v <= 20 ? 'ok' : 'high';
      return `
      <div class="fit-muscle ${st}"><span>${m}</span>
        <div class="fit-muscle-track"><i style="left:${(10 / max) * 100}%;width:${(10 / max) * 100}%"></i><span data-anim="w" style="width:${(v / max) * 100}%" data-hue="${st === 'low' ? 35 : st === 'high' ? 210 : 140}"></span></div>
        <b>${v}</b></div>`;
    }).join('')}</div>
  </article>`;
}

function exerciseListCard() {
  const map = {};
  for (const w of fit().workouts) for (const e of w.exercises) {
    const done = e.sets.filter((s) => s.done);
    if (!done.length) continue;
    const k = e.name.trim();
    const it = (map[k.toLowerCase()] ||= { name: k, n: 0, last: '', orm: 0 });
    it.n++;
    if (w.date > it.last) it.last = w.date;
    for (const s of done) it.orm = Math.max(it.orm, (s.kg || 0) * (1 + (s.reps || 0) / 30));
  }
  const all = Object.values(map).sort((a, b) => b.last.localeCompare(a.last) || b.n - a.n);
  const list = all.slice(0, ui.fitExLimit || 6);
  return `
  <article class="card s6 fade-in">
    <div class="card-head"><div><h2>Deine Übungen</h2><div class="sub">${all.length ? `${all.length} Übungen trainiert, klick für den Verlauf` : 'Noch keine Übung trainiert'}</div></div></div>
    ${list.length ? `<div class="fit-hist">${list.map((x) => `
      <button class="fit-hist-row fit-ex-link" data-action="fit-ex-open" data-name="${esc(x.name)}">
        <span class="fit-cardio-ico">${icon('dumbbell')}</span>
        <span class="fit-hist-main"><b>${esc(x.name)}</b><small>${muscleOf(x.name) || 'Sonstiges'} · ${plural(x.n, 'Training', 'Trainings')} · zuletzt ${esc(fmtShort(x.last))}</small></span>
        <span class="fit-hist-vol">${x.orm ? `≈ ${kg(Math.round(x.orm))} max` : ''}</span>${icon('chevron-right')}
      </button>`).join('')}</div>` : '<div class="muted fit-small">Nach dem ersten Training siehst du hier jede Übung mit ihrem Verlauf.</div>'}
    ${all.length > list.length ? '<button class="btn small ghost" data-action="fit-ex-more" style="align-self:flex-start">Weitere anzeigen</button>' : ''}
  </article>`;
}

function lineSvg(vals, { W = 640, H = 170, fmt = (v) => fmtNum(Math.round(v)) } = {}) {
  const pad = 10;
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const xy = vals.map((v, i) => ({ x: pad + (i / Math.max(1, vals.length - 1)) * (W - pad * 2), y: pad + (1 - (v - lo) / span) * (H - pad * 2) }));
  const line = smoothPath(xy, pad, H - pad);
  const id = `ex${++chartSeq}`;
  return `
  <div class="fit-chart">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--violet);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--violet);stop-opacity:0"/></linearGradient></defs>
      <path d="${line} L${xy[xy.length - 1].x},${H} L${xy[0].x},${H} Z" fill="url(#${id})"/>
      <path d="${line}" fill="none" class="fit-line" vector-effect="non-scaling-stroke"/>
    </svg>
    <div class="fit-chart-axis"><span>Tiefster Wert ${fmt(lo)}</span><span>Höchster Wert ${fmt(hi)}</span></div>
  </div>`;
}

function openExercise(name) {
  const h = exerciseHistory(name);
  const useKg = h.some((x) => x.orm > 0);
  const best = h.reduce((m, x) => Math.max(m, x.orm), 0);
  const top = h.reduce((m, x) => Math.max(m, x.top), 0);
  const vol = h.reduce((a, x) => a + x.vol, 0);
  openPanel(`
    <div class="card-head"><div><div class="eyebrow">${muscleOf(name) || 'Übung'}</div><h2 class="panel-title" style="font-size:20px">${esc(name)}</h2></div>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    <div class="fit-ex-stats">
      <div><small>Trainings</small><b>${h.length}</b></div>
      <div><small>Schwerstes Gewicht</small><b>${top ? kg(top) : '–'}</b></div>
      <div><small>Geschätztes Maximum</small><b>${best ? kg(Math.round(best)) : '–'}</b></div>
      <div><small>Bewegt insgesamt</small><b>${vol ? `${fmtNum(Math.round(vol))} kg` : '–'}</b></div>
    </div>
    ${h.length >= 2 ? `<div class="label-sm">${useKg ? 'Geschätztes Maximum für 1 Wiederholung' : 'Wiederholungen pro Training'}</div>${lineSvg(h.map((x) => (useKg ? x.orm : x.reps)), { fmt: (v) => (useKg ? kg(Math.round(v)) : fmtNum(Math.round(v))) })}`
      : `<div class="muted fit-empty-chart">${h.length ? 'Nach dem nächsten Training mit dieser Übung siehst du hier deine Kurve.' : 'Diese Übung hast du noch nicht trainiert.'}</div>`}
    ${h.length ? `<div class="label-sm">Letzte Trainings</div><div class="fit-hist">${h.slice(-8).reverse().map((x) => `
      <div class="fit-hist-row"><span class="fit-hist-main"><b>${esc(fmtShort(x.date))}</b><small>${x.sets.map((s) => `${fmtNum(s.kg || 0)} × ${s.reps || 0}`).join(' · ')}</small></span><span class="fit-hist-vol">${x.orm ? `≈ ${kg(Math.round(x.orm))}` : `${x.reps} Wdh.`}</span></div>`).join('')}</div>` : ''}`, 'wide');
}

/* ================= Satzpause ================= */

let restTick = null;
function startRest() {
  const s = fit().restSec;
  if (!s) return;
  ui.rest = { end: Date.now() + s * 1000, total: s * 1000 };
  clearInterval(restTick);
  restTick = setInterval(drawRest, 250);
  drawRest();
}

function stopRest() {
  ui.rest = null;
  drawRest();
}

function drawRest() {
  let el = document.getElementById('fit-rest');
  const r = ui.rest;
  if (!r) { el?.remove(); clearInterval(restTick); return; }
  const left = r.end - Date.now();
  if (left <= 0) {
    ui.rest = null;
    el?.remove();
    clearInterval(restTick);
    restBeep();
    toast('Pause vorbei. Auf zum nächsten Satz!');
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'fit-rest';
    el.className = 'fit-rest';
    el.innerHTML = `
      <span class="fit-rest-ring"></span>
      <div class="fit-rest-text"><small>Satzpause</small><b class="fit-rest-time"></b></div>
      <button class="btn small ghost" data-action="fit-rest-add" data-s="-15">−15 s</button>
      <button class="btn small ghost" data-action="fit-rest-add" data-s="15">+15 s</button>
      <button class="btn small primary" data-action="fit-rest-skip">${icon('skip-forward')}Weiter</button>`;
    document.body.appendChild(el);
    lucide.createIcons();
    if (typeof translateTree === 'function') translateTree(el);
  }
  const sec = Math.ceil(left / 1000);
  el.querySelector('.fit-rest-time').textContent = `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
  el.style.setProperty('--v', `${((1 - left / r.total) * 360).toFixed(1)}deg`);
}

function restBeep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => ctx.close(), 900);
  } catch { /* ohne Ton */ }
}

/* ================= Karten: Ernährung ================= */

function fastCard() {
  const f = fit();
  const fa = f.fasting;
  const on = !!fa.start;
  const h = on ? (Date.now() - Date.parse(fa.start)) / 3600000 : 0;
  const reached = fa.log.filter((x) => (Date.parse(x.end) - Date.parse(x.start)) / 3600000 >= x.goal);
  const last = fa.log[fa.log.length - 1];
  return `
  <article class="card s6 fade-in">
    <div class="card-head"><div><h2>Intervallfasten</h2><div class="sub">${on ? `Seit ${esc(fmtShort(keyOf(new Date(fa.start))))}, ${timeOf(fa.start)} Uhr · Ziel ${fa.goal} Stunden` : `${fa.goal}:${24 - fa.goal}, also ${fa.goal} Stunden fasten und ${24 - fa.goal} Stunden essen`}</div></div>
      <div class="icon-btn" style="color:var(--violet)">${icon('hourglass')}</div></div>
    <div class="fit-kcal">
      ${fitRing(on ? h / fa.goal : 0, `<b id="fit-fast-time">${fmtDur(h)}</b><small id="fit-fast-left">${on ? (h >= fa.goal ? 'Ziel erreicht' : `noch ${fmtDur(fa.goal - h)} h`) : 'nicht aktiv'}</small>`, 112, on && h >= fa.goal ? 140 : null)}
      <div class="fit-fast-side">
        <div class="seg-row fit-fast-goals">${[12, 14, 16, 18, 20].map((g) => `<button class="${fa.goal === g ? 'on' : ''}" data-action="fit-fast-goal" data-goal="${g}">${g}:${24 - g}</button>`).join('')}</div>
        <button class="btn ${on ? '' : 'primary'}" data-action="fit-fast-toggle">${icon(on ? 'square' : 'play')}${on ? 'Fasten beenden' : 'Fasten starten'}</button>
        <div class="sub">${reached.length ? `${plural(reached.length, 'Mal', 'Mal')} bis zum Ziel durchgehalten` : 'Noch keine Fastenzeit beendet'}${last ? ` · zuletzt ${fmtDur((Date.parse(last.end) - Date.parse(last.start)) / 3600000)} h` : ''}</div>
      </div>
    </div>
  </article>`;
}

setInterval(() => {
  const el = document.getElementById('fit-fast-time');
  const fa = state.fitness?.fasting;
  if (!el || !fa?.start) return;
  const h = (Date.now() - Date.parse(fa.start)) / 3600000;
  el.textContent = fmtDur(h);
  const l = document.getElementById('fit-fast-left');
  if (l) l.textContent = h >= fa.goal ? 'Ziel erreicht' : `noch ${fmtDur(fa.goal - h)} h`;
  if (typeof translateTree === 'function' && l) translateTree(l.parentElement);
}, 30000);

function suppCard() {
  const f = fit();
  const day = ui.fitDay || todayKey();
  const log = f.suppLog[day] || [];
  const taken = f.supps.filter((s) => log.includes(s.id)).length;
  const edit = ui.fitSuppEdit || !f.supps.length;
  return `
  <article class="card s6 fade-in">
    <div class="card-head"><div><h2>Supplements</h2><div class="sub">${f.supps.length ? `${taken} von ${f.supps.length} genommen${taken === f.supps.length ? ', alles erledigt' : ''}` : 'Kreatin, Vitamin D, Magnesium und Co. täglich abhaken'}</div></div>
      ${f.supps.length ? `<button class="icon-btn" data-action="fit-supp-edit" title="${ui.fitSuppEdit ? 'Fertig' : 'Bearbeiten'}">${icon(ui.fitSuppEdit ? 'check' : 'pencil')}</button>` : ''}</div>
    ${f.supps.length ? `<div class="fit-supps">${f.supps.map((s) => `
      <button class="fit-supp ${log.includes(s.id) ? 'on' : ''}" data-action="${ui.fitSuppEdit ? 'fit-supp-del' : 'fit-supp'}" data-id="${s.id}" aria-pressed="${log.includes(s.id)}">
        ${icon(ui.fitSuppEdit ? 'x' : log.includes(s.id) ? 'check' : 'pill')}<span>${esc(s.name)}</span></button>`).join('')}</div>` : ''}
    ${f.supps.length ? `<div class="fit-supp-week">${range(addDays(day, -6), day).map((k) => {
      const n = f.supps.filter((s) => (f.suppLog[k] || []).includes(s.id)).length;
      return `<div class="fit-supp-day ${n >= f.supps.length ? 'all' : n ? 'some' : ''}" title="${esc(fmtLong(k))}: ${n} von ${f.supps.length}"><span>${n >= f.supps.length ? icon('check') : n || ''}</span><small>${WD[wdOf(k)]}</small></div>`;
    }).join('')}</div>` : ''}
    ${edit ? `<form class="fit-inline" data-fit-supp-form><input class="input" id="fit-supp-in" placeholder="z. B. Kreatin 5 g" maxlength="40"><button class="btn small" type="submit">${icon('plus')}Hinzufügen</button></form>` : ''}
  </article>`;
}

function tplCard() {
  const f = fit();
  return `
  <article class="card s6 fade-in">
    <div class="card-head"><div><h2>Mahlzeit-Vorlagen</h2><div class="sub">Einmal speichern, dann mit einem Klick eintragen</div></div><div class="icon-btn">${icon('bookmark')}</div></div>
    ${f.mealTpls.length ? `<div class="fit-food-list">${f.mealTpls.map((t) => `
      <div class="fit-food-row">
        <span class="fit-food-main"><b>${esc(t.name)}</b><small>${MEALS.find((m) => m.id === t.meal)?.name || ''} · ${t.items.map((i) => esc(i.name)).join(', ')}</small></span>
        <span class="fit-food-kcal">${fmtNum(Math.round(kcalOf(t.items)))} kcal</span>
        <button class="icon-btn fit-hist-del" data-action="fit-tpl-del" data-id="${t.id}" title="Vorlage löschen">${icon('x')}</button>
        <button class="btn small" title="Eintragen" data-action="fit-tpl-use" data-id="${t.id}">${icon('plus')}<span>Eintragen</span></button>
      </div>`).join('')}</div>` : `<div class="muted fit-small">Noch keine Vorlage. Trag eine Mahlzeit ein und klick dort auf das Lesezeichen, zum Beispiel für dein Standard-Frühstück.</div>`}
  </article>`;
}

const recipeFood = (r) => ({ name: r.name, kcal: r.kcal, p: r.p, c: r.c, f: r.f, per: 1, unit: 'Portion' });

function recipeCard() {
  const f = fit();
  return `
  <article class="card s6 fade-in">
    <div class="card-head"><div><h2>Rezepte</h2><div class="sub">Aus mehreren Zutaten, Nährwerte pro Portion</div></div>
      <button class="icon-btn" data-action="fit-rc-new" title="Neues Rezept">${icon('plus')}</button></div>
    ${f.recipes.length ? `<div class="fit-food-list">${f.recipes.map((r) => `
      <div class="fit-food-row">
        <span class="fit-food-main"><b>${esc(r.name)}</b><small>${plural(r.portions, 'Portion', 'Portionen')} · E ${fmtNum(r1(r.p))} · K ${fmtNum(r1(r.c))} · F ${fmtNum(r1(r.f))} pro Portion</small></span>
        <span class="fit-food-kcal">${fmtNum(Math.round(r.kcal))} kcal</span>
        <button class="icon-btn" data-action="fit-rc-edit" data-id="${r.id}" title="Bearbeiten">${icon('pencil')}</button>
        <button class="btn small" title="Eintragen" data-action="fit-rc-use" data-id="${r.id}">${icon('plus')}<span>Eintragen</span></button>
      </div>`).join('')}</div>` : `<button class="fit-template" data-action="fit-rc-new"><span class="fin-cat-ico" style="--c:var(--sun)">${icon('chef-hat')}</span><span><b>Erstes Rezept anlegen</b><small>Zum Beispiel Bolognese für 4 Portionen. Habix rechnet die Nährwerte pro Portion aus.</small></span></button>`}
  </article>`;
}

/* ================= Dialoge ================= */

function openCardio() {
  ui.cardioEdit = { type: 'run', min: '', km: '', kcal: '', day: todayKey(), error: '' };
  renderCardio(true);
}

const cardioKcal = (e) => Math.round(cardioType(e.type).met * (currentWeight() || 75) * ((parseNum(String(e.min)) || 0) / 60));
const cardioHint = (e) => (parseNum(String(e.min)) > 0 ? `Geschätzt ${fmtNum(cardioKcal(e))} kcal bei ${kg(currentWeight() || 75)} Körpergewicht. Von deiner Uhr kannst du den Wert auch selbst eintragen.` : 'Gib die Dauer ein, dann rechnet Habix die Kalorien aus.');

function renderCardio(first = false) {
  const e = ui.cardioEdit;
  const html = `
    <div class="card-head"><h2 class="panel-title" style="font-size:20px">Cardio eintragen</h2>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    <div class="seg-row">${CARDIO.map((c) => `<button class="${e.type === c.id ? 'on' : ''}" data-action="fit-ca-type" data-type="${c.id}">${icon(c.icon)}${c.name}</button>`).join('')}</div>
    <div class="ce-row">
      <div class="field"><label for="ca-min">Dauer in Minuten</label><input class="input" id="ca-min" data-ca-field="min" inputmode="numeric" value="${esc(e.min)}" placeholder="z. B. 30"></div>
      <div class="field"><label for="ca-km">Strecke in km (optional)</label><input class="input" id="ca-km" data-ca-field="km" inputmode="decimal" value="${esc(e.km)}" placeholder="z. B. 5,2"></div>
    </div>
    <div class="ce-row">
      <div class="field"><label for="ca-day">Tag</label><input class="input" type="date" id="ca-day" data-ca-field="day" value="${e.day}" max="${todayKey()}"></div>
      <div class="field"><label for="ca-kcal">Kalorien (optional)</label><input class="input" id="ca-kcal" data-ca-field="kcal" inputmode="numeric" value="${esc(e.kcal)}" placeholder="${cardioKcal(e) || 'automatisch'}"></div>
    </div>
    <div class="sub" id="ca-hint" style="margin:0">${cardioHint(e)}</div>
    ${e.error ? `<div class="error">${e.error}</div>` : ''}
    <div class="modal-foot"><div class="right"><button class="btn ghost" data-action="close-modal">Abbrechen</button><button class="btn primary" data-action="fit-ca-save">${icon('check')}Speichern</button></div></div>`;
  if (first) { openPanel(html); setTimeout(() => document.getElementById('ca-min')?.focus(), 60); return; }
  const m = document.querySelector('#modal .modal');
  if (m) { m.classList.remove('enter'); m.innerHTML = html; lucide.createIcons(); }
}

function saveCardio() {
  const e = ui.cardioEdit;
  const min = Math.round(parseNum(String(e.min)) || 0);
  if (!(min >= 1 && min <= 900)) { e.error = 'Gib die Dauer in Minuten ein, z. B. 30.'; renderCardio(); return; }
  const km = parseNum(String(e.km || '')) || 0;
  const own = parseNum(String(e.kcal || '')) || 0;
  const day = e.day && e.day <= todayKey() ? e.day : todayKey();
  const kcal = own > 0 ? Math.round(own) : cardioKcal(e);
  fit().cardio.push({ id: uid(), date: day, type: e.type, min, km: km > 0 ? r1(km) : null, kcal, at: new Date().toISOString() });
  ui.cardioEdit = null;
  save();
  closeModal();
  toast(`${cardioType(e.type).name} eingetragen: ${fmtNum(kcal)} kcal`);
  render('update');
}

function openSleep() {
  const s = fit().sleep[todayKey()];
  ui.sleepEdit = { h: s ? fmtNum(r1(s.h)) : '', q: s?.q || 0, day: todayKey(), error: '' };
  renderSleep(true);
}

function renderSleep(first = false) {
  const e = ui.sleepEdit;
  const html = `
    <div class="card-head"><h2 class="panel-title" style="font-size:20px">Schlaf eintragen</h2>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    <div class="ce-row">
      <div class="field"><label for="sl-h">Wie lange?</label><input class="input" id="sl-h" data-sl-field="h" value="${esc(e.h)}" placeholder="z. B. 7,5 oder 7:30"></div>
      <div class="field"><label for="sl-day">Nacht auf</label><input class="input" type="date" id="sl-day" data-sl-field="day" value="${e.day}" max="${todayKey()}"></div>
    </div>
    <div class="field"><div class="label">Wie hast du geschlafen?</div>
      <div class="moods">${MOODS.map((m) => `<button class="mood mood-${m.v} ${e.q === m.v ? 'on' : ''}" data-action="fit-sl-q" data-q="${m.v}" aria-pressed="${e.q === m.v}">${icon(m.icon)}<span>${m.label}</span></button>`).join('')}</div></div>
    ${e.error ? `<div class="error">${e.error}</div>` : ''}
    <div class="modal-foot"><div class="right"><button class="btn ghost" data-action="close-modal">Abbrechen</button><button class="btn primary" data-action="fit-sl-save">${icon('check')}Speichern</button></div></div>`;
  if (first) { openPanel(html, 'narrow'); setTimeout(() => document.getElementById('sl-h')?.focus(), 60); return; }
  const m = document.querySelector('#modal .modal');
  if (m) { m.classList.remove('enter'); m.innerHTML = html; lucide.createIcons(); }
}

function saveSleep() {
  const e = ui.sleepEdit;
  const t = String(e.h).trim();
  const mm = t.match(/^(\d{1,2})\s*[:h]\s*(\d{1,2})?\s*(?:min)?$/i);
  const h = mm ? Number(mm[1]) + Number(mm[2] || 0) / 60 : parseNum(t);
  if (!(h >= 1 && h <= 16)) { e.error = 'Gib die Stunden ein, z. B. 7,5 oder 7:30.'; renderSleep(); return; }
  const day = e.day && e.day <= todayKey() ? e.day : todayKey();
  fit().sleep[day] = { h: Math.round(h * 60) / 60, q: e.q || null };
  ui.sleepEdit = null;
  save();
  closeModal();
  toast(h >= 7 ? `${fmtH(h)} Schlaf eingetragen, gut erholt` : `${fmtH(h)} Schlaf eingetragen`);
  render('update');
}

function openMeasure() {
  const f = fit();
  const keys = Object.keys(f.measures).sort();
  const latest = {};
  for (const k of keys) Object.assign(latest, f.measures[k]);
  const todays = f.measures[todayKey()] || {};
  ui.measureEdit = { day: todayKey(), latest, ...Object.fromEntries(MEASURES.map(([id]) => [id, todays[id] != null ? fmtNum(todays[id]) : ''])) };
  openPanel(`
    <div class="card-head"><h2 class="panel-title" style="font-size:20px">Körpermaße eintragen</h2>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    <div class="fit-measure-form">${MEASURES.map(([id, name, unit]) => `
      <div class="field"><label for="me-${id}">${name} in ${unit}</label><input class="input" id="me-${id}" data-me-field="${id}" inputmode="decimal" value="${esc(ui.measureEdit[id])}" placeholder="${latest[id] != null ? fmtNum(latest[id]) : '–'}"></div>`).join('')}
    </div>
    <div class="field"><label for="me-day">Tag</label><input class="input" type="date" id="me-day" data-me-field="day" value="${todayKey()}" max="${todayKey()}"></div>
    <div class="sub" style="margin:0">Tipp: Bauch auf Höhe des Bauchnabels messen, Arm und Oberschenkel an der dicksten Stelle. Leere Felder bleiben unverändert.</div>
    <div class="error" id="me-error" hidden></div>
    <div class="modal-foot"><div class="right"><button class="btn ghost" data-action="close-modal">Abbrechen</button><button class="btn primary" data-action="fit-me-save">${icon('check')}Speichern</button></div></div>`);
  setTimeout(() => document.getElementById('me-waist')?.focus(), 60);
}

function saveMeasure() {
  const e = ui.measureEdit;
  const vals = {};
  for (const [id, , unit] of MEASURES) {
    const v = parseNum(String(e[id] || '').replace(/cm|%/gi, ''));
    if (!String(e[id] || '').trim()) continue;
    if (!(v > (unit === '%' ? 2 : 5) && v < (unit === '%' ? 70 : 300))) {
      const el = document.getElementById('me-error');
      if (el) { el.textContent = `Der Wert bei ${MEASURES.find((m) => m[0] === id)[1]} passt nicht.`; el.hidden = false; if (typeof translateTree === 'function') translateTree(el); }
      return;
    }
    vals[id] = r1(v);
  }
  if (!Object.keys(vals).length) {
    const el = document.getElementById('me-error');
    if (el) { el.textContent = 'Trag mindestens einen Wert ein.'; el.hidden = false; if (typeof translateTree === 'function') translateTree(el); }
    return;
  }
  const day = e.day && e.day <= todayKey() ? e.day : todayKey();
  const f = fit();
  f.measures[day] = { ...(f.measures[day] || {}), ...vals };
  ui.measureEdit = null;
  save();
  closeModal();
  toast('Körpermaße gespeichert');
  render('update');
}

const TPL_NAMES = { breakfast: 'Mein Frühstück', lunch: 'Mein Mittagessen', dinner: 'Mein Abendessen', snack: 'Meine Snacks' };

function openTplSave(meal) {
  const items = dayFood(ui.fitDay || todayKey()).filter((e) => e.meal === meal);
  if (!items.length) return;
  ui.tplEdit = { meal, items: items.map(({ id, demo, ...x }) => x) };
  openPanel(`
    <div class="card-head"><h2 class="panel-title" style="font-size:20px">Als Vorlage speichern</h2>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    <div class="field"><label for="tpl-name">Name der Vorlage</label><input class="input" id="tpl-name" maxlength="40" value="${esc(TPL_NAMES[meal])}"></div>
    <div class="fit-food-list">${ui.tplEdit.items.map((i) => `<div class="fit-food-row"><span class="fit-food-main"><b>${esc(i.name)}</b><small>${i.amount ? `${fmtNum(i.amount)} ${i.unit || 'g'}` : ''}</small></span><span class="fit-food-kcal">${fmtNum(Math.round(i.kcal))} kcal</span></div>`).join('')}</div>
    <div class="modal-foot"><div class="right"><button class="btn ghost" data-action="close-modal">Abbrechen</button><button class="btn primary" data-action="fit-tpl-save-ok">${icon('bookmark')}Speichern</button></div></div>`, 'narrow');
  setTimeout(() => { const i = document.getElementById('tpl-name'); i?.focus(); i?.select(); }, 60);
}

function saveTpl() {
  const e = ui.tplEdit;
  const name = document.getElementById('tpl-name')?.value.trim() || TPL_NAMES[e.meal];
  const f = fit();
  f.mealTpls = [...f.mealTpls.filter((t) => t.name.toLowerCase() !== name.toLowerCase()), { id: uid(), name, meal: e.meal, items: e.items }];
  ui.tplEdit = null;
  save();
  closeModal();
  toast(`Vorlage „${name}“ gespeichert`);
  render('update');
}

function addEntries(day, items, meal = null) {
  const f = fit();
  (f.food[day] ||= []).push(...items.map(({ id, demo, ...x }) => ({ ...x, meal: meal || x.meal, id: uid() })));
  save();
  render('update');
}

// Zutaten für Rezepte: eigene Lebensmittel, eingebaute Liste und zuletzt online gefundene
const recipeSources = () => [...fit().foods, ...FOOD_DB, ...(ui.foodCache || [])];
function findFood(name) {
  const n = name.trim().toLowerCase();
  return n ? recipeSources().find((x) => x.name.toLowerCase() === n) || null : null;
}

function openRecipe(r) {
  ui.recipeEdit = r
    ? { id: r.id, name: r.name, portions: String(r.portions), items: r.items.map((i) => ({ name: i.name, amount: fmtNum(i.amount), base: i.base })), error: '', confirmDelete: false }
    : { id: null, name: '', portions: '2', items: [{ name: '', amount: '' }, { name: '', amount: '' }, { name: '', amount: '' }], error: '', confirmDelete: false };
  renderRecipe(true);
}

function rcItem(i) {
  const src = findFood(i.name) || (i.base && i.name.trim() ? i.base : null);
  const a = parseNum(String(i.amount)) || 0;
  return { src, calc: src && a > 0 ? foodCalc(src, a) : null };
}

function rcTotals() {
  const e = ui.recipeEdit;
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const i of e.items) { const { calc } = rcItem(i); if (calc) for (const k in t) t[k] += calc[k]; }
  const n = Math.max(1, parseInt(e.portions, 10) || 1);
  return { total: t, per: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v / n])), n };
}

const rcTotalHtml = () => {
  const { total, per, n } = rcTotals();
  return `<span>Gesamt <b>${fmtNum(Math.round(total.kcal))}</b> kcal</span><span>Pro Portion (${n}) <b>${fmtNum(Math.round(per.kcal))}</b> kcal</span><span>E <b>${fmtNum(r1(per.p))}</b> g</span><span>K <b>${fmtNum(r1(per.c))}</b> g</span><span>F <b>${fmtNum(r1(per.f))}</b> g</span>`;
};

function rcRowInfo(i) {
  const { src, calc } = rcItem(i);
  if (!i.name.trim()) return ['', ''];
  if (!src) return ['', '<span class="error">unbekannt</span>'];
  return [src.per === 1 ? 'Portion' : src.unit, calc ? `${fmtNum(Math.round(calc.kcal))} kcal` : ''];
}

function renderRecipe(first = false) {
  const e = ui.recipeEdit;
  const html = `
    <div class="card-head"><h2 class="panel-title" style="font-size:20px">${e.id ? 'Rezept bearbeiten' : 'Neues Rezept'}</h2>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button></div>
    <div class="ce-row">
      <div class="field"><label for="rc-name">Name</label><input class="input" id="rc-name" data-rc-field="name" maxlength="50" value="${esc(e.name)}" placeholder="z. B. Bolognese"></div>
      <div class="field"><label for="rc-portions">Portionen</label><input class="input" id="rc-portions" data-rc-field="portions" inputmode="numeric" value="${esc(e.portions)}"></div>
    </div>
    <div class="field"><div class="label">Zutaten</div>
      <div class="rc-rows">
        <div class="rc-row pe-head"><span>Zutat</span><span>Menge</span><span></span><span></span><span></span></div>
        ${e.items.map((i, n) => { const [u, k] = rcRowInfo(i); return `
        <div class="rc-row">
          <input class="input" list="fit-food-names" data-rc="name" data-i="${n}" maxlength="80" value="${esc(i.name)}" placeholder="z. B. Rinderhack">
          <input class="input" data-rc="amount" data-i="${n}" inputmode="decimal" value="${esc(i.amount)}" placeholder="g">
          <span class="rc-unit" id="rc-u-${n}">${u}</span><span class="rc-kcal" id="rc-k-${n}">${k}</span>
          <button class="icon-btn" data-action="fit-rc-row-del" data-i="${n}" aria-label="Zutat entfernen">${icon('x')}</button>
        </div>`; }).join('')}
      </div>
      <button class="btn small ghost" data-action="fit-rc-row-add" style="align-self:flex-start">${icon('plus')}Zutat</button>
      <datalist id="fit-food-names">${recipeSources().map((x) => `<option value="${esc(x.name)}">`).join('')}</datalist>
    </div>
    <div class="fit-calc" id="rc-total">${rcTotalHtml()}</div>
    <div class="sub" style="margin:0">Zutaten aus der Liste wählen. Was fehlt, legst du unter „Essen eintragen“ an oder findest es dort mit der Online-Suche.</div>
    ${e.error ? `<div class="error">${e.error}</div>` : ''}
    <div class="modal-foot">
      ${e.id ? (e.confirmDelete
        ? `<div class="btn-row"><span class="error">Rezept löschen?</span><button class="btn small danger" data-action="fit-rc-delete-yes">Löschen</button><button class="btn small ghost" data-action="fit-rc-delete-no">Nein</button></div>`
        : `<button class="btn small danger" data-action="fit-rc-delete">${icon('trash-2')}Löschen</button>`) : ''}
      <div class="right"><button class="btn ghost" data-action="close-modal">Abbrechen</button><button class="btn primary" data-action="fit-rc-save">${icon('check')}Speichern</button></div>
    </div>`;
  if (first) { openPanel(html, 'wide'); return; }
  const m = document.querySelector('#modal .modal');
  if (m) { m.classList.remove('enter'); m.innerHTML = html; lucide.createIcons(); }
}

function updateRecipeLive(i) {
  const e = ui.recipeEdit;
  if (i !== undefined && e.items[i]) {
    const [u, k] = rcRowInfo(e.items[i]);
    const ue = document.getElementById(`rc-u-${i}`), ke = document.getElementById(`rc-k-${i}`);
    if (ue) ue.textContent = u;
    if (ke) ke.innerHTML = k;
  }
  const t = document.getElementById('rc-total');
  if (t) t.innerHTML = rcTotalHtml();
  if (typeof translateTree === 'function') translateTree(document.querySelector('#modal .modal'));
}

function saveRecipe() {
  const e = ui.recipeEdit;
  if (!e.name.trim()) { e.error = 'Gib dem Rezept einen Namen.'; renderRecipe(); return; }
  const filled = e.items.filter((i) => i.name.trim());
  const unknown = filled.find((i) => !rcItem(i).src);
  if (unknown) { e.error = `„${esc(unknown.name)}“ ist nicht in der Liste. Wähle eine Zutat aus den Vorschlägen.`; renderRecipe(); return; }
  const items = filled.filter((i) => parseNum(String(i.amount)) > 0).map((i) => {
    const src = rcItem(i).src;
    return { name: i.name.trim(), amount: r1(parseNum(String(i.amount))), base: { kcal: src.kcal, p: src.p, c: src.c, f: src.f, per: src.per, unit: src.unit } };
  });
  if (!items.length) { e.error = 'Füg mindestens eine Zutat mit Menge hinzu.'; renderRecipe(); return; }
  const { per, n } = rcTotals();
  const f = fit();
  const data = { name: e.name.trim(), portions: n, items, kcal: r1(per.kcal), p: r1(per.p), c: r1(per.c), f: r1(per.f) };
  if (e.id) Object.assign(f.recipes.find((r) => r.id === e.id), data);
  else f.recipes.push({ id: uid(), ...data });
  ui.recipeEdit = null;
  save();
  closeModal();
  toast(`Rezept gespeichert: ${fmtNum(Math.round(per.kcal))} kcal pro Portion`);
  render('update');
}

// Open Food Facts über den Hauptprozess, Ergebnisse als „Online“ in der Suche
async function foodOnline() {
  const e = ui.foodAdd;
  const q = e?.q.trim();
  if (!q || q.length < 2 || !window.api?.foodSearch) return;
  e.onlineState = 'loading';
  e.online = null;
  renderFoodAdd();
  try {
    const res = await window.api.foodSearch(q, state.settings?.lang);
    if (ui.foodAdd !== e) return;
    e.online = res.map((x) => ({ ...x, per: 100, unit: 'g' }));
    e.onlineState = res.length ? 'done' : 'empty';
    ui.foodCache = [...(ui.foodCache || []), ...e.online].slice(-300);
  } catch {
    if (ui.foodAdd !== e) return;
    e.onlineState = 'error';
  }
  renderFoodAdd();
}

/* ================= Aktionen ================= */

function fitMoreAction(a, el) {
  const f = fit();
  const day = ui.view === 'nutrition' ? ui.fitDay || todayKey() : todayKey();
  switch (a) {
    case 'fit-goal': f.weekGoal = Math.max(1, Math.min(7, f.weekGoal + Number(el.dataset.dir))); save(); render('update'); return true;
    case 'fit-cardio-add': openCardio(); return true;
    case 'fit-ca-type': ui.cardioEdit.type = el.dataset.type; renderCardio(); return true;
    case 'fit-ca-save': saveCardio(); return true;
    case 'fit-cardio-del': f.cardio = f.cardio.filter((c) => c.id !== el.dataset.id); save(); toast('Cardio-Eintrag entfernt'); render('update'); return true;
    case 'fit-sleep': openSleep(); return true;
    case 'fit-sl-q': ui.sleepEdit.q = ui.sleepEdit.q === Number(el.dataset.q) ? 0 : Number(el.dataset.q); renderSleep(); return true;
    case 'fit-sl-save': saveSleep(); return true;
    case 'fit-measure': openMeasure(); return true;
    case 'fit-me-save': saveMeasure(); return true;
    case 'fit-ach-all': openAchievements(); return true;
    case 'fit-ex-open': openExercise(el.dataset.name); return true;
    case 'fit-ex-more': ui.fitExLimit = (ui.fitExLimit || 6) + 10; render('update'); return true;
    case 'fit-rest-pick': f.restSec = Number(el.dataset.s); save(); if (!f.restSec) stopRest(); render('update'); return true;
    case 'fit-rest-add': if (ui.rest) { ui.rest.end += Number(el.dataset.s) * 1000; ui.rest.total = Math.max(1000, ui.rest.total + Number(el.dataset.s) * 1000); drawRest(); } return true;
    case 'fit-rest-skip': stopRest(); return true;
    case 'fit-ex-up': {
      const e = f.live?.exercises[el.dataset.ei];
      const hnt = e && progressHint(e);
      if (!hnt) return true;
      e.sets.forEach((s) => { if (!s.done) s.kg = hnt.to; });
      e.upDone = true;
      save();
      render('update');
      toast(`${e.name}: heute ${kg(hnt.to)}. Viel Erfolg!`);
      return true;
    }
    case 'fit-ex-up-no': { const e = f.live?.exercises[el.dataset.ei]; if (e) { e.upDone = true; save(); render('update'); } return true; }
    case 'fit-feel': if (f.live) { f.live.feel = f.live.feel === Number(el.dataset.v) ? null : Number(el.dataset.v); save(); render('update'); } return true;
    case 'fit-copy-day': {
      const prev = addDays(day, -1);
      addEntries(day, dayFood(prev));
      toast(`${plural(dayFood(prev).length, 'Eintrag', 'Einträge')} vom Vortag übernommen`);
      return true;
    }
    case 'fit-copy-meal': {
      const items = dayFood(addDays(day, -1)).filter((e) => e.meal === el.dataset.meal);
      addEntries(day, items);
      toast(`${MEALS.find((m) => m.id === el.dataset.meal).name} wie am Vortag eingetragen`);
      return true;
    }
    case 'fit-tpl-save': openTplSave(el.dataset.meal); return true;
    case 'fit-tpl-save-ok': saveTpl(); return true;
    case 'fit-tpl-use': {
      const t = f.mealTpls.find((x) => x.id === el.dataset.id);
      if (!t) return true;
      addEntries(day, t.items, t.meal);
      toast(`${t.name} eingetragen`);
      return true;
    }
    case 'fit-tpl-del': f.mealTpls = f.mealTpls.filter((t) => t.id !== el.dataset.id); save(); toast('Vorlage gelöscht'); render('update'); return true;
    case 'fit-rc-new': openRecipe(null); return true;
    case 'fit-rc-edit': openRecipe(f.recipes.find((r) => r.id === el.dataset.id)); return true;
    case 'fit-rc-use': {
      const r = f.recipes.find((x) => x.id === el.dataset.id);
      if (!r) return true;
      openFoodAdd(defaultMeal());
      ui.foodAdd.sel = recipeFood(r);
      ui.foodAdd.amount = '1';
      renderFoodAdd();
      document.getElementById('fa-amount')?.select();
      return true;
    }
    case 'fit-rc-row-add': ui.recipeEdit.items.push({ name: '', amount: '' }); renderRecipe(); document.querySelector(`[data-rc="name"][data-i="${ui.recipeEdit.items.length - 1}"]`)?.focus(); return true;
    case 'fit-rc-row-del': ui.recipeEdit.items.splice(Number(el.dataset.i), 1); renderRecipe(); return true;
    case 'fit-rc-save': saveRecipe(); return true;
    case 'fit-rc-delete': ui.recipeEdit.confirmDelete = true; renderRecipe(); return true;
    case 'fit-rc-delete-no': ui.recipeEdit.confirmDelete = false; renderRecipe(); return true;
    case 'fit-rc-delete-yes': f.recipes = f.recipes.filter((r) => r.id !== ui.recipeEdit.id); ui.recipeEdit = null; save(); closeModal(); toast('Rezept gelöscht'); render('update'); return true;
    case 'fit-fa-online': foodOnline(); return true;
    case 'fit-fast-goal': f.fasting.goal = Number(el.dataset.goal); save(); render('update'); return true;
    case 'fit-fast-toggle': {
      const fa = f.fasting;
      if (!fa.start) { fa.start = new Date().toISOString(); save(); toast(`Fasten gestartet. Ziel: ${fa.goal} Stunden`); render('update'); return true; }
      const h = (Date.now() - Date.parse(fa.start)) / 3600000;
      if (h >= 0.5) fa.log = [...fa.log, { start: fa.start, end: new Date().toISOString(), goal: fa.goal }].slice(-300);
      fa.start = null;
      save();
      if (h >= fa.goal) confetti();
      toast(h >= fa.goal ? `Geschafft: ${fmtDur(h)} Stunden gefastet` : h >= 0.5 ? `Fasten beendet nach ${fmtDur(h)} Stunden` : 'Fasten abgebrochen');
      render('update');
      return true;
    }
    case 'fit-supp': {
      const log = f.suppLog[day] || [];
      f.suppLog[day] = log.includes(el.dataset.id) ? log.filter((x) => x !== el.dataset.id) : [...log, el.dataset.id];
      if (!f.suppLog[day].length) delete f.suppLog[day];
      save();
      render('update');
      return true;
    }
    case 'fit-supp-edit': ui.fitSuppEdit = !ui.fitSuppEdit; render('update'); return true;
    case 'fit-supp-del': f.supps = f.supps.filter((s) => s.id !== el.dataset.id); if (!f.supps.length) ui.fitSuppEdit = false; save(); render('update'); return true;
  }
  return false;
}

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.caField && ui.cardioEdit) {
    ui.cardioEdit[t.dataset.caField] = t.value;
    const h = document.getElementById('ca-hint');
    if (h) { h.textContent = cardioHint(ui.cardioEdit); if (typeof translateTree === 'function') translateTree(h); }
    const k = document.getElementById('ca-kcal');
    if (k) k.placeholder = cardioKcal(ui.cardioEdit) || '';
  }
  if (t.dataset.slField && ui.sleepEdit) ui.sleepEdit[t.dataset.slField] = t.value;
  if (t.dataset.meField && ui.measureEdit) ui.measureEdit[t.dataset.meField] = t.value;
  if (t.dataset.rcField && ui.recipeEdit) { ui.recipeEdit[t.dataset.rcField] = t.value; updateRecipeLive(); }
  if (t.dataset.rc && ui.recipeEdit) { ui.recipeEdit.items[Number(t.dataset.i)][t.dataset.rc] = t.value; updateRecipeLive(Number(t.dataset.i)); }
  if (t.dataset.fitNote !== undefined && state.fitness?.live) { state.fitness.live.note = t.value.slice(0, 200); save(); }
});

document.addEventListener('submit', (e) => {
  const t = e.target;
  if (t.matches('[data-fit-steps-form]')) {
    e.preventDefault();
    const v = parseInt(t.querySelector('input').value.replace(/\D/g, ''), 10);
    if (!(v >= 0 && v <= 150000)) { toast('Gib deine Schritte als Zahl ein, z. B. 6500.'); return; }
    const f = fit();
    const before = f.steps[todayKey()] || 0;
    if (v) f.steps[todayKey()] = v; else delete f.steps[todayKey()];
    save();
    toast(v >= f.stepGoal && before < f.stepGoal ? 'Schrittziel erreicht!' : `${fmtNum(v)} Schritte eingetragen`);
    render('update');
  } else if (t.matches('[data-fit-supp-form]')) {
    e.preventDefault();
    const name = t.querySelector('input').value.trim();
    if (!name) return;
    fit().supps.push({ id: uid(), name: name.slice(0, 40) });
    save();
    render('update');
    document.getElementById('fit-supp-in')?.focus();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.closest?.('#modal')) return;
  const has = (id) => document.getElementById(id);
  if (has('ca-min') && ui.cardioEdit && e.target.matches('input')) { e.preventDefault(); saveCardio(); }
  else if (has('sl-h') && ui.sleepEdit && e.target.matches('input')) { e.preventDefault(); saveSleep(); }
  else if (has('me-waist') && ui.measureEdit && e.target.matches('input')) { e.preventDefault(); saveMeasure(); }
  else if (e.target.id === 'tpl-name' && ui.tplEdit) { e.preventDefault(); saveTpl(); }
});
