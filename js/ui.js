/*
 * ui.js: small shared helpers for building views.
 * Views build HTML with template strings; always pass user text through esc().
 */
(function (GT) {
  'use strict';

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);

  const fmtPct = (n, dp = 1) => (n === null || n === undefined || isNaN(n) ? '—' : `${n.toFixed(dp)}%`);
  const fmtNum = (n, dp = 2) => (n === null || n === undefined || isNaN(n) ? '—' : n.toFixed(dp));

  // "2026-09-29" -> "Tue 29 Sep"
  function fmtDate(iso) {
    const d = GT.calc.parseDate(iso);
    if (!d) return '';
    return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  }

  // Days until due as a short label.
  function fmtDays(days) {
    if (days === null) return '';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days === -1) return 'Yesterday';
    return days > 0 ? `${days} days` : `${-days} days ago`;
  }

  // <option> list. items: strings or { value, label }.
  function options(items, selected, blankLabel) {
    let html = blankLabel !== undefined ? `<option value="">${esc(blankLabel)}</option>` : '';
    for (const it of items) {
      const value = typeof it === 'string' ? it : it.value;
      const label = typeof it === 'string' ? it : it.label;
      html += `<option value="${esc(value)}"${String(value) === String(selected) ? ' selected' : ''}>${esc(label)}</option>`;
    }
    return html;
  }

  function status(name) {
    return GT.store.state.settings.statuses.find((s) => s.name === name) || { name, color: '#868e96', kind: 'todo' };
  }

  function statusPill(name) {
    const s = status(name);
    return `<span class="pill" style="--c:${esc(s.color)}">${esc(name || '—')}</span>`;
  }

  function classTag(cls) {
    if (!cls) return '<span class="muted">No class</span>';
    return `<span class="class-tag"><span class="dot" style="background:${esc(cls.color)}"></span>${esc(cls.code)}</span>`;
  }

  let toastTimer;
  function toast(message, isError) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = 'toast'), 2600);
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function emptyState(title, body, action) {
    return `<div class="empty"><h2>${esc(title)}</h2><p>${body}</p>${action || ''}</div>`;
  }

  GT.ui = { DAY_NAMES, MONTHS, esc, fmtPct, fmtNum, fmtDate, fmtDays, options, status, statusPill, classTag, toast, download, emptyState };
})(window.GT = window.GT || {});
