/*
 * Calendar: month or week grid of due dates (coloured by status, edged by class colour),
 * optional weekly class schedule, and an agenda of the next 14 days.
 */
(function (GT) {
  'use strict';

  const { store, calc, ui } = GT;
  const { esc } = ui;
  const AGENDA_DAYS = 14;

  let cursor = calc.toISODate(new Date()); // any date inside the period being shown

  function periodStart(mode) {
    const d = calc.parseDate(cursor);
    if (mode === 'month') d.setDate(1);
    d.setDate(d.getDate() - d.getDay()); // back to Sunday
    return calc.toISODate(d);
  }

  function shift(mode, dir) {
    const d = calc.parseDate(cursor);
    if (mode === 'month') d.setMonth(d.getMonth() + dir, 1);
    else d.setDate(d.getDate() + 7 * dir);
    cursor = calc.toISODate(d);
  }

  // Index assignments by due date and collect schedule rows by weekday.
  function buildIndex() {
    const classes = store.activeClasses();
    const ids = new Set(classes.map((c) => c.id));
    const byDate = {};
    for (const a of store.state.assignments) {
      if (!ids.has(a.classId) || !a.dueDate) continue;
      (byDate[a.dueDate] = byDate[a.dueDate] || []).push(a);
    }
    for (const k in byDate) byDate[k].sort((a, b) => (a.dueTime || '99').localeCompare(b.dueTime || '99'));

    const byDay = [[], [], [], [], [], [], []];
    for (const c of classes) {
      for (const m of c.schedule || []) byDay[m.day].push({ cls: c, m });
    }
    byDay.forEach((list) => list.sort((x, y) => x.m.start.localeCompare(y.m.start)));
    return { byDate, byDay };
  }

  function itemHtml(a) {
    const cls = store.classById(a.classId);
    const st = ui.status(a.status);
    const label = `${cls ? cls.code : ''} ${a.name || a.type}`;
    const tip = `${label} · ${a.type} · ${a.status}${a.dueTime ? ' · ' + a.dueTime : ''}`;
    return `<a class="cal-item${st.kind !== 'todo' ? ' is-done' : ''}" href="#/assignments/item:${esc(a.id)}"
      style="--status:${esc(st.color)};--class:${esc(cls ? cls.color : 'transparent')}" title="${esc(tip)}">
      ${a.dueTime ? `<time>${esc(a.dueTime)}</time> ` : ''}<span>${esc(label)}</span></a>`;
  }

  function sessionHtml({ cls, m }) {
    const tip = `${cls.code} ${m.kind || ''} ${m.start}–${m.end}${m.location ? ' · ' + m.location : ''}`;
    return `<div class="cal-session" style="--class:${esc(cls.color)}" title="${esc(tip)}">
      <time>${esc(m.start)}</time> <span>${esc(cls.code)}${m.kind ? ' ' + esc(m.kind) : ''}</span></div>`;
  }

  function dayCell(iso, index, opts) {
    const d = calc.parseDate(iso);
    const sem = store.activeSemester();
    const inTerm = sem && (!sem.start || iso >= sem.start) && (!sem.end || iso <= sem.end);
    const sessions = opts.showSchedule && inTerm ? index.byDay[d.getDay()] : [];
    const items = index.byDate[iso] || [];
    const classes = ['cal-day'];
    if (iso === opts.today) classes.push('today');
    if (opts.month !== null && d.getMonth() !== opts.month) classes.push('other-month');
    return `<div class="${classes.join(' ')}">
      <div class="cal-date">${opts.mode === 'week' ? ui.fmtDate(iso) : d.getDate()}</div>
      ${sessions.map(sessionHtml).join('')}
      ${items.map(itemHtml).join('')}
    </div>`;
  }

  function agenda(index, today) {
    const { statuses } = store.state.settings;
    const now = new Date();
    let html = '';
    // Overdue first, then the next two weeks.
    const overdue = store.state.assignments
      .filter((a) => store.activeClasses().some((c) => c.id === a.classId) && calc.isOverdue(a, statuses, now))
      .sort((a, b) => calc.dueDateTime(a) - calc.dueDateTime(b));
    if (overdue.length) html += `<h3 class="warn-text">Overdue</h3><div class="agenda-list">${overdue.map(itemHtml).join('')}</div>`;
    for (let i = 0; i < AGENDA_DAYS; i++) {
      const iso = calc.addDays(today, i);
      const items = (index.byDate[iso] || []).filter((a) => calc.statusKind(a.status, statuses) === 'todo' && !calc.isOverdue(a, statuses, now));
      if (!items.length) continue;
      html += `<h3>${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : ui.fmtDate(iso)}</h3><div class="agenda-list">${items.map(itemHtml).join('')}</div>`;
    }
    return html || '<p class="muted">Nothing due in the next two weeks.</p>';
  }

  function render(el) {
    const uiState = store.state.settings.ui;
    const mode = uiState.calendarMode === 'week' ? 'week' : 'month';
    const today = calc.toISODate(new Date());
    const index = buildIndex();
    const start = periodStart(mode);
    const cur = calc.parseDate(cursor);

    // Month: as many weeks as the month spans (4 to 6). Week: 7 days.
    let days = 7;
    if (mode === 'month') {
      const last = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const span = Math.round((last - calc.parseDate(start)) / 86400000) + 1;
      days = Math.ceil(span / 7) * 7;
    }
    const opts = { mode, today, showSchedule: uiState.showSchedule, month: mode === 'month' ? cur.getMonth() : null };
    const cells = [];
    for (let i = 0; i < days; i++) cells.push(dayCell(calc.addDays(start, i), index, opts));

    const title = mode === 'month'
      ? `${ui.MONTHS[cur.getMonth()]} ${cur.getFullYear()}`
      : `Week of ${ui.fmtDate(start)}`;

    const legend = store.state.settings.statuses
      .map((s) => `<span class="legend-item"><span class="swatch" style="background:${esc(s.color)}"></span>${esc(s.name)}</span>`)
      .join('');

    el.innerHTML = `
      <div class="view-head">
        <h1>${esc(title)}</h1>
        <div class="btn-row">
          <button class="btn" data-act="prev" aria-label="Previous">‹</button>
          <button class="btn" data-act="today">Today</button>
          <button class="btn" data-act="next" aria-label="Next">›</button>
          <div class="segmented" role="group" aria-label="Calendar view">
            <button class="btn ${mode === 'month' ? 'active' : ''}" data-mode="month">Month</button>
            <button class="btn ${mode === 'week' ? 'active' : ''}" data-mode="week">Week</button>
          </div>
          <label class="check"><input type="checkbox" data-act="schedule" ${uiState.showSchedule ? 'checked' : ''}> Class schedule</label>
        </div>
      </div>
      <div class="legend">${legend}</div>
      <div class="cal cal-${mode}">
        ${ui.DAY_NAMES.map((d) => `<div class="cal-head">${d}</div>`).join('')}
        ${cells.join('')}
      </div>
      <section class="agenda"><h2>Coming up</h2>${agenda(index, today)}</section>`;

    el.querySelector('.view-head').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.mode) store.setPath('settings.ui.calendarMode', btn.dataset.mode);
      else if (btn.dataset.act === 'prev') shift(mode, -1);
      else if (btn.dataset.act === 'next') shift(mode, 1);
      else if (btn.dataset.act === 'today') cursor = today;
      GT.app.render();
    });
    el.querySelector('[data-act="schedule"]').addEventListener('change', (e) => {
      store.setPath('settings.ui.showSchedule', e.target.checked);
      GT.app.render();
    });
  }

  GT.views = GT.views || {};
  GT.views.calendar = { title: 'Calendar', render };
})(window.GT);
