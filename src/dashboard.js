'use strict';

/* Startseite: XP-Tagesziel, Serien-Hinweis, Zeitleiste, „Als Nächstes“, Schnell-Eingabe, Gedanke des Tages,
   Geburtstage, Mini-Monatskalender und das Anpassen der Karten (ein- und ausblenden, per Ziehen sortieren).
   Texte mit wechselnden Zahlen kommen über dt() gleich in der richtigen Sprache, statt über das Wörterbuch. */

const dt = (de, en) => (state.settings?.lang === 'en' ? en : de);

/* ================= Anordnung ================= */

// Karten je Bereich: oben die kleinen Kacheln, links die breite Spalte, rechts die schmale
const DASH_CARDS = {
  done: { zone: 'top', de: 'Heute geschafft', en: 'Done today' },
  perfect: { zone: 'top', de: 'Perfekte Tage in Folge', en: 'Perfect days in a row' },
  week: { zone: 'top', de: 'Diese Woche', en: 'This week' },
  xp: { zone: 'top', de: 'XP heute', en: 'XP today' },
  timeline: { zone: 'main', de: 'Dein Tag', en: 'Your day' },
  habits: { zone: 'main', de: 'Heute dran', en: 'Due today' },
  tasks: { zone: 'main', de: 'Aufgaben für heute', en: 'Tasks for today' },
  events: { zone: 'side', de: 'Termine heute', en: 'Events today' },
  month: { zone: 'side', de: 'Dein Monat', en: 'Your month' },
  journal: { zone: 'side', de: 'Stimmung', en: 'Mood' },
  trend: { zone: 'side', de: 'Trend', en: 'Trend' },
  compare: { zone: 'side', de: 'Wochenvergleich', en: 'Week comparison' },
  focus: { zone: 'side', de: 'Mehr Luft nach oben', en: 'Room to grow' },
};
// Zeilen oben unter der Begrüßung
const DASH_INFO = {
  quick: { de: 'Schnell-Eingabe', en: 'Quick entry' },
  next: { de: 'Als Nächstes', en: 'Up next' },
  birthdays: { de: 'Geburtstage', en: 'Birthdays' },
  streaks: { de: 'Serien-Hinweis', en: 'Streak reminder' },
  thought: { de: 'Gedanke des Tages', en: 'Thought of the day' },
};

function dashState() {
  state.dash ||= { hidden: [], order: {} };
  return state.dash;
}
const dashShown = (id) => !dashState().hidden.includes(id);

// Große Karten passen nur in die breite Spalte, alles andere überallhin
const WIDE_ONLY = new Set(['timeline', 'habits', 'tasks']);
const fitsZone = (id, zone) => zone === 'main' || !WIDE_ONLY.has(id);
const ZONES = ['top', 'main', 'side'];

function dashZones() {
  const order = dashState().order;
  const all = Object.keys(DASH_CARDS);
  const placed = new Set();
  const out = { top: [], main: [], side: [] };
  for (const z of ZONES) {
    for (const id of order[z] || []) {
      if (all.includes(id) && !placed.has(id) && fitsZone(id, z)) { out[z].push(id); placed.add(id); }
    }
  }
  for (const id of all) if (!placed.has(id)) out[DASH_CARDS[id].zone].push(id);
  return out;
}

// Baut die Startseite aus den fertigen Karten. Leere Karten fallen weg, im Anpassen-Modus stehen sie als Platzhalter da.
function dashGrid(cards) {
  const edit = !!ui.dashEdit;
  const zones = dashZones();
  const zone = (z) => zones[z].map((id) => {
    const shown = dashShown(id);
    if (!edit && (!shown || !cards[id])) return '';
    const body = cards[id] || `<article class="card dash-empty"><div class="card-head"><div><h2>${dt(DASH_CARDS[id].de, DASH_CARDS[id].en)}</h2><div class="sub">${dt('Gerade nichts zu zeigen', 'Nothing to show right now')}</div></div></div></article>`;
    if (!edit) return `<div class="dash-item" data-card="${id}">${body}</div>`;
    return `<div class="dash-item editing ${shown ? '' : 'is-hidden'}" data-card="${id}">
      <div class="dash-ctl">
        <span class="dash-grip" title="${dt('Ziehen zum Sortieren', 'Drag to reorder')}">${icon('grip-vertical')}</span>
        <button class="icon-btn" data-action="dash-toggle" data-id="${id}" title="${shown ? dt('Ausblenden', 'Hide') : dt('Einblenden', 'Show')}">${icon(shown ? 'eye' : 'eye-off')}</button>
      </div>
      ${body}
    </div>`;
  }).join('');
  return `
  <section class="dash ${edit ? 'edit' : ''}">
    <div class="dash-zone z-top" data-zone="top" data-hint="${dt('Hierher ziehen', 'Drop here')}">${zone('top')}</div>
    <div class="dash-zone z-main" data-zone="main" data-hint="${dt('Hierher ziehen', 'Drop here')}">${zone('main')}</div>
    <div class="dash-zone z-side" data-zone="side" data-hint="${dt('Hierher ziehen', 'Drop here')}">${zone('side')}</div>
  </section>`;
}

function dashToolbar() {
  return `
  <div class="dash-toolbar fade-in">
    <div class="dash-toolbar-text"><b>${dt('Startseite anpassen', 'Customize home')}</b><span>${dt('Pack eine Karte und zieh sie an eine andere Stelle: in die obere Reihe, links oder rechts. Große Karten passen nur in die breite Spalte. Das Auge blendet Karten aus und ein.', 'Grab a card and drag it somewhere else: into the top row, left or right. Large cards only fit the wide column. The eye hides and shows cards.')}</span></div>
    <div class="dash-chips">${Object.entries(DASH_INFO).map(([id, x]) => `<button class="chip dash-chip ${dashShown(id) ? 'on' : ''}" data-action="dash-toggle" data-id="${id}">${icon(dashShown(id) ? 'eye' : 'eye-off')}${dt(x.de, x.en)}</button>`).join('')}</div>
    <div class="btn-row">
      <button class="btn small ghost" data-action="dash-reset">${icon('rotate-ccw')}${dt('Standard', 'Default')}</button>
      <button class="btn small primary" data-action="dash-done">${icon('check')}${dt('Fertig', 'Done')}</button>
    </div>
  </div>`;
}

/* ================= Kopfbereich ================= */

function dashHead() {
  const today = todayKey();
  const lines = [];
  if (dashShown('next')) lines.push(nextUpPill());
  if (dashShown('birthdays')) lines.push(...birthdayPills(today));
  if (dashShown('streaks')) lines.push(...streakPills(today));
  const pills = lines.filter(Boolean);
  return `
  <header class="head dash-head fade-in">
    <div>
      <div class="eyebrow">${esc(fmtLong(today))}</div>
      <h1>${greeting()}</h1>
    </div>
    <div class="head-actions">
      <button class="btn ghost" data-action="dash-edit" title="${dt('Startseite anpassen', 'Customize home')}">${icon('sliders-horizontal')}${dt('Anpassen', 'Customize')}</button>
      <button class="btn primary" data-action="new-habit">${icon('plus')}Neue Gewohnheit</button>
    </div>
  </header>
  ${ui.dashEdit ? dashToolbar() : ''}
  ${dashShown('quick') ? quickAddBar() : ''}
  ${pills.length ? `<div class="info-pills fade-in">${pills.join('')}</div>` : ''}`;
}

/* ================= Als Nächstes ================= */

function untilText(ms) {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return dt(`in ${min} Min.`, `in ${min} min`);
  const h = Math.floor(min / 60), m = min % 60;
  return m ? dt(`in ${h} Std. ${m} Min.`, `in ${h} h ${m} min`) : dt(`in ${h} Std.`, `in ${h} h`);
}
function leftText(ms) {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return dt(`noch ${min} Min.`, `${min} min left`);
  const h = Math.floor(min / 60), m = min % 60;
  return m ? dt(`noch ${h} Std. ${m} Min.`, `${h} h ${m} min left`) : dt(`noch ${h} Std.`, `${h} h left`);
}

function upcoming() {
  const now = Date.now();
  const today = todayKey();
  return instancesBetween(today, addDays(today, 1))
    .filter((i) => !i.allDay && i.endMs > now && !(i.ev.task && i.ev.done))
    .sort((a, b) => a.startMs - b.startMs);
}

function nextUpPill() {
  const now = Date.now();
  const list = upcoming();
  const running = list.find((i) => i.startMs <= now);
  const next = list.find((i) => i.startMs > now && i.startMs - now < 18 * 3600000);
  const out = [];
  if (running) {
    out.push(`<span class="info-pill now" style="--c:${colorOf(running)}">${icon('alarm-clock')}<b>${dt('Jetzt', 'Now')}:</b> ${esc(running.ev.title)} · <span data-left="${running.endMs}">${leftText(running.endMs - now)}</span></span>`);
  }
  if (next) {
    const when = next.startKey === todayKey() ? hhmm(next.startMs) : `${dt('morgen', 'tomorrow')} ${hhmm(next.startMs)}`;
    out.push(`<span class="info-pill" style="--c:${colorOf(next)}">${icon(next.ev.task ? 'list-todo' : 'calendar-clock')}<b>${dt('Als Nächstes', 'Up next')}:</b> ${esc(next.ev.title)} <span data-until="${next.startMs}">${untilText(next.startMs - now)}</span> <small>${when}</small></span>`);
  }
  return out.join('');
}

/* ================= Geburtstage und Jahrestage ================= */

const SPECIAL_DAY = /geburtstag|birthday|jahrestag|anniversary|hochzeitstag/i;
function birthdayPills(today) {
  const seen = new Set();
  return instancesBetween(today, addDays(today, 14))
    .filter((i) => SPECIAL_DAY.test(i.ev.title || '') && i.startKey >= today)
    .filter((i) => { const key = i.ev.title.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
    .slice(0, 2)
    .map((i) => {
      const d = daysBetween(today, i.startKey);
      const when = d === 0 ? dt('heute', 'today') : d === 1 ? dt('morgen', 'tomorrow') : dt(`in ${d} Tagen`, `in ${d} days`);
      return `<span class="info-pill ${d === 0 ? 'hot' : ''}" style="--c:#ff7ab6">${icon('cake')}<b>${esc(i.ev.title)}</b> ${when}</span>`;
    });
}

/* ================= Serien-Hinweis am Abend ================= */

function streakPills(today) {
  if (new Date().getHours() < 18) return [];
  const risk = active()
    .filter((h) => scheduled(h, today) && !done(h, today))
    .map((h) => ({ h, n: streak(h) }))
    .filter((x) => x.n >= 3)
    .sort((a, b) => b.n - a.n);
  const pills = risk.slice(0, 2).map(({ h, n }) => `<span class="info-pill warn" style="--c:${h.color}">${icon('flame')}<b>${esc(h.name)}:</b> ${dt(`${n}-Tage-Serie, heute noch offen`, `${n}-day streak, still open today`)}</span>`);
  if (risk.length > 2) pills.push(`<span class="info-pill warn">${dt(`und ${risk.length - 2} weitere Serien`, `and ${risk.length - 2} more streaks`)}</span>`);
  return pills;
}

/* ================= Gedanke des Tages ================= */

const THOUGHTS = [
  ['Kleine Schritte sind auch Schritte.', 'Small steps are still steps.'],
  ['Du musst nicht perfekt sein, nur dranbleiben.', 'You don’t have to be perfect, just keep going.'],
  ['Heute zählt mehr als gestern.', 'Today matters more than yesterday.'],
  ['Was du jeden Tag tust, formt dich mehr als das, was du ab und zu tust.', 'What you do every day shapes you more than what you do now and then.'],
  ['Ein verpasster Tag ist keine Niederlage. Zwei hintereinander sind ein Muster.', 'One missed day is no defeat. Two in a row is a pattern.'],
  ['Fang klein an. Groß wird es von allein.', 'Start small. It grows on its own.'],
  ['Motivation bringt dich los, Gewohnheit bringt dich ans Ziel.', 'Motivation gets you started, habit gets you there.'],
  ['Mach es so leicht, dass du nicht Nein sagen kannst.', 'Make it so easy you can’t say no.'],
  ['Fortschritt sieht man oft erst, wenn man zurückschaut.', 'Progress often shows only when you look back.'],
  ['Ein guter Tag beginnt mit einer erledigten Sache.', 'A good day starts with one thing done.'],
  ['Pausen gehören dazu. Aufhören nicht.', 'Breaks are part of it. Quitting is not.'],
  ['Zwei Minuten sind besser als keine.', 'Two minutes beat none.'],
  ['Du baust gerade an jemandem, der du sein willst.', 'You’re building the person you want to be.'],
  ['Konstanz schlägt Intensität.', 'Consistency beats intensity.'],
  ['Erledigt ist besser als perfekt.', 'Done is better than perfect.'],
  ['Jeder Haken ist eine Stimme für die Person, die du werden willst.', 'Every check is a vote for who you want to become.'],
  ['Plane den Tag, sonst plant er dich.', 'Plan your day, or it plans you.'],
  ['Der beste Zeitpunkt war gestern. Der zweitbeste ist jetzt.', 'The best time was yesterday. The next best is now.'],
  ['Langsam ist auch eine Geschwindigkeit.', 'Slow is still a speed.'],
  ['Sei heute ein bisschen besser als gestern, nicht als andere.', 'Be a little better than yesterday, not than others.'],
  ['Routine ist Freiheit, die man sich vorher erarbeitet hat.', 'Routine is freedom you earned in advance.'],
  ['Wer anfängt, ist schon weiter als die meisten.', 'Starting already puts you ahead of most.'],
  ['Ruhe ist auch Fortschritt.', 'Rest is progress too.'],
  ['Eine Sache nach der anderen.', 'One thing at a time.'],
  ['Freu dich über das, was heute geklappt hat.', 'Be glad about what worked today.'],
  ['Gewohnheiten sind Zinsen, die du dir selbst zahlst.', 'Habits are interest you pay yourself.'],
  ['Mach weiter, auch wenn es niemand sieht.', 'Keep going, even when no one is watching.'],
  ['Der Weg wird leichter, je öfter du ihn gehst.', 'The path gets easier the more you walk it.'],
  ['Nicht jeder Tag muss groß sein. Er muss nur zählen.', 'Not every day has to be big. It just has to count.'],
  ['Heute ist ein guter Tag, um dranzubleiben.', 'Today is a good day to stick with it.'],
  ['Du bist weiter, als du denkst.', 'You’re further along than you think.'],
];
// Steht oben mittig in der Titelleiste, aber nur auf der Startseite
function syncTitleThought() {
  const el = document.getElementById('title-thought');
  if (!el) return;
  const on = ui.view === 'today' && active().length && dashShown('thought');
  el.innerHTML = on ? `${icon('quote')}<span>${esc(thoughtOfDay(todayKey()))}</span>` : '';
  el.title = on ? thoughtOfDay(todayKey()) : '';
}

function thoughtOfDay(k) {
  const d = parseKey(k);
  const day = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
  const t = THOUGHTS[(day + d.getFullYear()) % THOUGHTS.length];
  return dt(t[0], t[1]);
}

/* ================= XP heute ================= */

function xpToday() {
  const k = todayKey();
  let xp = 0;
  for (const h of state.habits) {
    if (isAmount(h) ? (state.amounts[k]?.[h.id] || 0) >= h.target : state.log[k]?.includes(h.id)) xp += XP.habit;
    for (const [d, date] of Object.entries(state.badges[h.id] || {})) if (date === k) xp += BADGE_XP[d] || 0;
  }
  if (state.habits.length && dayRate(k, state.habits) === 1) xp += XP.perfect;
  for (const t of state.tasks) if (t.done && t.doneAt && keyOf(new Date(t.doneAt)) === k) xp += XP.task + (t.prio ? XP.taskPrio : 0);
  if (state.journal[k]?.mood) xp += XP.mood;
  return xp;
}

function xpCard() {
  const goal = Math.max(10, Number(state.settings.xpGoal) || 60);
  const xp = xpToday();
  const share = Math.min(1, xp / goal);
  const x = computeXp();
  return `
  <article class="card fade-in">
    <div class="card-head">
      <div><h2>${dt('XP heute', 'XP today')}</h2><div class="sub">${xp >= goal ? dt('Tagesziel geschafft!', 'Daily goal reached!') : dt(`Noch ${goal - xp} XP bis zum Tagesziel`, `${goal - xp} XP to your daily goal`)}</div></div>
      <button class="icon-btn" data-action="level-open" style="color:var(--violet)" title="${dt('Level und Rang', 'Level and rank')}">${icon('zap')}</button>
    </div>
    <div class="stat-row">
      <div class="big">${num(xp)}<small> / ${goal}</small></div>
      <div style="text-align:right"><div class="sub">Level</div><div class="num" style="font-size:18px">${x.level}</div></div>
    </div>
    <div class="meter"><span data-anim="w" style="width:${share * 100}%"></span></div>
    ${weeklyBlock(true)}
  </article>`;
}

/* ================= Zeitleiste ================= */

function timelineCard() {
  const today = todayKey();
  const insts = instancesBetween(today, today);
  const timed = insts.filter((i) => !i.allDay);
  const allDay = insts.filter((i) => i.allDay && !(i.ev.task && i.ev.done));
  const dayStartMs = dayStart(today);
  const firstH = Math.min(6, ...timed.map((i) => new Date(Math.max(i.startMs, dayStartMs)).getHours()));
  const span = (24 - firstH) * 60;
  const pos = (ms) => clamp01(((ms - dayStartMs) / 60000 - firstH * 60) / span) * 100;

  // Termine auf zwei Bahnen verteilen, damit sich Überschneidungen nicht verdecken
  const lanes = [0, 0];
  const blocks = timed.sort((a, b) => a.startMs - b.startMs).map((i) => {
    const lane = i.startMs >= lanes[0] ? 0 : i.startMs >= lanes[1] ? 1 : 0;
    lanes[lane] = Math.max(lanes[lane], i.endMs);
    const l = pos(i.startMs), w = Math.max(3, pos(i.endMs) - l);
    const t = `${hhmm(i.startMs)} – ${hhmm(i.endMs)} ${esc(i.ev.title)}`;
    return `<button class="tl-ev lane${lane} ${i.ev.task ? 'task' : ''} ${i.ev.done ? 'done' : ''}" style="left:${l}%;width:${w}%;--c:${colorOf(i)}" title="${t}" ${tlOpen(i, today)}><span>${esc(i.ev.title)}</span></button>`;
  }).join('');

  // Tageszeiten der Gewohnheiten als Bänder
  const due = active().filter((h) => scheduled(h, today));
  const parts = [['morning', 4, 11, 'Morgens', 'Morning'], ['midday', 11, 17, 'Mittags', 'Midday'], ['evening', 17, 24, 'Abends', 'Evening']].map(([id, a, b, de, en]) => {
    const hs = due.filter((h) => daypartOf(h) === id);
    const open = hs.filter((h) => !done(h, today)).length;
    const a2 = Math.max(a, firstH);
    const l = ((a2 - firstH) * 60 / span) * 100, w = (((b - a2) * 60) / span) * 100;
    const label = dt(de, en);
    const state2 = !hs.length ? '' : open ? dt(`${open} offen`, `${open} open`) : dt('erledigt', 'done');
    const icons = hs.map((h) => `<button class="tl-habit ${done(h, today) ? 'done' : ''}" style="--c:${h.color}" data-action="tl-habit" data-id="${h.id}" title="${esc(h.name)}">${icon(h.icon)}</button>`).join('');
    return `<div class="tl-band ${id} ${hs.length && !open ? 'ok' : ''}" style="left:${l}%;width:${w}%">${icons ? `<div class="tl-habits">${icons}</div>` : ''}<span>${label}${state2 ? ` · ${state2}` : ''}</span></div>`;
  }).join('');

  const hours = [];
  for (let h = Math.ceil(firstH / 3) * 3; h < 24; h += 3) hours.push(`<span style="left:${(((h - firstH) * 60) / span) * 100}%">${pad(h)}</span>`);

  return `
  <article class="card fade-in">
    <div class="card-head">
      <div><h2>${dt('Dein Tag', 'Your day')}</h2><div class="sub">${dt('Termine, Aufgaben mit Uhrzeit und deine Gewohnheiten nach Tageszeit', 'Events, timed tasks and your habits by time of day')}</div></div>
      <button class="icon-btn" data-action="goto" data-view="calendar" title="${dt('Zum Kalender', 'To calendar')}">${icon('calendar-days')}</button>
    </div>
    ${allDay.length ? `<div class="tl-allday">${allDay.slice(0, 4).map((i) => `<button class="chip" style="--c:${colorOf(i)}" ${tlOpen(i, today)}>${esc(i.ev.title)}</button>`).join('')}</div>` : ''}
    <div class="timeline" data-first="${firstH}">
      <div class="tl-bands">${parts}</div>
      <div class="tl-events">${blocks}</div>
      <div class="tl-now" style="left:${pos(Date.now())}%"><span>${dt('jetzt', 'now')}</span></div>
      <div class="tl-hours">${hours.join('')}</div>
    </div>
  </article>`;
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// Klick auf einen Eintrag öffnet ihn dort, wo man ihn bearbeitet: Termin, Aufgabe oder der Stundenplan
const tlOpen = (i, day) => (i.ev.task ? `data-action="task-edit" data-id="${esc(i.ev.taskId)}"`
  : i.ev.shift ? 'data-action="goto" data-view="schedule"'
  : `data-action="cal-open" data-id="${esc(i.ev.id)}" data-day="${day}"`);

/* ================= Mini-Monatskalender ================= */

function monthCard() {
  const today = todayKey();
  const first = `${today.slice(0, 8)}01`;
  const d0 = parseKey(first);
  const last = keyOf(new Date(d0.getFullYear(), d0.getMonth() + 1, 0));
  const days = range(first, last);
  let perfect = 0;
  const cells = days.map((k) => {
    const r = k > today ? null : dayRate(k);
    if (r === 1) perfect++;
    const cls = [k === today ? 'today' : '', k > today ? 'future' : '', r === 1 ? 'perfect' : ''].join(' ');
    const dot = r !== null && r < 1 && r > 0 ? `<i style="--p:${progHue(r)}"></i>` : '';
    return `<span class="mm-day ${cls}" title="${esc(fmtShort(k))}${r !== null ? `: ${pct(r)}` : ''}">${Number(k.slice(8))}${dot}</span>`;
  });
  const lead = Array.from({ length: wdOf(first) }, () => '<span></span>').join('');
  const month = new Intl.DateTimeFormat(LOCALE(), { month: 'long' }).format(d0);
  return `
  <article class="card fade-in">
    <div class="card-head">
      <div><h2>${esc(month)}</h2><div class="sub">${dt(`${perfect} perfekte ${perfect === 1 ? 'Tag' : 'Tage'} bisher`, `${perfect} perfect ${perfect === 1 ? 'day' : 'days'} so far`)}</div></div>
      <button class="icon-btn" data-action="goto" data-view="habits" title="${dt('Zur Übersicht', 'To overview')}">${icon('list-checks')}</button>
    </div>
    <div class="mini-month">${WD.map((w) => `<b>${w}</b>`).join('')}${lead}${cells.join('')}</div>
  </article>`;
}

function homeSettingsCard() {
  const s = state.settings;
  return `
  <article class="card s6 fade-in">
    <div class="card-head"><div><h2>${dt('Startseite', 'Home')}</h2><div class="sub">${dt('Tagesziel und Anordnung der Karten', 'Daily goal and card layout')}</div></div><div class="icon-btn">${icon('layout-dashboard')}</div></div>
    <div class="settings-list">
      <label class="setting" for="set-xpGoal"><div><b>${dt('Tagesziel für XP', 'Daily XP goal')}</b><span>${dt('Erscheint als Balken auf der Startseite', 'Shown as a bar on the home page')}</span></div><input type="number" min="10" max="1000" step="10" class="input small-input" data-setting="xpGoal" id="set-xpGoal" value="${s.xpGoal || 60}"></label>
    </div>
    <button class="btn small" data-action="dash-edit" style="align-self:flex-start">${icon('sliders-horizontal')}${dt('Startseite anpassen', 'Customize home')}</button>
  </article>`;
}

/* ================= Schnell-Eingabe ================= */

const WEEKDAYS = [['montag', 'monday'], ['dienstag', 'tuesday'], ['mittwoch', 'wednesday'], ['donnerstag', 'thursday'], ['freitag', 'friday'], ['samstag', 'saturday'], ['sonntag', 'sunday']];

// Liest Datum und Uhrzeit aus einem kurzen Satz. Mit Uhrzeit wird es ein Termin, sonst eine Aufgabe.
function parseQuick(text) {
  let s = ` ${text} `;
  const today = todayKey();
  let date = null, from = null, to = null, kind = null;
  const cut = (re, fn) => { const m = s.match(re); if (!m) return false; fn(m); s = s.replace(m[0], ' '); return true; };
  const hm = (h, m = '0', ap = '') => {
    let H = Number(h); const M = Number(m || 0);
    if (/pm/i.test(ap) && H < 12) H += 12;
    if (/am/i.test(ap) && H === 12) H = 0;
    return H <= 23 && M <= 59 ? H * 60 + M : null;
  };

  cut(/^\s*(termin|event)\s*:\s*/i, () => { kind = 'event'; }) || cut(/^\s*(aufgabe|task|todo)\s*:\s*/i, () => { kind = 'task'; });

  // Datum
  cut(/\s(?:am\s+|on\s+)?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?(?=\s)/i, (m) => {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(today.slice(0, 4));
    let k = keyOf(new Date(y, Number(m[2]) - 1, Number(m[1])));
    if (!m[3] && k < today) k = keyOf(new Date(y + 1, Number(m[2]) - 1, Number(m[1])));
    date = k;
  })
    || cut(/\s(übermorgen|day after tomorrow)(?=\s)/i, () => { date = addDays(today, 2); })
    || cut(/\s(morgen|tomorrow)(?=\s)/i, () => { date = addDays(today, 1); })
    || cut(/\s(heute|today|tonight)(?=\s)/i, () => { date = today; })
    || cut(/\sin\s+(\d{1,3})\s+(tagen|tag|days?)(?=\s)/i, (m) => { date = addDays(today, Number(m[1])); })
    || cut(/\sin\s+(\d{1,2})\s+(wochen|woche|weeks?)(?=\s)/i, (m) => { date = addDays(today, Number(m[1]) * 7); })
    || cut(/\s(nächste woche|naechste woche|next week)(?=\s)/i, () => { date = addDays(today, 7 - wdOf(today)); })
    || cut(new RegExp(`\\s(?:(am|on|nächsten|nächster|kommenden|next|this|diesen)\\s+)*(${WEEKDAYS.flat().join('|')})(?=\\s)`, 'i'), (m) => {
      const wd = WEEKDAYS.findIndex((w) => w.includes(m[2].toLowerCase()));
      let diff = (wd - wdOf(today) + 7) % 7;
      if (diff === 0 && /nächst|kommend|next/i.test(m[0])) diff = 7;
      date = addDays(today, diff);
    });

  // Uhrzeit, auch als Spanne „14 bis 15 Uhr“
  const T = '(\\d{1,2})(?:[:.](\\d{2}))?';
  cut(new RegExp(`\\s(?:von\\s+|from\\s+)?${T}\\s*(?:uhr|h)?\\s*(?:-|–|bis|to|until)\\s*${T}\\s*(uhr|h)?(?=\\s)`, 'i'), (m) => {
    if (!/uhr|:|von|from|\.\d/i.test(m[0])) return;
    from = hm(m[1], m[2]); to = hm(m[3], m[4]);
  });
  if (from === null) {
    cut(/\s(?:um\s+|at\s+|gegen\s+|ab\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s)/i, (m) => { from = hm(m[1], m[2], m[3]); })
      || cut(/\s(?:um\s+|at\s+|gegen\s+|ab\s+)?(\d{1,2})[:.](\d{2})\s*(?:uhr|h)?(?=\s)/i, (m) => { from = hm(m[1], m[2]); })
      || cut(/\s(?:um\s+|at\s+|gegen\s+|ab\s+)?(\d{1,2})\s*uhr(?=\s)/i, (m) => { from = hm(m[1]); })
      || cut(/\s(?:um|at|gegen)\s+(\d{1,2})(?=\s)/i, (m) => { from = hm(m[1]); });
  }

  const title = s.replace(/\s(am|um|bis|von|an|on|at|ab|next|nächsten|nächster|gegen)(?=\s)/gi, ' ').replace(/\s+/g, ' ').replace(/^[\s,.\-–:]+|[\s,.\-–:]+$/g, '').trim();
  if (from !== null && to === null) to = Math.min(1439, from + 60);
  if (from !== null && !date) date = from > new Date().getHours() * 60 + new Date().getMinutes() ? today : addDays(today, 1);
  if (!kind) kind = from !== null ? 'event' : 'task';
  return { title, kind, date, from, to };
}

function quickAddBar() {
  return `
  <div class="quick-bar fade-in">
    ${icon('wand-sparkles')}
    <input class="quick-input" id="quick-input" autocomplete="off" spellcheck="false"
      placeholder="${dt('Schnell eintragen, z. B. „Zahnarzt morgen 14 Uhr“ oder „Steuer abgeben Freitag“', 'Quick add, e.g. “Dentist tomorrow 2pm” or “Do taxes Friday”')}">
    <div class="quick-preview" id="quick-preview"></div>
  </div>`;
}

function quickPreviewHtml(p) {
  if (!p.title) return '';
  const day = p.date ? new Intl.DateTimeFormat(LOCALE(), { weekday: 'short', day: 'numeric', month: 'short' }).format(parseKey(p.date)) : null;
  const time = p.from !== null ? `${minLabel(p.from)} – ${minLabel(p.to)}` : null;
  const kind = p.kind === 'event' ? `${icon('calendar-plus')}${dt('Termin', 'Event')}` : `${icon('list-todo')}${dt('Aufgabe', 'Task')}`;
  const parts = [day || (p.kind === 'event' ? dt('heute', 'today') : dt('ohne Datum', 'no date')), time, p.kind === 'event' && !time ? dt('ganztägig', 'all day') : null].filter(Boolean);
  return `<span class="qp-kind ${p.kind}">${kind}</span><b>${esc(p.title)}</b><span>${parts.join(' · ')}</span><span class="qp-enter">${icon('corner-down-left')}Enter</span>`;
}

function quickCreate(text) {
  const p = parseQuick(text);
  if (!p.title) return false;
  if (p.kind === 'event') {
    const day = p.date || todayKey();
    if (p.from === null) {
      state.calEvents.push({ id: `local:${uid()}`, cal: 'local', title: p.title, allDay: true, start: day, end: day, note: '', location: '', color: CAL_COLORS[0], remind: null });
    } else {
      const start = new Date(`${day}T${minLabel(p.from)}`).getTime();
      let end = new Date(`${day}T${minLabel(p.to)}`).getTime();
      if (end <= start) end += 86400000;
      state.calEvents.push({ id: `local:${uid()}`, cal: 'local', title: p.title, allDay: false, start, end, note: '', location: '', color: CAL_COLORS[0], remind: null });
    }
    toast(dt('Termin angelegt', 'Event added'));
  } else {
    addTask(p.title, p.date);
    toast(dt('Aufgabe angelegt', 'Task added'));
  }
  save();
  render('update');
  requestAnimationFrame(() => document.getElementById('quick-input')?.focus());
  return true;
}

const quickFocused = () => document.activeElement?.id === 'quick-input';

document.addEventListener('input', (e) => {
  if (e.target.id !== 'quick-input') return;
  const prev = document.getElementById('quick-preview');
  const v = e.target.value.trim();
  prev.innerHTML = v ? quickPreviewHtml(parseQuick(v)) : '';
  prev.classList.toggle('on', !!v);
  if (v) lucide.createIcons();
});
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'quick-input') {
    if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); quickCreate(e.target.value.trim()); }
    if (e.key === 'Escape') { e.target.value = ''; document.getElementById('quick-preview').innerHTML = ''; e.target.blur(); }
  }
});

/* ================= Karten verschieben ================= */

/* Die Karte hängt beim Ziehen an der Maus (leicht gekippt, mit Schatten). An ihrem alten Platz bleibt eine gestrichelte Lücke
   in der echten Größe der Karte, die zu der Stelle wandert, wo die Karte landen würde. Die anderen Karten gleiten dabei weich
   zur Seite (FLIP-Animation). Gemessen wird immer an der Lage ohne laufende Animation, so pendelt die Lücke nicht hin und her.
   Beim Loslassen gleitet die Karte genau in die Lücke. Bewegt wird nur über transform (Verschieben und Zoomen), nie über
   Breite oder Höhe, damit der Inhalt der Karten nicht bei jedem Bild neu umbrochen werden muss. */
let drag = null;
const EASE_OUT = 'cubic-bezier(.2, .8, .2, 1)';

// Lage eines Elements ohne die gerade laufende Verschiebung
function layoutRect(el) {
  const r = el.getBoundingClientRect();
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return r;
  const m = new DOMMatrix(t);
  return new DOMRect(r.left - m.e, r.top - m.f, r.width, r.height);
}

function flip(change) {
  const items = [...document.querySelectorAll('.dash .dash-item')];
  const before = new Map(items.map((el) => [el, el.getBoundingClientRect()]));
  for (const el of items) el._flip?.cancel();
  change();
  for (const el of items) {
    const a = before.get(el), b = el.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    el._flip = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: 280, easing: EASE_OUT });
  }
}

function startDrag() {
  const { item } = drag;
  const r = item.getBoundingClientRect();
  const ghost = item.cloneNode(true);
  ghost.classList.add('dash-ghost');
  ghost.classList.remove('editing');
  ghost.style.width = `${r.width}px`;
  ghost.style.height = `${r.height}px`;
  ghost.style.transform = `translate(${r.left}px, ${r.top}px)`;
  document.body.appendChild(ghost);
  requestAnimationFrame(() => ghost.classList.add('lifted'));
  item.classList.add('placeholder');
  Object.assign(drag, { ghost, started: true, home: { parent: item.parentElement, next: item.nextSibling }, tilt: 0, lastX: drag.sx, w: r.width, h: r.height, px: -1, py: -1, nextPlace: 0 });
  document.body.classList.add('dash-dragging');
  drag.raf = requestAnimationFrame(dragFrame);
}

// Ein Takt pro Bild: Karte an die Maus, Lücke nachziehen, am Rand scrollen
function dragFrame() {
  if (!drag?.started) return;
  const { x, y } = drag;
  // Platz nur neu suchen, wenn sich die Maus bewegt oder die Seite gescrollt hat, und nicht öfter als alle 70 ms umsetzen.
  // So muss der Browser die Seite nicht in mehreren Bildern hintereinander neu anordnen.
  const scrolled = autoScroll();
  const now = performance.now();
  if ((scrolled || Math.abs(x - drag.px) + Math.abs(y - drag.py) > 1) && now > drag.nextPlace) {
    drag.px = x; drag.py = y;
    if (placeAt(x, y)) drag.nextPlace = now + 70;
  }
  // Die Karte in der Hand behält ihre Größe; die Lücke zeigt, wie groß sie am neuen Platz wird
  drag.tilt = Math.max(-7, Math.min(7, drag.tilt * 0.82 + (x - drag.lastX) * 0.3));
  drag.lastX = x;
  drag.ghost.style.transform = `translate(${x - drag.dx}px, ${y - drag.dy}px) rotate(${drag.tilt * 0.4 - 1}deg)`;
  drag.raf = requestAnimationFrame(dragFrame);
}

// Steht die Maus hinter dieser Karte? In einer Reihe zählt die Lesereihenfolge, in einer Spalte nur die Höhe.
function isBefore(r, x, y, row) {
  if (!row) return y > r.top + r.height / 2;
  if (y > r.bottom) return true;
  return y >= r.top && x > r.left + r.width / 2;
}

// Lücke an die Stelle unter der Maus bringen, wenn die Karte dort hinpasst
function placeAt(x, y) {
  const zone = [...document.querySelectorAll('.dash .dash-zone')].find((z) => {
    const r = z.getBoundingClientRect();
    return x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6;
  });
  if (!zone) { drag.ghost.classList.remove('denied'); return false; }
  const ok = fitsZone(drag.id, zone.dataset.zone);
  drag.ghost.classList.toggle('denied', !ok);
  if (!ok) return false;
  const ph = drag.item;
  const items = [...zone.querySelectorAll(':scope > .dash-item:not(.placeholder)')];
  const row = getComputedStyle(zone).flexDirection === 'row';
  const ref = items[items.filter((it) => isBefore(layoutRect(it), x, y, row)).length] || null;
  if (ph.parentElement === zone && (ph.nextElementSibling === ref || (!ref && !ph.nextElementSibling))) return false;
  flip(() => zone.insertBefore(ph, ref));
  return true;
}

// Am Rand der Seite automatisch weiterscrollen
function autoScroll() {
  const sc = document.getElementById('scroller');
  const r = sc.getBoundingClientRect();
  // Erst ganz nah am Rand und sanft anlaufend, damit die Seite nicht beim Zielen auf die obere Reihe losrutscht
  const edge = 44, y = drag.y;
  const depth = y < r.top + edge ? -(r.top + edge - y) : y > r.bottom - edge ? y - (r.bottom - edge) : 0;
  const v = Math.sign(depth) * Math.min(1, Math.abs(depth) / edge) ** 2 * 16;
  if (!v) return false;
  const before = sc.scrollTop;
  sc.scrollTop += v;
  return sc.scrollTop !== before;
}

function finishDrag(cancel = false) {
  const d = drag;
  drag = null;
  if (!d?.started) return;
  cancelAnimationFrame(d.raf);
  document.body.classList.remove('dash-dragging');
  if (cancel) flip(() => d.home.parent.insertBefore(d.item, d.home.next));
  // Karte gleitet zu ihrer Lücke und blendet dabei in die echte Karte in der neuen Größe über.
  // Bei ähnlicher Größe passt sie sich leicht an, bei sehr anderer Größe wird nichts verzerrt, die Überblendung übernimmt.
  const r = layoutRect(d.item);
  const k = Math.max(0.9, Math.min(1.1, r.width / d.w));
  d.ghost.classList.remove('lifted', 'denied');
  d.ghost.classList.add('landing');
  d.ghost.style.transform = `translate(${r.left + (r.width - d.w * k) / 2}px, ${r.top}px) scale(${k})`;
  d.item.classList.remove('placeholder');
  d.item.classList.add('revealing');
  requestAnimationFrame(() => requestAnimationFrame(() => { d.item.classList.add('revealed'); d.ghost.classList.add('fading'); }));
  setTimeout(() => { d.ghost.remove(); d.item.classList.remove('revealing', 'revealed'); }, 420);
  if (!cancel) {
    const st = dashState();
    for (const zone of document.querySelectorAll('.dash .dash-zone')) {
      st.order[zone.dataset.zone] = [...zone.querySelectorAll(':scope > .dash-item')].map((x) => x.dataset.card);
    }
    save();
  }
}

document.addEventListener('pointerdown', (e) => {
  const item = e.target.closest?.('.dash.edit .dash-item.editing');
  if (!item || e.button !== 0 || e.target.closest('button, input, a, select, textarea')) return;
  e.preventDefault();
  const r = item.getBoundingClientRect();
  drag = { item, id: item.dataset.card, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, started: false };
});
document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (!drag.started && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) >= 6) startDrag();
});
document.addEventListener('pointerup', () => finishDrag(false));
document.addEventListener('pointercancel', () => finishDrag(true));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drag?.started) finishDrag(true); });

/* ================= Aktionen und Takt ================= */

function dashAction(a, el) {
  switch (a) {
    case 'dash-edit': ui.dashEdit = true; if (ui.view !== 'today') go('today'); else render('update'); window.scrollTo?.(0, 0); return true;
    case 'dash-done': ui.dashEdit = false; render('update'); return true;
    case 'dash-reset': state.dash = { hidden: [], order: {} }; save(); render('update'); return true;
    case 'dash-toggle': {
      const d = dashState(), id = el.dataset.id;
      d.hidden = d.hidden.includes(id) ? d.hidden.filter((x) => x !== id) : [...d.hidden, id];
      save();
      render('update');
      return true;
    }
    case 'tl-habit': {
      // Zur Zeile in „Heute dran“ springen und sie kurz aufleuchten lassen
      const row = document.querySelector(`.habit-row[data-habit="${el.dataset.id}"]`);
      if (!row) { go('habits'); return true; }
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      row.classList.remove('flash');
      void row.offsetWidth;
      row.classList.add('flash');
      return true;
    }
  }
  return false;
}

// Alle 30 Sekunden: Jetzt-Markierung und Countdowns weiterrücken, bei Bedarf die Seite neu aufbauen
let dashHour = new Date().getHours();
setInterval(() => {
  if (ui.view !== 'today' || ui.modal || ui.dashEdit) return;
  const now = Date.now();
  const tl = document.querySelector('.timeline');
  if (tl) {
    const first = Number(tl.dataset.first);
    const min = (now - dayStart(todayKey())) / 60000;
    const el = tl.querySelector('.tl-now');
    if (el) el.style.left = `${clamp01((min - first * 60) / ((24 - first) * 60)) * 100}%`;
  }
  let stale = false;
  document.querySelectorAll('[data-until]').forEach((el) => { const ms = Number(el.dataset.until) - now; if (ms <= 0) stale = true; else el.textContent = untilText(ms); });
  document.querySelectorAll('[data-left]').forEach((el) => { const ms = Number(el.dataset.left) - now; if (ms <= 0) stale = true; else el.textContent = leftText(ms); });
  const h = new Date().getHours();
  if (h !== dashHour) { dashHour = h; stale = true; } // z. B. ab 18 Uhr der Serien-Hinweis
  if (stale && !quickFocused()) render('update');
}, 30000);
