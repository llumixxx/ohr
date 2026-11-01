(function(){
"use strict";
const { $, esc, expandClusters } = OHR;
const KEY = "ohr-hallu", REC = "ohr-hallu-rec";
const S = { pet:null, petPrice:0, orbPrice:0, maxReset:5, useOrb:true };
let PETS = [], POOL = null, sim = null, LOG = [], running = false, stopFlag = false;
try{ const d = JSON.parse(localStorage.getItem(KEY) || "{}"); ["petPrice", "orbPrice", "maxReset", "useOrb", "pet"].forEach(k => { if(d[k] !== undefined) S[k] = d[k]; }); }catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} };
/* 내용이 같으면 다시 그리지 않아요 (입력칸에서 나오는 순간 버튼이 사라져서 클릭이 씹히는 걸 막아요) */
const setHTML = (el, h) => { if(el._h === h) return; el._h = h; el.innerHTML = h; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtS = n => { n = Math.round(n); return n >= 1e8 ? (n/1e8).toFixed(n >= 1e10 ? 0 : 1) + "억" : n.toLocaleString(); };
const fmtPct = p => p === 0 ? "0%" : p < 0.0001 ? p.toExponential(1) + "%" : p < 0.01 ? p.toFixed(3) + "%" : p < 1 ? p.toFixed(2) + "%" : p < 10 ? p.toFixed(2) + "%" : Math.min(p, 99.99).toFixed(1) + "%";
const maxReset = () => Math.max(0, Math.min(99, Math.round(Number(S.maxReset)) || 0));

/* ===== 뽑기 후보 만들기 (오르 환각 계산기와 같은 방식: 가능한 조합을 모두 같은 비율로) ===== */
const BON = [];
for(let a = 0; a <= 10; a++) for(let b = 0; b <= 10 - a; b++) for(let c = 0; c <= 10 - a - b; c++) BON.push([a, b, c, 10 - a - b - c]);
function buildPool(p){
  const O = p.origin, k = p.k, map = new Map();
  for(let d0 = -2; d0 <= 2; d0++) for(let d1 = -2; d1 <= 2; d1++) for(let d2 = -2; d2 <= 2; d2++) for(let d3 = -2; d3 <= 2; d3++){
    const hall = d0 === 2 && d1 === 2 && d2 === 2 && d3 === 2;
    const G0 = O[0] + d0, G1 = O[1] + d1, G2 = O[2] + d2, G3 = O[3] + d3;
    for(let i = 0; i < BON.length; i++){
      const D = BON[i], v0 = G0 + D[0], v1 = G1 + D[1], v2 = G2 + D[2], v3 = G3 + D[3];
      const hp = Math.floor(k*(4*v0 + v1 + v2 + v3)/100), atk = Math.floor(k*(2*v0 + 20*v1 + 2*v2 + v3)/2000);
      const def = Math.floor(k*(2*v0 + 2*v1 + 20*v2 + v3)/2000), agi = Math.floor(k*v3/100);
      const key = ((hp*1024 + atk)*1024 + def)*1024 + agi;
      let e = map.get(key);
      if(!e){ e = { hp, atk, def, agi, total:0, hall:0 }; map.set(key, e); }
      e.total++; if(hall) e.hall++;
    }
  }
  const list = [...map.values()], cum = new Float64Array(list.length);
  let sum = 0, hallSum = 0;
  list.forEach((e, i) => { e.prob = e.hall/e.total; sum += e.total; hallSum += e.hall; cum[i] = sum; });
  return { list, cum, total:sum, pRoll:hallSum/sum };
}
function pick(){
  const r = Math.random()*POOL.total, c = POOL.cum;
  let lo = 0, hi = c.length - 1;
  while(lo < hi){ const m = (lo + hi) >> 1; if(c[m] >= r) hi = m; else lo = m + 1; }
  return POOL.list[lo];
}

/* ===== 이론값 (뽑기 한 번에 환각이 나올 확률 p, 펫마다 구슬 m번) ===== */
function theory(){
  const p = POOL.pRoll, q = 1 - p, m = S.useOrb ? maxReset() : 0;
  const pets = 1/(1 - Math.pow(q, m + 1)), rolls = 1/p, orbs = Math.max(0, rolls - pets);
  return { p, rolls, pets, orbs, median:Math.ceil(Math.log(.5)/Math.log(q)), p90:Math.ceil(Math.log(.1)/Math.log(q)), p99:Math.ceil(Math.log(.01)/Math.log(q)),
    cost:S.petPrice*pets + S.orbPrice*orbs };
}
const cost = () => sim ? sim.pets*S.petPrice + sim.orbs*S.orbPrice : 0;
function log(text, cls){ LOG.unshift({ text, cls:cls || "" }); if(LOG.length > 60) LOG.length = 60; }

/* ===== 진행 ===== */
function start(){
  if(!S.pet || !POOL) return;
  sim = { pets:1, resets:0, orbs:0, rolls:1, tries:0, cur:pick(), failed:false, done:false, gaveUp:false };
  LOG = []; log("🐾 펫 1마리째를 샀어요", "buy"); logRoll(); render();
}
function logRoll(){ const c = sim.cur; log(`공${c.atk} 방${c.def} 순${c.agi} 내${c.hp} → 환각 ${fmtPct(c.prob*100)}`); }
function challenge(){
  const s = sim; if(!s || s.done || s.failed || s.cur.prob <= 0) return;
  s.tries++;
  if(Math.random() < s.cur.prob){ s.done = true; log(`✨ 환각 성공! (${fmtPct(s.cur.prob*100)})`, "win"); finish(); }
  else { s.failed = true; log(`❌ 환각 실패 (${fmtPct(s.cur.prob*100)})`, "lose"); }
}
function reroll(){
  const s = sim; if(!s || s.done || s.resets >= maxReset()) return false;
  s.resets++; s.orbs++; s.rolls++; s.failed = false; s.cur = pick(); logRoll(); return true;
}
function buy(){
  const s = sim; if(!s || s.done) return;
  s.pets++; s.resets = 0; s.rolls++; s.failed = false; s.cur = pick();
  log(`🛒 새 펫 ${s.pets}마리째`, "buy"); logRoll();
}
function rerollUntilChance(){
  let n = 0;
  while(reroll()){ n++; if(sim.cur.prob > 0) break; }
  return n;
}
function giveUp(){ if(!sim || sim.done) return; sim.done = true; sim.gaveUp = true; log("🏳 포기했어요"); render(); }

/* 자동 진행 한 걸음: 도전할 수 있으면 도전, 아니면 구슬(없으면 새 펫) */
function stepAuto(){
  const s = sim, c = s.cur;
  if(c.prob > 0 && !s.failed){ challenge(); return; }
  if(S.useOrb && s.resets < maxReset()){ reroll(); return; }
  buy();
}
async function autoRun(){
  if(!sim || sim.done){ start(); }
  if(running){ stopFlag = true; return; }
  running = true; stopFlag = false; let n = 0; render();
  while(!stopFlag && sim && !sim.done && n < 3000000){
    stepAuto(); n++;
    if(n % 300 === 0){ render(); await sleep(0); }
  }
  running = false; render();
}
function skipToEnd(){
  if(!sim || sim.done) start();
  stopFlag = true; let n = 0;
  while(!sim.done && n < 3000000){ stepAutoQuiet(); n++; }
  render();
}
function stepAutoQuiet(){
  const s = sim, c = s.cur;
  if(c.prob > 0 && !s.failed){ s.tries++; if(Math.random() < c.prob){ s.done = true; log(`✨ 환각 성공! (${fmtPct(c.prob*100)})`, "win"); finish(); } else s.failed = true; return; }
  if(S.useOrb && s.resets < maxReset()){ s.resets++; s.orbs++; s.rolls++; s.failed = false; s.cur = pick(); return; }
  s.pets++; s.resets = 0; s.rolls++; s.failed = false; s.cur = pick();
}
function finish(){
  const r = JSON.parse(localStorage.getItem(REC) || "{}");
  r.runs = (r.runs || 0) + 1; r.rolls = (r.rolls || 0) + sim.rolls;
  r.best = r.best == null ? sim.rolls : Math.min(r.best, sim.rolls); r.worst = Math.max(r.worst || 0, sim.rolls);
  try{ localStorage.setItem(REC, JSON.stringify(r)); }catch(e){}
}

/* ===== 그리기 ===== */
function gradeOf(prob){
  const p = prob*100;
  if(p <= 0) return ["g0", "꽝 (환각 불가)"]; if(p < 1) return ["g1", "약함"]; if(p < 5) return ["g2", "쓸만함"];
  if(p < 50) return ["g3", "좋음!"]; return ["g4", "대박!"];
}
function renderPet(){
  const p = S.pet;
  $("hlPetCard").innerHTML = p ? `<div class="hl-pet">${p.img ? `<img src="${esc(p.img)}" alt="" referrerpolicy="no-referrer">` : ""}<div><b>${esc(p.name)}</b><small>S급 초기치 공${p.initS[1]} 방${p.initS[2]} 순${p.initS[3]} 내${p.initS[0]}</small></div></div>` : "";
}
function renderDevice(){
  const dev = $("hlDevice"), act = $("hlActions"), auto = $("hlAuto"), s = sim;
  if(!S.pet){ dev.className = "hl-device"; setHTML(dev, '<div class="hl-empty">먼저 펫을 골라주세요.<br>그다음 <b>시작하기</b>를 누르면 펫을 사서 스탯을 뽑아요.</div>'); setHTML(act, ""); setHTML(auto, ""); return; }
  if(!s){
    dev.className = "hl-device"; setHTML(dev, `<div class="hl-empty"><b>${esc(S.pet.name)}</b>로 환각을 도전해볼까요?<br>펫을 사고, 마음에 안 들면 구슬로 초기화하면서 환각이 뜰 때까지 해요.</div>`);
    setHTML(act, '<button class="btn go" id="hlStart" type="button">시작하기</button>'); setHTML(auto, '<button class="btn ghost" id="hlAutoBtn" type="button">환각까지 자동 진행</button><button class="btn ghost" id="hlSkip" type="button">결과 바로 보기</button>');
    return;
  }
  const c = s.cur, [g, gt] = gradeOf(c.prob), ref = S.pet.initS;
  const cell = (cls, l, v, r) => `<div class="${cls} flash"><span>${l}</span><b>${v}</b><small>S급 ${r}</small></div>`;
  dev.className = "hl-device" + (s.done && !s.gaveUp ? " hot" : "");
  setHTML(dev, `<div class="hl-head">${S.pet.img ? `<img src="${esc(S.pet.img)}" alt="" referrerpolicy="no-referrer">` : ""}<div><b>${esc(S.pet.name)}</b><small>펫 ${s.pets}마리째 · 구슬 ${s.resets}/${maxReset()}</small></div></div>
    <div class="hl-cells">${cell("a", "공격", c.atk, ref[1])}${cell("d", "방어", c.def, ref[2])}${cell("s", "순발", c.agi, ref[3])}${cell("h", "내구", c.hp, ref[0])}</div>
    <div class="hl-prob ${g}">${s.done && !s.gaveUp ? "✨ 환각 8등급!" : "환각 " + fmtPct(c.prob*100)}</div>
    <div class="hl-grade">${s.done ? (s.gaveUp ? "포기했어요" : "축하해요!") : s.failed ? "이 스탯으로는 이미 도전했어요 · 초기화하거나 새 펫을 사세요" : gt}</div>`);
  const canChallenge = !s.done && !s.failed && c.prob > 0, canReset = !s.done && s.resets < maxReset();
  setHTML(act, s.done ? '<button class="btn go" id="hlStart" type="button">다시 시작하기</button>' :
    `<button class="btn go" id="hlChallenge" type="button"${canChallenge ? "" : " disabled"}>환각 도전</button>
     <button class="btn ghost" id="hlReroll" type="button"${canReset ? "" : " disabled"}>초기화 구슬</button>
     <button class="btn ghost" id="hlRerollAll" type="button"${canReset ? "" : " disabled"}>가능성 나올 때까지 초기화</button>
     <button class="btn ghost" id="hlBuy" type="button">새 펫 사기</button>
     <button class="btn ghost" id="hlGive" type="button">포기</button>`);
  setHTML(auto, s.done ? "" : running ? '<button class="btn" id="hlAutoBtn" type="button">멈춤</button>' : '<button class="btn ghost" id="hlAutoBtn" type="button">환각까지 자동 진행</button><button class="btn ghost" id="hlSkip" type="button">결과 바로 보기</button>');
}
function renderWin(){
  const s = sim, th = theory(), ratio = s.rolls/th.rolls;
  const luck = ratio <= .1 ? "👑 미친 운빨이에요! 로또 사세요!" : ratio <= .3 ? "🍀 평균보다 훨씬 빨랐어요!" : ratio <= .7 ? "🌟 평균보다 빨랐어요!" : ratio <= 1.3 ? "🙂 평균 정도의 운이에요" : ratio <= 2.5 ? "😅 평균보다 좀 늦었어요" : ratio <= 5 ? "😭 오늘은 운이 별로네요" : "💀 평균의 " + ratio.toFixed(1) + "배... 가혹해요";
  return `<div class="hl-win"><h3>✨ 환각 성공!</h3>펫 <b>${s.pets.toLocaleString()}</b>마리 · 구슬 <b>${s.orbs.toLocaleString()}</b>개 · 뽑기 <b>${s.rolls.toLocaleString()}</b>번 · 도전 <b>${s.tries.toLocaleString()}</b>번<br>
    쓴 돈 <b>${fmtS(cost())} S</b> <small>(평균 ${fmtS(th.cost)} S)</small><br>${luck}</div>`;
}
function renderStats(){
  const s = sim, box = (l, v, w) => `<div${w ? ' class="wide"' : ""}><span>${l}</span><b>${v}</b></div>`;
  $("hlStats").innerHTML = s ? box("산 펫", s.pets.toLocaleString() + "마리") + box("쓴 구슬", s.orbs.toLocaleString() + "개") + box("뽑기", s.rolls.toLocaleString() + "번") + box("환각 도전", s.tries.toLocaleString() + "번") + box("지금까지 쓴 돈", fmtS(cost()) + " S", true)
    : box("산 펫", "-") + box("쓴 구슬", "-") + box("뽑기", "-") + box("환각 도전", "-");
  const r = JSON.parse(localStorage.getItem(REC) || "{}");
  $("hlRec").innerHTML = r.runs ? `내 기록<br>환각 성공 <b>${r.runs}</b>번 · 평균 뽑기 <b>${Math.round(r.rolls/r.runs).toLocaleString()}</b>번<br>가장 빨랐던 때 <b>${r.best.toLocaleString()}</b>번 · 가장 늦었던 때 <b>${r.worst.toLocaleString()}</b>번`
    : "내 기록<br>아직 환각을 띄운 기록이 없어요.";
}
function renderTheory(){
  const box = $("hlTheory"), dist = $("hlDist");
  if(!POOL){ box.innerHTML = '<div><span>펫을 고르면 나와요</span><b>-</b></div>'; dist.innerHTML = ""; return; }
  const t = theory();
  box.innerHTML = `<div><span>뽑기 한 번에 환각</span><b>1/${Math.round(1/t.p)} (${(t.p*100).toFixed(2)}%)</b></div>
    <div><span>평균 뽑기 횟수</span><b>${Math.round(t.rolls).toLocaleString()}번</b></div>
    <div><span>중앙값 · 운 나쁜 10% · 1%</span><b>${t.median.toLocaleString()} · ${t.p90.toLocaleString()} · ${t.p99.toLocaleString()}번</b></div>
    <div><span>평균 산 펫 · 쓴 구슬</span><b>${Math.round(t.pets).toLocaleString()}마리 · ${Math.round(t.orbs).toLocaleString()}개</b></div>
    <div><span>평균 비용</span><b>${fmtS(t.cost)} S</b></div>`;
  const B = [["0%", 0, 0], ["0~1%", 1e-12, .01], ["1~5%", .01, .05], ["5~20%", .05, .2], ["20~50%", .2, .5], ["50% 이상", .5, 1.01]];
  const sums = B.map(() => 0);
  POOL.list.forEach(e => { for(let i = 0; i < B.length; i++){ if(i === 0 ? e.prob === 0 : (e.prob >= B[i][1] && e.prob < B[i][2])){ sums[i] += e.total; break; } } });
  const mx = Math.max(...sums, 1);
  dist.innerHTML = B.map((b, i) => sums[i] ? `<div class="hl-dist"><span>${b[0]}</span><div class="tr"><i style="width:${sums[i]/mx*100}%"></i></div><span class="pc">${(sums[i]/POOL.total*100).toFixed(sums[i]/POOL.total < .0001 ? 4 : 2)}%</span></div>` : "").join("");
}
function render(){
  renderPet(); renderDevice(); renderStats(); renderTheory();
  $("hlLog").innerHTML = (sim && sim.done && !sim.gaveUp ? renderWin() : "") + LOG.map(l => `<div class="${l.cls}">${esc(l.text)}</div>`).join("");
  save();
}

/* ===== 펫 고르기 ===== */
function setPet(p){
  S.pet = { id:p.id, name:p.name, initS:p.initS, img:p.img, origin:p.origin, k:p.k };
  $("hlNote").hidden = true;
  const note = $("hlNote");
  POOL = null; sim = null; LOG = [];
  note.textContent = "후보를 만드는 중…"; note.hidden = false;
  setTimeout(() => { POOL = buildPool(S.pet); note.hidden = true; render(); }, 20);
  render();
}
function bindPicker(){
  const inp = $("hlPick"), box = $("hlSuggest");
  let act = -1, hits = [];
  const close = () => { box.hidden = true; act = -1; };
  const choose = id => { const p = PETS.find(x => x.id === id); inp.value = ""; close(); inp.blur(); if(p) setPet(p); };
  const draw = () => {
    const q = inp.value.trim(); if(!q){ close(); return; }
    const exp = expandClusters(q); hits = [];
    for(const p of PETS){ if(p.name.includes(q) || p._cho.includes(exp)){ hits.push(p); if(hits.length >= 10) break; } }
    box.hidden = false; act = hits.length ? 0 : -1;
    box.innerHTML = hits.length ? hits.map((p, i) => `<button type="button" class="sg${i === act ? " act" : ""}" role="option" data-id="${esc(p.id)}"><span>${esc(p.name)}</span><i>${p.attrs.map(a => esc(a[0] + a[1])).join(" ")}</i></button>`).join("") : '<div class="sg-empty">검색 결과가 없어요</div>';
  };
  inp.addEventListener("input", draw); inp.addEventListener("focus", draw);
  inp.addEventListener("keydown", e => {
    if(box.hidden) return;
    if(e.key === "ArrowDown" || e.key === "ArrowUp"){ e.preventDefault(); if(!hits.length) return; act = (act + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length; box.querySelectorAll(".sg").forEach((b, i) => b.classList.toggle("act", i === act)); }
    else if(e.key === "Enter"){ e.preventDefault(); if(hits[act]) choose(hits[act].id); }
    else if(e.key === "Escape") close();
  });
  box.addEventListener("pointerdown", e => { const b = e.target.closest(".sg"); if(b){ e.preventDefault(); choose(b.dataset.id); } });
  document.addEventListener("click", e => { if(!e.target.closest(".pick")) close(); });
}
function bind(){
  bindPicker();
  const num = (id, key) => $(id).addEventListener("change", e => { S[key] = Math.max(0, Math.round(Number(e.target.value) || 0)); if(key === "maxReset") S[key] = Math.min(99, S[key]); e.target.value = S[key]; render(); });
  num("hlPetPrice", "petPrice"); num("hlOrbPrice", "orbPrice"); num("hlMaxReset", "maxReset");
  $("hlUseOrb").addEventListener("change", e => { S.useOrb = e.target.checked; renderTheory(); renderStats(); save(); });
  const on = (id, fn) => document.addEventListener("click", e => { const b = e.target.closest("#" + id); if(b && !b.disabled) fn(); });
  on("hlStart", start); on("hlChallenge", () => { challenge(); render(); }); on("hlReroll", () => { reroll(); render(); });
  on("hlRerollAll", () => { rerollUntilChance(); render(); }); on("hlBuy", () => { buy(); render(); }); on("hlGive", giveUp);
  on("hlAutoBtn", autoRun); on("hlSkip", skipToEnd);
}
(async function init(){
  $("hlPetPrice").value = S.petPrice; $("hlOrbPrice").value = S.orbPrice; $("hlMaxReset").value = S.maxReset; $("hlUseOrb").checked = S.useOrb;
  bind();
  try{ PETS = (await OHR.loadPets()).filter(p => p.variant === "일반" && p.ok); }catch(e){ $("hlDevice").innerHTML = '<div class="hl-empty">pets.json을 불러오지 못했어요.</div>'; return; }
  if(S.pet){ const p = PETS.find(x => x.id === S.pet.id); if(p) setPet(p); else S.pet = null; }
  render();
})();
})();
