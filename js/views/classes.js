/*
 * My classes: semester summary plus one card per class.
 */
(function (GT) {
  'use strict';

  const { store, calc, ui } = GT;
  const { esc } = ui;

  function welcome(el) {
    el.innerHTML = ui.emptyState(
      'Welcome',
      'Add your semester and classes in Settings, or load sample data to see how everything fits together. ' +
        'Your data is saved in this browser only.',
      `<div class="btn-row">
        <button class="btn primary" data-act="sample">Load sample data</button>
        <a class="btn" href="#/settings">Set up my classes</a>
      </div>`
    );
    el.querySelector('[data-act="sample"]').addEventListener('click', () => {
      store.loadSample();
      ui.toast('Sample data loaded. Reset it any time in Settings.');
      GT.app.render();
    });
  }

  function nextUp(list, now) {
    const { statuses } = store.state.settings;
    return list
      .filter((a) => calc.statusKind(a.status, statuses) === 'todo' && a.dueDate)
      .sort((a, b) => calc.dueDateTime(a) - calc.dueDateTime(b))
      .slice(0, 3)
      .map((a) => {
        const overdue = calc.isOverdue(a, statuses, now);
        const days = calc.daysUntil(a.dueDate, now);
        return `<li class="${overdue ? 'overdue' : ''}">
          <a href="#/assignments/item:${esc(a.id)}">${esc(a.name || a.type)}</a>
          <span class="muted">${overdue ? 'Overdue' : ui.fmtDays(days)}</span>
        </li>`;
      })
      .join('');
  }

  function card(cls, sum, now) {
    const { stats, counts } = sum;
    const pctDone = counts.total ? (counts.done / counts.total) * 100 : 0;
    const upcoming = nextUp(sum.list, now);
    return `<article class="card class-card" style="--class:${esc(cls.color)}">
      <header>
        <div>
          <h3>${esc(cls.code)}</h3>
          <p class="muted">${esc(cls.name)} · ${esc(cls.credits)} cr</p>
        </div>
        <div class="grade-big">
          <strong>${ui.fmtPct(stats.current)}</strong>
          <span>${esc(sum.letter || '—')}</span>
        </div>
      </header>
      <div class="progress" title="${counts.done} of ${counts.total} complete"><span style="width:${pctDone}%"></span></div>
      <dl class="counts">
        <div><dt>Total</dt><dd>${counts.total}</dd></div>
        <div><dt>Done</dt><dd>${counts.done}</dd></div>
        <div><dt>Remaining</dt><dd>${counts.todo}</dd></div>
        <div class="${counts.overdue ? 'warn' : ''}"><dt>Overdue</dt><dd>${counts.overdue}</dd></div>
      </dl>
      <p class="muted small">Secured ${ui.fmtNum(stats.earned, 1)} of ${ui.fmtNum(stats.gradedWeight, 0)} graded marks.</p>
      ${upcoming ? `<h4>Next up</h4><ul class="next-up">${upcoming}</ul>` : '<p class="muted small">Nothing due.</p>'}
      <footer>
        <a href="#/assignments/class:${esc(cls.id)}">Assignments</a>
        <a href="#/grades/${esc(cls.id)}">Grades</a>
      </footer>
    </article>`;
  }

  function render(el) {
    const classes = store.activeClasses();
    if (!classes.length) return welcome(el);

    const now = new Date();
    const sums = classes.map((c) => store.classSummary(c, now));
    const t = sums.reduce((acc, s) => {
      for (const k in s.counts) acc[k] = (acc[k] || 0) + s.counts[k];
      return acc;
    }, {});
    const semGpa = calc.gpa(classes.map((c, i) => ({ credits: c.credits, points: sums[i].points })));
    const pctDone = t.total ? (t.done / t.total) * 100 : 0;

    el.innerHTML = `
      <h1>My classes <span class="muted">· ${esc(store.activeSemester().name)}</span></h1>
      <section class="tiles">
        <div class="tile"><span>Classes</span><strong>${classes.length}</strong></div>
        <div class="tile"><span>Assignments</span><strong>${t.total}</strong></div>
        <div class="tile"><span>Completed</span><strong>${t.done}</strong></div>
        <div class="tile"><span>Remaining</span><strong>${t.todo}</strong></div>
        <div class="tile ${t.overdue ? 'warn' : ''}"><span>Overdue</span><strong>${t.overdue}</strong></div>
        <div class="tile"><span>Due in 7 days</span><strong>${t.dueWeek}</strong></div>
        <div class="tile"><span>Semester GPA</span><strong>${ui.fmtNum(semGpa.gpa)}</strong><small>projected</small></div>
      </section>
      <div class="progress big" title="${t.done} of ${t.total} complete"><span style="width:${pctDone}%"></span></div>
      <p class="muted small">${pctDone.toFixed(0)}% of this semester's assignments are done.</p>
      <section class="card-grid">${classes.map((c, i) => card(c, sums[i], now)).join('')}</section>`;
  }

  GT.views = GT.views || {};
  GT.views.classes = { title: 'My classes', render };
})(window.GT);
