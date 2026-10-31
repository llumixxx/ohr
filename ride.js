(function(){
"use strict";
const { $, esc } = OHR;
const KEY = "ohr-ride";
const S = { tab:"rank", base:[0,0,0], lv:100, sort:"sum", reborn:false, points:0, prio:"a", min:[0,0,0], goal:[0,0,0], equip:[0,0,0] };
let PETS = [];
try{ Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); }catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} };
const fix = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const NAMES = [["완력", "공격"], ["건강", "방어"], ["스피드", "순발"]];
const TABS = [["rank", "랭킹"], ["plan", "포인트 세팅"], ["goal", "목표 맞추기"]];
const SORTS = [["sum", "합계"], ["a", "공격"], ["d", "방어"], ["s", "순발"]];
const PRIOS = [["a", "공격"], ["d", "방어"], ["s", "순발"], ["bal", "균형"]];
const SUBS = {
  rank:"내 캐릭터 기본치 기준으로, 펫을 타면 능력치가 얼마나 오르고 내리는지 보여줘요",
  plan:"총 포인트를 완력·건강·스피드에 어떻게 나누면 좋은지, 어떤 펫과 조합이 가장 좋은지 보여줘요",
  goal:"원하는 탑승 능력치를 정하면, 필요한 포인트가 적게 드는 펫 순서로 보여줘요"
};
const HELPS = {
  rank:"탑승 능력치 = 표시값 + 0.3 × (펫 − 내 기본치). 내구는 계산에 쓰지 않아요.",
  plan:"탑승 능력치 = 장비 + 0.7 × 내 기본치 + 0.3 × 펫. 포인트 1은 기본치 1로 계산해요. 최소 보장을 먼저 채우고, 남는 포인트를 우선순위에 써요.",
  goal:"필요한 기본치 = (목표 − 장비 − 0.3 × 펫) ÷ 0.7. 포인트 1은 기본치 1로 계산해요."
};

/* ===== 입력칸 목록: id → [상태 이름, 순번, 최소, 최대] ===== */
const FIELDS = { rlv:["lv", null, 1, 250], rpt:["points", null, 0, 99999] };
[0, 1, 2].forEach(i => { FIELDS["rb" + i] = ["base", i, 0, 99999]; FIELDS["rm" + i] = ["min", i, 0, 99999]; FIELDS["rg" + i] = ["goal", i, 0, 99999]; FIELDS["re" + i] = ["equip", i, 0, 99999]; });
const getF = id => { const f = FIELDS[id]; return f[1] === null ? S[f[0]] : S[f[0]][f[1]]; };
const setF = (id, v) => { const f = FIELDS[id], x = fix(v, f[2], f[3]); if(f[1] === null) S[f[0]] = x; else S[f[0]][f[1]] = x; return x; };

/* ===== 보여줄 펫 목록 (탑승 가능만). 환생과 진화는 능력치가 같으면 한 줄로 합춰요 ===== */
function buildRows(){
  const rows = PETS.filter(p => p.rideable && p.variant === "일반").map(p => ({ p, label:p.name, tag:"" }));
  if(S.reborn){
    const m = new Map();
    for(const p of PETS){
      if(!p.rideable || p.variant === "일반") continue;
      const key = p.group + "|" + p.growthS.join() + "|" + p.initS.join();
      const e = m.get(key);
      if(e) e.vars.add(p.variant); else m.set(key, { p, vars:new Set([p.variant]) });
    }
    for(const { p, vars } of m.values()) rows.push({ p, label:p.group, tag:[...vars].join("/") });
  }
  return rows;
}
/* 펫 능력치 = 초기치 + 성장률 × (레벨 - 1) */
const petStats = p => [1, 2, 3].map(i => p.initS[i] + p.growthS[i]*(S.lv - 1));
const fmt = v => (v > 0.05 ? "+" : v < -0.05 ? "−" : "") + Math.abs(v).toFixed(1);
const cls = v => v > 0.05 ? "up" : v < -0.05 ? "dn" : "z";
const nameCell = r => `<div class="rd-name"><b>${esc(r.label)}${r.tag ? `<span class="rd-tag">${esc(r.tag)}</span>` : ""}</b><small>${esc(r.p.detail)}</small><span class="rd-abs">펫 공 ${Math.floor(r.pet[0])} · 방 ${Math.floor(r.pet[1])} · 순 ${Math.floor(r.pet[2])}</span></div>`;
const rowOpen = (r, i) => `<a class="rd-row${i < 3 ? " r" + (i + 1) : ""}" href="pokedex.html#${encodeURIComponent(r.p.id)}"><span class="rd-rank">${i + 1}</span><div class="rd-img">${OHR.imgTag(r.p)}</div>${nameCell(r)}`;

/* ===== 탭 1: 랭킹 ===== */
function renderRank(){
  const rows = buildRows().map(r => { const pet = petStats(r.p), d = pet.map((v, i) => 0.3*(v - S.base[i])); return Object.assign(r, { pet, d, sum:d[0] + d[1] + d[2] }); });
  const key = S.sort === "a" ? r => r.d[0] : S.sort === "d" ? r => r.d[1] : S.sort === "s" ? r => r.d[2] : r => r.sum;
  rows.sort((x, y) => key(y) - key(x) || y.sum - x.sum);
  $("rdTitle").textContent = `탑승 가능 펫 ${rows.length}마리`;
  warn(S.base.some(v => v > 0) ? "" : "내 기본치를 넣으면 정확해져요");
  $("rdList").innerHTML = rows.map((r, i) => rowOpen(r, i) + `
      <div class="rd-d"><span class="a"><i>공격</i><b class="${cls(r.d[0])}">${fmt(r.d[0])}</b></span><span class="d"><i>방어</i><b class="${cls(r.d[1])}">${fmt(r.d[1])}</b></span><span class="s"><i>순발</i><b class="${cls(r.d[2])}">${fmt(r.d[2])}</b></span></div>
      <div class="rd-sum"><small>합계</small><b class="${cls(r.sum)}">${fmt(r.sum)}</b></div></a>`).join("") || '<div class="empty">조건에 맞는 펫이 없어요.</div>';
}

/* ===== 탭 2: 포인트 세팅 ===== */
function plan(pet){
  const e = S.equip, m = S.min, T = S.points;
  const req = [0, 1, 2].map(i => m[i] > 0 ? Math.max(0, Math.ceil((m[i] - e[i] - 0.3*pet[i])/0.7 - 1e-9)) : 0);
  const need = req[0] + req[1] + req[2];
  if(need > T) return { ok:false, short:need - T };
  const left = T - need, b = req.slice();
  if(S.prio === "bal"){
    /* 세 능력치의 탑승 수치가 최대한 비슷해지도록 낮은 쪽부터 채워요 */
    const c = [0, 1, 2].map(i => e[i] + 0.3*pet[i] + 0.7*req[i]);
    const idx = [0, 1, 2].sort((x, y) => c[x] - c[y]), rem = left*0.7;
    let R = 0, k = 1;
    for(k = 1; k <= 3; k++){
      const s = idx.slice(0, k).reduce((a, j) => a + c[j], 0);
      R = (rem + s)/k;
      if(k === 3 || R <= c[idx[k]]) break;
    }
    const add = [0, 0, 0];
    idx.slice(0, k).forEach(j => { add[j] = Math.max(0, (R - c[j])/0.7); });
    const fl = add.map(Math.floor), rest = left - fl.reduce((a, v) => a + v, 0);
    const order = [0, 1, 2].sort((x, y) => (add[y] - fl[y]) - (add[x] - fl[x]));
    for(let t = 0; t < rest; t++) fl[order[t % 3]]++;
    for(let i = 0; i < 3; i++) b[i] += fl[i];
  } else {
    b[S.prio === "a" ? 0 : S.prio === "d" ? 1 : 2] += left;
  }
  const ride = [0, 1, 2].map(i => e[i] + 0.7*b[i] + 0.3*pet[i]);
  const sum = ride[0] + ride[1] + ride[2];
  const hot = S.prio === "a" ? 0 : S.prio === "d" ? 1 : S.prio === "s" ? 2 : -1;
  return { ok:true, b, ride, sum, hot, score:hot < 0 ? Math.min(...ride) : ride[hot] };
}
function renderPlan(){
  const ok = [];
  let skip = 0;
  for(const r of buildRows()){
    const pet = petStats(r.p), pl = plan(pet);
    if(pl.ok) ok.push(Object.assign(r, { pet }, pl)); else skip++;
  }
  ok.sort((x, y) => y.score - x.score || y.sum - x.sum);
  $("rdTitle").textContent = `추천 세팅 ${ok.length}마리` + (skip ? ` (포인트 부족 ${skip}마리 제외)` : "");
  warn(S.points > 0 ? "" : "총 포인트를 넣어주세요");
  const key = ["a", "d", "s"], nm = ["완력", "건강", "스피드"], lb = ["공격", "방어", "순발"];
  $("rdList").innerHTML = ok.map((r, i) => rowOpen(r, i) + `
      <div class="rd-d">${[0, 1, 2].map(j => `<span class="${key[j]}${r.hot === j ? " hot" : ""}"><i>${lb[j]}</i><b>${Math.floor(r.ride[j])}</b><em>${nm[j]} ${r.b[j]}</em></span>`).join("")}</div>
      <div class="rd-sum"><small>${r.hot < 0 ? "가장 낮은 수치" : "합계"}</small><b>${Math.floor(r.hot < 0 ? r.score : r.sum)}</b></div></a>`).join("")
    || `<div class="empty">${S.points > 0 ? "최소 보장을 모두 맞추는 펫이 없어요. 포인트를 늘리거나 최소 보장을 낮춰보세요." : "총 포인트를 넣으면 추천 세팅이 나와요."}</div>`;
}

/* ===== 탭 3: 목표 맞추기 ===== */
function renderGoal(){
  const G = S.goal, e = S.equip, T = S.points, has = G.some(v => v > 0);
  const rows = buildRows().map(r => {
    const pet = petStats(r.p);
    const need = [0, 1, 2].map(i => G[i] > 0 ? Math.max(0, Math.ceil((G[i] - e[i] - 0.3*pet[i])/0.7 - 1e-9)) : 0);
    const ride = [0, 1, 2].map(i => e[i] + 0.3*pet[i]);
    return Object.assign(r, { pet, need, total:need[0] + need[1] + need[2], ride, sum:ride[0] + ride[1] + ride[2] });
  });
  rows.sort((x, y) => x.total - y.total || y.sum - x.sum);
  $("rdTitle").textContent = "필요 포인트가 적은 순서";
  warn(has ? "" : "목표 능력치를 넣어주세요");
  const key = ["a", "d", "s"], nm = ["완력", "건강", "스피드"];
  $("rdList").innerHTML = !has ? '<div class="empty">왼쪽에 목표 능력치를 넣으면, 그걸 맞추는 데 필요한 포인트가 적게 드는 펫부터 보여줘요.</div>' : rows.map((r, i) => rowOpen(r, i) + `
      <div class="rd-d">${[0, 1, 2].map(j => `<span class="${key[j]}"><i>필요 ${nm[j]}</i><b>${r.need[j]}</b></span>`).join("")}</div>
      <div class="rd-sum"><small>필요 포인트</small><b>${r.total}</b>${T > 0 ? (r.total <= T ? '<span class="rd-badge ok">가능</span>' : `<span class="rd-badge no">${r.total - T} 부족</span>`) : ""}</div></a>`).join("");
}

function warn(t){ const w = $("rdWarn"); w.textContent = t; w.hidden = !t; }
function render(){
  if(!PETS.length) return;
  (S.tab === "plan" ? renderPlan : S.tab === "goal" ? renderGoal : renderRank)();
  OHR.lazy($("rdList"));
}
function showTab(){
  $("rdSub").textContent = SUBS[S.tab];
  $("rdHelp").textContent = HELPS[S.tab];
  $("rdTabs").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === S.tab));
  let first = true;
  $("rdCtl").querySelectorAll("section").forEach(sec => {
    const on = sec.dataset.t.split(" ").indexOf(S.tab) >= 0;
    sec.hidden = !on;
    sec.classList.toggle("first", on && first);
    if(on) first = false;
  });
}

/* ===== 입력 칸 만들기 ===== */
function stepper(id, label){
  const f = FIELDS[id];
  return `<div class="stat-box"><span class="slabel">${label}</span><div class="stp"><button type="button" class="sb" data-t="${id}" data-d="-1" aria-label="${label.replace(/<[^>]+>/g, "")} 줄이기">−</button><input class="si" type="number" inputmode="numeric" id="${id}" min="${f[2]}" max="${f[3]}" value="${getF(id)}"><button type="button" class="sb" data-t="${id}" data-d="1" aria-label="${label.replace(/<[^>]+>/g, "")} 늘리기">+</button></div></div>`;
}
const segHTML = (list, cur) => list.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === cur ? "on" : ""}">${l}</button>`).join("");
function buildControls(){
  const three = (pre, lab) => [0, 1, 2].map(i => stepper(pre + i, lab(i))).join("");
  $("rdTabs").innerHTML = segHTML(TABS, S.tab);
  $("rdBase").innerHTML = three("rb", i => `${NAMES[i][0]} <i>(${NAMES[i][1]})</i>`);
  $("rdPtBox").innerHTML = stepper("rpt", "포인트");
  $("rdLvBox").innerHTML = stepper("rlv", "레벨");
  $("rdSort").innerHTML = segHTML(SORTS, S.sort);
  $("rdPrio").innerHTML = segHTML(PRIOS, S.prio);
  $("rdMinBox").innerHTML = three("rm", i => NAMES[i][1]);
  $("rdGoalBox").innerHTML = three("rg", i => NAMES[i][1]);
  $("rdEquipBox").innerHTML = three("re", i => NAMES[i][1]);
  $("rdReborn").checked = S.reborn;

  let holdT = null, holdIv = null;
  const stop = () => { clearTimeout(holdT); clearInterval(holdIv); };
  const setVal = (id, v) => {
    const x = setF(id, v), el = $(id);
    el.value = x; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
    save(); render();
  };
  $("rdCtl").addEventListener("pointerdown", e => {
    const b = e.target.closest(".sb"); if(!b) return;
    e.preventDefault(); stop();
    const id = b.dataset.t, d = Number(b.dataset.d);
    setVal(id, getF(id) + d);
    holdT = setTimeout(() => { holdIv = setInterval(() => setVal(id, getF(id) + d), 70); }, 380);
  });
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  $("rdCtl").addEventListener("click", e => { const b = e.target.closest(".sb"); if(b && e.detail === 0) setVal(b.dataset.t, getF(b.dataset.t) + Number(b.dataset.d)); });
  $("rdCtl").addEventListener("change", e => { const inp = e.target.closest(".si"); if(inp) setVal(inp.id, inp.value); });
  const seg = (box, key) => $(box).addEventListener("click", e => {
    const b = e.target.closest("button"); if(!b) return;
    S[key] = b.dataset.v; save();
    $(box).querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    if(key === "tab") showTab();
    render();
  });
  seg("rdTabs", "tab"); seg("rdSort", "sort"); seg("rdPrio", "prio");
  $("rdReborn").addEventListener("change", e => { S.reborn = e.target.checked; save(); render(); });
}

(async function init(){
  ["base", "min", "goal", "equip"].forEach(k => { S[k] = Array.isArray(S[k]) && S[k].length === 3 ? S[k].map(v => fix(v, 0, 99999)) : [0, 0, 0]; });
  S.lv = fix(S.lv || 100, 1, 250); S.points = fix(S.points, 0, 99999);
  if(!TABS.some(t => t[0] === S.tab)) S.tab = "rank";
  if(!PRIOS.some(t => t[0] === S.prio)) S.prio = "a";
  buildControls(); showTab();
  try{ PETS = await OHR.loadPets(); }
  catch(e){ $("rdList").innerHTML = '<div class="empty">pets.json 파일을 불러오지 못했어요. 잠시 뒤에 다시 열어봐 주세요.</div>'; return; }
  render();
})();
})();
