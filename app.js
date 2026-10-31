(function(){
"use strict";
const { $, esc, smooth, ATTR_COLOR, expandClusters } = OHR;
const f3 = v => v.toFixed(3);

/* ===== 계산 (오르서버 환각 계산기와 같은 방식) ===== */
const OFFSETS = [-2,-1,0,1,2];
const Ds = [];
for(let a=0; a<=10; a++) for(let b=0; b<=10-a; b++) for(let c=0; c<=10-a-b; c++) Ds.push([a, b, c, 10-a-b-c]);
const GRADES = [8,7,6,5,4,3,2,1,0,-1,-2,-3,-4,-5,-6,-7,-8];

/* 판정은 정수 분자식으로 처리해서 9.9999 내림 오류를 막아요 */
function computeGradeDist(origin, k, target){
  const counts = {}, matches = {};
  let total = 0;
  for(const d0 of OFFSETS){ const G0 = origin[0] + d0;
  for(const d1 of OFFSETS){ const G1 = origin[1] + d1;
  for(const d2 of OFFSETS){ const G2 = origin[2] + d2;
  for(const d3 of OFFSETS){ const G3 = origin[3] + d3;
    const grade = d0 + d1 + d2 + d3;
    for(let i=0; i<Ds.length; i++){
      const D = Ds[i];
      const v0 = G0 + D[0], v1 = G1 + D[1], v2 = G2 + D[2], v3 = G3 + D[3];
      if(Math.floor(k*(4*v0+v1+v2+v3)/100) !== target[0]) continue;
      if(Math.floor(k*v3/100) !== target[3]) continue;
      if(Math.floor(k*(2*v0+20*v1+2*v2+v3)/2000) !== target[1]) continue;
      if(Math.floor(k*(2*v0+2*v1+20*v2+v3)/2000) !== target[2]) continue;
      const a0 = k*v0/100, a1 = k*v1/100, a2 = k*v2/100, a3 = k*v3/100;
      counts[grade] = (counts[grade] || 0) + 1;
      total++;
      (matches[grade] = matches[grade] || []).push({
        offset:[d0,d1,d2,d3], bonus:D,
        raw:[4*a0+a1+a2+a3, 0.1*a0+a1+0.1*a2+0.05*a3, 0.1*a0+0.1*a1+a2+0.05*a3, a3]
      });
    }
  }}}}
  return { counts, matches, total };
}

/* 원본계수 합으로 RANK 판정, 보정계수 B는 레벨업마다 이 범위 안에서 새로 정해져요 */
const RANKS = [
  { lo:100,  hi:null, Blo:450, Bhi:500 },
  { lo:95,   hi:99,   Blo:470, Bhi:520 },
  { lo:90,   hi:94,   Blo:490, Bhi:540 },
  { lo:85,   hi:89,   Blo:510, Bhi:560 },
  { lo:80,   hi:84,   Blo:530, Bhi:580 },
  { lo:null, hi:80,   Blo:550, Bhi:600 }
];
function rankBounds(origin){
  const s = origin[0] + origin[1] + origin[2] + origin[3];
  for(const r of RANKS){ if((r.lo === null || s >= r.lo) && (r.hi === null || s <= r.hi)) return r; }
  return RANKS[RANKS.length - 1];
}
function growthFor(origin, offset, D, B){
  const g = offset.map((d, i) => (origin[i] + d + D[i]) * B / 10000);
  return [4*g[0]+g[1]+g[2]+g[3], 0.1*g[0]+g[1]+0.1*g[2]+0.05*g[3], 0.1*g[0]+0.1*g[1]+g[2]+0.05*g[3], g[3]];
}
function growthRange(origin, bounds, list){
  if(!list || !list.length) return null;
  const mins = [Infinity,Infinity,Infinity,Infinity], maxs = [-Infinity,-Infinity,-Infinity,-Infinity];
  for(const m of list){
    for(const B of [bounds.Blo, bounds.Bhi]){
      const v = growthFor(origin, m.offset, m.bonus, B);
      for(let i=0; i<4; i++){ if(v[i] < mins[i]) mins[i] = v[i]; if(v[i] > maxs[i]) maxs[i] = v[i]; }
    }
  }
  return { mins, maxs, count:list.length };
}

/* ===== 데이터 ===== */
const STAT_LABELS = ["내구력","공격력","방어력","순발력"];
const GROW_LABELS = ["내구","공격","방어","순발"];
const GROW_KEYS = ["h","a","d","s"];
let PETS = [], byId = new Map(), RANKTAB = null, MAXG = [1,1,1,1,1];
const state = { sel:null, stat:[0,0,0,0] };
const totalOf = p => p.growthS[1] + p.growthS[2] + p.growthS[3];
function buildRanks(){
  RANKTAB = [0,1,2,3].map(i => PETS.map(p => p.growthS[i]));
  RANKTAB.push(PETS.map(totalOf));
  MAXG = RANKTAB.map(col => Math.max(...col, 0.0001));
}
const bar = (v, i) => `<span class="mb"><i style="width:${Math.max(3, Math.min(100, v/MAXG[i]*100)).toFixed(1)}%"></i></span>`;
const rankOf = (v, i) => 1 + RANKTAB[i].filter(x => x > v + 1e-9).length;

/* ===== 선택한 펫 ===== */
const VARIANT_ORDER = ["일반","환생","진화","환생·진화"];
function setSprite(p){
  const holder = $("hImg"); holder.innerHTML = "";
  if(!p.img) return;
  const img = new Image();
  img.alt = ""; img.referrerPolicy = "no-referrer"; img.decoding = "async";
  img.onerror = () => img.remove();
  img.src = p.img;
  holder.appendChild(img);
}
function renderHero(p){
  $("hName").textContent = p.name;
  const sibs = PETS.filter(x => x.group === p.group).sort((a, b) => VARIANT_ORDER.indexOf(a.variant) - VARIANT_ORDER.indexOf(b.variant));
  $("vTabs").innerHTML = sibs.length < 2 ? "" : sibs.map(x => `<button type="button" class="vtab" role="tab" data-id="${esc(x.id)}" aria-selected="${x.id === p.id}">${esc(x.variant)}</button>`).join("");
  $("hTags").innerHTML = (p.rideable ? '<span class="tag ride">탑승 가능</span>' : "") + (p.approx ? '<span class="tag">추정 데이터</span>' : "") + (!p.ok ? '<span class="tag">계산 미지원</span>' : "");
  $("hHow").textContent = p.detail ? "획득 방법: " + p.detail : "";
  $("hAttrs").innerHTML = p.attrs.map(([n, v]) => `<div class="attr-row"><span style="color:${ATTR_COLOR[n] || "var(--acc)"}">${esc(n)}</span><div class="track"><i style="width:${Number(v)*10}%;background:${ATTR_COLOR[n] || "var(--acc)"}"></i></div><span class="v">${esc(v)}/10</span></div>`).join("");
  $("hStats").innerHTML = GROW_KEYS.map((k, i) => `<tr class="${k}"><td>${GROW_LABELS[i]}</td><td class="g">${f3(p.growthS[i])}${bar(p.growthS[i], i)}</td><td class="rk">${rankOf(p.growthS[i], i)}위</td><td>${p.initS[i]}</td></tr>`).join("")
    + `<tr class="t"><td>총성장</td><td class="g">${f3(totalOf(p))}${bar(totalOf(p), 4)}</td><td class="rk">${rankOf(totalOf(p), 4)}위</td><td class="rk">공+방+순</td></tr>`;
  $("hRankNote").textContent = `순위는 전체 ${PETS.length}마리 중 성장률이 높은 순서예요`;
  $("dexLink").href = "pokedex.html#" + encodeURIComponent(p.id);
  setSprite(p);
}

/* ===== 펫 검색창 (자동완성) ===== */
function bindPicker(){
  const inp = $("pick"), box = $("suggest");
  let act = -1, hits = [];
  const close = () => { box.hidden = true; act = -1; };
  const choose = id => { inp.value = ""; close(); selectPet(id); inp.blur(); };
  const render = () => {
    const q = inp.value.trim();
    if(!q || !PETS.length){ close(); return; }
    const exp = expandClusters(q);
    hits = [];
    for(const p of PETS){ if(p.name.includes(q) || p._cho.includes(exp)){ hits.push(p); if(hits.length >= 10) break; } }
    box.hidden = false; act = hits.length ? 0 : -1;
    box.innerHTML = hits.length
      ? hits.map((p, i) => `<button type="button" class="sg${i === act ? " act" : ""}" role="option" data-id="${esc(p.id)}"><span>${esc(p.name)}</span><i>${p.attrs.map(a => esc(a[0] + a[1])).join(" ")}</i></button>`).join("")
      : '<div class="sg-empty">검색 결과가 없어요</div>';
  };
  inp.addEventListener("input", render);
  inp.addEventListener("focus", render);
  inp.addEventListener("keydown", e => {
    if(box.hidden) return;
    if(e.key === "ArrowDown" || e.key === "ArrowUp"){
      e.preventDefault();
      if(!hits.length) return;
      act = (act + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length;
      box.querySelectorAll(".sg").forEach((b, i) => b.classList.toggle("act", i === act));
    } else if(e.key === "Enter"){
      e.preventDefault();
      if(hits[act]) choose(hits[act].id);
    } else if(e.key === "Escape"){ close(); }
  });
  box.addEventListener("pointerdown", e => { const b = e.target.closest(".sg"); if(b){ e.preventDefault(); choose(b.dataset.id); } });
  document.addEventListener("click", e => { if(!e.target.closest(".pick")) close(); });
}

/* ===== 초기치 입력 ===== */
function renderStats(p){
  $("statGrid").innerHTML = STAT_LABELS.map((lbl, i) => `
    <div class="stat-box"><span class="slabel" id="sl-${i}">${lbl} <i>(S급 ${p.initS[i]})</i><b class="df" id="df-${i}"></b></span>
      <div class="stp" role="group" aria-labelledby="sl-${i}"><button type="button" class="sb" data-i="${i}" data-d="-1" aria-label="${lbl} 줄이기">−</button>
      <input class="si" type="number" inputmode="numeric" min="0" id="stat-${i}" value="${state.stat[i]}" ${p.ok ? "" : "disabled"}>
      <button type="button" class="sb" data-i="${i}" data-d="1" aria-label="${lbl} 늘리기">+</button></div></div>`).join("");
  $("calcBtn").disabled = !p.ok;
  updateExtras();
}
/* ===== 차이 표시와 초기치 모양(레이더) ===== */
function updateExtras(){
  const p = state.sel; if(!p) return;
  state.stat.forEach((v, i) => {
    const el = $("df-" + i); if(!el) return;
    const d = v - p.initS[i];
    el.className = "df " + (d === 0 ? "eq" : d > 0 ? "up" : "dn");
    el.textContent = d === 0 ? "S급과 같아요" : (d > 0 ? "+" : "−") + Math.abs(d);
  });
  drawRadar();
}
function drawRadar(){
  const p = state.sel, box = $("radar"); if(!p || !box) return;
  const S = p.initS, V = state.stat, cx = 130, cy = 118, R = 80;
  const ang = [-90, 0, 90, 180].map(a => a*Math.PI/180);
  const pt = (i, f) => [cx + Math.cos(ang[i])*R*f, cy + Math.sin(ang[i])*R*f];
  const poly = fs => [0,1,2,3].map(i => pt(i, fs[i]).map(n => n.toFixed(1)).join(",")).join(" ");
  const fv = [0,1,2,3].map(i => S[i] > 0 ? Math.min(1.25, V[i]/S[i])*0.8 : 0);
  const rings = [0.4, 0.8, 1.0].map(f => `<polygon points="${poly([f,f,f,f])}" class="rg"/>`).join("");
  const axes = [0,1,2,3].map(i => { const q = pt(i, 1); return `<line x1="${cx}" y1="${cy}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" class="ax"/>`; }).join("");
  const lab = (x, y, t, a) => `<text x="${x}" y="${y}" text-anchor="${a}" class="rl">${t}</text>`;
  box.innerHTML = `<svg viewBox="0 0 260 240" role="img" aria-label="입력한 초기치와 S급 초기치 비교">
    <defs><linearGradient id="rgd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5aa9f0" stop-opacity=".5"/><stop offset="1" stop-color="#3fc29a" stop-opacity=".4"/></linearGradient></defs>
    ${rings}${axes}
    <polygon points="${poly([0.8,0.8,0.8,0.8])}" class="rs"/>
    <polygon points="${poly(fv)}" class="ri"/>
    ${lab(cx, 22, "내구 " + V[0], "middle")}${lab(cx + R + 12, cy + 4, "공격 " + V[1], "start")}${lab(cx, cy + R + 24, "방어 " + V[2], "middle")}${lab(cx - R - 12, cy + 4, "순발 " + V[3], "end")}
  </svg>`;
}
let calcTimer = null;
function scheduleCalc(){ clearTimeout(calcTimer); calcTimer = setTimeout(runCalc, 150); }
function bumpStat(i, d){
  state.stat[i] = Math.max(0, state.stat[i] + d);
  const el = $("stat-" + i); if(el) el.value = state.stat[i];
  updateExtras();
  scheduleCalc();
}
let holdT = null, holdIv = null;
function stopHold(){ clearTimeout(holdT); clearInterval(holdIv); }
function bindStats(){
  const grid = $("statGrid");
  grid.addEventListener("pointerdown", e => {
    const b = e.target.closest(".sb"); if(!b) return;
    e.preventDefault(); stopHold();
    const i = Number(b.dataset.i), d = Number(b.dataset.d);
    bumpStat(i, d);
    holdT = setTimeout(() => { holdIv = setInterval(() => bumpStat(i, d), 70); }, 380);
  });
  window.addEventListener("pointerup", stopHold);
  window.addEventListener("pointercancel", stopHold);
  grid.addEventListener("click", e => { const b = e.target.closest(".sb"); if(b && e.detail === 0) bumpStat(Number(b.dataset.i), Number(b.dataset.d)); });
  grid.addEventListener("change", e => {
    const inp = e.target.closest(".si"); if(!inp) return;
    const i = Number(inp.id.replace("stat-", ""));
    const v = Math.max(0, Math.round(Number(inp.value) || 0));
    state.stat[i] = v; inp.value = v; updateExtras(); scheduleCalc();
  });
  $("calcBtn").addEventListener("click", e => {
    runCalc(); OHR.haptic(24);
    const c = state.res;
    if(c && c.total && c.counts[8]){ const r = e.currentTarget.getBoundingClientRect(); OHR.spark(r.left + r.width/2, r.top + r.height/2); }
  });
  $("resetBtn").addEventListener("click", () => {
    const p = state.sel; if(!p) return;
    state.stat = p.initS.slice();
    state.stat.forEach((v, i) => { const el = $("stat-" + i); if(el) el.value = v; });
    updateExtras();
    runCalc();
  });
  $("vTabs").addEventListener("click", e => {
    const b = e.target.closest(".vtab"); if(!b) return;
    selectPet(b.dataset.id);
  });
}

/* ===== 결과 ===== */
const gcol = g => `hsl(${Math.round((g + 8)/16*150)} 72% 70%)`;
function fun(eightPct, top){
  if(top < 0) return "등급이 마이너스대예요. 그래도 이 아이만의 매력이 있어요.";
  if(eightPct <= 0){
    if(top >= 6) return `환각(+8)은 아니지만 최고 ${top}등급까지 가능해요.`;
    if(top >= 3) return "무난한 개체예요. 키워도 손해는 없어요.";
    return "아쉽지만 다음에 더 좋은 펫을 만날 거예요.";
  }
  if(eightPct < 1) return "아주 희미하지만 환각 가능성이 있어요.";
  if(eightPct < 5) return "나쁘지 않은 확률이에요. 기대해볼 만해요.";
  if(eightPct < 15) return "꽤 괜찮은 확률이에요.";
  if(eightPct < 30) return "이 정도면 기대해도 돼요.";
  return "사실상 환각 확정급이에요.";
}
const calcCache = new Map();
function runCalc(){
  const p = state.sel;
  if(!p) return;
  if(!p.ok){ $("results").innerHTML = `<div class="empty">‘${esc(p.name)}’은(는) 원본계수가 없어서 계산을 지원하지 않아요.</div>`; return; }
  const key = p.id + "|" + state.stat.join(",");
  let c = calcCache.get(key);
  if(!c){
    c = computeGradeDist(p.origin, p.k, state.stat);
    calcCache.set(key, c);
    if(calcCache.size > 24) calcCache.delete(calcCache.keys().next().value);
  }
  state.res = c;
  renderResults(p, c);
}
function renderResults(p, c){
  const box = $("results");
  if(c.total === 0){
    const same = state.stat.every((v, i) => v === p.initS[i]);
    box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake");
    box.innerHTML = `<div class="empty">${same ? "참고 초기치와 맞는 조합을 찾지 못했어요. 참고 초기치는 실제 개체와 다를 수 있으니 레벨 1 실제 수치를 넣어주세요." : `입력한 초기치(${state.stat.join(" / ")})와 맞는 조합을 찾지 못했어요. 레벨 1 수치를 확인해 주세요.`}</div>`;
    return;
  }
  const top = GRADES.find(g => c.counts[g]);
  const eight = (c.counts[8] || 0)/c.total*100;
  let neg = 0;
  GRADES.forEach(g => { if(g < 0) neg += c.counts[g] || 0; });
  const rowFor = (label, n, g, hot) => {
    const pc = n/c.total*100;
    return `<div class="drow${hot ? " top" : ""}${n ? "" : " zero"}"><span class="gl">${label}</span><div class="gt"><div class="gf" style="width:${pc.toFixed(2)}%;background:${gcol(g)}"></div></div><span class="gp">${n ? pc.toFixed(1) + "%" : "–"}</span></div>`;
  };
  const rows = [8,7,6,5,4,3,2,1,0].map(g => rowFor(g + "등급", c.counts[g] || 0, g, g === top)).join("") + rowFor("−1 이하", neg, -4, top < 0);
  const b = rankBounds(p.origin);
  const rangeRows = GRADES.filter(g => c.counts[g]).map(g => {
    const r = growthRange(p.origin, b, c.matches[g]);
    const cells = [0,1,2,3].map(i => { const lo = r.mins[i].toFixed(3), hi = r.maxs[i].toFixed(3); return `<td>${lo === hi ? lo : lo + " ~ " + hi}</td>`; }).join("");
    return `<tr><td>${g}등급</td>${cells}<td>${r.count}건</td></tr>`;
  }).join("");
  box.innerHTML = `
    <div class="res-hero">
      <div class="res-card"><span class="res-l">최고 가능 등급</span><div class="res-v"><strong>${top}</strong><small>등급</small></div></div>
      <div class="res-card gold"><span class="res-l">+8 환각 확률</span><div class="res-v"><strong>${eight.toFixed(2)}</strong><small>%</small></div></div>
    </div>
    <p class="fun">${esc(fun(eight, top))}</p>
    ${p.approx ? '<p class="msg-warn">추정 데이터가 섞인 펫이라 결과는 참고용이에요.</p>' : ""}
    <div class="dist">${rows}</div>
    <details class="more"><summary>등급별 성장률 범위</summary><div class="body">
      <div class="tbl-wrap"><table class="t"><thead><tr><th>등급</th><th>내구</th><th>공격</th><th>방어</th><th>순발</th><th>일치</th></tr></thead><tbody>${rangeRows}</tbody></table></div>
      <p>각 일치 조합의 실제 보너스 분배를 넣고, 레벨업마다 새로 정해지는 보정계수 B를 RANK 범위(${b.Blo}~${b.Bhi}) 양끝으로 대입한 최소~최대 값이에요.</p>
    </div></details>
    <details class="more" id="combos"><summary>가능한 조합 보기</summary><div class="body">
      <select class="sel-grade" id="gradeSel" aria-label="등급 선택">${GRADES.filter(g => c.counts[g]).map(g => `<option value="${g}">${g}등급 (${c.counts[g]}개)</option>`).join("")}</select>
      <div class="tbl-wrap" id="comboTbl"></div>
    </div></details>`;
  box.querySelectorAll(".res-card").forEach((el, i) => { el.classList.add("pop"); el.style.animationDelay = (i*80) + "ms"; });
  const nums = box.querySelectorAll(".res-v strong");
  OHR.countUp(nums[0], top, 0, 450);
  OHR.countUp(nums[1], eight, 2, 650);
  const fillCombos = () => {
    const g = Number($("gradeSel").value), list = c.matches[g] || [], cap = 200;
    $("comboTbl").innerHTML = `<table class="t"><thead><tr><th>등급 보정(내/공/방/순)</th><th>보너스 분배</th><th>계산값(내림 전)</th></tr></thead><tbody>${list.slice(0, cap).map(m => `<tr><td>${m.offset.map(v => (v > 0 ? "+" : "") + v).join(" / ")}</td><td>${m.bonus.join(" / ")}</td><td>${m.raw.map(v => v.toFixed(3)).join(" / ")}</td></tr>`).join("")}</tbody></table>${list.length > cap ? `<p>${list.length}개 중 앞의 ${cap}개만 보여줘요.</p>` : ""}`;
  };
  $("gradeSel").addEventListener("change", fillCombos);
  $("combos").addEventListener("toggle", () => { if($("combos").open) fillCombos(); });
}

/* ===== 선택 ===== */
function selectPet(id, fromHash){
  const p = byId.get(id);
  if(!p) return;
  state.sel = p;
  state.stat = p.ok ? p.initS.slice() : [0,0,0,0];
  renderHero(p);
  renderStats(p);
  runCalc();
  if(!fromHash){ try{ history.replaceState(null, "", "#" + encodeURIComponent(p.id)); }catch(e){} }
}

function showNoData(msg){
  $("hName").textContent = "펫 데이터를 못 불러왔어요";
  $("hHow").textContent = msg;
  $("results").innerHTML = `<div class="empty">${esc(msg)}</div>`;
  $("calcBtn").disabled = true;
}

(async function init(){
  bindPicker(); bindStats();
  try{ PETS = await OHR.loadPets(); }
  catch(e){ showNoData("pets.json 파일을 불러오지 못했어요. 잠시 뒤에 다시 열어봐 주세요."); return; }
  if(!PETS.length){ showNoData("pets.json 안에 펫이 없어요."); return; }
  PETS.forEach(p => byId.set(p.id, p));
  buildRanks();
  const hash = decodeURIComponent((location.hash || "").slice(1));
  const first = byId.get(hash) || PETS.find(p => p.variant === "일반") || PETS[0];
  selectPet(first.id, true);
})();
})();
