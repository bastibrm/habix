'use strict';

/* Serien schützen: Joker-Tage (ein paar pro Monat) und Pausen für Urlaub, Krankheit oder eine Auszeit.
   Geschützte Tage zählen nicht als verpasst (excused() in app.js): Serien laufen weiter, Wochenziele und
   Wochen-Challenges werden um diese Tage kleiner. XP gibt es weiter nur für das, was man wirklich schafft. */

const PAUSE_KINDS = {
  vacation: { icon: 'tree-palm', de: 'Urlaub', en: 'Vacation' },
  sick: { icon: 'thermometer', de: 'Krank', en: 'Sick' },
  break: { icon: 'circle-pause', de: 'Auszeit', en: 'Time off' },
};
const pauseKind = (p) => PAUSE_KINDS[p.kind] || PAUSE_KINDS.break;
const jokersPerMonth = () => Math.max(0, Math.min(5, Number(state.settings.jokersPerMonth ?? 2)));
const jokersUsed = (ym) => Object.keys(state.jokers || {}).filter((k) => k.startsWith(ym)).length;
const jokersLeft = (ym) => Math.max(0, jokersPerMonth() - jokersUsed(ym));
const pauseOn = (k) => (state.pauses || []).find((p) => p.from <= k && (!p.to || p.to >= k));
const missedOn = (k) => active().filter((h) => scheduled(h, k) && !done(h, k));
const relDayName = (k) => (k === todayKey() ? dt('Heute', 'Today') : k === addDays(todayKey(), -1) ? dt('Gestern', 'Yesterday')
  : new Intl.DateTimeFormat(LOCALE(), { weekday: 'long' }).format(parseKey(k)));

// Wochenziel, verkleinert um geschützte Tage; null, wenn die ganze Woche geschützt ist
function weekNeed(monday, goal) {
  const free = range(monday, addDays(monday, 6)).filter((k) => !excused(k)).length;
  if (!free) return null;
  return free === 7 ? goal : Math.max(1, Math.ceil((goal * free) / 7));
}

// Serie einer Gewohnheit bis zum Vortag von k
function runBefore(h, k) {
  let n = 0;
  for (let d = addDays(k, -1); d >= h.createdAt; d = addDays(d, -1)) {
    if (!scheduled(h, d)) continue;
    if (done(h, d)) n++; else if (!excused(d)) break;
  }
  return n;
}

// Ein verpasster Tag der letzten drei, an dem ein Joker eine Serie ab 3 Tagen retten würde
function jokerRescue(today) {
  for (let i = 1; i <= 3; i++) {
    const k = addDays(today, -i);
    if (excused(k) || ui.jokerHide === k || !jokersLeft(k.slice(0, 7))) continue;
    const saved = missedOn(k).map((h) => ({ h, n: runBefore(h, k) })).filter((x) => x.n >= 3).sort((a, b) => b.n - a.n);
    if (saved.length) return { k, saved };
  }
  return null;
}

// Hinweise oben auf der Startseite
function pausePills(today) {
  const out = [];
  const p = pauseOn(today);
  if (p) {
    const kd = pauseKind(p);
    const until = p.to ? dt(` bis ${fmtShort(p.to)}`, ` until ${fmtShort(p.to)}`) : '';
    out.push(`<button class="info-pill action shield-pill" data-action="pause-open">${icon(kd.icon)}<b>${dt(kd.de, kd.en)}${until}:</b> ${dt('Deine Serien sind geschützt', 'Your streaks are protected')}</button>`);
  } else if (state.jokers?.[today]) {
    out.push(`<button class="info-pill action shield-pill" data-action="pause-open">${icon('shield-check')}<b>${dt('Joker-Tag', 'Joker day')}:</b> ${dt('Heute zählt nichts als verpasst', 'Nothing counts as missed today')}</button>`);
  }
  const r = !p && jokerRescue(today);
  if (r) {
    const names = r.saved.slice(0, 2).map((x) => `${esc(x.h.name)} (${x.n})`).join(', ');
    const left = jokersLeft(r.k.slice(0, 7));
    out.push(`<span class="info-pill warn joker-pill">${icon('flame')}<b>${relDayName(r.k)} ${dt('verpasst', 'missed')}:</b> ${names}
      <button class="pill-btn" data-action="joker-use" data-day="${r.k}">${icon('shield-check')}${dt(`Joker einsetzen · ${left} übrig`, `Use joker · ${left} left`)}</button>
      <button class="pill-x" data-action="joker-hide" data-day="${r.k}" aria-label="${dt('Ausblenden', 'Dismiss')}">${icon('x')}</button></span>`);
  }
  return out;
}

/* ================= Fenster ================= */

function pausePanelHtml() {
  const today = todayKey();
  const ym = today.slice(0, 7);
  const p = pauseOn(today);
  const per = jokersPerMonth(), left = jokersLeft(ym);
  const f = (ui.pauseForm ||= { kind: 'vacation', from: today, to: addDays(today, 6), error: '' });
  const others = (state.pauses || []).filter((x) => x !== p && (x.to || today) >= addDays(today, -60)).sort((a, b) => b.from.localeCompare(a.from)).slice(0, 4);
  const span = (x) => `${fmtShort(x.from)}${x.to ? ` – ${fmtShort(x.to)}` : dt(' – offen', ' – open')}`;

  const dayRow = (k) => {
    const pz = pauseOn(k);
    const sch = active().filter((h) => scheduled(h, k));
    const miss = missedOn(k);
    let st, btn = '';
    if (pz) st = `<span class="pz-state shield">${icon(pauseKind(pz).icon)}${dt(pauseKind(pz).de, pauseKind(pz).en)}</span>`;
    else if (state.jokers?.[k]) {
      st = `<span class="pz-state shield">${icon('shield-check')}${dt('Joker gesetzt', 'Joker used')}</span>`;
      btn = `<button class="btn small ghost" data-action="joker-undo" data-day="${k}">${icon('undo-2')}${dt('Zurücknehmen', 'Undo')}</button>`;
    } else if (!sch.length) st = `<span class="pz-state">${dt('Nichts geplant', 'Nothing planned')}</span>`;
    else if (!miss.length) st = `<span class="pz-state ok">${icon('check')}${dt('Alles geschafft', 'All done')}</span>`;
    else {
      st = `<span class="pz-state miss">${k === today ? dt(`${miss.length} noch offen`, `${miss.length} still open`) : dt(`${miss.length} verpasst`, `${miss.length} missed`)}</span>`;
      const can = jokersLeft(k.slice(0, 7)) > 0;
      btn = `<button class="btn small" data-action="joker-use" data-day="${k}" ${can ? '' : 'disabled'} title="${can ? '' : dt('Keine Joker mehr in diesem Monat', 'No jokers left this month')}">${icon('shield-check')}${dt('Joker setzen', 'Use joker')}</button>`;
    }
    return `<div class="pz-day"><span class="pz-date"><b>${relDayName(k)}</b><small>${fmtShort(k)}</small></span>${st}${btn}</div>`;
  };

  return `
  <div class="pause-panel">
    <div class="card-head">
      <div><div class="eyebrow">${dt('Serien schützen', 'Protect your streaks')}</div><h2 class="panel-title" style="font-size:22px">${dt('Pause und Joker', 'Pause and jokers')}</h2></div>
      <button class="icon-btn" data-action="close-modal" aria-label="${dt('Schließen', 'Close')}">${icon('x')}</button>
    </div>
    <div class="pz-cols">
      <section class="pz-sec">
        <div class="label-sm">${dt('Urlaubsmodus', 'Vacation mode')}</div>
        ${p ? `
        <div class="pz-active">
          <span class="pz-big">${icon(pauseKind(p).icon)}</span>
          <div><b>${dt(`${pauseKind(p).de} läuft`, `${pauseKind(p).en} active`)}</b><small>${span(p)} · ${dt('Serien, Wochenziele und Challenges sind pausiert', 'Streaks, weekly goals and challenges are paused')}</small></div>
          <button class="btn small" data-action="pause-end" data-id="${p.id}">${icon('square')}${dt('Beenden', 'End')}</button>
        </div>` : `
        <div class="segmented pz-kinds" role="radiogroup">${Object.entries(PAUSE_KINDS).map(([id, k]) => `
          <button class="${f.kind === id ? 'on' : ''}" data-action="pause-kind" data-kind="${id}" role="radio" aria-checked="${f.kind === id}">${icon(k.icon)}${dt(k.de, k.en)}</button>`).join('')}</div>
        <div class="pz-dates">
          <div class="field"><label for="pz-from">${dt('Von', 'From')}</label><input type="date" class="input" id="pz-from" data-pz-field="from" min="${addDays(today, -1)}" value="${esc(f.from)}"></div>
          <div class="field"><label for="pz-to">${dt('Bis', 'To')}</label><input type="date" class="input" id="pz-to" data-pz-field="to" value="${esc(f.to)}"></div>
        </div>
        ${f.error ? `<div class="error">${esc(f.error)}</div>` : ''}
        <button class="btn primary" data-action="pause-start">${icon('play')}${dt('Pause starten', 'Start pause')}</button>`}
        ${others.length ? `<div class="pz-list">${others.map((x) => `
          <div class="pz-item">${icon(pauseKind(x).icon)}<span>${dt(pauseKind(x).de, pauseKind(x).en)}</span><small>${span(x)}${x.from > today ? dt(' · geplant', ' · planned') : ''}</small>
            <button class="icon-btn" data-action="pause-del" data-id="${x.id}" title="${dt('Löschen', 'Delete')}">${icon('trash-2')}</button></div>`).join('')}</div>` : ''}
      </section>
      <section class="pz-sec">
        <div class="pz-joker-head">
          <div class="label-sm">${dt('Joker-Tage', 'Joker days')}</div>
          <span class="pz-tokens" title="${dt(`${left} von ${per} übrig in diesem Monat`, `${left} of ${per} left this month`)}">${Array.from({ length: per }, (_, i) => `<i class="${i < left ? 'on' : ''}">${icon('shield-check')}</i>`).join('')}<small>${dt(`${left} von ${per} übrig`, `${left} of ${per} left`)}</small></span>
        </div>
        <div class="pz-days">${range(addDays(today, -6), today).reverse().map(dayRow).join('')}</div>
        <div class="setting pz-per"><div><b>${dt('Joker pro Monat', 'Jokers per month')}</b><span>${dt('Neuer Monat, neue Joker', 'New month, new jokers')}</span></div>
          <div class="segmented">${[1, 2, 3, 4].map((n) => `<button class="${per === n ? 'on' : ''}" data-action="joker-per" data-n="${n}">${n}</button>`).join('')}</div></div>
      </section>
    </div>
    <div class="setting-note">${icon('info')}<span>${dt('Ein Joker oder eine Pause zählt den Tag nicht als verpasst: Deine Serien reißen nicht, Wochenziele und Wochen-Challenges werden um diese Tage kleiner. XP gibt es trotzdem nur für das, was du wirklich erledigst.', 'A joker or a pause means the day doesn’t count as missed: your streaks don’t break, weekly goals and weekly challenges shrink by those days. You still only get XP for what you actually do.')}</span></div>
  </div>`;
}

// Offenes Fenster ohne neue Einblende-Animation auffrischen
function updatePanel(html, cls, marker) {
  const m = document.querySelector('#modal .modal');
  if (!ui.panel || !m || (marker && !m.querySelector(marker))) { openPanel(html, cls); return; }
  m.classList.remove('wide', 'narrow', 'xwide');
  if (cls) m.classList.add(cls);
  m.innerHTML = html;
  lucide.createIcons();
  applyProgress(m);
}
const openPausePanel = () => openPanel(pausePanelHtml(), 'xwide');
const refreshPause = () => { if (document.querySelector('#modal .pause-panel')) updatePanel(pausePanelHtml(), 'xwide', '.pause-panel'); };

document.addEventListener('input', (e) => {
  const t = e.target;
  if (!t.matches?.('[data-pz-field]')) return;
  ui.pauseForm[t.dataset.pzField] = t.value;
});

function pauseAction(a, el) {
  const today = todayKey();
  switch (a) {
    case 'pause-open': ui.pauseForm = null; openPausePanel(); return true;
    case 'pause-kind': ui.pauseForm.kind = el.dataset.kind; refreshPause(); return true;
    case 'pause-start': {
      const f = ui.pauseForm;
      if (!f.from || !f.to) f.error = dt('Bitte Anfang und Ende wählen.', 'Please pick a start and an end.');
      else if (f.to < f.from) f.error = dt('Das Ende liegt vor dem Anfang.', 'The end is before the start.');
      else if (f.from < addDays(today, -1)) f.error = dt('Eine Pause kann höchstens gestern beginnen. Für frühere Tage gibt es die Joker.', 'A pause can start yesterday at the earliest. Use jokers for earlier days.');
      else if (daysBetween(f.from, f.to) > 92) f.error = dt('Eine Pause geht höchstens drei Monate.', 'A pause can last three months at most.');
      else {
        state.pauses = [...(state.pauses || []), { id: uid(), kind: f.kind, from: f.from, to: f.to }];
        ui.pauseForm = null;
        save();
        toast(f.from > today ? dt(`Pause geplant ab ${fmtShort(f.from)}`, `Pause planned from ${fmtShort(f.from)}`) : dt('Pause gestartet. Deine Serien sind geschützt.', 'Pause started. Your streaks are protected.'));
        render('update');
      }
      refreshPause();
      return true;
    }
    case 'pause-end': {
      const p = state.pauses.find((x) => x.id === el.dataset.id);
      // Heute begonnen: ganz löschen, sonst endet sie gestern
      state.pauses = p.from >= today ? state.pauses.filter((x) => x !== p) : state.pauses.map((x) => (x === p ? { ...x, to: addDays(today, -1) } : x));
      save();
      toast(dt('Pause beendet. Willkommen zurück!', 'Pause ended. Welcome back!'));
      render('update');
      refreshPause();
      return true;
    }
    case 'pause-del':
      state.pauses = state.pauses.filter((x) => x.id !== el.dataset.id);
      save(); render('update'); refreshPause();
      return true;
    case 'joker-use': {
      const k = el.dataset.day;
      if (!jokersLeft(k.slice(0, 7))) { toast(dt('Keine Joker mehr in diesem Monat', 'No jokers left this month')); return true; }
      const saved = missedOn(k).map((h) => runBefore(h, k)).reduce((m, n) => Math.max(m, n), 0);
      state.jokers = { ...(state.jokers || {}), [k]: true };
      save();
      syncBadges(false);
      toast(saved >= 2 ? dt('Joker gesetzt. Deine Serie lebt weiter!', 'Joker used. Your streak lives on!') : dt('Joker gesetzt', 'Joker used'));
      render('update');
      refreshPause();
      return true;
    }
    case 'joker-undo': {
      const j = { ...(state.jokers || {}) };
      delete j[el.dataset.day];
      state.jokers = j;
      save(); render('update'); refreshPause();
      return true;
    }
    case 'joker-hide': ui.jokerHide = el.dataset.day; render('update'); return true;
    case 'joker-per': state.settings.jokersPerMonth = Number(el.dataset.n); save(); refreshPause(); render('update'); return true;
  }
  return false;
}
