/**
 * app.js
 * Reine Logik-Funktionen (keine DOM-Zugriffe!), damit sie sowohl im Browser
 * als auch mit Node.js-Tests (tests/app.test.js) verwendet werden können.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ExamApp = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------
   * Hilfsfunktionen
   * --------------------------------------------------------- */

  function slugify(str) {
    return String(str)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Umlaute etc. entfernen
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'termin';
  }

  function makeExamId(label, dateStr) {
    return `${slugify(label)}__${dateStr}`;
  }

  function isValidDateString(dateStr) {
    if (typeof dateStr !== 'string' || dateStr.trim() === '') return false;
    const t = new Date(dateStr).getTime();
    return Number.isFinite(t);
  }

  /* ---------------------------------------------------------
   * Countdown-Berechnung
   * --------------------------------------------------------- */

  /**
   * Zerlegt eine Millisekunden-Differenz in Tage/Std/Min/Sek.
   * Gibt bei negativer Differenz isPast: true zurück (alle Werte 0).
   */
  function formatCountdown(diffMs) {
    if (typeof diffMs !== 'number' || Number.isNaN(diffMs)) {
      throw new TypeError('diffMs muss eine Zahl sein');
    }
    if (diffMs <= 0) {
      return { isPast: true, days: 0, hours: 0, mins: 0, secs: 0 };
    }
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return { isPast: false, days, hours, mins, secs };
  }

  function msUntil(dateStr, now) {
    const nowTime = now instanceof Date ? now.getTime() : now;
    return new Date(dateStr).getTime() - nowTime;
  }

  /**
   * Formatiert ein Datum lesbar aus, z. B. "22.07.2026, 08:00 Uhr".
   * Gibt bei ungültigem Datum einen leeren String zurück (kein Absturz).
   */
  function formatExamDate(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timePart = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return `${datePart}, ${timePart} Uhr`;
  }

  /* ---------------------------------------------------------
   * Prüfungen zusammenführen / verwalten
   * --------------------------------------------------------- */

  /**
   * Führt Standard- und selbst hinzugefügte Prüfungen zu einer sortierten,
   * eindeutigen Liste zusammen und reichert sie mit dem "erledigt"-Status an.
   * Reine Funktion: verändert keine der Eingaben.
   */
  function buildExamList(defaultExams, customExams, doneMap) {
    const dm = doneMap || {};
    const all = [...(defaultExams || []), ...(customExams || [])].map((e) => {
      const id = e.id || makeExamId(e.label, e.date);
      return {
        id,
        label: e.label,
        date: e.date,
        source: e.source || 'default',
        done: Boolean(dm[id]),
      };
    });
    // Nach Datum aufsteigend sortieren
    all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return all;
  }

  /**
   * Prüft eine neue, vom Menschen eingegebene Prüfung auf Gültigkeit.
   * Gibt { valid: true } oder { valid: false, error: '...' } zurück.
   */
  function validateExamInput(label, dateStr, existingExams) {
    const trimmedLabel = (label || '').trim();
    if (trimmedLabel.length === 0) {
      return { valid: false, error: 'Bitte gib einen Namen für die Prüfung ein.' };
    }
    if (trimmedLabel.length > 60) {
      return { valid: false, error: 'Der Name ist zu lang (max. 60 Zeichen).' };
    }
    if (!isValidDateString(dateStr)) {
      return { valid: false, error: 'Bitte gib ein gültiges Datum ein.' };
    }
    const id = makeExamId(trimmedLabel, dateStr);
    const duplicate = (existingExams || []).some((e) => (e.id || makeExamId(e.label, e.date)) === id);
    if (duplicate) {
      return { valid: false, error: 'Diese Prüfung existiert schon.' };
    }
    return { valid: true };
  }

  /**
   * Fügt eine neue Prüfung zur Liste der selbst eingetragenen hinzu (reine Funktion).
   */
  function addCustomExam(customExams, label, dateStr) {
    const trimmedLabel = label.trim();
    const id = makeExamId(trimmedLabel, dateStr);
    return [...(customExams || []), { id, label: trimmedLabel, date: dateStr, source: 'custom' }];
  }

  /**
   * Entfernt eine selbst eingetragene Prüfung anhand ihrer id (reine Funktion).
   */
  function removeCustomExam(customExams, id) {
    return (customExams || []).filter((e) => e.id !== id);
  }

  /**
   * Kehrt den "erledigt"-Status einer Prüfung um (reine Funktion).
   */
  function toggleDoneMap(doneMap, id) {
    const next = { ...(doneMap || {}) };
    next[id] = !next[id];
    return next;
  }

  /* ---------------------------------------------------------
   * Tages-Lernziele (kleine To-do-Liste für heute)
   * --------------------------------------------------------- */

  /** Datums-Stempel 'JJJJ-MM-TT' aus einem Date (für den Tageswechsel). */
  function todayStamp(date) {
    const d = date instanceof Date ? date : new Date(date);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** Fügt ein Lernziel hinzu (leere Eingaben werden ignoriert). Reine Funktion. */
  function addGoal(goals, text, id) {
    const t = (text || '').trim();
    if (!t) return goals || [];
    return [...(goals || []), { id, text: t.slice(0, 80), done: false }];
  }

  /** Schaltet den erledigt-Status eines Ziels um. Reine Funktion. */
  function toggleGoal(goals, id) {
    return (goals || []).map((g) => (g.id === id ? { ...g, done: !g.done } : g));
  }

  /** Entfernt ein Ziel anhand seiner id. Reine Funktion. */
  function removeGoal(goals, id) {
    return (goals || []).filter((g) => g.id !== id);
  }

  /**
   * Setzt an einem neuen Tag alle Haken zurück (die Ziel-Texte bleiben erhalten,
   * damit wiederkehrende Ziele nicht neu getippt werden müssen). Reine Funktion.
   */
  function resetGoalsForNewDay(goals, savedDate, today) {
    if (savedDate === today) return goals || [];
    return (goals || []).map((g) => ({ ...g, done: false }));
  }

  /**
   * Gesamt-Fortschritt über eine (bereits mit done angereicherte) Liste
   * (Prüfungen ODER Lernziele). Gibt { done, total, ratio, allDone } zurück.
   */
  function examProgress(examList) {
    const list = examList || [];
    const done = list.filter((e) => e.done).length;
    const total = list.length;
    return {
      done,
      total,
      ratio: total ? done / total : 0,
      allDone: total > 0 && done === total,
    };
  }

  /* ---------------------------------------------------------
   * Motivationssprüche
   * Datenstruktur mit Typ-Tag: 'motivation' (der Großteil) oder
   * 'insider' (liebevoll-neckende Anspielungen, statistisch selten ~10%).
   * DOGNAME wird in ui.js durch den Hundenamen ersetzt.
   * --------------------------------------------------------- */

  const QUOTES = [
    // ---- motivation ----
    { text: "Du hast schon so viel gelernt — jetzt zeigst du es einfach nur noch.", type: "motivation" },
    { text: "Referendar:innen und Schüler:innen können sich schon auf dich freuen.", type: "motivation" },
    { text: "DOGNAME sagt: Wuff bedeutet auf Hundisch \"Du rockst das\"!", type: "motivation" },
    { text: "Ett Staatsexamen är bara en dag — dein Können ist von Dauer.", type: "motivation" },
    { text: "Tief durchatmen. Du bist vorbereiteter, als du gerade denkst.", type: "motivation" },
    { text: "Nicht perfekt sein müssen. Nur du selbst sein müssen — das reicht.", type: "motivation" },
    { text: "Jede Karteikarte, jede Nachtschicht zahlt sich jetzt aus.", type: "motivation" },
    { text: "Du wirst eine Lehrkraft, an die sich Kinder noch mit 30 erinnern.", type: "motivation" },
    { text: "Kurze Pause gefällig? Auch Profis brauchen Gassi-Runden — fika hilft auch.", type: "motivation" },
    { text: "Fehler sind erlaubt. Aufgeben nicht.", type: "motivation" },
    { text: "Lycka till! Stell dir vor, wie du nach der letzten Prüfung feierst. Genau dahin gehst du.", type: "motivation" },
    { text: "DOGNAME glaubt fest an dich. Und DOGNAME hat immer recht.", type: "motivation" },
    { text: "Du musst nicht alles wissen. Du musst nur zeigen, was du kannst.", type: "motivation" },
    { text: "Ruhig bleiben, Haltung bewahren, liefern — genau wie im Klassenzimmer.", type: "motivation" },
    { text: "Du fixar det! (Das heißt auf Schwedisch: Du schaffst das.)", type: "motivation" },
    { text: "Eine Prüfung nach der anderen. Du musst nicht alle heute bestehen.", type: "motivation" },
    { text: "Dein zukünftiges Ich sitzt schon im Lehrerzimmer und ist mächtig stolz auf dich.", type: "motivation" },
    { text: "Angst ist nur Aufregung ohne Sauerstoff. Also: tief einatmen, Schultern zurück.", type: "motivation" },
    { text: "Du hast dir das nicht ausgesucht, weil es leicht ist — sondern weil du es kannst.", type: "motivation" },
    { text: "Zweifel klopfen bei jedem an. Du machst ihnen einfach nicht auf.", type: "motivation" },
    { text: "Das Wissen ist längst in deinem Kopf. Heute holst du es nur ab.", type: "motivation" },
    { text: "Stolpern ist kein Hinfallen. Weitergehen zählt, nicht makellos gehen.", type: "motivation" },
    { text: "Denk an all die Male, an denen du dachtest, du schaffst es nicht — und es dann geschafft hast.", type: "motivation" },
    { text: "Du bist keine Prüfungsnummer. Du bist die Lehrerin, die manche Kinder retten wird.", type: "motivation" },
    { text: "Gib heute nicht 100 %. Gib das, was du hast — und das ist genug.", type: "motivation" },
    { text: "Ein schlechtes Gefühl ist keine schlechte Note. Vertrau dem, was du geübt hast.", type: "motivation" },
    { text: "Nach dem Regen kommt fika. Und nach dem Examen ein riesengroßes Aufatmen.", type: "motivation" },
    { text: "Du trägst all die Nächte des Lernens in dir. Niemand kann dir das mehr nehmen.", type: "motivation" },
    { text: "Kopf hoch, Krone richten, weitergehen. Du machst das mit Bravour.", type: "motivation" },
    { text: "Am Ende dieser Prüfungen wartet genau das Leben, für das du so hart gearbeitet hast.", type: "motivation" },
    { text: "Schritt für Schritt, Seite für Seite — so wird aus Aufregung ein Diplom.", type: "motivation" },
    { text: "Lampenfieber heißt nur, dass dir dein Traum wichtig ist. Und das ist er.", type: "motivation" },
    { text: "Was du heute nicht weißt, wiegt weniger als alles, was du längst kannst.", type: "motivation" },
    { text: "Die Kinder da draußen brauchen genau eine Lehrerin wie dich.", type: "motivation" },
    { text: "Erst der Berg, dann die Aussicht — und du bist schon fast oben.", type: "motivation" },
    { text: "Prüfungstag ist Showtime. Und du hast monatelang dafür geprobt.", type: "motivation" },
    { text: "Vertrau deinem Bauchgefühl: Es hat die ganze Zeit mit dir gelernt.", type: "motivation" },
    { text: "Ett steg i taget — ein Schritt nach dem anderen, sagt man in Schweden.", type: "motivation" },
    { text: "Du bist nicht nervös. Du bist bereit, nur mit ein bisschen Herzklopfen.", type: "motivation" },
    { text: "Morgen erzählst du, wie du es geschafft hast. Heute machst du es einfach.", type: "motivation" },
    { text: "Auch der längste Lerntag hat irgendwann Feierabend. Halt noch kurz durch.", type: "motivation" },
    { text: "Sei stolz, wie weit du gekommen bist — der Rest ist nur noch Zielgerade.", type: "motivation" },
    { text: "Kaffee leer, Kopf voll, Herz am rechten Fleck — auf geht’s.", type: "motivation" },
    { text: "Du hast schon schwerere Tage gemeistert, an denen dir keiner applaudiert hat.", type: "motivation" },
    { text: "Atme ein: Ich schaffe das. Atme aus: Ich schaffe das schon längst.", type: "motivation" },
    // ---- insider (max. ~10 %, liebevoll-neckend) ----
    { text: "Prüfungsstoff ist wie Garnelen: sieht manchmal aus wie eklige Regenwürmer, ist am Ende aber ein Festmahl. 🦐", type: "insider" },
    { text: "Du pflegst deinen Prüfungsstoff so hingebungsvoll wie deine Regale voller Pflegeprodukte — mit ganz viel Liebe (und leicht übertriebenem Fan-Sein 😄).", type: "insider" },
    { text: "Du musst gar nicht viel reden — du sagst eh nur das Nötige, und das sitzt. Wortkarg, aber wirkungsvoll. 🎯", type: "insider" },
  ];

  /**
   * Wählt zufällig einen Spruch aus. rng ist injizierbar (für Tests),
   * Standard ist Math.random. Gibt das komplette Spruch-Objekt zurück.
   */
  function pickRandomQuote(quotes, rng) {
    const list = quotes || [];
    if (list.length === 0) return null;
    const r = typeof rng === 'function' ? rng : Math.random;
    const idx = Math.floor(r() * list.length);
    return list[Math.min(idx, list.length - 1)];
  }

  /**
   * Mischt ein Array (Fisher-Yates) und gibt eine NEUE Liste zurück
   * (verändert das Original nicht). rng ist injizierbar für Tests.
   * Wird für den "Misch-Stapel" in ui.js genutzt, damit sich kein Spruch
   * wiederholt, bevor nicht alle einmal dran waren.
   */
  function shuffle(arr, rng) {
    const r = typeof rng === 'function' ? rng : Math.random;
    const a = [...(arr || [])];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  /**
   * Anteil der Sprüche mit type === 'motivation' (0..1).
   * Schützt vor Regression, falls später zu viele Insider-Sprüche dazukommen.
   */
  function quoteMotivationRatio(quotes) {
    const list = quotes || [];
    if (list.length === 0) return 0;
    const motivation = list.filter((q) => q.type === 'motivation').length;
    return motivation / list.length;
  }

  /* ---------------------------------------------------------
   * Skin-System für Henry
   * --------------------------------------------------------- */

  const SKIN_DEFS = [
    { id: 'standard',    label: 'Standard-Henry',  unlock: null,     hint: 'Henry pur, mit Doktorhut.' },
    { id: 'buecherwurm', label: 'Bücherwurm',      unlock: null,     hint: 'Lesebrille & Buch — Leseratten-Vibe.' },
    { id: 'pflanzen',    label: 'Pflanzen-Power',  unlock: null,     hint: 'Blätterkranz statt Hut, kleine Ranke.' },
    { id: 'schweden',    label: 'Schweden-Modus',  unlock: null,     hint: 'Blau-gelbes Halstuch & Dalapferd.' },
    { id: 'bronze',      label: 'Bronze-Genie',    unlock: 'stage1', hint: 'Nach dem 1. Staatsexamen.' },
    { id: 'superheld',   label: 'Superheld Henry', unlock: 'stage2', hint: 'Nach dem 2. Staatsexamen.' },
    { id: 'lehrer',      label: 'Lehrer Henry',    unlock: 'stage3', hint: 'Nach dem 3. Staatsexamen.' },
    { id: 'champion',    label: 'Champion Henry',  unlock: 'all',    hint: 'Wenn alle drei bestanden sind.' },
  ];

  /**
   * examIds = [id_1.Staatsexamen, id_2.Staatsexamen, id_3.Staatsexamen] in fester Reihenfolge.
   * Liefert die Freischalt-Flags basierend auf der doneMap.
   */
  function computeExamUnlocks(doneMap, examIds) {
    const flags = (examIds || []).map((id) => Boolean((doneMap || {})[id]));
    return {
      stage1: Boolean(flags[0]),
      stage2: Boolean(flags[1]),
      stage3: Boolean(flags[2]),
      all: flags.length === 3 && flags.every(Boolean),
    };
  }

  /**
   * Fällt automatisch auf 'standard' zurück, falls der Skin (noch) gesperrt ist —
   * wichtig auch, falls ein Haken versehentlich wieder entfernt wird.
   */
  function resolveSkin(requestedId, unlocks, skinDefs) {
    const defs = skinDefs || SKIN_DEFS;
    const def = defs.find((s) => s.id === requestedId);
    if (!def) return 'standard';
    if (!def.unlock) return requestedId;
    if (!unlocks || !unlocks[def.unlock]) return 'standard';
    return requestedId;
  }

  /* ---------------------------------------------------------
   * Persistenz (localStorage) — nur im Browser nutzbar
   * --------------------------------------------------------- */

  const STORAGE_KEYS = {
    customExams: 'celine-exam-app__custom-exams-v1',
    doneMap: 'celine-exam-app__done-map-v1',
    skin: 'celine-exam-app__skin-v1',
    goals: 'celine-exam-app__goals-v1',
    goalsDate: 'celine-exam-app__goals-date-v1',
  };

  function loadFromStorage(storage, key, fallback) {
    try {
      const raw = storage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (err) {
      return fallback;
    }
  }

  function saveToStorage(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  return {
    slugify,
    makeExamId,
    isValidDateString,
    formatCountdown,
    msUntil,
    formatExamDate,
    buildExamList,
    validateExamInput,
    addCustomExam,
    removeCustomExam,
    toggleDoneMap,
    examProgress,
    todayStamp,
    addGoal,
    toggleGoal,
    removeGoal,
    resetGoalsForNewDay,
    QUOTES,
    pickRandomQuote,
    quoteMotivationRatio,
    shuffle,
    SKIN_DEFS,
    computeExamUnlocks,
    resolveSkin,
    loadFromStorage,
    saveToStorage,
    STORAGE_KEYS,
  };
});
