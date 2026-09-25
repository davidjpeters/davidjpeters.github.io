# Grade Tracker

A single-page grade tracker hosted on GitHub Pages. Plain HTML, CSS and JavaScript: no framework, no build step, no server. Open `index.html` in a browser (or visit the Pages URL) and it works.

## Goals

1. Track every assignment for every class in one place: status, due date, score, weight.
2. Always know where a class stands: current grade, what each assignment contributed, and what is needed on the remaining work to hit a target.
3. Roll classes up into a semester GPA and a cumulative GPA.
4. Stay simple enough to open any file and change it without learning a toolchain.

## Views

| Route | View | Purpose |
|---|---|---|
| `#/classes` | My classes | Per-class cards and a semester summary: total, completed, remaining, overdue, due this week, current grade, next due items. |
| `#/assignments` | Assignments | Spreadsheet-style editor. Every cell is editable inline; derived columns (days until due, %, contribution, letter) recalculate as you type. |
| `#/calendar` | Calendar | Month and week views. Assignments are colour coded by status, with a class-colour edge. Class meetings from the schedule can be toggled on. |
| `#/grades` | Grades | Per class, assignment by assignment: running cumulative grade, marks secured so far, best and worst possible final, and the average needed on remaining work for each letter grade. |
| `#/semester` | Semester | Credits, letter, grade points and quality points per class. Semester GPA, credits earned, and cumulative GPA across all semesters. |
| `#/settings` | Settings | Semesters, classes (code, name, credits, colour, grading scale, weekly schedule), assignment types, statuses, default grading scale, GPA scale, prior record, backup and restore. |

## User configuration

Everything below lives in Settings and populates the dropdowns across the app.

**Classes**: code, name, credits, colour, semester, weekly schedule (day, start, end, type, location), and an optional class-specific grading scale. Classes without their own scale use the default.

**Assignment types** (defaults): Reading, Homework, Prelab, Lab report, Presentation, Paper, Quiz, Midterm exam, Final exam, IBL, Weekly learning assignment.

**Statuses** (defaults). Each status has a colour and a *kind*, which is what the maths uses, so you can rename or add statuses freely:

| Status | Kind | Meaning |
|---|---|---|
| Not started | todo | Counts as remaining; can be overdue. |
| In progress | todo | Same as above. |
| Complete | done | Counts as completed. |
| Submitted | done | Counts as completed. |
| N/A | excluded | Ignored in counts and grade calculations. |

**Grading scale**: a list of `letter → minimum %`. A grade gets the highest letter whose minimum it meets. The default is a placeholder; replace it with the one in each syllabus.

**GPA scale**: a list of `letter → grade points` (A+ = 4.0, A = 4.0, A- = 3.7, B+ = 3.3, ...). Letters must match the grading scale letters.

**Prior record**: credits and GPA completed before you started using the tracker, so cumulative GPA is correct from day one.

## Calculations

All grade maths is in `js/calc.js` as pure functions, with tests in `tests/calc.test.js`.

**Score entry.** One field accepts either form:
- `45/50` is a fraction, shown as 90.0%.
- `90` or `90%` is a percentage.

**Contribution** of an assignment to the final grade:

```
contribution = score% × weight / 100
```

A 30% midterm scored at 90% contributes 27 points to the final grade.

**Class grade.** Only graded, non-excluded assignments with a weight count.

```
earned        = Σ contribution                 (points secured out of 100)
gradedWeight  = Σ weight of graded work
current grade = earned / gradedWeight × 100    (average on work graded so far)
remaining     = 100 − gradedWeight
best final    = earned + remaining             (100% on everything left)
worst final   = earned                         (0% on everything left)
needed for X  = (X − earned) / remaining × 100
```

The weight total per class is shown with a warning if the assignments you have entered do not add up to 100%.

**GPA.**

```
quality points = grade points × credits
semester GPA   = Σ quality points / Σ credits   (classes with a grade)
cumulative GPA = (prior QP + Σ all semesters QP) / (prior credits + Σ all credits)
```

A class uses its *final letter* when you set one in the Semester view (the official grade from the registrar). Until then it uses the letter from its current grade and is marked *projected*.

## Data and persistence

State is a single JSON object saved to the browser's `localStorage` on every change, under the key `gradeTracker:v1`.

Trade-offs to know:

- Data lives in *this browser on this device*. It is not in the repo and nobody visiting the site can see it. It also does not sync between your laptop and phone.
- Clearing site data or using a private window loses it. Use **Settings → Export backup** regularly; the app shows how long since your last export. **Import** restores a backup or moves data to another device.
- Moving data into the repo (for example a `data.json`) would give sync, but a public repo would publish your grades. Not worth it for this.

Shape of the stored state:

```js
{
  version: 1,
  settings: {
    activeSemesterId, assignmentTypes: [string],
    statuses: [{ name, color, kind: 'todo' | 'done' | 'excluded' }],
    gradingScale: [{ letter, min }],      // default scale
    gpaScale: [{ letter, points }],
    prior: { credits, gpa },
    ui: { calendarMode, showSchedule }, lastExport
  },
  semesters:   [{ id, name, start, end }],
  classes:     [{ id, semesterId, code, name, credits, color,
                  gradingScale: null | [{ letter, min }],
                  finalLetter: '' | letter,
                  schedule: [{ day: 0-6, start, end, kind, location }] }],
  assignments: [{ id, classId, name, type, status, dueDate, dueTime,
                  scoreReceived, scorePossible,   // possible null = percent
                  weight, notes }]
}
```

## File structure

```
index.html            Shell: header, nav, <main>, script tags
css/styles.css        All styling; colour tokens at the top (light and dark)
js/calc.js            Pure grade and date maths (also runs in Node for tests)
js/store.js           Default state, load/save, export/import, sample data
js/ui.js              Small helpers: escaping, formatting, lookups
js/views/*.js         One file per view, each exposes render(container, param)
js/app.js             Hash router, header, semester picker
tests/calc.test.js    `node tests/calc.test.js`
```

Scripts are plain `<script>` tags sharing one global, `GT`, rather than ES modules. Modules are blocked when opening a file directly from disk (`file://`), and plain scripts keep "double-click index.html" working.

## Customising

- **Colours and spacing**: edit the CSS variables at the top of `css/styles.css`.
- **Defaults for a fresh install**: `defaultState()` in `js/store.js`.
- **A new column in Assignments**: add the field to the row template and header in `js/views/assignments.js`; the `data-field` attribute wires it to the store.
- **A new view**: create `js/views/myview.js` that registers `GT.views.myview = { title, render(el, param) }`, add a `<script>` tag and a nav link in `index.html`.

## Deploying

`davidjpeters.github.io` is a user site, so GitHub Pages serves the repo root of the default branch at `https://davidjpeters.github.io`. Merge to `main`, then check **Settings → Pages → Source: Deploy from a branch, `main`, `/ (root)`**.

## Additions beyond the original brief

- Semesters, so GPA can accumulate across terms.
- "Needed on remaining work" for every letter grade, plus best and worst possible final.
- Running cumulative grade per assignment in the Grades view.
- Overdue and due-this-week counts.
- Duplicate an assignment with its due date moved one week later (for weekly work).
- Weight total check per class.
- Backup reminder, JSON export and import, sample data for a first look.
- Automatic dark mode.

## Possible next steps

- Category weights (e.g. "Quizzes 20%, drop lowest") instead of per-assignment weights.
- Rounding rule per class (some schools round 89.5 up).
- Calendar export (`.ics`) of due dates.
