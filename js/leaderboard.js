/**
 * leaderboard.js — stores only BEST score per nickname
 */
const Leaderboard = (() => {
  const KEY = 'magic_tetris_lb';
  const MAX = 10;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function save(e) { localStorage.setItem(KEY, JSON.stringify(e)); }

  function add(entry) {
    const entries = load();
    const idx = entries.findIndex(e => e.nickname === entry.nickname);
    const newEntry = { ...entry, date: Date.now() };
    if (idx >= 0) {
      if (entry.score > entries[idx].score) entries[idx] = newEntry;
    } else {
      entries.push(newEntry);
    }
    entries.sort((a, b) => b.score - a.score);
    const trimmed = entries.slice(0, MAX);
    save(trimmed);
    return trimmed;
  }

  function getBestScore(nickname) {
    const e = load().find(e => e.nickname === nickname);
    return e ? e.score : 0;
  }

  function getPosition(score) {
    return load().filter(e => e.score > score).length + 1;
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
  }

  return { load, add, getBestScore, getPosition, escHtml };
})();
