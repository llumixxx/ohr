(function(){
"use strict";
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const smooth = () => !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
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
let PETS = [], byId = new Map(), GMAX = [10,3,3,3];
function norm(p){
  if(!p || !p.name) return null;
  const arr = (a, n) => (Array.isArray(a) && a.length === n) ? a.map(Number) : null;
  const g = arr(p.growthS, 4), i0 = arr(p.initS, 4), o = arr(p.origin, 4), k = Number(p.k);
  return {
    id:String(p.id), name:String(p.displayName || p.name), group:String(p.name), variant:String(p.variant || "일반"),
    attrs:Array.isArray(p.attrs) ? p.attrs : [], obtain:String(p.obtainDetail || p.obtain || ""),
    growthS:g || [0,0,0,0], initS:i0 || [0,0,0,0], origin:o, k:isFinite(k) ? k : null,
    rideable:!!p.rideable, approx:!!p.approx,
    ok:p.ok !== false && !!o && isFinite(k) && !!i0,
    img:String(p.assetImage || p.imageUrl || "")
  };
}
async function loadPets(){
  const res = await fetch("pets.json", { cache:"no-cache" });
  if(!res.ok) throw new Error("pets.json " + res.status);
  const d = await res.json();
  const rows = Array.isArray(d) ? d : (d && d.pets) || [];
  return rows.map(norm).filter(Boolean);
}

/* ===== 초성 검색 ===== */
const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
function chosung(str){
  let out = "";
  for(const ch of str){ const c = ch.charCodeAt(0) - 0xAC00; out += (c >= 0 && c <= 11171) ? CHO[Math.floor(c/588)] : ch; }
  return out;
}
const CLUSTER = { "ㄳ":"ㄱㅅ","ㄵ":"ㄴㅈ","ㄶ":"ㄴㅎ","ㄺ":"ㄹㄱ","ㄻ":"ㄹㅁ","ㄼ":"ㄹㅂ","ㄽ":"ㄹㅅ","ㄾ":"ㄹㅌ","ㄿ":"ㄹㅍ","ㅀ":"ㄹㅎ","ㅄ":"ㅂㅅ" };
const expandClusters = s => Array.from(s).map(ch => CLUSTER[ch] || ch).join("");

/* ===== 계기판 ===== */
const GA0 = -135, GA1 = 135;
function gpt(a, r){ const t = a*Math.PI/180; return [100 + r*Math.sin(t), 100 - r*Math.cos(t)]; }
function garc(r){ const p0 = gpt(GA0, r), p1 = gpt(GA1, r); return `M${p0[0].toFixed(2)} ${p0[1].toFixed(2)}A${r} ${r} 0 1 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`; }
function niceMax(x){
  if(!(x > 0)) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(x)));
  for(const m of [1,1.25,1.5,2,2.5,3,4,5,6,7.5,8,10]){ if(m*e >= x*1.04) return m*e; }
  return 10*e;
}
const tickTxt = (v, max) => max >= 10 ? String(Math.round(v)) : String(+v.toFixed(2));
function gaugeTicks(max){
  let s = "";
  for(let i=0; i<=20; i++){
    const a = GA0 + (GA1-GA0)*i/20, maj = i % 4 === 0;
    const p0 = gpt(a, maj ? 84 : 87), p1 = gpt(a, 95);
    s += `<line class="gtick${maj ? " maj" : ""}" x1="${p0[0].toFixed(1)}" y1="${p0[1].toFixed(1)}" x2="${p1[0].toFixed(1)}" y2="${p1[1].toFixed(1)}"/>`;
    if(maj){ const tp = gpt(a, 63); s += `<text class="gtxt" x="${tp[0].toFixed(1)}" y="${tp[1].toFixed(1)}">${tickTxt(max*i/20, max)}</text>`; }
  }
  return s;
}
const GAUGE_SVG = `<svg class="gsvg" viewBox="0 0 200 200" aria-hidden="true"><path class="gtrack" d="${garc(78)}"/><path class="gred" d="${garc(78)}" pathLength="100"/><path class="gfill" d="${garc(78)}" pathLength="100"/><g class="gticks"></g><g class="gneedle"><polygon points="97.5,110 100,28 102.5,110"/></g><circle class="ghub" cx="100" cy="100" r="9"/></svg>`;

const tweens = new WeakMap();
function tweenNum(el, to, ms, fmt){
  const from = Number(el.dataset.val || 0);
  el.dataset.val = String(to);
  const token = {}; tweens.set(el, token);
  if(!smooth() || ms <= 0 || from === to){ el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => {
    if(tweens.get(el) !== token) return;
    const q = Math.min(1, (now - t0)/ms), e = 1 - Math.pow(1 - q, 3);
    el.textContent = fmt(from + (to - from)*e);
    if(q < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function ensureGauges(){
  const box = $("hSpecs");
  if(box.firstElementChild) return;
  box.innerHTML = GROW_KEYS.map((k, i) => `
    <div class="sp ${k}" data-i="${i}">
      <div class="gwrap">${GAUGE_SVG}<div class="gnum"><span class="gv" data-val="0">0.000</span></div></div>
      <div class="t">${GROW_LABELS[i]} 성장률</div>
    </div>`).join("");
}
function updateGauges(p, anim){
  ensureGauges();
  GROW_KEYS.forEach((k, i) => {
    const card = $("hSpecs").querySelector(`.sp[data-i="${i}"]`);
    const max = GMAX[i];
    if(card.dataset.gmax !== String(max)){ card.dataset.gmax = String(max); card.querySelector(".gticks").innerHTML = gaugeTicks(max); }
    const frac = Math.max(0, Math.min(1, p.growthS[i]/max));
    card.querySelector(".gneedle").style.transform = `rotate(${GA0 + (GA1-GA0)*frac}deg)`;
    card.querySelector(".gfill").style.strokeDasharray = `${(frac*100).toFixed(2)} 100`;
    tweenNum(card.querySelector(".gv"), p.growthS[i], anim ? 800 : 0, f3);
  });
}

/* ===== 회전 전시대 ===== */
const fx = { spin:0, vel:0, drag:false, lastX:0 };
function initStage(){
  const st = $("stage"), pet = $("pet");
  st.addEventListener("pointerdown", e => { fx.drag = true; fx.lastX = e.clientX; fx.vel = 0; try{ st.setPointerCapture(e.pointerId); }catch(_e){} st.classList.add("grab"); });
  st.addEventListener("pointermove", e => { if(!fx.drag) return; const dx = e.clientX - fx.lastX; fx.lastX = e.clientX; fx.spin += dx*0.8; fx.vel = dx*0.8; });
  const end = () => { fx.drag = false; st.classList.remove("grab"); };
  st.addEventListener("pointerup", end); st.addEventListener("pointercancel", end);
  if(!smooth()) return;
  const t0 = performance.now();
  const frame = now => {
    const t = (now - t0)/1000;
    if(!fx.drag){
      if(Math.abs(fx.vel) > 0.05){ fx.spin += fx.vel; fx.vel *= 0.94; }
      else { fx.vel = 0; fx.spin += (Math.round(fx.spin/360)*360 - fx.spin)*0.06; }
    }
    st.style.setProperty("--ang", (fx.spin + t*7).toFixed(1));
    pet.style.transform = `perspective(900px) rotateY(${(fx.spin + Math.sin(t*0.8)*16).toFixed(1)}deg)`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* ===== 상태 ===== */
const state = { sel:null, stat:[0,0,0,0], q:"", attrs:new Set(), mode:"all", sortKey:"", sortDir:-1, favs:new Set(), res:null };
const FAV_KEY = "ohr-calc-favorites";
function loadFavs(){ try{ state.favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); }catch(e){ state.favs = new Set(); } }
function saveFavs(){ try{ localStorage.setItem(FAV_KEY, JSON.stringify([...state.favs])); }catch(e){} }

/* ===== 히어로 ===== */
const VARIANT_ORDER = ["일반","환생","진화","환생·진화"];
const ATTR_COLOR = { "지":"#5E9E52", "수":"#4F8FC0", "화":"#C24E3A", "풍":"#C9A227" };
function setSprite(p){
  const holder = $("hImg"); holder.innerHTML = "";
  if(!p.img) return;
  const img = new Image();
  img.alt = ""; img.referrerPolicy = "no-referrer"; img.decoding = "async";
  img.onerror = () => img.remove();
  img.src = p.img;
  holder.appendChild(img);
}
function renderHero(p, anim){
  $("hName").textContent = p.name;
  const sibs = PETS.filter(x => x.group === p.group).sort((a, b) => VARIANT_ORDER.indexOf(a.variant) - VARIANT_ORDER.indexOf(b.variant));
  $("vTabs").innerHTML = sibs.length < 2 ? "" : sibs.map(x => `<button type="button" class="vtab" role="tab" data-id="${esc(x.id)}" aria-selected="${x.id === p.id}">${esc(x.variant)}</button>`).join("");
  $("hTags").innerHTML = (p.rideable ? '<span class="tag ride">탑승 가능</span>' : "") + (p.approx ? '<span class="tag">추정 데이터</span>' : "") + (!p.ok ? '<span class="tag">계산 미지원</span>' : "");
  $("hHow").textContent = p.obtain ? "획득 방법: " + p.obtain : "";
  $("hAttrs").innerHTML = p.attrs.map(([n, v]) => `<div class="attr-row"><span style="color:${ATTR_COLOR[n] || "var(--acc)"}">${esc(n)}</span><div class="track"><i style="width:${Number(v)*10}%;background:${ATTR_COLOR[n] || "var(--acc)"}"></i></div><span class="v">${esc(v)}/10</span></div>`).join("");
  setSprite(p);
  updateGauges(p, anim);
}

/* ===== 초기치 입력 ===== */
function renderStats(p){
  $("statGrid").innerHTML = STAT_LABELS.map((lbl, i) => `
    <label class="stat-box"><span class="slabel">${lbl} <i>(참고 ${p.initS[i]})</i></span>
      <div class="stp"><button type="button" class="sb" data-i="${i}" data-d="-1" aria-label="${lbl} 줄이기">−</button>
      <input class="si" type="number" inputmode="numeric" min="0" id="stat-${i}" value="${state.stat[i]}" ${p.ok ? "" : "disabled"}>
      <button type="button" class="sb" data-i="${i}" data-d="1" aria-label="${lbl} 늘리기">+</button></div></label>`).join("");
  $("calcBtn").disabled = !p.ok;
}
let calcTimer = null;
function scheduleCalc(){ clearTimeout(calcTimer); calcTimer = setTimeout(runCalc, 150); }
function bumpStat(i, d){
  state.stat[i] = Math.max(0, state.stat[i] + d);
  const el = $("stat-" + i); if(el) el.value = state.stat[i];
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
    state.stat[i] = v; inp.value = v; scheduleCalc();
  });
  $("calcBtn").addEventListener("click", runCalc);
  $("resetBtn").addEventListener("click", () => {
    const p = state.sel; if(!p) return;
    state.stat = p.initS.slice();
    state.stat.forEach((v, i) => { const el = $("stat-" + i); if(el) el.value = v; });
    runCalc();
  });
}

/* ===== 결과 ===== */
const gcol = g => `hsl(${Math.round(10 + (g + 8)/16*130)} 62% 46%)`;
function fun(eightPct, top){
  if(top < 0) return "등급이 마이너스대예요. 그래도 이 아이만의 매력이 있어요.";
  if(eightPct <= 0){
    if(top >= 6) return `환각(+8)은 아니지만 최고 ${top}등급까지 가능해요.`;
    if(top >= 3) return "무난한 개체예요. 키워도 손해는 없어요.";
    return "아쉽지만 다음에 더 좋은 펫을 만날 거예요.";
  }
  if(eightPct < 1) return "아주 희미하지만 환각 가능성이 있어요.";
  if(eightPct < 5) return "나쁘지 않은 확률이에요. 기대해볼 만해요.";
  if(eightPct < 15) return "꽤 쏔쏔한 확률이에요.";
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
    box.innerHTML = `<div class="empty">${same ? "참고 초기치와 맞는 조합을 찾지 못했어요. 참고 초기치는 실제 개체와 다를 수 있으니 레벨 1 실제 수치를 넣어주세요." : `입력한 초기치(${state.stat.join(" / ")})와 맞는 조합을 찾지 못했어요. 레벨 1 수치를 확인해 주세요.`}</div>`;
    $("ghost").textContent = "";
    return;
  }
  const top = GRADES.find(g => c.counts[g]);
  const eight = (c.counts[8] || 0)/c.total*100;
  $("ghost").textContent = top;
  const rows = GRADES.filter(g => c.counts[g]).map(g => {
    const pc = c.counts[g]/c.total*100;
    return `<div class="drow${g === top ? " top" : ""}"><span class="gl">${g}등급</span><div class="gt"><div class="gf" style="width:${pc.toFixed(2)}%;background:${gcol(g)}"></div></div><span class="gp">${pc.toFixed(1)}%</span></div>`;
  }).join("");
  const b = rankBounds(p.origin);
  const rangeRows = GRADES.filter(g => c.counts[g]).map(g => {
    const r = growthRange(p.origin, b, c.matches[g]);
    const cells = [0,1,2,3].map(i => { const lo = r.mins[i].toFixed(3), hi = r.maxs[i].toFixed(3); return `<td>${lo === hi ? lo : lo + " ~ " + hi}</td>`; }).join("");
    return `<tr><td>${g}등급</td>${cells}<td>${r.count}건</td></tr>`;
  }).join("");
  box.innerHTML = `
    <div class="res-hero">
      <div class="big-card"><span>최고 가능 등급</span><strong>${top}<small>등급</small></strong></div>
      <div class="big-card prob"><span>+8 환각 확률</span><strong>${eight.toFixed(2)}<small>%</small></strong></div>
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
    </div></details>
    <details class="more"><summary>계산에 쓴 값</summary><div class="body">
      <p>원본계수(내구/공격/방어/순발) ${p.origin.join(" / ")}, 초기치 비율 k = ${p.k}, 원본계수 합 ${p.origin.reduce((s, v) => s + v, 0)}, 보정계수 B 범위 ${b.Blo}~${b.Bhi}</p>
      <p>총 ${c.total.toLocaleString()}개 조합이 입력과 맞았어요 (등급 보정 −2~+2 × 보너스 분배 10포인트, 전체 178,750가지 중).</p>
    </div></details>`;
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
  const changed = !state.sel || state.sel.group !== p.group;
  state.sel = p;
  state.stat = p.ok ? p.initS.slice() : [0,0,0,0];
  renderHero(p, true);
  renderStats(p);
  markCards();
  runCalc();
  if(!fromHash){ try{ history.replaceState(null, "", "#" + encodeURIComponent(p.id)); }catch(e){} }
  return changed;
}

/* ===== 목록 ===== */
const imgIO = ("IntersectionObserver" in window)
  ? new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ imgIO.unobserve(e.target); e.target.src = e.target.dataset.src; } }), { rootMargin:"300px 0px" })
  : null;
function matchesFilter(p, q){
  if(state.mode === "fav" && !state.favs.has(p.group)) return false;
  if(state.mode === "ride" && !p.rideable) return false;
  for(const a of state.attrs){ if(!p.attrs.some(x => x[0] === a)) return false; }
  if(!q) return true;
  return p.name.includes(q) || p._cho.includes(expandClusters(q));
}
function listPets(){
  const q = state.q.trim(), groups = new Map();
  for(const p of PETS){
    if(!matchesFilter(p, q)) continue;
    const cur = groups.get(p.group);
    if(!cur || p.variant === "일반") groups.set(p.group, p);
  }
  const list = [...groups.values()];
  if(state.sortKey){
    const m = p => state.sortKey === "total" ? p.growthS[1] + p.growthS[2] + p.growthS[3] : p.growthS[Number(state.sortKey)];
    list.sort((a, b) => (m(a) - m(b))*state.sortDir || a.name.localeCompare(b.name, "ko"));
  }
  return list;
}
function renderGrid(){
  const list = listPets();
  $("count").textContent = `${list.length} / ${new Set(PETS.map(p => p.group)).size}종`;
  if(imgIO) imgIO.disconnect();
  if(!list.length){ $("grid").innerHTML = `<div class="empty" style="grid-column:1/-1">${state.mode === "fav" ? "즐겨찾기한 펫이 없어요. 카드의 ☆를 눌러 추가해보세요." : "조건에 맞는 펫이 없어요."}</div>`; return; }
  $("grid").innerHTML = list.map(p => {
    const fav = state.favs.has(p.group);
    return `<div class="card">
      <button type="button" class="card-main" data-id="${esc(p.id)}" aria-pressed="${state.sel ? state.sel.group === p.group : false}">
        <span class="cimg">${p.img ? `<img data-src="${esc(p.img)}" alt="" referrerpolicy="no-referrer" decoding="async">` : ""}</span>
        <span class="cname">${esc(p.name)}</span>
        <span class="cmini">${p.attrs.map(([n, v]) => `<i style="color:${ATTR_COLOR[n] || "inherit"}">${esc(n)}${esc(v)}</i>`).join("")}</span>
        ${p.rideable ? '<span class="ctag">탑승</span>' : ""}${p.approx ? '<span class="cwarn">추정</span>' : (p.ok ? "" : '<span class="cwarn">미지원</span>')}
      </button>
      <button type="button" class="star${fav ? " on" : ""}" data-fav="${esc(p.group)}" aria-pressed="${fav}" aria-label="즐겨찾기">${fav ? "★" : "☆"}</button>
    </div>`;
  }).join("");
  $("grid").querySelectorAll("img[data-src]").forEach(im => {
    im.onerror = () => im.remove();
    if(imgIO) imgIO.observe(im); else im.src = im.dataset.src;
  });
}
function markCards(){
  document.querySelectorAll(".card-main").forEach(c => {
    const p = byId.get(c.dataset.id);
    c.setAttribute("aria-pressed", String(!!(p && state.sel && p.group === state.sel.group)));
  });
}

function bindControls(){
  $("chips").innerHTML = ["지","수","화","풍"].map(a => `<button type="button" class="chip" data-attr="${a}" aria-pressed="false" style="color:${ATTR_COLOR[a]}">${a}</button>`).join("");
  $("chips").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if(!b) return;
    const a = b.dataset.attr;
    if(state.attrs.has(a)){ state.attrs.delete(a); b.setAttribute("aria-pressed", "false"); } else { state.attrs.add(a); b.setAttribute("aria-pressed", "true"); }
    renderGrid();
  });
  $("modes").addEventListener("click", e => {
    const b = e.target.closest(".segb"); if(!b) return;
    state.mode = b.dataset.mode;
    $("modes").querySelectorAll(".segb").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    renderGrid();
  });
  $("sorts").addEventListener("click", e => {
    const b = e.target.closest(".segb"); if(!b) return;
    if(state.sortKey === b.dataset.sort) state.sortDir *= -1; else { state.sortKey = b.dataset.sort; state.sortDir = -1; }
    $("sorts").querySelectorAll(".segb").forEach(x => { x.setAttribute("aria-pressed", String(x === b)); x.dataset.dir = x === b ? (state.sortDir < 0 ? "▼" : "▲") : ""; x.textContent = x.textContent.replace(/ [▼▲]$/, "") + (x.dataset.dir ? " " + x.dataset.dir : ""); });
    renderGrid();
  });
  $("search").addEventListener("input", e => { state.q = e.target.value; renderGrid(); });
  $("grid").addEventListener("click", e => {
    const star = e.target.closest(".star");
    if(star){
      const g = star.dataset.fav;
      if(state.favs.has(g)) state.favs.delete(g); else state.favs.add(g);
      saveFavs(); renderGrid();
      return;
    }
    const m = e.target.closest(".card-main"); if(!m) return;
    selectPet(m.dataset.id);
    $("hero").scrollIntoView({ behavior: smooth() ? "smooth" : "auto", block:"start" });
  });
  $("vTabs").addEventListener("click", e => {
    const b = e.target.closest(".vtab"); if(!b) return;
    selectPet(b.dataset.id);
  });
  bindStats();
}

/* ===== 테마 ===== */
function initTheme(){
  const btn = $("themeBtn");
  let t = null;
  try{ t = localStorage.getItem("ohr-theme"); }catch(e){}
  if(!t) t = (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  const apply = v => { document.documentElement.setAttribute("data-theme", v); btn.textContent = v === "dark" ? "라이트 모드" : "다크 모드"; };
  apply(t);
  btn.onclick = () => {
    const v = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    apply(v); try{ localStorage.setItem("ohr-theme", v); }catch(e){}
  };
}

function showNoData(msg){
  $("hName").textContent = "펫 데이터가 아직 없어요";
  $("hHow").textContent = msg;
  $("results").innerHTML = `<div class="empty">${esc(msg)}</div>`;
  $("grid").innerHTML = `<div class="empty" style="grid-column:1/-1">${esc(msg)}</div>`;
  $("calcBtn").disabled = true;
}

(async function init(){
  initTheme(); loadFavs(); bindControls(); initStage();
  try{ PETS = await loadPets(); }
  catch(e){ showNoData("pets.json 파일을 불러오지 못했어요. 같은 폴더에 펫 데이터 파일이 있는지 확인해 주세요."); return; }
  if(!PETS.length){ showNoData("pets.json 안에 펫이 없어요."); return; }
  PETS.forEach(p => { p._cho = chosung(p.name); byId.set(p.id, p); });
  GMAX = [0,1,2,3].map(i => niceMax(Math.max(...PETS.map(p => p.growthS[i]))));
  renderGrid();
  const hash = decodeURIComponent((location.hash || "").slice(1));
  const first = byId.get(hash) || listPets()[0];
  if(first) selectPet(first.id, true);
})();
})();
