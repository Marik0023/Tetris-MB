/* ── leaderboard page — Supabase global ── */
const SB_URL = 'https://havwsarcfpyiwyitpasq.supabase.co';
const SB_KEY = 'sb_publishable_orLD_bHxYWr4UeYFBLaqAA_35qJAv62';
const SB_HDR = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };

function escHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function makeAvatarLB(name){
  const c=document.createElement('canvas'); c.width=c.height=60;
  const x=c.getContext('2d');
  const pal=['#7B2FBE','#FF6EC7','#00E5FF','#FFD700','#FF6B35','#39FF14','#FF3366','#3399FF'];
  x.fillStyle=pal[(name||'?').charCodeAt(0)%pal.length];
  x.beginPath(); x.arc(30,30,30,0,Math.PI*2); x.fill();
  x.fillStyle='#fff'; x.font='bold 22px sans-serif';
  x.textAlign='center'; x.textBaseline='middle';
  x.fillText((name||'?')[0].toUpperCase(),30,31);
  return c.toDataURL();
}
async function loadEntries(){
  const res=await fetch(SB_URL+'/rest/v1/leaderboard?select=name,score,lines,level,created_at&order=score.desc&limit=50',{headers:SB_HDR});
  if(!res.ok) throw new Error('fetch failed');
  return res.json();
}
async function renderPage(){
  const empty=document.getElementById('lb-empty');
  const tbody=document.getElementById('lb-table-body');
  const podium=document.getElementById('lb-podium');
  if(empty) empty.style.display='none';
  if(tbody) tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px;opacity:.5">🌐 Loading global scores…</td></tr>';
  if(podium) podium.innerHTML='';
  let entries=[];
  try{ entries=await loadEntries(); }catch{
    if(tbody) tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:24px;color:#FF3A5C">⚠ Could not load scores</td></tr>';
    return;
  }
  const statTotal=document.getElementById('stat-total');
  const statBest=document.getElementById('stat-best');
  const statLines=document.getElementById('stat-lines');
  const statTop=document.getElementById('stat-top-player');
  if(statTotal) statTotal.textContent=entries.length;
  if(statBest)  statBest.textContent=entries.length?Number(entries[0].score).toLocaleString():'—';
  if(statLines) statLines.textContent=entries.length?Math.max(...entries.map(e=>e.lines||0)):'—';
  if(statTop)   statTop.textContent=entries.length?entries[0].name:'—';
  if(podium){
    podium.innerHTML='';
    const medals=['🥇','🥈','🥉'];
    [1,2,3].forEach(rank=>{
      const e=entries[rank-1]; if(!e) return;
      const slot=document.createElement('div');
      slot.className=`podium-slot rank-${rank}`;
      slot.innerHTML=`<img class="podium-avatar" src="${makeAvatarLB(e.name)}" alt=""><span class="podium-medal">${medals[rank-1]}</span><span class="podium-nick">${escHtml(e.name)}</span><span class="podium-score">${Number(e.score).toLocaleString()}</span><div class="podium-platform"></div>`;
      podium.appendChild(slot);
    });
  }
  if(!entries.length){ if(empty) empty.style.display='block'; if(tbody) tbody.innerHTML=''; return; }
  if(empty) empty.style.display='none';
  const medals=['🥇','🥈','🥉'];
  tbody.innerHTML=entries.map((e,i)=>{
    const ri=i<3?medals[i]:`#${i+1}`;
    const dt=e.created_at?new Date(e.created_at).toLocaleDateString():'—';
    return `<tr class="${i<3?'highlight-row':''}"><td><span class="td-rank">${ri}</span></td><td><div class="td-player"><img class="td-avatar" src="${makeAvatarLB(e.name)}" alt=""><span class="td-name">${escHtml(e.name)}</span></div></td><td class="td-score">${Number(e.score).toLocaleString()}</td><td>${e.lines||0}</td><td>${e.level||1}</td><td class="td-date">${dt}</td></tr>`;
  }).join('');
}
document.addEventListener('DOMContentLoaded',()=>{
  renderPage();
  const btn=document.getElementById('lb-clear-btn');
  if(btn){ btn.textContent='↻ Refresh'; btn.onclick=()=>renderPage(); }
});
