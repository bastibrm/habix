'use strict';

/* Kurze Einführung, nur beim allerersten Start: Willkommen mit Sprachwahl, zwei Erklär-Schritte, Start-Auswahl. */

const BRAND_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="61 82" stroke-linecap="round" transform="rotate(-90 16 16)"/><circle cx="16" cy="16" r="5" fill="currentColor"/></svg>';

function maybeOnboarding() {
  if (state.onboarded) return;
  // Wer schon Daten hat, braucht keine Einführung mehr
  if (state.habits.length || state.sessions.length || state.tasks.length || state.calEvents.length) {
    state.onboarded = true;
    save();
    return;
  }
  ui.onb = 0;
  renderOnboarding(true);
}

function onbFeature(ic, title, text) {
  return `<li>${icon(ic)}<div><b>${title}</b><span>${text}</span></div></li>`;
}

function renderOnboarding(first = false, dir = 1) {
  const i = ui.onb;
  const lang = state.settings.lang || 'de';
  const steps = [
    `<div class="onb-art welcome">${BRAND_SVG}</div>
     <div class="eyebrow">Willkommen bei Habix</div>
     <h2 class="panel-title onb-title">Schön, dass du da bist.</h2>
     <p class="onb-text">Habix hilft dir, Gewohnheiten aufzubauen, Aufgaben im Blick zu behalten und deine Woche zu planen. Alles bleibt auf deinem PC.</p>
     <div class="onb-lang">
       <span>${icon('languages')}Sprache</span>
       <div class="segmented">
         <button class="${lang === 'de' ? 'on' : ''}" data-action="onb-lang" data-lang="de">Deutsch</button>
         <button class="${lang === 'en' ? 'on' : ''}" data-action="onb-lang" data-lang="en">English</button>
       </div>
     </div>`,
    `<div class="onb-art icons"><span style="--c:var(--violet)">${icon('sun')}</span><span style="--c:var(--good)">${icon('list-checks')}</span><span style="--c:var(--sun)">${icon('award')}</span></div>
     <div class="eyebrow">Schritt 1 von 3</div>
     <h2 class="panel-title onb-title">Jeden Tag ein Stück weiter</h2>
     <ul class="unlock-list">
       ${onbFeature('sun', 'Heute', 'Gewohnheiten abhaken oder Mengen eintragen, dazu deine Aufgaben und Termine des Tages')}
       ${onbFeature('list-todo', 'Aufgaben', 'Einmalige Dinge mit Fälligkeitsdatum, zum Beispiel „Steuer abgeben“')}
       ${onbFeature('activity', 'Statistiken', 'Sieh, wo du besser wirst und wo du nachlässt, mit Abzeichen für lange Serien')}
       ${onbFeature('award', 'Level und Ränge', 'Für Gewohnheiten, Aufgaben und deine Stimmung sammelst du XP und steigst vom Rookie bis zum GOAT auf')}
     </ul>`,
    `<div class="onb-art icons"><span style="--c:var(--cyan)">${icon('calendar-days')}</span><span style="--c:var(--good)">${icon('briefcase')}</span><span style="--c:var(--violet)">${icon('wallet')}</span></div>
     <div class="eyebrow">Schritt 2 von 3</div>
     <h2 class="panel-title onb-title">Plane deine Woche</h2>
     <ul class="unlock-list">
       ${onbFeature('calendar-days', 'Kalender', 'Termine in Monats- und Wochenansicht, Google, Outlook oder Apple importieren')}
       ${onbFeature('briefcase', 'Arbeit', 'Stundenplan und Stempeluhr. Schalte den Bereich in der Seitenleiste frei, wenn du ihn brauchst.')}
       ${onbFeature('wallet', 'Finanzen', 'Kontoauszug als CSV hochladen: Ausgaben nach Kategorien, Abos und Budgets. Auch diesen Bereich schaltest du erst frei.')}
       ${onbFeature('bell', 'Erinnerungen', 'Windows meldet sich vor Terminen und abends, wenn noch etwas offen ist')}
     </ul>`,
    `<div class="onb-art icons"><span style="--c:var(--sun)">${icon('rocket')}</span></div>
     <div class="eyebrow">Schritt 3 von 3</div>
     <h2 class="panel-title onb-title">Los geht's</h2>
     <p class="onb-text">Womit möchtest du anfangen?</p>
     <div class="onb-choices">
       <button class="onb-choice primary" data-action="onb-finish" data-next="habit">${icon('plus')}<div><b>Erste Gewohnheit anlegen</b><span>Zum Beispiel jeden Tag Wasser trinken</span></div></button>
       <button class="onb-choice" data-action="onb-finish" data-next="demo">${icon('sparkles')}<div><b>Mit Beispieldaten ausprobieren</b><span>Sieh dir alles mit ausgefüllten Daten an</span></div></button>
       <button class="onb-choice" data-action="onb-finish" data-next="none">${icon('compass')}<div><b>Selbst umsehen</b><span>Alle Bereiche findest du links in der Seitenleiste</span></div></button>
     </div>`,
  ];
  const html = `
    <div class="onb">
      <button class="onb-skip" data-action="onb-finish" data-next="none">Überspringen</button>
      <div class="onb-step ${first ? '' : dir > 0 ? 'from-right' : 'from-left'}">${steps[i]}</div>
      <div class="onb-foot">
        <div class="onb-dots">${steps.map((_, n) => `<span class="${n === i ? 'on' : ''}"></span>`).join('')}</div>
        <div class="btn-row">
          ${i > 0 ? `<button class="btn ghost" data-action="onb-back">${icon('arrow-left')}Zurück</button>` : ''}
          ${i < steps.length - 1 ? `<button class="btn primary" data-action="onb-next">Weiter${icon('arrow-right')}</button>` : ''}
        </div>
      </div>
    </div>`;
  if (first) { openPanel(html, 'onb-modal'); return; }
  const m = document.querySelector('#modal .modal');
  if (m) { m.classList.remove('enter'); m.innerHTML = html; lucide.createIcons(); }
}

function finishOnboarding(next) {
  ui.onb = null;
  state.onboarded = true;
  save();
  closeModal();
  if (next === 'habit') setTimeout(() => openModal(null, SUGGESTIONS[0]), 250);
  if (next === 'demo') setTimeout(loadDemo, 250);
}

function onboardingAction(a, el) {
  switch (a) {
    case 'onb-next': ui.onb = Math.min(3, ui.onb + 1); renderOnboarding(false, 1); return true;
    case 'onb-back': ui.onb = Math.max(0, ui.onb - 1); renderOnboarding(false, -1); return true;
    case 'onb-finish': finishOnboarding(el.dataset.next); return true;
    case 'onb-lang': setLanguage(el.dataset.lang); return true;
  }
  return false;
}
