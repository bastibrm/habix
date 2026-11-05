'use strict';

/* Wochen-Challenges (jede Woche drei: leicht, mittel, schwer; alle drei geben einen Bonus),
   die Vitrine mit allem, was man gesammelt hat, und freischaltbare Titel und Farben für die Level-Anzeige.
   Die Auswahl der Challenges hängt nur von der Woche ab, damit vergangene Wochen fest bleiben. */

/* ================= Wochen-Challenges ================= */

const CH_TIERS = [
  { xp: 30, de: 'Leicht', en: 'Easy' },
  { xp: 50, de: 'Mittel', en: 'Medium' },
  { xp: 80, de: 'Schwer', en: 'Hard' },
];
const CH_ALL_XP = 40;

const fitOnNow = () => !!state.fitness?.enabled;
const usesMood = () => Object.values(state.journal).some((j) => j.mood);
const usesNotes = () => Object.values(state.journal).some((j) => j.note);
const usesTasks = () => state.tasks.length > 0;
const hasMorning = () => state.habits.some((h) => !h.archived && daypartOf(h) === 'morning');

// Prüfung je Tag für Challenges, die Tage zählen
const CH_DAY = {
  any: (k) => state.habits.some((h) => scheduled(h, k) && done(h, k)),
  half: (k) => { const r = dayRate(k, state.habits); return r !== null && r >= 0.5; },
  perfect: (k) => dayRate(k, state.habits) === 1,
  mood: (k) => !!state.journal[k]?.mood,
  note: (k) => !!state.journal[k]?.note,
  morning: (k) => { const hs = state.habits.filter((h) => daypartOf(h) === 'morning' && scheduled(h, k)); return hs.length > 0 && hs.every((h) => done(h, k)); },
  steps: (k) => (state.fitness.steps?.[k] || 0) >= state.fitness.stepGoal,
  water: (k) => (state.fitness.water?.[k] || 0) >= needs().water,
  food: (k) => (state.fitness.food?.[k]?.length || 0) >= 3,
  sleep: (k) => (state.fitness.sleep?.[k]?.h || 0) >= 7,
};

// g: Thema, damit nicht zweimal dasselbe in einer Woche kommt
const CH_POOL = [
  { id: 'any5', tier: 0, g: 'habits', icon: 'check', kind: 'days', day: 'any', need: 5, de: (n) => `An ${n} Tagen mindestens eine Gewohnheit schaffen`, en: (n) => `Complete at least one habit on ${n} days` },
  { id: 'half5', tier: 0, g: 'half', icon: 'gauge', kind: 'days', day: 'half', need: 5, de: (n) => `An ${n} Tagen mindestens die Hälfte schaffen`, en: (n) => `Do at least half on ${n} days` },
  { id: 'mood4', tier: 0, g: 'mood', icon: 'smile', kind: 'days', day: 'mood', need: 4, req: usesMood, de: (n) => `An ${n} Tagen die Stimmung eintragen`, en: (n) => `Log your mood on ${n} days` },
  { id: 'note3', tier: 0, g: 'note', icon: 'pen-line', kind: 'days', day: 'note', need: 3, req: usesNotes, de: (n) => `An ${n} Tagen eine Tagebuch-Notiz schreiben`, en: (n) => `Write a journal note on ${n} days` },
  { id: 'tasks4', tier: 0, g: 'tasks', icon: 'list-todo', kind: 'tasks', need: 4, req: usesTasks, de: (n) => `${n} Aufgaben erledigen`, en: (n) => `Finish ${n} tasks` },
  { id: 'steps5', tier: 0, g: 'steps', icon: 'footprints', kind: 'days', day: 'steps', need: 5, req: fitOnNow, de: (n) => `An ${n} Tagen das Schrittziel schaffen`, en: (n) => `Hit your step goal on ${n} days` },
  { id: 'water5', tier: 0, g: 'water', icon: 'glass-water', kind: 'days', day: 'water', need: 5, req: fitOnNow, de: (n) => `An ${n} Tagen das Trinkziel schaffen`, en: (n) => `Hit your water goal on ${n} days` },

  { id: 'perfect3', tier: 1, g: 'perfect', icon: 'flame', kind: 'days', day: 'perfect', need: 3, de: (n) => `${n} perfekte Tage schaffen`, en: (n) => `Have ${n} perfect days` },
  { id: 'rate80', tier: 1, g: 'rate', icon: 'target', kind: 'rate', share: 0.8, de: () => '80 % der Gewohnheiten der Woche schaffen', en: () => 'Complete 80% of this week’s habits' },
  { id: 'mood6', tier: 1, g: 'mood', icon: 'smile', kind: 'days', day: 'mood', need: 6, req: usesMood, de: (n) => `An ${n} Tagen die Stimmung eintragen`, en: (n) => `Log your mood on ${n} days` },
  { id: 'tasks8', tier: 1, g: 'tasks', icon: 'list-todo', kind: 'tasks', need: 8, req: usesTasks, de: (n) => `${n} Aufgaben erledigen`, en: (n) => `Finish ${n} tasks` },
  { id: 'morning5', tier: 1, g: 'morning', icon: 'sunrise', kind: 'days', day: 'morning', need: 5, req: hasMorning, de: (n) => `An ${n} Tagen alles vom Morgen schaffen`, en: (n) => `Finish all morning habits on ${n} days` },
  { id: 'food5', tier: 1, g: 'food', icon: 'apple', kind: 'days', day: 'food', need: 5, req: fitOnNow, de: (n) => `An ${n} Tagen dein Essen eintragen (3 Einträge)`, en: (n) => `Log your food on ${n} days (3 entries)` },
  { id: 'sleep5', tier: 1, g: 'sleep', icon: 'moon', kind: 'days', day: 'sleep', need: 5, req: fitOnNow, de: (n) => `${n} Nächte mit mindestens 7 Stunden Schlaf`, en: (n) => `${n} nights with at least 7 hours of sleep` },
  { id: 'train', tier: 1, g: 'train', icon: 'dumbbell', kind: 'train', plus: 0, req: fitOnNow, de: (n) => `Dein Wochenziel trainieren: ${n} aktive Tage`, en: (n) => `Hit your training goal: ${n} active days` },

  { id: 'perfect5', tier: 2, g: 'perfect', icon: 'flame', kind: 'days', day: 'perfect', need: 5, de: (n) => `${n} perfekte Tage schaffen`, en: (n) => `Have ${n} perfect days` },
  { id: 'rate95', tier: 2, g: 'rate', icon: 'target', kind: 'rate', share: 0.95, de: () => '95 % der Gewohnheiten der Woche schaffen', en: () => 'Complete 95% of this week’s habits' },
  { id: 'run4', tier: 2, g: 'perfect', icon: 'zap', kind: 'run', need: 4, de: (n) => `${n} perfekte Tage am Stück`, en: (n) => `${n} perfect days in a row` },
  { id: 'tasks12', tier: 2, g: 'tasks', icon: 'list-checks', kind: 'tasks', need: 12, req: usesTasks, de: (n) => `${n} Aufgaben erledigen`, en: (n) => `Finish ${n} tasks` },
  { id: 'train1', tier: 2, g: 'train', icon: 'dumbbell', kind: 'train', plus: 1, req: fitOnNow, de: (n) => `Mehr als geplant: ${n} aktive Tage`, en: (n) => `More than planned: ${n} active days` },
];

// Ab dieser Woche gibt es die drei Challenges, davor zählt die alte einzelne Wochenaufgabe
const chStart = () => (state.chStart ||= mondayOf(todayKey()));
const chHash = (n) => { let x = Math.imul(n + 0x9e37, 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; };

// Erst die festen Challenges der Woche, dann ein Tausch: der nimmt die nächste mit einem Thema, das noch fehlt
function chPick(monday) {
  const wi = weekIndex(monday);
  const lists = CH_TIERS.map((t, ti) => CH_POOL.filter((c) => c.tier === ti && (!c.req || c.req())));
  const groups = new Set();
  const idx = lists.map((list, ti) => {
    let i = chHash(wi * 3 + ti) % list.length;
    for (let n = 0; n < list.length && groups.has(list[i].g); n++) i = (i + 1) % list.length;
    groups.add(list[i].g);
    return i;
  });
  for (const ti of Object.keys(state.chSwaps?.[monday] || {}).map(Number)) {
    const list = lists[ti];
    const taken = new Set(idx.filter((_, j) => j !== ti).map((i, j) => lists[j < ti ? j : j + 1][i].g));
    for (let n = 1; n < list.length; n++) {
      const i = (idx[ti] + n) % list.length;
      if (!taken.has(list[i].g) && list[i].g !== list[idx[ti]].g) { idx[ti] = i; break; }
    }
  }
  return idx.map((i, ti) => lists[ti][i]);
}

function chProgress(c, monday) {
  const today = todayKey(), sunday = addDays(monday, 6);
  const days = range(monday, sunday < today ? sunday : today);
  const free = range(monday, sunday).filter((k) => !excused(k)).length;
  const scale = (n) => (free === 7 ? n : Math.max(1, Math.ceil((n * free) / 7)));
  let have = 0, need = 1, paused = !free;
  if (c.kind === 'days') { need = scale(c.need); have = days.filter(CH_DAY[c.day]).length; }
  if (c.kind === 'tasks') {
    need = scale(c.need);
    have = state.tasks.filter((t) => t.done && t.doneAt && keyOf(new Date(t.doneAt)) >= monday && keyOf(new Date(t.doneAt)) <= sunday).length;
  }
  if (c.kind === 'rate') {
    const p = periodRate(monday, sunday, state.habits);
    if (!p.scheduled) paused = true;
    need = Math.max(1, Math.ceil(p.scheduled * c.share)); have = p.done;
  }
  if (c.kind === 'run') {
    need = Math.min(c.need, Math.max(1, free));
    let run = 0;
    for (const k of days) { const r = dayRate(k, state.habits); if (r === 1) { run++; have = Math.max(have, run); } else if (r !== null && k !== today) run = 0; }
  }
  if (c.kind === 'train') {
    const n = weekNeed(monday, Math.min(7, state.fitness.weekGoal + c.plus));
    need = n || 1; have = activeDays(monday, sunday);
  }
  have = Math.min(have, need);
  const ok = !paused && have >= need;
  return { ...c, xp: CH_TIERS[c.tier].xp, text: dt(c.de(need), c.en(need)), have, need, done: ok, paused };
}

// Alle drei Challenges einer Woche samt XP
function challengeWeek(monday) {
  const list = chPick(monday).map((c) => chProgress(c, monday));
  const n = list.filter((c) => c.done).length;
  const all = n === 3;
  return { list, done: n, all, xp: list.reduce((a, c) => a + (c.done ? c.xp : 0), 0) + (all ? CH_ALL_XP : 0), swapped: !!state.chSwaps?.[monday] };
}

function chRow(c, w, monday) {
  const canSwap = !w.swapped && !c.done && !c.paused && monday === mondayOf(todayKey());
  return `
  <div class="weekly ch-row t${c.tier} ${c.done ? 'done' : ''} ${c.paused ? 'paused' : ''}">
    <span class="weekly-ico">${icon(c.done ? 'check' : c.paused ? 'circle-pause' : c.icon)}</span>
    <div class="weekly-text">
      <small>${dt(CH_TIERS[c.tier].de, CH_TIERS[c.tier].en)} · +${c.xp} XP</small>
      <b>${esc(c.text)}</b>
      <div class="meter"><span data-anim="w" style="width:${c.paused ? 0 : (c.have / c.need) * 100}%"></span></div>
    </div>
    <em>${c.done ? dt('Geschafft', 'Done') : c.paused ? dt('Pausiert', 'Paused') : `${c.have} / ${c.need}`}${canSwap ? `<button class="ch-swap" data-action="ch-swap" data-tier="${c.tier}" title="${dt('Gegen eine andere tauschen, einmal pro Woche', 'Swap for another one, once a week')}">${icon('shuffle')}${dt('Tauschen', 'Swap')}</button>` : ''}</em>
  </div>`;
}

// compact: eine Zeile für die XP-Karte; card: ohne eigene Überschrift
function challengesBlock(mode = false) {
  const monday = mondayOf(todayKey());
  const w = challengeWeek(monday);
  const left = 6 - wdOf(todayKey());
  const leftTxt = left ? dt(`noch ${left} ${left === 1 ? 'Tag' : 'Tage'}`, `${left} ${left === 1 ? 'day' : 'days'} left`) : dt('letzter Tag', 'last day');
  if (mode === true) {
    const next = w.list.find((c) => !c.done && !c.paused);
    return `
    <button class="ch-compact ${w.all ? 'done' : ''}" data-action="level-open" title="${dt('Wochen-Challenges ansehen', 'View weekly challenges')}">
      <span class="ch-compact-text"><small>${dt('Wochen-Challenges', 'Weekly challenges')} · ${w.done} / 3</small><b>${w.all ? dt('Alle geschafft, Bonus kassiert!', 'All done, bonus earned!') : next ? esc(next.text) : dt('Diese Woche pausiert', 'Paused this week')}</b></span>
      <span class="ch-segs">${w.list.map((c) => `<i class="t${c.tier} ${c.done ? 'on' : ''}"></i>`).join('')}</span>
    </button>`;
  }
  return `
  <div class="ch-block">
    ${mode === 'card' ? '' : `<div class="ch-head"><span>${dt('Wochen-Challenges', 'Weekly challenges')}</span><small>${leftTxt}</small></div>`}
    ${w.list.map((c) => chRow(c, w, monday)).join('')}
    <div class="ch-bonus ${w.all ? 'on' : ''}">${icon(w.all ? 'party-popper' : 'gift')}<span>${w.all ? dt(`Alle drei geschafft: +${CH_ALL_XP} XP Bonus`, `All three done: +${CH_ALL_XP} XP bonus`) : dt(`Alle drei schaffen: +${CH_ALL_XP} XP Bonus`, `Finish all three: +${CH_ALL_XP} XP bonus`)}</span>${mode === 'card' ? `<small>${leftTxt}</small>` : ''}</div>
  </div>`;
}

function challengesCard() {
  if (!state.habits.length) return '';
  const w = challengeWeek(mondayOf(todayKey()));
  return `
  <article class="card fade-in">
    <div class="card-head">
      <div><h2>${dt('Wochen-Challenges', 'Weekly challenges')}</h2><div class="sub">${dt(`${w.done} von 3 geschafft · jede Woche neue`, `${w.done} of 3 done · new ones every week`)}</div></div>
      <button class="icon-btn" data-action="showcase-open" title="${dt('Vitrine', 'Showcase')}" style="color:var(--sun)">${icon('gem')}</button>
    </div>
    ${challengesBlock('card')}
  </article>`;
}

/* ================= Titel und Farben ================= */

// key: Kennzahl aus cosStats(), need: Ziel
const TITLES = [
  { id: 'early', icon: 'sunrise', key: 'morning', need: 30, de: 'Frühaufsteher', en: 'Early bird', tde: '30 Gewohnheiten am Morgen erledigt', ten: '30 morning habits done' },
  { id: 'owl', icon: 'moon-star', key: 'evening', need: 30, de: 'Nachteule', en: 'Night owl', tde: '30 Gewohnheiten am Abend erledigt', ten: '30 evening habits done' },
  { id: 'streak', icon: 'flame', key: 'streak', need: 21, de: 'Serientäter', en: 'Streak hunter', tde: 'Eine Gewohnheit 21 Tage am Stück', ten: 'One habit 21 days in a row' },
  { id: 'perfect', icon: 'gem', key: 'perfect', need: 25, de: 'Perfektionist', en: 'Perfectionist', tde: '25 perfekte Tage', ten: '25 perfect days' },
  { id: 'run', icon: 'zap', key: 'run', need: 14, de: 'Unaufhaltsam', en: 'Unstoppable', tde: '14 perfekte Tage am Stück', ten: '14 perfect days in a row' },
  { id: 'tasks', icon: 'list-checks', key: 'tasks', need: 100, de: 'Aufgabenkiller', en: 'Task slayer', tde: '100 Aufgaben erledigt', ten: '100 tasks done' },
  { id: 'diary', icon: 'book-open', key: 'moods', need: 30, de: 'Tagebuchschreiber', en: 'Journal keeper', tde: '30 Tage Stimmung eingetragen', ten: 'Mood logged on 30 days' },
  { id: 'challenger', icon: 'swords', key: 'challenges', need: 10, de: 'Herausforderer', en: 'Challenger', tde: '10 Wochen-Challenges geschafft', ten: '10 weekly challenges done' },
  { id: 'allround', icon: 'target', key: 'chWeeks', need: 4, de: 'Allrounder', en: 'All-rounder', tde: '4 Wochen mit allen drei Challenges', ten: '4 weeks with all three challenges' },
  { id: 'veteran', icon: 'calendar-check', key: 'days', need: 180, de: 'Veteran', en: 'Veteran', tde: 'Seit 180 Tagen dabei', ten: 'With Habix for 180 days' },
  { id: 'iron', icon: 'dumbbell', key: 'workouts', need: 50, fit: true, de: 'Eisern', en: 'Iron will', tde: '50 Trainings', ten: '50 workouts' },
  { id: 'cardio', icon: 'heart-pulse', key: 'cardio', need: 25, fit: true, de: 'Ausdauerläufer', en: 'Endurance runner', tde: '25 Cardio-Einheiten', ten: '25 cardio sessions' },
  { id: 'legend', icon: 'crown', key: 'level', need: 50, de: 'Lebende Legende', en: 'Living legend', tde: 'Level 50 erreicht', ten: 'Reached level 50' },
];
const PILL_COLORS = [
  { id: 'ocean', color: '#3fc6f2', key: 'level', need: 5, de: 'Ozean', en: 'Ocean' },
  { id: 'mint', color: '#34c2a0', key: 'level', need: 8, de: 'Minze', en: 'Mint' },
  { id: 'flame', color: '#ff6b4a', key: 'level', need: 12, de: 'Flamme', en: 'Flame' },
  { id: 'violet', color: '#9585ff', key: 'level', need: 16, de: 'Violett', en: 'Violet' },
  { id: 'rose', color: '#ff7ab6', key: 'level', need: 20, de: 'Rose', en: 'Rose' },
  { id: 'ice', color: '#8fe3f7', key: 'challenges', need: 20, de: 'Eis', en: 'Ice', tde: '20 Wochen-Challenges geschafft', ten: '20 weekly challenges done' },
  { id: 'gold', color: '#f2b84b', key: 'level', need: 30, de: 'Gold', en: 'Gold' },
  { id: 'rainbow', color: '#ff6b9a', key: 'level', need: 50, de: 'Regenbogen', en: 'Rainbow' },
];
const cosName = (c) => dt(c.de, c.en);
const cosNeedText = (c) => (c.key === 'level' ? dt(`Ab Level ${c.need}`, `From level ${c.need}`) : dt(c.tde, c.ten));

// Kennzahlen für Titel und Farben; hängt am XP-Zwischenspeicher, wird also mit ihm neu berechnet
function cosStats() {
  const x = computeXp();
  if (x.cos) return x.cos;
  const s = { ...x.stats, level: x.level, moods: 0, morning: 0, evening: 0, days: 0, workouts: 0, cardio: 0 };
  s.moods = Object.values(state.journal).filter((j) => j.mood).length;
  for (const h of state.habits) {
    const dp = daypartOf(h);
    if (dp !== 'morning' && dp !== 'evening') continue;
    if (isAmount(h)) s[dp] += Object.keys(state.amounts).filter((k) => (state.amounts[k][h.id] || 0) >= h.target).length;
    else s[dp] += Object.keys(state.log).filter((k) => state.log[k].includes(h.id)).length;
  }
  const first = state.habits.length ? state.habits.map((h) => h.createdAt).sort()[0] : null;
  if (first) s.days = daysBetween(first, todayKey());
  if (state.fitness?.enabled) { s.workouts = state.fitness.workouts.length; s.cardio = state.fitness.cardio.length; }
  x.cos = s;
  return s;
}
const cosGot = (c, s = cosStats()) => (s[c.key] || 0) >= c.need && (!c.fit || state.fitness?.enabled);

function cosmeticNow() {
  const c = state.cosmetic || {};
  const title = TITLES.find((t) => t.id === c.title);
  const color = PILL_COLORS.find((t) => t.id === c.color);
  return { title: title && cosGot(title) ? title : null, color: color && cosGot(color) ? color : null };
}
function cosTitleChip() {
  const t = cosmeticNow().title;
  return t ? `<span class="title-chip">${icon(t.icon)}${esc(cosName(t))}</span>` : '';
}

/* ================= Vitrine ================= */

function showcaseHtml() {
  const x = computeXp(), s = cosStats(), now = cosmeticNow();
  const fitOn = !!state.fitness?.enabled;
  const titles = TITLES.filter((t) => !t.fit || fitOn);
  const gotT = titles.filter((t) => cosGot(t, s)).length;
  const gotC = PILL_COLORS.filter((c) => cosGot(c, s)).length;
  const medals = state.habits.flatMap((h) => MILESTONES.filter((m) => earnedFor(h)[m.days]).map((m) => ({ h, m, date: earnedFor(h)[m.days] })))
    .sort((a, b) => b.m.days - a.m.days || b.date.localeCompare(a.date));
  const ach = fitOn ? achievements() : [];
  const gotA = ach.filter((a) => a.done).length;
  const have = gotT + gotC + x.rankIndex + 1 + medals.length + gotA;
  const all = titles.length + PILL_COLORS.length + RANKS.length + active().length * MILESTONES.length + ach.length;
  const pillColor = now.color?.color || x.rank.color;
  const w = challengeWeek(mondayOf(todayKey()));

  const titleBtn = (t) => {
    const got = cosGot(t, s), on = now.title?.id === t.id;
    const prog = `${fmtNum(Math.min(s[t.key] || 0, t.need))} / ${fmtNum(t.need)}`;
    return `<button class="sc-title ${on ? 'on' : ''} ${got ? '' : 'locked'}" ${got ? `data-action="cos-title" data-id="${t.id}"` : 'disabled'} title="${esc(dt(t.tde, t.ten))}">
      <span class="sc-title-ico">${icon(got ? t.icon : 'lock')}</span>
      <span class="sc-title-txt"><b>${esc(cosName(t))}</b><small>${got ? esc(dt(t.tde, t.ten)) : `${esc(dt(t.tde, t.ten))} · ${prog}`}</small></span>
      ${on ? `<span class="sc-on">${icon('check')}</span>` : ''}</button>`;
  };
  const swatch = (c) => {
    const got = !c || cosGot(c, s), on = c ? now.color?.id === c.id : !now.color;
    const col = c ? c.color : x.rank.color;
    return `<button class="sc-swatch ${on ? 'on' : ''} ${got ? '' : 'locked'} ${c?.id === 'rainbow' ? 'rainbow' : ''}" style="--s:${col}" ${got ? `data-action="cos-color" data-id="${c ? c.id : ''}"` : 'disabled'}
      title="${c ? `${esc(cosName(c))}${got ? '' : ` · ${esc(cosNeedText(c))}`}` : dt('Farbe deines Rangs', 'Your rank’s colour')}">
      <span class="sc-dot">${icon(got ? (on ? 'check' : 'palette') : 'lock')}</span><small>${c ? esc(cosName(c)) : dt('Rang', 'Rank')}</small>${got || !c ? '' : `<em>${esc(cosNeedText(c))}</em>`}</button>`;
  };

  return `
  <div class="showcase">
    <div class="card-head">
      <div><div class="eyebrow">${dt('Deine Sammlung', 'Your collection')}</div><h2 class="panel-title" style="font-size:22px">${dt('Vitrine', 'Showcase')}</h2></div>
      <div class="btn-row"><button class="btn small ghost" data-action="level-open">${icon('arrow-left')}${dt('Level', 'Level')}</button>
      <button class="icon-btn" data-action="close-modal" aria-label="${dt('Schließen', 'Close')}">${icon('x')}</button></div>
    </div>
    <div class="sc-hero" style="--r:${pillColor}">
      <span class="level-pill sc-pill ${now.color?.id === 'rainbow' ? 'cos-rainbow' : ''}" style="--r:${pillColor};--deg:${Math.round((x.into / x.need) * 360)}deg">
        <span class="lv-ring"><span class="lv-ico">${icon(x.rank.icon)}</span></span>
        <span class="lv-txt"><b>Level ${x.level}</b><small>${now.title ? esc(cosName(now.title)) : rankName(x.rank)}</small></span>
      </span>
      <div class="sc-hero-txt"><b>${dt(`${have} von ${all} gesammelt`, `${have} of ${all} collected`)}</b><small>${dt('So sieht deine Level-Anzeige oben aus. Titel und Farbe kannst du unten wählen.', 'This is how your level badge looks at the top. Pick a title and colour below.')}</small>
        <div class="meter"><span data-anim="w" style="width:${(have / all) * 100}%"></span></div></div>
      <div class="sc-stats">
        <div><b>${num(s.challenges)}</b><small>${dt('Challenges', 'Challenges')}</small></div>
        <div><b>${num(s.chWeeks)}</b><small>${dt('Wochen mit allen drei', 'Weeks with all three')}</small></div>
        <div><b>${w.done}/3</b><small>${dt('diese Woche', 'this week')}</small></div>
      </div>
    </div>
    <div class="sc-cols">
      <section>
        <div class="label-sm">${dt(`Titel · ${gotT} von ${titles.length}`, `Titles · ${gotT} of ${titles.length}`)}</div>
        <div class="sc-titles">
          <button class="sc-title ${now.title ? '' : 'on'}" data-action="cos-title" data-id=""><span class="sc-title-ico">${icon(x.rank.icon)}</span>
            <span class="sc-title-txt"><b>${dt('Kein Titel', 'No title')}</b><small>${dt(`Zeigt deinen Rang: ${rankName(x.rank)}`, `Shows your rank: ${rankName(x.rank)}`)}</small></span>${now.title ? '' : `<span class="sc-on">${icon('check')}</span>`}</button>
          ${titles.map(titleBtn).join('')}
        </div>
      </section>
      <section>
        <div class="label-sm">${dt(`Farbe der Level-Anzeige · ${gotC} von ${PILL_COLORS.length}`, `Level badge colour · ${gotC} of ${PILL_COLORS.length}`)}</div>
        <div class="sc-swatches">${swatch(null)}${PILL_COLORS.map(swatch).join('')}</div>
        <div class="label-sm" style="margin-top:14px">${dt(`Ränge · ${x.rankIndex + 1} von ${RANKS.length}`, `Ranks · ${x.rankIndex + 1} of ${RANKS.length}`)}</div>
        <div class="sc-ranks">${RANKS.map((r, i) => `<span class="sc-rank ${i <= x.rankIndex ? 'got' : ''}" style="--r:${r.color}" title="${esc(rankName(r))} · ${dt(`ab Level ${r.from}`, `from level ${r.from}`)}">${icon(i <= x.rankIndex ? r.icon : 'lock')}</span>`).join('')}</div>
        <div class="label-sm" style="margin-top:14px">${dt(`Abzeichen deiner Gewohnheiten · ${medals.length}`, `Habit badges · ${medals.length}`)}</div>
        ${medals.length ? `<div class="sc-medals">${medals.map(({ h, m, date }) => `
          <div class="sc-medal" title="${esc(h.name)} · ${m.days} ${dt('Tage', 'days')} · ${esc(fmtShort(date))}">
            <span class="medal earned" style="--m:${m.color}">${icon('award')}<b>${m.days}</b></span><small>${esc(h.name)}</small></div>`).join('')}</div>`
          : `<div class="muted sc-empty">${dt('Noch keine. Das erste gibt es für 7 Tage am Stück.', 'None yet. The first one is for 7 days in a row.')}</div>`}
        ${fitOn ? `
        <div class="label-sm" style="margin-top:14px">${dt(`Fitness-Erfolge · ${gotA} von ${ach.length}`, `Fitness achievements · ${gotA} of ${ach.length}`)}</div>
        <div class="fit-badges">${ach.map((a) => `<span class="fit-badge ${a.done ? 'on' : ''}" title="${esc(a.name)}: ${esc(a.text)}">${icon(a.done ? a.icon : 'lock')}</span>`).join('')}</div>` : ''}
      </section>
    </div>
  </div>`;
}
const openShowcase = () => updatePanel(showcaseHtml(), 'xwide', '.showcase, .lv-hero');

/* ================= Meldungen ================= */

// Neue Titel, Farben und geschaffte Challenges einmal melden (beim ersten Mal und mit Beispieldaten still)
function rewardsCheck() {
  if (state.demo || !state.habits.length) return;
  const s = cosStats();
  const ids = [...TITLES, ...PILL_COLORS].filter((c) => cosGot(c, s)).map((c) => c.id);
  let changed = false;
  if (!state.cosSeen) { state.cosSeen = ids; changed = true; } else {
    const fresh = ids.filter((id) => !state.cosSeen.includes(id));
    if (fresh.length) {
      state.cosSeen = [...state.cosSeen, ...fresh];
      changed = true;
      const t = TITLES.find((c) => c.id === fresh[fresh.length - 1]);
      const c = t || PILL_COLORS.find((p) => p.id === fresh[fresh.length - 1]);
      toast(t ? dt(`Neuer Titel freigeschaltet: ${cosName(c)}. Du findest ihn in der Vitrine.`, `New title unlocked: ${cosName(c)}. Find it in your showcase.`)
        : dt(`Neue Farbe freigeschaltet: ${cosName(c)}. Du findest sie in der Vitrine.`, `New colour unlocked: ${cosName(c)}. Find it in your showcase.`));
    }
  }
  const m = mondayOf(todayKey());
  const w = challengeWeek(m);
  const doneIds = w.list.filter((c) => c.done).map((c) => c.id);
  if (state.chSeen?.m !== m) { state.chSeen = { m, ids: doneIds }; changed = true; } else {
    const fresh = w.list.filter((c) => c.done && !state.chSeen.ids.includes(c.id));
    if (fresh.length) {
      state.chSeen = { m, ids: doneIds };
      changed = true;
      toast(w.all ? dt(`Alle drei Wochen-Challenges geschafft! +${fresh[fresh.length - 1].xp + CH_ALL_XP} XP`, `All three weekly challenges done! +${fresh[fresh.length - 1].xp + CH_ALL_XP} XP`)
        : dt(`Challenge geschafft: ${fresh[0].text} · +${fresh[0].xp} XP`, `Challenge done: ${fresh[0].text} · +${fresh[0].xp} XP`));
      if (w.all && !ui.modal && !ui.panel) confetti();
    }
  }
  if (changed) save();
}

function rewardAction(a, el) {
  switch (a) {
    case 'showcase-open': openShowcase(); return true;
    case 'cos-title':
    case 'cos-color': {
      state.cosmetic = { ...(state.cosmetic || {}), [a === 'cos-title' ? 'title' : 'color']: el.dataset.id || null };
      save();
      renderLevelCard();
      updatePanel(showcaseHtml(), 'xwide', '.showcase');
      return true;
    }
    case 'ch-swap': {
      const m = mondayOf(todayKey());
      if (state.chSwaps?.[m]) return true;
      const t = Number(el.dataset.tier);
      state.chSwaps = { ...(state.chSwaps || {}), [m]: { [t]: 1 } };
      save();
      toast(dt('Challenge getauscht. Der nächste Tausch geht wieder nächste Woche.', 'Challenge swapped. Next swap is available next week.'));
      render('update');
      if (document.querySelector('#modal .lv-hero')) openLevelPanel();
      return true;
    }
  }
  return false;
}
