/**
 * ui.js — Magic Tetris UI Controller
 * Handles: screens, setup, game integration, score card, mobile controls, particles
 */

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
const State = {
  nickname:   '',
  avatarUrl:  '',
  difficulty: 'medium',
  bestScore:  0,
  game:       null,
  lastStats:  { score: 0, lines: 0, level: 1 },
};

// ─────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ─────────────────────────────────────────────
// Particles
// ─────────────────────────────────────────────
function initParticles() {
  const container = $('particles-container');
  const colors    = ['#8b5cf6','#ffd700','#00f5ff','#ff49db','#39ff14','#ff8c00'];
  const count     = window.innerWidth < 600 ? 25 : 50;

  for (let i = 0; i < count; i++) {
    const p   = document.createElement('div');
    p.className = 'particle';
    const size  = Math.random() * 4 + 1;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left  = Math.random() * 100;
    const dur   = 8 + Math.random() * 12;
    const delay = Math.random() * -15;

    p.style.cssText = `
      width:${size}px; height:${size}px;
      background:${color};
      left:${left}%;
      animation-duration:${dur}s;
      animation-delay:${delay}s;
      box-shadow: 0 0 ${size * 2}px ${color};
    `;
    container.appendChild(p);
  }
}

// ─────────────────────────────────────────────
// Setup Screen
// ─────────────────────────────────────────────
function initSetupScreen() {
  // Difficulty buttons
  $$('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.difficulty = btn.dataset.diff;
    });
  });

  // Avatar upload
  const uploadArea  = $('avatar-upload-area');
  const avatarInput = $('avatar-input');
  const preview     = $('avatar-preview');
  const placeholder = $('avatar-placeholder');

  uploadArea.addEventListener('click', () => avatarInput.click());
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = 'var(--gold)'; });
  uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadAvatar(file);
  });

  avatarInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadAvatar(file);
  });

  function loadAvatar(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      State.avatarUrl        = ev.target.result;
      preview.src            = ev.target.result;
      preview.style.display  = 'block';
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  // Start button
  $('btn-start').addEventListener('click', startGame);

  $('nickname-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') startGame();
  });

  // Render leaderboard preview
  Leaderboard.renderRows(Leaderboard.load(), $('preview-leaderboard'), 5);
}

// ─────────────────────────────────────────────
// Game Startup
// ─────────────────────────────────────────────
function startGame() {
  const nick = $('nickname-input').value.trim();
  if (!nick) {
    $('nickname-input').focus();
    $('nickname-input').style.borderColor = '#f87171';
    setTimeout(() => { $('nickname-input').style.borderColor = ''; }, 1500);
    return;
  }

  State.nickname   = nick;
  State.bestScore  = Leaderboard.getBestScore(nick);

  showScreen('game-screen');
  initGame();
}

function initGame() {
  // Player info
  if (State.avatarUrl) {
    $('player-avatar-mini').src           = State.avatarUrl;
    $('player-avatar-mini').style.display = 'block';
  } else {
    $('player-avatar-mini').style.display = 'none';
  }
  $('player-nick-mini').textContent = State.nickname;
  $('diff-badge').textContent       = State.difficulty.toUpperCase();

  // Canvas sizing
  const canvas = $('game-canvas');
  const isMobile = window.innerWidth < 700;
  if (isMobile) {
    const cw = Math.min(window.innerWidth - 32, 260);
    canvas.width  = cw;
    canvas.height = cw * 2;
  } else {
    canvas.width  = 300;
    canvas.height = 600;
  }

  // Reset displays
  updateStatDisplays({ score: 0, lines: 0, level: 1 });
  $('best-display').textContent = State.bestScore.toLocaleString();

  // Create game
  if (State.game) State.game.stop();
  State.game = new TetrisGame(canvas, {
    difficulty:    State.difficulty,
    onScoreUpdate: onScoreUpdate,
    onGameOver:    onGameOver,
    onLineClear:   onLineClear,
  });

  // Initial draw of next/hold
  State.game.drawMini($('next-canvas'), State.game.next.type);
  State.game.drawMini($('hold-canvas'), null);

  // Patch _lock to refresh mini previews
  const origLock = State.game._lock.bind(State.game);
  State.game._lock = function() {
    origLock();
    if (State.game.isRunning) {
      State.game.drawMini($('next-canvas'), State.game.next?.type);
      State.game.drawMini($('hold-canvas'), State.game.holdPiece);
    }
  };

  const origHold = State.game.holdCurrent.bind(State.game);
  State.game.holdCurrent = function() {
    origHold();
    State.game.drawMini($('hold-canvas'), State.game.holdPiece);
    State.game.drawMini($('next-canvas'), State.game.next?.type);
  };

  $('pause-overlay').classList.add('hidden');
  State.game.start();
}

// ─────────────────────────────────────────────
// Score Updates
// ─────────────────────────────────────────────
function updateStatDisplays({ score, lines, level }) {
  State.lastStats = { score, lines, level };

  $('score-display').textContent = score.toLocaleString();
  $('lines-display').textContent = lines;
  $('level-display').textContent = level;

  // Best score
  if (score > State.bestScore) {
    State.bestScore = score;
    const bestEl = $('best-display');
    bestEl.textContent = score.toLocaleString();
    bestEl.classList.remove('new-record');
    void bestEl.offsetWidth;
    bestEl.classList.add('new-record');
  }

  // Rank
  const rank = State.game?.getRank() || TetrisGame.RANK_TIERS[0];
  $('rank-display').textContent  = rank.label;
  $('rank-display').style.color  = rank.color;
}

function onScoreUpdate(stats) {
  updateStatDisplays(stats);
}

function onLineClear(count, pts) {
  // Flash
  const flash = $('line-flash');
  flash.classList.remove('hidden');
  setTimeout(() => flash.classList.add('hidden'), 350);

  // Popup
  const labels = ['', 'SINGLE!', 'DOUBLE!', 'TRIPLE!', '✨ TETRIS!'];
  const popup = $('score-popup');
  popup.textContent = `${labels[count] || ''} +${pts}`;
  popup.classList.remove('hidden');
  popup.style.animation = 'none';
  void popup.offsetWidth;
  popup.style.animation = '';
  setTimeout(() => popup.classList.add('hidden'), 1100);

  // Refresh next piece preview
  if (State.game) State.game.drawMini($('next-canvas'), State.game.next?.type);
}

// ─────────────────────────────────────────────
// Game Over
// ─────────────────────────────────────────────
function onGameOver(stats) {
  // Save to leaderboard
  const rank = State.game?.getRank() || TetrisGame.RANK_TIERS[0];
  const entry = {
    nickname:     State.nickname,
    avatarDataUrl: State.avatarUrl || '',
    score:        stats.score,
    lines:        stats.lines,
    level:        stats.level,
    difficulty:   State.difficulty,
    rank:         rank.label,
  };
  const allEntries = Leaderboard.add(entry);
  const position   = Leaderboard.getPosition(stats.score);

  // Transition to game over screen
  setTimeout(() => {
    showScreen('gameover-screen');
    drawScoreCard(entry, position);
    Leaderboard.renderRows(allEntries, $('full-leaderboard'));
  }, 400);
}

// ─────────────────────────────────────────────
// Score Card
// ─────────────────────────────────────────────
function drawScoreCard(entry, position) {
  const canvas = $('score-card-canvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   '#0e0a1f');
  bg.addColorStop(0.5, '#120d28');
  bg.addColorStop(1,   '#0a0618');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  const seed = entry.score;
  for (let i = 0; i < 80; i++) {
    const sx = ((seed * (i + 7) * 13) % W + W) % W;
    const sy = ((seed * (i + 3) * 17) % H + H) % H;
    const sr = Math.random() * 1.5 + 0.3;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.globalAlpha = 0.3 + Math.random() * 0.5;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Glow border
  ctx.save();
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth   = 3;
  ctx.shadowBlur  = 20;
  ctx.shadowColor = '#8b5cf6';
  roundRect(ctx, 8, 8, W - 16, H - 16, 16);
  ctx.stroke();
  ctx.restore();

  // Logo / Title
  ctx.font      = 'bold 28px Fredoka One, cursive';
  ctx.fillStyle = '#ffd700';
  ctx.shadowBlur  = 15;
  ctx.shadowColor = '#ffd700';
  ctx.textAlign = 'center';
  ctx.fillText('✨ MAGIC TETRIS', W / 2, 52);
  ctx.shadowBlur = 0;

  ctx.font      = '13px Exo 2, sans-serif';
  ctx.fillStyle = 'rgba(200,180,255,0.7)';
  ctx.fillText('Score Card', W / 2, 72);

  // Divider
  ctx.strokeStyle = 'rgba(139,92,246,0.4)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(30, 82); ctx.lineTo(W - 30, 82); ctx.stroke();

  // Avatar
  const avatarSize = 90;
  const avatarX    = W / 2 - avatarSize / 2;
  const avatarY    = 100;

  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
  ctx.fillStyle = '#8b5cf6';
  ctx.shadowBlur  = 20;
  ctx.shadowColor = '#8b5cf6';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Clip avatar to circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  if (entry.avatarDataUrl) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();
      _continueCardDraw(ctx, entry, position, W, H, avatarY, avatarSize);
    };
    img.onerror = () => {
      ctx.restore();
      _drawEmojiAvatar(ctx, W, avatarY, avatarSize);
      _continueCardDraw(ctx, entry, position, W, H, avatarY, avatarSize);
    };
    img.src = entry.avatarDataUrl;
  } else {
    ctx.restore();
    _drawEmojiAvatar(ctx, W, avatarY, avatarSize);
    _continueCardDraw(ctx, entry, position, W, H, avatarY, avatarSize);
  }
}

function _drawEmojiAvatar(ctx, W, avatarY, avatarSize) {
  ctx.fillStyle = '#1e1040';
  ctx.fillRect(W/2 - avatarSize/2, avatarY, avatarSize, avatarSize);
  ctx.font      = `${avatarSize * 0.6}px serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText('🧙', W / 2, avatarY + avatarSize * 0.75);
}

function _continueCardDraw(ctx, entry, position, W, H, avatarY, avatarSize) {
  const cy = avatarY + avatarSize + 20;

  // Nickname
  ctx.textAlign   = 'center';
  ctx.font        = 'bold 22px Fredoka One, cursive';
  ctx.fillStyle   = '#e8e0ff';
  ctx.shadowBlur  = 0;
  ctx.fillText(entry.nickname, W / 2, cy + 4);

  // Rank badge
  const rank = TetrisGame.RANK_TIERS.slice().reverse().find(r => entry.score >= r.min) || TetrisGame.RANK_TIERS[0];
  ctx.font      = 'bold 15px Exo 2, sans-serif';
  ctx.fillStyle = rank.color;
  ctx.shadowBlur  = 8;
  ctx.shadowColor = rank.color;
  ctx.fillText(rank.label, W / 2, cy + 24);
  ctx.shadowBlur = 0;

  // Difficulty badge
  const diffColors = { easy:'#34d399', medium:'#60a5fa', hard:'#f97316', expert:'#f87171' };
  ctx.font      = '12px Exo 2, sans-serif';
  ctx.fillStyle = diffColors[entry.difficulty] || '#a78bfa';
  ctx.fillText(entry.difficulty.toUpperCase(), W / 2, cy + 42);

  // Divider
  ctx.strokeStyle = 'rgba(139,92,246,0.3)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(30, cy + 54); ctx.lineTo(W-30, cy + 54); ctx.stroke();

  // Stats grid
  const stats = [
    { label: 'SCORE',    value: entry.score.toLocaleString(), color: '#ffd700' },
    { label: 'LINES',    value: entry.lines,                  color: '#00f5ff' },
    { label: 'LEVEL',    value: entry.level,                  color: '#bf5fff' },
    { label: 'POSITION', value: `#${position}`,               color: '#ff8c00' },
  ];

  const gridY  = cy + 66;
  const cellW  = (W - 40) / 2;
  const cellH  = 58;

  stats.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const gx  = 20 + col * cellW;
    const gy  = gridY + row * (cellH + 8);

    // Card bg
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    roundRect(ctx, gx, gy, cellW - 8, cellH, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(139,92,246,0.25)';
    ctx.lineWidth   = 1;
    roundRect(ctx, gx, gy, cellW - 8, cellH, 10);
    ctx.stroke();

    ctx.textAlign   = 'center';
    const cx2       = gx + (cellW - 8) / 2;

    ctx.font        = 'bold 22px Fredoka One, cursive';
    ctx.fillStyle   = s.color;
    ctx.shadowBlur  = 10;
    ctx.shadowColor = s.color;
    ctx.fillText(s.value, cx2, gy + 34);
    ctx.shadowBlur = 0;

    ctx.font      = '10px Exo 2, sans-serif';
    ctx.fillStyle = 'rgba(200,180,255,0.6)';
    ctx.fillText(s.label, cx2, gy + 50);
  });

  // Footer
  const fy = gridY + 2 * (cellH + 8) + 12;
  ctx.font      = '11px Exo 2, sans-serif';
  ctx.fillStyle = 'rgba(160,140,200,0.5)';
  ctx.textAlign = 'center';
  ctx.fillText(`magic-tetris.app • ${new Date().toLocaleDateString()}`, W / 2, fy + 16);

  // Tetris blocks decoration
  const blockColors = ['#00f5ff','#ffd700','#bf5fff','#39ff14','#ff073a','#4169ff','#ff8c00'];
  const blockSize   = 12;
  for (let b = 0; b < 7; b++) {
    ctx.fillStyle   = blockColors[b];
    ctx.shadowBlur  = 8;
    ctx.shadowColor = blockColors[b];
    ctx.fillRect(20 + b * (blockSize + 4), fy, blockSize, blockSize);
  }
  ctx.shadowBlur = 0;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─────────────────────────────────────────────
// Keyboard Controls
// ─────────────────────────────────────────────
function initKeyboard() {
  let repeatTimer  = null;
  let repeatActive = false;

  const startRepeat = (fn) => {
    fn();
    repeatTimer = setTimeout(() => {
      repeatActive = true;
      repeatTimer  = setInterval(fn, 55);
    }, 180);
  };

  const stopRepeat = () => {
    clearTimeout(repeatTimer);
    clearInterval(repeatTimer);
    repeatActive = false;
  };

  document.addEventListener('keydown', e => {
    if (!$('game-screen').classList.contains('active')) return;
    const g = State.game;
    if (!g || !g.isRunning) return;

    switch (e.code) {
      case 'ArrowLeft':  e.preventDefault(); startRepeat(() => g.moveLeft());  break;
      case 'ArrowRight': e.preventDefault(); startRepeat(() => g.moveRight()); break;
      case 'ArrowDown':  e.preventDefault(); startRepeat(() => g.softDrop());  break;
      case 'ArrowUp':    e.preventDefault(); g.rotate();   break;
      case 'Space':      e.preventDefault(); g.hardDrop(); break;
      case 'KeyC':
      case 'ShiftLeft':
      case 'ShiftRight': g.holdCurrent(); break;
      case 'KeyP':
      case 'Escape':
        const paused = g.togglePause();
        $('pause-overlay').classList.toggle('hidden', !paused);
        break;
    }
  });

  document.addEventListener('keyup', e => {
    if (['ArrowLeft','ArrowRight','ArrowDown'].includes(e.code)) stopRepeat();
  });
}

// ─────────────────────────────────────────────
// Mobile Touch Controls
// ─────────────────────────────────────────────
function initTouchControls() {
  const canvas = $('game-canvas');

  let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
  const SWIPE_THRESHOLD = 35;
  const TAP_THRESHOLD   = 200; // ms

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touchStartX    = e.touches[0].clientX;
    touchStartY    = e.touches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (!State.game || !State.game.isRunning || State.game.isPaused) return;

    const dx   = e.changedTouches[0].clientX - touchStartX;
    const dy   = e.changedTouches[0].clientY - touchStartY;
    const dt   = Date.now() - touchStartTime;
    const adx  = Math.abs(dx), ady = Math.abs(dy);

    if (adx < 10 && ady < 10 && dt < TAP_THRESHOLD) {
      State.game.rotate(); return;
    }
    if (adx > ady) {
      if (adx > SWIPE_THRESHOLD) dx > 0 ? State.game.moveRight() : State.game.moveLeft();
    } else {
      if (ady > SWIPE_THRESHOLD) dy > 0 ? State.game.softDrop() : State.game.hardDrop();
    }
  }, { passive: false });

  // On-screen buttons
  const hold = (btn, fn) => {
    let interval = null;
    btn.addEventListener('touchstart', e => { e.preventDefault(); fn(); interval = setInterval(fn, 80); });
    btn.addEventListener('touchend',   e => { e.preventDefault(); clearInterval(interval); });
    btn.addEventListener('mousedown',  () => { fn(); interval = setInterval(fn, 80); });
    btn.addEventListener('mouseup',    () => clearInterval(interval));
    btn.addEventListener('mouseleave', () => clearInterval(interval));
  };

  const once = (btn, fn) => {
    btn.addEventListener('touchstart', e => { e.preventDefault(); fn(); });
    btn.addEventListener('click', fn);
  };

  if ($('ctrl-left'))   hold($('ctrl-left'),   () => State.game?.moveLeft());
  if ($('ctrl-right'))  hold($('ctrl-right'),  () => State.game?.moveRight());
  if ($('ctrl-down'))   hold($('ctrl-down'),   () => State.game?.softDrop());
  if ($('ctrl-rotate')) once($('ctrl-rotate'), () => State.game?.rotate());
  if ($('ctrl-hard'))   once($('ctrl-hard'),   () => State.game?.hardDrop());
  if ($('ctrl-hold'))   once($('ctrl-hold'),   () => State.game?.holdCurrent());
  if ($('ctrl-pause'))  once($('ctrl-pause'),  () => {
    const paused = State.game?.togglePause();
    $('pause-overlay').classList.toggle('hidden', !paused);
  });
}

// ─────────────────────────────────────────────
// Game Over Screen Buttons
// ─────────────────────────────────────────────
function initGameoverScreen() {
  $('btn-download').addEventListener('click', () => {
    const canvas = $('score-card-canvas');
    const link   = document.createElement('a');
    link.download = `magic-tetris-${State.nickname}-${Date.now()}.png`;
    link.href     = canvas.toDataURL('image/png');
    link.click();
  });

  $('btn-again').addEventListener('click', () => {
    showScreen('game-screen');
    initGame();
  });

  $('btn-menu').addEventListener('click', () => {
    if (State.game) State.game.stop();
    showScreen('setup-screen');
    Leaderboard.renderRows(Leaderboard.load(), $('preview-leaderboard'), 5);
  });
}

// ─────────────────────────────────────────────
// Pause / Quit in Game
// ─────────────────────────────────────────────
function initGameScreenButtons() {
  $('btn-resume').addEventListener('click', () => {
    const paused = State.game?.togglePause();
    $('pause-overlay').classList.toggle('hidden', !paused);
  });

  $('btn-quit').addEventListener('click', () => {
    if (confirm('Quit current game?')) {
      State.game?.stop();
      showScreen('setup-screen');
      Leaderboard.renderRows(Leaderboard.load(), $('preview-leaderboard'), 5);
    }
  });
}

// ─────────────────────────────────────────────
// Init All
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initSetupScreen();
  initKeyboard();
  initTouchControls();
  initGameoverScreen();
  initGameScreenButtons();
});
