/**
 * leaderboard.js — Local leaderboard / persistence
 */

const Leaderboard = (() => {
  const KEY = 'magic_tetris_lb';
  const MAX  = 10;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function save(entries) {
    localStorage.setItem(KEY, JSON.stringify(entries));
  }

  function add(entry) {
    // entry: { nickname, avatarDataUrl, score, lines, level, difficulty, rank, date }
    const entries = load();
    entries.push({ ...entry, date: Date.now() });
    entries.sort((a, b) => b.score - a.score);
    const trimmed = entries.slice(0, MAX);
    save(trimmed);
    return trimmed;
  }

  function getBestScore(nickname) {
    const entries = load();
    const mine    = entries.filter(e => e.nickname === nickname);
    return mine.length ? Math.max(...mine.map(e => e.score)) : 0;
  }

  function getGlobalBest() {
    const entries = load();
    return entries.length ? entries[0].score : 0;
  }

  function getPosition(score) {
    const entries = load();
    const above   = entries.filter(e => e.score > score).length;
    return above + 1;
  }

  function renderRows(entries, containerEl, limit = MAX) {
    if (!containerEl) return;
    containerEl.innerHTML = '';

    const top = entries.slice(0, limit);
    if (!top.length) {
      containerEl.innerHTML = '<p class="lb-empty">No scores yet. Be the first wizard! 🧙</p>';
      return;
    }

    top.forEach((entry, i) => {
      const row = document.createElement('div');
      row.className = 'lb-row';

      const rankCls = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
      const medal   = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

      const avatarHTML = entry.avatarDataUrl
        ? `<img class="lb-avatar" src="${entry.avatarDataUrl}" alt="${entry.nickname}" />`
        : `<div class="lb-avatar-placeholder">🧙</div>`;

      const diffColor = { easy: '#34d399', medium: '#60a5fa', hard: '#f97316', expert: '#f87171' }[entry.difficulty] || '#a78bfa';

      row.innerHTML = `
        <span class="lb-rank ${rankCls}">${medal}</span>
        ${avatarHTML}
        <span class="lb-name">${escHtml(entry.nickname)} <span style="color:${diffColor};font-size:0.6rem">${(entry.difficulty||'').toUpperCase()}</span></span>
        <span class="lb-score">${entry.score.toLocaleString()}</span>
      `;
      containerEl.appendChild(row);
    });
  }

  function escHtml(str) {
    return String(str).replace(/[&<>"']/g, m =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]);
  }

  return { load, add, getBestScore, getGlobalBest, getPosition, renderRows };
})();
