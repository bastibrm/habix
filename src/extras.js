'use strict';

/* Erweiterungen zu app.js: Meilensteine, Tagebuch, Wochenrückblick,
   Erinnerungen, Einstellungen, Datensicherung, Taskleisten-Symbol und Programmstart. */

/* ================= Meilensteine ================= */

const earnedFor = (h) => state.badges[h.id] || {};

function checkBadges(h, celebrate = true) {
  const best = bestStreak(h);
  const got = { ...earnedFor(h) };
  const fresh = MILESTONES.filter((m) => best >= m.days && !got[m.days]);
  if (!fresh.length) return;
  for (const m of fresh) got[m.days] = todayKey();
  state.badges[h.id] = got;
  save();
  if (celebrate) celebrateBadge(h, fresh[fresh.length - 1]);
}

function syncBadges(celebrate) {
  for (const h of state.habits) checkBadges(h, celebrate);
}

function badgeMedal(m, earned) {
  return `<span class="medal ${earned ? 'earned' : 'locked'}" style="--m:${m.color}" title="${m.days} Tage · ${m.name}${earned ? '' : ' (noch offen)'}">${icon(earned ? 'award' : 'lock')}<b>${m.days}</b></span>`;
}

function badgeMini(h) {
  const got = earnedFor(h);
  const top = [...MILESTONES].reverse().find((m) => got[m.days]);
  return top ? `<span class="badge-mini" style="--m:${top.color}" title="Abzeichen: ${top.name}">${icon('award')}${top.days}</span>` : '';
}

function milestonesCard() {
  const hs = active();
  if (!hs.length) return '';
  return `
  <article class="card s12 fade-in">
    <div class="card-head"><div><h2>Meilensteine</h2><div class="sub">Abzeichen für deine längste Serie: 7, 30 und 66 Tage, dazu 100 und 365 für die Ausdauernden.</div></div></div>
    <div class="ms-list">
      ${hs.map((h) => {
        const got = earnedFor(h);
        const cur = streak(h), best = bestStreak(h);
        const next = MILESTONES.find((m) => !got[m.days]);
        const left = next ? next.days - cur : 0;
        return `
        <div class="ms-row" style="--c:${h.color}">
          ${habitIcon(h)}
          <div class="ms-info">
            <div class="habit-name" style="font-size:14px">${esc(h.name)}</div>
            <div class="habit-meta"><span>${icon('flame')}Serie ${num(cur)}</span><span>${icon('trophy')}Rekord ${num(best)}</span></div>
            ${next
              ? `<div class="ms-next"><div class="rate-bar"><span data-anim="w" style="width:${Math.min(100, (cur / next.days) * 100)}%"></span></div><span>noch ${left} ${left === 1 ? 'Tag' : 'Tage'} bis ${next.days}</span></div>`
              : '<div class="ms-next done">Alle Abzeichen geholt</div>'}
          </div>
          <div class="medals">${MILESTONES.map((m) => badgeMedal(m, !!got[m.days])).join('')}</div>
        </div>`;
      }).join('')}
    </div>
  </article>`;
}

function celebrateBadge(h, m) {
  openPanel(`
    <div class="celebrate">
      <div class="big-medal" style="--m:${m.color}">${icon('award')}<b>${m.days}</b></div>
      <div class="eyebrow">Neues Abzeichen</div>
      <h2 class="panel-title">${m.name}</h2>
      <p>${esc(h.name)}: ${m.days} Tage in Folge geschafft.
        ${m.days === 66 ? 'Ab hier läuft eine Gewohnheit bei den meisten fast von allein.' : 'Bleib dran, das nächste Abzeichen wartet schon.'}</p>
      <button class="btn primary" data-action="close-modal">Weiter so</button>
    </div>`, 'narrow');
  confetti();
  if (document.hidden) notify(`Neues Abzeichen: ${m.name}`, `${h.name}: ${m.days} Tage in Folge.`);
}

function confetti() {
  if (reduceMotion) return;
  const colors = ['var(--cyan)', 'var(--violet)', 'var(--sun)', 'var(--good)', 'var(--bad)'];
  const cx = innerWidth / 2, cy = innerHeight / 2 - 60;
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('span');
    p.className = 'spark confetti';
    const a = Math.random() * Math.PI * 2;
    const d = 120 + Math.random() * 260;
    p.style.cssText = `left:${cx}px;top:${cy}px;--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d + 120}px;background:${colors[i % colors.length]};animation-duration:${1 + Math.random() * 0.8}s`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2000);
  }
}

/* ================= Panels (Rückblick, Abzeichen) ================= */

function openPanel(html, cls = '') {
  const el = document.getElementById('modal');
  ui.modal = null;
  ui.panel = true;
  el.classList.remove('closing');
  el.hidden = false;
  el.innerHTML = `<div class="modal enter ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  lucide.createIcons();
  runAnimations(el, 'enter', 'panel');
  applyProgress(el);
}

/* ================= Stimmung und Notiz ================= */

function journalCard(k) {
  const j = state.journal[k] || {};
  return `
  <article class="card fade-in journal">
    <div class="card-head"><div><h2>Wie geht's dir heute?</h2><div class="sub">Stimmung und eine kurze Notiz</div></div></div>
    <div class="moods">
      ${MOODS.map((m) => `<button class="mood mood-${m.v} ${j.mood === m.v ? 'on' : ''}" data-action="mood" data-mood="${m.v}" data-day="${k}" title="${m.label}" aria-pressed="${j.mood === m.v}">${icon(m.icon)}<span>${m.label}</span></button>`).join('')}
    </div>
    <textarea class="input note" id="journal-note" data-day="${k}" rows="2" maxlength="600" placeholder="Was war heute los? (optional)">${esc(j.note || '')}</textarea>
  </article>`;
}

function setJournal(k, patch) {
  const j = { ...(state.journal[k] || {}), ...patch };
  delete j.demo;
  if (!j.mood) delete j.mood;
  if (!j.note) delete j.note;
  if (Object.keys(j).length) state.journal[k] = j; else delete state.journal[k];
  save();
}

let noteTimer = null, notePending = null;
function flushNote() {
  clearTimeout(noteTimer);
  if (notePending) { setJournal(notePending.k, { note: notePending.v.trim() ? notePending.v : '' }); notePending = null; }
}
document.addEventListener('input', (e) => {
  if (e.target.id !== 'journal-note') return;
  notePending = { k: e.target.dataset.day, v: e.target.value };
  clearTimeout(noteTimer);
  noteTimer = setTimeout(flushNote, 400);
});

function moodPill(d) {
  const v = Math.round(d * 10) / 10;
  if (Math.abs(v) < 0.2) return `<span class="delta flat">${icon('minus')}kaum</span>`;
  return v > 0 ? `<span class="delta up">${icon('trending-up')}+${fmtNum(v)}</span>` : `<span class="delta down">${icon('trending-down')}${fmtNum(v)}</span>`;
}

function moodSection(days) {
  const today = todayKey();
  const keys = range(addDays(today, -(days - 1)), today);
  const vals = keys.map((k) => state.journal[k]?.mood ?? null);
  const logged = vals.filter((v) => v !== null);
  if (!logged.length) {
    return `
    <article class="card s12 fade-in">
      <div class="card-head"><div><h2>Stimmung</h2><div class="sub">Trag auf der Heute-Seite ein, wie es dir geht. Nach ein paar Tagen siehst du hier, was dir guttut.</div></div>
      <div class="icon-btn">${icon('smile')}</div></div>
    </article>`;
  }
  const avg = logged.reduce((a, b) => a + b, 0) / logged.length;

  // Ø Stimmung an Tagen mit und ohne erledigte Gewohnheit, letzte 90 Tage
  const k90 = range(addDays(today, -89), addDays(today, -1));
  const effects = active().map((h) => {
    const yes = [], no = [];
    for (const k of k90) {
      const m = state.journal[k]?.mood;
      if (!m || !scheduled(h, k)) continue;
      (done(h, k) ? yes : no).push(m);
    }
    if (yes.length < 3 || no.length < 3) return null;
    const ma = yes.reduce((a, b) => a + b, 0) / yes.length, mb = no.reduce((a, b) => a + b, 0) / no.length;
    return { h, ma, mb, d: ma - mb };
  }).filter(Boolean).sort((a, b) => b.d - a.d);

  return `
  <article class="card s7 fade-in">
    <div class="card-head">
      <div><h2>Stimmung</h2><div class="sub">Dein Tagesgefühl, letzte ${days} Tage</div></div>
      <div class="mood-avg mood-${Math.round(avg)}">${icon(MOODS[Math.round(avg) - 1].icon)}Ø <b>${fmtNum(Math.round(avg * 10) / 10)}</b></div>
    </div>
    ${lineChart({
      series: vals.map((v) => (v === null ? null : (v - 1) / 4)), labels: keys.map(fmtShort), w: 700, h: 150,
      tickEvery: days <= 7 ? 1 : days <= 30 ? 5 : 15, fmtY: (g) => ['Mies', 'Okay', 'Super'][g * 2], fmtTip: (v) => MOODS[Math.round(v * 4)].label,
    })}
  </article>
  <article class="card s5 fade-in">
    <div class="card-head"><div><h2>Was dir guttut</h2><div class="sub">Ø Stimmung an Tagen mit und ohne die Gewohnheit, letzte 90 Tage</div></div></div>
    ${effects.length ? `<div class="trend-list">${effects.map((e) => `
      <div class="trend-item effect" style="--c:${e.h.color}">
        ${habitIcon(e.h)}
        <div style="min-width:0"><div class="habit-name" style="font-size:14px">${esc(e.h.name)}</div><div class="sub" style="margin:0">mit ${fmtNum(e.ma.toFixed(1))} · ohne ${fmtNum(e.mb.toFixed(1))}</div></div>
        ${moodPill(e.d)}
      </div>`).join('')}</div>`
      : '<div class="muted">Noch zu wenig Daten. Pro Gewohnheit braucht es mindestens 3 Tage mit und 3 Tage ohne, an denen du die Stimmung eingetragen hast.</div>'}
  </article>`;
}

/* ================= Wochenrückblick ================= */

// Sonntag ab 18 Uhr die laufende Woche, sonst die letzte abgeschlossene
function reviewWeekStart() {
  const t = todayKey();
  const mon = mondayOf(t);
  return wdOf(t) === 6 && new Date().getHours() >= 18 ? mon : addDays(mon, -7);
}

function maybeShowReview() {
  if (!state.settings.weeklyReview || ui.modal || ui.panel || !active().length) return;
  const ws = reviewWeekStart();
  if (state.lastReview && state.lastReview >= ws) return;
  const first = !state.lastReview;
  state.lastReview = ws;
  save();
  if (first && !state.demo) return; // beim allerersten Start noch nichts zeigen
  openReview(ws);
  if (document.hidden) notify('Dein Wochenrückblick ist da', 'Schau dir an, wie deine Woche gelaufen ist.');
}

function openReview(ws = reviewWeekStart()) {
  const we = addDays(ws, 6);
  const today = todayKey();
  const to = we < today ? we : today;
  const cur = periodRate(ws, to);
  const prev = periodRate(addDays(ws, -7), addDays(ws, -1));
  const delta = cur.rate !== null && prev.rate !== null ? (cur.rate - prev.rate) * 100 : null;
  const perfect = range(ws, to).filter((k) => dayRate(k) === 1).length;
  const rates = active().map((h) => ({ h, r: habitRate(h, ws, to) })).filter((x) => x.r !== null).sort((a, b) => b.r - a.r);
  const best = rates[0], worst = rates.length > 1 ? rates[rates.length - 1] : null;
  const worked = workedMs(dayStart(ws), dayStart(addDays(ws, 7))) / 60000;
  const planned = range(ws, we).reduce((t, k) => t + (state.plan[k] || []).length * 30, 0);
  const moods = range(ws, to).map((k) => state.journal[k]?.mood).filter(Boolean);
  const avgMood = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const newBadges = [];
  for (const h of state.habits) {
    for (const [d, date] of Object.entries(state.badges[h.id] || {})) {
      if (date >= ws && date <= we) newBadges.push({ h, m: MILESTONES.find((m) => m.days === Number(d)) });
    }
  }

  openPanel(`
    <div class="card-head">
      <div><div class="eyebrow">KW ${isoWeek(ws)} · ${fmtShort(ws)} bis ${fmtShort(we)}</div><h2 class="panel-title">Dein Wochenrückblick</h2></div>
      <button class="icon-btn" data-action="close-modal" aria-label="Schließen">${icon('x')}</button>
    </div>
    <div class="review-hero">
      ${ring(cur.rate)}
      <div>
        <div class="sub" style="margin:0 0 4px">Gewohnheiten erledigt</div>
        <div class="review-delta">${deltaPill(delta)}<span class="sub" style="margin:0">gegenüber der Vorwoche (${pct(prev.rate)})</span></div>
      </div>
    </div>
    <div class="review-grid">
      <div class="rv"><span class="rv-l">${icon('flame')}Perfekte Tage</span><b>${num(perfect)}</b><small>von ${range(ws, to).length}</small></div>
      ${state.workEnabled ? `<div class="rv"><span class="rv-l">${icon('briefcase')}Gearbeitet</span><b>${hm(worked)} h</b><small>${planned ? `von ${fmtMin(planned)} h geplant` : 'nichts geplant'}</small></div>` : `<div class="rv"><span class="rv-l">${icon('list-todo')}Aufgaben</span><b>${num(state.tasks.filter((t) => t.done && t.doneAt >= dayStart(ws) && t.doneAt < dayStart(addDays(ws, 7))).length)}</b><small>erledigt</small></div>`}
      <div class="rv"><span class="rv-l">${icon('smile')}Stimmung</span><b>${avgMood ? fmtNum(Math.round(avgMood * 10) / 10) : '–'}</b><small>${avgMood ? MOODS[Math.round(avgMood) - 1].label : 'nicht eingetragen'}</small></div>
    </div>
    ${best ? `
    <div class="review-list">
      <div class="rl-row">${habitIcon(best.h)}<div><div class="sub" style="margin:0">Am stärksten</div><b>${esc(best.h.name)}</b></div><span class="delta up">${pct(best.r)}</span></div>
      ${worst && worst.h !== best.h ? `<div class="rl-row">${habitIcon(worst.h)}<div><div class="sub" style="margin:0">Mehr Luft nach oben</div><b>${esc(worst.h.name)}</b></div><span class="delta down">${pct(worst.r)}</span></div>` : ''}
    </div>` : ''}
    ${newBadges.length ? `<div class="review-badges"><div class="sub" style="margin:0">Neue Abzeichen diese Woche</div><div class="medals">${newBadges.map((b) => badgeMedal(b.m, true)).join('')}</div></div>` : ''}
    <div class="modal-foot"><div class="right"><button class="btn primary" data-action="close-modal">Auf in die neue Woche</button></div></div>`, 'wide');
}

/* ================= Erinnerungen ================= */

function notify(title, body) {
  try {
    if (!('Notification' in window)) return;
    const n = new Notification(tr(title), { body: tr(body) });
    n.onclick = () => window.api?.showWindow();
  } catch { /* Benachrichtigungen nicht verfügbar */ }
}

function checkReminders() {
  const s = state.settings;
  const now = new Date();
  const t = now.getTime();
  const today = todayKey();
  if (state.notified?.day !== today) state.notified = { day: today, keys: [] };
  const keys = state.notified.keys;
  const mark = (k) => { keys.push(k); save(); };

  if (s.remindHabits && !keys.includes('habits')) {
    const [hh, mm] = String(s.remindHabitsAt || '20:00').split(':').map(Number);
    if (now.getHours() * 60 + now.getMinutes() >= hh * 60 + mm) {
      const open = active().filter((h) => scheduled(h, today) && !done(h, today));
      if (open.length) {
        notify(`Noch ${open.length} ${open.length === 1 ? 'Gewohnheit' : 'Gewohnheiten'} offen`,
          open.slice(0, 4).map((h) => h.name).join(', ') + (open.length > 4 ? ' …' : ''));
      }
      mark('habits');
    }
  }

  if (s.remindEvents) {
    for (const i of instancesBetween(today, addDays(today, 1))) {
      if (i.allDay || i.ev.shift || i.ev.done) continue;
      const lead = i.ev.remind ?? (i.ev.task ? 0 : s.remindEventsMin);
      if (i.ev.remind === 0 && !i.ev.task) continue;
      const key = `ev:${i.ev.id}:${i.startMs}`;
      if (t >= i.startMs - lead * 60000 && t < i.startMs + 60000 && !keys.includes(key)) {
        const mins = Math.round((i.startMs - t) / 60000);
        if (i.ev.task) notify(`Aufgabe fällig: ${i.ev.title}`, `Um ${hhmm(i.startMs)} Uhr`);
        else notify(mins > 0 ? `In ${mins} Minuten: ${i.ev.title}` : `Jetzt: ${i.ev.title}`, `${hhmm(i.startMs)} – ${hhmm(i.endMs)} Uhr${i.ev.location ? ` · ${i.ev.location}` : ''}`);
        mark(key);
      }
    }
  }

  const plan = new Set(state.plan[today] || []);
  const session = activeSession();
  for (const i of state.workEnabled ? plan : []) {
    if (!plan.has(i - 1)) {
      const st = slotStart(today, i);
      if (s.remindShift && !session && t >= st - s.remindShiftMin * 60000 && t < st + 10 * 60000 && !keys.includes(`start${i}`)) {
        const mins = Math.round((st - t) / 60000);
        notify(mins > 0 ? `Schicht beginnt in ${mins} Minuten` : 'Deine Schicht beginnt jetzt', `Ab ${slotTime(i)} Uhr. Einstempeln nicht vergessen.`);
        mark(`start${i}`);
      }
    }
    if (!plan.has(i + 1)) {
      const en = slotStart(today, i) + SLOT_MS;
      if (s.remindClockOut && session && t >= en + 15 * 60000 && t < en + 3 * 3600000 && !keys.includes(`end${i}`)) {
        notify('Schicht vorbei', `Deine Schicht ging bis ${slotTime(i + 1)} Uhr. Ausstempeln nicht vergessen.`);
        mark(`end${i}`);
      }
    }
  }
}

/* ================= Taskleisten-Symbol ================= */

let lastTray = '';
function syncTray() {
  if (!window.api?.trayStatus) return;
  const s = activeSession();
  const br = s?.breaks?.find((b) => !b.end);
  const today = todayKey();
  const st = {
    work: !!state.workEnabled, clocked: !!s, paused: !!br, since: s ? timeOf(s.start) : null,
    today: fmtMin(workedMs(dayStart(today), dayStart(addDays(today, 1))) / 60000),
    open: active().filter((h) => scheduled(h, today) && !done(h, today)).length,
  };
  const key = JSON.stringify(st);
  if (key === lastTray) return;
  lastTray = key;
  window.api.trayStatus(st);
}

window.api?.onTrayAction?.((a) => {
  if (a === 'clock') clockToggle();
  if (a === 'pause') pauseToggle();
});

/* ================= Einstellungen ================= */

function applySettings() {
  window.api?.applySettings?.({ closeToTray: !!state.settings.closeToTray, autostart: !!state.settings.autostart, lang: state.settings.lang || 'de' });
}

function viewSettings() {
  const s = state.settings;
  const desktop = !!window.api;
  const sw = (key, label, sub) => `
    <label class="setting" for="set-${key}">
      <div><b>${label}</b>${sub ? `<span>${sub}</span>` : ''}</div>
      <input type="checkbox" class="switch" data-setting="${key}" id="set-${key}" ${s[key] ? 'checked' : ''}>
    </label>`;
  return `
  <header class="head fade-in"><div><div class="eyebrow">Tageswerk</div><h1>Einstellungen</h1></div></header>
  <section class="settings-cols">
   <div class="settings-col">
    <article class="card s12 fade-in">
      <div class="card-head"><div><h2>Darstellung</h2><div class="sub">Hell, dunkel oder automatisch wie in Windows eingestellt</div></div><div class="icon-btn">${icon('palette')}</div></div>
      <div class="theme-options" role="radiogroup" aria-label="Darstellung">
        ${[['light', 'Hell', 'sun-medium'], ['system', 'Wie Windows', 'monitor'], ['dark', 'Dunkel', 'moon']].map(([mode, label, ic]) => `
        <button class="theme-option ${(state.theme || 'system') === mode ? 'on' : ''}" data-theme-mode="${mode}" role="radio" aria-checked="${(state.theme || 'system') === mode}">
          <span class="theme-preview tp-${mode}" aria-hidden="true"><span class="tp-side"></span><span class="tp-main"><i></i><i></i><i></i></span></span>
          <span class="theme-label">${icon(ic)}${label}</span>
        </button>`).join('')}
      </div>
      <div class="setting" style="margin-top:6px">
        <div><b>Sprache</b><span>Language</span></div>
        <div class="segmented">
          <button class="${(state.settings.lang || 'de') === 'de' ? 'on' : ''}" data-action="onb-lang" data-lang="de">Deutsch</button>
          <button class="${state.settings.lang === 'en' ? 'on' : ''}" data-action="onb-lang" data-lang="en">English</button>
        </div>
      </div>
      <label class="setting" for="set-work">
        <div><b>Bereich Arbeit</b><span>Stundenplan, Ein- und Ausstempeln mit Pausen und Schicht-Erinnerungen</span></div>
        <input type="checkbox" class="switch" id="set-work" data-action="work-toggle" ${state.workEnabled ? 'checked' : ''}>
      </label>
    </article>
    <article class="card s6 fade-in">
      <div class="card-head"><div><h2>Datensicherung</h2><div class="sub">${state.lastBackup ? `Letzte automatische Sicherung: ${esc(fmtShort(state.lastBackup))}` : 'Jede Woche wird automatisch eine Sicherung angelegt'}</div></div><div class="icon-btn">${icon('shield-check')}</div></div>
      ${desktop ? `
      <div class="btn-row">
        <button class="btn" data-action="backup-export">${icon('download')}Backup speichern</button>
        <button class="btn" data-action="backup-import">${icon('upload')}Wiederherstellen</button>
        <button class="btn ghost" data-action="backup-folder">${icon('folder-open')}Automatische Sicherungen</button>
      </div>
      ${ui.pendingImport ? `
      <div class="confirm-box">
        <span>Backup „${esc(ui.pendingImport.name)}“ laden? Alles, was gerade in der App ist, wird dadurch ersetzt.</span>
        <div class="btn-row"><button class="btn small danger" data-action="import-yes">Ja, laden</button><button class="btn small ghost" data-action="import-no">Abbrechen</button></div>
      </div>` : ''}
      <div class="setting-note">${icon('info')}<span>Für einen neuen PC: hier ein Backup speichern, die Datei rüberkopieren und dort mit „Wiederherstellen“ laden.</span></div>`
      : '<div class="muted">Nur in der Desktop-App verfügbar.</div>'}
    </article>
    <article class="card s12 fade-in">
      <div class="card-head"><div><h2>Daten</h2><div class="sub">Alles bleibt lokal auf diesem PC.</div></div></div>
      <div class="btn-row">
        ${desktop ? `<button class="btn small ghost" data-action="reveal">${icon('folder')}Speicherort öffnen</button>` : ''}
        ${!active().length && !state.demo ? `<button class="btn small" data-action="demo">${icon('sparkles')}Beispieldaten laden</button>` : ''}
        ${state.demo ? `<button class="btn small" data-action="clear-demo">${icon('rotate-ccw')}Beispieldaten löschen</button>` : ''}
        ${ui.confirmReset
          ? `<span class="error">Wirklich alles löschen? Gewohnheiten, Stundenplan, Stempelzeiten und Tagebuch.</span>
             <button class="btn small danger" data-action="reset-yes">Ja, alles löschen</button>
             <button class="btn small ghost" data-action="reset-no">Abbrechen</button>`
          : `<button class="btn small danger" data-action="reset">${icon('trash-2')}Alles zurücksetzen</button>`}
      </div>
    </article>
   </div>
   <div class="settings-col">
    <article class="card s6 fade-in">
      <div class="card-head"><div><h2>Erinnerungen</h2><div class="sub">Windows-Benachrichtigungen, auch wenn die App im Hintergrund läuft</div></div><div class="icon-btn">${icon('bell')}</div></div>
      <div class="settings-list">
        ${sw('remindHabits', 'Offene Gewohnheiten', 'Abends erinnern, wenn noch etwas offen ist')}
        <label class="setting sub-setting ${s.remindHabits ? '' : 'off'}" for="set-remindHabitsAt"><div><b>Uhrzeit</b></div><input type="time" class="input small-input" data-setting="remindHabitsAt" id="set-remindHabitsAt" value="${esc(s.remindHabitsAt)}"></label>
        ${sw('remindShift', 'Schichtbeginn', 'Erinnern, wenn du noch nicht eingestempelt bist')}
        <label class="setting sub-setting ${s.remindShift ? '' : 'off'}" for="set-remindShiftMin"><div><b>Minuten vorher</b></div><input type="number" min="0" max="120" step="5" class="input small-input" data-setting="remindShiftMin" id="set-remindShiftMin" value="${s.remindShiftMin}"></label>
        ${sw('remindEvents', 'Termine und Aufgaben', 'Vor Terminen erinnern, Aufgaben mit Uhrzeit zur fälligen Zeit')}
        <label class="setting sub-setting ${s.remindEvents ? '' : 'off'}" for="set-remindEventsMin"><div><b>Minuten vor Terminen</b></div><input type="number" min="0" max="1440" step="5" class="input small-input" data-setting="remindEventsMin" id="set-remindEventsMin" value="${s.remindEventsMin}"></label>
        ${sw('remindClockOut', 'Ausstempeln vergessen', '15 Minuten nach Schichtende erinnern')}
        ${sw('weeklyReview', 'Wochenrückblick', 'Sonntags ab 18 Uhr automatisch zeigen')}
      </div>
      <button class="btn small" data-action="test-notify" style="align-self:flex-start">${icon('bell-ring')}Test-Benachrichtigung</button>
    </article>
    ${homeSettingsCard()}
   </div>
   <div class="settings-col">
    ${timezoneCard()}
    <article class="card s6 fade-in">
      <div class="card-head"><div><h2>Start und Taskleiste</h2><div class="sub">Stempeln über das Symbol unten rechts, ohne das Fenster zu öffnen</div></div><div class="icon-btn">${icon('monitor')}</div></div>
      ${desktop ? `<div class="settings-list">
        ${sw('autostart', 'Mit Windows starten', 'Startet unsichtbar im Hintergrund, das Symbol erscheint unten rechts')}
        ${sw('closeToTray', 'Beim Schließen weiterlaufen', 'Das X versteckt die App nur. Beenden geht über das Symbol unten rechts.')}
      </div>
      <div class="setting-note">${icon('info')}<span>Ein Klick auf das Symbol unten rechts öffnet Tageswerk, ein Rechtsklick zeigt Einstempeln, Pause und Ausstempeln.</span></div>`
      : '<div class="muted">Nur in der Desktop-App verfügbar.</div>'}
    </article>
    ${updatesCard()}
   </div>
  </section>`;
}

document.addEventListener('change', (e) => {
  const t = e.target;
  if (!t.matches('[data-setting]')) return;
  const key = t.dataset.setting;
  let v = t.value;
  if (t.type === 'checkbox') v = t.checked;
  if (t.type === 'number') v = Math.min(Number(t.max) || 999, Math.max(Number(t.min) || 0, Math.round(Number(t.value) || 0)));
  if (t.type === 'time' && !v) v = DEFAULT_SETTINGS[key];
  state.settings[key] = v;
  save();
  applySettings();
  if (t.type === 'checkbox' || key === 'timeZone') render('update');
  else toast('Gespeichert');
});

/* ================= Bereich Arbeit freischalten ================= */

function openWorkUnlock() {
  openPanel(`
    <div class="unlock">
      <div class="unlock-icon">${icon('briefcase')}<span class="unlock-lock">${icon('lock')}</span></div>
      <div class="eyebrow">Bereich Arbeit</div>
      <h2 class="panel-title">Arbeitszeit aktivieren?</h2>
      <p>Für alle, die Schichten planen und ihre Arbeitszeit erfassen wollen. Wenn du das nicht brauchst, bleibt der Bereich einfach aus.</p>
      <ul class="unlock-list">
        <li>${icon('calendar-clock')}<div><b>Stundenplan</b><span>Deine Woche in halben Stunden planen</span></div></li>
        <li>${icon('timer')}<div><b>Ein- und Ausstempeln</b><span>Oben rechts und über das Symbol in der Taskleiste, mit Pausen</span></div></li>
        <li>${icon('bell')}<div><b>Erinnerungen</b><span>Vor Schichtbeginn und wenn du das Ausstempeln vergisst</span></div></li>
        <li>${icon('chart-column')}<div><b>Auswertung</b><span>Grün heißt gearbeitet, rot heißt verpasst, dazu deine Bilanz</span></div></li>
      </ul>
      <div class="btn-row unlock-actions">
        <button class="btn ghost" data-action="close-modal">Nicht jetzt</button>
        <button class="btn primary" data-action="work-enable">${icon('lock-open')}Bereich aktivieren</button>
      </div>
    </div>`, 'narrow');
}

function workAction(a, el) {
  switch (a) {
    case 'work-enable':
      state.workEnabled = true;
      save();
      closeModal();
      renderSidebar();
      confetti();
      toast('Bereich Arbeit ist aktiv. Oben rechts kannst du dich jetzt einstempeln.');
      setTimeout(() => go('schedule'), 250);
      return true;
    case 'work-toggle':
      if (!el.checked && activeSession()) {
        el.checked = true;
        toast('Bitte erst ausstempeln, dann lässt sich der Bereich abschalten.');
        return true;
      }
      state.workEnabled = el.checked;
      save();
      renderSidebar();
      toast(el.checked ? 'Bereich Arbeit ist aktiv' : 'Bereich Arbeit ist aus. Deine Daten bleiben gespeichert.');
      return true;
  }
  return false;
}

/* ================= Zeitzone ================= */

let zoneList = null;
function zoneOptions(chosen) {
  if (!zoneList) {
    const zones = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : [];
    const now = new Date();
    zoneList = zones.map((z) => {
      let off = '';
      try {
        off = new Intl.DateTimeFormat('en-US', { timeZone: z, timeZoneName: 'shortOffset' }).formatToParts(now).find((x) => x.type === 'timeZoneName').value.replace('GMT', 'UTC');
      } catch { /* unbekannte Zone */ }
      return { z, label: `${z.replace(/_/g, ' ')} (${off === 'UTC' ? 'UTC±0' : off})` };
    });
  }
  return zoneList.map((o) => `<option value="${o.z}" ${o.z === chosen ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
}

function timezoneCard() {
  const tz = ui.tz;
  const chosen = state.settings.timeZone || 'system';
  const shown = chosen === 'system' ? tz?.system : chosen;
  let nowText = '';
  try { nowText = new Intl.DateTimeFormat(LOCALE(), { timeZone: shown || undefined, hour: '2-digit', minute: '2-digit' }).format(new Date()); } catch { /* ignorieren */ }
  const pending = !!window.api && chosen !== (tz?.setting ?? 'system');
  return `
    <article class="card s6 fade-in">
      <div class="card-head"><div><h2>Zeitzone</h2><div class="sub">Bestimmt, wann ein Tag beginnt, und gilt für Stundenplan und Erinnerungen</div></div><div class="icon-btn">${icon('globe')}</div></div>
      <label class="setting" for="set-timeZone">
        <div><b>Zeitzone</b><span>Dort ist es jetzt ${nowText} Uhr</span></div>
        <select class="input tz-select" data-setting="timeZone" id="set-timeZone">
          <option value="system" ${chosen === 'system' ? 'selected' : ''}>Automatisch${tz?.system ? ` (${esc(tz.system.replace(/_/g, ' '))})` : ''}</option>
          ${zoneOptions(chosen)}
        </select>
      </label>
      ${pending ? `
      <div class="confirm-box info">
        <span>Die neue Zeitzone gilt nach einem Neustart der App.</span>
        <div class="btn-row"><button class="btn small primary" data-action="relaunch">${icon('rotate-cw')}Jetzt neu starten</button></div>
      </div>` : ''}
      <div class="setting-note">${icon('info')}<span>Deine Stempelzeiten bleiben auf die Minute genau erhalten. Nur die Anzeige richtet sich nach der Zeitzone.</span></div>
    </article>`;
}

async function relaunchApp() {
  try { await window.api.save(state); } catch { /* wird beim Beenden nochmal gespeichert */ }
  window.api.relaunch();
}

/* ================= Updates ================= */

function updatesCard() {
  const u = ui.update;
  let body;
  if (!window.api || !u) {
    body = '<div class="muted">Nur in der Desktop-App verfügbar.</div>';
  } else if (!u.packaged) {
    body = `<div class="setting-note">${icon('info')}<span>Das ist gerade die Entwickler-Version. Automatische Updates funktionieren in der installierten App: Sie prüft beim Start und alle 6 Stunden, lädt neue Versionen im Hintergrund und installiert sie mit einem Klick.</span></div>`;
  } else if (u.configured === false) {
    body = `<div class="setting-note">${icon('info')}<span>Automatische Updates sind in dieser Version noch nicht eingerichtet.</span></div>`;
  } else {
    const check = `<button class="btn small" data-action="update-check">${icon('refresh-cw')}Nach Updates suchen</button>`;
    body = {
      idle: `<div class="update-row"><span class="update-state">${icon('circle-check')}Automatische Updates sind aktiv.</span>${check}</div>`,
      latest: `<div class="update-row"><span class="update-state ok">${icon('circle-check')}Du hast die neueste Version.</span>${check}</div>`,
      checking: `<div class="update-row"><span class="update-state"><span class="spinner"></span>Suche nach Updates …</span></div>`,
      downloading: `<div class="update-row"><span class="update-state">${icon('download')}Version ${esc(u.version || '')} wird geladen</span><span class="num muted">${u.progress || 0}%</span></div>
        <div class="meter"><span style="width:${u.progress || 0}%"></span></div>`,
      ready: `<div class="update-row"><span class="update-state ok">${icon('gift')}Version ${esc(u.version || '')} ist bereit.</span>
        <button class="btn primary" data-action="update-install">${icon('rotate-cw')}Jetzt neu starten und aktualisieren</button></div>
        <div class="sub" style="margin:0">Sonst wird das Update automatisch installiert, wenn du die App das nächste Mal beendest.</div>`,
      error: `<div class="update-row"><span class="update-state bad">${icon('triangle-alert')}Die Suche nach Updates hat nicht geklappt. Prüf deine Internetverbindung.</span>${check}</div>`,
    }[u.status] || '';
  }
  return `
    <article class="card s12 fade-in">
      <div class="card-head"><div><h2>Updates</h2><div class="sub">${u?.current ? `Installierte Version: ${esc(u.current)}` : 'Neue Versionen kommen automatisch'}</div></div><div class="icon-btn">${icon('refresh-cw')}</div></div>
      ${body}
    </article>`;
}

function updateNavDot() {
  document.getElementById('nav-settings')?.classList.toggle('has-dot', ui.update?.status === 'ready');
}

window.api?.onUpdate?.((s) => {
  const was = ui.update?.status;
  ui.update = { ...(ui.update || {}), ...s };
  if (s.status === 'ready' && was !== 'ready') toast(`Update ${s.version} ist bereit. In den Einstellungen mit einem Klick installieren.`);
  updateNavDot();
  if (ui.view === 'settings' && !ui.modal) render('update');
});

/* ================= Datensicherung ================= */

async function backupExport() {
  try {
    const r = await window.api.backupExport(state);
    if (r?.ok) toast('Backup gespeichert');
  } catch { toast('Das Backup konnte nicht gespeichert werden.'); }
}

async function backupImport() {
  try {
    const r = await window.api.backupImport();
    if (!r) return;
    if (r.error || !r.data || !Array.isArray(r.data.habits)) { toast('Diese Datei ist kein Tageswerk-Backup.'); return; }
    ui.pendingImport = r;
    render('update');
  } catch { toast('Die Datei konnte nicht gelesen werden.'); }
}

function importConfirmed() {
  const d = ui.pendingImport.data;
  ui.pendingImport = null;
  state = { ...emptyState(), ...d, settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) } };
  save();
  markTheme(state.theme || 'system');
  window.api?.setTheme(state.theme || 'system');
  applySettings();
  toast('Backup geladen');
  render('enter');
}

async function autoBackup() {
  if (!window.api?.backupAuto) return;
  const t = todayKey();
  if (state.lastBackup && addDays(state.lastBackup, 7) > t) return;
  if (!state.habits.length && !state.sessions.length) return;
  state.lastBackup = t;
  try { await window.api.backupAuto(state); save(); } catch { state.lastBackup = null; }
}

/* ================= Aktionen ================= */

function extrasAction(a, el) {
  switch (a) {
    case 'mood': {
      flushNote();
      const k = el.dataset.day, v = Number(el.dataset.mood);
      const hadMood = !!state.journal[k]?.mood;
      setJournal(k, { mood: state.journal[k]?.mood === v ? null : v });
      if (!hadMood) xpPop(el, XP.mood);
      render('update');
      document.querySelector(`.mood.mood-${v}.on`)?.classList.add('just');
      break;
    }
    case 'review': openReview(); break;
    case 'test-notify':
      notify('So sehen deine Erinnerungen aus', 'Tageswerk meldet sich hier, auch wenn das Fenster zu ist.');
      break;
    case 'backup-export': backupExport(); break;
    case 'backup-import': backupImport(); break;
    case 'backup-folder': window.api?.backupFolder(); break;
    case 'import-yes': importConfirmed(); break;
    case 'import-no': ui.pendingImport = null; render('update'); break;
    case 'relaunch': relaunchApp(); break;
    case 'update-check': ui.update = { ...ui.update, status: 'checking' }; render('update'); window.api?.updateCheck(); break;
    case 'update-install': window.api?.updateInstall(); break;
    default: if (!calendarAction(a, el) && !taskAction(a, el) && !onboardingAction(a, el) && !financeAction(a, el) && !levelAction(a, el) && !dashAction(a, el)) workAction(a, el);
  }
}

/* ================= Start ================= */

load().then(async () => {
  if (!state.workEnabled && (state.sessions.length || Object.keys(state.plan).length)) state.workEnabled = true;
  try { ui.update = await window.api?.updateGet?.(); ui.tz = await window.api?.tzInfo?.(); } catch { /* Browser-Vorschau */ }
  updateNavDot();
  i18nInit();
  checkLevelUp();
  delete state.focus;
  delete state.focusLog;
  delete state.settings.focusWork;
  delete state.settings.focusBreak;
  markTheme(state.theme || 'system');
  window.api?.setTheme(state.theme || 'system');
  applySettings();
  syncBadges(false);
  render('enter');
  setTimeout(() => { maybeOnboarding(); if (state.onboarded) maybeShowReview(); autoBackup(); checkReminders(); syncAllCalendars(); }, 900);
});

setInterval(() => { checkReminders(); maybeShowReview(); }, 30000);
setInterval(syncAllCalendars, 30 * 60 * 1000);
