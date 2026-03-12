/**
 * leaderboard.js — shared leaderboard storage
 */
const Leaderboard = (() => {
  const KEY = 'magic_tetris_lb';
  const LEGACY_KEY = 'mt2_lb';
  const MAX = 50;

  function normalizeEntry(entry = {}) {
    const nickname = entry.nickname || entry.name || 'Unknown';
    const avatarDataUrl = entry.avatarDataUrl || entry.avatar || '';
    return {
      nickname,
      name: nickname,
      avatarDataUrl,
      avatar: avatarDataUrl,
      score: Number(entry.score || 0),
      lines: Number(entry.lines || 0),
      level: Number(entry.level || 1),
      rank: entry.rank || 'Wizard',
      date: Number(entry.date || Date.now()),
    };
  }

  function save(entries) {
    const clean = entries.map(normalizeEntry).sort((a,b) => b.score - a.score).slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(clean));
    localStorage.setItem(LEGACY_KEY, JSON.stringify(clean));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || '[]';
      const parsed = JSON.parse(raw) || [];
      const clean = parsed.map(normalizeEntry).sort((a,b) => b.score - a.score).slice(0, MAX);
      if (JSON.stringify(clean) !== JSON.stringify(parsed)) save(clean);
      return clean;
    } catch {
      return [];
    }
  }

  function add(entry) {
    const next = normalizeEntry({ ...entry, date: Date.now() });
    const entries = load();
    const idx = entries.findIndex(e => e.nickname === next.nickname);
    if (idx >= 0) {
      if (next.score >= entries[idx].score) entries[idx] = next;
    } else {
      entries.push(next);
    }
    save(entries);
    return load();
  }

  function getBestScore(nickname) {
    const e = load().find(e => e.nickname === nickname || e.name === nickname);
    return e ? e.score : 0;
  }

  function getPosition(score) {
    return load().filter(e => e.score > score).length + 1;
  }

  function clear() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
  }

  return { load, save, add, getBestScore, getPosition, clear, escHtml, KEY, LEGACY_KEY };
})();
