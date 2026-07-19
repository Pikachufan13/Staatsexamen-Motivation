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
   * Persistenz (localStorage) — nur im Browser nutzbar
   * --------------------------------------------------------- */

  const STORAGE_KEYS = {
    customExams: 'celine-exam-app__custom-exams-v1',
    doneMap: 'celine-exam-app__done-map-v1',
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
    buildExamList,
    validateExamInput,
    addCustomExam,
    removeCustomExam,
    toggleDoneMap,
    loadFromStorage,
    saveToStorage,
    STORAGE_KEYS,
  };
});
