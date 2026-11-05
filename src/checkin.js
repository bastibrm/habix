'use strict';

/* Morgen-Abfrage: Beim ersten Öffnen an einem neuen Tag fragt Habix in einem Fenster alles ab, was man nach dem Aufstehen
   einträgt: Stimmung, und mit Fitness auch Schlaf, Gewicht und Supplements. Gefragt wird nur, was heute noch fehlt
   und zu einem freigeschalteten Bereich gehört. Darunter steht kurz, was heute ansteht.
   Einmal pro Tag (state.checkinDay), abschaltbar in den Einstellungen. Texte kommen über dt() gleich in der richtigen Sprache. */

// Was heute noch fehlt
function checkinNeeds() {
  const today = todayKey();
  const fitOn = !!state.fitness?.enabled;
  const f = fitOn ? fit() : null;
  return {
    mood: !state.journal[today]?.mood,
    sleep: fitOn && !f.sleep[today],
    weight: fitOn && f.weights[today] == null && (!!f.profile || Object.keys(f.weights).length > 0),
    supps: fitOn && f.supps.length > 0 && f.supps.some((s) => !(f.suppLog[today] || []).includes(s.id)),
  };
}

function maybeCheckin() {
  const today = todayKey();
  if (state.settings.morningCheck === false || !state.onboarded || state.demo || ui.modal || ui.panel || document.hidden) return;
  if (state.checkinDay === today || new Date().getHours() < 4) return;
  const n = checkinNeeds();
  if (!n.mood && !n.sleep && !n.weight && !n.supps) return;
  state.checkinDay = today;
  save();
  openCheckin();
}

function openCheckin() {
  const f = state.fitness?.enabled ? fit() : null;
  const today = todayKey();
  ui.checkin = { mood: state.journal[today]?.mood || 0, h: '', q: 0, kg: '', supps: [...(f?.suppLog[today] || [])], error: '' };
  renderCheckin(true);
}

// Kurzer Überblick über den Tag, nur aus freigeschalteten Bereichen
function checkinDayLines() {
  const today = todayKey();
  const lines = [];
  const due = active().filter((h) => scheduled(h, today));
  if (due.length) lines.push(['list-checks', dt(`${due.length} ${due.length === 1 ? 'Gewohnheit' : 'Gewohnheiten'} stehen an`, `${due.length} ${due.length === 1 ? 'habit' : 'habits'} due`)]);
  const tasks = state.tasks.filter((t) => !t.done && t.due && t.due <= today);
  if (tasks.length) lines.push(['list-todo', dt(`${tasks.length} ${tasks.length === 1 ? 'Aufgabe' : 'Aufgaben'} fällig`, `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} due`)]);
  const ev = typeof instancesBetween === 'function' ? instancesBetween(today, today).length : 0;
  if (ev) lines.push(['calendar-days', dt(`${ev} ${ev === 1 ? 'Termin' : 'Termine'} im Kalender`, `${ev} ${ev === 1 ? 'event' : 'events'} in your calendar`)]);
  if (state.fitness?.enabled) {
    const plans = plannedOn(today);
    if (plans.length) lines.push(['dumbbell', dt(`Training: ${plans.map((p) => p.name).join(', ')}`, `Workout: ${plans.map((p) => p.name).join(', ')}`)]);
    if (fit().fasting.start) lines.push(['hourglass', dt(`Fasten läuft seit ${fmtDur((Date.now() - Date.parse(fit().fasting.start)) / 3600000)} h`, `Fasting for ${fmtDur((Date.now() - Date.parse(fit().fasting.start)) / 3600000)} h`)]);
  }
  if (state.workEnabled) {
    const slots = (state.plan[today] || []).length;
    if (slots) lines.push(['calendar-clock', dt(`${fmtMin(slots * 30)} h Arbeit eingeplant`, `${fmtMin(slots * 30)} h of work planned`)]);
  }
  return lines;
}

function renderCheckin(first = false) {
  const e = ui.checkin;
  const n = checkinNeeds();
  const f = state.fitness?.enabled ? fit() : null;
  const lines = checkinDayLines();
  const moodRow = (action, cur) => `<div class="moods">${MOODS.map((m) => `<button class="mood mood-${m.v} ${cur === m.v ? 'on' : ''}" data-action="${action}" data-v="${m.v}" aria-pressed="${cur === m.v}">${icon(m.icon)}<span>${m.label}</span></button>`).join('')}</div>`;
  const html = `
    <div class="card-head"><div><div class="eyebrow">${esc(fmtLong(todayKey()))}</div><h2 class="panel-title" style="font-size:22px">${greeting()}!</h2>
      <div class="sub">${dt('Kurz eintragen, dann kann der Tag losgehen. Alles ist freiwillig.', 'Log a few things and your day can start. Everything is optional.')}</div></div>
      <button class="icon-btn" data-action="close-modal" aria-label="${dt('Schließen', 'Close')}">${icon('x')}</button></div>
    ${n.mood ? `<div class="ci-sec"><div class="label">${dt('Wie geht\'s dir heute?', 'How are you today?')}</div>${moodRow('ci-mood', e.mood)}</div>` : ''}
    ${n.sleep ? `<div class="ci-sec"><div class="label">${dt('Wie hast du geschlafen?', 'How did you sleep?')}</div>
      <div class="ci-sleep"><input class="input" id="ci-h" data-ci-field="h" value="${esc(e.h)}" placeholder="${dt('Stunden, z. B. 7,5 oder 7:30', 'Hours, e.g. 7.5 or 7:30')}">
        <div class="ci-quick">${[6, 7, 7.5, 8, 9].map((h) => `<button class="btn small ghost ${parseNum(String(e.h)) === h ? 'on' : ''}" data-action="ci-h" data-h="${h}">${fmtNum(h)} h</button>`).join('')}</div></div>
      ${moodRow('ci-q', e.q)}</div>` : ''}
    ${n.weight ? `<div class="ci-sec ci-inline"><div class="label">${dt('Gewicht heute', 'Weight today')} <small>${dt('optional', 'optional')}</small></div>
      <div class="fit-inline"><input class="input small-input" id="ci-kg" data-ci-field="kg" inputmode="decimal" value="${esc(e.kg)}" placeholder="${currentWeight() ? fmtNum(r1(currentWeight())) : dt('z. B. 75,5', 'e.g. 75.5')}"><span class="muted">kg</span></div></div>` : ''}
    ${n.supps ? `<div class="ci-sec"><div class="label">${dt('Supplements schon genommen?', 'Supplements taken?')}</div>
      <div class="fit-supps">${f.supps.map((s) => `<button class="fit-supp ${e.supps.includes(s.id) ? 'on' : ''}" data-action="ci-supp" data-id="${s.id}" aria-pressed="${e.supps.includes(s.id)}">${icon(e.supps.includes(s.id) ? 'check' : 'pill')}<span>${esc(s.name)}</span></button>`).join('')}</div></div>` : ''}
    ${lines.length ? `<div class="ci-day"><div class="label">${dt('Heute steht an', 'Coming up today')}</div>${lines.map(([ic, t]) => `<div class="ci-line">${icon(ic)}<span>${esc(t)}</span></div>`).join('')}</div>` : ''}
    ${e.error ? `<div class="error">${e.error}</div>` : ''}
    <div class="modal-foot"><button class="btn ghost" data-action="close-modal">${dt('Überspringen', 'Skip')}</button>
      <div class="right"><button class="btn primary" data-action="ci-save">${icon('sunrise')}${dt('Tag starten', 'Start the day')}</button></div></div>`;
  if (first) { openPanel(html); return; }
  const m = document.querySelector('#modal .modal');
  if (m) { m.classList.remove('enter'); m.innerHTML = html; lucide.createIcons(); }
}

function saveCheckin() {
  const e = ui.checkin;
  const n = checkinNeeds();
  const today = todayKey();
  // Prüfen, bevor etwas gespeichert wird
  let hours = null, weight = null;
  if (n.sleep && String(e.h).trim()) {
    const t = String(e.h).trim();
    const mm = t.match(/^(\d{1,2})\s*[:h]\s*(\d{1,2})?\s*(?:min)?$/i);
    hours = mm ? Number(mm[1]) + Number(mm[2] || 0) / 60 : parseNum(t);
    if (!(hours >= 1 && hours <= 16)) { e.error = dt('Die Schlafdauer passt nicht. Zum Beispiel 7,5 oder 7:30.', 'The sleep duration does not look right. For example 7.5 or 7:30.'); renderCheckin(); return; }
  }
  if (n.weight && String(e.kg).trim()) {
    weight = parseNum(String(e.kg).replace(/kg/i, ''));
    if (!(weight >= 30 && weight <= 300)) { e.error = dt('Gib dein Gewicht in Kilogramm ein, z. B. 78,5.', 'Enter your weight in kilograms, e.g. 78.5.'); renderCheckin(); return; }
  }
  let count = 0;
  if (n.mood && e.mood) { setJournal(today, { mood: e.mood }); count++; }
  if (state.fitness?.enabled) {
    const f = fit();
    if (hours) { f.sleep[today] = { h: Math.round(hours * 60) / 60, q: e.q || null }; count++; }
    if (weight) { f.weights[today] = r1(weight); count++; }
    if (n.supps) {
      const before = (f.suppLog[today] || []).length;
      if (e.supps.length) f.suppLog[today] = e.supps; else delete f.suppLog[today];
      if (e.supps.length !== before) count++;
    }
  }
  ui.checkin = null;
  save();
  closeModal();
  toast(count ? dt('Eingetragen. Einen guten Start in den Tag!', 'Logged. Have a great start to your day!') : dt('Einen guten Start in den Tag!', 'Have a great start to your day!'));
  render('update');
}

function checkinAction(a, el) {
  const e = ui.checkin;
  switch (a) {
    case 'checkin-open': openCheckin(); return true;
    case 'ci-mood': e.mood = e.mood === Number(el.dataset.v) ? 0 : Number(el.dataset.v); renderCheckin(); return true;
    case 'ci-q': e.q = e.q === Number(el.dataset.v) ? 0 : Number(el.dataset.v); renderCheckin(); return true;
    case 'ci-h': e.h = fmtNum(Number(el.dataset.h)); e.error = ''; renderCheckin(); return true;
    case 'ci-supp': e.supps = e.supps.includes(el.dataset.id) ? e.supps.filter((x) => x !== el.dataset.id) : [...e.supps, el.dataset.id]; renderCheckin(); return true;
    case 'ci-save': saveCheckin(); return true;
  }
  return false;
}

document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.dataset.ciField && ui.checkin) ui.checkin[t.dataset.ciField] = t.value;
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ui.checkin && ev.target.dataset?.ciField) { ev.preventDefault(); saveCheckin(); }
});

// Auch wenn die App über Nacht offen bleibt: beim Zurückkommen am neuen Tag fragen
window.addEventListener('focus', () => setTimeout(maybeCheckin, 600));
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(maybeCheckin, 600); });
