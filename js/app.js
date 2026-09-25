/*
 * app.js: hash router and header.
 * URLs look like #/view or #/view/param (e.g. #/grades/<classId>).
 */
(function (GT) {
  'use strict';

  const { store, ui } = GT;
  const DEFAULT_ROUTE = 'classes';
  const BACKUP_NAG_DAYS = 14;

  function parseHash() {
    const [, view, param] = location.hash.split('/');
    return { view: GT.views[view] ? view : DEFAULT_ROUTE, param: param ? decodeURIComponent(param) : null };
  }

  function renderHeader(view) {
    const s = store.state;
    const select = document.getElementById('semester-select');
    const active = store.activeSemester();
    select.innerHTML = s.semesters.length
      ? ui.options(s.semesters.map((x) => ({ value: x.id, label: x.name })), active && active.id)
      : '<option>No semesters yet</option>';
    select.disabled = !s.semesters.length;

    document.querySelectorAll('.tabs a').forEach((a) => {
      a.classList.toggle('active', a.dataset.route === view);
    });

    const last = s.settings.lastExport ? new Date(s.settings.lastExport) : null;
    const stale = !last || (Date.now() - last) / 86400000 > BACKUP_NAG_DAYS;
    document.getElementById('backup-nag').hidden = !(s.assignments.length && stale);
  }

  // Each render gets a fresh container so old event listeners are dropped with it.
  function render() {
    const { view, param } = parseHash();
    renderHeader(view);
    const main = document.getElementById('view');
    const container = document.createElement('div');
    container.className = `view view-${view}`;
    main.replaceChildren(container);
    GT.views[view].render(container, param);
    document.title = `${GT.views[view].title} · Grade Tracker`;
  }

  document.getElementById('semester-select').addEventListener('change', (e) => {
    store.setPath('settings.activeSemesterId', e.target.value);
    render();
  });

  window.addEventListener('hashchange', render);

  store.init();
  GT.app = { render };
  render();
})(window.GT);
