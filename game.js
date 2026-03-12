'use strict';

/* ─────────────────────────────────────────
   STARS + PARTICLES
───────────────────────────────────────── */
;(function(){
  // Minimal sharp stars
  const s=document.getElementById('stars');
  for(let i=0;i<70;i++){
    const el=document.createElement('div');
    el.className='st';
    const sz=Math.random()*1.4+0.3;
    el.style.cssText=`width:${sz}px;height:${sz}px;`+
      `left:${Math.random()*100}%;top:${Math.random()*100}%;`+
      `animation:tw ${2+Math.random()*5}s ${Math.random()*8}s infinite;`;
    s.appendChild(el);
  }
})();

/* ─────────────────────────────────────────
   LOGO
───────────────────────────────────────── */
const LOGO='assets/logo.webp';
document.getElementById('logo-s').src=LOGO;
document.getElementById('logo-g').src=LOGO;

/* ─────────────────────────────────────────
   PLAYER STATE & LEADERBOARD
───────────────────────────────────────── */
const PLAYER_KEY='magic_tetris_player';
const LB_KEY='magic_tetris_lb';
const LEGACY_LB_KEY='mt2_lb';
const P={name:'',avatar:'',best:0};
let LB=loadLB();
let lbFrom='pg-start'; // which page opened leaderboard

function safeAvatarForStorage(dataUrl=''){
  if(typeof dataUrl !== 'string') return '';
  if(!dataUrl.startsWith('data:')) return dataUrl;
  return dataUrl.length > 70000 ? '' : dataUrl;
}

function normalizeLBEntry(e={}){
  const avatar = safeAvatarForStorage(e.avatar || e.avatarDataUrl || '');
  return {
    ...e,
    name: e.name || e.nickname || '',
    nickname: e.nickname || e.name || '',
    avatar,
    avatarDataUrl: avatar,
    score: Number(e.score || 0),
    lines: Number(e.lines || 0),
    level: Number(e.level || 1),
    rank: e.rank || 'Wizard',
    date: Number(e.date || Date.now())
  };
}

function loadLB(){
  try {
    const raw = localStorage.getItem(LB_KEY) || localStorage.getItem(LEGACY_LB_KEY) || '[]';
    const parsed = JSON.parse(raw) || [];
    return parsed.map(normalizeLBEntry).sort((a,b)=>b.score-a.score).slice(0,50);
  } catch {
    return [];
  }
}
function writeLB(){
  const clean = LB.map(normalizeLBEntry).sort((a,b)=>b.score-a.score).slice(0,50);
  LB = clean;
  try {
    localStorage.setItem(LB_KEY, JSON.stringify(clean));
    try { localStorage.removeItem(LEGACY_LB_KEY); } catch {}
    return true;
  } catch {
    try {
      const noAvatars = clean.map(e => ({ ...e, avatar:'', avatarDataUrl:'' }));
      LB = noAvatars;
      localStorage.setItem(LB_KEY, JSON.stringify(noAvatars));
      try { localStorage.removeItem(LEGACY_LB_KEY); } catch {}
      return true;
    } catch {
      return false;
    }
  }
}
function savePlayerProfile(){
  const payload = {name:P.name, avatar:safeAvatarForStorage(P.avatar)};
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(payload));
  } catch {
    try { localStorage.setItem(PLAYER_KEY, JSON.stringify({name:P.name, avatar:''})); } catch {}
  }
}
function loadPlayerProfile(){
  try {
    const data = JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null');
    if(!data) return;
    P.name = data.name || '';
    P.avatar = safeAvatarForStorage(data.avatar || '');
  } catch {}
}
async function shrinkImage(file, maxSize=128, quality=.82){
  return new Promise(resolve => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement('canvas');
        cv.width = w;
        cv.height = h;
        const cx = cv.getContext('2d');
        cx.drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(typeof fr.result === 'string' ? fr.result : '');
      img.src = fr.result;
    };
    fr.onerror = () => resolve('');
    fr.readAsDataURL(file);
  });
}
function applyPlayerProfileToStart(){
  const nickEl = document.getElementById('nick');
  const img = document.getElementById('av-img');
  const ico = document.getElementById('av-ico');
  if(P.name) nickEl.value = P.name;
  if(P.avatar){
    img.src = P.avatar;
    img.style.display='block';
    ico.style.display='none';
  } else {
    img.removeAttribute('src');
    img.style.display='none';
    ico.style.display='';
  }
}
loadPlayerProfile();
applyPlayerProfileToStart();

// Load avatar from file
document.getElementById('av-in').addEventListener('change', async function(e){
  const f=e.target.files[0]; if(!f) return;
  const smallAvatar = await shrinkImage(f, 128, .82);
  P.avatar = smallAvatar || P.avatar;
  const img=document.getElementById('av-img');
  img.src=P.avatar; img.style.display='block';
  document.getElementById('av-ico').style.display='none';
  savePlayerProfile();
});

// Generate letter-avatar when no upload
function makeAvatar(name){
  const c=document.createElement('canvas');
  c.width=c.height=60;
  const x=c.getContext('2d');
  const pal=['#7B2FBE','#FF6EC7','#00E5FF','#FFD700','#FF6B35','#39FF14','#FF3366','#3399FF'];
  x.fillStyle=pal[name.charCodeAt(0)%pal.length];
  x.beginPath(); x.arc(30,30,30,0,Math.PI*2); x.fill();
  x.fillStyle='#fff'; x.font='bold 22px Nunito,sans-serif';
  x.textAlign='center'; x.textBaseline='middle';
  x.fillText(name[0].toUpperCase(),30,31);
  return c.toDataURL();
}

/* ─────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────── */
function nav(id){
  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));
  document.getElementById(id).classList.add('on');
}

function openLB(from){
  lbFrom=from;
  renderLB();
  nav('pg-lb');
}
function closeLB(){ nav(lbFrom); }

/* ─────────────────────────────────────────
   START
───────────────────────────────────────── */
function onStart(){
  const nick=document.getElementById('nick').value.trim();
  if(!nick){ document.getElementById('nick').focus(); return; }
  P.name=nick;
  if(!P.avatar) P.avatar=makeAvatar(nick);
  savePlayerProfile();
  applyPlayerProfileToStart();
  const ex=LB.find(e=>(e.name||e.nickname)===nick);
  P.best=ex?Number(ex.score||0):0;

  document.getElementById('gh-nm').textContent=nick;
  document.getElementById('gh-av').src=P.avatar;
  document.getElementById('oc-av').src=P.avatar;
  document.getElementById('oc-nm').textContent=nick;

  nav('pg-game');
  initGame();
}

/* ─────────────────────────────────────────
   LB helpers
───────────────────────────────────────── */
function saveLB(){
  const i=LB.findIndex(e=>(e.name||e.nickname)===P.name);
  const entry = {
    name:P.name,
    nickname:P.name,
    avatar:P.avatar,
    avatarDataUrl:P.avatar,
    score:P.best,
    lines,
    level,
    rank:`Rank #${Math.max(1,myRank())}`,
    date:Date.now()
  };
  if(i===-1){
    LB.push(entry);
  } else if(P.best >= Number(LB[i].score||0)) {
    LB[i] = { ...LB[i], ...entry };
  } else {
    LB[i].avatar=P.avatar;
    LB[i].avatarDataUrl=P.avatar;
  }
  LB.sort((a,b)=>b.score-a.score);
  if(LB.length>50) LB.length=50;
  writeLB();
}

function myRank(){
  const i=LB.findIndex(e=>(e.name||e.nickname)===P.name);
  return i===-1?LB.length+1:i+1;
}

function esc(s){
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderLB(){
  const pod=document.getElementById('podium');
  const tbl=document.getElementById('lb-tbl');
  if(!LB.length){
    pod.innerHTML='';
    tbl.innerHTML='<div class="lb-empty">No wizards yet. Be the first! 🪄</div>';
    return;
  }
  const top=LB.slice(0,Math.min(3,LB.length));
  const medals=['👑','🥈','🥉'],cls=['pod1','pod2','pod3'];
  pod.innerHTML=top.map((e,i)=>`
    <div class="pod ${cls[i]}">
      <div class="pod-crown">${medals[i]}</div>
      <img class="pod-av" src="${e.avatar}" alt="">
      <div class="pod-nm">${esc(e.name||e.nickname)}</div>
      <div class="pod-sc">${e.score.toLocaleString()}</div>
    </div>`).join('');

  const rest=LB.slice(3);
  if(!rest.length){ tbl.innerHTML=''; return; }
  tbl.innerHTML=rest.map((e,i)=>{
    const rk=i+4, isMe=e.name===P.name;
    return `<div class="lb-row${isMe?' me':''}">
      <span class="lb-rk rn">#${rk}</span>
      <img class="lb-av" src="${e.avatar}" alt="">
      <span class="lb-nm">${esc(e.name||e.nickname)}</span>
      <span class="lb-sc">${e.score.toLocaleString()}</span>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────────
   MODAL
───────────────────────────────────────── */
function askRestart(){ document.getElementById('modal').classList.add('open'); }
function closeModal(){ document.getElementById('modal').classList.remove('open'); }
function doRestart(){ closeModal(); initGame(); }

function showImgModal(dataUrl, fileName){
  const modal = document.getElementById('img-modal');
  const img = document.getElementById('img-modal-img');
  if(!modal || !img) return;

  img.src = dataUrl;

  // Normalize modal content so older cached HTML never shows legacy helper text
  // or extra download buttons under the preview.
  let btnWrap = modal.querySelector('.img-modal-btns');
  if(!btnWrap){
    btnWrap = document.createElement('div');
    modal.appendChild(btnWrap);
  }
  btnWrap.className = 'img-modal-btns img-modal-btns--single';
  btnWrap.innerHTML = '<button class="img-modal-cl" onclick="document.getElementById(\'img-modal\').classList.remove(\'open\')">✕ Close</button>';

  Array.from(modal.children).forEach(node => {
    if(node !== img && node !== btnWrap) node.remove();
  });

  modal.classList.add('open');
}

/* ══════════════════════════════════════════
   ████████╗███████╗████████╗██████╗ ██╗███████╗
      ██╔══╝██╔════╝   ██╔══╝██╔══██╗██║██╔════╝
      ██║   █████╗     ██║   ██████╔╝██║███████╗
      ██║   ██╔══╝     ██║   ██╔══██╗██║╚════██║
      ██║   ███████╗   ██║   ██║  ██║██║███████║
      ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚══════╝
══════════════════════════════════════════ */

/* ── CONSTANTS ── */
const COLS=10, ROWS=20;
let CELL=28;

// Auto-drop interval in ms for each level (1-20)
// Aggressive early curve: fast ramp from level 1→5, then steep
const SPEEDS=[
/*1*/ 700, /*2*/ 540, /*3*/ 410, /*4*/ 300, /*5*/ 215,
/*6*/ 155, /*7*/ 110, /*8*/  80, /*9*/  58, /*10*/ 42,
/*11*/30,  /*12*/22,  /*13*/16,  /*14*/12,  /*15*/ 9,
/*16*/7,   /*17*/5,   /*18*/4,   /*19*/3,   /*20*/ 2
];

// Points for 1/2/3/4 line clears (×level)
// NOTE: no soft-drop or hard-drop score — avoids exploits
const LINE_PTS=[0, 100, 300, 600, 1000];

// Lines needed to advance each level (cumulative)
// Level-up every 5 lines cleared
const LINES_PER_LEVEL=5;

/* ── PIECE DATA ── */
// Spawn shapes as minimal bounding boxes
const PIECES={
  I:{ sh:[[1,1,1,1]],       col:'#00F5D4', shadow:'#007A6A' },
  O:{ sh:[[1,1],[1,1]],     col:'#FFC700', shadow:'#8B6E00' },
  T:{ sh:[[0,1,0],[1,1,1]], col:'#9B72FF', shadow:'#4A2B9A' },
  S:{ sh:[[0,1,1],[1,1,0]], col:'#00E878', shadow:'#006B35' },
  Z:{ sh:[[1,1,0],[0,1,1]], col:'#FF3A5C', shadow:'#8B0020' },
  J:{ sh:[[1,0,0],[1,1,1]], col:'#3D8EFF', shadow:'#0A3A8A' },
  L:{ sh:[[0,0,1],[1,1,1]], col:'#FF7A2F', shadow:'#8B3500' },
};
const PKEYS=Object.keys(PIECES);

/* ── STATE ── */
// board[r][c] = '' (empty) | piece-key (e.g. 'I') | 'FL' (flash)
let board;
let cur;    // {key, sh, row, col}
let nxt;    // next piece
let score, lines, level;
// State: 'idle'|'play'|'pause'|'anim'|'over'
let state='idle';
let dropAcc=0, lastTs=0, animId=null;
let canvas, ctx, ncv, nctx;

/* ── INIT ── */
function initGame(){
  // Kill any existing loop
  if(animId){ cancelAnimationFrame(animId); animId=null; }
  stopDAS(); stopSD(); endR();

  canvas = document.getElementById('gc');
  ncv    = document.getElementById('nc');

  // Compute CELL size to fit screen
  const maxH = window.innerHeight - 160;
  const maxW = Math.min(window.innerWidth * 0.52, 290);
  CELL = Math.max(18, Math.min(32, Math.floor(Math.min(maxH/ROWS, maxW/COLS))));
  canvas.width  = COLS * CELL;
  canvas.height = ROWS * CELL;
  ctx  = canvas.getContext('2d');
  nctx = ncv.getContext('2d');

  // Reset state
  board   = Array.from({length:ROWS}, () => Array(COLS).fill(''));
  score   = 0;
  lines   = 0;
  level   = 1;
  dropAcc = 0;
  lastTs  = 0;
  state   = 'play';

  cur = spawnPiece(rndKey());
  nxt = spawnPiece(rndKey());

  document.getElementById('pov').style.display='none';
  const pauseBtn = document.getElementById('btn-pause');
  if(pauseBtn) pauseBtn.textContent='⏸ Pause';

  updateHUD();
  renderNext();
  render();

  animId = requestAnimationFrame(loop);
}

function rndKey(){
  return PKEYS[Math.floor(Math.random()*PKEYS.length)];
}

/* ── SPAWN ── */
function spawnPiece(key){
  const sh = PIECES[key].sh.map(r => [...r]);
  const col = Math.floor((COLS - sh[0].length) / 2);
  // Spawn with top row AT row 0 — piece appears immediately at top of board.
  // Multi-row pieces have bottom rows at 1,2… which is correct Tetris behavior.
  const row = 0;
  return { key, sh, row, col };
}

/* ── COLLISION ──
   Returns true if piece (with given row/col/shape) overlaps walls, floor, or locked cells.
   Cells ABOVE the board (nr < 0) are allowed unless they go over the left/right walls.
*/
function collides(row, col, sh){
  for(let r=0; r<sh.length; r++){
    for(let c=0; c<sh[r].length; c++){
      if(!sh[r][c]) continue;
      const nr = row + r;
      const nc = col + c;
      if(nc < 0 || nc >= COLS)        return true; // walls
      if(nr >= ROWS)                   return true; // floor
      if(nr >= 0 && board[nr][nc]!=='') return true; // locked cell
    }
  }
  return false;
}

/* ── GAME LOOP ── */
function loop(ts){
  if(state==='over'){ animId=null; return; }
  animId = requestAnimationFrame(loop);

  // First frame: just record timestamp, don't advance
  if(lastTs === 0){ lastTs=ts; return; }

  const dt = Math.min(ts - lastTs, 200); // cap at 200ms (handles tab-switch)
  lastTs = ts;

  if(state !== 'play') return;

  dropAcc += dt;
  const spd = SPEEDS[Math.min(level-1, SPEEDS.length-1)];

  // Process accumulated ticks (important at high speeds so nothing is skipped)
  while(dropAcc >= spd && state==='play'){
    dropAcc -= spd;
    autoStep();
  }

  render();
}

/* ── AUTO STEP (gravity) ── */
function autoStep(){
  if(!collides(cur.row+1, cur.col, cur.sh)){
    cur.row++;
  } else {
    lock();
  }
}

/* ── LOCK ── */
function lock(){
  // 1. Write piece cells to board
  for(let r=0; r<cur.sh.length; r++){
    for(let c=0; c<cur.sh[r].length; c++){
      if(!cur.sh[r][c]) continue;
      const nr = cur.row + r;
      if(nr < 0) continue;           // above visible area — skip
      board[nr][cur.col + c] = cur.key;
    }
  }

  // 2. Top-out: if any locked cell ended up above row 2, game is over
  //    (row 0 and 1 being occupied means the stack reached the ceiling)
  let toppedOut = false;
  for(let c=0; c<COLS; c++){
    if(board[0][c] !== '' || board[1][c] !== ''){ toppedOut=true; break; }
  }

  // 3. Find complete rows
  const full = [];
  for(let r=0; r<ROWS; r++){
    if(board[r].every(v => v !== '' && v !== 'FL')) full.push(r);
  }

  if(full.length > 0){
    state = 'anim';
    full.forEach(r => { for(let c=0;c<COLS;c++) board[r][c]='FL'; });
    render();
    setTimeout(() => finishClear(full), 120);
  } else if(toppedOut){
    gameOver();
  } else {
    nextPiece();
  }
}

/* ── FINISH LINE CLEAR ── */
function finishClear(full){
  // CRITICAL: splice ALL rows first (descending so indices stay valid),
  // THEN prepend empty rows. Interleaving splice+unshift shifts indices mid-loop!
  full.sort((a,b) => b-a);
  for(const r of full) board.splice(r, 1);          // remove all full rows
  const n = full.length;
  for(let i=0;i<n;i++) board.unshift(Array(COLS).fill('')); // add n empty rows at top

  // Safety: ensure board always has exactly ROWS rows
  while(board.length < ROWS) board.unshift(Array(COLS).fill(''));
  while(board.length > ROWS) board.shift();

  const pts = LINE_PTS[n] * level;
  score += pts;
  lines += n;
  level  = Math.min(Math.floor(lines / LINES_PER_LEVEL) + 1, 20);
  if(score > P.best) P.best = score;

  updateHUD();
  state = 'play';
  dropAcc = 0;
  nextPiece();
}

/* ── NEXT PIECE ── */
function nextPiece(){
  cur = nxt;
  nxt = spawnPiece(rndKey());
  dropAcc = 0;

  // If spawn position is immediately blocked → game over
  if(collides(cur.row, cur.col, cur.sh)){
    gameOver(); return;
  }

  renderNext();
  render();
}

/* ── MOVEMENTS ── */

// Move left
function mvL(){
  if(state !== 'play') return;
  if(!collides(cur.row, cur.col-1, cur.sh)){ cur.col--; render(); }
}

// Move right
function mvR(){
  if(state !== 'play') return;
  if(!collides(cur.row, cur.col+1, cur.sh)){ cur.col++; render(); }
}

// Soft drop: move down 1 row manually.
// Resets dropAcc so gravity timer restarts from 0.
// NO score added (prevents spam-↓ exploit).
function softDrop(){
  if(state !== 'play') return;
  if(!collides(cur.row+1, cur.col, cur.sh)){
    cur.row++;
    dropAcc = 0; // reset gravity so piece doesn't immediately lock
    render();
  } else {
    lock();
  }
}

// Hard drop: instantly drop to bottom.
// Awards 2 points per row dropped.
function hardDrop(){
  if(state !== 'play') return;
  let dropped = 0;
  while(!collides(cur.row+1, cur.col, cur.sh)){
    cur.row++;
    dropped++;
  }
  // Only add score for hard drop (not spam-able since piece locks immediately)
  score += dropped * 2;
  if(score > P.best) P.best = score;
  updateHUD();
  lock();
}

// Rotate CW with wall-kick
function rotateCW(){
  if(state !== 'play') return;
  const ns = rotateShapeCW(cur.sh);
  tryRotate(ns);
}

// Rotate CCW
function rotateCCW(){
  if(state !== 'play') return;
  const ns = rotateShapeCW(rotateShapeCW(rotateShapeCW(cur.sh)));
  tryRotate(ns);
}

// Wall-kick offsets to try in order
const KICK_TESTS=[
  [0,0], [0,-1],[0,1],[0,-2],[0,2],
  [-1,0],[-1,-1],[-1,1],
  [1,0], [1,-1],[1,1]
];

function tryRotate(ns){
  for(const [dr,dc] of KICK_TESTS){
    if(!collides(cur.row+dr, cur.col+dc, ns)){
      cur.row += dr;
      cur.col += dc;
      cur.sh  = ns;
      render();
      return;
    }
  }
  // Cannot rotate at all — silently fail
}

// Rotate matrix 90° clockwise
function rotateShapeCW(sh){
  const R=sh.length, C=sh[0].length;
  return Array.from({length:C}, (_,i) =>
    Array.from({length:R}, (_,j) => sh[R-1-j][i])
  );
}

/* ── RENDER ── */
function render(){
  if(!ctx) return;
  ctx.clearRect(0,0, canvas.width, canvas.height);

  // --- Grid ---
  ctx.strokeStyle = 'rgba(0,245,212,.03)';
  ctx.lineWidth = 1;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++)
    ctx.strokeRect(c*CELL, r*CELL, CELL, CELL);

  // --- Ghost piece (only when playing) ---
  if(state==='play' && cur){
    let gr = cur.row;
    while(!collides(gr+1, cur.col, cur.sh)) gr++;
    if(gr > cur.row){
      ctx.globalAlpha = 0.1;
      drawPiece(ctx, cur.col, gr, cur.sh, cur.key);
      ctx.globalAlpha = 1;
    }
  }

  // --- Board cells ---
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const v = board[r][c];
      if(v) drawCell(ctx, c*CELL, r*CELL, v, CELL);
    }
  }

  // --- Active piece (only during play, NOT anim — during anim it's already locked on board) ---
  if(cur && state==='play'){
    // Only draw cells that are within the visible board
    cur.sh.forEach((row,r) => row.forEach((v,c) => {
      if(!v) return;
      const nr = cur.row+r;
      if(nr >= 0) drawCell(ctx, (cur.col+c)*CELL, nr*CELL, cur.key, CELL);
    }));
  }

  ctx.shadowBlur = 0;
}

function drawPiece(cx, col, row, sh, key){
  sh.forEach((srow,r) => srow.forEach((v,c) => {
    if(!v) return;
    const nr = row+r;
    if(nr >= 0) drawCell(cx, (col+c)*CELL, nr*CELL, key, CELL);
  }));
}

function drawCell(cx, x, y, key, sz){
  if(key === 'FL'){
    cx.shadowColor='#00F5D4'; cx.shadowBlur=24;
    cx.fillStyle='rgba(255,255,255,.95)';
    cx.fillRect(x, y, sz, sz);
    cx.shadowColor='#fff'; cx.shadowBlur=10;
    cx.fillStyle='rgba(200,255,250,.8)';
    cx.fillRect(x+1, y+1, sz-2, sz-2);
    cx.shadowBlur=0;
    return;
  }
  const p = PIECES[key];
  if(!p) return;

  const pad = 1;
  const inner = sz - pad * 2;

  const g = cx.createLinearGradient(x, y, x+sz, y+sz);
  g.addColorStop(0, p.col + 'EE');
  g.addColorStop(0.55, p.col);
  g.addColorStop(1, p.shadow + 'CC');
  cx.fillStyle = g;
  cx.fillRect(x+pad, y+pad, inner, inner);

  cx.shadowColor = p.col;
  cx.shadowBlur = 7;
  cx.fillRect(x+pad, y+pad, inner, inner);
  cx.shadowBlur = 0;

  cx.fillStyle = 'rgba(255,255,255,0.55)';
  cx.fillRect(x+pad, y+pad, inner, 2);
  cx.fillStyle = 'rgba(255,255,255,0.28)';
  cx.fillRect(x+pad, y+pad+2, 2, inner-2);

  cx.fillStyle = 'rgba(0,0,0,0.45)';
  cx.fillRect(x+pad, y+sz-pad-2, inner, 2);
  cx.fillRect(x+sz-pad-2, y+pad, 2, inner-2);

  const shine = cx.createRadialGradient(x+pad+2, y+pad+2, 0, x+pad+4, y+pad+4, sz*0.5);
  shine.addColorStop(0, 'rgba(255,255,255,0.38)');
  shine.addColorStop(0.4, 'rgba(255,255,255,0.08)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = shine;
  cx.fillRect(x+pad, y+pad, inner, inner);

  cx.strokeStyle = 'rgba(0,0,0,0.35)';
  cx.lineWidth = 0.5;
  cx.strokeRect(x+pad+0.5, y+pad+0.5, inner-1, inner-1);
}

function renderNext(){
  if(!nctx || !nxt) return;
  nctx.clearRect(0,0, ncv.width, ncv.height);
  const sh=nxt.sh, cs=14;
  const ox=Math.floor((ncv.width  - sh[0].length*cs)/2);
  const oy=Math.floor((ncv.height - sh.length   *cs)/2);
  sh.forEach((row,r) => row.forEach((v,c) => {
    if(!v) return;
    drawCell(nctx, ox+c*cs, oy+r*cs, nxt.key, cs);
  }));
  nctx.shadowBlur=0;
}

/* ── HUD ── */
function updateHUD(){
  document.getElementById('h-sc').textContent = score.toLocaleString();
  document.getElementById('h-bs').textContent = P.best.toLocaleString();
  document.getElementById('h-ln').textContent = lines;
  document.getElementById('h-lv').textContent = level;
  const pct = ((lines % LINES_PER_LEVEL) / LINES_PER_LEVEL * 100).toFixed(1);
  document.getElementById('lbar-f').style.width = pct+'%';
}

/* ── GAME OVER ── */
function gameOver(){
  state='over';
  try { saveLB(); } catch {}
  const rank = myRank();
  document.getElementById('oc-sc').textContent = score.toLocaleString();
  document.getElementById('oc-bs').textContent = P.best.toLocaleString();
  document.getElementById('oc-ln').textContent = lines;
  document.getElementById('oc-lv').textContent = level;
  document.getElementById('oc-rnk').textContent = `🏆 Rank #${rank}`;
  setTimeout(() => nav('pg-over'), 180);
}

function playAgain(){ nav('pg-game'); initGame(); }

/* ── DOWNLOAD RESULT – Console Style ── */
const MAGIC_LOGO_B64='assets/logo.webp';
function downloadResult(){
  const W=560, H=700;
  const cv=document.createElement('canvas');
  cv.width=W; cv.height=H;
  const cx=cv.getContext('2d');
  const rr=(x,y,w,h,r)=>roundRect(cx,x,y,w,h,r);

  /* ══ CONSOLE BODY ══ */
  const bodyGrad=cx.createLinearGradient(0,0,W,H);
  bodyGrad.addColorStop(0,'#130536');
  bodyGrad.addColorStop(.5,'#0a021e');
  bodyGrad.addColorStop(1,'#04010E');
  cx.fillStyle=bodyGrad;
  rr(0,0,W,H,36); cx.fill();

  // Neon border glow
  cx.save();
  cx.shadowColor='rgba(176,110,255,.55)'; cx.shadowBlur=30;
  const brd=cx.createLinearGradient(0,0,W,H);
  brd.addColorStop(0,'#7C3AED'); brd.addColorStop(.28,'#FF3EA5');
  brd.addColorStop(.58,'#22EEFF'); brd.addColorStop(1,'#FFD700');
  cx.strokeStyle=brd; cx.lineWidth=4;
  rr(2,2,W-4,H-4,35); cx.stroke();
  cx.restore();

  // Subtle color overlay
  const ov=cx.createLinearGradient(0,0,0,H);
  ov.addColorStop(0,'rgba(124,58,237,.09)');
  ov.addColorStop(.5,'rgba(0,0,0,0)');
  ov.addColorStop(1,'rgba(255,60,165,.06)');
  cx.fillStyle=ov; rr(2,2,W-4,H-4,35); cx.fill();

  // Ambient glows to avoid empty space in the lower half
  [
    {x:92,y:520,r:120,c:'rgba(124,58,237,.16)'},
    {x:280,y:520,r:138,c:'rgba(176,110,255,.12)'},
    {x:468,y:520,r:118,c:'rgba(34,238,255,.12)'}
  ].forEach(g=>{
    const rg=cx.createRadialGradient(g.x,g.y,0,g.x,g.y,g.r);
    rg.addColorStop(0,g.c);
    rg.addColorStop(.45,g.c.replace('.12','.06').replace('.16','.08'));
    rg.addColorStop(1,'rgba(0,0,0,0)');
    cx.fillStyle=rg;
    cx.beginPath();
    cx.arc(g.x,g.y,g.r,0,Math.PI*2);
    cx.fill();
  });

  /* ══ SHOULDER BUTTONS ══ */
  cx.fillStyle='rgba(80,28,165,.55)';
  cx.strokeStyle='rgba(176,110,255,.42)'; cx.lineWidth=2;
  // Left
  cx.beginPath();
  cx.moveTo(40,4); cx.lineTo(162,4); cx.lineTo(162,30); cx.lineTo(40,44);
  cx.arcTo(4,44,4,36,10); cx.lineTo(4,12); cx.arcTo(4,4,12,4,10);
  cx.closePath(); cx.fill(); cx.stroke();
  // Right
  cx.beginPath();
  cx.moveTo(W-40,4); cx.lineTo(W-162,4); cx.lineTo(W-162,30); cx.lineTo(W-40,44);
  cx.arcTo(W-4,44,W-4,36,10); cx.lineTo(W-4,12); cx.arcTo(W-4,4,W-12,4,10);
  cx.closePath(); cx.fill(); cx.stroke();

  /* ══ LOGO SECTION ══ */
  const blkPalette=['#7C3AED','#FF3EA5','#22EEFF','#FFD700','#c084fc'];
  const blkSz=9;
  [[16,48],[16,59],[27,48],[16,70],[27,59]].forEach(([bx,by],i)=>{
    cx.fillStyle=blkPalette[i%5]+'aa';
    cx.fillRect(bx,by,blkSz,blkSz);
    cx.strokeStyle='rgba(255,255,255,.15)'; cx.lineWidth=.5;
    cx.strokeRect(bx,by,blkSz,blkSz);
  });
  [[W-25,48],[W-25,59],[W-36,48],[W-25,70],[W-36,59]].forEach(([bx,by],i)=>{
    cx.fillStyle=blkPalette[(i+2)%5]+'aa';
    cx.fillRect(bx,by,blkSz,blkSz);
    cx.strokeStyle='rgba(255,255,255,.15)'; cx.lineWidth=.5;
    cx.strokeRect(bx,by,blkSz,blkSz);
  });

  /* ══ SCREEN BEZEL ══ */
  const SX=28, SY=100, SW=W-56, SH=256;
  cx.fillStyle='#000008';
  rr(SX-10,SY-10,SW+20,SH+20,18); cx.fill();
  cx.strokeStyle='rgba(90,38,160,.6)'; cx.lineWidth=2;
  rr(SX-10,SY-10,SW+20,SH+20,18); cx.stroke();

  const scrBg=cx.createLinearGradient(SX,SY,SX,SY+SH);
  scrBg.addColorStop(0,'#070215'); scrBg.addColorStop(1,'#020010');
  cx.fillStyle=scrBg; rr(SX,SY,SW,SH,10); cx.fill();

  cx.save();
  cx.shadowColor='rgba(34,238,255,.15)'; cx.shadowBlur=28;
  cx.strokeStyle='rgba(34,238,255,.12)'; cx.lineWidth=1;
  rr(SX,SY,SW,SH,10); cx.stroke();
  cx.restore();

  cx.save(); cx.globalAlpha=.022;
  for(let y=SY;y<SY+SH;y+=4){ cx.fillStyle='#fff'; cx.fillRect(SX,y,SW,1); }
  cx.restore();

  const shine=cx.createLinearGradient(SX+40,0,SX+SW-40,0);
  shine.addColorStop(0,'transparent');
  shine.addColorStop(.5,'rgba(180,120,255,.65)');
  shine.addColorStop(1,'transparent');
  cx.strokeStyle=shine; cx.lineWidth=1;
  cx.beginPath(); cx.moveTo(SX+40,SY+2); cx.lineTo(SX+SW-40,SY+2); cx.stroke();

  /* ── SCREEN CONTENT ── */
  cx.save();
  cx.shadowColor='rgba(255,60,165,.65)'; cx.shadowBlur=18;
  cx.font='bold 30px Orbitron,monospace';
  const goG=cx.createLinearGradient(0,0,W,0);
  goG.addColorStop(0,'#FF3EA5'); goG.addColorStop(.5,'#c084fc'); goG.addColorStop(1,'#22EEFF');
  cx.fillStyle=goG; cx.textAlign='center';
  cx.fillText('GAME OVER', W/2, SY+38);
  cx.restore();

  const rnkEl=document.getElementById('oc-rnk');
  const rnkTxt=rnkEl?rnkEl.textContent:'🏆 RANK #1';
  cx.save();
  cx.font='bold 12px Orbitron,monospace';
  cx.fillStyle='#FFD700';
  cx.shadowColor='rgba(255,215,0,.6)'; cx.shadowBlur=12;
  cx.textAlign='center';
  cx.fillText(rnkTxt, W/2, SY+58);
  cx.restore();

  const avSrc=P.avatar;
  const infoGroupW=286;
  const infoGroupX=SX + Math.round((SW-infoGroupW)/2);
  const avX=infoGroupX+40, avY=SY+160, avR=40;

  function drawGlowPill(x,y,w,h,c1,c2,a=.18){
    const g=cx.createLinearGradient(x,y,x+w,y+h);
    g.addColorStop(0,c1.replace(')',`,`+a+')').replace('rgb','rgba'));
    g.addColorStop(1,c2.replace(')',`,`+(a*.55)+')').replace('rgb','rgba'));
    cx.fillStyle=g;
    rr(x,y,w,h,h/2); cx.fill();
  }

  function drawLegendGroup(title,x,y,w){
    cx.save();
    cx.font='700 10px Nunito,sans-serif';
    cx.textAlign='center';
    const titleG=cx.createLinearGradient(x,0,x+w,0);
    titleG.addColorStop(0,'rgba(176,110,255,.2)');
    titleG.addColorStop(.5,'rgba(255,255,255,.9)');
    titleG.addColorStop(1,'rgba(34,238,255,.2)');
    cx.fillStyle='rgba(22,8,50,.72)';
    rr(x,y,w,22,11); cx.fill();
    cx.strokeStyle='rgba(176,110,255,.25)'; cx.lineWidth=1;
    rr(x,y,w,22,11); cx.stroke();
    cx.fillStyle=titleG;
    cx.fillText(title, x+w/2, y+15);
    cx.restore();
  }

  function drawStats(){
    cx.font='bold 13px Orbitron,monospace';
    cx.fillStyle='#e2d9f3'; cx.textAlign='left';
    cx.fillText(P.name||'Wizard', SX+110, SY+88);

    const stats=[
      {label:'SCORE',val:score.toLocaleString(),color:'#e2d9f3'},
      {label:'BEST', val:P.best.toLocaleString(),color:'#FFD700'},
      {label:'LINES',val:String(lines),           color:'#c084fc'},
      {label:'LEVEL',val:String(level),           color:'#22EEFF'},
    ];
    const stX=SX+110, stY=SY+100, cW=100, rH=48;
    stats.forEach((s,i)=>{
      const col=i%2, row=Math.floor(i/2);
      const bx=stX+col*cW, by=stY+row*rH;
      cx.fillStyle='rgba(255,255,255,.05)';
      rr(bx,by,88,40,7); cx.fill();
      cx.strokeStyle='rgba(180,120,255,.25)'; cx.lineWidth=1;
      rr(bx,by,88,40,7); cx.stroke();
      cx.font='700 7px Nunito,sans-serif';
      cx.fillStyle='#7B6AA8'; cx.textAlign='left';
      cx.fillText(s.label,bx+8,by+12);
      cx.save();
      cx.font='bold 16px Orbitron,monospace';
      cx.fillStyle=s.color;
      if(s.color==='#FFD700'){cx.shadowColor='rgba(255,215,0,.5)';cx.shadowBlur=8;}
      cx.fillText(s.val,bx+8,by+32);
      cx.restore();
    });

    const now=new Date();
    const ds=now.toLocaleDateString('en-US',{day:'2-digit',month:'2-digit',year:'numeric'});
    cx.font='600 9px Nunito,sans-serif';
    cx.fillStyle='rgba(123,106,168,.6)'; cx.textAlign='right';
    cx.fillText(ds, SX+SW-10, SY+SH-8);
    cx.font='600 9px Nunito,sans-serif';
    cx.fillStyle='rgba(180,120,255,.5)'; cx.textAlign='left';
    cx.fillText('magic-tetris.game', SX+10, SY+SH-8);

    /* ══ CONTROLS SECTION ══ */
    const cY=SY+SH+12;
    const panelX=14, panelY=cY+8, panelW=W-28, panelH=H-cY-22;

    cx.save();
    const sepG=cx.createLinearGradient(20,0,W-20,0);
    sepG.addColorStop(0,'transparent');
    sepG.addColorStop(.3,'rgba(176,110,255,.35)');
    sepG.addColorStop(.7,'rgba(34,238,255,.3)');
    sepG.addColorStop(1,'transparent');
    cx.strokeStyle=sepG; cx.lineWidth=1.5;
    cx.shadowColor='rgba(176,110,255,.4)'; cx.shadowBlur=6;
    cx.beginPath(); cx.moveTo(20,cY); cx.lineTo(W-20,cY); cx.stroke();
    cx.restore();

    cx.save();
    cx.fillStyle='rgba(30,8,70,.38)';
    rr(panelX,panelY,panelW,panelH,16); cx.fill();
    cx.strokeStyle='rgba(100,50,200,.22)'; cx.lineWidth=1;
    rr(panelX,panelY,panelW,panelH,16); cx.stroke();
    cx.restore();

    const stripG=cx.createLinearGradient(30,0,W-30,0);
    stripG.addColorStop(0,'transparent');
    stripG.addColorStop(.2,'rgba(124,58,237,.15)');
    stripG.addColorStop(.5,'rgba(34,238,255,.08)');
    stripG.addColorStop(.8,'rgba(255,60,165,.15)');
    stripG.addColorStop(1,'transparent');
    cx.fillStyle=stripG;
    cx.fillRect(30,cY+16,W-60,3);

    // Group glows + titles
    drawLegendGroup('MOVE', 36, cY+28, 108);
    drawLegendGroup('SYSTEM', W/2-58, cY+28, 116);
    drawLegendGroup('ACTIONS', W-144, cY+28, 108);

    /* D-pad */
    const dpCX=92, dpCY=cY+122, dpS=32;
    cx.save();
    cx.shadowColor='rgba(124,58,237,.7)'; cx.shadowBlur=26;
    [
      [dpCX-dpS/2, dpCY-dpS*1.5, dpS, dpS],
      [dpCX-dpS/2, dpCY+dpS/2,   dpS, dpS],
      [dpCX-dpS*1.5,dpCY-dpS/2,  dpS, dpS],
      [dpCX+dpS/2, dpCY-dpS/2,   dpS, dpS],
      [dpCX-dpS/2, dpCY-dpS/2,   dpS, dpS],
    ].forEach(([dx,dy,dw,dh],idx)=>{
      const btnG=cx.createLinearGradient(dx,dy,dx+dw,dy+dh);
      btnG.addColorStop(0,'rgba(72,26,146,.98)');
      btnG.addColorStop(1,'rgba(22,5,66,.98)');
      cx.fillStyle=btnG;
      rr(dx,dy,dw,dh,7); cx.fill();
      cx.strokeStyle=idx===4?'rgba(255,255,255,.24)':'rgba(176,110,255,.62)';
      cx.lineWidth=2;
      rr(dx,dy,dw,dh,7); cx.stroke();
    });
    cx.restore();
    cx.font='bold 16px sans-serif';
    cx.fillStyle='rgba(220,190,255,.92)'; cx.textAlign='center'; cx.textBaseline='middle';
    cx.fillText('▲',dpCX,dpCY-dpS);
    cx.fillText('▼',dpCX,dpCY+dpS);
    cx.fillText('◀',dpCX-dpS,dpCY);
    cx.fillText('▶',dpCX+dpS,dpCY);
    cx.textBaseline='alphabetic';
    cx.font='700 11px Nunito,sans-serif';
    cx.fillStyle='rgba(180,140,255,.9)';
    cx.fillText('D-PAD',dpCX,dpCY+78);
    cx.font='600 9px Nunito,sans-serif';
    cx.fillStyle='rgba(150,120,215,.72)';
    cx.fillText('Move pieces',dpCX,dpCY+94);

    /* Center: SELECT / HOME / START */
    const cbY=cY+122;
    cx.save();
    cx.shadowColor='rgba(176,110,255,.8)'; cx.shadowBlur=24;
    const homeR=20;
    const homeG=cx.createRadialGradient(W/2,cbY,0,W/2,cbY,homeR);
    homeG.addColorStop(0,'rgba(176,110,255,.88)');
    homeG.addColorStop(1,'rgba(70,20,150,.9)');
    cx.fillStyle=homeG;
    cx.beginPath(); cx.arc(W/2,cbY,homeR,0,Math.PI*2); cx.fill();
    cx.strokeStyle='rgba(220,180,255,.82)'; cx.lineWidth=2.4;
    cx.beginPath(); cx.arc(W/2,cbY,homeR,0,Math.PI*2); cx.stroke();
    cx.font='bold 12px Orbitron,monospace';
    cx.fillStyle='rgba(255,245,255,.96)';
    cx.textAlign='center'; cx.textBaseline='middle';
    cx.fillText('◉',W/2,cbY+1);
    cx.restore();

    [{dx:-46,label:'SEL'},{dx:46,label:'STA'}].forEach(({dx,label})=>{
      const x=W/2+dx, r=13;
      cx.save();
      cx.shadowColor='rgba(124,58,237,.45)'; cx.shadowBlur=16;
      const miniG=cx.createRadialGradient(x,cbY+8,0,x,cbY+8,r);
      miniG.addColorStop(0,'rgba(95,36,188,.92)');
      miniG.addColorStop(1,'rgba(32,10,78,.96)');
      cx.fillStyle=miniG;
      cx.beginPath(); cx.arc(x,cbY+8,r,0,Math.PI*2); cx.fill();
      cx.strokeStyle='rgba(176,110,255,.58)'; cx.lineWidth=1.8;
      cx.beginPath(); cx.arc(x,cbY+8,r,0,Math.PI*2); cx.stroke();
      cx.font='bold 7px Orbitron,monospace';
      cx.fillStyle='rgba(240,230,255,.88)';
      cx.textAlign='center'; cx.textBaseline='middle';
      cx.fillText(label,x,cbY+8);
      cx.restore();
    });

    ['SELECT','HOME','START'].forEach((lbl,i)=>{
      const offsets=[-46,0,46];
      cx.font=i===1?'700 9px Nunito,sans-serif':'600 9px Nunito,sans-serif';
      cx.fillStyle=i===1?'rgba(220,200,255,.9)':'rgba(170,140,230,.72)';
      cx.textAlign='center';
      cx.fillText(lbl,W/2+offsets[i],cbY+42);
    });
    cx.font='600 9px Nunito,sans-serif';
    cx.fillStyle='rgba(150,120,215,.72)';
    cx.fillText('Game controls',W/2,cbY+58);

    /* A/B/X/Y buttons */
    const abX=W-102, abY=cY+96, r=19;
    [{k:'A',dx:24,dy:0,col:'#22EEFF'},{k:'B',dx:50,dy:24,col:'#FF3EA5'},
     {k:'X',dx:-2, dy:24,col:'#7C3AED'},{k:'Y',dx:24,dy:50,col:'#FFD700'}]
    .forEach(({k,dx,dy,col})=>{
      const bx=abX+dx, by=abY+dy;
      cx.save();
      cx.shadowColor=col+'99'; cx.shadowBlur=24;
      const btnG=cx.createRadialGradient(bx-2,by-2,0,bx,by,r+2);
      btnG.addColorStop(0,col+'66');
      btnG.addColorStop(1,col+'14');
      cx.fillStyle=btnG;
      cx.beginPath(); cx.arc(bx,by,r,0,Math.PI*2); cx.fill();
      cx.strokeStyle=col+'e8'; cx.lineWidth=2.4;
      cx.beginPath(); cx.arc(bx,by,r,0,Math.PI*2); cx.stroke();
      cx.font='bold 14px Orbitron,monospace';
      cx.fillStyle=col; cx.textAlign='center'; cx.textBaseline='middle';
      cx.fillText(k,bx,by+1);
      cx.restore();
    });
    cx.textBaseline='alphabetic';
    cx.font='700 11px Nunito,sans-serif';
    cx.fillStyle='rgba(230,220,255,.92)';
    cx.textAlign='center';
    cx.fillText('A / B / X / Y', abX+24, cY+180);
    cx.font='600 9px Nunito,sans-serif';
    cx.fillStyle='rgba(150,120,215,.72)';
    cx.fillText('Rotate & drop', abX+24, cY+196);

    // Decorative connector lines to reduce empty space
    cx.save();
    cx.strokeStyle='rgba(176,110,255,.14)';
    cx.lineWidth=1;
    [[148,cY+122,190,cY+122],[370,cY+122,418,cY+122],[148,cY+168,190,cY+168],[370,cY+168,418,cY+168]].forEach(([x1,y1,x2,y2])=>{
      cx.beginPath(); cx.moveTo(x1,y1); cx.lineTo(x2,y2); cx.stroke();
    });
    cx.restore();

    /* Speaker grilles */
    const spkY=H-52;
    cx.save();
    for(let row=0;row<3;row++){
      for(let col=0;col<6;col++){
        cx.fillStyle='rgba(176,110,255,.26)';
        cx.shadowColor='rgba(176,110,255,.3)'; cx.shadowBlur=4;
        cx.beginPath(); cx.arc(42+col*12,spkY+row*10,4,0,Math.PI*2); cx.fill();
        cx.beginPath(); cx.arc(W-42-col*12,spkY+row*10,4,0,Math.PI*2); cx.fill();
      }
    }
    cx.restore();

    cx.font='600 8px Nunito,sans-serif';
    cx.fillStyle='rgba(176,110,255,.22)';
    cx.textAlign='center';
    cx.fillText('magic-tetris.game', W/2, H-18);

    const dataUrl = cv.toDataURL('image/png');
    const fileName = `magic-tetris-${P.name||'player'}-${score}.png`;

    try {
      const a = document.createElement('a');
      a.download = fileName;
      a.href = dataUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch(e){}

    showImgModal(dataUrl, fileName);
  }

  function drawLogo(logoImg){
    if(logoImg){
      const maxW=236, maxH=92;
      const iw=logoImg.naturalWidth || maxW;
      const ih=logoImg.naturalHeight || maxH;
      const scale=Math.min(maxW/iw, maxH/ih);
      const lW=Math.max(1, Math.round(iw*scale));
      const lH=Math.max(1, Math.round(ih*scale));
      const lX=Math.round((W-lW)/2);
      const lY=8;
      cx.save();
      cx.shadowColor='rgba(176,110,255,.55)'; cx.shadowBlur=24;
      cx.drawImage(logoImg,lX,lY,lW,lH);
      cx.restore();
    } else {
      cx.save();
      cx.shadowColor='rgba(176,110,255,.9)'; cx.shadowBlur=26;
      cx.font='bold 14px Orbitron,monospace';
      const lgG=cx.createLinearGradient(W/2-120,0,W/2+120,0);
      lgG.addColorStop(0,'#B06EFF'); lgG.addColorStop(.5,'#22EEFF'); lgG.addColorStop(1,'#FF3EA5');
      cx.fillStyle=lgG; cx.textAlign='center';
      cx.fillText('✦ MAGIC TETRIS ✦', W/2, 68);
      cx.restore();
    }
    const dotPal=['#7C3AED','#FF3EA5','#22EEFF','#FFD700','#c084fc','#22EEFF','#FF3EA5'];
    [-90,-60,-30,0,30,60,90].forEach((dx,i)=>{
      cx.fillStyle=dotPal[i];
      cx.beginPath(); cx.arc(W/2+dx,92,2.2,0,Math.PI*2); cx.fill();
    });
    if(avSrc && avSrc.length>10){
      const img=new Image();
      img.onload=()=>drawAvatarCircle(img);
      img.onerror=()=>drawAvatarCircle(null);
      img.src=avSrc;
    } else {
      drawAvatarCircle(null);
    }
  }

  function drawAvatarCircle(imgEl){
    cx.save();
    cx.beginPath(); cx.arc(avX,avY,avR,0,Math.PI*2); cx.clip();
    if(imgEl){
      cx.drawImage(imgEl,avX-avR,avY-avR,avR*2,avR*2);
    } else {
      cx.fillStyle='rgba(40,10,80,.9)'; cx.fill();
      cx.font=`${avR}px serif`; cx.textAlign='center'; cx.textBaseline='middle';
      cx.fillText('🧙',avX,avY+3);
      cx.textBaseline='alphabetic';
    }
    cx.restore();
    const ring=cx.createLinearGradient(avX-avR,avY-avR,avX+avR,avY+avR);
    ring.addColorStop(0,'#7C3AED'); ring.addColorStop(.5,'#FF3EA5'); ring.addColorStop(1,'#22EEFF');
    cx.strokeStyle=ring; cx.lineWidth=3;
    cx.beginPath(); cx.arc(avX,avY,avR+1.5,0,Math.PI*2); cx.stroke();
    drawStats();
  }

  const logoImg = new Image();
  logoImg.onload = ()=>drawLogo(logoImg);
  logoImg.onerror = ()=>drawLogo(null);
  logoImg.src = MAGIC_LOGO_B64;
}

function roundRect(cx,x,y,w,h,r){
  cx.beginPath();
  cx.moveTo(x+r,y);
  cx.lineTo(x+w-r,y); cx.arcTo(x+w,y,x+w,y+r,r);
  cx.lineTo(x+w,y+h-r); cx.arcTo(x+w,y+h,x+w-r,y+h,r);
  cx.lineTo(x+r,y+h); cx.arcTo(x,y+h,x,y+h-r,r);
  cx.lineTo(x,y+r); cx.arcTo(x,y,x+r,y,r);
  cx.closePath();
}

/* ── PAUSE ── */
function togglePause(){
  if(state==='over' || state==='anim' || state==='idle') return;
  const pauseBtn = document.getElementById('btn-pause');
  if(state==='play'){
    state='pause';
    document.getElementById('pov').style.display='flex';
    if(pauseBtn) pauseBtn.textContent='▶ Resume';
  } else if(state==='pause'){
    state='play';
    lastTs=0; // prevents dt spike
    document.getElementById('pov').style.display='none';
    if(pauseBtn) pauseBtn.textContent='⏸ Pause';
  }
}

/* ─────────────────────────────────────────
   DAS – Delayed Auto Shift for LEFT / RIGHT
   + soft-drop repeat for DOWN
───────────────────────────────────────── */
let dasDir=null, dasTO=null, dasIV=null;
let sdTO=null, sdIV=null;   // soft-drop repeat timers

function startDAS(dir){
  if(dasDir===dir) return;
  stopDAS();
  dasDir=dir;
  const fn = dir==='L' ? mvL : mvR;
  fn();
  dasTO = setTimeout(()=>{ dasIV=setInterval(fn, 36); }, 150);
}
function stopDAS(){
  clearTimeout(dasTO); clearInterval(dasIV);
  dasTO=dasIV=null; dasDir=null;
}

// Hold ↓ = repeated softDrop with a short initial delay
function startSD(){
  stopSD();
  softDrop();
  sdTO = setTimeout(()=>{ sdIV=setInterval(softDrop, 50); }, 140);
}
function stopSD(){
  clearTimeout(sdTO); clearInterval(sdIV);
  sdTO=sdIV=null;
}

/* ─────────────────────────────────────────
   KEYBOARD
───────────────────────────────────────── */
const heldKeys = new Set();

document.addEventListener('keydown', e=>{
  if(!document.getElementById('pg-game').classList.contains('on')) return;

  if(e.key==='p'||e.key==='P'||e.key==='Escape'){
    e.preventDefault(); togglePause(); return;
  }

  if(state!=='play') return;

  // For L/R: block OS repeat (handled by DAS)
  // For Down/rotate/space: let first keydown through each time; Down uses its own repeat
  const isLR = e.key==='ArrowLeft' || e.key==='ArrowRight';
  if(isLR && heldKeys.has(e.code)) return;
  heldKeys.add(e.code);

  switch(e.key){
    case 'ArrowLeft':  e.preventDefault(); startDAS('L'); break;
    case 'ArrowRight': e.preventDefault(); startDAS('R'); break;
    case 'ArrowDown':  e.preventDefault(); startSD();     break;
    case 'ArrowUp':    e.preventDefault(); rotateCW();    break;
    case 'x': case 'X': rotateCW();  break;
    case 'z': case 'Z': rotateCCW(); break;
    case ' ':          e.preventDefault(); hardDrop();    break;
  }
});

document.addEventListener('keyup', e=>{
  heldKeys.delete(e.code);
  if(e.key==='ArrowLeft'  && dasDir==='L') stopDAS();
  if(e.key==='ArrowRight' && dasDir==='R') stopDAS();
  if(e.key==='ArrowDown')                  stopSD();
});

/* ─────────────────────────────────────────
   MOBILE D-PAD
───────────────────────────────────────── */
let repTO=null, repIV=null;

function tap(e, action){
  if(e) e.preventDefault();
  if(action==='rcw')  rotateCW();
  if(action==='rccw') rotateCCW();
  if(action==='hd')   hardDrop();
}

function begR(e, dir){
  if(e) e.preventDefault();
  endR();
  const fn = dir==='L' ? mvL : dir==='R' ? mvR : softDrop;
  fn();
  repTO = setTimeout(()=>{ repIV=setInterval(fn,42); }, 160);
}
function endR(){
  clearTimeout(repTO); clearInterval(repIV);
  repTO=repIV=null;
}
