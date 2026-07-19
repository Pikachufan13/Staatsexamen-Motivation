# 🗺️ Roadmap — „Du schaffst das, Celine!"

Diese Roadmap dokumentiert, was in dieser Ausbaustufe umgesetzt wurde, und
sammelt Ideen für die Zukunft. Grundprinzip bleibt: **Business-Logik in
`app.js` (rein & getestet), Rendering/Events in `ui.js`.**

---

## ✅ Umgesetzt (diese Ausbaustufe)

### Bugfixes
- **Grüner Schimmer** auf Schnauze/Brust behoben: eigene Fell-Weiß-Variablen
  (`--fur-white` / `--fur-shade`) statt Transparenz über der Tafel-Farbe, dazu
  weiche Verläufe für Tiefe statt `opacity`.
- **Footer-Emoji** 🐴 → 🐶 (passend zum Hunde-Thema).

### Neue Features
- **Datum ausgeschrieben** unter jedem Countdown (`formatExamDate`, getestet).
- **Gesamt-Fortschritt** als Punkte-Chip unter der Überschrift
  (`examProgress`, getestet) — wird golden, wenn alles geschafft ist.
- **Sprüche überarbeitet**: von 15 auf **45+ Motivationssprüche**, dazu 3
  liebevolle Insider-Sprüche (Anteil per Test dauerhaft auf ≤ 10 % begrenzt).
  Datenstruktur + Auswahl (`QUOTES`, `pickRandomQuote`, `quoteMotivationRatio`)
  liegen jetzt getestet in `app.js`.
- **3D-Doktorhut**: Verlauf auf der Oberseite, eigene Seitenfläche für die
  "Dicke", Schlagschatten auf den Kopf, gelbe Quaste im Schweden-Skin.
- **Skin-System (🧥 Kleiderhaken)** mit 8 Outfits:
  - Frei: `standard`, `buecherwurm`, `pflanzen`, `schweden`.
  - Freischaltbar: `bronze` (1. Examen), `superheld` (2.), `lehrer` (3.),
    `champion` (alle drei).
  - Reine, getestete Logik: `SKIN_DEFS`, `computeExamUnlocks`, `resolveSkin`.
  - Gewünschter Skin wird gespeichert und taucht automatisch wieder auf, wenn
    eine Prüfung erneut als bestanden markiert wird.
  - iPad/iPhone-taugliches Modal (Backdrop-Tap / X / Esc, große Tap-Flächen).
- **Schnauze schwarz** (French-Bulldog-Maske) mit klar abgesetzter Glanz-Nase.
- **Sprüche-Misch-Stapel**: 45+ Sprüche, keine Wiederholung, bevor nicht alle
  einmal dran waren (`shuffle`, getestet) — löst „wiederholt sich zu schnell".
- **Mini-Henry im Skin-Panel**: jede freigeschaltete Kachel zeigt einen echten
  Mini-Henry im jeweiligen Outfit statt nur eines Emojis.
- **Tages-Lernziele**: kleine Checkliste mit Tagesfortschritt, Haken-Reset pro
  Tag (`todayStamp`, `addGoal`, `toggleGoal`, `removeGoal`, `resetGoalsForNewDay`
  — alle getestet).
- **PWA / „Zum Home-Bildschirm"**: `manifest.json` + Service Worker (`sw.js`) +
  Henry-Icon → installierbar und offline-fähig (nach dem ersten Online-Öffnen,
  inkl. gecachter Schriften). Läuft über den GitHub-Pages-`https`-Link.

### Qualität
- Testsuite von **26 → 60** Unter-Tests gewachsen; alle grün.
- Testordner-Struktur korrigiert (`tests/app.test.js`, `node --test` läuft sauber).

---

## 🔭 Ideen für später (nicht umgesetzt)

Priorisiert nach „viel Freude pro Aufwand":

1. **Spruch des Tages** — beim Öffnen ein pro Tag fester Spruch (per Datum
   „geseedet"), damit jeder Tag sich besonders anfühlt.
2. **Geheime Liebesbotschaft** — versteckter Button mit einer längeren,
   persönlichen Nachricht (im `CONFIG` hinterlegt).
3. **Countdown-Meilensteine** — besondere Nachrichten/Deko bei „noch 7 Tage",
   „noch 1 Tag", „heute!".
4. **Lern-Pausen-Timer (Pomodoro mit Henry)** — 25 min lernen / 5 min Pause.
5. **Sound/Haptik** beim Abhaken (kurzes Feedback, per Toggle abschaltbar).
6. **„Teilen"-Karte** — beim Bestehen ein hübsches Bild zum Weiterschicken.
7. **Weitere Insider-Skins** über versteckte Klick-Kombis (Achtung:
   Insider-Anteil-Test im Blick behalten).
8. **Optionaler Cloud-Sync** — nur falls Geräte-Sync gewünscht wird; bewusst
   bisher weggelassen (kein Server, keine Anmeldung).

---

## 🧭 Arbeitsweise für Weiterentwicklung

1. Neue Logik zuerst als **reine Funktion in `app.js`** + Test in
   `tests/app.test.js`.
2. `node --test` muss grün bleiben.
3. `ui.js` ruft nur `ExamApp.*` auf und macht Rendering/Events.
4. Durchgehend iPhone/iPad im Blick: ≥ 44 px Tap-Targets, kein Hover-Zwang,
   Safe-Area-Insets, natives `<input type="date">`.
