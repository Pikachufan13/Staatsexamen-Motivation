# 🎓🐾 Du schaffst das, Celine! — Motivations-App fürs Staatsexamen

Eine interaktive Web-App fürs Staatsexamen (Lehramt): Countdown **mit
ausgeschriebenem Datum** zu allen drei Prüfungsterminen, eine animierte
französische Bulldogge ("Henry") zum Antippen — die man über einen
**Kleiderhaken mit 8 Skins** einkleiden kann (4 frei, 4 werden fürs Bestehen
der Prüfungen freigeschaltet), wechselnde Mutmach-Sprüche (45+ Stück, ohne schnelle Wiederholung, mit
Schweden-Prise 🇸🇪 und ein paar liebevollen Insider-Anspielungen), eine
Gesamt-Fortschrittsanzeige, eine **Tages-Lernziele-Liste**, ein
"Pfoten-Power-Meter" mit Konfetti-Feiermodus — und die Möglichkeit, bestandene
Prüfungen abzuhaken sowie eigene, künftige Prüfungstermine einzutragen.

Läuft direkt im Browser (auch auf iPhone/iPad), kein Server, kein Build nötig —
und lässt sich als **App zum Home-Bildschirm** hinzufügen (funktioniert dann
sogar offline).

---

## Dateien in diesem Projekt

```
index.html          — Struktur der Seite
style.css           — komplettes Design (Cozy-Schule + Schweden-Deko)
app.js              — reine Logik (Countdown, Prüfungen, Sprüche, Skins, Lernziele) — GETESTET
ui.js               — verbindet die Logik mit der Seite (Klicks, Rendering)
tests/              — automatisierte Tests für app.js
manifest.json       — App-Infos (Name, Icon, Farben) fürs "Zum Home-Bildschirm"
sw.js               — Service Worker: macht die App offline-fähig
icon-192/512.png,
apple-touch-icon.png — App-Icons (Henry-Gesicht) für den Home-Bildschirm
icon.svg            — Quell-Grafik des Icons (aus ihr sind die PNGs erzeugt)
README.md           — diese Anleitung
ROADMAP.md          — Umgesetztes + Ideen für später
```

`app.js` enthält bewusst **keine** Bildschirm-Elemente, nur reine Funktionen
(z. B. "wie viele Tage sind es noch bis zum Datum X"). Das macht es möglich,
die Logik automatisiert zu testen, unabhängig vom Design.

---

## 1. Personalisierung

Name, Hundename und die drei festen Prüfungstermine sind bereits eingetragen
(`ui.js`, ganz oben im `CONFIG`-Objekt):

```js
const CONFIG = {
  name: "Celine",
  dogName: "Henry",
  signOff: "Ich drück dir ganz fest die Daumen — du bist bereit für das hier.",
  exams: [
    { label: "1. Staatsexamen", date: "2026-07-22T08:00:00" },
    { label: "2. Staatsexamen", date: "2026-07-27T08:00:00" },
    { label: "3. Staatsexamen", date: "2026-09-11T08:00:00" },
  ],
};
```

Willst du Uhrzeiten, Bezeichnungen oder den Text unten anpassen, änderst du
das direkt hier. Format für Daten: `"JJJJ-MM-TTTHH:MM:00"`.

---

## 2. Neue Funktionen im Detail

### ✅ Prüfung abhaken
Unter jedem Countdown gibt es eine Checkbox **"Als bestanden markieren"**.
Ein Klick öffnet zuerst eine Rückfrage ("War's das — hast du sie wirklich
bestanden?") — erst nach Bestätigung wird die Prüfung als bestanden markiert
und es gibt eine kleine Konfetti-Feier inklusive Spruch von Henry. So kann
nichts aus Versehen passieren.

Der Haken lässt sich genauso über eine Bestätigungs-Nachfrage wieder
entfernen ("Haken wirklich wieder entfernen?"), falls doch mal ein
Verklicker passiert.

Der Status wird lokal im Browser gespeichert (`localStorage`) — bleibt also
auch nach dem Schließen der Seite erhalten, allerdings **nur auf dem
jeweiligen Gerät/Browser**. Wird die Prüfung z. B. auf dem iPhone abgehakt,
ist der Haken auf dem iPad nicht automatisch auch gesetzt (dafür bräuchte es
einen Server/Login, was für dieses kleine Projekt bewusst nicht eingebaut
wurde).

### ➕ Eigene Prüfungen eintragen
Über "Eigene Prüfung eintragen" oberhalb der Hund-Szene kann Celine selbst
weitere Termine (z. B. eine mündliche Nachprüfung oder ein Kolloquium)
hinzufügen. Eingaben werden geprüft (Name darf nicht leer sein, Datum muss
gültig sein, keine doppelten Einträge) — bei einem Fehler erscheint eine
kurze, verständliche Meldung statt eines Absturzes. Eigene Prüfungen lassen
sich über das ✕ neben dem Titel auch wieder löschen (mit Sicherheits-Nachfrage).

### 📅 Datum + Countdown
Unter jedem Countdown steht jetzt zusätzlich das ausgeschriebene Datum
(z. B. "22.07.2026, 08:00 Uhr"), damit auf einen Blick klar ist, welcher
Termin gemeint ist.

### 🎉 Gesamt-Fortschritt
Direkt unter der Überschrift zeigt ein kleiner Chip mit Punkten, wie viele
Prüfungen schon geschafft sind ("Geschafft: 1 von 3"). Sind alle geschafft,
wird er golden und feiert mit.

### 🧥 Henrys Kleiderhaken (Skin-System)
Oben rechts in der Hund-Szene öffnet der Kleiderhaken (🧥) ein Panel mit
8 Outfits für Henry:

- **Immer verfügbar:** Standard-Henry (Doktorhut), Bücherwurm (Lesebrille +
  Buch), Pflanzen-Power (Blätterkranz + Ranke), Schweden-Modus (blau-gelbes
  Halstuch + Dalapferd).
- **Freigeschaltet durchs Bestehen der Prüfungen:** Bronze-Genie (nach dem
  1. Examen), Superheld Henry (nach dem 2., mit Umhang + Maske), Lehrer Henry
  (nach dem 3., mit Fliege + Brille + Zeigestock) und als großes Finale
  Champion Henry (wenn alle drei geschafft sind: Talar, goldene Krone,
  Glitzer-Aura).

Gesperrte Skins zeigen ihre Freischalt-Bedingung an. Der gewünschte Skin wird
gespeichert — schaltet man eine Prüfung wieder ab, fällt Henry vorübergehend
auf den Standard zurück und trägt das gewünschte Outfit automatisch wieder,
sobald die Prüfung erneut als bestanden markiert ist.

### ✨ Mehr Sprüche, ohne schnelle Wiederholung
45+ Motivationssprüche (statt vorher 15). Sie werden über einen „Misch-Stapel"
gezeigt: Erst wenn wirklich alle einmal dran waren, wird neu gemischt — so
wiederholt sich kein Spruch zu früh, und derselbe kommt nie zweimal direkt
hintereinander. Darunter sind — statistisch selten, ~10 % — ein paar liebevoll
neckende Insider-Sprüche.

### 📝 Tages-Lernziele
Unter den Prüfungen gibt es eine kleine Checkliste „Heutige Lernziele". Celine
kann eintragen, was sie sich für den Tag vornimmt, einzelne Punkte abhaken oder
löschen. Ein Zähler zeigt den Tagesfortschritt („1/2 geschafft"), und wenn alle
Ziele erledigt sind, feiert Henry kurz mit. **Jeden neuen Tag** werden die Haken
automatisch zurückgesetzt (die eingetragenen Ziel-Texte bleiben erhalten, damit
wiederkehrende Ziele nicht neu getippt werden müssen). Alles lokal gespeichert.

### 🐶 Mini-Henry im Kleiderhaken
Im Skin-Panel zeigt jede freigeschaltete Kachel einen echten Mini-Henry im
jeweiligen Outfit (statt nur eines Emojis) — so sieht man auf einen Blick, wie
Henry damit aussieht. Gesperrte Skins bleiben mit 🔒 eine kleine Überraschung.

### 📲 Als App installieren (PWA / Offline)
Öffnet man den GitHub-Pages-Link auf dem iPhone in **Safari** → Teilen-Symbol →
„Zum Home-Bildschirm", landet die App mit eigenem **Henry-Icon** auf dem
Startbildschirm und öffnet im Vollbild wie eine echte App. Nach dem ersten
Öffnen funktioniert sie dank Service Worker (`sw.js`) **auch offline**. Wichtig:
Das klappt nur über den `https`-Link von GitHub Pages, nicht per lokalem
Doppelklick.

---

## 3. iPhone & iPad

Die App ist bewusst so gebaut, dass sie gut funktioniert, wenn du sie per
WhatsApp-Link auf einem iPhone/iPad öffnest:

- Alle Buttons/Checkboxen haben ausreichend große Tipp-Flächen (≥ 44×44 px,
  Apples eigene Empfehlung).
- Das Datumsfeld nutzt den nativen iOS-Datums-Picker (`<input type="date">`).
- Die Seite respektiert die "Notch"/Home-Indicator-Bereiche
  (`env(safe-area-inset-*)`).
- Kein Feature ist auf Maus-Hover angewiesen — alles funktioniert per Antippen.
- Optional: Über "Zum Home-Bildschirm hinzufügen" in Safari lässt sich die
  Seite wie eine kleine App auf dem Homescreen ablegen.

---

## 4. Lokal testen (Seite ansehen)

Einfach `index.html` doppelklicken — läuft direkt im Browser.
(Wichtig: `index.html`, `style.css`, `app.js` und `ui.js` müssen dabei im
selben Ordner liegen, da sie sich gegenseitig referenzieren.)

---

## 5. Automatisierte Tests ausführen

Die Logik in `app.js` (Countdown-Berechnung, Datum-Formatierung, Prüfungen
hinzufügen/entfernen, Abhaken, Speichern, Sprüche-Auswahl, Fortschritt und das
komplette Skin-Freischalt-System) ist mit **60 automatisierten Tests** abgedeckt
(Node.js' eingebauter Testrunner, keine Zusatz-Installation nötig).

Voraussetzung: [Node.js](https://nodejs.org) ab Version 18.

```bash
node --test
```

Erwartete Ausgabe am Ende: `# pass 1` (eine Test-Datei) mit **60 grünen
Unter-Tests** und `# fail 0`.

Getestet werden u. a.:
- Countdown-Berechnung (Tage/Std/Min/Sek, auch für bereits vergangene Termine)
- Datum-Formatierung ("22.07.2026, 08:00 Uhr", inkl. ungültiger Eingaben)
- Zusammenführen von festen + eigenen Prüfungen inkl. Sortierung nach Datum
- Validierung neuer Prüfungen (leerer Name, ungültiges Datum, Duplikate)
- Hinzufügen/Entfernen eigener Prüfungen, ohne bestehende Daten zu verändern
- Abhaken/Rückgängig-Machen des "bestanden"-Status + Gesamt-Fortschritt
- Sprüche-Auswahl (deterministisch testbar) & Insider-Anteil bleibt ≤ 10 %
- Skin-Freischaltung (welche Prüfung schaltet welchen Skin frei) und der
  automatische Rückfall auf "Standard", wenn ein Skin (noch) gesperrt ist
- Speichern & Laden aus dem Browser-Speicher, inkl. Umgang mit kaputten Daten
- Ein kompletter End-to-End-Ablauf (Prüfung eintragen → abhaken → rückgängig machen)

---

## 6. Auf GitHub Pages veröffentlichen

1. Neues GitHub-Repository erstellen (z. B. `staatsexamen-power`).
2. Alle Dateien aus diesem Ordner hochladen. **Wichtig für die App-/Offline-
   Funktion:** neben `index.html`, `style.css`, `app.js`, `ui.js` unbedingt auch
   `manifest.json`, `sw.js` sowie `icon-192.png`, `icon-512.png` und
   `apple-touch-icon.png` mit hochladen. `README.md`, `ROADMAP.md`, `icon.svg`
   und `tests/` sind optional (schaden aber nicht).
3. Im Repo zu **Settings → Pages** gehen.
4. Unter "Build and deployment" → **Source: Deploy from a branch** wählen,
   Branch `main` und Ordner `/ (root)` auswählen, dann **Save**.
5. Nach ein bis zwei Minuten ist die Seite live unter:
   `https://DEIN-BENUTZERNAME.github.io/staatsexamen-power/`

Diesen Link kannst du ihr per WhatsApp schicken. 💛

---

## 7. Design-Hinweise

- **Cozy-Schule statt reiner Tafel-Optik**: warmes Tafelgrün, Kraftpapier-Ton
  für die Sprechblase, ein Holzton für den "Termin hinzufügen"-Button.
- **Henry** ist jetzt deutlicher als französische Bulldogge erkennbar:
  Fledermausohren, Stirnfalten, Backen/Jowls, kompakter Körper, Schrauben-Rute.
  Der Highschool-Doktorhut sitzt jetzt zentriert zwischen den Ohren.
- **Schweden-Deko**: kleine Wimpelkette in den Landesfarben oben auf der
  Seite, ein blau-gelbes Halstuch für Henry, sowie ein paar schwedische
  Wörter in den Sprüchen ("Lycka till", "Du fixar det", "fika").

Viel Erfolg — sowohl beim Deployen als auch (vor allem) für Celine beim
Examen! 🍀
