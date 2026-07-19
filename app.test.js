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
