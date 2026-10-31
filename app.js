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
  updateExtras();
}
/* ===== 입력값과 S급의 차이 표시 ===== */
function updateExtras(){
  const p = state.sel; if(!p) return;
  state.stat.forEach((v, i) => {
    const el = $("df-" + i); if(!el) return;
    const d = v - p.initS[i];
    el.className = "df " + (d === 0 ? "eq" : d > 0 ? "up" : "dn");
    el.textContent = d === 0 ? "0" : (d > 0 ? "+" : "−") + Math.abs(d);
  });
}
let calcTimer = null, calcLast = 0;
function scheduleCalc(){
  if(calcTimer) return;
  const wait = Math.max(0, 90 - (performance.now() - calcLast));
  calcTimer = setTimeout(() => { calcTimer = null; calcLast = performance.now(); runCalc(); }, wait);
}
const bumpEl = el => { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); };
function bumpStat(i, d){
  state.stat[i] = Math.max(0, state.stat[i] + d);
  const el = $("stat-" + i); if(el){ el.value = state.stat[i]; bumpEl(el); }
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
    queueMods();
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
  const nums = box.querySelectorAll(".res-v strong");
  OHR.countUp(nums[0], top, 0, 220);
  OHR.countUp(nums[1], eight, 2, 300);
  queueMods();
  const fillCombos = () => {
    const g = Number($("gradeSel").value), list = c.matches[g] || [], cap = 200;
    $("comboTbl").innerHTML = `<table class="t"><thead><tr><th>등급 보정(내/공/방/순)</th><th>보너스 분배</th><th>계산값(내림 전)</th></tr></thead><tbody>${list.slice(0, cap).map(m => `<tr><td>${m.offset.map(v => (v > 0 ? "+" : "") + v).join(" / ")}</td><td>${m.bonus.join(" / ")}</td><td>${m.raw.map(v => v.toFixed(3)).join(" / ")}</td></tr>`).join("")}</tbody></table>${list.length > cap ? `<p>${list.length}개 중 앞의 ${cap}개만 보여줘요.</p>` : ""}`;
  };
  $("gradeSel").addEventListener("change", fillCombos);
  $("combos").addEventListener("toggle", () => { if($("combos").open) fillCombos(); });
}

/* ===== 최근 계산, +- 미리보기 ===== */
const HKEY = "ohr-hist";
const loadHist = () => { try{ return JSON.parse(localStorage.getItem(HKEY) || "[]"); }catch(e){ return []; } };
const saveHist = a => { try{ localStorage.setItem(HKEY, JSON.stringify(a.slice(0, 6))); }catch(e){} };
function quick(p, stat){
  const key = p.id + "|" + stat.join(",");
  let c = calcCache.get(key);
  if(!c){ c = computeGradeDist(p.origin, p.k, stat); calcCache.set(key, c); if(calcCache.size > 40) calcCache.delete(calcCache.keys().next().value); }
  const top = GRADES.find(g => c.counts[g]);
  return { total:c.total, top, eight: c.total ? (c.counts[8] || 0)/c.total*100 : 0 };
}
let modTimer = null, wiToken = 0, wiData = null;
function queueMods(){
  clearTimeout(modTimer);
  modTimer = setTimeout(() => {
    const p = state.sel, c = state.res;
    if(p && c && c.total && state.stat.some((v, i) => v !== p.initS[i])){
      const r = quick(p, state.stat);
      const e = { id:p.id, name:p.name, stat:state.stat.slice(), top:r.top, eight:+r.eight.toFixed(2) };
      saveHist([e, ...loadHist().filter(x => !(x.id === e.id && x.stat.join() === e.stat.join()))]);
    }
    runWhatIf();
  }, 350);
}
function runWhatIf(){
  const p = state.sel; if(!p || !p.ok){ wiData = null; renderMods(); return; }
  const token = ++wiToken, base = state.stat.slice(), jobs = [];
  for(let i = 0; i < 4; i++) for(const d of [-1, 1]) jobs.push([i, d]);
  const out = { base:quick(p, base), cells:{} };
  const step = () => {
    if(token !== wiToken) return;
    const j = jobs.shift();
    if(!j){ wiData = out; renderMods(); return; }
    const s = base.slice(); s[j[0]] = Math.max(0, s[j[0]] + j[1]);
    out.cells[j[0] + "|" + j[1]] = quick(p, s);
    setTimeout(step, 0);
  };
  step();
}
function renderMods(){
  const box = $("xmods"); if(!box) return;
  let html = "";
  {
    const h = loadHist();
    html += `<div class="xm"><div class="xm-h"><b>최근 계산</b>${h.length ? '<button type="button" class="lnk" id="histClear">지우기</button>' : ""}</div>` + (h.length
      ? `<div class="hist">${h.slice(0, 4).map((e, i) => `<button type="button" class="hrow" data-i="${i}"><span class="hn">${esc(e.name)}</span><span class="hs">${e.stat.join(" · ")}</span><span class="hr">${e.top}등급 · ${e.eight.toFixed(1)}%</span></button>`).join("")}</div>`
      : '<p class="xm-empty">값을 바꿔서 계산하면 여기에 쌓여요. 누르면 그 값으로 돌아가요.</p>') + "</div>";
  }
  {
    html += `<div class="xm"><div class="xm-h"><b>+- 미리보기</b><span class="xm-s">+8 확률</span></div>`;
    if(!wiData){ html += '<p class="xm-empty">계산 중이에요…</p></div>'; }
    else {
      const cells = [];
      for(let i = 0; i < 4; i++) for(const d of [-1, 1]) cells.push({ k:i + "|" + d, v:wiData.cells[i + "|" + d] });
      const best = cells.reduce((m, c) => (c.v && c.v.total && c.v.eight > (m ? m.v.eight : -1)) ? c : m, null);
      const cell = (i, d) => {
        const v = wiData.cells[i + "|" + d];
        const on = best && best.k === i + "|" + d && (v.eight > wiData.base.eight || !wiData.base.total);
        return `<td class="${on ? "best" : ""}">${v && v.total ? v.eight.toFixed(1) + "%" : "–"}</td>`;
      };
      html += `<table class="wi"><thead><tr><th></th><th>−1</th><th>지금</th><th>+1</th></tr></thead><tbody>${[0,1,2,3].map(i => `<tr class="${GROW_KEYS[i]}"><td>${GROW_LABELS[i]}</td>${cell(i, -1)}<td class="now">${wiData.base.total ? wiData.base.eight.toFixed(1) + "%" : "–"}</td>${cell(i, 1)}</tr>`).join("")}</tbody></table>`;
      const who = best ? GROW_LABELS[Number(best.k[0])] + "이(가) " + (best.k.endsWith("-1") ? "1 낮으면" : "1 높으면") : "";
      html += !wiData.base.total
        ? (best ? `<p class="xm-note">지금 값과 맞는 조합이 없어요. ${who} 맞아요 (+8 확률 <b>${best.v.eight.toFixed(1)}%</b>).</p>` : '<p class="xm-note">한 칸 차이로 맞는 조합도 없어요. 레벨 1 수치를 다시 확인해 주세요.</p>')
        : (best && best.v.eight > wiData.base.eight
          ? `<p class="xm-note">${GROW_LABELS[Number(best.k[0])]}이(가) ${best.k.endsWith("-1") ? "1 낮았다면" : "1 높았다면"} +8 확률이 <b>${best.v.eight.toFixed(1)}%</b>예요.</p>`
          : '<p class="xm-note">지금 입력이 가장 좋은 조합이에요.</p>');
      html += "</div>";
    }
  }
  box.innerHTML = html;
  const clr = $("histClear"); if(clr) clr.onclick = () => { saveHist([]); renderMods(); };
  box.querySelectorAll(".hrow").forEach(b => b.onclick = () => {
    const e = loadHist()[Number(b.dataset.i)]; if(!e) return;
    selectPet(e.id);
    state.stat = e.stat.slice();
    state.stat.forEach((v, i) => { const el = $("stat-" + i); if(el){ el.value = v; bumpEl(el); } });
    updateExtras(); runCalc();
  });
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
