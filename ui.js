/**
 * ui.js — DOM-Anbindung. Nutzt ausschließlich die reinen, getesteten
 * Funktionen aus app.js (window.ExamApp). Enthält selbst keine Business-Logik,
 * damit die Testsuite (tests/app.test.js) die eigentliche Logik unabhängig
 * vom Browser prüfen kann.
 */
(function () {
  'use strict';

  /* ======================================================
     🐾 HIER ANPASSEN — Personalisierung
     ====================================================== */
  const CONFIG = {
    name: "Celine",
    dogName: "Henry",
    signOff: "Ich drück dir ganz fest die Daumen — du bist bereit für das hier.",
    // Feste Prüfungstermine. Celine kann über die App zusätzlich eigene
    // Termine eintragen — die werden separat gespeichert (siehe README).
    exams: [
      { label: "1. Staatsexamen", date: "2026-07-22T08:00:00" },
      { label: "2. Staatsexamen", date: "2026-07-27T08:00:00" },
      { label: "3. Staatsexamen", date: "2026-09-11T08:00:00" },
    ],
  };
  /* ====================================================== */

  const A = window.ExamApp;
  const storage = window.localStorage;

  document.getElementById('nameSlot').textContent = CONFIG.name;
  document.getElementById('dogName').textContent = `— ${CONFIG.dogName}, dein treuester Fan —`;
  document.getElementById('signature').textContent = CONFIG.signOff;

  /* -------- Lichterkette -------- */
  const lightsEl = document.getElementById('lights');
  for (let i = 0; i < 14; i++) {
    const b = document.createElement('div');
    b.className = 'bulb';
    lightsEl.appendChild(b);
  }

  /* -------- State laden -------- */
  let customExams = A.loadFromStorage(storage, A.STORAGE_KEYS.customExams, []);
  let doneMap = A.loadFromStorage(storage, A.STORAGE_KEYS.doneMap, {});
  // id des Termins, der gerade eine Bestätigungs-Nachfrage anzeigt (Abhaken/Rückgängig)
  let pendingConfirmId = null;

  function persist() {
    A.saveToStorage(storage, A.STORAGE_KEYS.customExams, customExams);
    A.saveToStorage(storage, A.STORAGE_KEYS.doneMap, doneMap);
  }

  /* -------- Countdown + Prüfungsliste rendern -------- */
  const countdownsEl = document.getElementById('countdowns');
  const pad = (n) => String(n).padStart(2, '0');

  function renderExamCard(exam) {
    const card = document.createElement('div');
    card.className = 'exam-card' + (exam.done ? ' is-done' : '') + (exam.source === 'custom' ? ' is-custom' : '');
    card.dataset.id = exam.id;

    const top = document.createElement('div');
    top.className = 'exam-top-row';

    const label = document.createElement('div');
    label.className = 'exam-label';
    label.textContent = exam.label;
    top.appendChild(label);

    if (exam.source === 'custom') {
      const del = document.createElement('button');
      del.className = 'remove-custom';
      del.type = 'button';
      del.setAttribute('aria-label', `${exam.label} löschen`);
      del.textContent = '✕';
      del.addEventListener('click', () => {
        if (window.confirm(`"${exam.label}" wirklich löschen?`)) {
          customExams = A.removeCustomExam(customExams, exam.id);
          persist();
          renderAll();
        }
      });
      top.appendChild(del);
    }
    card.appendChild(top);

    const timer = document.createElement('div');
    timer.className = 'exam-timer';
    timer.id = `timer-${exam.id}`;
    card.appendChild(timer);

    // Abhak-Bereich
    const toggleRow = document.createElement('div');
    toggleRow.className = 'done-toggle';
    const checkId = `chk-${exam.id}`;
    toggleRow.innerHTML = `
      <input type="checkbox" class="done-check" id="${checkId}" ${exam.done ? 'checked' : ''} aria-describedby="${checkId}-label">
      <label for="${checkId}" id="${checkId}-label">${exam.done ? 'Geschafft! 🎉' : 'Als bestanden markieren'}</label>
    `;
    card.appendChild(toggleRow);

    const checkbox = toggleRow.querySelector('.done-check');
    // Klick abfangen: statt direkt umzuschalten, erst Bestätigung einholen.
    checkbox.addEventListener('click', (e) => {
      e.preventDefault();
      pendingConfirmId = pendingConfirmId === exam.id ? null : exam.id;
      renderAll();
    });

    if (pendingConfirmId === exam.id) {
      const confirmRow = document.createElement('div');
      confirmRow.className = 'confirm-row';
      const msg = exam.done
        ? 'Haken wirklich wieder entfernen?'
        : 'War\'s das — hast du sie wirklich bestanden? 🎓';
      confirmRow.innerHTML = `
        <span>${msg}</span>
        <button type="button" class="mini-btn yes">${exam.done ? 'Ja, entfernen' : 'Ja, bestanden!'}</button>
        <button type="button" class="mini-btn no">Abbrechen</button>
      `;
      confirmRow.querySelector('.yes').addEventListener('click', () => {
        const wasDone = exam.done;
        doneMap = A.toggleDoneMap(doneMap, exam.id);
        pendingConfirmId = null;
        persist();
        renderAll();
        if (!wasDone) celebrateExam(exam.label);
      });
      confirmRow.querySelector('.no').addEventListener('click', () => {
        pendingConfirmId = null;
        renderAll();
      });
      card.appendChild(confirmRow);
    }

    return card;
  }

  function renderAll() {
    const list = A.buildExamList(CONFIG.exams, customExams, doneMap);
    countdownsEl.innerHTML = '';
    list.forEach((exam) => countdownsEl.appendChild(renderExamCard(exam)));
    tickTimers();
  }

  function tickTimers() {
    const list = A.buildExamList(CONFIG.exams, customExams, doneMap);
    list.forEach((exam) => {
      const el = document.getElementById(`timer-${exam.id}`);
      if (!el) return;
      if (exam.done) {
        el.innerHTML = `<span class="exam-done-text">Bestanden! 🥳</span>`;
        return;
      }
      const diff = A.msUntil(exam.date, new Date());
      const c = A.formatCountdown(diff);
      if (c.isPast) {
        el.innerHTML = `<span class="exam-done-text">Geschafft — Ergebnis abwarten! 🤞</span>`;
        return;
      }
      el.innerHTML = `
        <span class="unit">${c.days}</span>T
        <span class="unit">${pad(c.hours)}</span>:<span class="unit">${pad(c.mins)}</span>:<span class="unit">${pad(c.secs)}</span>
        <small>TAGE&nbsp;&nbsp;STD:MIN:SEK</small>
      `;
    });
  }

  renderAll();
  setInterval(tickTimers, 1000);

  /* -------- Eigene Prüfung hinzufügen -------- */
  const addForm = document.getElementById('addExamForm');
  const addLabelInput = document.getElementById('addExamLabel');
  const addDateInput = document.getElementById('addExamDate');
  const addError = document.getElementById('addExamError');

  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const label = addLabelInput.value;
    const dateVal = addDateInput.value; // "YYYY-MM-DD" vom <input type=date>
    const dateStr = dateVal ? `${dateVal}T08:00:00` : '';

    const existing = A.buildExamList(CONFIG.exams, customExams, doneMap);
    const validation = A.validateExamInput(label, dateStr, existing);
    if (!validation.valid) {
      addError.textContent = validation.error;
      return;
    }
    addError.textContent = '';
    customExams = A.addCustomExam(customExams, label, dateStr);
    persist();
    addLabelInput.value = '';
    addDateInput.value = '';
    renderAll();
    showQuote();
  });

  /* -------- Sprüche -------- */
  const QUOTES = [
    "Du hast schon so viel gelernt — jetzt zeigst du es einfach nur noch.",
    "Referendar:innen und Schüler:innen können sich schon auf dich freuen.",
    "DOGNAME sagt: Wuff bedeutet auf Hundisch \"Du rockst das\"!",
    "Ett Staatsexamen är bara en dag — dein Können ist von Dauer.",
    "Tief durchatmen. Du bist vorbereiteter, als du gerade denkst.",
    "Nicht perfekt sein müssen. Nur du selbst sein müssen — das reicht.",
    "Jede Karteikarte, jede Nachtschicht zahlt sich jetzt aus.",
    "Du wirst eine Lehrkraft, an die sich Kinder noch mit 30 erinnern.",
    "Kurze Pause gefällig? Auch Profis brauchen Gassi-Runden — fika hilft auch.",
    "Fehler sind erlaubt. Aufgeben nicht.",
    "Lycka till! Stell dir vor, wie du nach der letzten Prüfung feierst. Genau dahin gehst du.",
    "DOGNAME glaubt fest an dich. Und DOGNAME hat immer recht.",
    "Du musst nicht alles wissen. Du musst nur zeigen, was du kannst.",
    "Ruhig bleiben, Haltung bewahren, liefern — genau wie im Klassenzimmer.",
    "Du fixar det! (Das heißt auf Schwedisch: Du schaffst das.)",
  ];

  const bubble = document.getElementById('bubble');
  function showQuote() {
    const raw = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    bubble.textContent = raw.replaceAll('DOGNAME', CONFIG.dogName);
    bubble.classList.remove('pop');
    void bubble.offsetWidth;
    bubble.classList.add('pop');
  }
  document.getElementById('quoteBtn').addEventListener('click', showQuote);

  /* -------- Hund interagieren -------- */
  const dog = document.getElementById('dog');
  const powerFill = document.getElementById('powerFill');
  const powerPct = document.getElementById('powerPct');
  let power = 0;

  function spawnHeart() {
    const h = document.createElement('div');
    h.className = 'heart';
    h.textContent = ['💛', '🤎', '✨', '🐾'][Math.floor(Math.random() * 4)];
    h.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px');
    h.style.left = (50 + (Math.random() * 20 - 10)) + '%';
    dog.parentElement.appendChild(h);
    setTimeout(() => h.remove(), 1150);
  }

  function pet() {
    dog.classList.add('happy');
    setTimeout(() => dog.classList.remove('happy'), 400);
    spawnHeart();
    showQuote();
    power = Math.min(100, power + 12);
    powerFill.style.width = power + '%';
    powerPct.textContent = Math.round(power) + '%';
    if (power >= 100) {
      launchConfetti();
      bubble.textContent = `Pfoten-Power-Meter voll! ${CONFIG.dogName} und ich feiern dich gerade richtig! 🎉`;
      setTimeout(() => { power = 0; powerFill.style.width = '0%'; powerPct.textContent = '0%'; }, 1600);
    }
  }
  dog.addEventListener('click', pet);
  dog.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pet(); } });

  function celebrateExam(examLabel) {
    launchConfetti();
    dog.classList.add('happy');
    setTimeout(() => dog.classList.remove('happy'), 700);
    bubble.textContent = `${CONFIG.dogName} dreht durch vor Stolz: "${examLabel}" ist geschafft! 🎉🎓`;
    bubble.classList.remove('pop');
    void bubble.offsetWidth;
    bubble.classList.add('pop');
  }

  /* -------- Konfetti -------- */
  const CONFETTI_COLORS = ['#E8B34A', '#F4EFE1', '#9CC2A6', '#C9835F', '#006AA7', '#FECC02'];
  function launchConfetti() {
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      p.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
      p.style.opacity = String(0.7 + Math.random() * 0.3);
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 4200);
    }
  }
  document.getElementById('confettiBtn').addEventListener('click', launchConfetti);

  // Erster Spruch beim Laden
  showQuote();
})();
