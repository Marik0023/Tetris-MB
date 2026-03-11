/**
 * tetris.js — Magic Tetris Engine
 * Logic ported from chvin/react-tetris (proven, battle-tested)
 *
 * Core patterns from chvin:
 *  ✓ setTimeout-based fall loop (clearTimeout before every reschedule)
 *  ✓ `lock` flag blocks ALL input during piece-lock & line-clear transitions
 *  ✓ `want()` validates every move before applying
 *  ✓ Matrix-transposition rotation (no SRS kick tables needed)
 *  ✓ `nextAround()` handles lock → clear-check → over-check → spawn cycle
 *  ✓ Points: 10 per piece + speed bonus; clearPoints[n-1] for line clears
 *  ✓ Speed level: starts at speedStart, +1 per eachLines cleared (max 6)
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS  (mirrored from chvin/src/unit/const.js)
// ─────────────────────────────────────────────────────────────────────────────
const COLS        = 10;
const ROWS        = 20;
const EACH_LINES  = 20;          // lines to clear before speed increases
const MAX_SPEED   = 6;
const SPEEDS      = [800, 650, 500, 370, 250, 160];   // ms per drop, index 0..5
const CLEAR_PTS   = [100, 300, 700, 1500];             // points for 1/2/3/4 lines
const BLANK_ROW   = () => Array(COLS).fill(0);
const BLANK_BOARD = () => Array.from({ length: ROWS }, BLANK_ROW);

// DAS (Delayed Auto Shift) — separate from chvin's event.js but same idea
const DAS_INITIAL = 150;   // ms before repeat starts
const DAS_REPEAT  = 50;    // ms between repeats (horizontal)
const DAS_DOWN_I  = 80;    // initial delay for soft-drop
const DAS_DOWN_R  = 40;    // repeat for soft-drop

// Speed-tier labels for the UI bar
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

// Piece shapes — same as chvin blockShape (row-major, row=y, col=x)
const SHAPES = {
  I: [[1, 1, 1, 1]],
  L: [[0, 0, 1],
      [1, 1, 1]],
  J: [[1, 0, 0],
      [1, 1, 1]],
  Z: [[1, 1, 0],
      [0, 1, 1]],
  S: [[0, 1, 1],
      [1, 1, 0]],
  O: [[1, 1],
      [1, 1]],
  T: [[0, 1, 0],
      [1, 1, 1]],
};

// Rotation origin offsets — same as chvin origin
// each entry is [row_delta, col_delta] for one rotation step
const ORIGINS = {
  I: [[-1, 1], [1, -1]],
  L: [[0, 0]],
  J: [[0, 0]],
  Z: [[0, 0]],
  S: [[0, 0]],
  O: [[0, 0]],
  T: [[0, 0], [1, 0], [-1, 1], [0, -1]],
};

const PIECE_COLORS = {
  I: '#00f5ff', O: '#ffd700', T: '#bf5fff',
  S: '#39ff14', Z: '#ff073a', J: '#4169ff', L: '#ff8c00',
};

const PIECE_TYPES = Object.keys(SHAPES);
const SAVE_KEY    = 'magic_tetris_v2';

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS  (ported from chvin/unit)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * want(shape, row, col, board) — can the piece occupy this position?
 * Mirrors chvin's unit.want()
 */
function want(shape, row, col, board) {
  const height = shape.length;
  const width  = shape[0].length;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!shape[r][c]) continue;
      const br = row + r;
      const bc = col + c;
      if (bc < 0 || bc >= COLS)  return false;   // left / right wall
      if (br >= ROWS)             return false;   // floor
      if (br < 0)                 continue;       // above ceiling is OK
      if (board[br][bc])          return false;   // occupied cell
    }
  }
  return true;
}

/**
 * rotateCW(shape, type, rotateIndex) — returns { shape, rotateIndex }
 * Matrix transposition (chvin's Block.rotate), plus origin offset
 */
function rotateCW(shape, type, rotateIndex) {
  // Transpose + reverse rows = clockwise 90°
  const rows = shape.length;
  const cols = shape[0].length;
  const result = [];
  for (let c = cols - 1; c >= 0; c--) {
    const newRow = [];
    for (let r = 0; r < rows; r++) newRow.push(shape[r][c]);
    result.push(newRow);
  }
  const origins    = ORIGINS[type];
  const nextIndex  = (rotateIndex + 1) % origins.length;
  const [dr, dc]   = origins[rotateIndex];
  return { shape: result, rotateIndex: nextIndex, dr, dc };
}

/**
 * isClear(board) — returns array of full row indices, or false
 * Mirrors chvin's unit.isClear()
 */
function isClear(board) {
  const lines = [];
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every(v => v !== 0)) lines.push(r);
  }
  return lines.length ? lines : false;
}

/**
 * isOver(board) — game over if any cell in row 0 is filled
 * Mirrors chvin's unit.isOver()
 */
function isOver(board) {
  return board[0].some(v => v !== 0);
}

function getRank(score) {
  return [...RANK_TIERS].reverse().find(r => score >= r.min) || RANK_TIERS[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// 7-BAG randomiser
// ─────────────────────────────────────────────────────────────────────────────
class Bag {
  constructor() { this._bag = []; }
  next() {
    if (!this._bag.length) {
      const pool = [...PIECE_TYPES];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      this._bag = pool;
    }
    return this._bag.shift();
  }
  serialize()   { return [...this._bag]; }
  restore(data) { this._bag = data || []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME ENGINE
// ─────────────────────────────────────────────────────────────────────────────
class TetrisGame {
  static SPEED_TIERS    = SPEED_TIERS;
  static RANK_TIERS     = RANK_TIERS;
  static SPEEDS         = SPEEDS;
  static COLS           = COLS;
  static ROWS           = ROWS;

  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    this.onScoreUpdate = opts.onScoreUpdate || (() => {});
    this.onGameOver    = opts.onGameOver    || (() => {});
    this.onLineClear   = opts.onLineClear   || (() => {});
    this.onSpeedChange = opts.onSpeedChange || (() => {});
    this.onNextChange  = opts.onNextChange  || (() => {});
    this.onHoldChange  = opts.onHoldChange  || (() => {});
    this.onLockFlash   = opts.onLockFlash   || (() => {});

    this._bag          = new Bag();
    this._fallTimer    = null;    // chvin: states.fallInterval
    this._das          = {};      // DAS timers keyed by direction

    this._initState();
    this._bindVisibility();
  }

  // ── Public getters ────────────────────────────────────────────────────────
  get speedIndex()  { return this.speedRun - 1; }       // 0-based for arrays
  get speedTier()   { return SPEED_TIERS[this.speedIndex]; }
  get speedPct()    { return (this.speedIndex / (MAX_SPEED - 1)) * 100; }
  get rank()        { return getRank(this.points); }
  get dropMs()      { return SPEEDS[this.speedIndex]; }
  stats()           { return { score: this.points, lines: this.clearLines, level: this.speedRun }; }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused  = false;
    // Spawn first piece
    this._spawnPiece(this.nextType);
    this.nextType = this._bag.next();
    this.onNextChange(this.nextType);
    this._auto();
    this._drawLoop();
    this._saveState();
  }

  stop() {
    this.isRunning = false;
    this.isPaused  = false;
    clearTimeout(this._fallTimer);
    this._fallTimer = null;
    this._clearDAS();
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  togglePause() {
    if (!this.isRunning) return this.isPaused;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      clearTimeout(this._fallTimer);
      this._fallTimer = null;
      this._clearDAS();
    } else {
      if (!this.lock) this._auto();
    }
    return this.isPaused;
  }

  restart() {
    this.stop();
    this._initState();
    this.start();
  }

  // ── Moves (guarded by lock + pause, exactly like chvin) ──────────────────
  moveLeft() {
    if (!this._canMove()) return;
    const { row, col, shape } = this.cur;
    if (want(shape, row, col - 1, this.board)) {
      this.cur.col = col - 1;
      // Extend drop timer slightly on successful move (chvin does this)
      this._extendAuto();
    }
  }

  moveRight() {
    if (!this._canMove()) return;
    const { row, col, shape } = this.cur;
    if (want(shape, row, col + 1, this.board)) {
      this.cur.col = col + 1;
      this._extendAuto();
    }
  }

  softDrop() {
    if (!this._canMove()) return;
    const { row, col, shape } = this.cur;
    if (want(shape, row + 1, col, this.board)) {
      this.cur.row = row + 1;
      this.points  += 1;
      this.onScoreUpdate(this.stats());
      // Reset fall timer (chvin calls states.auto() after each soft drop)
      this._auto();
    } else {
      // Can't fall further — lock it
      this._lockPiece();
    }
  }

  hardDrop() {
    if (!this._canMove()) return;
    const { col, shape } = this.cur;
    let row = this.cur.row;
    let dropped = 0;
    while (want(shape, row + 1, col, this.board)) { row++; dropped++; }
    this.cur.row  = row;
    this.points  += dropped * 2;
    this.onScoreUpdate(this.stats());
    this._lockPiece();
  }

  rotate() {
    if (!this._canMove()) return;
    const { shape, type, rotateIndex, row, col } = this.cur;
    const { shape: newShape, rotateIndex: newRI, dr, dc } = rotateCW(shape, type, rotateIndex);

    // Try rotated position + origin offset (chvin's wall-kick equivalent)
    const newRow = row + dr;
    const newCol = col + dc;

    if (want(newShape, newRow, newCol, this.board)) {
      this.cur.shape       = newShape;
      this.cur.rotateIndex = newRI;
      this.cur.row         = newRow;
      this.cur.col         = newCol;
    }
    // If doesn't fit, just ignore (chvin also ignores failed rotation)
  }

  hold() {
    if (!this._canMove() || !this.canHold) return;
    const type = this.cur.type;
    if (!this.holdType) {
      this.holdType = type;
      this._spawnPiece(this.nextType);
      this.nextType = this._bag.next();
      this.onNextChange(this.nextType);
    } else {
      const prev    = this.holdType;
      this.holdType = type;
      this._spawnPiece(prev);
    }
    this.canHold = false;
    this.onHoldChange(this.holdType);
    this._auto();
  }

  // ── DAS (same begin/interval concept as chvin's event.js) ─────────────────
  startDAS(dir) {
    this._clearDAS(dir);
    const fns = { left: () => this.moveLeft(), right: () => this.moveRight(), down: () => this.softDrop() };
    const fn   = fns[dir];
    const iDel = dir === 'down' ? DAS_DOWN_I : DAS_INITIAL;
    const rDel = dir === 'down' ? DAS_DOWN_R : DAS_REPEAT;

    fn(); // immediate first action
    this._das[dir] = setTimeout(() => {
      fn();
      this._das[dir] = setInterval(fn, rDel);
    }, iDel);
  }

  stopDAS(dir) { this._clearDAS(dir); }

  _clearDAS(dir) {
    const keys = dir ? [dir] : ['left', 'right', 'down'];
    keys.forEach(k => {
      clearTimeout(this._das[k]);
      clearInterval(this._das[k]);
      this._das[k] = null;
    });
  }

  // ── Storage ───────────────────────────────────────────────────────────────
  clearStorage() { localStorage.removeItem(SAVE_KEY); }

  restoreFromStorage() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      let data = JSON.parse(atob(raw));
      if (!data || !data.board) return false;

      this.board       = data.board;
      this.colorBoard  = data.colorBoard;
      this.points      = data.points   || 0;
      this.clearLines  = data.clearLines || 0;
      this.speedRun    = data.speedRun  || 1;
      this.speedStart  = data.speedStart || 1;
      this.nextType    = data.nextType  || this._bag.next();
      this.holdType    = data.holdType  || null;
      this.canHold     = data.canHold !== false;
      this._bag.restore(data.bag || []);
      if (data.cur) {
        this.cur = { ...data.cur };
      } else {
        this._spawnPiece(this.nextType);
        this.nextType = this._bag.next();
      }
      this.isRunning = true;
      this.isPaused  = true;
      this.lock      = false;
      return true;
    } catch (e) { return false; }
  }

  resumeFromStorage() {
    this.isPaused = false;
    this._auto();
    this._drawLoop();
  }

  // ── Mini canvas ───────────────────────────────────────────────────────────
  drawMini(canvas, type) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(6,4,19,0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!type) return;

    const shape = SHAPES[type];
    const color = PIECE_COLORS[type];
    const bs    = Math.min(
      (canvas.width  - 12) / shape[0].length,
      (canvas.height - 12) / shape.length
    );
    const ox = (canvas.width  - shape[0].length * bs) / 2;
    const oy = (canvas.height - shape.length    * bs) / 2;

    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) this._drawBlock(ctx, ox + c * bs, oy + r * bs, bs, color);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE — State
  // ─────────────────────────────────────────────────────────────────────────
  _initState() {
    this.board       = BLANK_BOARD();
    this.colorBoard  = BLANK_BOARD().map(r => r.map(() => null)); // stores piece colors
    this.points      = 0;
    this.clearLines  = 0;
    this.speedRun    = 1;   // current speed level 1-6
    this.speedStart  = 1;   // starting speed (can be set before game starts)
    this.lock        = false;
    this.isRunning   = false;
    this.isPaused    = false;
    this.canHold     = true;
    this.holdType    = null;
    this._rafId      = null;
    this._bag        = new Bag();
    this.nextType    = this._bag.next();
    this.cur         = null;
  }

  _spawnPiece(type) {
    const shape = SHAPES[type];
    // Starting column: centered (chvin uses col=4 for most, col=3 for I)
    const col = type === 'I' ? 3 : 4;
    // Starting row: chvin places most at -1 (above visible area)
    const row = type === 'I' ? 0 : -1;
    this.cur = {
      type,
      shape:       shape.map(r => [...r]),  // deep copy
      rotateIndex: 0,
      row,
      col,
      color:       PIECE_COLORS[type],
    };
  }

  _canMove() {
    return this.isRunning && !this.isPaused && !this.lock && this.cur !== null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE — Game Loop (chvin: states.auto)
  // ─────────────────────────────────────────────────────────────────────────
  _auto(delay) {
    clearTimeout(this._fallTimer);  // chvin ALWAYS clears before scheduling
    if (!this.isRunning || this.isPaused || this.lock) return;

    const ms = delay !== undefined ? Math.max(0, delay) : this.dropMs;
    this._fallTimer = setTimeout(() => {
      if (!this.isRunning || this.isPaused || this.lock || !this.cur) return;

      const { row, col, shape } = this.cur;
      if (want(shape, row + 1, col, this.board)) {
        this.cur.row++;
        this._auto();    // reschedule — chvin's recursive fall loop
      } else {
        this._lockPiece();
      }
    }, ms);
  }

  _extendAuto() {
    // After a successful horizontal move, give a tiny extra time before next auto-drop
    // chvin: timeStamp manipulation in left.js / right.js
    // We just reschedule with a slight bonus
    const remain = Math.min(this.dropMs * 0.5, 300);
    this._auto(remain);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE — Lock (chvin: states.nextAround)
  // ─────────────────────────────────────────────────────────────────────────
  _lockPiece() {
    clearTimeout(this._fallTimer);
    this._fallTimer = null;
    this.lock = true;           // block all input

    const { shape, row, col, color } = this.cur;

    // Write piece onto board
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const br = row + r;
        if (br < 0) continue;   // above ceiling — skip (chvin: xy[0]+k1 >= 0)
        this.board[br][col + c]      = 1;
        this.colorBoard[br][col + c] = color;
      }
    }

    this.cur = null;

    // Score for landing (chvin: 10 + speed bonus per piece)
    this.points += 10 + (this.speedRun - 1) * 2;
    this.onLockFlash();
    this.onScoreUpdate(this.stats());

    // Check for line clears (chvin: isClear then clearLines reducer)
    const lines = isClear(this.board);
    if (lines) {
      this._clearLinesAnim(lines);
      return;
    }

    // Check game over (chvin: isOver)
    if (isOver(this.board)) {
      this._gameOver();
      return;
    }

    // Spawn next piece after short delay (chvin: setTimeout 100ms)
    setTimeout(() => {
      this.lock = false;
      this.canHold = true;
      this._spawnNextPiece();
    }, 100);
  }

  _clearLinesAnim(lines) {
    // chvin: clearLines reducer — removes rows and prepends blank rows
    const pts = CLEAR_PTS[lines.length - 1];
    this.points    += pts;
    this.clearLines += lines.length;

    // Remove cleared rows and add blank rows at top
    const newBoard      = this.board.map(r => [...r]);
    const newColorBoard = this.colorBoard.map(r => [...r]);

    // Remove in reverse order so indices don't shift
    for (const li of [...lines].reverse()) {
      newBoard.splice(li, 1);
      newBoard.unshift(BLANK_ROW());
      newColorBoard.splice(li, 1);
      newColorBoard.unshift(Array(COLS).fill(null));
    }
    this.board      = newBoard;
    this.colorBoard = newColorBoard;

    // Update speed (chvin: speedNow = speedStart + floor(clearLines/eachLines))
    const prevSpeed   = this.speedRun;
    const speedAdd    = Math.floor(this.clearLines / EACH_LINES);
    this.speedRun     = Math.min(this.speedStart + speedAdd, MAX_SPEED);

    this.onLineClear(lines.length, pts);
    this.onScoreUpdate(this.stats());
    if (this.speedRun !== prevSpeed) this.onSpeedChange(this.speedTier, this.speedPct);

    if (isOver(this.board)) {
      this._gameOver();
      return;
    }

    // Spawn next after clear (chvin: store.dispatch moveBlock, nextBlock, auto, lock(false))
    this.lock = false;
    this.canHold = true;
    this._spawnNextPiece();
  }

  _spawnNextPiece() {
    this._spawnPiece(this.nextType);
    this.nextType = this._bag.next();
    this.onNextChange(this.nextType);

    // Spawn collision = game over (chvin: isOver after setting new cur)
    if (!want(this.cur.shape, this.cur.row, this.cur.col, this.board)) {
      this._gameOver();
      return;
    }

    this._saveState();
    this._auto();
  }

  _gameOver() {
    this.lock = false;
    this.stop();
    this.clearStorage();
    this.onGameOver(this.stats());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE — Render (requestAnimationFrame for smooth 60fps visuals)
  // ─────────────────────────────────────────────────────────────────────────
  _drawLoop() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    const loop = () => {
      if (!this.isRunning) return;
      this._draw();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  _draw() {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;
    const BS  = W / COLS;

    ctx.clearRect(0, 0, W, H);

    // --- Background ---
    ctx.fillStyle = '#060413';
    ctx.fillRect(0, 0, W, H);

    // Scanlines
    for (let r = 0; r < ROWS; r += 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, r * BS, W, BS);
    }

    // Grid
    ctx.strokeStyle = 'rgba(100,60,180,0.09)';
    ctx.lineWidth   = 0.5;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * BS); ctx.lineTo(W, r * BS); ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * BS, 0); ctx.lineTo(c * BS, H); ctx.stroke();
    }

    // --- Locked cells ---
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.board[r][c] && this.colorBoard[r][c]) {
          this._drawBlock(ctx, c * BS, r * BS, BS, this.colorBoard[r][c]);
        }
      }
    }

    if (!this.cur) return;

    // --- Ghost piece ---
    let ghostRow = this.cur.row;
    while (want(this.cur.shape, ghostRow + 1, this.cur.col, this.board)) ghostRow++;

    if (ghostRow !== this.cur.row) {
      ctx.globalAlpha = 0.16;
      for (let r = 0; r < this.cur.shape.length; r++)
        for (let c = 0; c < this.cur.shape[r].length; c++)
          if (this.cur.shape[r][c]) {
            const pr = ghostRow + r;
            if (pr >= 0) this._drawBlock(ctx, (this.cur.col + c) * BS, pr * BS, BS, this.cur.color);
          }
      ctx.globalAlpha = 1;
    }

    // --- Active piece ---
    for (let r = 0; r < this.cur.shape.length; r++)
      for (let c = 0; c < this.cur.shape[r].length; c++)
        if (this.cur.shape[r][c]) {
          const pr = this.cur.row + r;
          if (pr >= 0) this._drawBlock(ctx, (this.cur.col + c) * BS, pr * BS, BS, this.cur.color);
        }
  }

  _drawBlock(ctx, px, py, bs, color) {
    const pad = 1.5;
    ctx.save();
    ctx.shadowBlur  = 14;
    ctx.shadowColor = color;

    ctx.fillStyle = color;
    ctx.fillRect(px + pad, py + pad, bs - pad * 2, bs - pad * 2);

    // Gradient shine
    const g = ctx.createLinearGradient(px, py, px + bs, py + bs);
    g.addColorStop(0, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = g;
    ctx.fillRect(px + pad, py + pad, bs - pad * 2, bs - pad * 2);

    // Top & left highlight
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(px + pad, py + pad, bs - pad * 2, 3);
    ctx.fillRect(px + pad, py + pad, 3, bs - pad * 2);

    // Bottom-right shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(px + pad, py + bs - pad - 2.5, bs - pad * 2, 2.5);
    ctx.fillRect(px + bs - pad - 2.5, py + pad, 2.5, bs - pad * 2);

    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth   = 0.7;
    ctx.strokeRect(px + pad + 0.5, py + pad + 0.5, bs - pad * 2 - 1, bs - pad * 2 - 1);
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE — Persistence (base64-encoded JSON, like chvin)
  // ─────────────────────────────────────────────────────────────────────────
  _saveState() {
    if (!this.isRunning && !this.isPaused) return;
    try {
      const data = {
        board:       this.board,
        colorBoard:  this.colorBoard,
        points:      this.points,
        clearLines:  this.clearLines,
        speedRun:    this.speedRun,
        speedStart:  this.speedStart,
        nextType:    this.nextType,
        holdType:    this.holdType,
        canHold:     this.canHold,
        bag:         this._bag.serialize(),
        cur:         this.cur ? { ...this.cur } : null,
      };
      localStorage.setItem(SAVE_KEY, btoa(JSON.stringify(data)));
    } catch (e) {}
  }

  _bindVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isRunning && !this.isPaused) {
        this.togglePause();
        this._visibilityPaused = true;
      } else if (!document.hidden && this._visibilityPaused) {
        this._visibilityPaused = false;
        // stays paused until user resumes
      }
    });
  }
}
