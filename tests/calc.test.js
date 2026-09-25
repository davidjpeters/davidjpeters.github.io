// Run with: node tests/calc.test.js
const assert = require('node:assert/strict');
const test = require('node:test');
const c = require('../js/calc.js');

const statuses = [
  { name: 'Not started', kind: 'todo' },
  { name: 'Submitted', kind: 'done' },
  { name: 'N/A', kind: 'excluded' },
];
const scale = [
  { letter: 'A+', min: 90 }, { letter: 'A', min: 85 }, { letter: 'B', min: 70 }, { letter: 'F', min: 0 },
];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('parseScore handles fraction, percent and junk', () => {
  assert.deepEqual(c.parseScore('45/50'), { received: 45, possible: 50 });
  assert.deepEqual(c.parseScore(' 90% '), { received: 90, possible: null });
  assert.deepEqual(c.parseScore('87.5'), { received: 87.5, possible: null });
  assert.deepEqual(c.parseScore(''), { received: null, possible: null });
  assert.equal(c.parseScore('abc'), null);
  assert.equal(c.parseScore('4/0'), null);
});

test('contribution: 90% on a 30% midterm is 27 points', () => {
  close(c.contribution({ scoreReceived: 90, scorePossible: null, weight: 30 }), 27);
  close(c.contribution({ scoreReceived: 18, scorePossible: 20, weight: 30 }), 27);
  assert.equal(c.contribution({ scoreReceived: null, weight: 30 }), null);
});

test('classStats ignores excluded and ungraded work', () => {
  const list = [
    { status: 'Submitted', scoreReceived: 90, scorePossible: null, weight: 30 },
    { status: 'Submitted', scoreReceived: 8, scorePossible: 10, weight: 20 },
    { status: 'Not started', scoreReceived: null, weight: 50 },
    { status: 'N/A', scoreReceived: 0, scorePossible: null, weight: 10 },
  ];
  const s = c.classStats(list, statuses);
  close(s.gradedWeight, 50);
  close(s.earned, 43);
  close(s.current, 86);
  close(s.totalWeight, 100);
  close(s.best, 93);
  close(c.neededFor(85, s), 84);
});

test('runningGrades accumulates in order', () => {
  const r = c.runningGrades([
    { id: 1, status: 'Submitted', scoreReceived: 100, weight: 10 },
    { id: 2, status: 'Not started', scoreReceived: null, weight: 10 },
    { id: 3, status: 'Submitted', scoreReceived: 50, weight: 10 },
  ], statuses);
  close(r[0].running, 100);
  close(r[1].running, 100);
  close(r[2].running, 75);
});

test('letterFor picks the highest letter reached', () => {
  assert.equal(c.letterFor(92, scale), 'A+');
  assert.equal(c.letterFor(85, scale), 'A');
  assert.equal(c.letterFor(84.99, scale), 'B');
  assert.equal(c.letterFor(null, scale), '');
});

test('gpa weights by credits and skips missing points', () => {
  const g = c.gpa([{ credits: 3, points: 4 }, { credits: 1, points: 2 }, { credits: 3, points: null }]);
  close(g.gpa, 3.5);
  assert.equal(g.credits, 4);
});

test('dates: daysUntil and overdue', () => {
  const now = new Date(2026, 8, 25, 12, 0);
  assert.equal(c.daysUntil('2026-09-25', now), 0);
  assert.equal(c.daysUntil('2026-09-28', now), 3);
  assert.equal(c.daysUntil('2026-09-20', now), -5);
  assert.equal(c.addDays('2026-12-29', 7), '2027-01-05');
  assert.ok(c.isOverdue({ status: 'Not started', dueDate: '2026-09-25', dueTime: '09:00' }, statuses, now));
  assert.ok(!c.isOverdue({ status: 'Not started', dueDate: '2026-09-25' }, statuses, now));
  assert.ok(!c.isOverdue({ status: 'Submitted', dueDate: '2026-09-01' }, statuses, now));
});
