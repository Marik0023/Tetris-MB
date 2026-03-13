'use strict';

/* ─────────────────────────────────────────
   STARS + PARTICLES
───────────────────────────────────────── */
;(function(){
  // Minimal sharp stars
  const s=document.getElementById('stars');
  for(let i=0;i<55;i++){
    const el=document.createElement('div');
    el.className='st';
    const sz=Math.random()*1.2+0.2;
    el.style.cssText=`width:${sz}px;height:${sz}px;`+
      `left:${Math.random()*100}%;top:${Math.random()*100}%;`+
      `animation:tw ${2+Math.random()*6}s ${Math.random()*8}s infinite;`;
    s.appendChild(el);
  }
})();

/* ─────────────────────────────────────────
   ANIMATED BACKGROUND — falling tetrominos
───────────────────────────────────────── */
;(function(){
  const cv = document.getElementById('bg-cv');
  if(!cv) return;
  const cx = cv.getContext('2d');

  const SHAPES = [
    [[1,1,1,1]],                   // I
    [[1,1],[1,1]],                  // O
    [[0,1,0],[1,1,1]],             // T
    [[1,0],[1,0],[1,1]],           // L
    [[0,1],[0,1],[1,1]],           // J
    [[0,1,1],[1,1,0]],             // S
    [[1,1,0],[0,1,1]],             // Z
  ];
  const COLS_BG = ['#00F5D4','#9B72FF','#FFC700','#FF3A5C','#3D8EFF','#00E878','#FF7A2F'];

  let W, H;
  function resize(){ W=cv.width=window.innerWidth; H=cv.height=window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  // Create pieces
  const pieces = Array.from({length: 14}, () => {
    const si = Math.floor(Math.random()*SHAPES.length);
    return {
      sh: SHAPES[si],
      col: COLS_BG[si],
      x: Math.random()*window.innerWidth,
      y: Math.random()*window.innerHeight*2 - window.innerHeight,
      speed: 0.12 + Math.random()*0.22,
      rot: Math.random()*Math.PI*2,
      rotSpeed: (Math.random()-0.5)*0.004,
      sz: 10 + Math.random()*12,
      alpha: 0.04 + Math.random()*0.07,
      drift: (Math.random()-0.5)*0.04,
    };
  });

  function drawBgPiece(p){
    cx.save();
    cx.translate(p.x, p.y);
    cx.rotate(p.rot);
    cx.globalAlpha = p.alpha;
    p.sh.forEach((row, r) => {
      row.forEach((v, c) => {
        if(!v) return;
        const bx = (c - p.sh[0].length/2) * (p.sz+1);
        const by = (r - p.sh.length/2) * (p.sz+1);
        cx.strokeStyle = p.col;
        cx.lineWidth = 0.8;
        cx.strokeRect(bx, by, p.sz, p.sz);
        cx.fillStyle = p.col + '18';
        cx.fillRect(bx, by, p.sz, p.sz);
      });
    });
    cx.restore();
  }

  function bgLoop(){
    cx.clearRect(0, 0, W, H);
    pieces.forEach(p => {
      p.y += p.speed;
      p.x += p.drift;
      p.rot += p.rotSpeed;
      if(p.y > H + 80) {
        p.y = -80;
        p.x = Math.random() * W;
      }
      drawBgPiece(p);
    });
    requestAnimationFrame(bgLoop);
  }
  bgLoop();
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
/* ─────────────────────────────────────────
   SUPABASE — Global Leaderboard
───────────────────────────────────────── */
const SB_URL = 'https://havwsarcfpyiwyitpasq.supabase.co';
const SB_KEY = 'sb_publishable_orLD_bHxYWr4UeYFBLaqAA_35qJAv62';
const SB_HDR = {
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json'
};

const P={name:'',avatar:'',best:0};
let LB=[];          // cached from Supabase
let lbFrom='pg-start';

async function fetchLB(){
  try{
    const res=await fetch(
      SB_URL+'/rest/v1/leaderboard?select=name,score,lines,level,created_at&order=score.desc&limit=50',
      {headers:SB_HDR}
    );
    if(res.ok) LB=await res.json();
  }catch{}
}

async function fetchPlayerBest(name){
  try{
    const res=await fetch(
      SB_URL+'/rest/v1/leaderboard?select=score&name=eq.'+encodeURIComponent(name)+'&limit=1',
      {headers:SB_HDR}
    );
    if(res.ok){
      const d=await res.json();
      return d[0]?.score||0;
    }
  }catch{}
  return 0;
}

async function saveLB(){
  if(!P.name||!P.best) return;
  try{
    // Only save if this is a new personal best
    const cur=await fetchPlayerBest(P.name);
    if(P.best<=cur) return;
    await fetch(SB_URL+'/rest/v1/leaderboard',{
      method:'POST',
      headers:{...SB_HDR,'Prefer':'resolution=merge-duplicates'},
      body:JSON.stringify({name:P.name, score:P.best, lines, level})
    });
    await fetchLB();
  }catch{}
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
      <img class="pod-av" src="${makeAvatar(e.name)}" alt="">
      <div class="pod-nm">${esc(e.name)}</div>
      <div class="pod-sc">${Number(e.score).toLocaleString()}</div>
    </div>`).join('');

  const rest=LB.slice(3);
  if(!rest.length){ tbl.innerHTML=''; return; }
  tbl.innerHTML=rest.map((e,i)=>{
    const rk=i+4, isMe=e.name===P.name;
    return `<div class="lb-row${isMe?' me':''}">
      <span class="lb-rk rn">#${rk}</span>
      <img class="lb-av" src="${makeAvatar(e.name)}" alt="">
      <span class="lb-nm">${esc(e.name)}</span>
      <span class="lb-sc">${Number(e.score).toLocaleString()}</span>
    </div>`;
  }).join('');
}
function savePlayerProfile(){
  try { localStorage.setItem(PLAYER_KEY, JSON.stringify({name:P.name, avatar:P.avatar||''})); } catch {}
}
function loadPlayerProfile(){
  try {
    const data=JSON.parse(localStorage.getItem(PLAYER_KEY)||'null');
    if(!data) return;
    P.name=data.name||'';
    P.avatar=data.avatar||'';
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

async function openLB(from){
  lbFrom=from;
  nav('pg-lb');
  document.getElementById('podium').innerHTML='';
  document.getElementById('lb-tbl').innerHTML='<div class="lb-empty">🌐 Loading global scores…</div>';
  await fetchLB();
  renderLB();
}
function closeLB(){ nav(lbFrom); }

/* ─────────────────────────────────────────
   START
───────────────────────────────────────── */
async function onStart(){
  const nick=document.getElementById('nick').value.trim();
  if(!nick){ document.getElementById('nick').focus(); return; }
  P.name=nick;
  if(!P.avatar) P.avatar=makeAvatar(nick);
  savePlayerProfile();
  applyPlayerProfileToStart();

  // Fetch this player's best score from Supabase
  P.best = await fetchPlayerBest(nick);

  document.getElementById('gh-nm').textContent=nick;
  document.getElementById('gh-av').src=P.avatar;
  document.getElementById('oc-av').src=P.avatar;
  document.getElementById('oc-nm').textContent=nick;

  const lpAv=document.getElementById('lp-av');
  const lpNm=document.getElementById('lp-nm');
  if(lpAv) lpAv.src=P.avatar;
  if(lpNm) lpNm.textContent=nick;

  nav('pg-game');
  initGame();
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
      <img class="pod-av" src="${makeAvatar(e.name||'?')}" alt="">
      <div class="pod-nm">${esc(e.name||e.nickname)}</div>
      <div class="pod-sc">${Number(e.score).toLocaleString()}</div>
    </div>`).join('');

  const rest=LB.slice(3);
  if(!rest.length){ tbl.innerHTML=''; return; }
  tbl.innerHTML=rest.map((e,i)=>{
    const rk=i+4, isMe=e.name===P.name;
    return `<div class="lb-row${isMe?' me':''}">
      <span class="lb-rk rn">#${rk}</span>
      <img class="lb-av" src="${makeAvatar(e.name||'?')}" alt="">
      <span class="lb-nm">${esc(e.name||e.nickname)}</span>
      <span class="lb-sc">${Number(e.score).toLocaleString()}</span>
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
let combo = 0;      // consecutive line-clear streak
let score, lines, level;
// State: 'idle'|'play'|'pause'|'anim'|'over'
let state='idle';
let dropAcc=0, lastTs=0, animId=null;
let canvas, ctx, ncv, nctx;

// Lock delay: piece waits 300ms on ground before locking; resets up to 15x on move/rotate
let lockTO=null, lockResets=0;
const LOCK_DELAY=300, MAX_LOCK_RESETS=15;

function scheduleLock(){
  clearTimeout(lockTO);
  lockTO=setTimeout(()=>{ lockTO=null; if(state==='play') lock(); }, LOCK_DELAY);
}
function resetLockDelay(){
  if(lockTO!==null && lockResets<MAX_LOCK_RESETS){
    lockResets++;
    clearTimeout(lockTO);
    scheduleLock();
  }
}

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
  bag     = [];        // fresh 7-bag
  combo   = 0;
  clearTimeout(lockTO); lockTO=null; lockResets=0;

  cur = spawnPiece(rndKey());
  nxt = spawnPiece(rndKey());

  document.getElementById('pov').style.display='none';
  const pauseBtn = document.getElementById('btn-pause');
  if(pauseBtn) pauseBtn.textContent='⏸ Pause';

  updateHUD();
  renderNext();
  render();
  updateLeftPanel();

  animId = requestAnimationFrame(loop);
}

const LP_TIPS=[
  'Hard drop = 2pts per row',
  'Clear 4 lines for max score',
  'Z/X to rotate CCW/CW',
  'P or Esc to pause game',
  'Speed increases every 5 lines',
  'Combos give bonus points!',
];
let lpTipIdx=0, lpTipTimer=null;

function updateLeftPanel(){
  clearInterval(lpTipTimer);
  lpTipIdx=0;
  const el=document.getElementById('lp-tip');
  if(el) el.textContent=LP_TIPS[0];
  lpTipTimer=setInterval(()=>{
    lpTipIdx=(lpTipIdx+1)%LP_TIPS.length;
    const t=document.getElementById('lp-tip');
    if(t){ t.style.opacity='0'; setTimeout(()=>{t.textContent=LP_TIPS[lpTipIdx];t.style.opacity='1';},200); }
  },4000);
}

/* ── 7-BAG RANDOMIZER ── */
let bag = [];
function rndKey(){
  if(!bag.length){
    bag = [...PKEYS];
    for(let i=bag.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [bag[i],bag[j]]=[bag[j],bag[i]];
    }
  }
  return bag.pop();
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
    // Piece moved down — cancel pending lock timer
    if(lockTO!==null){ clearTimeout(lockTO); lockTO=null; lockResets=0; }
  } else {
    // Grounded — start lock delay if not already ticking
    if(lockTO===null) scheduleLock();
  }
}

/* ── LOCK ── */
function lock(){
  // 1. Write piece cells to board
  for(let r=0; r<cur.sh.length; r++){
    for(let c=0; c<cur.sh[r].length; c++){
      if(!cur.sh[r][c]) continue;
      const nr = cur.row + r;
      if(nr < 0) continue;
      board[nr][cur.col + c] = cur.key;
    }
  }

  // Clear lock delay
  clearTimeout(lockTO); lockTO=null; lockResets=0;
  playSound('lock');

  // Find complete rows
  const full = [];
  for(let r=0; r<ROWS; r++){
    if(board[r].every(v => v !== '' && v !== 'FL')) full.push(r);
  }

  if(full.length > 0){
    state = 'anim';
    full.forEach(r => { for(let c=0;c<COLS;c++) board[r][c]='FL'; });
    render();
    playSound('clear');
    setTimeout(() => finishClear(full), 120);
  } else {
    combo = 0; // no lines → break combo streak
    nextPiece();
  }
}

/* ── FINISH LINE CLEAR ── */
function finishClear(full){
  full.sort((a,b) => b-a);
  for(const r of full) board.splice(r, 1);
  const n = full.length;
  for(let i=0;i<n;i++) board.unshift(Array(COLS).fill(''));

  while(board.length < ROWS) board.unshift(Array(COLS).fill(''));
  while(board.length > ROWS) board.shift();

  combo++;
  const comboBonus = combo > 1 ? (combo-1) * 50 * level : 0;
  const pts = LINE_PTS[n] * level;
  score += pts + comboBonus;
  lines += n;
  level  = Math.min(Math.floor(lines / LINES_PER_LEVEL) + 1, 20);
  if(score > P.best) P.best = score;

  if(combo > 1) showCombo(combo);

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

  // Top-out: spawn position already occupied
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
  if(!collides(cur.row, cur.col-1, cur.sh)){
    cur.col--;
    playSound('move');
    if(lockTO!==null) resetLockDelay();
    render();
  }
}

// Move right
function mvR(){
  if(state !== 'play') return;
  if(!collides(cur.row, cur.col+1, cur.sh)){
    cur.col++;
    playSound('move');
    if(lockTO!==null) resetLockDelay();
    render();
  }
}

// Soft drop
function softDrop(){
  if(state !== 'play') return;
  if(!collides(cur.row+1, cur.col, cur.sh)){
    cur.row++;
    dropAcc = 0;
    if(lockTO!==null){ clearTimeout(lockTO); lockTO=null; lockResets=0; }
    render();
  } else {
    if(lockTO===null) scheduleLock();
  }
}

// Hard drop: instantly drop + 2pts/row
function hardDrop(){
  if(state !== 'play') return;
  clearTimeout(lockTO); lockTO=null; lockResets=0;
  let dropped = 0;
  while(!collides(cur.row+1, cur.col, cur.sh)){
    cur.row++;
    dropped++;
  }
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
      playSound('rotate');
      if(lockTO!==null) resetLockDelay();
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

/* ── COMBO DISPLAY ── */
function showCombo(n){
  const el=document.getElementById('combo-display');
  if(!el) return;
  el.textContent=`${n}× COMBO`;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

/* ── WEB AUDIO ── */
let audioCtx=null;
function getAC(){
  if(!audioCtx) try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){}
  return audioCtx;
}
function playSound(type){
  const ac=getAC(); if(!ac) return;
  try{
    const o=ac.createOscillator(), g=ac.createGain();
    o.connect(g); g.connect(ac.destination);
    const t=ac.currentTime;
    switch(type){
      case 'move':
        o.frequency.setValueAtTime(180,t);
        g.gain.setValueAtTime(0.04,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+0.05);
        o.start(t); o.stop(t+0.05); break;
      case 'rotate':
        o.type='triangle';
        o.frequency.setValueAtTime(340,t);
        g.gain.setValueAtTime(0.055,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+0.07);
        o.start(t); o.stop(t+0.07); break;
      case 'lock':
        o.type='square';
        o.frequency.setValueAtTime(110,t);
        o.frequency.exponentialRampToValueAtTime(55,t+0.09);
        g.gain.setValueAtTime(0.07,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+0.11);
        o.start(t); o.stop(t+0.11); break;
      case 'clear':
        o.frequency.setValueAtTime(440,t);
        o.frequency.exponentialRampToValueAtTime(880,t+0.18);
        g.gain.setValueAtTime(0.13,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+0.24);
        o.start(t); o.stop(t+0.24); break;
      case 'over':
        o.type='sawtooth';
        o.frequency.setValueAtTime(280,t);
        o.frequency.exponentialRampToValueAtTime(40,t+0.65);
        g.gain.setValueAtTime(0.1,t);
        g.gain.exponentialRampToValueAtTime(0.001,t+0.65);
        o.start(t); o.stop(t+0.65); break;
    }
  }catch(e){}
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
  clearTimeout(lockTO); lockTO=null; lockResets=0;
  clearInterval(lpTipTimer); lpTipTimer=null;
  playSound('over');
  try { saveLB(); } catch {} // async, saves to Supabase in background
  const rank = myRank();
  document.getElementById('oc-sc').textContent = score.toLocaleString();
  document.getElementById('oc-bs').textContent = P.best.toLocaleString();
  document.getElementById('oc-ln').textContent = lines;
  document.getElementById('oc-lv').textContent = level;
  document.getElementById('oc-rnk').textContent = `🏆 Rank #${rank}`;
  setTimeout(() => nav('pg-over'), 180);
}

function playAgain(){ nav('pg-game'); initGame(); }

/* ── DOWNLOAD RESULT – MONOLITH card ── */
function downloadResult(){
  const W=480, H=580;
  const cv=document.createElement('canvas');
  cv.width=W; cv.height=H;
  const cx=cv.getContext('2d');

  function rr(x,y,w,h,r){ roundRect(cx,x,y,w,h,r); }

  // ── Background ──
  cx.fillStyle='#030308';
  rr(0,0,W,H,20); cx.fill();

  // ── Animated bg tetrominos (drawn statically at random positions) ──
  cx.save();
  const BG_SHAPES=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0],[1,0],[1,1]],[[0,1,1],[1,1,0]]];
  const BG_COLS=['#00F5D4','#9B72FF','#FFC700','#FF3A5C','#3D8EFF','#00E878'];
  const rng=(min,max)=>min+Math.random()*(max-min);
  // Use a seeded-ish layout — deterministic so it looks designed
  const bgPieces=[
    {sh:BG_SHAPES[0],col:BG_COLS[0],x:28,  y:60,  rot:0.3,  sz:9, a:0.055},
    {sh:BG_SHAPES[2],col:BG_COLS[1],x:390, y:40,  rot:-0.5, sz:10,a:0.06},
    {sh:BG_SHAPES[4],col:BG_COLS[2],x:420, y:200, rot:0.8,  sz:8, a:0.05},
    {sh:BG_SHAPES[1],col:BG_COLS[3],x:30,  y:320, rot:0.4,  sz:10,a:0.055},
    {sh:BG_SHAPES[3],col:BG_COLS[4],x:420, y:400, rot:-0.3, sz:9, a:0.045},
    {sh:BG_SHAPES[0],col:BG_COLS[5],x:50,  y:500, rot:0.6,  sz:8, a:0.04},
    {sh:BG_SHAPES[2],col:BG_COLS[0],x:370, y:530, rot:-0.7, sz:9, a:0.05},
    {sh:BG_SHAPES[4],col:BG_COLS[1],x:200, y:20,  rot:1.1,  sz:7, a:0.035},
    {sh:BG_SHAPES[3],col:BG_COLS[2],x:240, y:550, rot:-0.4, sz:8, a:0.04},
  ];
  bgPieces.forEach(p=>{
    cx.save();
    cx.globalAlpha=p.a;
    cx.translate(p.x,p.y); cx.rotate(p.rot);
    p.sh.forEach((row,r)=>row.forEach((v,c)=>{
      if(!v) return;
      const bx=(c-p.sh[0].length/2)*(p.sz+1.5);
      const by=(r-p.sh.length/2)*(p.sz+1.5);
      cx.strokeStyle=p.col; cx.lineWidth=0.9;
      cx.strokeRect(bx,by,p.sz,p.sz);
      cx.fillStyle=p.col+'22'; cx.fillRect(bx,by,p.sz,p.sz);
    }));
    cx.restore();
  });
  cx.restore();

  // Subtle radial glow top-center
  const topGlow=cx.createRadialGradient(W/2,0,0,W/2,0,W*0.75);
  topGlow.addColorStop(0,'rgba(0,245,212,0.1)');
  topGlow.addColorStop(1,'rgba(0,0,0,0)');
  cx.fillStyle=topGlow; rr(0,0,W,H,20); cx.fill();

  // Bottom-right violet glow
  const btGlow=cx.createRadialGradient(W,H,0,W,H,W*0.65);
  btGlow.addColorStop(0,'rgba(155,114,255,0.08)');
  btGlow.addColorStop(1,'rgba(0,0,0,0)');
  cx.fillStyle=btGlow; rr(0,0,W,H,20); cx.fill();

  // ── Outer border ──
  cx.save();
  cx.shadowColor='rgba(0,245,212,0.35)'; cx.shadowBlur=18;
  cx.strokeStyle='rgba(0,245,212,0.5)'; cx.lineWidth=1.5;
  rr(0.75,0.75,W-1.5,H-1.5,20); cx.stroke();
  cx.restore();

  // Top accent line
  const topLine=cx.createLinearGradient(60,0,W-60,0);
  topLine.addColorStop(0,'transparent');
  topLine.addColorStop(0.5,'rgba(0,245,212,0.75)');
  topLine.addColorStop(1,'transparent');
  cx.strokeStyle=topLine; cx.lineWidth=1.5;
  cx.beginPath(); cx.moveTo(60,1); cx.lineTo(W-60,1); cx.stroke();

  // Bottom violet accent
  const btLine=cx.createLinearGradient(80,0,W-80,0);
  btLine.addColorStop(0,'transparent');
  btLine.addColorStop(0.5,'rgba(155,114,255,0.55)');
  btLine.addColorStop(1,'transparent');
  cx.strokeStyle=btLine; cx.lineWidth=1;
  cx.beginPath(); cx.moveTo(80,H-1); cx.lineTo(W-80,H-1); cx.stroke();

  // Corner brackets
  const brkCol='rgba(0,245,212,0.38)';
  cx.strokeStyle=brkCol; cx.lineWidth=1.5;
  [[8,8,1],[W-8,8,-1],[8,H-8,1],[W-8,H-8,-1]].forEach(([bx,by,d])=>{
    cx.beginPath(); cx.moveTo(bx,by+d*18); cx.lineTo(bx,by); cx.lineTo(bx+d*18,by); cx.stroke();
  });

  // ── Subtle grid ──
  cx.save(); cx.globalAlpha=0.022;
  cx.strokeStyle='#00F5D4'; cx.lineWidth=0.5;
  for(let x=0;x<W;x+=32) { cx.beginPath();cx.moveTo(x,0);cx.lineTo(x,H);cx.stroke(); }
  for(let y=0;y<H;y+=32) { cx.beginPath();cx.moveTo(0,y);cx.lineTo(W,y);cx.stroke(); }
  cx.restore();

  // ── LOGO + header text ──
  function drawContent(logoImg){
    // Logo
    if(logoImg){
      const lH2=82, scale=lH2/logoImg.naturalHeight;
      const lW2=Math.round(logoImg.naturalWidth*scale);
      cx.save();
      cx.shadowColor='rgba(0,245,212,0.5)'; cx.shadowBlur=24;
      cx.drawImage(logoImg, Math.round((W-lW2)/2), 16, lW2, lH2);
      cx.restore();
    } else {
      cx.save();
      cx.font='bold 20px monospace';
      cx.fillStyle='#00F5D4';
      cx.shadowColor='rgba(0,245,212,0.5)'; cx.shadowBlur=14;
      cx.textAlign='center';
      cx.fillText('MAGIC TETRIS', W/2, 52);
      cx.restore();
    }

    // Separator dots
    const dotCols=['#00F5D4','#9B72FF','#FFC700','#FF3A5C','#00F5D4'];
    dotCols.forEach((c,i)=>{
      cx.fillStyle=c; cx.globalAlpha=0.6;
      cx.beginPath(); cx.arc(W/2+(i-2)*14, 106, 2, 0, Math.PI*2); cx.fill();
    });
    cx.globalAlpha=1;

    // ── GAME OVER label ──
    cx.save();
    cx.font='bold 32px "Bebas Neue",cursive,monospace';
    cx.shadowColor='rgba(255,58,92,0.5)'; cx.shadowBlur=20;
    cx.fillStyle='#FF3A5C'; cx.textAlign='center';
    cx.fillText('GAME OVER', W/2, 140);
    cx.restore();

    // ── Avatar circle ──
    const avX=W/2, avY=200, avR=38;
    cx.save();
    cx.shadowColor='rgba(0,245,212,0.5)'; cx.shadowBlur=24;
    cx.strokeStyle='rgba(0,245,212,0.7)'; cx.lineWidth=2;
    cx.beginPath(); cx.arc(avX,avY,avR+2,0,Math.PI*2); cx.stroke();
    cx.restore();

    function finishCard(imgEl){
      // Draw avatar
      cx.save();
      cx.beginPath(); cx.arc(avX,avY,avR,0,Math.PI*2); cx.clip();
      if(imgEl){
        cx.drawImage(imgEl, avX-avR, avY-avR, avR*2, avR*2);
      } else {
        cx.fillStyle='#07070F';
        cx.fill();
        cx.font=`${avR*0.9}px serif`;
        cx.textAlign='center'; cx.textBaseline='middle';
        cx.fillText('🧙', avX, avY+2);
        cx.textBaseline='alphabetic';
      }
      cx.restore();

      // Player name
      cx.font='bold 13px "JetBrains Mono",monospace';
      cx.fillStyle='#EDEAF8'; cx.textAlign='center';
      cx.fillText(P.name||'Wizard', W/2, 258);

      // ── Stats grid 2×2 ──
      const stats=[
        {label:'SCORE', val:score.toLocaleString(), col:'#EDEAF8'},
        {label:'BEST',  val:P.best.toLocaleString(), col:'#FFC700'},
        {label:'LINES', val:String(lines),  col:'#9B72FF'},
        {label:'LEVEL', val:String(level),  col:'#00F5D4'},
      ];
      const gx=40, gy=274, gw=(W-80-10)/2, gh=72, gGap=10;
      stats.forEach((st,i)=>{
        const col=i%2, row=Math.floor(i/2);
        const bx=gx+col*(gw+gGap), by=gy+row*(gh+gGap);

        // Card bg
        cx.fillStyle='rgba(0,0,0,0.4)';
        rr(bx,by,gw,gh,4); cx.fill();
        cx.strokeStyle='rgba(0,245,212,0.1)';
        cx.lineWidth=1;
        rr(bx,by,gw,gh,4); cx.stroke();

        // Top accent
        cx.strokeStyle=st.col+'55'; cx.lineWidth=1;
        cx.beginPath(); cx.moveTo(bx+12,by+0.5); cx.lineTo(bx+gw-12,by+0.5); cx.stroke();

        // Label
        cx.font='700 8px monospace';
        cx.fillStyle='rgba(74,72,104,0.9)';
        cx.textAlign='left';
        cx.fillText(st.label, bx+12, by+19);

        // Value
        cx.save();
        cx.font='bold 22px "JetBrains Mono",monospace';
        cx.fillStyle=st.col;
        if(st.col==='#FFC700'){ cx.shadowColor='rgba(255,199,0,0.4)'; cx.shadowBlur=10; }
        if(st.col==='#00F5D4'){ cx.shadowColor='rgba(0,245,212,0.4)'; cx.shadowBlur=8; }
        cx.fillText(st.val, bx+12, by+52);
        cx.restore();
      });

      // ── Divider ──
      const divY=gy+gh*2+gGap*2+8;
      const divG=cx.createLinearGradient(40,0,W-40,0);
      divG.addColorStop(0,'transparent');
      divG.addColorStop(0.5,'rgba(0,245,212,0.2)');
      divG.addColorStop(1,'transparent');
      cx.strokeStyle=divG; cx.lineWidth=1;
      cx.beginPath(); cx.moveTo(40,divY); cx.lineTo(W-40,divY); cx.stroke();

      // ── Footer ──
      const footY=divY+20;
      const now=new Date();
      const ds=now.toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'});

      cx.font='600 9px monospace';
      cx.fillStyle='rgba(0,245,212,0.3)';
      cx.textAlign='left';
      cx.fillText('magic-tetris.game', 44, footY);

      cx.fillStyle='rgba(74,72,104,0.7)';
      cx.textAlign='right';
      cx.fillText(ds, W-44, footY);

      // ── Export ──
      const dataUrl=cv.toDataURL('image/png');
      const fileName=`magic-tetris-${P.name||'player'}-${score}.png`;
      try{
        const a=document.createElement('a');
        a.download=fileName; a.href=dataUrl;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }catch(e){}
      showImgModal(dataUrl, fileName);
    }

    const avSrc=P.avatar;
    if(avSrc && avSrc.length>10){
      const img=new Image();
      img.onload=()=>finishCard(img);
      img.onerror=()=>finishCard(null);
      img.src=avSrc;
    } else {
      finishCard(null);
    }
  }

  const logoImg=new Image();
  logoImg.onload=()=>drawContent(logoImg);
  logoImg.onerror=()=>drawContent(null);
  logoImg.src='assets/logo.webp';
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
