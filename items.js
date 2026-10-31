(function(){
"use strict";
const { $, esc } = OHR;
const PAGE = 60, FAVK = "ohr-fav-items";
let FAV = new Set();
try{ FAV = new Set(JSON.parse(localStorage.getItem(FAVK) || "[]")); }catch(e){}
const saveFav = () => { try{ localStorage.setItem(FAVK, JSON.stringify([...FAV])); }catch(e){} };
const S = { q:"", cat:"ALL", sort:"default", view:"card", shown:PAGE };
let ITEMS = [], byId = new Map(), list = [];

const LABELS = [["atk", "공"], ["def", "방"], ["agi", "순"], ["hp", "내"], ["crit", "크리"], ["evas", "회피"], ["acc", "명중"], ["pen", "관통"], ["shld", "\uc274\ub4dc"]];
const CAT_ORDER = ["초보자", "무기", "방어구", "장신구", "토템", "보조", "소모", "캐릭터", "기타"];
const maxOf = (it, k) => it.n[k] ? it.n[k][1] : -Infinity;

function norm(r){
  if(!r || !r.name) return null;
  return { id:String(r.id), name:String(r.name), cat:String(r.cat || "기타"), obtain:String(r.obtain || ""), desc:String(r.desc || ""),
    s:r.s || {}, n:r.n || {}, attr:String(r.attr || ""), img:String(r.assetImage || r.img || ""), _cho:OHR.chosung(String(r.name)) };
}
/* ===== 필터와 정렬 ===== */
function matches(it){
  if(S.q){
    const q = S.q;
    if(!(OHR.nameMatch(it, q) || it.obtain.includes(q) || it.desc.includes(q))) return false;
  }
  if(S.cat === "즐겨찾기") return FAV.has(it.id);
  return S.cat === "ALL" || it.cat === S.cat;
}
function sorted(arr){
  if(S.sort === "default") return arr;
  const a = [...arr];
  if(S.sort === "name") return a.sort((x, y) => x.name.localeCompare(y.name, "ko"));
  return a.sort((x, y) => maxOf(y, S.sort) - maxOf(x, S.sort));
}
/* ===== 카드와 표 ===== */
const pill = (it, k, l) => it.s[k] ? `<span class="ist ${k}"><i>${l}</i>${esc(it.s[k])}</span>` : "";
const pills = (it, limit) => {
  const p = LABELS.map(([k, l]) => pill(it, k, l)).filter(Boolean).slice(0, limit);
  return p.length ? p.join("") : '<span class="ist none">능력치 없음</span>';
};
function cardHTML(it){
  const fav = FAV.has(it.id);
  return `<div class="pcard icard" data-id="${esc(it.id)}" tabindex="0" role="button" aria-label="${esc(it.name)} 자세히 보기">
    <button type="button" class="heart${fav ? " on" : ""}" data-fav="${esc(it.id)}" aria-pressed="${fav}" aria-label="즐겨찾기">${fav ? "♥" : "♡"}</button>
    <div class="pc-img">${OHR.imgTag(it)}</div>
    <div class="pc-name" title="${esc(it.name)}">${esc(it.name)}</div>
    <div class="pc-how" title="${esc(it.obtain)}">${esc(it.obtain || "-")}</div>
    <div class="ic-stats">${pills(it, 6)}</div>
    <div class="ic-desc">${esc(it.desc === "." ? "" : it.desc)}</div>
    <div class="pc-foot"><span class="badge">${esc(it.cat)}</span><span></span></div>
  </div>`;
}
const cell = (it, k) => it.s[k] ? esc(it.s[k]) : "-";
function tableHTML(rows){
  return `<div class="dex-wrap"><table class="dex-table"><thead><tr><th>이름</th><th>분류</th><th>공</th><th>방</th><th>순</th><th>내</th><th>크리</th><th>회피</th><th>명중</th><th>관통</th><th>\uc274\ub4dc</th></tr></thead><tbody>${rows.map(it => `<tr class="row" data-id="${esc(it.id)}">
    <td class="nm">${esc(it.name)}<small>${esc(it.obtain)}</small></td><td>${esc(it.cat)}</td>
    <td>${cell(it, "atk")}</td><td>${cell(it, "def")}</td><td>${cell(it, "agi")}</td><td>${cell(it, "hp")}</td>
    <td>${cell(it, "crit")}</td><td>${cell(it, "evas")}</td><td>${cell(it, "acc")}</td><td>${cell(it, "pen")}</td><td>${cell(it, "shld")}</td></tr>`).join("")}</tbody></table></div>`;
}
function render(){
  list = sorted(ITEMS.filter(matches));
  $("statTotal").textContent = ITEMS.length;
  $("statShown").textContent = list.length;
  const slice = list.slice(0, S.shown);
  $("empty").hidden = list.length > 0;
  $("loadmore").hidden = list.length <= S.shown;
  $("loadmore").textContent = `더 보기 (${Math.min(PAGE, list.length - S.shown)}개)`;
  const grid = $("grid");
  grid.classList.toggle("text-view", S.view === "text");
  grid.innerHTML = S.view === "text" ? tableHTML(slice) : slice.map(cardHTML).join("");
  OHR.lazy(grid);
}
const resetShown = () => { S.shown = PAGE; render(); };

/* ===== 상세 팝업 ===== */
let lastFocus = null;
function openModal(id, fromHash){
  const it = byId.get(id); if(!it) return;
  lastFocus = document.activeElement;
  const fav = FAV.has(it.id);
  const box = (cls, l, k) => `<div class="m-box ${cls}"><span>${l}</span><b>${it.s[k] ? esc(it.s[k]) : "-"}</b></div>`;
  $("mBody").innerHTML = `
    <div class="m-top"><div class="m-img">${it.img ? `<img src="${esc(it.img)}" alt="" referrerpolicy="no-referrer">` : ""}</div>
      <div><div class="m-name" id="mName">${esc(it.name)}</div><div class="tags" style="margin-top:8px"><span class="tag">${esc(it.cat)}</span>${it.attr ? `<span class="tag">속성 ${esc(it.attr)}</span>` : ""}</div></div></div>
    <div class="m-sec"><h3>능력치 <small>범위가 있으면 최소~최대</small></h3>
      <div class="m-grid">${box("a", "공격", "atk")}${box("d", "방어", "def")}${box("s", "순발", "agi")}${box("h", "내구", "hp")}</div>
      <div class="m-grid five" style="margin-top:8px">${box("", "크리", "crit")}${box("", "회피", "evas")}${box("", "명중", "acc")}${box("", "관통", "pen")}${box("", "\uc274\ub4dc", "shld")}</div></div>
    <div class="m-sec"><h3>획득 방법</h3><div style="font-size:14px;color:var(--ink2)">${esc(it.obtain || "-")}</div></div>
    ${it.desc && it.desc !== "." ? `<div class="m-sec"><h3>설명</h3><div style="font-size:14px;color:var(--ink2);white-space:pre-wrap">${esc(it.desc)}</div></div>` : ""}
    <div class="m-actions"><button type="button" class="btn ghost" id="mFav" aria-pressed="${fav}">${fav ? "♥ 즐겨찾기 해제" : "♡ 즐겨찾기"}</button></div>`;
  $("modal").hidden = false;
  document.body.style.overflow = "hidden";
  if(!fromHash){ try{ history.replaceState(null, "", "#" + encodeURIComponent(it.id)); }catch(e){} }
  $("mClose").focus();
  $("mFav").onclick = () => { toggleFav(it.id); openModal(it.id, true); };
}
function closeModal(){
  $("modal").hidden = true;
  document.body.style.overflow = "";
  try{ history.replaceState(null, "", location.pathname + location.search); }catch(e){}
  if(lastFocus && lastFocus.focus) try{ lastFocus.focus(); }catch(e){}
}
function toggleFav(id){
  if(FAV.has(id)) FAV.delete(id); else FAV.add(id);
  saveFav();
  if(S.cat === "즐겨찾기") render();
  else document.querySelectorAll(`.heart[data-fav="${CSS.escape(id)}"]`).forEach(h => { const on = FAV.has(id); h.classList.toggle("on", on); h.textContent = on ? "♥" : "♡"; h.setAttribute("aria-pressed", String(on)); });
}

/* ===== 연결 ===== */
function buildControls(){
  $("viewSeg").innerHTML = '<button type="button" data-v="card" class="on">카드형</button><button type="button" data-v="text">표로 보기</button>';
  $("viewSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if(!b) return;
    S.view = b.dataset.v;
    $("viewSeg").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    render();
  });
  $("catChips").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if(!b) return;
    S.cat = b.dataset.v;
    $("catChips").querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === b));
    resetShown();
  });
  let qt = null;
  $("search").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value.trim(); resetShown(); }, 150); });
  $("sortSel").addEventListener("change", e => { S.sort = e.target.value; resetShown(); });
  $("loadmore").addEventListener("click", () => { S.shown += PAGE; render(); });
  $("filterToggle").addEventListener("click", () => {
    const open = $("filters").classList.toggle("open");
    $("filterToggle").textContent = open ? "검색·필터 닫기" : "검색·필터 열기";
    $("filterToggle").setAttribute("aria-expanded", String(open));
  });
  $("grid").addEventListener("click", e => {
    const h = e.target.closest(".heart");
    if(h){ e.stopPropagation(); toggleFav(h.dataset.fav); return; }
    const c = e.target.closest("[data-id]"); if(c) openModal(c.dataset.id);
  });
  $("grid").addEventListener("keydown", e => {
    if((e.key === "Enter" || e.key === " ") && e.target.classList.contains("pcard")){ e.preventDefault(); openModal(e.target.dataset.id); }
  });
  $("mClose").addEventListener("click", closeModal);
  $("modal").addEventListener("click", e => { if(e.target === $("modal")) closeModal(); });
  document.addEventListener("keydown", e => { if(e.key === "Escape" && !$("modal").hidden) closeModal(); });
}
function buildCats(){
  const cnt = {}; ITEMS.forEach(i => cnt[i.cat] = (cnt[i.cat] || 0) + 1);
  const cats = [...CAT_ORDER.filter(c => cnt[c]), ...Object.keys(cnt).filter(c => CAT_ORDER.indexOf(c) < 0)];
  const all = [["ALL", `전체 ${ITEMS.length}`], ...cats.map(c => [c, `${c} ${cnt[c]}`]), ["즐겨찾기", "♥ 즐겨찾기"]];
  $("catChips").innerHTML = all.map(([v, l]) => `<button type="button" class="chip${v === "ALL" ? " on" : ""}" data-v="${esc(v)}">${esc(l)}</button>`).join("");
}

(async function init(){
  buildControls();
  try{
    const res = await fetch("items.json", { cache:"no-cache" });
    if(!res.ok) throw new Error(res.status);
    const d = await res.json();
    ITEMS = (Array.isArray(d) ? d : (d && d.items) || []).map(norm).filter(Boolean);
  }catch(e){ $("grid").innerHTML = '<div class="empty">items.json 파일을 불러오지 못했어요. 잠시 뒤에 다시 열어봐 주세요.</div>'; return; }
  ITEMS.forEach(i => byId.set(i.id, i));
  if(!ITEMS.length){
    $("grid").innerHTML = '<div class="empty">아직 아이템 데이터가 없어요.<br>공홈 아이템 페이지에서 즐겨찾기의 <b>OHR 갱신</b>을 눌러주세요.</div>';
    $("statTotal").textContent = "0"; $("statShown").textContent = "0";
    return;
  }
  buildCats();
  render();
  const hash = decodeURIComponent((location.hash || "").slice(1));
  if(hash && byId.has(hash)) openModal(hash, true);
})();
})();
