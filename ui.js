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
  let requestedSkin = A.loadFromStorage(storage, A.STORAGE_KEYS.skin, 'standard');
  // id des Termins, der gerade eine Bestätigungs-Nachfrage anzeigt (Abhaken/Rückgängig)
  let pendingConfirmId = null;

  // Tages-Lernziele laden; an einem neuen Tag werden die Haken zurückgesetzt.
  const todayStr = A.todayStamp(new Date());
  let goals = A.loadFromStorage(storage, A.STORAGE_KEYS.goals, []);
  const savedGoalsDate = A.loadFromStorage(storage, A.STORAGE_KEYS.goalsDate, null);
  goals = A.resetGoalsForNewDay(goals, savedGoalsDate, todayStr);

  // Die drei festen Staatsexamen in fester Reihenfolge -> steuern die Skin-Freischaltung.
  const examIds = CONFIG.exams.map((e) => A.makeExamId(e.label, e.date));
  // Anzahl bereits freigeschalteter Skins (um neue Freischaltungen zu erkennen)
  let lastUnlockedCount = 0;

  function persist() {
    A.saveToStorage(storage, A.STORAGE_KEYS.customExams, customExams);
    A.saveToStorage(storage, A.STORAGE_KEYS.doneMap, doneMap);
    A.saveToStorage(storage, A.STORAGE_KEYS.skin, requestedSkin);
  }

  function persistGoals() {
    A.saveToStorage(storage, A.STORAGE_KEYS.goals, goals);
    A.saveToStorage(storage, A.STORAGE_KEYS.goalsDate, todayStr);
  }

  function currentUnlocks() {
    return A.computeExamUnlocks(doneMap, examIds);
  }
  function countUnlockedSkins() {
    const u = currentUnlocks();
    return A.SKIN_DEFS.filter((s) => !s.unlock || u[s.unlock]).length;
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

    const dateLine = A.formatExamDate(exam.date);
    if (dateLine) {
      const dateEl = document.createElement('div');
      dateEl.className = 'exam-date';
      dateEl.textContent = dateLine;
      card.appendChild(dateEl);
    }

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

  const progressChip = document.getElementById('progressChip');
  const progressDots = document.getElementById('progressDots');
  const progressText = document.getElementById('progressText');

  function renderProgress(list) {
    const p = A.examProgress(list);
    progressDots.innerHTML = '';
    for (let i = 0; i < p.total; i++) {
      const dot = document.createElement('span');
      dot.className = 'pdot' + (i < p.done ? ' filled' : '');
      progressDots.appendChild(dot);
    }
    if (p.total === 0) {
      progressText.textContent = 'Trag deine Prüfungen ein — los geht’s! 🎓';
    } else if (p.allDone) {
      progressText.textContent = `Alle ${p.total} geschafft — du bist offiziell fertig! 🎓🏆`;
    } else if (p.done === 0) {
      progressText.textContent = `0 von ${p.total} geschafft — aber das ändert sich bald! 💪`;
    } else {
      progressText.textContent = `Geschafft: ${p.done} von ${p.total} Prüfungen 🎉`;
    }
    progressChip.classList.toggle('is-complete', p.allDone);
  }

  function renderAll() {
    const list = A.buildExamList(CONFIG.exams, customExams, doneMap);
    countdownsEl.innerHTML = '';
    list.forEach((exam) => countdownsEl.appendChild(renderExamCard(exam)));
    renderProgress(list);
    applySkin();
    if (!skinModal.hidden) renderSkinGrid();
    tickTimers();
  }

  /* -------- Skin auf Henry anwenden -------- */
  function applySkin() {
    const resolved = A.resolveSkin(requestedSkin, currentUnlocks());
    dog.dataset.skin = resolved;
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

  /* -------- Tages-Lernziele -------- */
  const goalForm = document.getElementById('goalForm');
  const goalInput = document.getElementById('goalInput');
  const goalsList = document.getElementById('goalsList');
  const goalsCount = document.getElementById('goalsCount');
  const goalsEmpty = document.getElementById('goalsEmpty');

  function renderGoals() {
    goalsList.innerHTML = '';
    goals.forEach((g) => {
      const li = document.createElement('li');
      li.className = 'goal-item' + (g.done ? ' is-done' : '');
      const cid = `goal-${g.id}`;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'goal-check';
      cb.id = cid;
      cb.checked = g.done;
      cb.setAttribute('aria-label', `"${g.text}" als erledigt markieren`);
      cb.addEventListener('change', () => {
        goals = A.toggleGoal(goals, g.id);
        persistGoals();
        renderGoals();
        const p = A.examProgress(goals);
        if (p.allDone && p.total > 0) {
          popBubble(`Alle Lernziele für heute geschafft! ${CONFIG.dogName} ist mega stolz auf dich. 🎉`);
        }
      });

      const label = document.createElement('label');
      label.className = 'goal-text';
      label.setAttribute('for', cid);
      label.textContent = g.text;

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'goal-remove';
      del.textContent = '✕';
      del.setAttribute('aria-label', `"${g.text}" entfernen`);
      del.addEventListener('click', () => {
        goals = A.removeGoal(goals, g.id);
        persistGoals();
        renderGoals();
      });

      li.append(cb, label, del);
      goalsList.appendChild(li);
    });

    const p = A.examProgress(goals);
    if (p.total === 0) {
      goalsCount.textContent = '';
      goalsCount.classList.remove('is-complete');
      goalsEmpty.hidden = false;
    } else {
      goalsCount.textContent = `${p.done}/${p.total} geschafft`;
      goalsCount.classList.toggle('is-complete', p.allDone);
      goalsEmpty.hidden = true;
    }
  }

  goalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!goalInput.value.trim()) return;
    const id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    goals = A.addGoal(goals, goalInput.value, id);
    persistGoals();
    goalInput.value = '';
    renderGoals();
  });

  /* -------- Sprüche (Datenstruktur + Auswahl kommen aus app.js) --------
     "Misch-Stapel": Alle Sprüche werden gemischt und der Reihe nach gezeigt.
     Erst wenn der Stapel leer ist, wird neu gemischt — so wiederholt sich kein
     Spruch, bevor nicht alle einmal dran waren. */
  const bubble = document.getElementById('bubble');
  let quoteBag = [];
  let lastQuoteText = null;

  function nextQuote() {
    if (quoteBag.length === 0) {
      quoteBag = A.shuffle(A.QUOTES);
      // Verhindern, dass direkt nach dem Neumischen derselbe Spruch wie zuletzt kommt.
      if (quoteBag.length > 1 && quoteBag[quoteBag.length - 1].text === lastQuoteText) {
        quoteBag.unshift(quoteBag.pop());
      }
    }
    return quoteBag.pop();
  }

  function showQuote() {
    const quote = nextQuote();
    if (!quote) return;
    lastQuoteText = quote.text;
    bubble.textContent = quote.text.replaceAll('DOGNAME', CONFIG.dogName);
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

  function popBubble(text) {
    bubble.textContent = text;
    bubble.classList.remove('pop');
    void bubble.offsetWidth;
    bubble.classList.add('pop');
  }

  function celebrateExam(examLabel) {
    launchConfetti();
    dog.classList.add('happy');
    setTimeout(() => dog.classList.remove('happy'), 700);
    popBubble(`${CONFIG.dogName} dreht durch vor Stolz: "${examLabel}" ist geschafft! 🎉🎓`);

    // Neue Skins freigeschaltet? -> Hinweis-Badge am Kleiderhaken + Nachricht
    const nowCount = countUnlockedSkins();
    if (nowCount > lastUnlockedCount) {
      skinBtn.classList.add('has-new');
      setTimeout(() => {
        popBubble(`Neuer Skin für ${CONFIG.dogName} freigeschaltet! Tipp oben rechts auf den 🧥-Kleiderhaken. 🎁`);
      }, 2600);
    }
    lastUnlockedCount = nowCount;
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

  /* -------- Skin-System: Kleiderhaken-Modal -------- */
  const skinBtn = document.getElementById('skinBtn');
  const skinModal = document.getElementById('skinModal');
  const skinBackdrop = document.getElementById('skinBackdrop');
  const skinClose = document.getElementById('skinClose');
  const skinGrid = document.getElementById('skinGrid');

  const SKIN_EMOJI = {
    standard: '🎓', buecherwurm: '📖', pflanzen: '🌿', schweden: '🇸🇪',
    bronze: '🥉', superheld: '🦸', lehrer: '👓', champion: '👑',
  };

  // Klont den echten Henry als kleines, statisches Vorschau-Männchen für eine Kachel.
  function makeMiniDog(skinId) {
    const mini = dog.cloneNode(true);
    mini.removeAttribute('id');
    mini.removeAttribute('role');
    mini.removeAttribute('tabindex');
    mini.removeAttribute('aria-label');
    mini.classList.remove('happy');
    mini.classList.add('mini');
    mini.dataset.skin = skinId;
    return mini;
  }

  function renderSkinGrid() {
    const unlocks = currentUnlocks();
    skinGrid.innerHTML = '';
    A.SKIN_DEFS.forEach((def) => {
      const unlocked = !def.unlock || Boolean(unlocks[def.unlock]);
      const isActive = unlocked && A.resolveSkin(requestedSkin, unlocks) === def.id;

      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'skin-tile'
        + (isActive ? ' is-active' : '')
        + (unlocked ? '' : ' is-locked');
      tile.dataset.skin = def.id;
      tile.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      if (!unlocked) tile.setAttribute('aria-disabled', 'true');

      let badge;
      if (!unlocked) badge = '<span class="tile-badge">🔒 gesperrt</span>';
      else if (isActive) badge = '<span class="tile-badge">Aktiv</span>';
      else badge = '<span class="tile-badge">Anziehen</span>';

      tile.innerHTML = `
        <span class="tile-emoji"></span>
        <span class="tile-body">
          <span class="tile-name">${def.label}</span>
          <span class="tile-hint">${def.hint}</span>
        </span>
        ${badge}
      `;

      // Emoji-Slot füllen: freigeschaltet -> echter Mini-Henry im jeweiligen Skin,
      // gesperrt -> Schloss (bleibt eine kleine Überraschung).
      const slot = tile.querySelector('.tile-emoji');
      if (unlocked) {
        slot.classList.add('has-dog');
        slot.appendChild(makeMiniDog(def.id));
      } else {
        slot.textContent = '🔒';
      }

      tile.addEventListener('click', () => {
        if (!unlocked) {
          popBubble(`Diesen Skin schaltest du frei: ${def.hint} 💪`);
          return;
        }
        requestedSkin = def.id;
        persist();
        applySkin();
        renderSkinGrid();
        popBubble(`${CONFIG.dogName} trägt jetzt: ${def.label}! ${SKIN_EMOJI[def.id]}`);
      });

      skinGrid.appendChild(tile);
    });
  }

  function openSkinModal() {
    renderSkinGrid();
    skinModal.hidden = false;
    skinBtn.classList.remove('has-new');
    skinClose.focus();
  }
  function closeSkinModal() {
    skinModal.hidden = true;
    skinBtn.focus();
  }
  skinBtn.addEventListener('click', openSkinModal);
  skinClose.addEventListener('click', closeSkinModal);
  skinBackdrop.addEventListener('click', closeSkinModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !skinModal.hidden) closeSkinModal();
  });

  /* -------- Initialisierung (nachdem alle Elemente/Handler bereit sind) -------- */
  lastUnlockedCount = countUnlockedSkins();
  renderAll();
  renderGoals();
  persistGoals(); // sichert ggf. den zurückgesetzten Tages-Stand
  setInterval(tickTimers, 1000);
  showQuote();
})();
