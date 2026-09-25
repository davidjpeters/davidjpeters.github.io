/*
 * calc.js: pure grade and date maths. No DOM, no storage.
 * Runs in the browser (as GT.calc) and in Node (for tests/calc.test.js).
 */
(function (root) {
  'use strict';

  const isBlank = (v) => v === null || v === undefined || v === '';

  /* ---------- Scores ---------- */

  // Parse the single score field. "45/50" -> fraction, "90" or "90%" -> percent.
  // Returns { received, possible } (possible null means percent) or null if invalid.
  function parseScore(text) {
    const s = String(text ?? '').trim();
    if (s === '') return { received: null, possible: null };
    const frac = s.match(/^(-?\d*\.?\d+)\s*\/\s*(\d*\.?\d+)$/);
    if (frac) {
      const possible = Number(frac[2]);
      if (possible <= 0) return null;
      return { received: Number(frac[1]), possible };
    }
    const pct = s.match(/^(-?\d*\.?\d+)\s*%?$/);
    if (pct) return { received: Number(pct[1]), possible: null };
    return null;
  }

  function formatScore(a) {
    if (isBlank(a.scoreReceived)) return '';
    return isBlank(a.scorePossible) ? `${a.scoreReceived}%` : `${a.scoreReceived}/${a.scorePossible}`;
  }

  // Score as a percentage, or null if not graded.
  function scorePercent(a) {
    if (isBlank(a.scoreReceived)) return null;
    const r = Number(a.scoreReceived);
    if (isBlank(a.scorePossible)) return r;
    const p = Number(a.scorePossible);
    return p > 0 ? (r / p) * 100 : null;
  }

  // Points this assignment adds to the final grade (out of 100).
  function contribution(a) {
    const pct = scorePercent(a);
    const w = Number(a.weight) || 0;
    return pct === null ? null : (pct * w) / 100;
  }

  /* ---------- Statuses ---------- */

  function statusKind(statusName, statuses) {
    const s = statuses.find((x) => x.name === statusName);
    return s ? s.kind : 'todo';
  }

  /* ---------- Class grade ---------- */

  // Summary of one class from its assignments.
  function classStats(assignments, statuses) {
    let gradedWeight = 0, earned = 0, totalWeight = 0;
    for (const a of assignments) {
      if (statusKind(a.status, statuses) === 'excluded') continue;
      const w = Number(a.weight) || 0;
      totalWeight += w;
      const c = contribution(a);
      if (c !== null && w > 0) {
        gradedWeight += w;
        earned += c;
      }
    }
    const remainingWeight = Math.max(0, 100 - gradedWeight);
    return {
      gradedWeight,
      earned,
      totalWeight,
      remainingWeight,
      current: gradedWeight > 0 ? (earned / gradedWeight) * 100 : null,
      best: earned + remainingWeight,
      worst: earned,
    };
  }

  // Average % needed on the remaining weight to finish at `target` %.
  // null when nothing remains to be graded.
  function neededFor(target, stats) {
    if (stats.remainingWeight <= 0) return null;
    return ((target - stats.earned) / stats.remainingWeight) * 100;
  }

  // Running totals, in the order given (sort by due date before calling).
  function runningGrades(assignments, statuses) {
    let w = 0, e = 0;
    return assignments.map((a) => {
      const excluded = statusKind(a.status, statuses) === 'excluded';
      const c = contribution(a);
      const weight = Number(a.weight) || 0;
      if (!excluded && c !== null && weight > 0) {
        w += weight;
        e += c;
      }
      return {
        id: a.id,
        counted: !excluded && c !== null && weight > 0,
        cumWeight: w,
        cumEarned: e,
        running: w > 0 ? (e / w) * 100 : null,
      };
    });
  }

  /* ---------- Letters and GPA ---------- */

  function letterFor(pct, scale) {
    if (pct === null || pct === undefined || !scale || !scale.length) return '';
    const sorted = [...scale].sort((a, b) => Number(b.min) - Number(a.min));
    for (const row of sorted) {
      if (pct >= Number(row.min) - 1e-9) return row.letter;
    }
    return sorted[sorted.length - 1].letter;
  }

  function pointsFor(letter, gpaScale) {
    const row = gpaScale.find((r) => r.letter === letter);
    return row ? Number(row.points) : null;
  }

  // rows: [{ credits, points }]. Rows with null points are skipped.
  function gpa(rows) {
    let credits = 0, qp = 0;
    for (const r of rows) {
      if (r.points === null || r.points === undefined) continue;
      const c = Number(r.credits) || 0;
      credits += c;
      qp += c * r.points;
    }
    return { credits, qualityPoints: qp, gpa: credits > 0 ? qp / credits : null };
  }

  /* ---------- Dates ---------- */

  // "2026-09-25" -> local Date at midnight (avoids the UTC shift of new Date("2026-09-25")).
  function parseDate(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function toISODate(date) {
    const p = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  }

  function addDays(iso, n) {
    const d = parseDate(iso);
    d.setDate(d.getDate() + n);
    return toISODate(d);
  }

  // Exact due moment. No time means end of day.
  function dueDateTime(a) {
    const d = parseDate(a.dueDate);
    if (!d) return null;
    const [h, m] = (a.dueTime || '23:59').split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }

  // Whole calendar days from today to the due date (negative = past).
  function daysUntil(dueDate, now) {
    const d = parseDate(dueDate);
    if (!d) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((d - today) / 86400000);
  }

  function isOverdue(a, statuses, now) {
    if (statusKind(a.status, statuses) !== 'todo') return false;
    const due = dueDateTime(a);
    return due !== null && due < now;
  }

  const api = {
    parseScore, formatScore, scorePercent, contribution, statusKind,
    classStats, neededFor, runningGrades, letterFor, pointsFor, gpa,
    parseDate, toISODate, addDays, dueDateTime, daysUntil, isOverdue,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.GT = root.GT || {};
    root.GT.calc = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
