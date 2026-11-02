'use strict';

/* Wird nur für das Werbevideo in die App geladen. Als normale Skript-Datei teilt sie den globalen Bereich der App
   und erreicht damit auch state und ui, die mit let/const angelegt sind. */
window.__promo = {
  setup() {
    state.onboarded = true;
    // Arbeit und Finanzen starten gesperrt, das Video schaltet sie frei
    state.workEnabled = false;
    state.finance.enabled = false;
    state.levelSeen = computeXp().level;

    // Finanzen: Vormonat mit vollen Beispieldaten zeigen, erkannte Abos übernehmen
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    ui.finMonth = keyOf(prev).slice(0, 7);
    for (const s of detectSubs().slice(0, 5)) {
      state.finance.subs.push({ id: uid(), name: s.name, amount: s.amount, interval: s.interval, next: s.next, cat: s.cat, key: s.key, demo: true });
    }

    // Kalender: ein paar Termine in dieser Woche
    const mon = mondayOf(todayKey());
    const at = (d, h, m = 0) => { const x = parseKey(addDays(mon, d)); x.setHours(h, m, 0, 0); return x.getTime(); };
    const ev = (d, h1, m1, h2, m2, title, color, location = '') => state.calEvents.push({ id: `local:${uid()}`, cal: 'local', title, allDay: false, start: at(d, h1, m1), end: at(d, h2, m2), color, note: '', location });
    ev(0, 9, 30, 10, 30, 'Team-Meeting', '#8f7bff', 'Raum 2');
    ev(1, 12, 0, 13, 0, 'Mittag mit Lea', '#ffc46b');
    ev(2, 8, 0, 9, 0, 'Zahnarzt', '#ff7ab6', 'Praxis Dr. Wolf');
    ev(2, 18, 30, 20, 0, 'Fußball', '#57e3b4');
    ev(3, 10, 0, 11, 30, 'Projekt-Review', '#5ee0ff');
    ev(4, 17, 0, 18, 0, 'Sport', '#57e3b4');
    ev(5, 11, 0, 13, 0, 'Wochenmarkt', '#c4f06b');
    state.calEvents.push({ id: `local:${uid()}`, cal: 'local', title: 'Geburtstag Mama', allDay: true, start: addDays(mon, 4), end: addDays(mon, 4), color: '#ff8f6b', note: '', location: '' });
    const t1 = addTask('Steuer abgeben', addDays(mon, 3));
    t1.time = '16:00';
    t1.prio = true;
    addTask('Geschenk besorgen', todayKey());
    addTask('Fahrrad zur Werkstatt', todayKey());

    save();
    renderClock();
    ui.view = 'x';
    go('today');
  },
  go(view) { closeModal(); ui.view = 'x'; go(view); },
  // Monatsübersicht des Vormonats, damit der Monat voll ist
  habitsPrevMonth() {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    ui.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    this.go('habits');
  },
  calMode(mode) { ui.calMode = mode; ui.view = 'x'; go('calendar'); },
  theme(mode) { markTheme(mode); },
  // Wie „Bereich aktivieren“, aber ohne Zeitverzögerung
  enableWork() {
    state.workEnabled = true;
    save();
    closeModal();
    renderSidebar();
    renderClock();
    ui.view = 'x';
    go('schedule');
  },
  // Wie ein Kontoauszug-Import nach dem Freischalten; die Beispielbuchungen sind schon geladen
  enableFinance() {
    state.finance.enabled = true;
    save();
    closeModal();
    renderSidebar();
    ui.view = 'x';
    go('finance');
  },
};
