(function(){
"use strict";
const { $, esc, ATTRS, ATTR_COLOR, CATS } = OHR;
const f3 = v => v.toFixed(3);
const PAGE = 60;
let PETS = [], byId = new Map(), list = [];
const S = { q:"", attr:"all", attrVal:{ "지":0, "수":0, "화":0, "풍":0 }, atLeast:false, sort:"default", view:"card", cat:"ALL", shown:PAGE };

const CAT_LABEL = { "필드포획":"필드", "환생,진화":"환생·진화" };
const pv = (p, k) => { const a = p.attrs.find(x => x[0] === k); return a ? Number(a[1]) : 0; };
const total = p => p.growthS[1] + p.growthS[2] + p.growthS[3];

/* ===== 필터와 정렬 ===== */
function matches(p){
  if(S.q){
    const q = S.q;
    if(!(OHR.nameMatch(p, q) || p.detail.includes(q))) return false;
  }
  if(S.attr !== "all" && !(pv(p, S.attr) > 0)) return false;
  if(S.cat === "탑승가능"){ if(!p.rideable) return false; }
  else if(S.cat === "즐겨찾기"){ if(!OHR.favs.has(p.id)) return false; }
  else if(S.cat !== "ALL" && OHR.catOf(p) !== S.cat) return false;
  for(const k of ATTRS){
    const v = S.attrVal[k]; if(!v) continue;
    const x = pv(p, k);
    if(S.atLeast ? x < v : x !== v) return false;
  }
  return true;
}
function sorted(arr){
  const s = S.sort;
  if(s === "default") return arr;
  const a = [...arr];
  if(s === "name") return a.sort((x, y) => x.name.localeCompare(y.name, "ko"));
  if(s === "total") return a.sort((x, y) => total(y) - total(x));
  const i = s === "hp" ? 0 : s === "atk" ? 1 : s === "def" ? 2 : 3;
  return a.sort((x, y) => y.growthS[i] - x.growthS[i]);
}

/* ===== 카드와 표 ===== */
const attrChips = p => p.attrs.map(([n, v]) => `<span class="achip" style="color:${ATTR_COLOR[n] || "inherit"}">${esc(n)} ${esc(v)}</span>`).join("");
function cardHTML(p){
  const g = p.growthS, it = p.initS, fav = OHR.favs.has(p.id);
  return `<div class="pcard" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.name)} 자세히 보기">
    <button type="button" class="heart${fav ? " on" : ""}" data-fav="${esc(p.id)}" aria-pressed="${fav}" aria-label="즐겨찾기">${fav ? "♥" : "♡"}</button>
    <div class="pc-img">${OHR.imgTag(p)}</div>
    <div class="pc-name" title="${esc(p.name)}">${esc(p.name)}</div>
    <div class="pc-how" title="${esc(p.detail)}">${esc(p.detail)}</div>
    <div class="pc-attr">${attrChips(p)}</div>
    <div class="pc-label">성장률 (S급)</div>
    <div class="pc-grid"><div class="h"><span>내구</span><b>${f3(g[0])}</b></div><div class="a"><span>공격</span><b>${f3(g[1])}</b></div><div class="d"><span>방어</span><b>${f3(g[2])}</b></div><div class="s"><span>순발</span><b>${f3(g[3])}</b></div></div>
    <div class="pc-label">S급 초기치 (Lv.1)</div>
    <div class="pc-grid"><div class="h"><span>내구</span><b>${it[0]}</b></div><div class="a"><span>공격</span><b>${it[1]}</b></div><div class="d"><span>방어</span><b>${it[2]}</b></div><div class="s"><span>순발</span><b>${it[3]}</b></div></div>
    <div class="pc-foot"><span>총성장 <b>${f3(total(p))}</b></span><span>${p.rideable ? '<span class="badge ride">탑승가능</span>' : '<span class="badge">탑승불가</span>'}${p.approx ? ' <span class="badge warn">추정</span>' : ""}</span></div>
  </div>`;
}
function tableHTML(rows){
  return `<div class="dex-wrap"><table class="dex-table"><thead><tr><th>이름</th><th>속성</th><th>내구</th><th>공격</th><th>방어</th><th>순발</th><th>총성장</th><th>S급 초기치</th><th>탑승</th></tr></thead><tbody>${rows.map(p => `<tr class="row" data-id="${esc(p.id)}">
    <td class="nm">${esc(p.name)}<small>${esc(p.detail)}</small></td>
    <td>${p.attrs.map(([n, v]) => `<span style="color:${ATTR_COLOR[n] || "inherit"}">${esc(n)}${esc(v)}</span>`).join(" ")}</td>
    <td>${f3(p.growthS[0])}</td><td>${f3(p.growthS[1])}</td><td>${f3(p.growthS[2])}</td><td>${f3(p.growthS[3])}</td>
    <td style="color:var(--rose)">${f3(total(p))}</td><td>${p.initS.join(" / ")}</td><td>${p.rideable ? "가능" : "불가"}</td></tr>`).join("")}</tbody></table></div>`;
}

function render(){
  list = sorted(PETS.filter(matches));
  $("statTotal").textContent = PETS.length;
  $("statShown").textContent = list.length;
  $("statMount").textContent = PETS.filter(p => p.rideable).length;
  const slice = list.slice(0, S.shown);
  $("empty").hidden = list.length > 0;
  $("loadmore").hidden = list.length <= S.shown;
  $("loadmore").textContent = `더 보기 (${Math.min(PAGE, list.length - S.shown)}개)`;
  const grid = $("grid");
  grid.classList.toggle("text-view", S.view === "text");
  grid.innerHTML = S.view === "text" ? tableHTML(slice) : slice.map(cardHTML).join("");
  OHR.lazy(grid);
}
function resetShown(){ S.shown = PAGE; render(); }

/* ===== 속성값 슬라이더 ===== */
function sliderVal(k, v){
  $("asl-v-" + k).textContent = v;
  $("asl-v-" + k).classList.toggle("on", v > 0);
  $("asl-f-" + k).style.width = (v*10) + "%";
  $("asl-total").textContent = ATTRS.reduce((s, a) => s + S.attrVal[a], 0);
}
function setAttrVal(k, nv){
  nv = Math.max(0, Math.min(10, Math.round(nv)));
  const active = ATTRS.filter(a => S.attrVal[a] > 0);
  if(S.attrVal[k] === 0 && nv > 0 && active.length >= 2) return;
  const others = ATTRS.filter(a => a !== k);
  let over = nv + others.reduce((s, a) => s + S.attrVal[a], 0) - 10;
  for(let i = others.length - 1; i >= 0 && over > 0; i--){
    const a = others[i], cut = Math.min(S.attrVal[a], over);
    S.attrVal[a] -= cut; over -= cut; sliderVal(a, S.attrVal[a]);
  }
  if(S.attrVal[k] === nv) return;
  S.attrVal[k] = nv; sliderVal(k, nv);
  resetShown();
}
function buildSliders(){
  $("attrSliders").innerHTML = ATTRS.map(k => `
    <div class="asl-item"><div class="asl-h"><span style="color:${ATTR_COLOR[k]}">${k}속성</span><b id="asl-v-${k}">0</b></div>
    <div class="asl-track" id="asl-t-${k}" data-k="${k}"><div class="asl-fill" id="asl-f-${k}" style="width:0;background:${ATTR_COLOR[k]}"></div>${Array(9).fill(0).map((_, i) => `<div class="asl-div" style="left:${(i+1)*10}%"></div>`).join("")}</div></div>`).join("")
    + `<div class="asl-foot"><span>합계 <b id="asl-total">0</b> / 10</span><button type="button" id="aslReset">필터 초기화</button></div>`;
  ATTRS.forEach(k => {
    const t = $("asl-t-" + k);
    const val = e => { const r = t.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 10; };
    let drag = false;
    t.addEventListener("pointerdown", e => { drag = true; try{ t.setPointerCapture(e.pointerId); }catch(_e){} setAttrVal(k, val(e)); });
    t.addEventListener("pointermove", e => { if(drag) setAttrVal(k, val(e)); });
    t.addEventListener("pointerup", () => { drag = false; });
    t.addEventListener("pointercancel", () => { drag = false; });
  });
  $("aslReset").addEventListener("click", () => {
    ATTRS.forEach(k => { S.attrVal[k] = 0; sliderVal(k, 0); });
    resetShown();
  });
}

/* ===== 상세 팝업 ===== */
let lastFocus = null;
function openModal(id, fromHash){
  const p = byId.get(id); if(!p) return;
  lastFocus = document.activeElement;
  const g = p.growthS, it = p.initS, fav = OHR.favs.has(p.id);
  const sibs = PETS.filter(x => x.group === p.group && x.id !== p.id);
  const box = (cls, l, v) => `<div class="m-box ${cls}"><span>${l}</span><b>${v}</b></div>`;
  $("mBody").innerHTML = `
    <div class="m-top"><div class="m-img">${p.img ? `<img src="${esc(p.img)}" alt="" referrerpolicy="no-referrer">` : ""}</div>
      <div><div class="m-name" id="mName">${esc(p.name)}</div>
      <div class="tags" style="margin-top:8px">${p.rideable ? '<span class="tag ride">탑승 가능</span>' : '<span class="tag off">탑승 불가</span>'}${p.approx ? '<span class="tag">추정</span>' : ""}</div></div></div>
    <div class="m-sec"><h3>속성</h3><div class="attrs">${p.attrs.map(([n, v]) => `<div class="attr-row"><span style="color:${ATTR_COLOR[n] || "var(--acc)"}">${esc(n)}</span><div class="track"><i style="width:${Number(v)*10}%;background:${ATTR_COLOR[n] || "var(--acc)"}"></i></div><span class="v">${esc(v)}/10</span></div>`).join("")}</div></div>
    <div class="m-sec"><h3>획득 방법</h3><div style="font-size:14px;color:var(--ink2)">${esc(p.detail || "-")}</div></div>
    <div class="m-sec"><h3>성장률 <small>S급 기준</small></h3><div class="m-grid">${box("h", "내구", f3(g[0]))}${box("a", "공격", f3(g[1]))}${box("d", "방어", f3(g[2]))}${box("s", "순발", f3(g[3]))}</div>
      <div class="m-total"><span>S급 총성장률 (공격+방어+순발)</span><b>${f3(total(p))}</b></div></div>
    <div class="m-sec"><h3>초기치 <small>S급 Lv.1</small></h3><div class="m-grid">${box("h", "내구", it[0])}${box("a", "공격", it[1])}${box("d", "방어", it[2])}${box("s", "순발", it[3])}</div></div>
    ${sibs.length ? `<div class="m-sec"><h3>같은 이름의 다른 형태</h3><div class="chips">${sibs.map(x => `<button type="button" class="chip" data-open="${esc(x.id)}">${esc(x.variant)}</button>`).join("")}</div></div>` : ""}
    <div class="m-actions">${p.variant === "일반" ? `<a class="btn" href="index.html#${encodeURIComponent(p.id)}">이 펫으로 환각 계산하기</a>` : ""}<button type="button" class="btn ghost" id="mFav" aria-pressed="${fav}">${fav ? "♥ 즐겨찾기 해제" : "♡ 즐겨찾기"}</button></div>`;
  $("modal").hidden = false;
  document.body.style.overflow = "hidden";
  if(!fromHash){ try{ history.replaceState(null, "", "#" + encodeURIComponent(p.id)); }catch(e){} }
  $("mClose").focus();
  $("mFav").onclick = () => { toggleFav(p.id); openModal(p.id, true); };
}
function closeModal(){
  $("modal").hidden = true;
  document.body.style.overflow = "";
  try{ history.replaceState(null, "", location.pathname + location.search); }catch(e){}
  if(lastFocus && lastFocus.focus) try{ lastFocus.focus(); }catch(e){}
}
function toggleFav(id){
  if(OHR.favs.has(id)) OHR.favs.delete(id); else OHR.favs.add(id);
  OHR.saveFavs();
  if(S.cat === "즐겨찾기") render();
  else document.querySelectorAll(`.heart[data-fav="${CSS.escape(id)}"]`).forEach(h => { const on = OHR.favs.has(id); h.classList.toggle("on", on); h.textContent = on ? "♥" : "♡"; h.setAttribute("aria-pressed", String(on)); });
}

/* ===== 연결 ===== */
function buildControls(){
  $("attrSeg").innerHTML = [["all", "전체"], ...ATTRS.map(a => [a, a])].map(([v, l]) => `<button type="button" data-v="${v}" class="${v === "all" ? "on" : ""}">${l}</button>`).join("");
  $("attrSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if(!b) return;
    S.attr = b.dataset.v;
    $("attrSeg").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    resetShown();
  });
  $("viewSeg").innerHTML = '<button type="button" data-v="card" class="on">카드형</button><button type="button" data-v="text">표로 보기</button>';
  $("viewSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if(!b) return;
    S.view = b.dataset.v;
    $("viewSeg").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    render();
  });
  const cats = [["ALL", "전체"], ...CATS.map(c => [c, CAT_LABEL[c] || c]), ["탑승가능", "탑승가능"], ["즐겨찾기", "♥ 즐겨찾기"]];
  $("catChips").innerHTML = cats.map(([v, l]) => `<button type="button" class="chip${v === "ALL" ? " on" : ""}" data-v="${esc(v)}">${esc(l)}</button>`).join("");
  $("catChips").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if(!b) return;
    S.cat = b.dataset.v;
    $("catChips").querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === b));
    resetShown();
  });
  let qt = null;
  $("search").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value.trim(); resetShown(); }, 150); });
  $("sortSel").addEventListener("change", e => { S.sort = e.target.value; resetShown(); });
  $("attrMode").addEventListener("change", e => { S.atLeast = e.target.checked; resetShown(); });
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
  $("modal").addEventListener("click", e => {
    if(e.target === $("modal")) closeModal();
    const o = e.target.closest("[data-open]"); if(o) openModal(o.dataset.open);
  });
  document.addEventListener("keydown", e => { if(e.key === "Escape" && !$("modal").hidden) closeModal(); });
  buildSliders();
}

(async function init(){
  buildControls();
  try{ PETS = await OHR.loadPets(); }
  catch(e){ $("grid").innerHTML = '<div class="empty">pets.json 파일을 불러오지 못했어요. 잠시 뒤에 다시 열어봐 주세요.</div>'; return; }
  PETS.forEach(p => byId.set(p.id, p));
  render();
  const hash = decodeURIComponent((location.hash || "").slice(1));
  if(hash && byId.has(hash)) openModal(hash, true);
})();
})();
