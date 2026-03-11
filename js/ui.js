/**
 * ui.js — Magic Tetris UI Controller
 */

const State = {
  nickname:  '',
  avatarUrl: '',
  bestScore: 0,
  game:      null,
  lastStats: { score: 0, lines: 0, level: 1 },
};

const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ── Particles ──────────────────────────────────────────────────────────────
function initParticles() {
  const container = $('particles-container');
  if (!container) return;
  const colors = ['#8b5cf6','#ffd700','#00f5ff','#ff49db','#39ff14','#ff8c00'];
  const count  = window.innerWidth < 600 ? 25 : 50;
  for (let i=0;i<count;i++) {
    const p=document.createElement('div');
    p.className='particle';
    const size=Math.random()*4+1, color=colors[Math.floor(Math.random()*colors.length)];
    p.style.cssText=`width:${size}px;height:${size}px;background:${color};left:${Math.random()*100}%;animation-duration:${8+Math.random()*12}s;animation-delay:${Math.random()*-15}s;box-shadow:0 0 ${size*2}px ${color};`;
    container.appendChild(p);
  }
}

// ── Setup Screen ───────────────────────────────────────────────────────────
function initSetupScreen() {
  const uploadArea  = $('avatar-upload-area');
  const avatarInput = $('avatar-input');
  const preview     = $('avatar-preview');
  const placeholder = $('avatar-placeholder');

  uploadArea.addEventListener('click',    () => avatarInput.click());
  uploadArea.addEventListener('dragover', e  => { e.preventDefault(); uploadArea.style.borderColor='var(--gold)'; });
  uploadArea.addEventListener('dragleave',()  => { uploadArea.style.borderColor=''; });
  uploadArea.addEventListener('drop',     e  => {
    e.preventDefault(); uploadArea.style.borderColor='';
    const f=e.dataTransfer.files[0];
    if (f&&f.type.startsWith('image/')) loadAvatar(f);
  });
  avatarInput.addEventListener('change',  e  => { const f=e.target.files[0]; if(f) loadAvatar(f); });

  function loadAvatar(file) {
    const reader=new FileReader();
    reader.onload=ev=>{
      State.avatarUrl=ev.target.result;
      preview.src=ev.target.result;
      preview.style.display='block';
      placeholder.style.display='none';
    };
    reader.readAsDataURL(file);
  }

  $('btn-start').addEventListener('click', startGame);
  $('nickname-input').addEventListener('keydown', e => { if(e.key==='Enter') startGame(); });
}

// ── Start Game ─────────────────────────────────────────────────────────────
function startGame() {
  const nick = $('nickname-input').value.trim();
  if (!nick) {
    $('nickname-input').focus();
    $('nickname-input').style.borderColor='#f87171';
    $('nickname-input').style.animation='shake 0.3s ease';
    setTimeout(()=>{ $('nickname-input').style.borderColor=''; $('nickname-input').style.animation=''; },1500);
    return;
  }
  State.nickname  = nick;
  State.bestScore = Leaderboard.getBestScore(nick);
  showScreen('game-screen');
  initGame();
}

function initGame() {
  // Player mini info
  if (State.avatarUrl) {
    $('player-avatar-mini').src=State.avatarUrl;
    $('player-avatar-mini').style.display='block';
  } else {
    $('player-avatar-mini').style.display='none';
  }
  $('player-nick-mini').textContent=State.nickname;

  // Canvas
  const canvas=  $('game-canvas');
  if (window.innerWidth<700) {
    const cw=Math.min(window.innerWidth-40,260);
    canvas.width=cw; canvas.height=cw*2;
  } else {
    canvas.width=300; canvas.height=600;
  }

  updateStatDisplays({score:0,lines:0,level:1});
  $('best-display').textContent=State.bestScore.toLocaleString();

  if (State.game) State.game.stop();
  State.game=new TetrisGame(canvas,{
    onScoreUpdate: onScoreUpdate,
    onGameOver:    onGameOver,
    onLineClear:   onLineClear,
    onSpeedChange: onSpeedChange,
  });

  // Update mini previews after lock / hold
  const origLock=State.game._lock.bind(State.game);
  State.game._lock=function(){
    origLock();
    if(State.game.isRunning){
      State.game.drawMini($('next-canvas'),State.game.next?.type);
      State.game.drawMini($('hold-canvas'),State.game.holdPiece||null);
    }
  };
  const origHold=State.game.holdCurrent.bind(State.game);
  State.game.holdCurrent=function(){
    origHold();
    State.game.drawMini($('hold-canvas'),State.game.holdPiece||null);
    State.game.drawMini($('next-canvas'),State.game.next?.type);
  };

  State.game.drawMini($('next-canvas'),State.game.next.type);
  State.game.drawMini($('hold-canvas'),null);
  $('pause-overlay').classList.add('hidden');

  // Initial speed bar
  onSpeedChange(TetrisGame.SPEED_TIERS[0]);

  State.game.start();
}

// ── Score update ───────────────────────────────────────────────────────────
function updateStatDisplays({score,lines,level}) {
  State.lastStats={score,lines,level};
  $('score-display').textContent=score.toLocaleString();
  $('lines-display').textContent=lines;
  $('level-display').textContent=level;

  if (score>State.bestScore) {
    State.bestScore=score;
    const el=$('best-display');
    el.textContent=score.toLocaleString();
    el.classList.remove('new-record');
    void el.offsetWidth;
    el.classList.add('new-record');
  }

  const rank=State.game?.getRank()||TetrisGame.RANK_TIERS[0];
  $('rank-display').textContent=rank.label;
  $('rank-display').style.color=rank.color;
}

function onScoreUpdate(stats) {
  updateStatDisplays(stats);
  // continuously nudge speed bar (smooth)
  const tier=State.game?.getSpeedTier();
  if(tier) updateSpeedBar(tier);
}

function onSpeedChange(tier) {
  updateSpeedBar(tier);
  // Flash label
  const lbl=$('speed-label-text');
  if(lbl){
    lbl.textContent=tier.label;
    lbl.style.color=tier.color;
    lbl.style.animation='none';
    void lbl.offsetWidth;
    lbl.style.animation='speed-pop 0.5s ease-out';
  }
}

function updateSpeedBar(tier) {
  const fill=$('speed-bar-fill');
  const tiers=TetrisGame.SPEED_TIERS;
  const idx=tiers.indexOf(tier);
  const nextTier=tiers[idx+1];
  let pct=tier.pct;
  if(nextTier && State.game){
    const progress=(State.game.score-tier.min)/(nextTier.min-tier.min);
    pct=tier.pct+(nextTier.pct-tier.pct)*Math.min(progress,1);
  }
  if(fill){
    fill.style.width=`${pct}%`;
    fill.style.background=`linear-gradient(90deg,#7c3aed,${tier.color})`;
    fill.style.boxShadow=`0 0 10px ${tier.color}`;
  }
  const lbl=$('speed-label-text');
  if(lbl){ lbl.textContent=tier.label; lbl.style.color=tier.color; }
}

// ── Line clear ─────────────────────────────────────────────────────────────
function onLineClear(count, pts) {
  const flash=$('line-flash');
  flash.classList.remove('hidden');
  setTimeout(()=>flash.classList.add('hidden'),350);

  const labels=['','SINGLE!','DOUBLE!','TRIPLE!','✨ TETRIS!'];
  const popup=$('score-popup');
  popup.textContent=`${labels[count]||''} +${pts}`;
  popup.classList.remove('hidden');
  popup.style.animation='none';
  void popup.offsetWidth;
  popup.style.animation='';
  setTimeout(()=>popup.classList.add('hidden'),1100);

  if(State.game) State.game.drawMini($('next-canvas'),State.game.next?.type);
}

// ── Game over ──────────────────────────────────────────────────────────────
function onGameOver(stats) {
  const rank=State.game?.getRank()||TetrisGame.RANK_TIERS[0];
  const entry={
    nickname:     State.nickname,
    avatarDataUrl:State.avatarUrl||'',
    score:        stats.score,
    lines:        stats.lines,
    level:        stats.level,
    rank:         rank.label,
  };
  Leaderboard.add(entry);
  const position=Leaderboard.getPosition(stats.score);
  setTimeout(()=>{
    showScreen('gameover-screen');
    drawScoreCard(entry,position);
  },400);
}

// ── Score Card ─────────────────────────────────────────────────────────────
function drawScoreCard(entry, position) {
  const canvas=$('score-card-canvas');
  const ctx=canvas.getContext('2d');
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);

  // BG
  const bg=ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,'#0e0a1f'); bg.addColorStop(0.5,'#120d28'); bg.addColorStop(1,'#0a0618');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // Stars
  for(let i=0;i<80;i++){
    const sx=((entry.score*(i+7)*13)%W+W)%W;
    const sy=((entry.score*(i+3)*17)%H+H)%H;
    ctx.beginPath(); ctx.arc(sx,sy,Math.random()*1.5+0.3,0,Math.PI*2);
    ctx.globalAlpha=0.3+Math.random()*0.5; ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.fill();
  }
  ctx.globalAlpha=1;

  // Border
  ctx.save();
  ctx.strokeStyle='#8b5cf6'; ctx.lineWidth=3;
  ctx.shadowBlur=20; ctx.shadowColor='#8b5cf6';
  roundRect(ctx,8,8,W-16,H-16,16); ctx.stroke();
  ctx.restore();

  // Title
  ctx.font='bold 28px Fredoka One, cursive';
  ctx.fillStyle='#ffd700'; ctx.shadowBlur=15; ctx.shadowColor='#ffd700';
  ctx.textAlign='center'; ctx.fillText('✨ MAGIC TETRIS',W/2,52); ctx.shadowBlur=0;
  ctx.font='13px Exo 2, sans-serif'; ctx.fillStyle='rgba(200,180,255,0.7)';
  ctx.fillText('Score Card',W/2,72);
  ctx.strokeStyle='rgba(139,92,246,0.4)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(30,82); ctx.lineTo(W-30,82); ctx.stroke();

  // Avatar
  const avatarSize=90, avatarY=100;
  ctx.save();
  ctx.beginPath(); ctx.arc(W/2,avatarY+avatarSize/2,avatarSize/2+4,0,Math.PI*2);
  ctx.fillStyle='#8b5cf6'; ctx.shadowBlur=20; ctx.shadowColor='#8b5cf6'; ctx.fill(); ctx.shadowBlur=0;
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.arc(W/2,avatarY+avatarSize/2,avatarSize/2,0,Math.PI*2); ctx.clip();

  if(entry.avatarDataUrl){
    const img=new Image();
    img.onload=()=>{
      ctx.drawImage(img,W/2-avatarSize/2,avatarY,avatarSize,avatarSize);
      ctx.restore();
      _continueCard(ctx,entry,position,W,H,avatarY,avatarSize);
    };
    img.onerror=()=>{ ctx.restore(); _drawEmoji(ctx,W,avatarY,avatarSize); _continueCard(ctx,entry,position,W,H,avatarY,avatarSize); };
    img.src=entry.avatarDataUrl;
  } else {
    ctx.restore(); _drawEmoji(ctx,W,avatarY,avatarSize); _continueCard(ctx,entry,position,W,H,avatarY,avatarSize);
  }
}

function _drawEmoji(ctx,W,avatarY,avatarSize){
  ctx.fillStyle='#1e1040'; ctx.fillRect(W/2-avatarSize/2,avatarY,avatarSize,avatarSize);
  ctx.font=`${avatarSize*0.6}px serif`; ctx.textAlign='center'; ctx.fillStyle='#fff';
  ctx.fillText('🧙',W/2,avatarY+avatarSize*0.75);
}

function _continueCard(ctx,entry,position,W,H,avatarY,avatarSize){
  const cy=avatarY+avatarSize+20;
  ctx.textAlign='center';
  ctx.font='bold 22px Fredoka One, cursive'; ctx.fillStyle='#e8e0ff'; ctx.fillText(entry.nickname,W/2,cy+4);

  const rank=[...TetrisGame.RANK_TIERS].reverse().find(r=>entry.score>=r.min)||TetrisGame.RANK_TIERS[0];
  ctx.font='bold 15px Exo 2, sans-serif'; ctx.fillStyle=rank.color;
  ctx.shadowBlur=8; ctx.shadowColor=rank.color; ctx.fillText(rank.label,W/2,cy+24); ctx.shadowBlur=0;

  ctx.strokeStyle='rgba(139,92,246,0.3)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(30,cy+54); ctx.lineTo(W-30,cy+54); ctx.stroke();

  const stats=[
    {label:'SCORE',  value:entry.score.toLocaleString(), color:'#ffd700'},
    {label:'LINES',  value:entry.lines,                  color:'#00f5ff'},
    {label:'LEVEL',  value:entry.level,                  color:'#bf5fff'},
    {label:'RANK #', value:`#${position}`,               color:'#ff8c00'},
  ];
  const gridY=cy+66, cellW=(W-40)/2, cellH=58;
  stats.forEach((s,i)=>{
    const col=i%2, row=Math.floor(i/2);
    const gx=20+col*cellW, gy=gridY+row*(cellH+8);
    ctx.fillStyle='rgba(255,255,255,0.04)'; roundRect(ctx,gx,gy,cellW-8,cellH,10); ctx.fill();
    ctx.strokeStyle='rgba(139,92,246,0.25)'; ctx.lineWidth=1; roundRect(ctx,gx,gy,cellW-8,cellH,10); ctx.stroke();
    const cx2=gx+(cellW-8)/2;
    ctx.font='bold 22px Fredoka One, cursive'; ctx.fillStyle=s.color;
    ctx.shadowBlur=10; ctx.shadowColor=s.color; ctx.fillText(s.value,cx2,gy+34); ctx.shadowBlur=0;
    ctx.font='10px Exo 2, sans-serif'; ctx.fillStyle='rgba(200,180,255,0.6)'; ctx.fillText(s.label,cx2,gy+50);
  });

  const fy=gridY+2*(cellH+8)+12;
  ctx.font='11px Exo 2, sans-serif'; ctx.fillStyle='rgba(160,140,200,0.5)'; ctx.textAlign='center';
  ctx.fillText(`magic-tetris • ${new Date().toLocaleDateString()}`,W/2,fy+16);
  const blockColors=['#00f5ff','#ffd700','#bf5fff','#39ff14','#ff073a','#4169ff','#ff8c00'];
  const bsz=12;
  blockColors.forEach((c,b)=>{
    ctx.fillStyle=c; ctx.shadowBlur=8; ctx.shadowColor=c;
    ctx.fillRect(20+b*(bsz+4),fy,bsz,bsz);
  });
  ctx.shadowBlur=0;
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

// ── Keyboard ───────────────────────────────────────────────────────────────
function initKeyboard() {
  let repeatTimer=null;
  const startRepeat=(fn)=>{ fn(); repeatTimer=setTimeout(()=>{ repeatTimer=setInterval(fn,55); },180); };
  const stopRepeat =()=>{ clearTimeout(repeatTimer); clearInterval(repeatTimer); };

  document.addEventListener('keydown',e=>{
    if(!$('game-screen').classList.contains('active')) return;
    const g=State.game;
    if(!g||!g.isRunning) return;
    switch(e.code){
      case 'ArrowLeft':  e.preventDefault(); startRepeat(()=>g.moveLeft());  break;
      case 'ArrowRight': e.preventDefault(); startRepeat(()=>g.moveRight()); break;
      case 'ArrowDown':  e.preventDefault(); startRepeat(()=>g.softDrop());  break;
      case 'ArrowUp':    e.preventDefault(); g.rotate();    break;
      case 'Space':      e.preventDefault(); g.hardDrop();  break;
      case 'KeyC': case 'ShiftLeft': case 'ShiftRight': g.holdCurrent(); break;
      case 'KeyP': case 'Escape': {
        const paused=g.togglePause();
        $('pause-overlay').classList.toggle('hidden',!paused);
        break;
      }
      case 'KeyR': {
        if (confirm('Restart? Current game will be lost.')) {
          g.stop(); initGame();
        }
        break;
      }
    }
  });
  document.addEventListener('keyup',e=>{
    if(['ArrowLeft','ArrowRight','ArrowDown'].includes(e.code)) stopRepeat();
  });
}

// ── Touch ──────────────────────────────────────────────────────────────────
function initTouchControls() {
  const canvas=$('game-canvas');
  let tx=0,ty=0,tt=0;

  canvas.addEventListener('touchstart',e=>{ e.preventDefault(); tx=e.touches[0].clientX; ty=e.touches[0].clientY; tt=Date.now(); },{passive:false});
  canvas.addEventListener('touchend',e=>{
    e.preventDefault();
    if(!State.game||!State.game.isRunning||State.game.isPaused) return;
    const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty, dt=Date.now()-tt;
    if(Math.abs(dx)<10&&Math.abs(dy)<10&&dt<200){ State.game.rotate(); return; }
    if(Math.abs(dx)>Math.abs(dy)){ if(Math.abs(dx)>35) dx>0?State.game.moveRight():State.game.moveLeft(); }
    else { if(Math.abs(dy)>35) dy>0?State.game.softDrop():State.game.hardDrop(); }
  },{passive:false});

  const hold=(btn,fn)=>{
    let iv=null;
    btn.addEventListener('touchstart',e=>{e.preventDefault();fn();iv=setInterval(fn,80);});
    btn.addEventListener('touchend',  e=>{e.preventDefault();clearInterval(iv);});
    btn.addEventListener('mousedown', ()=>{fn();iv=setInterval(fn,80);});
    btn.addEventListener('mouseup',   ()=>clearInterval(iv));
    btn.addEventListener('mouseleave',()=>clearInterval(iv));
  };
  const once=(btn,fn)=>{ btn.addEventListener('touchstart',e=>{e.preventDefault();fn();}); btn.addEventListener('click',fn); };

  if($('ctrl-left'))   hold($('ctrl-left'),  ()=>State.game?.moveLeft());
  if($('ctrl-right'))  hold($('ctrl-right'), ()=>State.game?.moveRight());
  if($('ctrl-down'))   hold($('ctrl-down'),  ()=>State.game?.softDrop());
  if($('ctrl-rotate')) once($('ctrl-rotate'),()=>State.game?.rotate());
  if($('ctrl-hard'))   once($('ctrl-hard'),  ()=>State.game?.hardDrop());
  if($('ctrl-hold'))   once($('ctrl-hold'),  ()=>State.game?.holdCurrent());
  if($('ctrl-pause'))  once($('ctrl-pause'), ()=>{
    const p=State.game?.togglePause();
    $('pause-overlay').classList.toggle('hidden',!p);
  });
}

// ── Gameover buttons ───────────────────────────────────────────────────────
function initGameoverScreen(){
  $('btn-download').addEventListener('click',()=>{
    const link=document.createElement('a');
    link.download=`magic-tetris-${State.nickname}-${Date.now()}.png`;
    link.href=$('score-card-canvas').toDataURL('image/png');
    link.click();
  });
  $('btn-again').addEventListener('click',()=>{ showScreen('game-screen'); initGame(); });
  $('btn-menu').addEventListener('click',()=>{ if(State.game) State.game.stop(); showScreen('setup-screen'); });
}

function initGameScreenButtons(){
  $('btn-resume').addEventListener('click',()=>{
    const p=State.game?.togglePause();
    $('pause-overlay').classList.toggle('hidden',!p);
  });
$('btn-quit').addEventListener('click',()=>{
    if(confirm('Quit current game?')){ State.game?.stop(); showScreen('setup-screen'); }
  });

  // Restart (in-game panel)
  const btnRestart = $('btn-restart');
  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      if (confirm('Restart? Current game will be lost.')) {
        State.game?.stop();
        initGame();
      }
    });
  }

  // Restart (from pause overlay)
  const btnPauseRestart = $('btn-pause-restart');
  if (btnPauseRestart) {
    btnPauseRestart.addEventListener('click', () => {
      State.game?.stop();
      initGame();
    });
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  initParticles();
  initSetupScreen();
  initKeyboard();
  initTouchControls();
  initGameoverScreen();
  initGameScreenButtons();
});
