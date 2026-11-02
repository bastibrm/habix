/* Drehbuch des Werbevideos (Version 3, ruhig): Szenen in Takten, gemeinsam für Bild (stage.js) und Ton (music.js).
   96 BPM, ein Takt = 4 Schläge = 2,5 Sekunden. Alle Zeiten in Sekunden. */
(function (root) {
  const BPM = 96;
  const BEAT = 60 / BPM;
  const BAR = BEAT * 4;
  const b = (bars) => bars * BAR;

  // Szenen-Grenzen in Takten
  const S = {
    logo: [0, 2], today: [2, 6], stats: [6, 9], overview: [9, 12.5], calendar: [12.5, 16], work: [16, 21],
    financeUnlock: [21, 24], finance: [24, 27], level: [27, 30], montage: [30, 33], outro: [33, 36],
  };
  const T = Object.fromEntries(Object.entries(S).map(([k, [a, z]]) => [k, [b(a), b(z)]]));

  // Wichtige Momente (Klicks und Schnitte)
  const E = {
    checkClick: 9.2,
    moodClick: 13.3,
    matrixClick: 27.2,
    dragStart: 35.0,
    dragEnd: 37.0,
    lockClick: 43.4,
    activateClick: 47.3,
    workCut: 48.4,
    clockClick: 51.4,
    finLockClick: 54.2,
    fileDrop: 58.6,
    levelClick: 69.2,
    levelPanel: 69.6,
  };

  // Texte: Bauchbinden links oder rechts mit Erklärung, oben für die Level-Szene, „tag“ als Beschriftung unten
  const captions = [
    { t0: 5.8, t1: 14.8, side: 'left', eyebrow: 'Gewohnheiten', title: ['Hake ab,', 'was du schaffst.'], sub: 'Abhaken oder Mengen zählen, mit Serien, Abzeichen und deiner Stimmung.' },
    { t0: 15.4, t1: 22.3, side: 'right', eyebrow: 'Statistiken', title: ['Sieh, wo du', 'besser wirst.'], sub: 'Verläufe, Vergleiche und deine stärksten Tage, von Rot bis Grün auf einen Blick.' },
    { t0: 22.9, t1: 31.0, side: 'left', eyebrow: 'Gewohnheiten · Übersicht', title: ['Dein ganzer Monat', 'auf einen Blick.'], sub: 'Jede Gewohnheit, jeder Tag. Vergessenes trägst du einfach nach.' },
    { t0: 31.6, t1: 39.8, side: 'right', eyebrow: 'Kalender', title: ['Plane', 'deine Woche.'], sub: 'Termine per Maus verschieben, erinnert werden, Google und Outlook importieren.' },
    { t0: 40.4, t1: 48.2, side: 'left', eyebrow: 'Bereich Arbeit', title: ['Nur, wenn du', 'es brauchst.'], sub: 'Stundenplan und Stempeluhr sind am Anfang gesperrt. Ein Klick schaltet sie frei.' },
    { t0: 48.8, t1: 52.3, side: 'left', eyebrow: 'Arbeitszeit', title: ['Geplant, gestempelt,', 'ausgewertet.'], sub: 'Grün heißt gearbeitet, rot heißt verpasst.' },
    { t0: 52.9, t1: 59.8, side: 'left', eyebrow: 'Bereich Finanzen', title: ['Erst freischalten,', 'dann loslegen.'], sub: 'Kontoauszug als CSV hochladen. Ohne Bank-Login, die Datei bleibt auf deinem PC.' },
    { t0: 60.4, t1: 67.3, side: 'right', eyebrow: 'Finanzen', title: ['Dein Geld', 'im Überblick.'], sub: 'Einnahmen, Ausgaben, Kategorien und Abos, automatisch sortiert.' },
    { t0: 69.8, t1: 74.8, side: 'top', eyebrow: 'Level und Ränge', title: ['Vom Lehrling zur Legende.'] },
    { t0: 75.3, t1: 77.4, side: 'tag', title: ['Aufgaben'] },
    { t0: 77.8, t1: 79.9, side: 'tag', title: ['Hell und dunkel'] },
    { t0: 80.3, t1: 82.4, side: 'tag', title: ['Monatskalender'] },
  ];

  const sfx = [];
  const add = (t, type, extra = {}) => sfx.push({ t, type, ...extra });
  add(0.4, 'shimmer'); add(5.0, 'whoosh');
  add(E.checkClick, 'click'); add(E.checkClick + 0.02, 'pop'); add(E.checkClick + 0.08, 'sparkle');
  add(E.moodClick, 'click'); add(E.moodClick + 0.02, 'pop');
  for (const t of [15, 22.5, 31.25, 40, 48.4, 52.5, 60, 67.5, 75, 77.5, 80]) add(t - 0.1, 'swish');
  add(E.matrixClick, 'click'); add(E.matrixClick + 0.02, 'pop'); add(E.matrixClick + 0.08, 'sparkle');
  add(E.dragStart, 'click'); add(E.dragEnd, 'pop');
  add(E.lockClick, 'click'); add(E.lockClick + 0.02, 'lock');
  add(E.activateClick, 'click'); add(E.activateClick + 0.02, 'unlock');
  add(E.clockClick, 'click'); add(E.clockClick + 0.02, 'pop');
  add(E.finLockClick, 'click'); add(E.finLockClick + 0.02, 'lock'); add(E.fileDrop, 'unlock');
  add(E.levelClick, 'click'); add(E.levelPanel, 'levelup');
  add(b(33), 'chime', { note: 77 }); add(b(33) + 0.9, 'sparkle');

  const TIMELINE = { fps: 30, width: 1920, height: 1080, BPM, BEAT, BAR, bar: b, duration: b(36), S, T, E, captions, sfx };
  if (typeof module !== 'undefined') module.exports = TIMELINE;
  else root.TIMELINE = TIMELINE;
})(this);
