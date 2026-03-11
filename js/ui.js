/**
 * ui.js — Magic Tetris UI  (v2, for new engine)
 */

const State = {
  nickname:  '',
  avatarUrl: '',
  bestScore: 0,
  game:      null,
};

const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ─── Particles ────────────────────────────────────────────────────────────────
function initParticles() {
  const el = $('particles-container');
  if (!el) return;
  const colors = ['#8b5cf6','#ffd700','#00f5ff','#ff49db','#39ff14','#ff8c00','#4169ff'];
  const count  = window.innerWidth < 600 ? 18 : 40;
  for (let i = 0; i < count; i++) {
    const p  = document.createElement('div');
    p.className = 'particle';
    const sz = Math.random() * 3 + 1;
    const cl = colors[i % colors.length];
    p.style.cssText = `width:${sz}px;height:${sz}px;background:${cl};left:${Math.random()*100}%;`
      + `animation-duration:${9+Math.random()*13}s;animation-delay:${Math.random()*-18}s;`
      + `box-shadow:0 0 ${sz*2.5}px ${cl};`;
    el.appendChild(p);
  }
}

// ─── Setup screen ─────────────────────────────────────────────────────────────
function initSetupScreen() {
  const uploadArea  = $('avatar-upload-area');
  const avatarInput = $('avatar-input');
  const preview     = $('avatar-preview');
  const placeholder = $('avatar-placeholder');

  uploadArea.addEventListener('click', () => avatarInput.click());
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
  uploadArea.addEventListener('dragleave',  () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault(); uploadArea.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) _loadAvatar(f);
  });
  avatarInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) _loadAvatar(f); });

  function _loadAvatar(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      State.avatarUrl           = ev.target.result;
      preview.src               = ev.target.result;
      preview.style.display     = 'block';
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  $('btn-start').addEventListener('click', _startGame);
  $('nickname-input').addEventListener('keydown', e => { if (e.key === 'Enter') _startGame(); });
}

function _startGame() {
  const nick = $('nickname-input').value.trim();
  if (!nick) {
    $('nickname-input').focus();
    $('nickname-input').classList.add('shake');
    setTimeout(() => $('nickname-input').classList.remove('shake'), 600);
    return;
  }
  State.nickname  = nick;
  State.bestScore = Leaderboard.getBestScore(nick);
  showScreen('game-screen');
  _initGame();
}

// ─── Init game ────────────────────────────────────────────────────────────────
function _initGame(resume = false) {
  // Player header
  const avatarEl = $('player-avatar-mini');
  if (State.avatarUrl) { avatarEl.src = State.avatarUrl; avatarEl.style.display = 'block'; }
  else avatarEl.style.display = 'none';
  $('player-nick-mini').textContent = State.nickname;

  // Canvas size
  const canvas = $('game-canvas');
  const isMobile = window.innerWidth < 700;
  const cw = isMobile ? Math.min(window.innerWidth - 36, 260) : 300;
  canvas.width  = cw;
  canvas.height = cw * 2;

  // Reset UI
  _updateStats({ score: 0, lines: 0, level: 1 });
  $('best-display').textContent = State.bestScore.toLocaleString();
  $('pause-overlay').classList.add('hidden');

  // Destroy previous instance
  if (State.game) State.game.stop();

  State.game = new TetrisGame(canvas, {
    onScoreUpdate: stats      => _updateStats(stats),
    onGameOver:    stats      => _onGameOver(stats),
    onLineClear:   (n, pts)   => _onLineClear(n, pts),
    onSpeedChange: (tier, pct)=> _updateSpeedBar(tier, pct),
    onNextChange:  type       => State.game.drawMini($('next-canvas'), type),
    onHoldChange:  type       => State.game.drawMini($('hold-canvas'), type || null),
    onLockFlash:   ()         => _triggerLockFlash(),
  });

  if (resume && State.game.restoreFromStorage()) {
    _updateStats(State.game.stats());
    State.game.drawMini($('next-canvas'), State.game.nextType);
    State.game.drawMini($('hold-canvas'), State.game.holdType || null);
    _updateSpeedBar(State.game.speedTier, State.game.speedPct);
    State.game._draw();
    // Start paused — user hits Resume
    $('pause-overlay').classList.remove('hidden');
  } else {
    State.game.drawMini($('next-canvas'), State.game.nextType);
    State.game.drawMini($('hold-canvas'), null);
    _updateSpeedBar(TetrisGame.SPEED_TIERS[0], 0);
    State.game.start();
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function _updateStats({ score, lines, level }) {
  $('score-display').textContent = score.toLocaleString();
  $('lines-display').textContent = lines;
  $('level-display').textContent = level;

  if (score > State.bestScore) {
    State.bestScore = score;
    const el = $('best-display');
    el.textContent = score.toLocaleString();
    el.classList.remove('new-record');
    void el.offsetWidth;
    el.classList.add('new-record');
  }

  if (State.game) {
    const rank = State.game.rank;
    $('rank-display').textContent = rank.label;
    $('rank-display').style.color  = rank.color;
    $('rank-display').style.textShadow = `0 0 8px ${rank.color}`;
  }
}

function _updateSpeedBar(tier, pct) {
  const fill = $('speed-bar-fill');
  const lbl  = $('speed-label-text');
  if (fill) {
    fill.style.width      = `${Math.max(3, pct)}%`;
    fill.style.background = `linear-gradient(90deg,#7c3aed,${tier.color})`;
    fill.style.boxShadow  = `0 0 10px ${tier.color}`;
  }
  if (lbl) {
    lbl.textContent  = tier.label;
    lbl.style.color  = tier.color;
    lbl.style.animation = 'none';
    void lbl.offsetWidth;
    lbl.style.animation = 'speed-pop 0.5s ease-out';
  }
}

// ─── Line clear effects ───────────────────────────────────────────────────────
function _onLineClear(count, pts) {
  const flash = $('line-flash');
  if (flash) { flash.classList.remove('hidden'); setTimeout(() => flash.classList.add('hidden'), 380); }

  const labels = { 1: 'SINGLE', 2: 'DOUBLE!', 3: 'TRIPLE!!', 4: '✨ TETRIS!!!' };
  const popup  = $('score-popup');
  if (popup) {
    popup.textContent  = `${labels[count] || ''} +${pts.toLocaleString()}`;
    popup.classList.remove('hidden', 'anim');
    void popup.offsetWidth;
    popup.classList.add('anim');
    setTimeout(() => popup.classList.add('hidden'), 1200);
  }
}

function _triggerLockFlash() {
  const board = $('board-glow-border');
  if (!board) return;
  board.classList.remove('lock-flash');
  void board.offsetWidth;
  board.classList.add('lock-flash');
  setTimeout(() => board.classList.remove('lock-flash'), 120);
}

// ─── Game over ────────────────────────────────────────────────────────────────
function _onGameOver(stats) {
  const rank  = State.game?.rank || TetrisGame.RANK_TIERS[0];
  const entry = {
    nickname:      State.nickname,
    avatarDataUrl: State.avatarUrl || '',
    score:         stats.score,
    lines:         stats.lines,
    level:         stats.level,
    rank:          rank.label,
  };
  Leaderboard.add(entry);
  const position = Leaderboard.getPosition(stats.score);
  setTimeout(() => { showScreen('gameover-screen'); _drawScoreCard(entry, position); }, 450);
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────
function initKeyboard() {
  const held = new Set();

  document.addEventListener('keydown', e => {
    if (!$('game-screen').classList.contains('active')) return;
    const g = State.game;
    if (!g || !g.isRunning) return;
    if (held.has(e.code)) return;
    held.add(e.code);

    switch (e.code) {
      case 'ArrowLeft':  e.preventDefault(); g.startDAS('left');  break;
      case 'ArrowRight': e.preventDefault(); g.startDAS('right'); break;
      case 'ArrowDown':  e.preventDefault(); g.startDAS('down');  break;
      case 'ArrowUp':    e.preventDefault(); g.rotate();          break;
      case 'KeyZ':       e.preventDefault(); g.rotate();          break;
      case 'Space':      e.preventDefault(); g.hardDrop();        break;
      case 'KeyC': case 'ShiftLeft': case 'ShiftRight':
        e.preventDefault(); g.hold(); break;
      case 'KeyP': case 'Escape': {
        const paused = g.togglePause();
        $('pause-overlay').classList.toggle('hidden', !paused);
        break;
      }
      case 'KeyR': {
        e.preventDefault();
        if (confirm('Restart?')) { g.stop(); _initGame(); }
        break;
      }
    }
  });

  document.addEventListener('keyup', e => {
    held.delete(e.code);
    const g = State.game;
    if (!g) return;
    if (e.code === 'ArrowLeft')  g.stopDAS('left');
    if (e.code === 'ArrowRight') g.stopDAS('right');
    if (e.code === 'ArrowDown')  g.stopDAS('down');
  });

  window.addEventListener('blur', () => {
    held.clear();
    State.game?._clearDAS();
  });
}

// ─── Touch/mobile ─────────────────────────────────────────────────────────────
function initTouchControls() {
  const canvas = $('game-canvas');
  let tx = 0, ty = 0, tt = 0;

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    tx = e.touches[0].clientX; ty = e.touches[0].clientY; tt = Date.now();
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const g = State.game;
    if (!g || !g.isRunning || g.isPaused) return;
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    const dt = Date.now() - tt;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 200) { g.rotate(); return; }
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 28) dx > 0 ? g.moveRight() : g.moveLeft();
    } else {
      if (Math.abs(dy) > 28) dy > 0 ? g.softDrop()  : g.hardDrop();
    }
  }, { passive: false });

  function _repeat(btn, fn) {
    let iv = null;
    btn.addEventListener('touchstart', e => { e.preventDefault(); fn(); iv = setInterval(fn, 70); });
    btn.addEventListener('touchend',   e => { e.preventDefault(); clearInterval(iv); });
    btn.addEventListener('mousedown',  () => { fn(); iv = setInterval(fn, 70); });
    btn.addEventListener('mouseup',    () => clearInterval(iv));
    btn.addEventListener('mouseleave', () => clearInterval(iv));
  }
  function _once(btn, fn) {
    btn.addEventListener('touchstart', e => { e.preventDefault(); fn(); });
    btn.addEventListener('click', fn);
  }

  if ($('ctrl-left'))   _repeat($('ctrl-left'),   () => State.game?.moveLeft());
  if ($('ctrl-right'))  _repeat($('ctrl-right'),  () => State.game?.moveRight());
  if ($('ctrl-down'))   _repeat($('ctrl-down'),   () => State.game?.softDrop());
  if ($('ctrl-rotate')) _once($('ctrl-rotate'),   () => State.game?.rotate());
  if ($('ctrl-hard'))   _once($('ctrl-hard'),     () => State.game?.hardDrop());
  if ($('ctrl-hold'))   _once($('ctrl-hold'),     () => State.game?.hold());
  if ($('ctrl-pause'))  _once($('ctrl-pause'),    () => {
    const p = State.game?.togglePause();
    $('pause-overlay').classList.toggle('hidden', !p);
  });
}

// ─── Screen buttons ───────────────────────────────────────────────────────────
function initScreenButtons() {
  // Pause overlay
  $('btn-resume')?.addEventListener('click', () => {
    const g = State.game;
    if (!g) return;
    if (g.isPaused && !g.isRunning) {
      // Resuming from restored save
      g.resumeFromStorage();
      $('pause-overlay').classList.add('hidden');
    } else {
      const p = g.togglePause();
      $('pause-overlay').classList.toggle('hidden', !p);
    }
  });

  $('btn-pause-restart')?.addEventListener('click', () => {
    State.game?.stop(); _initGame();
  });

  // In-game buttons
  $('btn-restart')?.addEventListener('click', () => {
    if (confirm('Restart? Current progress will be lost.')) { State.game?.stop(); _initGame(); }
  });
  $('btn-quit')?.addEventListener('click', () => {
    if (confirm('Quit current game?')) {
      State.game?.stop(); State.game?.clearStorage(); showScreen('setup-screen');
    }
  });

  // Game over screen
  $('btn-download')?.addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = `magic-tetris-${State.nickname}-${Date.now()}.png`;
    a.href     = $('score-card-canvas').toDataURL('image/png');
    a.click();
  });
  $('btn-again')?.addEventListener('click', () => { showScreen('game-screen'); _initGame(); });
  $('btn-menu')?.addEventListener('click',  () => { State.game?.stop(); showScreen('setup-screen'); });
}

// ─── Score Card ───────────────────────────────────────────────────────────────
function _drawScoreCard(entry, position) {
  const canvas = $('score-card-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0e0a1f'); bg.addColorStop(.5, '#120d28'); bg.addColorStop(1, '#0a0618');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Stars
  for (let i = 0; i < 80; i++) {
    const sx = ((entry.score * (i+7) * 13) % W + W) % W;
    const sy = ((entry.score * (i+3) * 17) % H + H) % H;
    ctx.beginPath(); ctx.arc(sx, sy, Math.random()*1.3+0.3, 0, Math.PI*2);
    ctx.globalAlpha = 0.3+Math.random()*0.5; ctx.fillStyle = '#fff'; ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Border
  ctx.save(); ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 2.5;
  ctx.shadowBlur = 20; ctx.shadowColor = '#8b5cf6';
  _roundRect(ctx, 8, 8, W-16, H-16, 14); ctx.stroke(); ctx.restore();

  // Title
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px Orbitron, monospace'; ctx.fillStyle = '#ffd700';
  ctx.shadowBlur = 14; ctx.shadowColor = '#ffd700';
  ctx.fillText('✨ MAGIC TETRIS', W/2, 48); ctx.shadowBlur = 0;
  ctx.font = '11px Rajdhani, sans-serif'; ctx.fillStyle = 'rgba(200,180,255,0.55)';
  ctx.fillText('SCORE CARD', W/2, 64);
  ctx.strokeStyle = 'rgba(139,92,246,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(30,74); ctx.lineTo(W-30,74); ctx.stroke();

  // Avatar
  const aS = 80, aY = 88;
  ctx.save();
  ctx.beginPath(); ctx.arc(W/2, aY+aS/2, aS/2+4, 0, Math.PI*2);
  ctx.fillStyle = '#8b5cf6'; ctx.shadowBlur = 18; ctx.shadowColor = '#8b5cf6'; ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(W/2, aY+aS/2, aS/2, 0, Math.PI*2); ctx.clip();

  const _body = () => {
    ctx.restore();
    const cy = aY + aS + 16;
    ctx.textAlign = 'center';
    ctx.font = 'bold 19px Orbitron, monospace'; ctx.fillStyle = '#e8e0ff';
    ctx.fillText(entry.nickname, W/2, cy+2);
    const rank = [...TetrisGame.RANK_TIERS].reverse().find(r => entry.score >= r.min) || TetrisGame.RANK_TIERS[0];
    ctx.font = 'bold 12px Rajdhani'; ctx.fillStyle = rank.color;
    ctx.shadowBlur = 7; ctx.shadowColor = rank.color; ctx.fillText(rank.label, W/2, cy+18); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(139,92,246,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(28, cy+28); ctx.lineTo(W-28, cy+28); ctx.stroke();

    const stats = [
      { l:'SCORE', v: entry.score.toLocaleString(), c:'#ffd700' },
      { l:'LINES', v: entry.lines,                  c:'#00f5ff' },
      { l:'LEVEL', v: entry.level,                  c:'#bf5fff' },
      { l:'RANK',  v: `#${position}`,               c:'#ff8c00' },
    ];
    const gY = cy+38, cW = (W-32)/2, cH = 52;
    stats.forEach((s, i) => {
      const col = i%2, row = Math.floor(i/2);
      const gx = 16 + col*cW, gy = gY + row*(cH+7);
      ctx.fillStyle = 'rgba(255,255,255,0.04)'; _roundRect(ctx, gx, gy, cW-5, cH, 9); ctx.fill();
      ctx.strokeStyle = 'rgba(139,92,246,0.2)'; _roundRect(ctx, gx, gy, cW-5, cH, 9); ctx.stroke();
      const cx2 = gx+(cW-5)/2;
      ctx.font = 'bold 20px Orbitron, monospace'; ctx.fillStyle = s.c;
      ctx.shadowBlur = 9; ctx.shadowColor = s.c; ctx.fillText(s.v, cx2, gy+31); ctx.shadowBlur = 0;
      ctx.font = '9px Rajdhani'; ctx.fillStyle = 'rgba(200,180,255,0.5)'; ctx.fillText(s.l, cx2, gy+46);
    });

    const fy = gY + 2*(cH+7) + 10;
    ctx.font = '10px Rajdhani'; ctx.fillStyle = 'rgba(160,140,200,0.4)';
    ctx.fillText(`magic-tetris · ${new Date().toLocaleDateString()}`, W/2, fy+12);
  };

  if (entry.avatarDataUrl) {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, W/2-aS/2, aY, aS, aS); _body(); };
    img.onerror = () => { _emojiAvatar(ctx, W, aY, aS); _body(); };
    img.src = entry.avatarDataUrl;
  } else { _emojiAvatar(ctx, W, aY, aS); _body(); }
}

function _emojiAvatar(ctx, W, aY, aS) {
  ctx.fillStyle = '#1e1040'; ctx.fillRect(W/2-aS/2, aY, aS, aS);
  ctx.font = `${aS*0.55}px serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.fillText('🧙', W/2, aY+aS*0.72);
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initSetupScreen();
  initKeyboard();
  initTouchControls();
  initScreenButtons();
});
