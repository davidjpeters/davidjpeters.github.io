/*
 * Assignments: spreadsheet-style editor.
 * Inputs carry data-field; one delegated listener writes changes to the store,
 * then refreshes only that row's calculated cells (a full re-render would steal focus).
 * Params: #/assignments/class:<id> filters to a class, #/assignments/item:<id> highlights a row.
 */
(function (GT) {
  'use strict';

  const { store, calc, ui } = GT;
  const { esc } = ui;

  // Filters survive navigation within the session.
  const filters = { classId: '', status: '', type: '', hideDone: false, search: '', sort: 'due' };

  const settings = () => store.state.settings;

  function visibleAssignments() {
    const classIds = new Set(store.activeClasses().map((c) => c.id));
    const q = filters.search.toLowerCase();
    const list = store.state.assignments.filter((a) => {
      if (!classIds.has(a.classId)) return false;
      if (filters.classId && a.classId !== filters.classId) return false;
      if (filters.status && a.status !== filters.status) return false;
      if (filters.type && a.type !== filters.type) return false;
      if (filters.hideDone && calc.statusKind(a.status, settings().statuses) !== 'todo') return false;
      if (q && !`${a.name} ${a.type} ${a.notes}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const byDue = (a, b) => (calc.dueDateTime(a) || Infinity) - (calc.dueDateTime(b) || Infinity);
    const classOrder = (a) => store.activeClasses().findIndex((c) => c.id === a.classId);
    const sorters = {
      due: byDue,
      class: (a, b) => classOrder(a) - classOrder(b) || byDue(a, b),
      status: (a, b) =>
        settings().statuses.findIndex((s) => s.name === a.status) -
          settings().statuses.findIndex((s) => s.name === b.status) || byDue(a, b),
    };
    return list.sort(sorters[filters.sort] || byDue);
  }

  function row(a) {
    const s = settings();
    const classOpts = store.activeClasses().map((c) => ({ value: c.id, label: c.code }));
    return `<tr data-id="${esc(a.id)}">
      <td><select data-field="classId" aria-label="Class">${ui.options(classOpts, a.classId)}</select></td>
      <td><input data-field="name" value="${esc(a.name)}" placeholder="${esc(a.type || 'Name')}" aria-label="Name"></td>
      <td><select data-field="type" aria-label="Type">${ui.options(s.assignmentTypes, a.type, '—')}</select></td>
      <td><select data-field="status" class="status-select" aria-label="Status">${ui.options(s.statuses.map((x) => x.name), a.status)}</select></td>
      <td><input type="date" data-field="dueDate" value="${esc(a.dueDate)}" aria-label="Due date"></td>
      <td><input type="time" data-field="dueTime" value="${esc(a.dueTime)}" aria-label="Due time"></td>
      <td data-out="days" class="num"></td>
      <td><input data-field="score" class="score" value="${esc(calc.formatScore(a))}" placeholder="–" aria-label="Score (45/50 or 90)"></td>
      <td data-out="pct" class="num"></td>
      <td><input type="number" data-field="weight" class="weight" value="${esc(a.weight)}" min="0" step="any" aria-label="Weight %"></td>
      <td data-out="contrib" class="num"></td>
      <td data-out="letter" class="num"></td>
      <td class="row-actions">
        <button type="button" data-act="dup" title="Duplicate, due one week later" aria-label="Duplicate">⧉</button>
        <button type="button" data-act="del" title="Delete" aria-label="Delete">✕</button>
      </td>
      <td><input data-field="notes" value="${esc(a.notes)}" placeholder="Notes" aria-label="Notes"></td>
    </tr>`;
  }

  // Refresh the calculated cells and colours of one row.
  function fillComputed(tr, a, now) {
    const s = settings();
    const cls = store.classById(a.classId);
    const status = ui.status(a.status);
    tr.style.setProperty('--status', status.color);
    tr.style.setProperty('--class', cls ? cls.color : 'transparent');
    tr.classList.toggle('is-done', status.kind !== 'todo');

    const overdue = calc.isOverdue(a, s.statuses, now);
    const days = calc.daysUntil(a.dueDate, now);
    const daysCell = tr.querySelector('[data-out="days"]');
    daysCell.textContent = status.kind === 'todo' ? (overdue ? 'Overdue' : ui.fmtDays(days)) : '';
    daysCell.className = 'num' + (overdue ? ' overdue' : days !== null && days <= 2 && status.kind === 'todo' ? ' soon' : '');

    const pct = calc.scorePercent(a);
    const contrib = calc.contribution(a);
    tr.querySelector('[data-out="pct"]').textContent = pct === null ? '' : ui.fmtPct(pct);
    tr.querySelector('[data-out="contrib"]').textContent = contrib === null ? '' : `${ui.fmtNum(contrib)}%`;
    tr.querySelector('[data-out="letter"]').textContent = pct === null ? '' : calc.letterFor(pct, store.scaleFor(cls));
  }

  // Weight total per class, so missing or double-counted weights are obvious.
  function weightSummary() {
    return store.activeClasses().map((c) => {
      const st = calc.classStats(store.assignmentsFor(c.id), settings().statuses);
      const ok = Math.abs(st.totalWeight - 100) < 0.01;
      return `<span class="chip ${ok ? 'ok' : 'warn'}" title="Sum of weights entered for ${esc(c.code)}">
        ${ui.classTag(c)} ${ui.fmtNum(st.totalWeight, 1)}% weighted ${ok ? '✓' : ''}</span>`;
    }).join('');
  }

  function nextName(name) {
    const m = name.match(/^(.*?)(\d+)$/);
    return m ? m[1] + (Number(m[2]) + 1) : name;
  }

  function render(el, param) {
    const classes = store.activeClasses();
    if (!classes.length) {
      el.innerHTML = ui.emptyState('No classes yet', 'Add classes for this semester first.', '<a class="btn primary" href="#/settings">Go to Settings</a>');
      return;
    }

    let highlightId = null;
    if (param && param.startsWith('class:')) filters.classId = param.slice(6);
    if (param && param.startsWith('item:')) highlightId = param.slice(5);
    if (filters.classId && !classes.some((c) => c.id === filters.classId)) filters.classId = '';

    const s = settings();
    let list = visibleAssignments();
    // Linked to a row the filters hide: clear them so it shows.
    if (highlightId && !list.some((a) => a.id === highlightId)) {
      Object.assign(filters, { classId: '', status: '', type: '', hideDone: false, search: '' });
      list = visibleAssignments();
    }
    const now = new Date();

    el.innerHTML = `
      <div class="view-head">
        <h1>Assignments</h1>
        <button class="btn primary" data-act="add">+ Add assignment</button>
      </div>
      <form class="filters" onsubmit="return false">
        <select data-filter="classId" aria-label="Filter by class">${ui.options(classes.map((c) => ({ value: c.id, label: c.code })), filters.classId, 'All classes')}</select>
        <select data-filter="status" aria-label="Filter by status">${ui.options(s.statuses.map((x) => x.name), filters.status, 'All statuses')}</select>
        <select data-filter="type" aria-label="Filter by type">${ui.options(s.assignmentTypes, filters.type, 'All types')}</select>
        <input type="search" data-filter="search" value="${esc(filters.search)}" placeholder="Search" aria-label="Search">
        <label class="check"><input type="checkbox" data-filter="hideDone" ${filters.hideDone ? 'checked' : ''}> Only to-do</label>
        <label>Sort <select data-filter="sort">${ui.options([
          { value: 'due', label: 'Due date' }, { value: 'class', label: 'Class' }, { value: 'status', label: 'Status' },
        ], filters.sort)}</select></label>
      </form>
      <div class="table-wrap">
        <table class="grid">
          <thead><tr>
            <th>Class</th><th>Name</th><th>Type</th><th>Status</th><th>Due</th><th>Time</th><th>Until due</th>
            <th title="45/50 for a fraction, 90 for a percentage">Score</th><th>%</th><th>Weight %</th>
            <th title="Points this adds to your final grade">Adds</th><th>Grade</th><th></th><th>Notes</th>
          </tr></thead>
          <tbody>${list.map(row).join('')}</tbody>
        </table>
        ${list.length ? '' : '<p class="muted pad">No assignments match. Add one or clear the filters.</p>'}
      </div>
      <p class="muted small">Score accepts <code>45/50</code> or <code>90</code>. <em>Adds</em> is score × weight: a 30% midterm at 90% adds 27% to your final grade.</p>
      <div class="chips" data-out="weights">${weightSummary()}</div>`;

    const tbody = el.querySelector('tbody');
    const byId = (id) => store.state.assignments.find((a) => a.id === id);

    tbody.querySelectorAll('tr').forEach((tr) => fillComputed(tr, byId(tr.dataset.id), now));

    // Edits
    tbody.addEventListener('input', (e) => {
      const input = e.target;
      const field = input.dataset.field;
      if (!field) return;
      const tr = input.closest('tr');
      const a = byId(tr.dataset.id);

      if (field === 'score') {
        const parsed = calc.parseScore(input.value);
        input.classList.toggle('invalid', parsed === null);
        if (parsed === null) return;
        a.scoreReceived = parsed.received;
        a.scorePossible = parsed.possible;
      } else if (field === 'weight') {
        a.weight = input.value === '' ? 0 : Number(input.value);
      } else {
        a[field] = input.value;
      }
      if (field === 'name') input.placeholder = a.type || 'Name';
      store.save();
      fillComputed(tr, a, new Date());
      if (field === 'weight' || field === 'status' || field === 'classId') {
        el.querySelector('[data-out="weights"]').innerHTML = weightSummary();
      }
    });

    // Row buttons
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.closest('tr').dataset.id;
      const a = byId(id);
      if (btn.dataset.act === 'del') {
        if (!confirm(`Delete "${a.name || a.type || 'this assignment'}"?`)) return;
        store.state.assignments = store.state.assignments.filter((x) => x.id !== id);
        store.save();
        GT.app.render();
      } else if (btn.dataset.act === 'dup') {
        const copy = Object.assign(store.newAssignment(a.classId), {
          name: nextName(a.name), type: a.type, dueTime: a.dueTime, weight: a.weight,
          dueDate: a.dueDate ? calc.addDays(a.dueDate, 7) : '',
        });
        store.state.assignments.push(copy);
        store.save();
        location.hash = `#/assignments/item:${copy.id}`;
      }
    });

    // Filters
    el.querySelector('.filters').addEventListener('input', (e) => {
      const key = e.target.dataset.filter;
      if (!key) return;
      filters[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      const hadFocus = key === 'search';
      if (location.hash.includes('/assignments/')) history.replaceState(null, '', '#/assignments');
      GT.app.render();
      if (hadFocus) {
        const box = document.querySelector('[data-filter="search"]');
        box.focus();
        box.setSelectionRange(box.value.length, box.value.length);
      }
    });

    el.querySelector('[data-act="add"]').addEventListener('click', () => {
      const a = store.newAssignment(filters.classId || classes[0].id);
      store.state.assignments.push(a);
      store.save();
      location.hash = `#/assignments/item:${a.id}`;
    });

    if (highlightId) {
      const tr = tbody.querySelector(`tr[data-id="${CSS.escape(highlightId)}"]`);
      if (tr) {
        tr.classList.add('highlight');
        tr.scrollIntoView({ block: 'center' });
        const nameInput = tr.querySelector('[data-field="name"]');
        if (!nameInput.value) nameInput.focus();
      }
    }
  }

  GT.views = GT.views || {};
  GT.views.assignments = { title: 'Assignments', render };
})(window.GT);
