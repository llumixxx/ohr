(function(){
"use strict";
const { $, esc } = OHR;
const MAX_POINTS = 596, KEY = "ohr-stat";

/* ===== 계산 식 (쟈쟈 능력치 계산기와 같은 식) ===== */
const STATS = [
  { k:"vit", n:"체력",   c:"#3aab7d", rule:"1p당 내구 +4 · 10p마다 공격 +1, 방어 +1" },
  { k:"hel", n:"건강",   c:"#22b6c9", rule:"1p당 방어 +1, 내구 +1 · 10p마다 공격 +1" },
  { k:"str", n:"완력",   c:"#e0684a", rule:"1p당 공격 +1, 내구 +1 · 10p마다 방어 +1" },
  { k:"spd", n:"스피드", c:"#9b6fd6", rule:"1p당 순발 +1, 내구 +1 · 20p마다 공격 +1, 방어 +1" }
];
function statContrib(a){
  return {
    atk:{ vit:Math.floor(a.vit/10), hel:Math.floor(a.hel/10), str:a.str,               spd:Math.floor(a.spd/20) },
    def:{ vit:Math.floor(a.vit/10), hel:a.hel,               str:Math.floor(a.str/10), spd:Math.floor(a.spd/20) },
    hp: { vit:a.vit*4,              hel:a.hel,               str:a.str,                spd:a.spd },
    dex:{ vit:0,                    hel:0,                   str:0,                    spd:a.spd }
  };
}
const RES = [{ k:"atk", n:"공격력" }, { k:"def", n:"방어력" }, { k:"hp", n:"내구력" }, { k:"dex", n:"순발력", cls:"dex" }];
const OPTKEYS = ["atk", "def", "agi", "hp", "crit", "evas", "acc", "pen", "shld"];
const OPTNAME = { atk:"공격", def:"방어", agi:"순발", hp:"내구", crit:"크리", evas:"회피", acc:"명중", pen:"관통", shld:"\uc274\ub4dc" };
const TO_RES = { atk:"atk", def:"def", agi:"dex", hp:"hp" };
const SET_KEY = { "공격력":"atk", "공":"atk", "방어력":"def", "방":"def", "순발력":"dex", "순":"dex", "내구력":"hp", "내":"hp" };

/* ===== 장비 칸 (쟈쟈와 같은 구성 + 보조) ===== */
const SLOTS = [
  { k:"head",    label:"투구",     icon:"⛑", type:"head" },
  { k:"acc1",    label:"장신구",   icon:"📿", type:"acc" },
  { k:"weapon",  label:"무기",     icon:"🔱", type:"weapon" },
  { k:"acc2",    label:"장신구",   icon:"💍", type:"acc" },
  { k:"body",    label:"갑옷",     icon:"🛡", type:"body" },
  { k:"aux",     label:"보조",     icon:"✨", type:"aux" },
  { k:"trinity", label:"삼위일체", icon:"🔮", type:"trinity" },
  { k:"totem",   label:"토템",     icon:"🗿", type:"totem" },
  { k:"enchant", label:"강화",     icon:"⚒",  type:"info" }
];
const slotDef = k => SLOTS.find(s => s.k === k);
function itemType(it){
  const n = it.name;
  if(/삼위일체/.test(n)) return "trinity";
  if(it.cat === "무기") return "weapon";
  if(it.cat === "토템") return "totem";
  if(it.cat === "보조") return "aux";
  if(it.cat === "장신구") return "acc";
  if(it.cat === "방어구" || it.cat === "초보자"){
    if(/투구|머리\s?장식|쓰개|모자/.test(n)) return "head";
    if(/갑옷|옷|로브/.test(n)) return "body";
    if(/목걸이/.test(n)) return "acc";
  }
  return null;
}
function accKind(it){
  const n = it.name;
  if(/목걸이|팬던트|펜던트|쇠사슬/.test(n)) return "목걸이";
  if(/반지/.test(n)) return "반지";
  if(/귀걸이/.test(n)) return "귀걸이";
  if(/팔찌/.test(n)) return "팔찌";
  if(/거울/.test(n)) return "거울";
  if(/부적/.test(n)) return "부적";
  return "기타 장신구";
}
/* 세트 효과: "...늪지의장비 3종 착용시 순발력-20이 추가 적용된다" */
function parseSet(desc){
  const m = String(desc).match(/(\S+?)의장비\s*\d+종\s*착용시\s*(공격력|방어력|순발력|내구력|공|방|순|내)\s*([+-]?\d+)/);
  return m ? { name:m[1], key:SET_KEY[m[2]], val:parseInt(m[3], 10), label:m[2] } : null;
}

/* ===== 아이템 읽기 (아이템 도감과 같은 규칙) ===== */
const fixRaw = t => String(t).replace(/^(-\d+(?:\.\d+)?)~(\d+(?:\.\d+)?)/, "$1~-$2");
function rangeOf(t){
  const m = String(t).replace(/[+%\s]/g, "").match(/^(-?\d+(?:\.\d+)?)(?:~(-?\d+(?:\.\d+)?))?$/);
  if(!m) return null;
  const a = +m[1], b = m[2] !== undefined ? +m[2] : a;
  return [Math.min(a, b), Math.max(a, b)];
}
function norm(r){
  if(!r || !r.name) return null;
  const n = {};
  Object.keys(r.s || {}).forEach(k => { const g = rangeOf(fixRaw(r.s[k])); if(g) n[k] = g; });
  const it = { id:String(r.id), name:String(r.name), cat:String(r.cat || ""), desc:String(r.desc || ""), obtain:String(r.obtain || ""), n,
    img:String(r.assetImage || r.img || ""), _cho:OHR.chosung(String(r.name)) };
  it.type = itemType(it);
  it.kind = it.type === "acc" ? accKind(it) : "";
  it.set = parseSet(it.desc);
  it.enh = OHR_ENH.kindOf(it.type, it.name);   // 강화할 수 있는 장비면 "weapon" 또는 "armor"
  return it;
}
const roll = (it, mode) => { const o = {}; OPTKEYS.forEach(k => { const r = it.n[k]; if(r) o[k] = mode === "min" ? r[0] : mode === "mid" ? Math.round((r[0] + r[1])/2) : r[1]; }); return o; };
const total = o => (o.atk || 0) + (o.def || 0) + (o.agi || 0) + (o.hp || 0)/3;
const sgn = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Math.round(v*100)/100);
const cls = v => v > 0 ? "pos" : v < 0 ? "neg" : "";

/* ===== 상태 ===== */
const S = { total:MAX_POINTS, a:{ vit:0, hel:0, str:0, spd:0 }, eq:{} };
let ITEMS = [], byId = new Map(), SEL = null, PICK = null;
try{
  const d = JSON.parse(localStorage.getItem(KEY) || "{}");
  if(d.total >= 0) S.total = Math.min(MAX_POINTS, Math.max(0, Math.round(d.total)));
  if(d.a) STATS.forEach(s => { S.a[s.k] = Math.max(0, Math.round(Number(d.a[s.k]) || 0)); });
  if(d.eq) S.eq = d.eq;
}catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} };
const used = () => STATS.reduce((a, s) => a + S.a[s.k], 0);
const left = () => S.total - used();
function toast(t){
  let e = $("scToast");
  if(!e){ e = document.createElement("div"); e.id = "scToast"; e.className = "sc-toast"; document.body.appendChild(e); }
  e.textContent = t; e.classList.add("on");
  clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove("on"), 1800);
}

/* ===== 계산 ===== */
function calc(){
  const c = statContrib(S.a), res = {}, ex = { crit:0, evas:0, acc:0, pen:0, shld:0 }, sets = {};
  RES.forEach(r => { const p = Object.keys(c[r.k]).reduce((a, k) => a + c[r.k][k], 0); res[r.k] = { pts:p, item:0, enh:0, set:0 }; });
  SLOTS.forEach(sl => {
    const e = S.eq[sl.k]; if(!e) return;
    const it = byId.get(e.id); if(!it) return;
    const o = e.o || roll(it, "max");
    Object.keys(TO_RES).forEach(k => { res[TO_RES[k]].item += o[k] || 0; });
    ["crit", "evas", "acc", "pen", "shld"].forEach(k => { ex[k] += o[k] || 0; });
    if(it.set){ (sets[it.set.name] = sets[it.set.name] || { fx:it.set, types:[] }).types.push(it.type); }
    if(it.enh && e.enh > 0){                      // 강화: 무기는 공격·명중·관통, 방어구는 방어·내구·쉴드
      const g = OHR_ENH.cum(it.enh, e.enh);
      if(g.atk) res.atk.enh += g.atk; if(g.def) res.def.enh += g.def; if(g.hp) res.hp.enh += g.hp;
      ex.acc += g.acc || 0; ex.pen += g.pen || 0; ex.shld += g.shld || 0;
    }
  });
  const setInfo = [];
  Object.keys(sets).forEach(name => {
    const s = sets[name], ok = ["weapon", "head", "body"].every(t => s.types.indexOf(t) >= 0);
    if(ok && s.fx.key) res[s.fx.key].set += s.fx.val;
    setInfo.push({ name, fx:s.fx, ok, have:s.types.filter(t => ["weapon", "head", "body"].indexOf(t) >= 0).length });
  });
  RES.forEach(r => { res[r.k].out = res[r.k].pts + res[r.k].item + res[r.k].enh + res[r.k].set; });
  return { res, ex, setInfo };
}

/* ===== 그리기: 포인트 ===== */
function renderPoints(){
  const box = $("scTotalBox");
  if(!box.firstChild){
    box.innerHTML = `<button type="button" class="sb" data-t="-1" aria-label="총 포인트 줄이기">−</button><input class="si" type="number" inputmode="numeric" id="scTotal" min="0" max="${MAX_POINTS}"><button type="button" class="sb" data-t="1" aria-label="총 포인트 늘리기">+</button><button type="button" class="sc-btn" id="scMax" title="최대로">596</button>`;
  }
  $("scTotal").value = S.total;
  const t = Math.max(S.total, used(), 1), l = left();
  $("poolBar").innerHTML = STATS.map(s => `<i style="width:${S.a[s.k]/t*100}%;background:${s.c}"></i>`).join("");
  $("poolLegend").innerHTML = STATS.map(s => `<span><em style="background:${s.c}"></em>${s.n} ${S.a[s.k]}</span>`).join("")
    + `<span class="${l < 0 ? "warn" : ""}" style="margin-left:auto">${l < 0 ? "초과 " + (-l) : "남음 " + l}</span>`;
  const rows = $("scRows");
  if(!rows.firstChild){
    rows.innerHTML = STATS.map(s => `<div class="sc-row"><div class="sc-rtop"><span class="sc-name" style="color:${s.c}">${s.n}</span>
      <button class="sc-btn" data-k="${s.k}" data-v="-10">−10</button><button class="sc-btn" data-k="${s.k}" data-v="-1">−1</button>
      <input class="sc-num" type="number" inputmode="numeric" min="0" data-set="${s.k}">
      <button class="sc-btn" data-k="${s.k}" data-v="1">+1</button><button class="sc-btn" data-k="${s.k}" data-v="10">+10</button>
      <button class="sc-all" data-all="${s.k}">남은 전부</button></div><div class="sc-rule">${s.rule}</div></div>`).join("");
  }
  rows.querySelectorAll("[data-set]").forEach(inp => { if(document.activeElement !== inp) inp.value = S.a[inp.dataset.set]; });
}
function setStat(k, v){
  const room = S.a[k] + Math.max(0, left());
  S.a[k] = Math.max(0, Math.min(Math.round(Number(v) || 0), room));
  save(); renderPoints(); renderResult();
}

/* ===== 그리기: 장비 ===== */
function eqItem(k){ const e = S.eq[k]; return e ? byId.get(e.id) : null; }
function renderEquip(){
  $("scEq").innerHTML = SLOTS.map(sl => {
    const it = eqItem(sl.k), e = S.eq[sl.k];
    if(sl.type === "info"){
      const lv = ["weapon", "head", "body"].map(k => ({ k, e:S.eq[k] })).filter(x => x.e && x.e.enh > 0).map(x => `${slotDef(x.k).label} +${x.e.enh}`);
      return `<button type="button" class="sc-slot info" data-slot="${sl.k}" disabled><span class="ic">${sl.icon}</span><span class="lb">강화</span><span class="plus">${lv.length ? esc(lv.join(" · ")) : "착용한 장비를 눌러서 강화"}</span></button>`;
    }
    if(it) return `<button type="button" class="sc-slot filled${SEL === sl.k ? " sel" : ""}" data-slot="${sl.k}">${it.img ? `<img src="${esc(it.img)}" alt="" referrerpolicy="no-referrer">` : `<span class="ic">${sl.icon}</span>`}<span class="nm">${esc(it.name)}</span><span class="tt ${cls(total(e.o))}">${sgn(total(e.o))}${e.enh > 0 ? " · +" + e.enh + "강" : ""}</span></button>`;
    return `<button type="button" class="sc-slot${SEL === sl.k ? " sel" : ""}" data-slot="${sl.k}"><span class="ic">${sl.icon}</span><span class="lb">${sl.label}</span><span class="plus">+ 장비 고르기</span></button>`;
  }).join("");
  renderOpt();
}
function enhHTML(it, e){
  const lv = e.enh || 0, g = OHR_ENH.cum(it.enh, lv), L = { atk:"공격", acc:"명중", pen:"관통", def:"방어", hp:"내구", shld:OPTNAME.shld };
  const txt = Object.keys(g).map(k => `${L[k]} +${g[k]}${k === "acc" ? "%" : ""}`).join(" · ");
  return `<div class="sc-enh"><span>강화</span><div class="stp"><button type="button" class="sb" data-enh="-1" aria-label="강화 낮추기">−</button><b class="lv">+${lv}</b><button type="button" class="sb" data-enh="1" aria-label="강화 올리기">+</button></div><small>${txt ? esc(txt) : "강화 효과 없음"}</small></div>`;
}
function renderOpt(){
  const box = $("scOpt");
  if(!SEL){ box.innerHTML = '<div class="empty">장비 칸을 눌러서 장비를 고르거나, 착용한 장비를 눌러서 수치를 조절해요.</div>'; return; }
  const sl = slotDef(SEL), it = eqItem(SEL), e = S.eq[SEL];
  if(!it){
    box.innerHTML = `<div class="empty">${esc(sl.label)} 칸이 비어 있어요.<br><button type="button" class="btn" id="scOpen" style="margin-top:12px">장비 고르기</button></div>`;
    return;
  }
  const rows = OPTKEYS.filter(k => it.n[k]).map(k => {
    const r = it.n[k], v = e.o[k] !== undefined ? e.o[k] : r[1];
    return `<div class="sc-orow"><span>${OPTNAME[k]}</span>${r[0] < r[1] ? `<input type="range" min="${r[0]}" max="${r[1]}" step="1" value="${v}" data-o="${k}">` : "<span></span>"}<span class="v ${cls(v)}">${sgn(v)}</span></div>`;
  }).join("");
  box.innerHTML = `<div class="sc-ohead">${it.img ? `<img src="${esc(it.img)}" alt="" referrerpolicy="no-referrer">` : ""}<div><b>${esc(it.name)}${it.set ? `<span class="sc-set-tag">${esc(it.set.name)} 세트</span>` : ""}</b><small>${esc(sl.label)} · 합계 ${sgn(total(e.o))}${it.kind ? " · " + it.kind : ""}</small></div></div>
    <div class="sc-rolls"><button type="button" class="chip" data-roll="min">최소</button><button type="button" class="chip" data-roll="mid">중간</button><button type="button" class="chip" data-roll="max">최대</button></div>
    ${rows || '<div class="empty" style="padding:10px">조절할 수치가 없어요.</div>'}
    ${it.enh ? enhHTML(it, e) : '<div class="sc-enh off">이 장비는 강화할 수 없어요</div>'}
    <div class="sc-ofoot"><button type="button" class="btn ghost" id="scOpen">바꾸기</button><button type="button" class="btn ghost" id="scOff">벗기</button></div>`;
}

/* ===== 그리기: 결과 ===== */
function renderResult(){
  const r = calc();
  $("scCards").innerHTML = RES.map(x => {
    const v = r.res[x.k];
    const parts = [`포인트 <b>${v.pts}</b>`, `장비 <b class="${cls(v.item)}">${sgn(v.item)}</b>`];
    if(v.enh) parts.push(`강화 <b class="${cls(v.enh)}">${sgn(v.enh)}</b>`);
    if(v.set) parts.push(`세트 <b class="${cls(v.set)}">${sgn(v.set)}</b>`);
    return `<div class="sc-card ${x.cls || ""}"><div class="l">${x.n}</div><div class="v">${v.out}</div><div class="p">${parts.join(" · ")}</div></div>`;
  }).join("");
  $("scEx").innerHTML = ["crit", "evas", "acc", "pen", "shld"].map(k => `<div><span>${OPTNAME[k]}</span><b class="${cls(r.ex[k])}">${r.ex[k] ? sgn(r.ex[k]) : "0"}</b></div>`).join("");
  $("scSets").innerHTML = r.setInfo.length
    ? r.setInfo.map(s => s.ok ? `<div class="on">✔ ${esc(s.name)} 세트 발동 · ${esc(s.fx.label)} ${sgn(s.fx.val)}</div>` : `<div class="part">${esc(s.name)} 세트 ${s.have}/3 · 무기, 투구, 갑옷을 모두 입으면 ${esc(s.fx.label)} ${sgn(s.fx.val)}</div>`).join("")
    : '<div style="color:var(--ink3)">세트 효과가 있는 장비를 입으면 여기에 표시돼요.</div>';
}
function renderAll(){ renderPoints(); renderEquip(); renderResult(); }

/* ===== 장비 고르기 창 ===== */
function itemsFor(slotKey){ const ty = slotDef(slotKey).type; return ITEMS.filter(i => i.type === ty); }
function openPicker(slotKey){
  PICK = slotKey; SEL = slotKey;
  $("scPickTitle").textContent = slotDef(slotKey).label + " 고르기";
  $("scPickQ").value = "";
  renderPick();
  $("scModal").hidden = false;
  document.body.style.overflow = "hidden";
  renderEquip();
}
function closePicker(){ $("scModal").hidden = true; document.body.style.overflow = ""; PICK = null; }
function renderPick(){
  const q = $("scPickQ").value.trim(), eqIds = {};
  Object.keys(S.eq).forEach(k => { eqIds[S.eq[k].id] = k; });
  const list = itemsFor(PICK).filter(i => !q || OHR.nameMatch(i, q)).sort((a, b) => total(roll(b, "max")) - total(roll(a, "max")));
  $("scPickList").innerHTML = list.map(i => {
    const o = roll(i, "max"), pills = OPTKEYS.slice(0, 4).filter(k => i.n[k]).map(k => `${OPTNAME[k]} ${sgn(o[k])}`).join(" · ");
    return `<button type="button" class="sc-it${eqIds[i.id] ? " on" : ""}" data-id="${esc(i.id)}">${i.img ? `<img src="${esc(i.img)}" alt="" referrerpolicy="no-referrer">` : "<span></span>"}<div><b>${esc(i.name)}${i.set ? `<span class="sc-set-tag">${esc(i.set.name)} 세트</span>` : ""}</b><small>${esc(pills || "능력치 없음")}${i.kind ? " · " + i.kind : ""}</small></div><span class="tt ${cls(total(o))}">${sgn(total(o))}</span></button>`;
  }).join("") || '<div class="empty">맞는 장비가 없어요.</div>';
}
function equip(slotKey, id){
  const it = byId.get(id); if(!it) return;
  for(const k in S.eq){ if(S.eq[k].id === id && k !== slotKey){ toast("이미 다른 칸에 착용 중이에요"); return; } }
  if(it.type === "acc"){
    for(const k of ["acc1", "acc2"]){
      if(k === slotKey) continue;
      const o = eqItem(k);
      if(o && o.kind === it.kind){ toast(`같은 종류(${it.kind})는 하나만 착용할 수 있어요`); return; }
    }
  }
  S.eq[slotKey] = { id, o:roll(it, "max"), enh:0 };
  save(); closePicker(); SEL = slotKey; renderAll();
}

/* ===== 연결 ===== */
function bind(){
  /* 총 포인트 */
  let holdT = null, holdIv = null;
  const stop = () => { clearTimeout(holdT); clearInterval(holdIv); };
  const setTotal = v => { S.total = Math.max(0, Math.min(MAX_POINTS, Math.round(Number(v) || 0))); save(); renderPoints(); renderResult(); };
  $("scTotalBox").addEventListener("pointerdown", e => {
    const b = e.target.closest(".sb"); if(!b) return;
    e.preventDefault(); stop();
    const d = Number(b.dataset.t);
    setTotal(S.total + d);
    holdT = setTimeout(() => { holdIv = setInterval(() => setTotal(S.total + d), 60); }, 380);
  });
  window.addEventListener("pointerup", stop); window.addEventListener("pointercancel", stop);
  $("scTotalBox").addEventListener("click", e => {
    if(e.target.closest("#scMax")) return setTotal(MAX_POINTS);
    const b = e.target.closest(".sb"); if(b && e.detail === 0) setTotal(S.total + Number(b.dataset.t));
  });
  $("scTotalBox").addEventListener("change", e => { if(e.target.id === "scTotal") setTotal(e.target.value); });
  /* 스탯 */
  $("scRows").addEventListener("click", e => {
    const b = e.target.closest("[data-k]"); if(b){ setStat(b.dataset.k, S.a[b.dataset.k] + Number(b.dataset.v)); return; }
    const a = e.target.closest("[data-all]"); if(a){ setStat(a.dataset.all, S.a[a.dataset.all] + Math.max(0, left())); }
  });
  $("scRows").addEventListener("change", e => { const i = e.target.closest("[data-set]"); if(i) setStat(i.dataset.set, i.value); });
  $("scReset").addEventListener("click", () => { STATS.forEach(s => { S.a[s.k] = 0; }); save(); renderPoints(); renderResult(); });
  /* 장비 */
  $("scEq").addEventListener("click", e => {
    const b = e.target.closest("[data-slot]"); if(!b || b.disabled) return;
    const k = b.dataset.slot;
    if(!eqItem(k)){ openPicker(k); return; }
    SEL = k; renderEquip();
  });
  $("scUnequip").addEventListener("click", () => { S.eq = {}; SEL = null; save(); renderAll(); });
  $("scOpt").addEventListener("click", e => {
    if(e.target.closest("#scOpen")){ openPicker(SEL); return; }
    if(e.target.closest("#scOff")){ delete S.eq[SEL]; SEL = null; save(); renderAll(); return; }
    const en = e.target.closest("[data-enh]");
    if(en && SEL && S.eq[SEL] && eqItem(SEL) && eqItem(SEL).enh){ S.eq[SEL].enh = Math.max(0, Math.min(OHR_ENH.MAX, (S.eq[SEL].enh || 0) + Number(en.dataset.enh))); save(); renderAll(); return; }
    const r = e.target.closest("[data-roll]");
    if(r && SEL && eqItem(SEL)){ S.eq[SEL].o = roll(eqItem(SEL), r.dataset.roll); save(); renderAll(); }
  });
  $("scOpt").addEventListener("input", e => {
    const rg = e.target.closest("[data-o]");
    if(rg && SEL && S.eq[SEL]){ S.eq[SEL].o[rg.dataset.o] = Number(rg.value); save(); renderResult(); const v = rg.parentNode.querySelector(".v"); v.textContent = sgn(Number(rg.value)); v.className = "v " + cls(Number(rg.value)); }
  });
  $("scOpt").addEventListener("change", e => { if(e.target.closest("[data-o]")) renderEquip(); });
  /* 고르기 창 */
  $("scPickClose").addEventListener("click", closePicker);
  $("scModal").addEventListener("click", e => { if(e.target === $("scModal")) closePicker(); });
  $("scPickQ").addEventListener("input", renderPick);
  $("scPickList").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if(b) equip(PICK, b.dataset.id); });
  document.addEventListener("keydown", e => { if(e.key === "Escape" && !$("scModal").hidden) closePicker(); });
}

(async function init(){
  bind();
  try{
    const res = await fetch("items.json", { cache:"no-cache" });
    if(!res.ok) throw new Error(res.status);
    const d = await res.json();
    ITEMS = (Array.isArray(d) ? d : (d && d.items) || []).map(norm).filter(Boolean);
  }catch(e){ toast("items.json 파일을 불러오지 못했어요"); }
  ITEMS.forEach(i => byId.set(i.id, i));
  /* 저장된 장비 중 지금 데이터에 없는 건 정리 */
  Object.keys(S.eq).forEach(k => { if(!slotDef(k) || !byId.has(S.eq[k].id) || !S.eq[k].o) delete S.eq[k]; });
  renderAll();
})();
})();
