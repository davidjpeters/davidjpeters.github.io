/*
 * Settings: everything user-configurable.
 *
 * Wiring convention (keeps this file mostly markup):
 *   <input data-path="classes.2.name">        writes the value to that path on change
 *   data-num                                    store as a number
 *   data-rename="type|status|letter"            also rename existing uses of the old value
 *   data-refresh                                re-render after the change
 *   <button data-add="path" data-tpl="name">    push a new item from TEMPLATES
 *   <button data-del="path" data-index="i">     remove item i from the array at path
 */
(function (GT) {
  'use strict';

  const { store, calc, ui } = GT;
  const { esc } = ui;

  const KINDS = [
    { value: 'todo', label: 'To do' },
    { value: 'done', label: 'Done' },
    { value: 'excluded', label: 'Excluded' },
  ];
  const DAYS = ui.DAY_NAMES.map((d, i) => ({ value: i, label: d }));

  const TEMPLATES = {
    semester: () => store.newSemester(),
    class: () => store.newClass(store.activeSemester().id),
    meeting: () => ({ day: 1, start: '09:00', end: '10:20', kind: 'Lecture', location: '' }),
    type: () => 'New type',
    status: () => ({ name: 'New status', color: '#7950f2', kind: 'todo' }),
    scale: () => ({ letter: '?', min: 0 }),
    gpa: () => ({ letter: '?', points: 0 }),
  };

  // What to update elsewhere when a name changes.
  const RENAMES = {
    type: (oldV, newV) => store.state.assignments.forEach((a) => { if (a.type === oldV) a.type = newV; }),
    status: (oldV, newV) => store.state.assignments.forEach((a) => { if (a.status === oldV) a.status = newV; }),
    letter: (oldV, newV) => store.state.classes.forEach((c) => { if (c.finalLetter === oldV) c.finalLetter = newV; }),
  };

  // Remember open <details> panels across re-renders.
  const openPanels = new Set();
  const panel = (key) => `data-key="${key}" ${openPanels.has(key) ? 'open' : ''}`;

  const delBtn = (path, i, label = 'Remove') =>
    `<button type="button" class="icon-btn" data-del="${path}" data-index="${i}" aria-label="${label}" title="${label}">✕</button>`;

  /* ---------- Sections ---------- */

  function dataSection() {
    const last = store.state.settings.lastExport;
    return `<section class="card" id="data">
      <h2>Backup</h2>
      <p class="muted">Your data is saved in this browser's local storage. It does not sync between devices and is lost if site data is cleared.
        Export a backup now and then; import it here or on another device.</p>
      <p class="small">Last export: <strong>${last ? new Date(last).toLocaleString('en-CA') : 'never'}</strong></p>
      <div class="btn-row">
        <button class="btn primary" data-act="export">Export backup</button>
        <label class="btn">Import backup<input type="file" accept="application/json,.json" data-act="import" hidden></label>
        <button class="btn" data-act="sample">Load sample data</button>
        <button class="btn danger" data-act="reset">Erase everything</button>
      </div>
    </section>`;
  }

  function semestersSection() {
    const s = store.state;
    const active = store.activeSemester();
    const rows = s.semesters.map((x, i) => `<tr>
      <td><input type="radio" name="active-sem" data-act="activate" value="${esc(x.id)}" ${active && active.id === x.id ? 'checked' : ''} aria-label="Active"></td>
      <td><input data-path="semesters.${i}.name" data-refresh value="${esc(x.name)}" aria-label="Name"></td>
      <td><input type="date" data-path="semesters.${i}.start" value="${esc(x.start)}" aria-label="Start"></td>
      <td><input type="date" data-path="semesters.${i}.end" value="${esc(x.end)}" aria-label="End"></td>
      <td>${delBtn('semesters', i, 'Delete semester')}</td>
    </tr>`).join('');
    return `<section class="card" id="semesters">
      <h2>Semesters</h2>
      <p class="muted small">Start and end dates bound the class schedule on the calendar. The selected one is the active semester.</p>
      <div class="table-wrap"><table class="grid compact">
        <thead><tr><th>Active</th><th>Name</th><th>Start</th><th>End</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="muted">None yet.</td></tr>'}</tbody>
      </table></div>
      <button class="btn" data-add="semesters" data-tpl="semester">+ Add semester</button>
    </section>`;
  }

  function scaleEditor(path, rows) {
    return `<table class="grid compact scale">
      <thead><tr><th>Letter</th><th>Minimum %</th><th></th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr>
        <td><input data-path="${path}.${i}.letter" value="${esc(r.letter)}" class="short" aria-label="Letter"></td>
        <td><input type="number" data-num data-path="${path}.${i}.min" value="${esc(r.min)}" step="any" class="short" aria-label="Minimum %"></td>
        <td>${delBtn(path, i)}</td></tr>`).join('')}
      </tbody></table>
      <button class="btn small" data-add="${path}" data-tpl="scale">+ Add letter</button>`;
  }

  function classCard(c) {
    const i = store.state.classes.indexOf(c);
    const p = `classes.${i}`;
    const semOpts = store.state.semesters.map((x) => ({ value: x.id, label: x.name }));
    const meetings = (c.schedule || []).map((m, j) => `<tr>
      <td><select data-path="${p}.schedule.${j}.day" data-num aria-label="Day">${ui.options(DAYS, m.day)}</select></td>
      <td><input type="time" data-path="${p}.schedule.${j}.start" value="${esc(m.start)}" aria-label="Start"></td>
      <td><input type="time" data-path="${p}.schedule.${j}.end" value="${esc(m.end)}" aria-label="End"></td>
      <td><input data-path="${p}.schedule.${j}.kind" value="${esc(m.kind)}" list="meeting-kinds" class="short" aria-label="Type"></td>
      <td><input data-path="${p}.schedule.${j}.location" value="${esc(m.location)}" placeholder="Room" class="short" aria-label="Location"></td>
      <td>${delBtn(`${p}.schedule`, j)}</td></tr>`).join('');

    return `<article class="card class-edit" style="--class:${esc(c.color)}">
      <div class="form-grid">
        <label>Code<input data-path="${p}.code" value="${esc(c.code)}"></label>
        <label class="wide">Name<input data-path="${p}.name" value="${esc(c.name)}"></label>
        <label>Credits<input type="number" data-num data-path="${p}.credits" value="${esc(c.credits)}" min="0" step="any"></label>
        <label>Colour<input type="color" data-path="${p}.color" data-refresh value="${esc(c.color)}"></label>
        <label>Semester<select data-path="${p}.semesterId" data-refresh>${ui.options(semOpts, c.semesterId)}</select></label>
      </div>
      <details ${panel('sched-' + c.id)}>
        <summary>Weekly schedule (${(c.schedule || []).length})</summary>
        <div class="table-wrap"><table class="grid compact">
          <thead><tr><th>Day</th><th>Start</th><th>End</th><th>Type</th><th>Location</th><th></th></tr></thead>
          <tbody>${meetings || '<tr><td colspan="6" class="muted">No meetings.</td></tr>'}</tbody>
        </table></div>
        <button class="btn small" data-add="${p}.schedule" data-tpl="meeting">+ Add meeting</button>
      </details>
      <details ${panel('scale-' + c.id)}>
        <summary>Grading scale (${c.gradingScale ? 'custom' : 'default'})</summary>
        ${c.gradingScale
          ? `${scaleEditor(`${p}.gradingScale`, c.gradingScale)} <button class="btn small" data-act="scale-default" data-index="${i}">Use default scale</button>`
          : `<p class="muted small">Uses the default scale below.</p><button class="btn small" data-act="scale-custom" data-index="${i}">Customise for this class</button>`}
      </details>
      <div class="card-actions"><button class="btn danger small" data-del="classes" data-index="${i}">Delete class</button></div>
    </article>`;
  }

  function classesSection() {
    const sem = store.activeSemester();
    if (!sem) {
      return `<section class="card" id="classes"><h2>Classes</h2><p class="muted">Add a semester first.</p></section>`;
    }
    const classes = store.activeClasses();
    return `<section id="classes">
      <div class="view-head"><h2>Classes in ${esc(sem.name)}</h2>
        <button class="btn primary" data-add="classes" data-tpl="class">+ Add class</button></div>
      <datalist id="meeting-kinds"><option>Lecture</option><option>Lab</option><option>Tutorial</option><option>Seminar</option></datalist>
      <div class="card-grid">${classes.map(classCard).join('') || '<p class="muted">No classes yet.</p>'}</div>
    </section>`;
  }

  function listsSection() {
    const s = store.state.settings;
    const types = s.assignmentTypes.map((t, i) => `<li>
      <input data-path="settings.assignmentTypes.${i}" data-rename="type" value="${esc(t)}" aria-label="Type">${delBtn('settings.assignmentTypes', i)}</li>`).join('');
    const statuses = s.statuses.map((x, i) => `<tr>
      <td><input type="color" data-path="settings.statuses.${i}.color" value="${esc(x.color)}" aria-label="Colour"></td>
      <td><input data-path="settings.statuses.${i}.name" data-rename="status" value="${esc(x.name)}" aria-label="Name"></td>
      <td><select data-path="settings.statuses.${i}.kind" aria-label="Counts as">${ui.options(KINDS, x.kind)}</select></td>
      <td>${delBtn('settings.statuses', i)}</td></tr>`).join('');
    return `<div class="card-grid">
      <section class="card">
        <h2>Assignment types</h2>
        <ul class="plain-list">${types}</ul>
        <button class="btn small" data-add="settings.assignmentTypes" data-tpl="type">+ Add type</button>
      </section>
      <section class="card">
        <h2>Statuses</h2>
        <p class="muted small">"Counts as" drives the maths, so names are free to change. To do = remaining (can be overdue), Done = completed, Excluded = ignored everywhere.</p>
        <table class="grid compact"><thead><tr><th></th><th>Name</th><th>Counts as</th><th></th></tr></thead><tbody>${statuses}</tbody></table>
        <button class="btn small" data-add="settings.statuses" data-tpl="status">+ Add status</button>
      </section>
    </div>`;
  }

  function scalesSection() {
    const s = store.state.settings;
    const gpaRows = s.gpaScale.map((r, i) => `<tr>
      <td><input data-path="settings.gpaScale.${i}.letter" data-rename="letter" value="${esc(r.letter)}" class="short" aria-label="Letter"></td>
      <td><input type="number" data-num data-path="settings.gpaScale.${i}.points" value="${esc(r.points)}" step="any" class="short" aria-label="Points"></td>
      <td>${delBtn('settings.gpaScale', i)}</td></tr>`).join('');
    return `<div class="card-grid">
      <section class="card">
        <h2>Default grading scale</h2>
        <p class="muted small">Placeholder values: check your syllabus. A grade gets the highest letter whose minimum it meets.</p>
        ${scaleEditor('settings.gradingScale', s.gradingScale)}
      </section>
      <section class="card">
        <h2>GPA scale</h2>
        <p class="muted small">Letters must match the grading scale letters.</p>
        <table class="grid compact scale"><thead><tr><th>Letter</th><th>Grade points</th><th></th></tr></thead><tbody>${gpaRows}</tbody></table>
        <button class="btn small" data-add="settings.gpaScale" data-tpl="gpa">+ Add letter</button>
      </section>
      <section class="card">
        <h2>Prior record</h2>
        <p class="muted small">Credits and GPA from before you used this tracker, so cumulative GPA is right.</p>
        <div class="form-grid">
          <label>Credits completed<input type="number" data-num data-path="settings.prior.credits" value="${esc(s.prior.credits)}" min="0" step="any"></label>
          <label>Cumulative GPA<input type="number" data-num data-path="settings.prior.gpa" value="${esc(s.prior.gpa)}" min="0" step="0.01"></label>
        </div>
      </section>
    </div>`;
  }

  /* ---------- Behaviour ---------- */

  function deleteItem(path, index) {
    const arr = store.getPath(path);
    const item = arr[index];
    const s = store.state;
    if (path === 'classes') {
      const n = store.assignmentsFor(item.id).length;
      if (!confirm(`Delete ${item.code} and its ${n} assignment(s)?`)) return false;
      s.assignments = s.assignments.filter((a) => a.classId !== item.id);
    } else if (path === 'semesters') {
      const ids = new Set(s.classes.filter((c) => c.semesterId === item.id).map((c) => c.id));
      if (!confirm(`Delete ${item.name}, its ${ids.size} class(es) and their assignments?`)) return false;
      s.classes = s.classes.filter((c) => !ids.has(c.id));
      s.assignments = s.assignments.filter((a) => !ids.has(a.classId));
      if (s.settings.activeSemesterId === item.id) s.settings.activeSemesterId = null;
    } else if (path === 'settings.assignmentTypes' || path === 'settings.statuses') {
      const name = typeof item === 'string' ? item : item.name;
      const key = path.endsWith('Types') ? 'type' : 'status';
      const n = s.assignments.filter((a) => a[key] === name).length;
      if (n && !confirm(`${n} assignment(s) use "${name}". Remove it anyway?`)) return false;
    }
    arr.splice(index, 1);
    return true;
  }

  function render(el) {
    el.innerHTML = `
      <h1>Settings</h1>
      ${dataSection()}
      ${semestersSection()}
      ${classesSection()}
      ${listsSection()}
      ${scalesSection()}`;

    // toggle does not bubble, so listen in the capture phase.
    el.addEventListener('toggle', (e) => {
      const key = e.target.dataset && e.target.dataset.key;
      if (key) e.target.open ? openPanels.add(key) : openPanels.delete(key);
    }, true);

    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.act === 'activate') {
        store.setPath('settings.activeSemesterId', t.value);
        return GT.app.render();
      }
      if (t.dataset.act === 'import') return importFile(t.files[0]);
      const path = t.dataset.path;
      if (!path) return;
      const value = 'num' in t.dataset ? (t.value === '' ? 0 : Number(t.value)) : t.value;
      if (t.dataset.rename) {
        const oldV = store.getPath(path);
        if (oldV !== value) RENAMES[t.dataset.rename](oldV, value);
      }
      store.setPath(path, value);
      if ('refresh' in t.dataset) GT.app.render();
    });

    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const s = store.state;
      if (b.dataset.add) {
        const item = TEMPLATES[b.dataset.tpl]();
        store.getPath(b.dataset.add).push(item);
        if (b.dataset.tpl === 'semester' && !s.settings.activeSemesterId) s.settings.activeSemesterId = item.id;
      } else if (b.dataset.del) {
        if (!deleteItem(b.dataset.del, Number(b.dataset.index))) return;
      } else if (b.dataset.act === 'scale-custom') {
        s.classes[b.dataset.index].gradingScale = structuredClone(s.settings.gradingScale);
      } else if (b.dataset.act === 'scale-default') {
        if (!confirm('Discard this class\'s custom scale?')) return;
        s.classes[b.dataset.index].gradingScale = null;
      } else if (b.dataset.act === 'export') {
        const json = store.exportJSON();
        ui.download(`grade-tracker-${calc.toISODate(new Date())}.json`, json);
        ui.toast('Backup downloaded.');
      } else if (b.dataset.act === 'sample') {
        if (s.assignments.length && !confirm('Replace all your data with sample data? Export a backup first if unsure.')) return;
        store.loadSample();
        ui.toast('Sample data loaded.');
      } else if (b.dataset.act === 'reset') {
        if (!confirm('Erase all classes, assignments and settings? This cannot be undone.')) return;
        store.reset();
        ui.toast('Everything erased.');
      } else {
        return;
      }
      store.save();
      GT.app.render();
    });
  }

  function importFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!confirm('Replace all current data with this backup?')) return;
        store.importJSON(reader.result);
        ui.toast('Backup restored.');
        GT.app.render();
      } catch (err) {
        ui.toast(err.message || 'Could not read that file.', true);
      }
    };
    reader.readAsText(file);
  }

  GT.views = GT.views || {};
  GT.views.settings = { title: 'Settings', render };
})(window.GT);
