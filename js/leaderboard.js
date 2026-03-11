/**
 * leaderboard.js — Local leaderboard / persistence
 * Stores only the BEST score per nickname
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
    const entries = load();
    const idx = entries.findIndex(e => e.nickname === entry.nickname);
    const newEntry = { ...entry, date: Date.now() };

    if (idx >= 0) {
      // Only update if new score is better
      if (entry.score > entries[idx].score) {
        entries[idx] = newEntry;
      }
    } else {
      entries.push(newEntry);
    }

    entries.sort((a, b) => b.score - a.score);
    const trimmed = entries.slice(0, MAX);
    save(trimmed);
    return trimmed;
  }

  function getBestScore(nickname) {
    const entries = load();
    const mine = entries.find(e => e.nickname === nickname);
    return mine ? mine.score : 0;
  }

  function getGlobalBest() {
    const entries = load();
    return entries.length ? entries[0].score : 0;
  }

  function getPosition(score) {
    const entries = load();
    return entries.filter(e => e.score > score).length + 1;
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
        ? `<img class="lb-avatar" src="${entry.avatarDataUrl}" alt="${escHtml(entry.nickname)}" />`
        : `<div class="lb-avatar-placeholder">🧙</div>`;
      row.innerHTML = `
        <span class="lb-rank ${rankCls}">${medal}</span>
        ${avatarHTML}
        <span class="lb-name">${escHtml(entry.nickname)}</span>
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
