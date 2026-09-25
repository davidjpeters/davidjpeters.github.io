/*
 * Semester: credits, letters and grade points per class, semester GPA,
 * and cumulative GPA across every semester plus any prior record.
 */
(function (GT) {
  'use strict';

  const { store, calc, ui } = GT;
  const { esc } = ui;

  // GPA for any semester's classes. "Projected" if any class lacks a final letter.
  function semesterResult(sem) {
    const classes = store.state.classes.filter((c) => c.semesterId === sem.id);
    const sums = classes.map((c) => store.classSummary(c));
    const g = calc.gpa(classes.map((c, i) => ({ credits: c.credits, points: sums[i].points })));
    const earned = classes.reduce((t, c, i) => t + (sums[i].isFinal && sums[i].points > 0 ? Number(c.credits) || 0 : 0), 0);
    const attempted = classes.reduce((t, c) => t + (Number(c.credits) || 0), 0);
    return { classes, sums, ...g, earned, attempted, projected: sums.some((s) => !s.isFinal) };
  }

  function render(el) {
    const sem = store.activeSemester();
    if (!sem) {
      el.innerHTML = ui.emptyState('No semesters yet', 'Add a semester and classes in Settings.', '<a class="btn primary" href="#/settings">Go to Settings</a>');
      return;
    }
    const { gpaScale, prior } = store.state.settings;
    const res = semesterResult(sem);
    const letters = gpaScale.map((r) => r.letter);

    const rows = res.classes.map((c, i) => {
      const s = res.sums[i];
      const qp = s.points === null ? null : s.points * (Number(c.credits) || 0);
      return `<tr data-id="${esc(c.id)}">
        <td>${ui.classTag(c)}</td>
        <td>${esc(c.name)}</td>
        <td><input type="number" class="weight" data-field="credits" value="${esc(c.credits)}" min="0" step="any" aria-label="Credits"></td>
        <td class="num">${ui.fmtPct(s.stats.current)}</td>
        <td class="num">${esc(s.autoLetter || '—')}</td>
        <td><select data-field="finalLetter" aria-label="Final letter">${ui.options(letters, c.finalLetter, 'Not final yet')}</select></td>
        <td class="num">${s.points === null ? '—' : ui.fmtNum(s.points)}${s.isFinal || s.points === null ? '' : ' <span class="muted">(proj.)</span>'}</td>
        <td class="num">${ui.fmtNum(qp)}</td>
      </tr>`;
    }).join('');

    // Cumulative across all semesters, plus the prior record.
    const all = store.state.semesters.map((x) => ({ sem: x, r: semesterResult(x) }));
    const priorCredits = Number(prior.credits) || 0;
    let cCredits = priorCredits, cQp = priorCredits * (Number(prior.gpa) || 0);
    for (const { r } of all) { cCredits += r.credits; cQp += r.qualityPoints; }
    const cumulative = cCredits > 0 ? cQp / cCredits : null;
    const anyProjected = all.some(({ r }) => r.projected && r.classes.length);

    el.innerHTML = `
      <h1>Semester <span class="muted">· ${esc(sem.name)}</span></h1>
      <section class="tiles">
        <div class="tile"><span>Semester GPA</span><strong>${ui.fmtNum(res.gpa)}</strong><small>${res.projected ? 'projected' : 'final'}</small></div>
        <div class="tile"><span>Credits attempted</span><strong>${ui.fmtNum(res.attempted, 1)}</strong></div>
        <div class="tile"><span>Credits earned</span><strong>${ui.fmtNum(res.earned, 1)}</strong><small>final passing grades</small></div>
        <div class="tile"><span>Quality points</span><strong>${ui.fmtNum(res.qualityPoints)}</strong></div>
        <div class="tile accent"><span>Cumulative GPA</span><strong>${ui.fmtNum(cumulative)}</strong><small>${ui.fmtNum(cCredits, 1)} credits${anyProjected ? ', projected' : ''}</small></div>
      </section>

      <div class="table-wrap"><table class="grid">
        <thead><tr><th>Code</th><th>Class</th><th>Credits</th><th>Current</th><th>Letter</th>
          <th title="The official grade once it is posted. Overrides the calculated letter.">Final letter</th>
          <th>Grade pts</th><th title="Grade points × credits">Quality pts</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="8" class="muted">No classes in this semester.</td></tr>'}</tbody>
      </table></div>
      <p class="muted small">Until you set a final letter, a class counts with the letter from its current grade (projected).
        Semester GPA = Σ(grade points × credits) ÷ Σ credits.</p>

      <h2>All semesters</h2>
      <div class="table-wrap"><table class="grid compact">
        <thead><tr><th>Semester</th><th>Credits</th><th>GPA</th><th></th></tr></thead>
        <tbody>
          ${priorCredits ? `<tr><td>Prior record</td><td class="num">${ui.fmtNum(priorCredits, 1)}</td><td class="num">${ui.fmtNum(Number(prior.gpa))}</td><td class="muted">from Settings</td></tr>` : ''}
          ${all.map(({ sem: x, r }) => `<tr${x.id === sem.id ? ' class="current"' : ''}>
            <td>${esc(x.name)}</td><td class="num">${ui.fmtNum(r.credits, 1)}</td><td class="num">${ui.fmtNum(r.gpa)}</td>
            <td class="muted">${r.classes.length ? (r.projected ? 'projected' : 'final') : 'no classes'}</td></tr>`).join('')}
          <tr class="total"><td>Cumulative</td><td class="num">${ui.fmtNum(cCredits, 1)}</td><td class="num">${ui.fmtNum(cumulative)}</td><td></td></tr>
        </tbody>
      </table></div>`;

    el.querySelector('tbody').addEventListener('change', (e) => {
      const field = e.target.dataset.field;
      if (!field) return;
      const cls = store.classById(e.target.closest('tr').dataset.id);
      cls[field] = field === 'credits' ? Number(e.target.value) || 0 : e.target.value;
      store.save();
      GT.app.render();
    });
  }

  GT.views = GT.views || {};
  GT.views.semester = { title: 'Semester', render };
})(window.GT);
