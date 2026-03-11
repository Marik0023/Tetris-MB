/**
 * tetris.js — Magic Tetris Core Engine  (fixed)
 *
 * Fixes applied vs original:
 *  ✅ Game loop never stops — RAF rescheduled unconditionally at end of _loop()
 *  ✅ _lock() no longer calls return in _loop() without RAF reschedule
 *  ✅ Removed _isLocking flag (JS is single-threaded; flag caused "frozen piece" bug)
 *  ✅ softDrop / hardDrop no longer gated by _isLocking
 *  ✅ _lastDrop reset inside _lock() so new piece starts falling immediately
 *  ✅ DAS timers cleared on game-over / pause to prevent ghost inputs
 *  ✅ Ghost-y calculation guarded against null current
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;

const LINE_SCORES    = [0, 100, 300, 700, 1500];
const SPEED_INTERVALS = [800, 650, 500, 370, 250, 150];

const SPEED_TIERS = [
  { label: 'Beginner',  color: '#34d399' },
  { label: 'Moving',    color: '#60a5fa' },
  { label: 'Fast',      color: '#a78bfa' },
  { label: 'Very Fast', color: '#f472b6' },
  { label: 'Blazing',   color: '#fb923c' },
  { label: 'ARCHMAGE',  color: '#ff073a' },
];

const RANK_TIERS = [
  { min: 0,     label: '🔮 Novice',      color: '#a78bfa' },
  { min: 1000,  label: '⚡ Apprentice',  color: '#60a5fa' },
  { min: 5000,  label: '🌟 Adept',       color: '#34d399' },
  { min: 15000, label: '💫 Master',      color: '#fbbf24' },
  { min: 30000, label: '🌙 Grandmaster', color: '#f97316' },
  { min: 50000, label: '✨ Archmage',    color: '#ff073a' },
];

const PIECES = {
  I: { shapes: [[[1,1,1,1]],             [[1],[1],[1],[1]]],                                              color: '#00f5ff' },
  O: { shapes: [[[1,1],[1,1]]],                                                                            color: '#ffd700' },
  T: { shapes: [[[0,1,0],[1,1,1]], [[1,0],[1,1],[1,0]], [[1,1,1],[0,1,0]], [[0,1],[1,1],[0,1]]],           color: '#bf5fff' },
  S: { shapes: [[[0,1,1],[1,1,0]], [[1,0],[1,1],[0,1]]],                                                   color: '#39ff14' },
  Z: { shapes: [[[1,1,0],[0,1,1]], [[0,1],[1,1],[1,0]]],                                                   color: '#ff073a' },
  J: { shapes: [[[1,0,0],[1,1,1]], [[1,1],[1,0],[1,0]], [[1,1,1],[0,0,1]], [[0,1],[0,1],[1,1]]],           color: '#4169ff' },
  L: { shapes: [[[0,0,1],[1,1,1]], [[1,0],[1,0],[1,1]], [[1,1,1],[1,0,0]], [[1,1],[0,1],[0,1]]],           color: '#ff8c00' },
};
const PIECE_TYPES = Object.keys(PIECES);

// SRS wall-kick tables
const KICKS_JLSTZ = [
  [[ 0,0],[-1,0],[-1,+1],[0,-2],[-1,-2]],
  [[ 0,0],[+1,0],[+1,-1],[0,+2],[+1,+2]],
  [[ 0,0],[+1,0],[+1,+1],[0,-2],[+1,-2]],
  [[ 0,0],[-1,0],[-1,-1],[0,+2],[-1,+2]],
];
const KICKS_I = [
  [[ 0,0],[-2,0],[+1,0],[-2,-1],[+1,+2]],
  [[ 0,0],[-1,0],[+2,0],[-1,+2],[+2,-1]],
  [[ 0,0],[+2,0],[-1,0],[+2,+1],[-1,-2]],
  [[ 0,0],[+1,0],[-2,0],[+1,-2],[-2,+1]],
];

const SAVE_KEY = 'magic_tetris_gamestate';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────
function emptyBoard()        { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }
function cloneBoard(board)   { return board.map(r => [...r]); }
function getSpeedLevel(lines){ return Math.min(Math.floor(lines / 20), SPEED_INTERVALS.length - 1); }
function getRank(score)      { return [...RANK_TIERS].reverse().find(r => score >= r.min) || RANK_TIERS[0]; }

// ─────────────────────────────────────────────────────────────────────────────
// 7-BAG RANDOMISER
// ─────────────────────────────────────────────────────────────────────────────
class Bag {
  constructor() { this._bag = []; }
  next() {
    if (!this._bag.length) this._refill();
    return this._bag.shift();
  }
  _refill() {
    const pool = [...PIECE_TYPES];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this._bag = pool;
  }
  serialize()   { return [...this._bag]; }
  restore(data) { this._bag = data || []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// PIECE
// ─────────────────────────────────────────────────────────────────────────────
class Piece {
  constructor(type) {
    this.type  = type;
    this.rot   = 0;
    this.color = PIECES[type].color;
    this.shape = PIECES[type].shapes[0];
    this.x     = Math.floor((COLS - this.shape[0].length) / 2);
    this.y     = 0;
  }
  get kicks() { return this.type === 'I' ? KICKS_I : KICKS_JLSTZ; }

  rotatedShape(dir = 1) {
    const shapes = PIECES[this.type].shapes;
    const next   = ((this.rot + dir) % shapes.length + shapes.length) % shapes.length;
    return { shape: shapes[next], rot: next };
  }
  serialize() { return { type: this.type, rot: this.rot, x: this.x, y: this.y }; }

  static restore(data) {
    if (!data) return null;
    const p = new Piece(data.type);
    p.rot   = data.rot;
    p.shape = PIECES[data.type].shapes[data.rot];
    p.x     = data.x;
    p.y     = data.y;
    return p;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME ENGINE
// ─────────────────────────────────────────────────────────────────────────────
class TetrisGame {
  static SPEED_TIERS    = SPEED_TIERS;
  static RANK_TIERS     = RANK_TIERS;
  static SPEED_INTERVALS = SPEED_INTERVALS;
  static COLS = COLS;
  static ROWS = ROWS;

  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    this.onScoreUpdate = opts.onScoreUpdate || (() => {});
    this.onGameOver    = opts.onGameOver    || (() => {});
    this.onLineClear   = opts.onLineClear   || (() => {});
    this.onSpeedChange = opts.onSpeedChange || (() => {});
    this.onHoldChange  = opts.onHoldChange  || (() => {});
    this.onNextChange  = opts.onNextChange  || (() => {});

    this._bag       = new Bag();
    this._raf       = null;
    this._lastDrop  = 0;
    this._das       = { left: null, right: null, down: null };

    this._initState();
    this._bindVisibility();
  }

  // ── Public state ──────────────────────────────────────────────────────────
  get speedLevel()   { return getSpeedLevel(this.lines); }
  get speedTier()    { return SPEED_TIERS[this.speedLevel]; }
  get speedPct()     { return (this.speedLevel / (SPEED_INTERVALS.length - 1)) * 100; }
  get rank()         { return getRank(this.score); }
  get dropInterval() { return SPEED_INTERVALS[this.speedLevel]; }
  stats()            { return { score: this.score, lines: this.lines, level: this.level }; }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  start() {
    this.isRunning = true;
    this.isPaused  = false;
    this._lastDrop = performance.now();
    this._raf      = requestAnimationFrame(t => this._loop(t));
  }

  stop() {
    this.isRunning = false;
    this.isPaused  = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this._clearDAS();
  }

  togglePause() {
    if (!this.isRunning) return this.isPaused;
    this.isPaused = !this.isPaused;
    if (!this.isPaused) {
      this._lastDrop = performance.now();
      this._raf = requestAnimationFrame(t => this._loop(t));
    } else {
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
      this._clearDAS();
    }
    return this.isPaused;
  }

  restart() {
    this.stop();
    this._initState();
    this.start();
    this._saveState();
  }

  // ── Moves ─────────────────────────────────────────────────────────────────
  moveLeft()  { if (this.isRunning && !this.isPaused) this._tryMove(-1, 0); }
  moveRight() { if (this.isRunning && !this.isPaused) this._tryMove(+1, 0); }

  softDrop() {
    if (!this.isRunning || this.isPaused) return;
    if (!this._tryMove(0, +1)) {
      this._lock();
    } else {
      this.score += 1;
      this._lastDrop = performance.now();
      this.onScoreUpdate(this.stats());
    }
  }

  hardDrop() {
    if (!this.isRunning || this.isPaused) return;
    let dropped = 0;
    while (this._tryMove(0, +1)) dropped++;
    this.score += dropped * 2;
    this.onScoreUpdate(this.stats());
    this._lock();
  }

  rotate(dir = 1) {
    if (!this.isRunning || this.isPaused || !this.current) return false;
    const { shape: newShape, rot: newRot } = this.current.rotatedShape(dir);
    const kicks = this.current.kicks[this.current.rot];
    for (const [dx, dy] of kicks) {
      if (this._isValid(newShape, this.current.x + dx, this.current.y - dy)) {
        this.current.shape = newShape;
        this.current.rot   = newRot;
        this.current.x    += dx;
        this.current.y    -= dy;
        this._draw();
        this._saveState();
        return true;
      }
    }
    return false;
  }

  hold() {
    if (!this.isRunning || this.isPaused || !this.canHold) return;
    const type = this.current.type;
    if (!this.holdType) {
      this.holdType = type;
      this.current  = new Piece(this._bag.next());
      this.onNextChange(this.next);
    } else {
      const prev    = this.holdType;
      this.holdType = type;
      this.current  = new Piece(prev);
    }
    this.current.x = Math.floor((COLS - this.current.shape[0].length) / 2);
    this.current.y = 0;
    this.canHold   = false;
    this._lastDrop = performance.now();
    this.onHoldChange(this.holdType);
    this._draw();
    this._saveState();
  }

  // ── DAS ───────────────────────────────────────────────────────────────────
  startDAS(dir) {
    this._clearDAS(dir);
    const fn = dir === 'left'  ? () => this.moveLeft()
             : dir === 'right' ? () => this.moveRight()
             :                   () => this.softDrop();

    const initialDelay = dir === 'down' ? 80  : 150;
    const repeatRate   = dir === 'down' ? 50  : 40;

    fn();
    this._das[dir] = setTimeout(() => {
      this._das[dir] = setInterval(fn, repeatRate);
    }, initialDelay);
  }

  stopDAS(dir) { this._clearDAS(dir); }

  _clearDAS(dir) {
    const dirs = dir ? [dir] : ['left', 'right', 'down'];
    dirs.forEach(d => {
      clearTimeout(this._das[d]);
      clearInterval(this._das[d]);
      this._das[d] = null;
    });
  }

  // ── Mini canvas renderer ──────────────────────────────────────────────────
  drawMini(canvas, type) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(10,6,24,0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!type) return;

    const shape = PIECES[type].shapes[0];
    const color = PIECES[type].color;
    const bs    = Math.min(
      (canvas.width  - 16) / shape[0].length,
      (canvas.height - 16) / shape.length
    );
    const ox = (canvas.width  - shape[0].length * bs) / 2;
    const oy = (canvas.height - shape.length    * bs) / 2;

    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) this._drawBlock(ctx, ox + c * bs, oy + r * bs, bs, color);
  }

  // ── State persistence ─────────────────────────────────────────────────────
  saveToStorage()     { this._saveState(); }
  clearStorage()      { localStorage.removeItem(SAVE_KEY); }

  restoreFromStorage() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s || !s.board) return false;

      this.board    = s.board;
      this.score    = s.score    || 0;
      this.lines    = s.lines    || 0;
      this.level    = s.level    || 1;
      this.canHold  = s.canHold !== false;
      this.holdType = s.holdType || null;
      this._bag.restore(s.bag || []);
      this.current  = Piece.restore(s.current) || new Piece(this._bag.next());
      this.next     = s.nextType || this._bag.next();
      this.isRunning = false;
      this.isPaused  = true;
      return true;
    } catch { return false; }
  }

  // ── Private: State init ───────────────────────────────────────────────────
  _initState() {
    this.board     = emptyBoard();
    this.score     = 0;
    this.lines     = 0;
    this.level     = 1;
    this.canHold   = true;
    this.holdType  = null;
    this.isRunning = false;
    this.isPaused  = false;
    this._bag      = new Bag();
    this.current   = new Piece(this._bag.next());
    this.next      = this._bag.next();
  }

  // ── Private: Validation ───────────────────────────────────────────────────
  _isValid(shape, px, py) {
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = px + c, ny = py + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= 0 && this.board[ny][nx]) return false;
      }
    return true;
  }

  _tryMove(dx, dy) {
    if (!this.current) return false;
    if (this._isValid(this.current.shape, this.current.x + dx, this.current.y + dy)) {
      this.current.x += dx;
      this.current.y += dy;
      return true;
    }
    return false;
  }

  _ghostY() {
    if (!this.current) return 0;
    let gy = this.current.y;
    while (this._isValid(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  // ── Private: Lock piece ───────────────────────────────────────────────────
  // FIX: Does NOT call stop() or touch the RAF — the loop handles itself.
  _lock() {
    if (!this.current) return;
    const { shape, x, y, color } = this.current;

    // Check if entire piece is above the visible field → game over
    const anyVisible = shape.some((row, r) => row.some((cell, c) => cell && (y + r) >= 0));
    if (!anyVisible) { this._triggerGameOver(); return; }

    // Write to board
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c] && (y + r) >= 0)
          this.board[y + r][x + c] = { color };

    // Clear lines
    const cleared = this._clearLines();

    // Stats
    const prevSpeed = this.speedLevel;
    if (cleared > 0) {
      const pts   = LINE_SCORES[cleared] * this.level;
      this.score += pts;
      this.lines += cleared;
      this.level  = Math.floor(this.lines / 10) + 1;
      this.onLineClear(cleared, pts);
      if (this.speedLevel !== prevSpeed) this.onSpeedChange(this.speedTier, this.speedPct);
    }
    this.onScoreUpdate(this.stats());

    // Spawn next
    this.canHold  = true;
    this.current  = new Piece(this.next);
    this.next     = this._bag.next();
    this.onNextChange(this.next);

    // Spawn collision → game over
    if (!this._isValid(this.current.shape, this.current.x, this.current.y)) {
      this._triggerGameOver();
      return;
    }

    // Reset drop timer for new piece
    this._lastDrop = performance.now();
    this._saveState();
  }

  _clearLines() {
    let count = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every(c => c !== null)) {
        this.board.splice(r, 1);
        this.board.unshift(Array(COLS).fill(null));
        count++; r++;
      }
    }
    return count;
  }

  _triggerGameOver() {
    this.stop();           // stops RAF + DAS; isRunning = false
    this.clearStorage();
    this.onGameOver(this.stats());
  }

  // ── Private: Game loop ────────────────────────────────────────────────────
  // FIX: RAF is ALWAYS rescheduled at the bottom — it never stops mid-game.
  _loop(ts) {
    if (!this.isRunning || this.isPaused) return;  // only exit is game-over/pause

    if (ts - this._lastDrop >= this.dropInterval) {
      if (!this._tryMove(0, +1)) {
        // Piece can't fall → lock it
        this._lock();
        // _triggerGameOver() inside _lock() sets isRunning=false → we return above next iteration
        if (!this.isRunning) return;   // game over — don't reschedule
      } else {
        this._lastDrop = ts;
      }
    }

    this._draw();
    // ✅ KEY FIX: RAF is always rescheduled here, not inside _lock()
    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  _saveState() {
    if (!this.isRunning && !this.isPaused) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        board:    this.board,
        score:    this.score,
        lines:    this.lines,
        level:    this.level,
        canHold:  this.canHold,
        holdType: this.holdType,
        bag:      this._bag.serialize(),
        current:  this.current.serialize(),
        nextType: this.next,
      }));
    } catch {}
  }

  _bindVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isRunning && !this.isPaused) {
        this.togglePause();
        this._visibilityPaused = true;
      } else if (!document.hidden && this._visibilityPaused) {
        this._visibilityPaused = false;
        // stays paused — user resumes manually
      }
    });
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  _draw() {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;
    const BS  = W / COLS;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#060413';
    ctx.fillRect(0, 0, W, H);

    // Subtle scanline effect
    for (let r = 0; r < ROWS; r += 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, r * BS, W, BS);
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(100,60,180,0.10)';
    ctx.lineWidth   = 0.5;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * BS); ctx.lineTo(W, r * BS); ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * BS, 0); ctx.lineTo(c * BS, H); ctx.stroke();
    }

    // Locked cells
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.board[r][c])
          this._drawBlock(ctx, c * BS, r * BS, BS, this.board[r][c].color);

    if (!this.current) return;

    // Ghost piece
    const gy = this._ghostY();
    if (gy !== this.current.y) {
      ctx.globalAlpha = 0.18;
      for (let r = 0; r < this.current.shape.length; r++)
        for (let c = 0; c < this.current.shape[r].length; c++)
          if (this.current.shape[r][c])
            this._drawBlock(ctx, (this.current.x + c) * BS, (gy + r) * BS, BS, this.current.color);
      ctx.globalAlpha = 1;
    }

    // Active piece
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this._drawBlock(ctx, (this.current.x + c) * BS, (this.current.y + r) * BS, BS, this.current.color);
  }

  _drawBlock(ctx, px, py, bs, color) {
    const pad = 1.5;
    ctx.save();
    ctx.shadowBlur  = 16;
    ctx.shadowColor = color;

    // Main fill
    ctx.fillStyle = color;
    ctx.fillRect(px + pad, py + pad, bs - pad * 2, bs - pad * 2);

    // Gradient overlay
    const g = ctx.createLinearGradient(px, py, px + bs, py + bs);
    g.addColorStop(0, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = g;
    ctx.fillRect(px + pad, py + pad, bs - pad * 2, bs - pad * 2);

    // Top & left highlight
    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    ctx.fillRect(px + pad, py + pad, bs - pad * 2, 3);
    ctx.fillRect(px + pad, py + pad, 3, bs - pad * 2);

    // Bottom-right shadow
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(px + pad, py + bs - pad - 3, bs - pad * 2, 3);
    ctx.fillRect(px + bs - pad - 3, py + pad, 3, bs - pad * 2);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 0.7;
    ctx.strokeRect(px + pad + 0.5, py + pad + 0.5, bs - pad * 2 - 1, bs - pad * 2 - 1);

    ctx.restore();
  }
}
