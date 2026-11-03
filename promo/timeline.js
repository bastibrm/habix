/* Drehbuch des Werbevideos (Version 4, Habix): Szenen auf den Takten des Songs „Long Road“ von Infraction.
   Der Song hat etwa 100 BPM: ein Schlag 0,599 s, ein Takt 2,395 s, der erste Schlag bei 0,564 s.
   Ab Takt 5 setzt das Schlagzeug voll ein, Takt 27 bis 32 ist eine ruhigere Stelle, ab Takt 43 klingt der Song aus.
   Alle Zeiten in Sekunden. */
(function (root) {
  const BEAT = 0.5988;
  const BAR = BEAT * 4;
  const FIRST = 0.564;
  const bar = (k) => FIRST + k * BAR;
  const BPM = 60 / BEAT;

  // Szenen-Grenzen in Takten
  const S = {
    logo: [-0.24, 3], today: [3, 9], tasks: [9, 13], stats: [13, 16], overview: [16, 19], week: [19, 22], year: [22, 25],
    work: [25, 29], level: [29, 32], finance: [32, 37], custom: [37, 40], theme: [40, 42], sync: [42, 43], outro: [43, 46.4],
  };
  const T = Object.fromEntries(Object.entries(S).map(([k, [a, z]]) => [k, [Math.max(0, bar(a)), bar(z)]]));

  // Wichtige Momente (Klicks und Schnitte), möglichst auf Taktschlägen
  const E = {
    checkClick: bar(5),               // Abhaken genau, wenn das Schlagzeug einsetzt
    taskClick: bar(11),
    matrixClick: bar(18),
    dragStart: bar(20) + BEAT,
    dragEnd: bar(21) + BEAT * 0.5,
    lockClick: bar(25) + BEAT * 2,
    activateClick: bar(26) + BEAT * 3,
    workCut: bar(27),
    clockClick: bar(28),
    levelClick: bar(29) + BEAT * 2,
    levelPanel: bar(29) + BEAT * 2.6,
    finLockClick: bar(32) + BEAT * 2,
    fileDrop: bar(34),                // Konfetti auf dem Takt
    finCut: bar(35),
    dashDragStart: bar(38),
    dashDragEnd: bar(39) - BEAT,
    themeWipe: bar(40) + BEAT * 2,
  };

  // Texte: Bauchbinden links oder rechts mit Erklärung, oben für die Level-Szene, „tag“ als Beschriftung unten
  const captions = [
    { t0: bar(3) + 1.2, t1: bar(9) - 0.5, side: 'left', eyebrow: 'Gewohnheiten', title: ['Hake ab,', 'was du schaffst.'], sub: 'Abhaken oder Mengen zählen, mit Serien, Abzeichen und deiner Stimmung.' },
    { t0: bar(9) + 0.6, t1: bar(13) - 0.5, side: 'right', eyebrow: 'Aufgaben', title: ['Große Dinge,', 'kleine Schritte.'], sub: 'Mit Teilschritten, Uhrzeit und Wiederholung. Erledigt heißt: die nächste kommt von selbst.' },
    { t0: bar(13) + 0.6, t1: bar(16) - 0.5, side: 'left', eyebrow: 'Statistiken', title: ['Sieh, wo du', 'besser wirst.'], sub: 'Verläufe, Vergleiche und deine stärksten Tage, von Rot bis Grün.' },
    { t0: bar(16) + 0.6, t1: bar(19) - 0.5, side: 'right', eyebrow: 'Übersicht', title: ['Dein ganzer Monat', 'auf einen Blick.'], sub: 'Jede Gewohnheit, jeder Tag. Vergessenes trägst du einfach nach.' },
    { t0: bar(19) + 0.6, t1: bar(22) - 0.5, side: 'left', eyebrow: 'Kalender', title: ['Plane', 'deine Woche.'], sub: 'Termine anfassen und verschieben, erinnert werden, Google und Outlook importieren.' },
    { t0: bar(22) + 0.6, t1: bar(25) - 0.5, side: 'right', eyebrow: 'Neu: Jahresansicht', title: ['Dein ganzes Jahr', 'auf einer Seite.'], sub: 'Zwölf Monate mit allen Terminen. Ein Klick, und du bist im Monat.' },
    { t0: bar(25) + 0.5, t1: bar(27) - 0.3, side: 'left', eyebrow: 'Bereich Arbeit', title: ['Nur, wenn du', 'es brauchst.'], sub: 'Stundenplan und Stempeluhr sind am Anfang gesperrt. Ein Klick schaltet sie frei.' },
    { t0: bar(27) + 0.3, t1: bar(29) - 0.4, side: 'left', eyebrow: 'Arbeitszeit', title: ['Geplant, gestempelt,', 'ausgewertet.'], sub: 'Grün heißt gearbeitet, rot heißt verpasst.' },
    { t0: E.levelPanel + 0.4, t1: bar(32) - 0.4, side: 'top', eyebrow: '15 Ränge · Rangprüfungen · Wochenaufgaben', title: ['Vom Rookie zum GOAT.'] },
    { t0: bar(32) + 0.4, t1: E.finCut - 0.3, side: 'left', eyebrow: 'Bereich Finanzen', title: ['Erst freischalten,', 'dann loslegen.'], sub: 'Kontoauszug als CSV hochladen. Ohne Bank-Login, die Datei bleibt auf deinem PC.' },
    { t0: E.finCut + 0.4, t1: bar(37) - 0.5, side: 'right', eyebrow: 'Finanzen', title: ['Dein Geld', 'im Überblick.'], sub: 'Einnahmen, Ausgaben, Kategorien und Abos, automatisch sortiert.' },
    { t0: bar(37) + 0.5, t1: bar(40) - 0.4, side: 'tag', title: ['Deine Startseite, wie du sie willst'] },
    { t0: bar(40) + 0.5, t1: bar(42) - 0.4, side: 'tag', title: ['Hell und dunkel'] },
    { t0: bar(42) + 0.3, t1: bar(43) - 0.2, side: 'tag', title: ['Auf zwei PCs, über OneDrive'] },
  ];

  // Leise Effekte über der Musik
  const sfx = [];
  const add = (t, type, extra = {}) => sfx.push({ t, type, ...extra });
  add(E.checkClick, 'click'); add(E.checkClick + 0.02, 'pop'); add(E.checkClick + 0.08, 'sparkle');
  add(E.taskClick, 'click'); add(E.taskClick + 0.02, 'pop'); add(E.taskClick + 0.08, 'sparkle');
  add(E.matrixClick, 'click'); add(E.matrixClick + 0.02, 'pop'); add(E.matrixClick + 0.08, 'sparkle');
  add(E.dragStart, 'click'); add(E.dragEnd, 'pop');
  add(E.lockClick, 'click'); add(E.lockClick + 0.02, 'lock');
  add(E.activateClick, 'click'); add(E.activateClick + 0.02, 'unlock');
  add(E.clockClick, 'click'); add(E.clockClick + 0.02, 'pop');
  add(E.levelClick, 'click'); add(E.levelPanel, 'levelup');
  add(E.finLockClick, 'click'); add(E.finLockClick + 0.02, 'lock'); add(E.fileDrop, 'unlock');
  add(E.dashDragStart, 'click'); add(E.dashDragEnd, 'pop');
  add(E.themeWipe, 'swish');

  const TIMELINE = { fps: 60, width: 1920, height: 1080, BPM, BEAT, BAR, FIRST, bar, duration: 111.0, S, T, E, captions, sfx };
  if (typeof module !== 'undefined') module.exports = TIMELINE;
  else root.TIMELINE = TIMELINE;
})(this);
