(function(){
"use strict";
const { $, esc } = OHR;
const KEY = "ohr-ride";
const S = { base:[0,0,0], lv:100, sort:"sum", reborn:false };
let PETS = [];
try{ Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); }catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} };
const fix = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const NAMES = [["완력", "공격"], ["건강", "방어"], ["스피드", "순발"]];
const SORTS = [["sum", "합계"], ["a", "공격"], ["d", "방어"], ["s", "순발"]];

/* 보여줄 펫 목록 (탑승 가능만). 환생과 진화는 능력치가 같으면 한 줄로 합쳐요 */
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
/* 펫 능력치 = 초기치 + 성장률 × (레벨 - 1), 탑승 변화량 = 0.3 × (펫 - 내 기본치) */
function calc(row){
  const p = row.p, pet = [1,2,3].map(i => p.initS[i] + p.growthS[i]*(S.lv - 1));
  const d = pet.map((v, i) => 0.3*(v - S.base[i]));
  return { pet, d, sum:d[0] + d[1] + d[2] };
}
const fmt = v => (v > 0.05 ? "+" : v < -0.05 ? "−" : "") + Math.abs(v).toFixed(1);
const cls = v => v > 0.05 ? "up" : v < -0.05 ? "dn" : "z";

function render(){
  const rows = buildRows().map(r => Object.assign(r, calc(r)));
  const key = S.sort === "a" ? r => r.d[0] : S.sort === "d" ? r => r.d[1] : S.sort === "s" ? r => r.d[2] : r => r.sum;
  rows.sort((x, y) => key(y) - key(x) || y.sum - x.sum);
  $("rdTitle").textContent = `탑승 가능 펫 ${rows.length}마리`;
  $("rdWarn").hidden = S.base.some(v => v > 0);
  $("rdList").innerHTML = rows.map((r, i) => `
    <a class="rd-row${i < 3 ? " r" + (i + 1) : ""}" href="pokedex.html#${encodeURIComponent(r.p.id)}">
      <span class="rd-rank">${i + 1}</span>
      <div class="rd-img">${OHR.imgTag(r.p)}</div>
      <div class="rd-name"><b>${esc(r.label)}${r.tag ? `<span class="rd-tag">${esc(r.tag)}</span>` : ""}</b><small>${esc(r.p.detail)}</small><span class="rd-abs">펫 공 ${Math.floor(r.pet[0])} · 방 ${Math.floor(r.pet[1])} · 순 ${Math.floor(r.pet[2])}</span></div>
      <div class="rd-d"><span class="a"><i>공격</i><b class="${cls(r.d[0])}">${fmt(r.d[0])}</b></span><span class="d"><i>방어</i><b class="${cls(r.d[1])}">${fmt(r.d[1])}</b></span><span class="s"><i>순발</i><b class="${cls(r.d[2])}">${fmt(r.d[2])}</b></span></div>
      <div class="rd-sum"><small>합계</small><b class="${cls(r.sum)}">${fmt(r.sum)}</b></div>
    </a>`).join("") || '<div class="empty">조건에 맞는 펫이 없어요.</div>';
  OHR.lazy($("rdList"));
}

/* ===== 입력 칸 ===== */
function stepper(id, label, val, min, max){
  return `<div class="stat-box"><span class="slabel">${label}</span><div class="stp"><button type="button" class="sb" data-t="${id}" data-d="-1" aria-label="${label} 줄이기">−</button><input class="si" type="number" inputmode="numeric" id="${id}" min="${min}" max="${max}" value="${val}"><button type="button" class="sb" data-t="${id}" data-d="1" aria-label="${label} 늘리기">+</button></div></div>`;
}
function buildControls(){
  $("rdBase").innerHTML = NAMES.map(([n, k], i) => stepper("rb" + i, `${n} <i>(${k})</i>`, S.base[i], 0, 99999)).join("");
  $("rdLvBox").innerHTML = stepper("rlv", "레벨", S.lv, 1, 250);
  $("rdSort").innerHTML = SORTS.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === S.sort ? "on" : ""}">${l}</button>`).join("");
  $("rdReborn").checked = S.reborn;
  let holdT = null, holdIv = null;
  const stop = () => { clearTimeout(holdT); clearInterval(holdIv); };
  const setVal = (id, v) => {
    if(id === "rlv") S.lv = fix(v, 1, 250); else { const i = Number(id.slice(2)); S.base[i] = fix(v, 0, 99999); }
    const el = $(id); el.value = id === "rlv" ? S.lv : S.base[Number(id.slice(2))];
    el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
    save(); render();
  };
  const cur = id => id === "rlv" ? S.lv : S.base[Number(id.slice(2))];
  $("rdCtl").addEventListener("pointerdown", e => {
    const b = e.target.closest(".sb"); if(!b) return;
    e.preventDefault(); stop();
    const id = b.dataset.t, d = Number(b.dataset.d);
    setVal(id, cur(id) + d);
    holdT = setTimeout(() => { holdIv = setInterval(() => setVal(id, cur(id) + d), 70); }, 380);
  });
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  $("rdCtl").addEventListener("click", e => { const b = e.target.closest(".sb"); if(b && e.detail === 0) setVal(b.dataset.t, cur(b.dataset.t) + Number(b.dataset.d)); });
  $("rdCtl").addEventListener("change", e => {
    const inp = e.target.closest(".si"); if(!inp) return;
    setVal(inp.id, inp.value);
  });
  $("rdSort").addEventListener("click", e => {
    const b = e.target.closest("button"); if(!b) return;
    S.sort = b.dataset.v; save();
    $("rdSort").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    render();
  });
  $("rdReborn").addEventListener("change", e => { S.reborn = e.target.checked; save(); render(); });
}

(async function init(){
  S.base = Array.isArray(S.base) && S.base.length === 3 ? S.base.map(v => fix(v, 0, 99999)) : [0, 0, 0];
  S.lv = fix(S.lv || 100, 1, 250);
  buildControls();
  try{ PETS = await OHR.loadPets(); }
  catch(e){ $("rdList").innerHTML = '<div class="empty">pets.json 파일을 불러오지 못했어요. 잠시 뒤에 다시 열어봐 주세요.</div>'; return; }
  render();
})();
})();
