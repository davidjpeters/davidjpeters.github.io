/*
 * store.js: the single source of truth.
 * State is one plain object, saved to localStorage as JSON after every change.
 */
(function (GT) {
  'use strict';

  const STORAGE_KEY = 'gradeTracker:v1';
  const VERSION = 1;

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Placeholder scale. Replace with the one in your syllabus (Settings).
  const DEFAULT_GRADING_SCALE = [
    { letter: 'A+', min: 95 }, { letter: 'A', min: 90 }, { letter: 'A-', min: 85 },
    { letter: 'B+', min: 80 }, { letter: 'B', min: 76 }, { letter: 'B-', min: 72 },
    { letter: 'C+', min: 68 }, { letter: 'C', min: 64 }, { letter: 'C-', min: 60 },
    { letter: 'D+', min: 57 }, { letter: 'D', min: 53 }, { letter: 'D-', min: 50 },
    { letter: 'F', min: 0 },
  ];

  const DEFAULT_GPA_SCALE = [
    { letter: 'A+', points: 4.0 }, { letter: 'A', points: 4.0 }, { letter: 'A-', points: 3.7 },
    { letter: 'B+', points: 3.3 }, { letter: 'B', points: 3.0 }, { letter: 'B-', points: 2.7 },
    { letter: 'C+', points: 2.3 }, { letter: 'C', points: 2.0 }, { letter: 'C-', points: 1.7 },
    { letter: 'D+', points: 1.3 }, { letter: 'D', points: 1.0 }, { letter: 'D-', points: 0.7 },
    { letter: 'F', points: 0 },
  ];

  const CLASS_COLOURS = ['#2f6fdf', '#d9480f', '#2b8a3e', '#9c36b5', '#e8590c', '#0c8599', '#c2255c', '#5c7cfa'];

  function defaultState() {
    return {
      version: VERSION,
      settings: {
        activeSemesterId: null,
        assignmentTypes: [
          'Reading', 'Homework', 'Prelab', 'Lab report', 'Presentation', 'Paper',
          'Quiz', 'Midterm exam', 'Final exam', 'IBL', 'Weekly learning assignment',
        ],
        statuses: [
          { name: 'Not started', color: '#868e96', kind: 'todo' },
          { name: 'In progress', color: '#f08c00', kind: 'todo' },
          { name: 'Complete', color: '#1c7ed6', kind: 'done' },
          { name: 'Submitted', color: '#2f9e44', kind: 'done' },
          { name: 'N/A', color: '#adb5bd', kind: 'excluded' },
        ],
        gradingScale: structuredClone(DEFAULT_GRADING_SCALE),
        gpaScale: structuredClone(DEFAULT_GPA_SCALE),
        prior: { credits: 0, gpa: 0 },
        ui: { calendarMode: 'month', showSchedule: true },
        lastExport: null,
      },
      semesters: [],
      classes: [],
      assignments: [],
    };
  }

  // Fill in keys added in later versions so old saves keep working.
  function migrate(data) {
    const base = defaultState();
    const s = Object.assign({}, base, data);
    s.settings = Object.assign({}, base.settings, data.settings);
    s.settings.ui = Object.assign({}, base.settings.ui, s.settings.ui);
    s.settings.prior = Object.assign({}, base.settings.prior, s.settings.prior);
    s.version = VERSION;
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? migrate(JSON.parse(raw)) : null;
    } catch (err) {
      console.error('Could not read saved data', err);
      return null;
    }
  }

  const store = {
    state: null,
    isFirstRun: false,

    init() {
      const saved = load();
      this.isFirstRun = saved === null;
      this.state = saved || defaultState();
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (err) {
        GT.ui && GT.ui.toast('Could not save. Is storage blocked or full?', true);
        console.error(err);
      }
    },

    replace(next) {
      this.state = migrate(next);
      this.save();
    },

    reset() {
      this.state = defaultState();
      this.save();
    },

    // Paths look like "classes.2.name" so inputs can say where they write.
    getPath(path) {
      return path.split('.').reduce((obj, key) => (obj == null ? obj : obj[key]), this.state);
    },
    setPath(path, value) {
      const keys = path.split('.');
      const last = keys.pop();
      const parent = keys.reduce((obj, key) => obj[key], this.state);
      parent[last] = value;
      this.save();
    },

    /* ---------- Lookups ---------- */

    activeSemester() {
      const s = this.state;
      return s.semesters.find((x) => x.id === s.settings.activeSemesterId) || s.semesters[0] || null;
    },
    activeClasses() {
      const sem = this.activeSemester();
      return sem ? this.state.classes.filter((c) => c.semesterId === sem.id) : [];
    },
    classById(id) {
      return this.state.classes.find((c) => c.id === id) || null;
    },
    assignmentsFor(classId) {
      return this.state.assignments.filter((a) => a.classId === classId);
    },
    scaleFor(cls) {
      return (cls && cls.gradingScale) || this.state.settings.gradingScale;
    },

    // Everything the views need to know about one class, computed in one place.
    classSummary(cls, now = new Date()) {
      const { calc } = GT;
      const { statuses, gpaScale } = this.state.settings;
      const list = this.assignmentsFor(cls.id);
      const stats = calc.classStats(list, statuses);
      const scale = this.scaleFor(cls);
      const counts = { total: 0, done: 0, todo: 0, overdue: 0, dueWeek: 0 };
      for (const a of list) {
        const kind = calc.statusKind(a.status, statuses);
        if (kind === 'excluded') continue;
        counts.total++;
        if (kind === 'done') { counts.done++; continue; }
        counts.todo++;
        if (calc.isOverdue(a, statuses, now)) counts.overdue++;
        else {
          const d = calc.daysUntil(a.dueDate, now);
          if (d !== null && d <= 7) counts.dueWeek++;
        }
      }
      const autoLetter = calc.letterFor(stats.current, scale);
      const letter = cls.finalLetter || autoLetter;
      return {
        list, stats, counts, scale, autoLetter, letter,
        isFinal: Boolean(cls.finalLetter),
        points: letter ? calc.pointsFor(letter, gpaScale) : null,
      };
    },

    /* ---------- Factories ---------- */

    newSemester() {
      const year = new Date().getFullYear();
      return { id: uid(), name: `Term ${this.state.semesters.length + 1}`, start: `${year}-09-01`, end: `${year}-12-20` };
    },
    newClass(semesterId) {
      const n = this.state.classes.length;
      return {
        id: uid(), semesterId, code: 'NEW 1000', name: 'New class', credits: 3,
        color: CLASS_COLOURS[n % CLASS_COLOURS.length], gradingScale: null, finalLetter: '', schedule: [],
      };
    },
    newAssignment(classId) {
      const s = this.state.settings;
      return {
        id: uid(), classId, name: '', type: s.assignmentTypes[0] || '',
        status: (s.statuses[0] && s.statuses[0].name) || '', dueDate: '', dueTime: '',
        scoreReceived: null, scorePossible: null, weight: 0, notes: '',
      };
    },
    uid,

    /* ---------- Backup ---------- */

    exportJSON() {
      this.state.settings.lastExport = new Date().toISOString();
      this.save();
      return JSON.stringify(this.state, null, 2);
    },
    importJSON(text) {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.classes) || !Array.isArray(data.assignments)) {
        throw new Error('That file does not look like a grade tracker backup.');
      }
      this.replace(data);
    },

    /* ---------- Sample data (dates relative to today so it always looks live) ---------- */

    loadSample() {
      const { addDays, toISODate } = GT.calc;
      const today = toISODate(new Date());
      const s = defaultState();
      const sem = { id: uid(), name: 'Sample term', start: addDays(today, -30), end: addDays(today, 75) };
      s.semesters.push(sem);
      s.settings.activeSemesterId = sem.id;

      const mk = (code, name, credits, color, schedule) =>
        ({ id: uid(), semesterId: sem.id, code, name, credits, color, gradingScale: null, finalLetter: '', schedule });
      const comp = mk('COMP 3004', 'Object-Oriented Software Engineering', 3, CLASS_COLOURS[0], [
        { day: 1, start: '10:05', end: '11:25', kind: 'Lecture', location: 'HP 4351' },
        { day: 3, start: '10:05', end: '11:25', kind: 'Lecture', location: 'HP 4351' },
      ]);
      const biol = mk('BIOL 2104', 'Introductory Genetics', 3, CLASS_COLOURS[2], [
        { day: 2, start: '13:05', end: '14:25', kind: 'Lecture', location: 'TB 240' },
        { day: 4, start: '13:05', end: '14:25', kind: 'Lecture', location: 'TB 240' },
        { day: 5, start: '08:35', end: '11:25', kind: 'Lab', location: 'NB 2211' },
      ]);
      const stat = mk('STAT 2507', 'Introduction to Statistical Modelling', 3, CLASS_COLOURS[3], [
        { day: 1, start: '14:35', end: '15:55', kind: 'Lecture', location: 'SA 416' },
        { day: 3, start: '14:35', end: '15:55', kind: 'Lecture', location: 'SA 416' },
      ]);
      s.classes.push(comp, biol, stat);

      const a = (cls, name, type, status, offset, time, score, weight) => {
        const parsed = score ? GT.calc.parseScore(score) : { received: null, possible: null };
        s.assignments.push({
          id: uid(), classId: cls.id, name, type, status, dueDate: addDays(today, offset), dueTime: time,
          scoreReceived: parsed.received, scorePossible: parsed.possible, weight, notes: '',
        });
      };
      a(comp, 'Deliverable 1', 'Homework', 'Submitted', -18, '23:59', '42/50', 10);
      a(comp, 'Quiz 1', 'Quiz', 'Submitted', -10, '10:05', '88', 5);
      a(comp, 'Deliverable 2', 'Homework', 'In progress', 3, '23:59', '', 10);
      a(comp, 'Midterm', 'Midterm exam', 'Not started', 12, '10:05', '', 25);
      a(comp, 'Team presentation', 'Presentation', 'Not started', 45, '10:05', '', 15);
      a(comp, 'Final exam', 'Final exam', 'Not started', 70, '09:00', '', 35);

      a(biol, 'Prelab 1', 'Prelab', 'Submitted', -21, '08:30', '10/10', 2);
      a(biol, 'Lab report 1', 'Lab report', 'Submitted', -14, '23:59', '17/20', 8);
      a(biol, 'Prelab 2', 'Prelab', 'Submitted', -7, '08:30', '9/10', 2);
      a(biol, 'Lab report 2', 'Lab report', 'Complete', -1, '23:59', '', 8);
      a(biol, 'Chapter 5 reading', 'Reading', 'Not started', 1, '', '', 0);
      a(biol, 'Prelab 3', 'Prelab', 'Not started', 0, '08:30', '', 2);
      a(biol, 'Midterm', 'Midterm exam', 'Not started', 20, '13:05', '', 30);
      a(biol, 'Final exam', 'Final exam', 'Not started', 68, '14:00', '', 48);

      a(stat, 'WLA 1', 'Weekly learning assignment', 'Submitted', -20, '23:59', '100', 2);
      a(stat, 'WLA 2', 'Weekly learning assignment', 'Submitted', -13, '23:59', '80', 2);
      a(stat, 'WLA 3', 'Weekly learning assignment', 'Submitted', -6, '23:59', '90', 2);
      a(stat, 'WLA 4', 'Weekly learning assignment', 'Not started', -1, '23:59', '', 2);
      a(stat, 'WLA 5', 'Weekly learning assignment', 'Not started', 6, '23:59', '', 2);
      a(stat, 'IBL project', 'IBL', 'In progress', 25, '23:59', '', 20);
      a(stat, 'Midterm', 'Midterm exam', 'Not started', 16, '14:35', '', 30);
      a(stat, 'Final exam', 'Final exam', 'Not started', 72, '19:00', '', 40);

      this.state = s;
      this.save();
    },
  };

  GT.store = store;
})(window.GT = window.GT || {});
