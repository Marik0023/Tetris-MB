/**
 * tetris.js — Magic Tetris Game Engine
 * Speed scales automatically with score (no difficulty selector)
 */

class TetrisGame {
  static PIECES = {
    I: { shapes: [[[1,1,1,1]],[[1],[1],[1],[1]]],                                              color: '#00f5ff', shadow: '#00f5ff' },
    O: { shapes: [[[1,1],[1,1]]],                                                               color: '#ffd700', shadow: '#ffd700' },
    T: { shapes: [[[0,1,0],[1,1,1]],[[1,0],[1,1],[1,0]],[[1,1,1],[0,1,0]],[[0,1],[1,1],[0,1]]],color: '#bf5fff', shadow: '#bf5fff' },
    S: { shapes: [[[0,1,1],[1,1,0]],[[1,0],[1,1],[0,1]]],                                      color: '#39ff14', shadow: '#39ff14' },
    Z: { shapes: [[[1,1,0],[0,1,1]],[[0,1],[1,1],[1,0]]],                                      color: '#ff073a', shadow: '#ff073a' },
    J: { shapes: [[[1,0,0],[1,1,1]],[[1,1],[1,0],[1,0]],[[1,1,1],[0,0,1]],[[0,1],[0,1],[1,1]]],color: '#4169ff', shadow: '#4169ff' },
    L: { shapes: [[[0,0,1],[1,1,1]],[[1,0],[1,0],[1,1]],[[1,1,1],[1,0,0]],[[1,1],[0,1],[0,1]]],color: '#ff8c00', shadow: '#ff8c00' },
  };

  static PIECE_TYPES = Object.keys(TetrisGame.PIECES);
  static COLS = 10;
  static ROWS = 20;
  static SCORE_TABLE = [0, 100, 300, 500, 800];

  // Speed tiers: [score threshold, interval ms, label, color]
  static SPEED_TIERS = [
    { min: 0,     ms: 800, label: 'Beginner',    color: '#34d399', pct: 5  },
    { min: 500,   ms: 620, label: 'Warming Up',  color: '#60a5fa', pct: 18 },
    { min: 1500,  ms: 480, label: 'Moving',      color: '#818cf8', pct: 32 },
    { min: 3000,  ms: 360, label: 'Speeding',    color: '#a78bfa', pct: 46 },
    { min: 5000,  ms: 260, label: 'Fast',        color: '#c084fc', pct: 58 },
    { min: 8000,  ms: 180, label: 'Very Fast',   color: '#f472b6', pct: 70 },
    { min: 12000, ms: 120, label: 'Blazing',     color: '#fb923c', pct: 80 },
    { min: 18000, ms: 80,  label: 'Insane',      color: '#f87171', pct: 90 },
    { min: 25000, ms: 50,  label: 'ARCHMAGE',    color: '#ff073a', pct: 100 },
  ];

  static RANK_TIERS = [
    { min: 0,     label: '🔮 Novice',      color: '#a78bfa' },
    { min: 1000,  label: '⚡ Apprentice',  color: '#60a5fa' },
    { min: 5000,  label: '🌟 Adept',       color: '#34d399' },
    { min: 15000, label: '💫 Master',      color: '#fbbf24' },
    { min: 30000, label: '🌙 Grandmaster', color: '#f97316' },
    { min: 50000, label: '✨ Archmage',    color: '#ff073a' },
  ];

  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.BLOCK  = canvas.width / TetrisGame.COLS;
    this.onScoreUpdate  = opts.onScoreUpdate  || (() => {});
    this.onGameOver     = opts.onGameOver     || (() => {});
    this.onLineClear    = opts.onLineClear    || (() => {});
    this.onSpeedChange  = opts.onSpeedChange  || (() => {});
    this.bag = [];
    this.reset();
  }

  reset() {
    this.board     = Array.from({ length: TetrisGame.ROWS }, () => Array(TetrisGame.COLS).fill(null));
    this.score     = 0;
    this.lines     = 0;
    this.level     = 1;
    this.canHold   = true;
    this.holdPiece = null;
    this.isRunning = false;
    this.isPaused  = false;
    this.raf       = null;
    this.lastDrop  = 0;
    this._lastSpeedTier = null;
    this.bag = [];
    this.current = this._spawnPiece();
    this.next    = this._spawnPiece();
  }

  start() {
    this.isRunning = true;
    this.isPaused  = false;
    this.lastDrop  = performance.now();
    this._loop(performance.now());
  }

  stop() {
    this.isRunning = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
  }

  togglePause() {
    if (!this.isRunning) return;
    this.isPaused = !this.isPaused;
    if (!this.isPaused) {
      this.lastDrop = performance.now();
      this._loop(performance.now());
    }
    return this.isPaused;
  }

  moveLeft()  { if (this._valid(this.current.shape, this.current.x-1, this.current.y)) { this.current.x--; this._draw(); } }
  moveRight() { if (this._valid(this.current.shape, this.current.x+1, this.current.y)) { this.current.x++; this._draw(); } }

  softDrop() {
    if (!this._valid(this.current.shape, this.current.x, this.current.y+1)) { this._lock(); return; }
    this.current.y++;
    this.score += 1;
    this._draw();
    this.onScoreUpdate(this._stats());
  }

  hardDrop() {
    let d = 0;
    while (this._valid(this.current.shape, this.current.x, this.current.y+1)) { this.current.y++; d++; }
    this.score += d * 2;
    this._lock();
  }

  rotate() {
    const p    = this.current;
    const def  = TetrisGame.PIECES[p.type];
    const next = (p.rot + 1) % def.shapes.length;
    const shape = def.shapes[next];
    for (const k of [0,-1,1,-2,2]) {
      if (this._valid(shape, p.x+k, p.y)) { p.rot=next; p.shape=shape; p.x+=k; this._draw(); return; }
    }
  }

  holdCurrent() {
    if (!this.canHold) return;
    const type = this.current.type;
    if (!this.holdPiece) {
      this.holdPiece = type;
      this.current   = this.next;
      this.next      = this._spawnPiece();
    } else {
      const prev = this.holdPiece;
      this.holdPiece = type;
      this.current   = this._makePiece(prev);
    }
    this.canHold = false;
    this._draw();
  }

  getSpeedTier() {
    return [...TetrisGame.SPEED_TIERS].reverse().find(t => this.score >= t.min) || TetrisGame.SPEED_TIERS[0];
  }

  getRank() {
    return [...TetrisGame.RANK_TIERS].reverse().find(r => this.score >= r.min) || TetrisGame.RANK_TIERS[0];
  }

  drawMini(canvas, type) {
    if (!canvas || !type) {
      if (canvas) {
        const c = canvas.getContext('2d');
        c.clearRect(0,0,canvas.width,canvas.height);
        c.fillStyle='rgba(10,6,24,0.7)';
        c.fillRect(0,0,canvas.width,canvas.height);
      }
      return;
    }
    const ctx   = canvas.getContext('2d');
    const def   = TetrisGame.PIECES[type];
    const shape = def.shapes[0];
    const bs    = Math.min(canvas.width/(shape[0].length+2), canvas.height/(shape.length+2));
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='rgba(10,6,24,0.7)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    const ox = (canvas.width  - shape[0].length*bs)/2;
    const oy = (canvas.height - shape.length*bs)/2;
    for (let r=0;r<shape.length;r++)
      for (let c=0;c<shape[r].length;c++)
        if (shape[r][c]) this._drawBlock(ctx, ox+c*bs, oy+r*bs, bs, def.color, def.shadow);
  }

  // ── Private ──────────────────────────────────────────────────────────
  _stats() { return { score: this.score, lines: this.lines, level: this.level }; }

  _dropInterval() {
    const tier    = this.getSpeedTier();
    // Within tier, linearly accelerate up to next tier
    const tiers   = TetrisGame.SPEED_TIERS;
    const idx     = tiers.indexOf(tier);
    const nextTier = tiers[idx+1];
    if (!nextTier) return tier.ms;
    const progress = (this.score - tier.min) / (nextTier.min - tier.min);
    return tier.ms - (tier.ms - nextTier.ms) * Math.min(progress, 1);
  }

  _bag7() {
    if (this.bag.length < 7) {
      const pool = [...TetrisGame.PIECE_TYPES];
      for (let i=pool.length-1;i>0;i--) {
        const j=Math.floor(Math.random()*(i+1));
        [pool[i],pool[j]]=[pool[j],pool[i]];
      }
      this.bag.push(...pool);
    }
    return this.bag.shift();
  }

  _makePiece(type) {
    const def = TetrisGame.PIECES[type];
    return { type, rot:0, shape:def.shapes[0], color:def.color, shadow:def.shadow,
      x: Math.floor((TetrisGame.COLS - def.shapes[0][0].length)/2), y:0 };
  }

  _spawnPiece() { return this._makePiece(this._bag7()); }

  _valid(shape, x, y) {
    for (let r=0;r<shape.length;r++)
      for (let c=0;c<shape[r].length;c++) {
        if (!shape[r][c]) continue;
        const nx=x+c, ny=y+r;
        if (nx<0||nx>=TetrisGame.COLS||ny>=TetrisGame.ROWS) return false;
        if (ny>=0 && this.board[ny][nx]) return false;
      }
    return true;
  }

  _ghostY() {
    let gy=this.current.y;
    while(this._valid(this.current.shape, this.current.x, gy+1)) gy++;
    return gy;
  }

  _lock() {
    const {shape,x,y,color,shadow}=this.current;
    for (let r=0;r<shape.length;r++)
      for (let c=0;c<shape[r].length;c++) {
        if (!shape[r][c]) continue;
        if (y+r<0) { this._triggerGameOver(); return; }
        this.board[y+r][x+c]={color,shadow};
      }
    this._clearLines();
    this.canHold=true;
    this.current=this.next;
    this.next=this._spawnPiece();
    if (!this._valid(this.current.shape, this.current.x, this.current.y)) this._triggerGameOver();
  }

  _clearLines() {
    let count=0;
    for (let r=TetrisGame.ROWS-1;r>=0;r--) {
      if (this.board[r].every(c=>c!==null)) {
        this.board.splice(r,1);
        this.board.unshift(Array(TetrisGame.COLS).fill(null));
        count++; r++;
      }
    }
    if (count>0) {
      const pts = TetrisGame.SCORE_TABLE[count] * this.level;
      this.score += pts;
      this.lines += count;
      this.level  = Math.floor(this.lines/10)+1;
      this.onLineClear(count, pts);
      this.onScoreUpdate(this._stats());
      // Check speed tier change
      const tier = this.getSpeedTier();
      if (tier !== this._lastSpeedTier) {
        this._lastSpeedTier = tier;
        this.onSpeedChange(tier);
      }
    }
  }

  _triggerGameOver() { this.stop(); this.onGameOver(this._stats()); }

  _loop(ts) {
    if (!this.isRunning || this.isPaused) return;
    if (ts - this.lastDrop > this._dropInterval()) {
      if (!this._valid(this.current.shape, this.current.x, this.current.y+1)) {
        this._lock();
      } else {
        this.current.y++;
        // Check speed tier change (also on every drop)
        const tier = this.getSpeedTier();
        if (tier !== this._lastSpeedTier) {
          this._lastSpeedTier = tier;
          this.onSpeedChange(tier);
        }
      }
      this.lastDrop=ts;
    }
    this._draw();
    this.raf=requestAnimationFrame(t=>this._loop(t));
  }

  _draw() {
    const ctx=this.ctx, BS=this.BLOCK, W=this.canvas.width, H=this.canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#060413';
    ctx.fillRect(0,0,W,H);
    // Grid
    ctx.strokeStyle='rgba(100,60,180,0.12)';
    ctx.lineWidth=0.5;
    for (let r=0;r<=TetrisGame.ROWS;r++) { ctx.beginPath();ctx.moveTo(0,r*BS);ctx.lineTo(W,r*BS);ctx.stroke(); }
    for (let c=0;c<=TetrisGame.COLS;c++) { ctx.beginPath();ctx.moveTo(c*BS,0);ctx.lineTo(c*BS,H);ctx.stroke(); }
    // Board
    for (let r=0;r<TetrisGame.ROWS;r++)
      for (let c=0;c<TetrisGame.COLS;c++)
        if (this.board[r][c]) this._drawBlock(ctx,c*BS,r*BS,BS,this.board[r][c].color,this.board[r][c].shadow);
    if (!this.current) return;
    // Ghost
    const gy=this._ghostY();
    ctx.globalAlpha=0.18;
    for (let r=0;r<this.current.shape.length;r++)
      for (let c=0;c<this.current.shape[r].length;c++)
        if (this.current.shape[r][c]) this._drawBlock(ctx,(this.current.x+c)*BS,(gy+r)*BS,BS,this.current.color,this.current.color);
    ctx.globalAlpha=1;
    // Current
    for (let r=0;r<this.current.shape.length;r++)
      for (let c=0;c<this.current.shape[r].length;c++)
        if (this.current.shape[r][c]) this._drawBlock(ctx,(this.current.x+c)*BS,(this.current.y+r)*BS,BS,this.current.color,this.current.shadow);
  }

  _drawBlock(ctx,px,py,bs,color,glow) {
    ctx.save();
    ctx.shadowBlur=18; ctx.shadowColor=glow||color;
    ctx.fillStyle=color;
    ctx.fillRect(px+1,py+1,bs-2,bs-2);
    const g=ctx.createLinearGradient(px,py,px+bs,py+bs);
    g.addColorStop(0,'rgba(255,255,255,0.28)');
    g.addColorStop(1,'rgba(0,0,0,0.25)');
    ctx.fillStyle=g;
    ctx.fillRect(px+1,py+1,bs-2,bs-2);
    ctx.fillStyle='rgba(255,255,255,0.18)';
    ctx.fillRect(px+1,py+1,bs-2,3);
    ctx.fillRect(px+1,py+1,3,bs-2);
    ctx.strokeStyle='rgba(255,255,255,0.25)';
    ctx.lineWidth=0.8;
    ctx.strokeRect(px+1.5,py+1.5,bs-3,bs-3);
    ctx.restore();
  }
}
