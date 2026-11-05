# Habix

Kleine Schritte. Jeden Tag.

**Webseite und Download:** https://habix.pro

Habix ist eine kostenlose Desktop-App für Windows und Mac: Gewohnheiten, Aufgaben, Kalender, Statistiken und Level an einem Ort. Wer möchte, schaltet zusätzlich Fitness, Stundenplan mit Stempeluhr und einen Finanzbereich frei. Alle Daten bleiben lokal auf deinem Rechner.

## Download

Die neueste Version gibt es unter [Releases](https://github.com/bastibrm/habix/releases/latest): `Habix-Setup-x.y.z.exe` herunterladen und starten. Updates installiert die App danach selbst.

Windows zeigt beim ersten Start eventuell „Der Computer wurde durch Windows geschützt“, weil die Datei nicht signiert ist. Über „Weitere Informationen“ → „Trotzdem ausführen“ geht es weiter.

**Mac:** `Habix-x.y.z-arm64.dmg` (Apple-Chip) oder `Habix-x.y.z-x64.dmg` (Intel) laden, Habix in „Programme“ ziehen. Beim ersten Öffnen warnt macOS, weil Habix nicht bei Apple registriert ist: unter Systemeinstellungen → Datenschutz & Sicherheit auf „Dennoch öffnen“ klicken. Auf dem Mac meldet Habix neue Versionen, installiert sie aber nicht selbst. Benötigt macOS 12 oder neuer.

## Funktionen

- **Startseite:** Zeitleiste für den Tag, „Als Nächstes“ mit Countdown, Schnell-Eingabe („Zahnarzt morgen 14 Uhr“), XP-Tagesziel, Geburtstage, Mini-Monatskalender; Karten frei sortier- und ausblendbar
- **Gewohnheiten:** abhaken oder Mengen zählen, Tageszeiten, Serien und Abzeichen; Joker-Tage und Urlaubsmodus, damit Serien nicht reißen
- **Übersicht:** der ganze Monat als Raster, Vergessenes nachtragen
- **Statistiken:** Verläufe, Vergleiche, stärkste Wochentage, Aktivität
- **Aufgaben und Kalender:** Monats- und Wochenansicht, Termine verschieben, Google, Outlook und Apple importieren, Erinnerungen
- **Stimmung und Tagebuch** mit Morgen-Abfrage und Wochenrückblick
- **Level und Ränge:** 15 Ränge vom Rookie bis Unsterblich, mit Rangprüfungen und drei Wochen-Challenges pro Woche
- **Vitrine:** alle Ränge, Abzeichen und Erfolge, freischaltbare Titel und Farben für die Level-Anzeige
- **Fitness** (freischaltbar): Trainingsplan, Sätze live abhaken, Kalorien und Makros, Wasser, Schlaf, Gewicht, eigenes Fitness-Level
- **Arbeit** (freischaltbar): Stundenplan in halben Stunden, Ein- und Ausstempeln mit Pausen, Auswertung
- **Finanzen** (freischaltbar): Kontoauszug als CSV, Kategorien, Abos, Budgets, ohne Bank-Login
- Hell und dunkel, Deutsch und Englisch, Backups, Speicherort frei wählbar (z. B. OneDrive für zwei PCs)

## Entwicklung

```
npm install
npm start          # App starten
npm run dist       # Setup-Datei bauen (dist/)
npm run release    # bauen und als GitHub-Release hochladen (braucht GH_TOKEN)
```
