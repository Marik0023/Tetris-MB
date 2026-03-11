document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  renderPage();
  document.getElementById('lb-clear-btn').addEventListener('click', () => {
    if (confirm('Clear all scores?')) { localStorage.removeItem('magic_tetris_lb'); renderPage(); }
  });
});

function renderPage() {
  const entries = Leaderboard.load();
  document.getElementById('stat-total').textContent      = entries.length;
  document.getElementById('stat-best').textContent       = entries.length ? entries[0].score.toLocaleString() : '—';
  document.getElementById('stat-lines').textContent      = entries.length ? Math.max(...entries.map(e => e.lines)) : '—';
  document.getElementById('stat-top-player').textContent = entries.length ? entries[0].nickname : '—';
  renderPodium(entries.slice(0, 3));
  renderTable(entries);
}

function renderPodium(top) {
  const c = document.getElementById('lb-podium');
  c.innerHTML = '';
  if (!top.length) return;
  const medals = ['🥇','🥈','🥉'];
  [1,2,3].forEach(rank => {
    const e = top[rank-1];
    if (!e) return;
    const slot = document.createElement('div');
    slot.className = `podium-slot rank-${rank}`;
    const av = e.avatarDataUrl
      ? `<img class="podium-avatar" src="${e.avatarDataUrl}" alt="" />`
      : `<div class="podium-avatar-ph">🧙</div>`;
    slot.innerHTML = `${av}<span class="podium-medal">${medals[rank-1]}</span><span class="podium-nick">${Leaderboard.escHtml(e.nickname)}</span><span class="podium-score">${e.score.toLocaleString()}</span><div class="podium-platform"></div>`;
    c.appendChild(slot);
  });
}

function renderTable(entries) {
  const tbody = document.getElementById('lb-table-body');
  const empty = document.getElementById('lb-empty');
  tbody.innerHTML = '';
  if (!entries.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  const rc = i => i===0?'r1':i===1?'r2':i===2?'r3':'';
  const medals = ['🥇','🥈','🥉'];
  entries.forEach((e, i) => {
    const tr = document.createElement('tr');
    if (i < 3) tr.classList.add('highlight-row');
    const av = e.avatarDataUrl ? `<img class="td-avatar" src="${e.avatarDataUrl}" alt="" />` : `<div class="td-avatar-ph">🧙</div>`;
    const ri = i < 3 ? medals[i] : `#${i+1}`;
    const dt = e.date ? new Date(e.date).toLocaleDateString() : '—';
    tr.innerHTML = `<td><span class="td-rank ${rc(i)}">${ri}</span></td><td><div class="td-player">${av}<span class="td-name">${Leaderboard.escHtml(e.nickname)}</span></div></td><td class="td-score">${e.score.toLocaleString()}</td><td>${e.lines}</td><td>${e.level}</td><td class="td-rank-label">${e.rank||'—'}</td><td class="td-date">${dt}</td>`;
    tbody.appendChild(tr);
  });
}

function initParticles() {
  const c = document.getElementById('particles-container');
  if (!c) return;
  const colors = ['#8b5cf6','#ffd700','#00f5ff','#ff49db'];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const sz = Math.random()*3+1, cl = colors[i%colors.length];
    p.style.cssText = `width:${sz}px;height:${sz}px;background:${cl};left:${Math.random()*100}%;animation-duration:${8+Math.random()*10}s;animation-delay:${Math.random()*-15}s;box-shadow:0 0 ${sz*2}px ${cl};`;
    c.appendChild(p);
  }
}
