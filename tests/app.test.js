const test = require('node:test');
const assert = require('node:assert/strict');
const ExamApp = require('../app.js');

/* ---------------------------------------------------------
 * kleine In-Memory-Storage-Attrappe für localStorage-Tests
 * --------------------------------------------------------- */
function makeFakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    _dump: () => Object.fromEntries(data),
  };
}

/* ---------------------------------------------------------
 * slugify / makeExamId
 * --------------------------------------------------------- */

test('slugify: macht lesbare, sichere IDs aus Text', () => {
  assert.equal(ExamApp.slugify('1. Staatsexamen'), '1-staatsexamen');
  assert.equal(ExamApp.slugify('Prüfung Nr. 2!!'), 'prufung-nr-2');
  assert.equal(ExamApp.slugify(''), 'termin');
});

test('makeExamId: gleiche Eingaben ergeben gleiche ID (Duplikat-Erkennung)', () => {
  const id1 = ExamApp.makeExamId('2. Staatsexamen', '2026-07-27T08:00:00');
  const id2 = ExamApp.makeExamId('2. Staatsexamen', '2026-07-27T08:00:00');
  assert.equal(id1, id2);
});

/* ---------------------------------------------------------
 * formatCountdown
 * --------------------------------------------------------- */

test('formatCountdown: zerlegt Millisekunden korrekt in T/Std/Min/Sek', () => {
  const twoDays = 2 * 86400000;
  const threeHours = 3 * 3600000;
  const fourMins = 4 * 60000;
  const fiveSecs = 5 * 1000;
  const result = ExamApp.formatCountdown(twoDays + threeHours + fourMins + fiveSecs);
  assert.deepEqual(result, { isPast: false, days: 2, hours: 3, mins: 4, secs: 5 });
});

test('formatCountdown: Vergangenheit wird als isPast markiert, keine negativen Werte', () => {
  const result = ExamApp.formatCountdown(-5000);
  assert.equal(result.isPast, true);
  assert.equal(result.days, 0);
  assert.equal(result.hours, 0);
  assert.equal(result.mins, 0);
  assert.equal(result.secs, 0);
});

test('formatCountdown: 0 ms gilt ebenfalls als isPast (Prüfung beginnt jetzt)', () => {
  assert.equal(ExamApp.formatCountdown(0).isPast, true);
});

test('formatCountdown: wirft bei ungültiger Eingabe einen Fehler statt stillem NaN', () => {
  assert.throws(() => ExamApp.formatCountdown('abc'));
  assert.throws(() => ExamApp.formatCountdown(undefined));
});

test('msUntil: berechnet die Differenz zwischen Datum und "jetzt" korrekt', () => {
  const now = new Date('2026-07-20T08:00:00');
  const diff = ExamApp.msUntil('2026-07-22T08:00:00', now);
  assert.equal(diff, 2 * 86400000);
});

/* ---------------------------------------------------------
 * formatExamDate
 * --------------------------------------------------------- */

test('formatExamDate: formatiert ein festes Datum als "TT.MM.JJJJ, HH:MM Uhr"', () => {
  assert.equal(ExamApp.formatExamDate('2026-07-22T08:00:00'), '22.07.2026, 08:00 Uhr');
});

test('formatExamDate: berücksichtigt die Uhrzeit', () => {
  assert.equal(ExamApp.formatExamDate('2026-09-11T14:30:00'), '11.09.2026, 14:30 Uhr');
});

test('formatExamDate: ungültiges Datum ergibt leeren String (kein Absturz)', () => {
  assert.equal(ExamApp.formatExamDate('kein-datum'), '');
});

/* ---------------------------------------------------------
 * Sprüche: pickRandomQuote / quoteMotivationRatio
 * --------------------------------------------------------- */

test('pickRandomQuote: wählt anhand des injizierten rng deterministisch', () => {
  const quotes = [
    { text: 'A', type: 'motivation' },
    { text: 'B', type: 'motivation' },
    { text: 'C', type: 'insider' },
  ];
  assert.equal(ExamApp.pickRandomQuote(quotes, () => 0).text, 'A');
  assert.equal(ExamApp.pickRandomQuote(quotes, () => 0.5).text, 'B');
  assert.equal(ExamApp.pickRandomQuote(quotes, () => 0.999).text, 'C');
});

test('pickRandomQuote: leere Liste ergibt null (kein Absturz)', () => {
  assert.equal(ExamApp.pickRandomQuote([], () => 0), null);
});

test('quoteMotivationRatio: berechnet den Motivations-Anteil korrekt', () => {
  const quotes = [
    { text: 'A', type: 'motivation' },
    { text: 'B', type: 'motivation' },
    { text: 'C', type: 'motivation' },
    { text: 'D', type: 'insider' },
  ];
  assert.equal(ExamApp.quoteMotivationRatio(quotes), 0.75);
});

test('QUOTES: mindestens 40 motivierende Sprüche vorhanden', () => {
  const motivation = ExamApp.QUOTES.filter((q) => q.type === 'motivation').length;
  assert.ok(motivation >= 40, `nur ${motivation} Motivationssprüche`);
});

test('shuffle: verändert das Original nicht und behält alle Elemente', () => {
  const src = [1, 2, 3, 4, 5];
  const out = ExamApp.shuffle(src, () => 0);
  assert.deepEqual(src, [1, 2, 3, 4, 5]);
  assert.deepEqual([...out].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

test('shuffle: ist mit injiziertem rng deterministisch (Fisher-Yates, j=0)', () => {
  assert.deepEqual(ExamApp.shuffle([1, 2, 3], () => 0), [2, 3, 1]);
});

test('shuffle: leere/undefinierte Eingabe ist sicher', () => {
  assert.deepEqual(ExamApp.shuffle(undefined), []);
  assert.deepEqual(ExamApp.shuffle([]), []);
});

test('QUOTES: Insider-Anteil bleibt bei <= 10 % (Motivations-Anteil >= 0.9)', () => {
  assert.ok(ExamApp.quoteMotivationRatio(ExamApp.QUOTES) >= 0.9);
});

test('QUOTES: jeder Spruch hat text und gültigen Typ', () => {
  ExamApp.QUOTES.forEach((q) => {
    assert.equal(typeof q.text, 'string');
    assert.ok(q.text.length > 0);
    assert.ok(q.type === 'motivation' || q.type === 'insider');
  });
});

/* ---------------------------------------------------------
 * Skin-System: computeExamUnlocks / resolveSkin
 * --------------------------------------------------------- */

test('computeExamUnlocks: keine Prüfung bestanden -> alles gesperrt', () => {
  const unlocks = ExamApp.computeExamUnlocks({}, ['e1', 'e2', 'e3']);
  assert.deepEqual(unlocks, { stage1: false, stage2: false, stage3: false, all: false });
});

test('computeExamUnlocks: einzelne Stufen schalten passend frei', () => {
  const unlocks = ExamApp.computeExamUnlocks({ e1: true, e3: true }, ['e1', 'e2', 'e3']);
  assert.equal(unlocks.stage1, true);
  assert.equal(unlocks.stage2, false);
  assert.equal(unlocks.stage3, true);
  assert.equal(unlocks.all, false);
});

test('computeExamUnlocks: alle drei bestanden -> all = true', () => {
  const unlocks = ExamApp.computeExamUnlocks({ e1: true, e2: true, e3: true }, ['e1', 'e2', 'e3']);
  assert.equal(unlocks.all, true);
});

test('computeExamUnlocks: all bleibt false, wenn weniger als 3 Prüfungen existieren', () => {
  const unlocks = ExamApp.computeExamUnlocks({ e1: true, e2: true }, ['e1', 'e2']);
  assert.equal(unlocks.all, false);
});

test('resolveSkin: freie Skins sind immer erlaubt', () => {
  const unlocks = { stage1: false, stage2: false, stage3: false, all: false };
  assert.equal(ExamApp.resolveSkin('buecherwurm', unlocks), 'buecherwurm');
  assert.equal(ExamApp.resolveSkin('standard', unlocks), 'standard');
});

test('resolveSkin: gesperrter Skin fällt auf standard zurück', () => {
  const unlocks = { stage1: false, stage2: false, stage3: false, all: false };
  assert.equal(ExamApp.resolveSkin('bronze', unlocks), 'standard');
  assert.equal(ExamApp.resolveSkin('champion', unlocks), 'standard');
});

test('resolveSkin: freigeschalteter Skin wird durchgereicht', () => {
  const unlocks = { stage1: true, stage2: false, stage3: false, all: false };
  assert.equal(ExamApp.resolveSkin('bronze', unlocks), 'bronze');
});

test('resolveSkin: unbekannte id fällt auf standard zurück', () => {
  const unlocks = { stage1: true, stage2: true, stage3: true, all: true };
  assert.equal(ExamApp.resolveSkin('gibt-es-nicht', unlocks), 'standard');
});

test('resolveSkin: wieder gesperrt (Haken entfernt) -> zurück auf standard, gewünschte id bleibt aber erhalten', () => {
  // champion war freigeschaltet, jetzt nicht mehr -> Anzeige standard
  const locked = { stage1: true, stage2: true, stage3: false, all: false };
  assert.equal(ExamApp.resolveSkin('champion', locked), 'standard');
  // sobald wieder freigeschaltet, taucht champion automatisch wieder auf
  const unlocked = { stage1: true, stage2: true, stage3: true, all: true };
  assert.equal(ExamApp.resolveSkin('champion', unlocked), 'champion');
});

test('SKIN_DEFS: enthält 4 freie und 4 gesperrte Skins', () => {
  const free = ExamApp.SKIN_DEFS.filter((s) => !s.unlock).length;
  const locked = ExamApp.SKIN_DEFS.filter((s) => s.unlock).length;
  assert.equal(free, 4);
  assert.equal(locked, 4);
});

/* ---------------------------------------------------------
 * buildExamList
 * --------------------------------------------------------- */

test('buildExamList: führt Standard- und eigene Prüfungen zusammen und sortiert nach Datum', () => {
  const defaults = [
    { label: '2. Staatsexamen', date: '2026-07-27T08:00:00' },
    { label: '1. Staatsexamen', date: '2026-07-22T08:00:00' },
  ];
  const customs = [
    { id: 'x', label: 'Extra-Prüfung', date: '2026-09-11T08:00:00', source: 'custom' },
  ];
  const list = ExamApp.buildExamList(defaults, customs, {});
  assert.equal(list.length, 3);
  assert.equal(list[0].label, '1. Staatsexamen');
  assert.equal(list[1].label, '2. Staatsexamen');
  assert.equal(list[2].label, 'Extra-Prüfung');
});

test('buildExamList: setzt den "done"-Status korrekt anhand der doneMap', () => {
  const defaults = [{ label: '1. Staatsexamen', date: '2026-07-22T08:00:00' }];
  const id = ExamApp.makeExamId('1. Staatsexamen', '2026-07-22T08:00:00');
  const list = ExamApp.buildExamList(defaults, [], { [id]: true });
  assert.equal(list[0].done, true);
});

test('buildExamList: verändert die Original-Arrays nicht (reine Funktion)', () => {
  const defaults = [{ label: 'A', date: '2026-07-22T08:00:00' }];
  const customs = [];
  const frozenDefaults = JSON.stringify(defaults);
  ExamApp.buildExamList(defaults, customs, {});
  assert.equal(JSON.stringify(defaults), frozenDefaults);
});

test('buildExamList: leere Eingaben (null/undefined) führen nicht zum Absturz', () => {
  const list = ExamApp.buildExamList(null, undefined, undefined);
  assert.deepEqual(list, []);
});

/* ---------------------------------------------------------
 * validateExamInput
 * --------------------------------------------------------- */

test('validateExamInput: lehnt leeren Namen ab', () => {
  const res = ExamApp.validateExamInput('   ', '2026-09-11T08:00:00', []);
  assert.equal(res.valid, false);
});

test('validateExamInput: lehnt ungültiges Datum ab', () => {
  const res = ExamApp.validateExamInput('3. Staatsexamen', 'kein-datum', []);
  assert.equal(res.valid, false);
});

test('validateExamInput: lehnt zu langen Namen ab', () => {
  const res = ExamApp.validateExamInput('x'.repeat(61), '2026-09-11T08:00:00', []);
  assert.equal(res.valid, false);
});

test('validateExamInput: erkennt Duplikate (gleicher Name + gleiches Datum)', () => {
  const existing = [{ label: '3. Staatsexamen', date: '2026-09-11T08:00:00' }];
  const res = ExamApp.validateExamInput('3. Staatsexamen', '2026-09-11T08:00:00', existing);
  assert.equal(res.valid, false);
  assert.match(res.error, /existiert/i);
});

test('validateExamInput: akzeptiert eine gültige, neue Prüfung', () => {
  const res = ExamApp.validateExamInput('Kolloquium', '2026-10-01T10:00:00', []);
  assert.equal(res.valid, true);
});

/* ---------------------------------------------------------
 * addCustomExam / removeCustomExam
 * --------------------------------------------------------- */

test('addCustomExam: fügt eine neue Prüfung hinzu, ohne die Original-Liste zu verändern', () => {
  const before = [];
  const after = ExamApp.addCustomExam(before, 'Kolloquium', '2026-10-01T10:00:00');
  assert.equal(before.length, 0);
  assert.equal(after.length, 1);
  assert.equal(after[0].source, 'custom');
  assert.equal(after[0].label, 'Kolloquium');
});

test('removeCustomExam: entfernt genau die Prüfung mit passender id', () => {
  const list = [
    { id: 'a', label: 'A', date: '2026-01-01T00:00:00', source: 'custom' },
    { id: 'b', label: 'B', date: '2026-01-02T00:00:00', source: 'custom' },
  ];
  const after = ExamApp.removeCustomExam(list, 'a');
  assert.equal(after.length, 1);
  assert.equal(after[0].id, 'b');
});

test('removeCustomExam: unbekannte id verändert die Liste nicht', () => {
  const list = [{ id: 'a', label: 'A', date: '2026-01-01T00:00:00', source: 'custom' }];
  const after = ExamApp.removeCustomExam(list, 'unbekannt');
  assert.equal(after.length, 1);
});

/* ---------------------------------------------------------
 * toggleDoneMap
 * --------------------------------------------------------- */

test('toggleDoneMap: schaltet von false/undefined auf true', () => {
  const map = ExamApp.toggleDoneMap({}, 'exam-1');
  assert.equal(map['exam-1'], true);
});

test('toggleDoneMap: schaltet von true zurück auf false (Rückgängig machen)', () => {
  const map = ExamApp.toggleDoneMap({ 'exam-1': true }, 'exam-1');
  assert.equal(map['exam-1'], false);
});

test('toggleDoneMap: andere Einträge in der Map bleiben unverändert', () => {
  const map = ExamApp.toggleDoneMap({ 'exam-1': true, 'exam-2': false }, 'exam-2');
  assert.equal(map['exam-1'], true);
  assert.equal(map['exam-2'], true);
});

/* ---------------------------------------------------------
 * examProgress
 * --------------------------------------------------------- */

test('examProgress: zählt erledigte Prüfungen und berechnet ratio/allDone', () => {
  const list = [{ done: true }, { done: false }, { done: true }];
  const p = ExamApp.examProgress(list);
  assert.equal(p.done, 2);
  assert.equal(p.total, 3);
  assert.equal(p.ratio, 2 / 3);
  assert.equal(p.allDone, false);
});

test('examProgress: alle erledigt -> allDone true', () => {
  const p = ExamApp.examProgress([{ done: true }, { done: true }]);
  assert.equal(p.allDone, true);
  assert.equal(p.ratio, 1);
});

test('examProgress: leere Liste ist sicher (ratio 0, allDone false)', () => {
  const p = ExamApp.examProgress([]);
  assert.deepEqual(p, { done: 0, total: 0, ratio: 0, allDone: false });
});

/* ---------------------------------------------------------
 * Tages-Lernziele
 * --------------------------------------------------------- */

test('todayStamp: formatiert ein Date als JJJJ-MM-TT', () => {
  assert.equal(ExamApp.todayStamp(new Date('2026-07-19T21:30:00')), '2026-07-19');
  assert.equal(ExamApp.todayStamp(new Date('2026-01-05T00:10:00')), '2026-01-05');
});

test('addGoal: fügt ein Ziel mit done=false hinzu, ohne das Original zu verändern', () => {
  const before = [];
  const after = ExamApp.addGoal(before, '  Kapitel 3 wiederholen  ', 'g1');
  assert.equal(before.length, 0);
  assert.deepEqual(after, [{ id: 'g1', text: 'Kapitel 3 wiederholen', done: false }]);
});

test('addGoal: leere Eingabe wird ignoriert', () => {
  assert.deepEqual(ExamApp.addGoal([], '   ', 'g1'), []);
});

test('addGoal: kürzt sehr langen Text auf 80 Zeichen', () => {
  const after = ExamApp.addGoal([], 'x'.repeat(100), 'g1');
  assert.equal(after[0].text.length, 80);
});

test('toggleGoal: schaltet done um, andere Ziele bleiben unverändert', () => {
  const goals = [{ id: 'a', text: 'A', done: false }, { id: 'b', text: 'B', done: false }];
  const after = ExamApp.toggleGoal(goals, 'a');
  assert.equal(after[0].done, true);
  assert.equal(after[1].done, false);
  assert.equal(goals[0].done, false); // Original unverändert
});

test('removeGoal: entfernt genau das Ziel mit passender id', () => {
  const goals = [{ id: 'a', text: 'A', done: false }, { id: 'b', text: 'B', done: false }];
  const after = ExamApp.removeGoal(goals, 'a');
  assert.equal(after.length, 1);
  assert.equal(after[0].id, 'b');
});

test('resetGoalsForNewDay: gleicher Tag -> Liste unverändert', () => {
  const goals = [{ id: 'a', text: 'A', done: true }];
  assert.deepEqual(ExamApp.resetGoalsForNewDay(goals, '2026-07-19', '2026-07-19'), goals);
});

test('resetGoalsForNewDay: neuer Tag -> Haken zurückgesetzt, Texte bleiben', () => {
  const goals = [{ id: 'a', text: 'A', done: true }, { id: 'b', text: 'B', done: true }];
  const after = ExamApp.resetGoalsForNewDay(goals, '2026-07-18', '2026-07-19');
  assert.equal(after.every((g) => g.done === false), true);
  assert.equal(after.map((g) => g.text).join(','), 'A,B');
});

test('examProgress: funktioniert auch für Lernziele (done-Property)', () => {
  const goals = [{ done: true }, { done: true }, { done: false }];
  assert.deepEqual(ExamApp.examProgress(goals), { done: 2, total: 3, ratio: 2 / 3, allDone: false });
});

/* ---------------------------------------------------------
 * localStorage-Persistenz (mit Fake-Storage)
 * --------------------------------------------------------- */

test('saveToStorage + loadFromStorage: Werte überleben eine Speicher-Runde', () => {
  const storage = makeFakeStorage();
  const data = [{ id: 'x', label: 'Extra', date: '2026-09-11T08:00:00', source: 'custom' }];
  ExamApp.saveToStorage(storage, ExamApp.STORAGE_KEYS.customExams, data);
  const loaded = ExamApp.loadFromStorage(storage, ExamApp.STORAGE_KEYS.customExams, []);
  assert.deepEqual(loaded, data);
});

test('loadFromStorage: gibt Fallback zurück, wenn nichts gespeichert ist', () => {
  const storage = makeFakeStorage();
  const loaded = ExamApp.loadFromStorage(storage, 'nicht-vorhanden', 'FALLBACK');
  assert.equal(loaded, 'FALLBACK');
});

test('loadFromStorage: gibt Fallback zurück, wenn kaputtes JSON gespeichert ist', () => {
  const storage = makeFakeStorage();
  storage.setItem('kaputt', '{ das ist kein json');
  const loaded = ExamApp.loadFromStorage(storage, 'kaputt', []);
  assert.deepEqual(loaded, []);
});

/* ---------------------------------------------------------
 * Integrations-artiger End-to-End-Test der Logik
 * --------------------------------------------------------- */

test('End-to-End: Prüfung hinzufügen, abhaken, wieder rückgängig machen', () => {
  const storage = makeFakeStorage();
  const defaults = [
    { label: '1. Staatsexamen', date: '2026-07-22T08:00:00' },
    { label: '2. Staatsexamen', date: '2026-07-27T08:00:00' },
  ];

  let customExams = ExamApp.loadFromStorage(storage, ExamApp.STORAGE_KEYS.customExams, []);
  let doneMap = ExamApp.loadFromStorage(storage, ExamApp.STORAGE_KEYS.doneMap, {});

  // Neue, eigene Prüfung eintragen
  const validation = ExamApp.validateExamInput('3. Staatsexamen', '2026-09-11T08:00:00', [
    ...defaults,
    ...customExams,
  ]);
  assert.equal(validation.valid, true);
  customExams = ExamApp.addCustomExam(customExams, '3. Staatsexamen', '2026-09-11T08:00:00');
  ExamApp.saveToStorage(storage, ExamApp.STORAGE_KEYS.customExams, customExams);

  let list = ExamApp.buildExamList(defaults, customExams, doneMap);
  assert.equal(list.length, 3);
  assert.equal(list.every((e) => e.done === false), true);

  // Erste Prüfung abhaken
  const firstId = list[0].id;
  doneMap = ExamApp.toggleDoneMap(doneMap, firstId);
  ExamApp.saveToStorage(storage, ExamApp.STORAGE_KEYS.doneMap, doneMap);

  list = ExamApp.buildExamList(defaults, customExams, doneMap);
  assert.equal(list.find((e) => e.id === firstId).done, true);

  // Versehentlich geklickt -> rückgängig machen
  doneMap = ExamApp.toggleDoneMap(doneMap, firstId);
  list = ExamApp.buildExamList(defaults, customExams, doneMap);
  assert.equal(list.find((e) => e.id === firstId).done, false);
});
