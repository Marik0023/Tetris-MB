'use strict';

/* ─────────────────────────────────────────
   STARS + PARTICLES
───────────────────────────────────────── */
;(function(){
  // Stars
  const s=document.getElementById('stars');
  for(let i=0;i<120;i++){
    const el=document.createElement('div');
    el.className='st';
    const sz=Math.random()*2+.2;
    el.style.cssText=`width:${sz}px;height:${sz}px;`+
      `left:${Math.random()*100}%;top:${Math.random()*100}%;`+
      `animation:tw ${1.5+Math.random()*4}s ${Math.random()*7}s infinite;`;
    s.appendChild(el);
  }
  // Floating particles
  const p=document.getElementById('pts');
  const pcols=['#7C3AED','#FF3EA5','#22EEFF','#a855f7','#FFD700'];
  for(let i=0;i<18;i++){
    const el=document.createElement('div');
    el.className='pt';
    const sz=Math.random()*5+2;
    el.style.cssText=`width:${sz}px;height:${sz}px;`+
      `left:${Math.random()*100}%;`+
      `background:${pcols[i%pcols.length]};`+
      `opacity:.5;`+
      `animation:ptdrift ${12+Math.random()*18}s ${Math.random()*10}s linear infinite;`+
      `filter:blur(${sz>5?1:0}px);`;
    p.appendChild(el);
  }
})();

/* ─────────────────────────────────────────
   LOGO
───────────────────────────────────────── */
const LOGO_PATH='assets/logo.webp';
const PROFILE_KEY='mt2_profile';
const LOGO=LOGO_PATH;
document.getElementById('logo-s').src=LOGO;
document.getElementById('logo-g').src=LOGO;

/* ─────────────────────────────────────────
   PLAYER STATE & LEADERBOARD
───────────────────────────────────────── */
const P={name:'',avatar:'',best:0};
let LB=JSON.parse(localStorage.getItem('mt2_lb')||'[]');
let lbFrom='pg-start'; // which page opened leaderboard

function getStartCard(){
  return document.querySelector('.start-card');
}

function saveProfile(name=P.name, avatar=P.avatar){
  const safeName=(name||'').trim();
  const data={ name:safeName, avatar:avatar||'' };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
  applyProfileToStartUI(data);
}

function applyProfileToStartUI(profile){
  const nickInput=document.getElementById('nick');
  const avImg=document.getElementById('av-img');
  const avIco=document.getElementById('av-ico');
  const sub=document.querySelector('.start-card .sub');
  const card=getStartCard();

  if(profile?.name){
    nickInput.value=profile.name;
  }
  if(profile?.avatar){
    avImg.src=profile.avatar;
    avImg.style.display='block';
    avIco.style.display='none';
  }else{
    avImg.removeAttribute('src');
    avImg.style.display='none';
    avIco.style.display='block';
  }

  const hasSaved=Boolean(profile?.name || profile?.avatar);
  card.classList.toggle('is-saved', hasSaved);
  sub.textContent = hasSaved ? 'Your profile is ready on this device' : 'Choose your player identity';
}

function restoreProfile(){
  try{
    const raw=localStorage.getItem(PROFILE_KEY);
    if(!raw) return;
    const saved=JSON.parse(raw);
    if(!saved || typeof saved!=='object') return;

    if(saved.name){
      P.name=saved.name.trim();
    }
    if(saved.avatar){
      P.avatar=saved.avatar;
    }else if(saved.name){
      P.avatar=makeAvatar(saved.name);
    }
    applyProfileToStartUI({name:P.name, avatar:P.avatar});
  }catch(err){
    console.warn('Could not restore saved profile.', err);
  }
}

function syncPlayerUI(){
  document.getElementById('gh-nm').textContent=P.name;
  document.getElementById('gh-av').src=P.avatar;
  document.getElementById('oc-av').src=P.avatar;
  document.getElementById('oc-nm').textContent=P.name;
}

// Load avatar from file
document.getElementById('av-in').addEventListener('change',function(e){
  const f=e.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    P.avatar=ev.target.result;
    const currentName=document.getElementById('nick').value.trim()||P.name;
    applyProfileToStartUI({name:currentName, avatar:P.avatar});
    saveProfile(currentName, P.avatar);
  };
  reader.readAsDataURL(f);
});

document.getElementById('nick').addEventListener('change',()=>{
  const nextName=document.getElementById('nick').value.trim();
  if(!nextName) return;
  if(!P.avatar) P.avatar=makeAvatar(nextName);
  saveProfile(nextName, P.avatar);
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

restoreProfile();

/* ─────────────────────────────────────────
   START
───────────────────────────────────────── */
function onStart(){
  const nick=document.getElementById('nick').value.trim();
  if(!nick){ document.getElementById('nick').focus(); return; }
  P.name=nick;
  if(!P.avatar) P.avatar=makeAvatar(nick);

  saveProfile(P.name, P.avatar);

  const ex=LB.find(e=>e.name===nick);
  P.best=ex?ex.score:0;

  syncPlayerUI();
  nav('pg-game');
  initGame();
}

/* ─────────────────────────────────────────
   LB helpers
───────────────────────────────────────── */
function saveLB(){
  const i=LB.findIndex(e=>e.name===P.name);
  if(i===-1){
    LB.push({name:P.name,avatar:P.avatar,score:P.best});
  } else {
    if(P.best>LB[i].score) LB[i].score=P.best;
    LB[i].avatar=P.avatar;
  }
  LB.sort((a,b)=>b.score-a.score);
  if(LB.length>50) LB.length=50;
  localStorage.setItem('mt2_lb',JSON.stringify(LB));
}

function myRank(){
  const i=LB.findIndex(e=>e.name===P.name);
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
      <div class="pod-nm">${esc(e.name)}</div>
      <div class="pod-sc">${e.score.toLocaleString()}</div>
    </div>`).join('');

  const rest=LB.slice(3);
  if(!rest.length){ tbl.innerHTML=''; return; }
  tbl.innerHTML=rest.map((e,i)=>{
    const rk=i+4, isMe=e.name===P.name;
    return `<div class="lb-row${isMe?' me':''}">
      <span class="lb-rk rn">#${rk}</span>
      <img class="lb-av" src="${e.avatar}" alt="">
      <span class="lb-nm">${esc(e.name)}</span>
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

function triggerDownload(dataUrl, fileName){
  const a=document.createElement('a');
  a.download=fileName;
  a.href=dataUrl;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
  I:{ sh:[[1,1,1,1]],       col:'#22EEFF', shadow:'#007788' },
  O:{ sh:[[1,1],[1,1]],     col:'#FFE53B', shadow:'#997700' },
  T:{ sh:[[0,1,0],[1,1,1]], col:'#DD22FF', shadow:'#770099' },
  S:{ sh:[[0,1,1],[1,1,0]], col:'#33FF66', shadow:'#007722' },
  Z:{ sh:[[1,1,0],[0,1,1]], col:'#FF2244', shadow:'#880011' },
  J:{ sh:[[1,0,0],[1,1,1]], col:'#3399FF', shadow:'#003388' },
  L:{ sh:[[0,0,1],[1,1,1]], col:'#FF7733', shadow:'#883300' },
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
  document.getElementById('btn-pause').textContent='⏸ Pause';

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
  ctx.strokeStyle = 'rgba(255,255,255,.025)';
  ctx.lineWidth = 1;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++)
    ctx.strokeRect(c*CELL, r*CELL, CELL, CELL);

  // --- Ghost piece (only when playing) ---
  if(state==='play' && cur){
    let gr = cur.row;
    while(!collides(gr+1, cur.col, cur.sh)) gr++;
    if(gr > cur.row){
      ctx.globalAlpha = 0.14;
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
    // Line-clear flash: bright white glow
    cx.shadowColor='#fff'; cx.shadowBlur=18;
    cx.fillStyle='rgba(255,255,255,.95)';
    cx.fillRect(x, y, sz, sz);
    cx.shadowBlur=0;
    return;
  }
  const p = PIECES[key];
  if(!p) return;

  cx.shadowColor = p.col;
  cx.shadowBlur  = 8;

  // Gradient fill
  const g = cx.createLinearGradient(x,y, x+sz,y+sz);
  g.addColorStop(0, p.col);
  g.addColorStop(1, p.shadow);
  cx.fillStyle = g;
  cx.fillRect(x+1, y+1, sz-2, sz-2);

  cx.shadowBlur = 0;

  // Top-left shine
  cx.fillStyle = 'rgba(255,255,255,.18)';
  cx.fillRect(x+2, y+2, sz-4, 3);
  cx.fillRect(x+2, y+2, 3, sz-5);

  // Dark bottom-right edge for 3D feel
  cx.fillStyle = 'rgba(0,0,0,.25)';
  cx.fillRect(x+1, y+sz-3, sz-2, 2);
  cx.fillRect(x+sz-3, y+1, 2, sz-2);

  // Border
  cx.strokeStyle = 'rgba(0,0,0,.4)';
  cx.lineWidth = .5;
  cx.strokeRect(x+.5, y+.5, sz-1, sz-1);
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
  saveLB();
  const rank = myRank();
  document.getElementById('oc-sc').textContent = score.toLocaleString();
  document.getElementById('oc-bs').textContent = P.best.toLocaleString();
  document.getElementById('oc-ln').textContent = lines;
  document.getElementById('oc-lv').textContent = level;
  document.getElementById('oc-rnk').textContent = `🏆 Rank #${rank}`;
  setTimeout(() => nav('pg-over'), 400);
}

function playAgain(){ nav('pg-game'); initGame(); }

/* ── DOWNLOAD RESULT – Console Style ── */
async function downloadResult(){
  const W=1120, H=1460;
  const cv=document.createElement('canvas');
  cv.width=W; cv.height=H;
  const cx=cv.getContext('2d');

  const rr=(x,y,w,h,r)=>{
    cx.beginPath();
    cx.moveTo(x+r,y);
    cx.lineTo(x+w-r,y); cx.arcTo(x+w,y,x+w,y+r,r);
    cx.lineTo(x+w,y+h-r); cx.arcTo(x+w,y+h,x+w-r,y+h,r);
    cx.lineTo(x+r,y+h); cx.arcTo(x,y+h,x,y+h-r,r);
    cx.lineTo(x,y+r); cx.arcTo(x,y,x+r,y,r);
    cx.closePath();
  };

  const fillRound=(x,y,w,h,r,fillStyle)=>{
    rr(x,y,w,h,r);
    cx.fillStyle=fillStyle;
    cx.fill();
  };

  const strokeRound=(x,y,w,h,r,strokeStyle,lineWidth=1)=>{
    rr(x,y,w,h,r);
    cx.strokeStyle=strokeStyle;
    cx.lineWidth=lineWidth;
    cx.stroke();
  };

  const drawGlowDot=(x,y,r,color,alpha=.4)=>{
    cx.save();
    cx.globalAlpha=alpha;
    cx.shadowColor=color;
    cx.shadowBlur=40;
    cx.fillStyle=color;
    cx.beginPath();
    cx.arc(x,y,r,0,Math.PI*2);
    cx.fill();
    cx.restore();
  };

  const loadImage=(src)=>new Promise(resolve=>{
    if(!src){ resolve(null); return; }
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>resolve(null);
    img.src=src;
  });

  const [logoImg, avatarImg] = await Promise.all([
    loadImage(LOGO_PATH),
    loadImage(P.avatar)
  ]);

  const bgGrad=cx.createLinearGradient(0,0,0,H);
  bgGrad.addColorStop(0,'#0d031f');
  bgGrad.addColorStop(.5,'#060112');
  bgGrad.addColorStop(1,'#020009');
  cx.fillStyle=bgGrad;
  cx.fillRect(0,0,W,H);

  drawGlowDot(180,150,110,'#ff3ea5',.22);
  drawGlowDot(W-160,190,120,'#22eeff',.18);
  drawGlowDot(W/2,1280,170,'#7c3aed',.18);

  const shellX=90, shellY=70, shellW=W-180, shellH=H-140;
  const shellGrad=cx.createLinearGradient(shellX,shellY,shellX+shellW,shellY+shellH);
  shellGrad.addColorStop(0,'#20074e');
  shellGrad.addColorStop(.55,'#0d0225');
  shellGrad.addColorStop(1,'#12062f');
  fillRound(shellX,shellY,shellW,shellH,58,shellGrad);

  cx.save();
  cx.shadowColor='rgba(176,110,255,.45)';
  cx.shadowBlur=45;
  const borderGrad=cx.createLinearGradient(shellX,shellY,shellX+shellW,shellY);
  borderGrad.addColorStop(0,'#22eeff');
  borderGrad.addColorStop(.32,'#7c3aed');
  borderGrad.addColorStop(.66,'#ff3ea5');
  borderGrad.addColorStop(1,'#ffd700');
  strokeRound(shellX+4,shellY+4,shellW-8,shellH-8,54,borderGrad,6);
  cx.restore();

  fillRound(shellX+18,shellY+18,shellW-36,shellH-36,48,'rgba(255,255,255,.02)');

  fillRound(shellX+32,shellY-6,210,70,26,'rgba(103,40,198,.45)');
  fillRound(shellX+shellW-242,shellY-6,210,70,26,'rgba(103,40,198,.45)');
  strokeRound(shellX+32,shellY-6,210,70,26,'rgba(196,181,253,.22)',2);
  strokeRound(shellX+shellW-242,shellY-6,210,70,26,'rgba(196,181,253,.22)',2);

  const marqueeX=shellX+210, marqueeY=shellY+34, marqueeW=shellW-420, marqueeH=130;
  const marqueeGrad=cx.createLinearGradient(0,marqueeY,0,marqueeY+marqueeH);
  marqueeGrad.addColorStop(0,'rgba(34,12,80,.95)');
  marqueeGrad.addColorStop(1,'rgba(15,4,42,.95)');
  fillRound(marqueeX,marqueeY,marqueeW,marqueeH,26,marqueeGrad);
  strokeRound(marqueeX,marqueeY,marqueeW,marqueeH,26,'rgba(124,58,237,.35)',2);

  if(logoImg){
    const maxW=360, maxH=104;
    const ratio=Math.min(maxW/logoImg.width, maxH/logoImg.height);
    const lw=logoImg.width*ratio;
    const lh=logoImg.height*ratio;
    const lx=W/2-lw/2;
    const ly=marqueeY+(marqueeH-lh)/2;
    cx.save();
    cx.shadowColor='rgba(176,110,255,.6)';
    cx.shadowBlur=24;
    cx.drawImage(logoImg,lx,ly,lw,lh);
    cx.restore();
  }else{
    cx.font='900 42px Orbitron, sans-serif';
    cx.textAlign='center';
    cx.fillStyle='#f5d774';
    cx.fillText('MAGIC TETRIS', W/2, marqueeY+78);
  }

  const accentBlocks=[
    [shellX+82, shellY+78, '#22eeff'],
    [shellX+108, shellY+78, '#ff3ea5'],
    [shellX+134, shellY+78, '#7c3aed'],
    [shellX+108, shellY+104, '#ffd700'],
    [shellX+134, shellY+104, '#c084fc'],
    [shellX+shellW-108, shellY+78, '#22eeff'],
    [shellX+shellW-134, shellY+78, '#ff3ea5'],
    [shellX+shellW-160, shellY+78, '#7c3aed'],
    [shellX+shellW-134, shellY+104, '#ffd700'],
    [shellX+shellW-160, shellY+104, '#c084fc'],
  ];
  accentBlocks.forEach(([bx,by,color])=>{
    fillRound(bx,by,18,18,4,color);
    strokeRound(bx,by,18,18,4,'rgba(255,255,255,.16)',1);
  });

  const SX=shellX+84, SY=shellY+210, SW=shellW-168, SH=500;
  const bezelGrad=cx.createLinearGradient(SX,SY,SX+SW,SY+SH);
  bezelGrad.addColorStop(0,'#090314');
  bezelGrad.addColorStop(1,'#03000c');
  fillRound(SX-18,SY-18,SW+36,SH+36,34,bezelGrad);
  cx.save();
  cx.shadowColor='rgba(34,238,255,.16)';
  cx.shadowBlur=32;
  strokeRound(SX-18,SY-18,SW+36,SH+36,34,'rgba(34,238,255,.18)',2);
  cx.restore();

  const screenGrad=cx.createLinearGradient(SX,SY,SX,SY+SH);
  screenGrad.addColorStop(0,'#050111');
  screenGrad.addColorStop(1,'#02000a');
  fillRound(SX,SY,SW,SH,24,screenGrad);
  strokeRound(SX,SY,SW,SH,24,'rgba(124,58,237,.22)',1.5);

  cx.save();
  cx.beginPath();
  rr(SX,SY,SW,SH,24);
  cx.clip();

  for(let y=SY+8;y<SY+SH;y+=5){
    cx.fillStyle='rgba(255,255,255,.022)';
    cx.fillRect(SX+6,y,SW-12,1);
  }

  const screenGlow=cx.createLinearGradient(SX,SY,SX+SW,SY);
  screenGlow.addColorStop(0,'rgba(255,62,165,.65)');
  screenGlow.addColorStop(.5,'rgba(196,181,253,.65)');
  screenGlow.addColorStop(1,'rgba(34,238,255,.65)');
  cx.strokeStyle=screenGlow;
  cx.lineWidth=2;
  cx.beginPath();
  cx.moveTo(SX+50,SY+24);
  cx.lineTo(SX+SW-50,SY+24);
  cx.stroke();

  cx.restore();

  cx.save();
  cx.shadowColor='rgba(255,62,165,.5)';
  cx.shadowBlur=26;
  cx.font='900 64px Orbitron, sans-serif';
  const titleGrad=cx.createLinearGradient(SX,SY,SX+SW,SY);
  titleGrad.addColorStop(0,'#ff3ea5');
  titleGrad.addColorStop(.55,'#d8b4fe');
  titleGrad.addColorStop(1,'#22eeff');
  cx.fillStyle=titleGrad;
  cx.textAlign='center';
  cx.fillText('GAME OVER', W/2, SY+92);
  cx.restore();

  const rankLabel=(document.getElementById('oc-rnk')?.textContent || 'Rank #1').replace('🏆 ','');
  fillRound(SX+SW-268,SY+122,208,48,24,'rgba(255,215,0,.1)');
  strokeRound(SX+SW-268,SY+122,208,48,24,'rgba(255,215,0,.34)',1.5);
  cx.font='800 24px Orbitron, sans-serif';
  cx.fillStyle='#ffd700';
  cx.textAlign='center';
  cx.fillText(rankLabel.toUpperCase(), SX+SW-164, SY+154);

  const profileX=SX+64, profileY=SY+146;
  const avR=82;
  cx.save();
  cx.shadowColor='rgba(176,110,255,.36)';
  cx.shadowBlur=18;
  cx.beginPath();
  cx.arc(profileX+avR, profileY+avR, avR, 0, Math.PI*2);
  cx.closePath();
  cx.fillStyle='rgba(25,8,55,.95)';
  cx.fill();
  cx.restore();

  cx.save();
  cx.beginPath();
  cx.arc(profileX+avR, profileY+avR, avR-6, 0, Math.PI*2);
  cx.clip();
  if(avatarImg){
    cx.drawImage(avatarImg, profileX, profileY, avR*2, avR*2);
  }else{
    cx.fillStyle='rgba(40,10,80,.95)';
    cx.fillRect(profileX, profileY, avR*2, avR*2);
    cx.font='700 72px Nunito, sans-serif';
    cx.fillStyle='#ffffff';
    cx.textAlign='center';
    cx.textBaseline='middle';
    cx.fillText((P.name||'P')[0].toUpperCase(), profileX+avR, profileY+avR+4);
    cx.textBaseline='alphabetic';
  }
  cx.restore();

  cx.save();
  cx.strokeStyle='#22eeff';
  cx.lineWidth=6;
  cx.beginPath();
  cx.arc(profileX+avR, profileY+avR, avR+5, 0, Math.PI*2);
  cx.stroke();
  cx.restore();

  cx.font='800 34px Orbitron, sans-serif';
  cx.textAlign='left';
  cx.fillStyle='#f5f3ff';
  cx.fillText((P.name || 'PLAYER').toUpperCase(), SX+54, SY+390);

  cx.font='600 18px Nunito, sans-serif';
  cx.fillStyle='rgba(196,181,253,.78)';
  cx.fillText('magic-tetris.game', SX+54, SY+425);

  const stats=[
    ['SCORE', score.toLocaleString(), '#ffffff'],
    ['BEST', P.best.toLocaleString(), '#ffd700'],
    ['LINES', String(lines), '#d8b4fe'],
    ['LEVEL', String(level), '#22eeff']
  ];
  const cardW=230, cardH=108, gap=22;
  const statsX=SX+330, statsY=SY+194;
  stats.forEach((item,index)=>{
    const col=index%2;
    const row=Math.floor(index/2);
    const bx=statsX+col*(cardW+gap);
    const by=statsY+row*(cardH+gap);
    fillRound(bx,by,cardW,cardH,18,'rgba(255,255,255,.05)');
    strokeRound(bx,by,cardW,cardH,18,'rgba(124,58,237,.26)',1.5);
    cx.font='800 18px Nunito, sans-serif';
    cx.fillStyle='rgba(196,181,253,.75)';
    cx.textAlign='left';
    cx.fillText(item[0], bx+20, by+32);
    cx.save();
    cx.font='900 42px Orbitron, sans-serif';
    cx.fillStyle=item[2];
    cx.shadowColor=item[2];
    cx.shadowBlur=item[2] === '#ffffff' ? 0 : 14;
    cx.fillText(item[1], bx+20, by+78);
    cx.restore();
  });

  const dateStr=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'});
  cx.font='700 18px Nunito, sans-serif';
  cx.fillStyle='rgba(196,181,253,.52)';
  cx.textAlign='left';
  cx.fillText('magic-tetris.game', SX+50, SY+SH-32);
  cx.textAlign='right';
  cx.fillText(dateStr, SX+SW-50, SY+SH-32);

  const CY=SY+SH+44;
  const deckX=SX-4, deckY=CY, deckW=SW+8, deckH=424;
  const deckGrad=cx.createLinearGradient(deckX,deckY,deckX,deckY+deckH);
  deckGrad.addColorStop(0,'rgba(24,8,58,.92)');
  deckGrad.addColorStop(1,'rgba(13,4,34,.88)');
  fillRound(deckX,deckY,deckW,deckH,34,deckGrad);
  strokeRound(deckX,deckY,deckW,deckH,34,'rgba(124,58,237,.24)',2);
  fillRound(deckX+14,deckY+16,deckW-28,deckH-32,28,'rgba(255,255,255,.012)');

  cx.save();
  cx.shadowColor='rgba(34,238,255,.08)';
  cx.shadowBlur=26;
  cx.strokeStyle='rgba(34,238,255,.12)';
  cx.lineWidth=1.5;
  cx.beginPath();
  cx.moveTo(deckX+34,deckY+20);
  cx.lineTo(deckX+deckW-34,deckY+20);
  cx.stroke();
  cx.restore();

  const decoPairs=[
    [deckX+56, deckY+42],
    [deckX+deckW-116, deckY+42],
    [deckX+56, deckY+108],
    [deckX+deckW-116, deckY+108]
  ];
  cx.save();
  cx.globalAlpha=.14;
  const patternColors=['#22eeff','#ff3ea5','#7c3aed','#ffd700'];
  decoPairs.forEach(([px,py], idx)=>{
    fillRound(px,py,24,24,6,patternColors[idx%patternColors.length]);
    fillRound(px+28,py,24,24,6,patternColors[(idx+1)%patternColors.length]);
    fillRound(px,py+28,24,24,6,patternColors[(idx+2)%patternColors.length]);
    fillRound(px+28,py+28,24,24,6,patternColors[(idx+3)%patternColors.length]);
  });
  cx.restore();

  const dividerY=deckY+308;
  cx.save();
  cx.strokeStyle='rgba(196,181,253,.10)';
  cx.lineWidth=1;
  cx.beginPath();
  cx.moveTo(deckX+40, dividerY);
  cx.lineTo(deckX+deckW-40, dividerY);
  cx.stroke();
  cx.restore();

  const centerY=deckY+192;

  const dSize=56;
  const dGap=4;
  const dCenterX=deckX+202;
  const buttonFace=(x,y,w,h,r,glow='rgba(124,58,237,.28)')=>{
    cx.save();
    cx.shadowColor=glow;
    cx.shadowBlur=18;
    const g=cx.createLinearGradient(x,y,x+w,y+h);
    g.addColorStop(0,'rgba(70,28,140,.96)');
    g.addColorStop(1,'rgba(24,8,58,.96)');
    fillRound(x,y,w,h,r,g);
    cx.restore();
    strokeRound(x,y,w,h,r,'rgba(196,181,253,.34)',1.6);
  };

  buttonFace(dCenterX, centerY-(dSize*2+dGap)/2, dSize, dSize, 14);
  buttonFace(dCenterX, centerY+(dGap)/2, dSize, dSize, 14);
  buttonFace(dCenterX-(dSize+dGap), centerY-dSize/2, dSize, dSize, 14);
  buttonFace(dCenterX+(dSize+dGap), centerY-dSize/2, dSize, dSize, 14);
  cx.save();
  cx.shadowColor='rgba(176,110,255,.32)';
  cx.shadowBlur=14;
  fillRound(dCenterX, centerY-dSize/2, dSize, dSize, 14, 'rgba(42,14,92,.96)');
  cx.restore();
  strokeRound(dCenterX, centerY-dSize/2, dSize, dSize, 14, 'rgba(196,181,253,.22)',1.3);

  cx.font='900 24px Orbitron, sans-serif';
  cx.fillStyle='rgba(244,244,255,.92)';
  cx.textAlign='center';
  cx.textBaseline='middle';
  cx.fillText('▲', dCenterX+dSize/2, centerY-dSize/2-dGap/2);
  cx.fillText('▼', dCenterX+dSize/2, centerY+dSize+dGap/2);
  cx.fillText('◀', dCenterX-dGap/2, centerY+dSize/2);
  cx.fillText('▶', dCenterX+dSize+dGap/2, centerY+dSize/2);
  cx.textBaseline='alphabetic';

  const midX=W/2;
  const miniY=centerY+10;
  const drawMini=(x,y,w,h,label)=>{
    cx.save();
    cx.shadowColor='rgba(124,58,237,.16)';
    cx.shadowBlur=10;
    const g=cx.createLinearGradient(x,y,x+w,y+h);
    g.addColorStop(0,'rgba(55,20,110,.95)');
    g.addColorStop(1,'rgba(22,8,52,.95)');
    fillRound(x,y,w,h,h/2,g);
    cx.restore();
    strokeRound(x,y,w,h,h/2,'rgba(196,181,253,.24)',1.4);
    cx.font='900 13px Orbitron, sans-serif';
    cx.fillStyle='rgba(210,190,255,.82)';
    cx.textAlign='center';
    cx.textBaseline='middle';
    cx.fillText(label, x+w/2, y+h/2+1);
    cx.textBaseline='alphabetic';
  };
  drawMini(midX-116, miniY, 66, 26, 'SEL');
  drawMini(midX+50, miniY, 66, 26, 'STA');

  cx.save();
  cx.shadowColor='rgba(176,110,255,.42)';
  cx.shadowBlur=20;
  const homeGrad=cx.createRadialGradient(midX, centerY+8, 0, midX, centerY+8, 48);
  homeGrad.addColorStop(0,'rgba(170,95,255,.95)');
  homeGrad.addColorStop(1,'rgba(28,10,60,.96)');
  cx.fillStyle=homeGrad;
  cx.beginPath();
  cx.arc(midX, centerY+8, 44, 0, Math.PI*2);
  cx.fill();
  cx.restore();
  cx.strokeStyle='rgba(230,220,255,.42)';
  cx.lineWidth=2;
  cx.beginPath();
  cx.arc(midX, centerY+8, 44, 0, Math.PI*2);
  cx.stroke();
  cx.fillStyle='#f5ecff';
  cx.font='900 24px Orbitron, sans-serif';
  cx.textAlign='center';
  cx.textBaseline='middle';
  cx.fillText('•', midX, centerY+8);
  cx.textBaseline='alphabetic';

  const actionCX=deckX+deckW-188;
  const actionCY=centerY+6;
  const br=42;
  const buttons=[
    ['A', actionCX+52, actionCY-44, '#22eeff'],
    ['B', actionCX+108, actionCY+6, '#ff3ea5'],
    ['X', actionCX-4, actionCY+6, '#7c3aed'],
    ['Y', actionCX+52, actionCY+58, '#ffd700']
  ];
  buttons.forEach(([label,x,y,color])=>{
    cx.save();
    cx.shadowColor=color;
    cx.shadowBlur=24;
    const rad=cx.createRadialGradient(x,y,0,x,y,br);
    rad.addColorStop(0,color+'77');
    rad.addColorStop(1,'rgba(18,10,38,.96)');
    cx.fillStyle=rad;
    cx.beginPath();
    cx.arc(x,y,br,0,Math.PI*2);
    cx.fill();
    cx.restore();
    cx.strokeStyle=color;
    cx.lineWidth=3;
    cx.beginPath();
    cx.arc(x,y,br,0,Math.PI*2);
    cx.stroke();
    cx.fillStyle=color;
    cx.font='900 29px Orbitron, sans-serif';
    cx.textAlign='center';
    cx.textBaseline='middle';
    cx.fillText(label,x,y+1);
    cx.textBaseline='alphabetic';
  });

  cx.font='800 16px Orbitron, sans-serif';
  cx.fillStyle='rgba(196,181,253,.74)';
  cx.textAlign='center';
  cx.fillText('MOVE', dCenterX+dSize/2, deckY+360);
  cx.fillText('SELECT', midX-84, deckY+360);
  cx.fillText('HOME', midX, deckY+360);
  cx.fillText('START', midX+84, deckY+360);
  cx.fillText('DROP / ROTATE', actionCX+52, deckY+360);

  const speaker = (xStart, yStart) => {
    for(let row=0; row<4; row++){
      for(let col=0; col<7; col++){
        cx.save();
        cx.shadowColor='rgba(176,110,255,.24)';
        cx.shadowBlur=6;
        cx.fillStyle='rgba(196,181,253,.2)';
        cx.beginPath();
        cx.arc(xStart+col*18, yStart+row*16, 5, 0, Math.PI*2);
        cx.fill();
        cx.restore();
      }
    }
  };
  speaker(SX+42, CY+368);
  speaker(SX+SW-150, CY+368);

  cx.font='800 18px Orbitron, sans-serif';
  cx.textAlign='center';
  cx.fillStyle='rgba(196,181,253,.28)';
  cx.fillText('MAGIC TETRIS', W/2, shellY+shellH-28);

  const dataUrl=cv.toDataURL('image/png');
  const fileName=`magic-tetris-${(P.name||'player').toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${score}.png`;
  triggerDownload(dataUrl, fileName);
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
  if(state==='play'){
    state='pause';
    document.getElementById('pov').style.display='flex';
    document.getElementById('btn-pause').textContent='▶ Resume';
  } else if(state==='pause'){
    state='play';
    lastTs=0; // prevents dt spike
    document.getElementById('pov').style.display='none';
    document.getElementById('btn-pause').textContent='⏸ Pause';
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
