/* Drehbuch des Werbevideos (Version 5, Habix 1.2): Szenen auf den Takten des Songs „Long Road“ von Infraction.
   Der Song hat etwa 100 BPM: ein Schlag 0,599 s, ein Takt 2,395 s, der erste Schlag bei 0,564 s.
   Ab Takt 5 setzt das Schlagzeug voll ein, Takt 27 bis 32 ist eine ruhigere Stelle, ab Takt 43 klingt der Song aus.
   Neu in Version 5: mehrere Handgriffe pro Szene (tippen, abhaken, auswählen), Fitness, Challenges, Vitrine und Pause.
   Alle Zeiten in Sekunden. */
(function (root) {
  const BEAT = 0.5988;
  const BAR = BEAT * 4;
  const FIRST = 0.564;
  const bar = (k) => FIRST + k * BAR;
  const b = (k, beats = 0) => bar(k) + beats * BEAT;
  const BPM = 60 / BEAT;

  // Szenen-Grenzen in Takten
  const S = {
    logo: [-0.24, 3], today: [3, 8], tasks: [8, 11], cal: [11, 15], stats: [15, 17], fitness: [17, 24], level: [24, 29],
    pause: [29, 32], areas: [32, 35], year: [35, 37], custom: [37, 40], theme: [40, 42], sync: [42, 43], outro: [43, 46.4],
  };
  const T = Object.fromEntries(Object.entries(S).map(([k, [a, z]]) => [k, [Math.max(0, bar(a)), bar(z)]]));

  // Wichtige Momente (Klicks, Tippen, Schnitte), möglichst auf Taktschlägen
  const E = {
    // Heute: drei Gewohnheiten im Takt, Menge hochzählen, Stimmung
    checkA: b(5), checkB: b(5, 2), checkC: b(6),
    amtA: b(6, 2.5), amtB: b(6, 3.25),
    moodClick: b(7, 2),
    // Aufgaben: neue Aufgabe eintippen, anlegen, eine andere abhaken
    taskFocus: b(8, 2), typeTask0: b(8, 2.6), typeTask1: b(9, 3), taskEnter: b(10),
    taskClick: b(10, 2.5),
    // Kalender: Termin verschieben, neuen Termin anlegen und benennen
    dragStart: b(12), dragEnd: b(12, 2.5),
    calNew: b(13), typeCal0: b(13, 1.2), typeCal1: b(14), calSave: b(14, 2),
    // Fitness: freischalten, Tag planen, Training starten, Sätze abhaken, Wasser
    fitLock: b(17, 2), fitActivate: b(18, 2), fitCut: b(19),
    dayClick: b(19, 2.5), planToggle: b(20, 1.5), fitStart: b(21),
    set1: b(22), set2: b(22, 1), set3: b(22, 2), set4: b(22, 3),
    nutCut: b(23), water1: b(23, 2), water2: b(23, 2.75),
    // Level: Challenge tauschen, Vitrine öffnen, Titel und Farben ausprobieren
    swapClick: b(25), levelClick: b(26), vitrineClick: b(26, 3),
    title1: b(27, 1), title2: b(27, 3), color1: b(28), color2: b(28, 2),
    // Pause: Urlaubsmodus wählen und starten
    pauseOpen: b(29, 3), pauseKind: b(30, 2), pauseStart: b(31), pauseClose: b(31, 3),
    // Bereiche, Startseite, Hell
    finCut: b(33, 2),
    dashDragStart: b(38), dashDragEnd: b(39, -1.5),
    themeWipe: b(40, 2),
  };

  const TYPED = { task: 'Bewerbung abschicken', cal: 'Kino mit Lea' };

  // Texte: Bauchbinden links oder rechts mit Erklärung, oben über dem Fenster, „tag“ als Beschriftung unten
  const captions = [
    { t0: b(3) + 1.2, t1: b(8) - 0.5, side: 'left', eyebrow: 'Gewohnheiten', title: ['Hake ab,', 'was du schaffst.'], sub: 'Abhaken oder Mengen zählen, mit Serien, Abzeichen und deiner Stimmung.' },
    { t0: b(8) + 0.6, t1: b(11) - 0.5, side: 'right', eyebrow: 'Aufgaben', title: ['Eintippen.', 'Erledigen.'], sub: 'Mit Teilschritten, Uhrzeit und Wiederholung. Erledigt heißt: die nächste kommt von selbst.' },
    { t0: b(11) + 0.6, t1: b(15) - 0.5, side: 'left', eyebrow: 'Kalender', title: ['Plane', 'deine Woche.'], sub: 'Termine anlegen und verschieben, mit Google Kalender in beide Richtungen.' },
    { t0: b(15) + 0.5, t1: b(17) - 0.4, side: 'right', eyebrow: 'Statistiken', title: ['Sieh, wo du', 'besser wirst.'], sub: 'Verläufe, Vergleiche und deine stärksten Tage.' },
    { t0: b(17) + 0.5, t1: E.fitCut - 0.3, side: 'left', eyebrow: 'Neu: Bereich Fitness', title: ['Ein Klick,', 'und es geht los.'], sub: 'Training, Ernährung und Fortschritt. Nur sichtbar, wenn du es willst.' },
    { t0: E.fitCut + 0.5, t1: E.nutCut - 0.3, side: 'right', eyebrow: 'Trainingsplan', title: ['Plane den Tag,', 'hak jeden Satz ab.'], sub: 'Tag in der Woche anklicken, Training starten, Sätze live mitschreiben.' },
    { t0: E.nutCut + 0.4, t1: b(24) - 0.3, side: 'tag', title: ['Kalorien, Makros und Wasser im Blick'] },
    { t0: b(24) + 0.5, t1: E.levelClick - 0.3, side: 'left', eyebrow: 'Neu: Wochen-Challenges', title: ['Jede Woche', 'drei Ziele.'], sub: 'Leicht, mittel und schwer. Passt eine nicht, tauschst du sie.' },
    { t0: E.vitrineClick + 0.6, t1: b(29) - 0.4, side: 'top', eyebrow: 'Neu: Vitrine · 13 Titel · 8 Farben', title: ['Zeig, was du dir verdient hast.'] },
    { t0: b(29) + 0.5, t1: b(32) - 0.4, side: 'left', eyebrow: 'Neu: Joker-Tage und Urlaubsmodus', title: ['Krank oder unterwegs?', 'Deine Serie bleibt.'], sub: 'Ein paar Joker pro Monat und eine Pause für Urlaub oder Krankheit.' },
    { t0: b(32) + 0.4, t1: E.finCut - 0.3, side: 'right', eyebrow: 'Bereich Arbeit', title: ['Geplant, gestempelt,', 'ausgewertet.'], sub: 'Stundenplan und Stempeluhr, zum Freischalten.' },
    { t0: E.finCut + 0.4, t1: b(35) - 0.4, side: 'right', eyebrow: 'Bereich Finanzen', title: ['Dein Geld', 'im Überblick.'], sub: 'Kontoauszug als CSV, Kategorien und Abos. Ohne Bank-Login.' },
    { t0: b(35) + 0.5, t1: b(37) - 0.4, side: 'left', eyebrow: 'Jahresansicht', title: ['Dein ganzes Jahr', 'auf einer Seite.'] },
    { t0: b(37) + 0.5, t1: b(40) - 0.4, side: 'tag', title: ['Deine Startseite, wie du sie willst'] },
    { t0: b(40) + 0.5, t1: b(42) - 0.4, side: 'tag', title: ['Hell und dunkel'] },
    { t0: b(42) + 0.3, t1: b(43) - 0.2, side: 'tag', title: ['Auf zwei PCs, über OneDrive'] },
  ];

  // Leise Effekte über der Musik
  const sfx = [];
  const add = (t, type, extra = {}) => sfx.push({ t, type, ...extra });
  const tick = (t, sparkle = false) => { add(t, 'click'); add(t + 0.02, 'pop'); if (sparkle) add(t + 0.08, 'sparkle'); };
  tick(E.checkA, true); tick(E.checkB, true); tick(E.checkC, true);
  tick(E.amtA); tick(E.amtB); tick(E.moodClick, true);
  add(E.taskFocus, 'click');
  for (const [t0, t1, text] of [[E.typeTask0, E.typeTask1, TYPED.task], [E.typeCal0, E.typeCal1, TYPED.cal]]) {
    const n = text.replace(/ /g, '').length;
    for (let i = 0; i < n; i++) add(t0 + ((t1 - t0) * (i + 0.5)) / n, 'key', { v: i });
  }
  tick(E.taskEnter, true); tick(E.taskClick, true);
  add(E.dragStart, 'click'); add(E.dragEnd, 'pop');
  tick(E.calNew); tick(E.calSave, true);
  add(E.fitLock, 'click'); add(E.fitLock + 0.02, 'lock');
  add(E.fitActivate, 'click'); add(E.fitActivate + 0.02, 'unlock');
  tick(E.dayClick); tick(E.planToggle, true); tick(E.fitStart);
  tick(E.set1, true); tick(E.set2, true); tick(E.set3, true); tick(E.set4, true);
  tick(E.water1); tick(E.water2);
  tick(E.swapClick, true); add(E.levelClick, 'click'); add(E.vitrineClick, 'click'); add(E.vitrineClick + 0.05, 'levelup');
  tick(E.title1, true); tick(E.title2, true); tick(E.color1, true); tick(E.color2, true);
  tick(E.pauseOpen); tick(E.pauseKind); add(E.pauseStart, 'click'); add(E.pauseStart + 0.02, 'unlock');
  add(E.dashDragStart, 'click'); add(E.dashDragEnd, 'pop');
  add(E.themeWipe, 'swish');

  const TIMELINE = { fps: 60, width: 1920, height: 1080, BPM, BEAT, BAR, FIRST, bar, b, duration: 111.0, S, T, E, TYPED, captions, sfx };
  if (typeof module !== 'undefined') module.exports = TIMELINE;
  else root.TIMELINE = TIMELINE;
})(this);
