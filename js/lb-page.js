/**
 * lb-page.js — Leaderboard page controller
 */

document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  renderPage();

  document.getElementById('lb-clear-btn').addEventListener('click', () => {
    if (confirm('Clear all scores? This cannot be undone.')) {
      localStorage.removeItem('magic_tetris_lb');
      renderPage();
    }
  });
});

function renderPage() {
  const entries = Leaderboard.load();

  // Stats bar
  document.getElementById('stat-total').textContent       = entries.length;
  document.getElementById('stat-best').textContent        = entries.length ? entries[0].score.toLocaleString() : '—';
  document.getElementById('stat-lines').textContent       = entries.length ? Math.max(...entries.map(e => e.lines)) : '—';
  document.getElementById('stat-top-player').textContent  = entries.length ? entries[0].nickname : '—';

  // Podium
  renderPodium(entries.slice(0, 3));

  // Table
  renderTable(entries);
}

function renderPodium(top) {
  const container = document.getElementById('lb-podium');
  container.innerHTML = '';

  if (!top.length) return;

  const orders = [1, 2, 3];
  const medals = ['🥇', '🥈', '🥉'];

  orders.forEach(rank => {
    const entry = top[rank - 1];
    if (!entry) return;

    const slot = document.createElement('div');
    slot.className = `podium-slot rank-${rank}`;

    const avatarHTML = entry.avatarDataUrl
      ? `<img class="podium-avatar" src="${entry.avatarDataUrl}" alt="${esc(entry.nickname)}" />`
      : `<div class="podium-avatar-ph">🧙</div>`;

    slot.innerHTML = `
      <div class="podium-avatar-wrap">${avatarHTML}</div>
      <span class="podium-medal">${medals[rank - 1]}</span>
      <span class="podium-nick">${esc(entry.nickname)}</span>
      <span class="podium-score">${entry.score.toLocaleString()}</span>
      <div class="podium-platform"></div>
    `;
    container.appendChild(slot);
  });
}

function renderTable(entries) {
  const tbody = document.getElementById('lb-table-body');
  const empty = document.getElementById('lb-empty');
  tbody.innerHTML = '';

  if (!entries.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const rankClass = i => i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
  const medals    = ['🥇', '🥈', '🥉'];

  entries.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (i < 3) tr.classList.add('highlight-row');

    const avatarHTML = entry.avatarDataUrl
      ? `<img class="td-avatar" src="${entry.avatarDataUrl}" alt="" />`
      : `<div class="td-avatar-ph">🧙</div>`;

    const rankIcon = i < 3 ? medals[i] : `#${i + 1}`;
    const date     = entry.date ? new Date(entry.date).toLocaleDateString() : '—';

    tr.innerHTML = `
      <td><span class="td-rank ${rankClass(i)}">${rankIcon}</span></td>
      <td>
        <div class="td-player">
          ${avatarHTML}
          <span class="td-name">${esc(entry.nickname)}</span>
        </div>
      </td>
      <td class="td-score">${entry.score.toLocaleString()}</td>
      <td>${entry.lines}</td>
      <td>${entry.level}</td>
      <td class="td-rank-label">${entry.rank || '—'}</td>
      <td class="td-date">${date}</td>
    `;
    tbody.appendChild(tr);
  });
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, m =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]);
}

function initParticles() {
  const container = document.getElementById('particles-container');
  if (!container) return;
  const colors = ['#8b5cf6','#ffd700','#00f5ff','#ff49db'];
  for (let i = 0; i < 30; i++) {
    const p     = document.createElement('div');
    p.className = 'particle';
    const size  = Math.random() * 3 + 1;
    const color = colors[Math.floor(Math.random() * colors.length)];
    p.style.cssText = `width:${size}px;height:${size}px;background:${color};left:${Math.random()*100}%;animation-duration:${8+Math.random()*10}s;animation-delay:${Math.random()*-15}s;box-shadow:0 0 ${size*2}px ${color};`;
    container.appendChild(p);
  }
}
