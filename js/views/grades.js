/*
 * Grades: cumulative grade for one class, assignment by assignment,
 * plus the average needed on remaining work for every letter grade.
 * Param: #/grades/<classId>
 */
(function (GT) {
  'use strict';

  const { store, calc, ui } = GT;
  const { esc } = ui;

  function neededTable(sum) {
    const { stats, scale } = sum;
    const rows = [...scale].sort((a, b) => b.min - a.min).map((r) => {
      const min = Number(r.min);
      let need = calc.neededFor(min, stats);
      let verdict, cls;
      if (stats.worst >= min) { verdict = 'Secured'; cls = 'ok'; need = null; }
      else if (need === null || need > 100) { verdict = 'Out of reach'; cls = 'muted'; }
      else { verdict = 'Achievable'; cls = ''; }
      return `<tr class="${cls}">
        <td><strong>${esc(r.letter)}</strong></td><td class="num">${ui.fmtNum(min, 0)}%</td>
        <td class="num">${need === null ? '—' : ui.fmtPct(Math.max(0, need))}</td><td>${verdict}</td>
      </tr>`;
    });
    return `<table class="grid compact">
      <thead><tr><th>Letter</th><th>Needs</th><th>Average needed on remaining ${ui.fmtNum(stats.remainingWeight, 0)}%</th><th></th></tr></thead>
      <tbody>${rows.join('')}</tbody></table>`;
  }

  function breakdown(sum) {
    const { statuses } = store.state.settings;
    const list = [...sum.list].sort((a, b) => (calc.dueDateTime(a) || Infinity) - (calc.dueDateTime(b) || Infinity));
    const running = calc.runningGrades(list, statuses);
    if (!list.length) return '<p class="muted">No assignments yet.</p>';
    const rows = list.map((a, i) => {
      const r = running[i];
      const excluded = calc.statusKind(a.status, statuses) === 'excluded';
      const pct = calc.scorePercent(a);
      const contrib = calc.contribution(a);
      return `<tr class="${excluded ? 'excluded' : r.counted ? '' : 'pending'}">
        <td><a href="#/assignments/item:${esc(a.id)}">${esc(a.name || a.type)}</a></td>
        <td>${esc(a.type)}</td>
        <td>${esc(ui.fmtDate(a.dueDate))}</td>
        <td class="num">${ui.fmtNum(Number(a.weight) || 0, 1)}%</td>
        <td class="num">${esc(calc.formatScore(a))}</td>
        <td class="num">${pct === null ? '' : ui.fmtPct(pct)}</td>
        <td class="num">${contrib === null ? '' : ui.fmtNum(contrib) + '%'}</td>
        <td class="num">${r.counted ? ui.fmtNum(r.cumEarned) + ' / ' + ui.fmtNum(r.cumWeight, 1) : ''}</td>
        <td class="num">${r.counted ? ui.fmtPct(r.running) : ''}</td>
      </tr>`;
    });
    return `<div class="table-wrap"><table class="grid">
      <thead><tr><th>Assignment</th><th>Type</th><th>Due</th><th>Weight</th><th>Score</th><th>%</th>
        <th title="Score × weight">Adds</th><th title="Marks secured / weight graded, so far">Secured / graded</th><th>Running grade</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table></div>`;
  }

  function render(el, param) {
    const classes = store.activeClasses();
    if (!classes.length) {
      el.innerHTML = ui.emptyState('No classes yet', 'Add classes in Settings to see grades.', '<a class="btn primary" href="#/settings">Go to Settings</a>');
      return;
    }
    const cls = classes.find((c) => c.id === param) || classes[0];
    const sum = store.classSummary(cls);
    const { stats, scale } = sum;
    const weightOk = Math.abs(stats.totalWeight - 100) < 0.01;

    el.innerHTML = `
      <h1>Grades</h1>
      <nav class="class-tabs">${classes.map((c) =>
        `<a href="#/grades/${esc(c.id)}" class="${c.id === cls.id ? 'active' : ''}" style="--class:${esc(c.color)}">${esc(c.code)}</a>`).join('')}
      </nav>
      <h2>${esc(cls.code)} <span class="muted">${esc(cls.name)}</span></h2>
      <section class="tiles">
        <div class="tile"><span>Current grade</span><strong>${ui.fmtPct(stats.current)}</strong><small>${esc(sum.autoLetter || '—')} on graded work</small></div>
        <div class="tile"><span>Secured so far</span><strong>${ui.fmtNum(stats.earned, 1)}%</strong><small>of final grade</small></div>
        <div class="tile"><span>Graded</span><strong>${ui.fmtNum(stats.gradedWeight, 0)}%</strong><small>of weight</small></div>
        <div class="tile"><span>Best possible</span><strong>${ui.fmtPct(stats.best)}</strong><small>${esc(calc.letterFor(stats.best, scale))} with 100% on the rest</small></div>
        <div class="tile"><span>Worst possible</span><strong>${ui.fmtPct(stats.worst)}</strong><small>${esc(calc.letterFor(stats.worst, scale))} with 0% on the rest</small></div>
        <div class="tile ${weightOk ? '' : 'warn'}"><span>Weights entered</span><strong>${ui.fmtNum(stats.totalWeight, 1)}%</strong><small>${weightOk ? 'adds up to 100' : 'should add up to 100'}</small></div>
      </section>
      <div class="two-col">
        <section><h3>By assignment</h3>${breakdown(sum)}</section>
        <section><h3>What you need</h3>${neededTable(sum)}
          <p class="muted small">Needed = (letter minimum − secured) ÷ remaining weight. Grading scale: ${cls.gradingScale ? 'custom for this class' : 'default'} (edit in Settings).</p>
        </section>
      </div>`;
  }

  GT.views = GT.views || {};
  GT.views.grades = { title: 'Grades', render };
})(window.GT);
