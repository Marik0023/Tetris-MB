/**
 * ui.js — Magic Tetris UI Controller
 */

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Particles
// ─────────────────────────────────────────────────────────────────────────────
function initParticles() {
  const container = $('particles-container');
  if (!container) return;
  const colors = ['#8b5cf6','#ffd700','#00f5ff','#ff49db','#39ff14','#ff8c00'];
  const count  = window.innerWidth < 600 ? 20 : 45;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const sz = Math.random() * 3.5 + 1;
    const cl = colors[Math.floor(Math.random() * colors.length)];
    p.style.cssText = `width:${sz}px;height:${sz}px;background:${cl};left:${Math.random()*100}%;`
      + `animation-duration:${8+Math.random()*12}s;animation-delay:${Math.random()*-15}s;`
      + `box-shadow:0 0 ${sz*2}px ${cl};`;
    container.appendChild(p);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup Screen
// ─────────────────────────────────────────────────────────────────────────────
function initSetupScreen() {
  const uploadArea  = $('avatar-upload-area');
  const avatarInput = $('avatar-input');
  const preview     = $('avatar-preview');
  const placeholder = $('avatar-placeholder');

  uploadArea.addEventListener('click',    () => avatarInput.click());
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = 'var(--gold)'; });
  uploadArea.addEventListener('dragleave',  () => { uploadArea.style.borderColor = ''; });
  uploadArea.addEventListener('drop', e => {
    e.preventDefault(); uploadArea.style.borderColor = '';
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
    $('nickname-input').style.borderColor = '#f87171';
    $('nickname-input').style.animation   = 'shake 0.35s ease';
    setTimeout(() => { $('nickname-input').style.borderColor = ''; $('nickname-input').style.animation = ''; }, 1500);
    return;
  }
  State.nickname  = nick;
  State.bestScore = Leaderboard.getBestScore(nick);
  showScreen('game-screen');
  _initGame();
}

// ─────────────────────────────────────────────────────────────────────────────
// Game
// ─────────────────────────────────────────────────────────────────────────────
function _initGame(resume = false) {
  // Player info
  const avatarEl = $('player-avatar-mini');
  if (State.avatarUrl) { avatarEl.src = State.avatarUrl; avatarEl.style.display = 'block'; }
  else                 { avatarEl.style.display = 'none'; }
  $('player-nick-mini').textContent = State.nickname;

  // Canvas size
  const canvas = $('game-canvas');
  if (window.innerWidth < 700) {
    const cw = Math.min(window.innerWidth - 40, 260);
    canvas.width = cw; canvas.height = cw * 2;
  } else {
    canvas.width = 300; canvas.height = 600;
  }

  // Reset UI
  _updateStats({ score: 0, lines: 0, level: 1 });
  $('best-display').textContent = State.bestScore.toLocaleString();
  $('pause-overlay').classList.add('hidden');

  // Destroy previous game
  if (State.game) State.game.stop();

  State.game = new TetrisGame(canvas, {
    onScoreUpdate: stats  => { _updateStats(stats); State.game._saveState(); },
    onGameOver:    stats  => _onGameOver(stats),
    onLineClear:   (n, p) => _onLineClear(n, p),
    onSpeedChange: (tier, pct) => _updateSpeedBar(tier, pct),
    onNextChange:  type   => State.game.drawMini($('next-canvas'), type),
    onHoldChange:  type   => State.game.drawMini($('hold-canvas'), type || null),
  });

  if (resume && State.game.restoreFromStorage()) {
    // Restored — show paused state
    _updateStats(State.game.stats());
    State.game.drawMini($('next-canvas'), State.game.next);
    State.game.drawMini($('hold-canvas'), State.game.holdType || null);
    State.game._draw();
    _updateSpeedBar(State.game.speedTier, State.game.speedPct);
    State.game.isRunning = true;
    State.game.togglePause(); // start running from restored state
    $('pause-overlay').classList.add('hidden');
  } else {
    State.game.drawMini($('next-canvas'), State.game.next);
    State.game.drawMini($('hold-canvas'), null);
    _updateSpeedBar(TetrisGame.SPEED_TIERS[0], 0);
    State.game.start();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats + Speed
// ─────────────────────────────────────────────────────────────────────────────
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
  }
}

function _updateSpeedBar(tier, pct) {
  const fill = $('speed-bar-fill');
  const lbl  = $('speed-label-text');
  if (fill) {
    fill.style.width      = `${Math.max(4, pct)}%`;
    fill.style.background = `linear-gradient(90deg,#7c3aed,${tier.color})`;
    fill.style.boxShadow  = `0 0 10px ${tier.color}`;
  }
  if (lbl) {
    lbl.textContent = tier.label;
    lbl.style.color  = tier.color;
    lbl.style.animation = 'none';
    void lbl.offsetWidth;
    lbl.style.animation = 'speed-pop 0.5s ease-out';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Line clear effects
// ─────────────────────────────────────────────────────────────────────────────
function _onLineClear(count, pts) {
  const flash = $('line-flash');
  if (flash) { flash.classList.remove('hidden'); setTimeout(() => flash.classList.add('hidden'), 350); }

  const labels = ['', 'SINGLE!', 'DOUBLE!', 'TRIPLE!', '✨ TETRIS!'];
  const popup  = $('score-popup');
  if (popup) {
    popup.textContent = `${labels[count] || ''} +${pts}`;
    popup.classList.remove('hidden');
    popup.style.animation = 'none';
    void popup.offsetWidth;
    popup.style.animation = '';
    setTimeout(() => popup.classList.add('hidden'), 1100);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Game Over
// ─────────────────────────────────────────────────────────────────────────────
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

  setTimeout(() => {
    showScreen('gameover-screen');
    _drawScoreCard(entry, position);
  }, 400);
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard  — uses DAS from TetrisGame
// ─────────────────────────────────────────────────────────────────────────────
function initKeyboard() {
  const held = new Set();

  document.addEventListener('keydown', e => {
    if (!$('game-screen').classList.contains('active')) return;
    const g = State.game;
    if (!g || !g.isRunning) return;
    if (held.has(e.code)) return;  // prevent OS key-repeat
    held.add(e.code);

    switch (e.code) {
      case 'ArrowLeft':  e.preventDefault(); g.startDAS('left');  break;
      case 'ArrowRight': e.preventDefault(); g.startDAS('right'); break;
      case 'ArrowDown':  e.preventDefault(); g.startDAS('down');  break;
      case 'ArrowUp':    e.preventDefault(); g.rotate();          break;
      case 'KeyZ':       e.preventDefault(); g.rotate(-1);        break;  // CCW
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
        if (confirm('Restart? Current progress will be lost.')) { g.restart(); _initGame(); }
        break;
      }
    }
  });

  document.addEventListener('keyup', e => {
    held.delete(e.code);
    const g = State.game;
    if (!g) return;
    switch (e.code) {
      case 'ArrowLeft':  g.stopDAS('left');  break;
      case 'ArrowRight': g.stopDAS('right'); break;
      case 'ArrowDown':  g.stopDAS('down');  break;
    }
  });

  // Stop DAS if window loses focus
  window.addEventListener('blur', () => {
    held.clear();
    State.game?._clearDAS();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile touch controls
// ─────────────────────────────────────────────────────────────────────────────
function initTouchControls() {
  const canvas = $('game-canvas');
  let tx = 0, ty = 0, tt = 0;

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    tx = e.touches[0].clientX;
    ty = e.touches[0].clientY;
    tt = Date.now();
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
      if (Math.abs(dx) > 30) dx > 0 ? g.moveRight() : g.moveLeft();
    } else {
      if (Math.abs(dy) > 30) dy > 0 ? g.softDrop() : g.hardDrop();
    }
  }, { passive: false });

  function _hold(btn, fn) {
    let iv = null;
    const start = () => { fn(); iv = setInterval(fn, 80); };
    const stop  = () => clearInterval(iv);
    btn.addEventListener('touchstart', e => { e.preventDefault(); start(); });
    btn.addEventListener('touchend',   e => { e.preventDefault(); stop(); });
    btn.addEventListener('mousedown',  start);
    btn.addEventListener('mouseup',    stop);
    btn.addEventListener('mouseleave', stop);
  }
  function _once(btn, fn) {
    btn.addEventListener('touchstart', e => { e.preventDefault(); fn(); });
    btn.addEventListener('click', fn);
  }

  if ($('ctrl-left'))   _hold($('ctrl-left'),   () => State.game?.moveLeft());
  if ($('ctrl-right'))  _hold($('ctrl-right'),  () => State.game?.moveRight());
  if ($('ctrl-down'))   _hold($('ctrl-down'),   () => State.game?.softDrop());
  if ($('ctrl-rotate')) _once($('ctrl-rotate'), () => State.game?.rotate());
  if ($('ctrl-hard'))   _once($('ctrl-hard'),   () => State.game?.hardDrop());
  if ($('ctrl-hold'))   _once($('ctrl-hold'),   () => State.game?.hold());
  if ($('ctrl-pause'))  _once($('ctrl-pause'),  () => {
    const p = State.game?.togglePause();
    $('pause-overlay').classList.toggle('hidden', !p);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Game screen buttons
// ─────────────────────────────────────────────────────────────────────────────
function initGameScreenButtons() {
  $('btn-resume')?.addEventListener('click', () => {
    const p = State.game?.togglePause();
    $('pause-overlay').classList.toggle('hidden', !p);
  });

  $('btn-pause-restart')?.addEventListener('click', () => {
    State.game?.stop();
    _initGame();
  });

  $('btn-restart')?.addEventListener('click', () => {
    if (confirm('Restart? Current progress will be lost.')) {
      State.game?.stop();
      _initGame();
    }
  });

  $('btn-quit')?.addEventListener('click', () => {
    if (confirm('Quit current game?')) {
      State.game?.stop();
      State.game?.clearStorage();
      showScreen('setup-screen');
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Game over screen buttons
// ─────────────────────────────────────────────────────────────────────────────
function initGameoverScreen() {
  $('btn-download')?.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `magic-tetris-${State.nickname}-${Date.now()}.png`;
    link.href     = $('score-card-canvas').toDataURL('image/png');
    link.click();
  });

  $('btn-again')?.addEventListener('click', () => {
    showScreen('game-screen');
    _initGame();
  });

  $('btn-menu')?.addEventListener('click', () => {
    State.game?.stop();
    showScreen('setup-screen');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Score Card (canvas)
// ─────────────────────────────────────────────────────────────────────────────
function _drawScoreCard(entry, position) {
  const canvas = $('score-card-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // BG gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0e0a1f'); bg.addColorStop(.5, '#120d28'); bg.addColorStop(1, '#0a0618');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Stars
  for (let i = 0; i < 80; i++) {
    const sx = ((entry.score * (i+7) * 13) % W + W) % W;
    const sy = ((entry.score * (i+3) * 17) % H + H) % H;
    ctx.beginPath(); ctx.arc(sx, sy, Math.random()*1.4+0.3, 0, Math.PI*2);
    ctx.globalAlpha = 0.3+Math.random()*0.5; ctx.fillStyle = '#fff'; ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Glow border
  ctx.save();
  ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 3;
  ctx.shadowBlur = 20; ctx.shadowColor = '#8b5cf6';
  _roundRect(ctx, 8, 8, W-16, H-16, 16); ctx.stroke();
  ctx.restore();

  // Title
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px Fredoka One, cursive';
  ctx.fillStyle = '#ffd700'; ctx.shadowBlur = 15; ctx.shadowColor = '#ffd700';
  ctx.fillText('✨ MAGIC TETRIS', W/2, 50); ctx.shadowBlur = 0;
  ctx.font = '12px Exo 2, sans-serif'; ctx.fillStyle = 'rgba(200,180,255,0.6)';
  ctx.fillText('Score Card', W/2, 68);
  ctx.strokeStyle = 'rgba(139,92,246,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(30,78); ctx.lineTo(W-30,78); ctx.stroke();

  // Avatar ring
  const aSize = 88, aY = 95;
  ctx.save();
  ctx.beginPath(); ctx.arc(W/2, aY+aSize/2, aSize/2+4, 0, Math.PI*2);
  ctx.fillStyle = '#8b5cf6'; ctx.shadowBlur = 20; ctx.shadowColor = '#8b5cf6'; ctx.fill(); ctx.restore();

  // Clip avatar
  ctx.save();
  ctx.beginPath(); ctx.arc(W/2, aY+aSize/2, aSize/2, 0, Math.PI*2); ctx.clip();
  if (entry.avatarDataUrl) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, W/2-aSize/2, aY, aSize, aSize);
      ctx.restore();
      _scoreCardBody(ctx, entry, position, W, H, aY, aSize);
    };
    img.onerror = () => { ctx.restore(); _emojiAvatar(ctx, W, aY, aSize); _scoreCardBody(ctx, entry, position, W, H, aY, aSize); };
    img.src = entry.avatarDataUrl;
  } else {
    ctx.restore(); _emojiAvatar(ctx, W, aY, aSize); _scoreCardBody(ctx, entry, position, W, H, aY, aSize);
  }
}

function _emojiAvatar(ctx, W, aY, aSize) {
  ctx.fillStyle = '#1e1040'; ctx.fillRect(W/2-aSize/2, aY, aSize, aSize);
  ctx.font = `${aSize*0.58}px serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.fillText('🧙', W/2, aY+aSize*0.74);
}

function _scoreCardBody(ctx, entry, position, W, H, aY, aSize) {
  const cy = aY + aSize + 18;
  ctx.textAlign = 'center';
  ctx.font = 'bold 21px Fredoka One, cursive'; ctx.fillStyle = '#e8e0ff'; ctx.shadowBlur = 0;
  ctx.fillText(entry.nickname, W/2, cy+2);

  const rank = [...TetrisGame.RANK_TIERS].reverse().find(r => entry.score >= r.min) || TetrisGame.RANK_TIERS[0];
  ctx.font = 'bold 14px Exo 2, sans-serif'; ctx.fillStyle = rank.color;
  ctx.shadowBlur = 8; ctx.shadowColor = rank.color; ctx.fillText(rank.label, W/2, cy+20); ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(139,92,246,0.28)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(30, cy+32); ctx.lineTo(W-30, cy+32); ctx.stroke();

  const stats = [
    { label:'SCORE',  val: entry.score.toLocaleString(), color:'#ffd700' },
    { label:'LINES',  val: entry.lines,                  color:'#00f5ff' },
    { label:'LEVEL',  val: entry.level,                  color:'#bf5fff' },
    { label:'RANK #', val: `#${position}`,               color:'#ff8c00' },
  ];
  const gY = cy+44, cW = (W-36)/2, cH = 56;
  stats.forEach((s, i) => {
    const col = i%2, row = Math.floor(i/2);
    const gx = 18 + col*cW, gy = gY + row*(cH+8);
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; _roundRect(ctx, gx, gy, cW-6, cH, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(139,92,246,0.22)'; ctx.lineWidth=1; _roundRect(ctx, gx, gy, cW-6, cH, 10); ctx.stroke();
    const cx2 = gx+(cW-6)/2;
    ctx.font = 'bold 21px Fredoka One, cursive'; ctx.fillStyle = s.color;
    ctx.shadowBlur = 10; ctx.shadowColor = s.color; ctx.fillText(s.val, cx2, gy+34); ctx.shadowBlur=0;
    ctx.font = '10px Exo 2, sans-serif'; ctx.fillStyle='rgba(200,180,255,0.55)'; ctx.fillText(s.label, cx2, gy+49);
  });

  const fy = gY + 2*(cH+8) + 12;
  ctx.font = '11px Exo 2, sans-serif'; ctx.fillStyle = 'rgba(160,140,200,0.45)';
  ctx.fillText(`magic-tetris • ${new Date().toLocaleDateString()}`, W/2, fy+14);
  const bc = ['#00f5ff','#ffd700','#bf5fff','#39ff14','#ff073a','#4169ff','#ff8c00'];
  const bsz = 11;
  bc.forEach((c,b) => {
    ctx.fillStyle=c; ctx.shadowBlur=7; ctx.shadowColor=c;
    ctx.fillRect(18+b*(bsz+4), fy-2, bsz, bsz);
  });
  ctx.shadowBlur=0;
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r); ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h); ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r); ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y); ctx.closePath();
}

// ─────────────────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initSetupScreen();
  initKeyboard();
  initTouchControls();
  initGameScreenButtons();
  initGameoverScreen();
});
