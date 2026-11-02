# Tageswerk

Kleine Schritte. Jeden Tag.

**Webseite und Download:** https://bastibrm.github.io/tageswerk/

Tageswerk ist eine kostenlose Desktop-App für Windows: Gewohnheiten, Aufgaben, Kalender, Statistiken und Level an einem Ort. Wer möchte, schaltet zusätzlich Stundenplan mit Stempeluhr und einen Finanzbereich frei. Alle Daten bleiben lokal auf deinem PC.

## Download

Die neueste Version gibt es unter [Releases](https://github.com/bastibrm/tageswerk/releases/latest): `Tageswerk-Setup-x.y.z.exe` herunterladen und starten. Updates installiert die App danach selbst.

Windows zeigt beim ersten Start eventuell „Der Computer wurde durch Windows geschützt“, weil die Datei nicht signiert ist. Über „Weitere Informationen“ → „Trotzdem ausführen“ geht es weiter.

## Funktionen

- **Startseite:** Zeitleiste für den Tag, „Als Nächstes“ mit Countdown, Schnell-Eingabe („Zahnarzt morgen 14 Uhr“), Wetter, XP-Tagesziel, Geburtstage, Mini-Monatskalender; Karten frei sortier- und ausblendbar
- **Gewohnheiten:** abhaken oder Mengen zählen, Tageszeiten, Pausen, Serien und Abzeichen
- **Übersicht:** der ganze Monat als Raster, Vergessenes nachtragen
- **Statistiken:** Verläufe, Vergleiche, stärkste Wochentage, Aktivität
- **Aufgaben und Kalender:** Monats- und Wochenansicht, Termine verschieben, Google, Outlook und Apple importieren, Erinnerungen
- **Stimmung und Tagebuch** mit Wochenrückblick
- **Level und Ränge:** vom Lehrling zur Legende
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
