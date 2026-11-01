(function(){
"use strict";
const { $, esc } = OHR, E = OHR_ENH;
const SHLD = "\uc274\ub4dc";
const KINDS = { weapon:{ label:"무기류", sub:"도끼·곤봉·창·활" }, armor:{ label:"방어구류", sub:"투구·갑옷" } };
const LABEL = { atk:"공격", acc:"명중", pen:"관통", def:"방어", hp:"내구력", shld:SHLD };
const ORDER = ["atk", "def", "hp", "acc", "pen", "shld"];
const KEY = "ohr-enh";
const S = { kind:"weapon", lv:0, assist:"none", itemPrice:0, assistPrice:0, target:10, keep:false,
  st:{ tries:0, ok:0, fail:0, boom:0, best:0, enhCost:0, assistCost:0, itemCost:0 } };
let LOG = [], running = false, msg = null;
try{ const d = JSON.parse(localStorage.getItem(KEY) || "{}"); Object.keys(S).forEach(k => { if(d[k] !== undefined && k !== "st") S[k] = d[k]; }); if(d.st) Object.assign(S.st, d.st); }catch(e){}
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} };
const clampLv = v => Math.max(0, Math.min(E.MAX, Math.round(Number(v) || 0)));
S.lv = clampLv(S.lv); S.target = Math.max(1, Math.min(E.MAX, Math.round(S.target) || 10));
if(!KINDS[S.kind]) S.kind = "weapon"; if(!E.ASSIST[S.assist]) S.assist = "none";
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ===== 글자 꾸미기 ===== */
function fmtS(n){
  n = Math.round(n);
  return n >= 1e8 ? (n/1e8).toFixed(n >= 1e10 ? 0 : 1) + "억" : n.toLocaleString();
}
const fmtN = n => n >= 100 ? Math.round(n).toLocaleString() : n >= 10 ? n.toFixed(1) : n.toFixed(2);
const gainText = g => ORDER.filter(k => g[k]).map(k => `${LABEL[k]} +${g[k]}${k === "acc" ? "%" : ""}`).join(" · ");
const tierOf = lv => lv >= 10 ? 4 : lv >= 7 ? 3 : lv >= 5 ? 2 : lv >= 1 ? 1 : 0;

/* ===== 강화 한 번 ===== */
function attempt(){
  if(S.lv >= E.MAX) return null;
  const t = S.lv + 1, p = E.rate(t, S.assist), useA = S.assist !== "none";
  S.st.tries++; S.st.enhCost += E.cost(t); if(useA) S.st.assistCost += S.assistPrice;
  const ok = Math.random()*100 < p, r = { t, p, ok, boom:false };
  if(ok){ S.lv = t; S.st.ok++; S.st.best = Math.max(S.st.best, t); }
  else { S.st.fail++; if(E.destroys(t)){ r.boom = true; S.st.boom++; S.st.itemCost += S.itemPrice; S.lv = 0; } }
  return r;
}
function describe(r){
  const srv = r.t >= 7;
  if(r.ok) return { cls:"ok", srv, text:`🎉 +${r.t} 강화 성공! (${r.p}%)` };
  if(r.boom) return { cls:"boom", srv, text:`💥 +${r.t} 강화 실패! 장비가 파괴됐어요 (${r.p}%) → 새 장비 +0` };
  return { cls:"keep", srv, text:`😮 +${r.t} 강화 실패... 장비는 그대로예요 (${r.p}%)` };
}
function pushLog(r, quiet){
  const d = describe(r);
  LOG.unshift({ cls:d.cls, text:`#${S.st.tries} ${d.text}` });
  if(d.srv) LOG.unshift({ cls:"srv", text:`📢 [서버 알림] 누군가 +${r.t} 강화에 ${r.ok ? "성공" : "실패"}했어요` });
  if(LOG.length > 80) LOG.length = 80;
  if(!quiet) msg = { cls:d.cls + (d.srv ? " srv" : ""), text:d.text + (d.srv ? "  ·  📢 서버 알림" : "") };
}

/* ===== 그리기 ===== */
function renderCtl(){
  $("enKind").innerHTML = Object.keys(KINDS).map(k => `<button type="button" data-v="${k}" class="${k === S.kind ? "on" : ""}">${KINDS[k].label}</button>`).join("");
  $("enAssist").innerHTML = Object.keys(E.ASSIST).map(k => `<button type="button" data-v="${k}" class="${k === S.assist ? "on" : ""}">${E.ASSIST[k].label}${E.ASSIST[k].plus ? " +" + E.ASSIST[k].plus + "%" : ""}</button>`).join("");
  $("enRule").innerHTML = `<b>${KINDS[S.kind].label}</b> (${KINDS[S.kind].sub})만 강화할 수 있어요. 최대 <b>+10</b>까지.<br><b>+1~+4</b> 실패: 장비 유지<br><b>+5 이상</b> 실패: <b>장비 파괴</b> (새 장비 +0으로)<br>보조제는 시도할 때마다 1개씩 써요. <b>+7 이상</b>은 성공과 실패 모두 서버에 알림이 떠요.`;
  $("enTarget").innerHTML = Array.from({ length:E.MAX }, (_, i) => `<option value="${i + 1}"${i + 1 === S.target ? " selected" : ""}>+${i + 1}</option>`).join("");
  $("enItemPrice").value = S.itemPrice; $("enAssistPrice").value = S.assistPrice; $("enKeep").checked = S.keep;
  if(!$("enStartBox").firstChild) $("enStartBox").innerHTML = `<div class="stp"><button type="button" class="sb" data-d="-1" aria-label="강화 수치 줄이기">−</button><input class="si" type="number" inputmode="numeric" id="enLvIn" min="0" max="${E.MAX}"><button type="button" class="sb" data-d="1" aria-label="강화 수치 늘리기">+</button></div>`;
}
function renderHero(){
  const t = S.lv, kind = S.kind, next = t + 1, tier = tierOf(t);
  if($("enLvIn") && document.activeElement !== $("enLvIn")) $("enLvIn").value = t;
  const pips = Array.from({ length:E.MAX }, (_, i) => `<i class="${i < t ? "on" : ""}${i >= E.SAFE ? " hot" : ""}"></i>`).join("");
  const cumT = gainText(E.cum(kind, t));
  let nextHtml;
  if(t >= E.MAX) nextHtml = `<div class="en-next">🏆 최대 강화(+10)에 도달했어요!<br>새 장비로 다시 시작해볼까요?</div>`;
  else {
    const a = E.ASSIST[S.assist], p = E.rate(next, S.assist), base = E.BASE[next - 1];
    const extra = a.plus && S.assistPrice ? ` + 보조제 ${fmtS(S.assistPrice)} S` : "";
    nextHtml = `<div class="en-next">다음 도전 <b>+${next}</b> · 성공 확률 <b>${p}%</b>${a.plus ? ` <small>(기본 ${base}% + ${a.label} ${a.plus}%)</small>` : ""}<br>
      비용 <b>${fmtS(E.cost(next))} S</b>${extra}<br>
      실패하면 ${E.destroys(next) ? '<span class="boomtxt">장비 파괴</span>' : '<span class="keep">장비 유지</span>'}<br>
      성공하면 ${esc(gainText(E.GAIN[kind][next - 1]))}</div>`;
  }
  $("enHero").innerHTML = `<div class="en-lv t${tier}" id="enLv"><b>+${t}</b><small>${KINDS[kind].label}</small></div>
    <div><div class="en-pips">${pips}</div><div class="en-chips">${cumT ? cumT.split(" · ").map(x => `<span>${esc(x)}</span>`).join("") : "<span>강화 능력치 없음</span>"}</div>${nextHtml}</div>`;
  const m = $("enMsg");
  if(msg){ m.className = "en-msg " + msg.cls; m.textContent = msg.text; } else { m.className = "en-msg"; m.textContent = "강화 시도를 눌러보세요!"; }
  $("enTry").disabled = running || t >= E.MAX;
  $("enAuto").textContent = running ? "멈춤" : "목표까지 자동";
  $("enNew").disabled = running;
}
function renderStats(){
  const s = S.st, total = s.enhCost + s.assistCost + s.itemCost;
  const box = (l, v, w) => `<div${w ? ' class="wide"' : ""}><span>${l}</span><b>${v}</b></div>`;
  $("enStats").innerHTML = box("시도", s.tries.toLocaleString()) + box("성공", s.ok.toLocaleString()) + box("실패", s.fail.toLocaleString()) + box("장비 파괴", s.boom.toLocaleString()) +
    box("최고 단계", "+" + s.best) + box("성공률", s.tries ? (s.ok/s.tries*100).toFixed(1) + "%" : "-") +
    box("강화 비용", fmtS(s.enhCost) + " S") + box("보조제 + 장비", fmtS(s.assistCost + s.itemCost) + " S") + box("총 비용", fmtS(total) + " S", true);
}
function renderExpect(){
  let h = `<thead><tr><th>목표</th><th>평균 시도</th><th>평균 파괴</th><th>평균 비용(S)</th></tr></thead><tbody>`;
  if(S.lv >= E.MAX) h += `<tr><td colspan="4" style="text-align:center">이미 +10이에요</td></tr>`;
  for(let t = S.lv + 1; t <= E.MAX; t++){
    const x = E.expected(S.lv, t, S.assist, S.itemPrice, S.assistPrice);
    h += `<tr class="${t === S.target ? "cur" : ""}"><td>+${t}</td><td>${fmtN(x.attempts)}</td><td>${fmtN(x.destroys)}</td><td>${fmtS(x.cost)}</td></tr>`;
  }
  $("enExpect").innerHTML = h + "</tbody>";
}
function renderLog(){ $("enLog").innerHTML = LOG.map(l => `<div class="${l.cls}">${esc(l.text)}</div>`).join(""); }
function renderTables(){
  const A = Object.keys(E.ASSIST);
  let h = `<thead><tr><th>목표</th>${A.map(a => `<th>${a === "none" ? "기본" : E.ASSIST[a].label}</th>`).join("")}<th>비용(S)</th><th>실패 시</th></tr></thead><tbody>`;
  for(let t = 1; t <= E.MAX; t++){
    h += `<tr class="${t === S.lv + 1 ? "cur" : ""}"><td>+${t}</td>${A.map(a => `<td>${E.rate(t, a)}%</td>`).join("")}<td>${E.cost(t).toLocaleString()}</td><td class="${E.destroys(t) ? "boomc" : "keepc"}">${E.destroys(t) ? "장비 파괴" : "장비 유지"}</td></tr>`;
  }
  $("enRates").innerHTML = h + "</tbody>";
  const gain = kind => {
    let r = `<thead><tr><th>단계</th><th>추가</th><th>누적</th></tr></thead><tbody>`;
    for(let t = 1; t <= E.MAX; t++) r += `<tr><td>+${t}</td><td>${esc(gainText(E.GAIN[kind][t - 1]))}</td><td>${esc(gainText(E.cum(kind, t)))}</td></tr>`;
    return r + "</tbody>";
  };
  $("enGainW").innerHTML = gain("weapon"); $("enGainA").innerHTML = gain("armor");
}
function render(){ renderHero(); renderStats(); renderExpect(); renderLog(); renderTables(); save(); }
function flash(r){
  const el = $("enLv"); if(!el || !r) return;
  el.classList.remove("bump", "boom"); void el.offsetWidth;
  el.classList.add(r.boom ? "boom" : "bump");
}

/* ===== 동작 ===== */
function doTry(){
  if(running) return;
  const r = attempt(); if(!r) return;
  pushLog(r); render(); flash(r);
  OHR.haptic && OHR.haptic(r.boom ? 40 : 14);
}
async function autoRun(){
  if(running){ running = false; return; }
  if(S.lv >= S.target){ msg = { cls:"keep", text:"이미 목표 단계예요. 목표를 올려보세요." }; render(); return; }
  running = true; let n = 0, booms = 0;
  while(running && S.lv < S.target && n < 400000){
    const r = attempt(); if(!r) break; n++;
    const quiet = n > 40;
    if(!quiet || r.boom || (r.ok && r.t >= 7)) pushLog(r, true);
    if(r.boom){
      booms++;
      if(!S.keep){ const d = describe(r); msg = { cls:d.cls, text:d.text + "  ·  자동 강화를 멈췄어요" }; running = false; render(); flash(r); return; }
    }
    if(!quiet){ render(); flash(r); await sleep(80); }
    else if(n % 400 === 0){ render(); await sleep(0); }
  }
  const done = S.lv >= S.target;
  msg = done ? { cls:"ok", text:`🏆 +${S.target} 달성! 총 ${n.toLocaleString()}번 시도, 장비 ${booms.toLocaleString()}개 파괴` } : { cls:"keep", text:`멈췄어요 (${n.toLocaleString()}번 시도)` };
  running = false; render();
}
function newItem(){ S.lv = 0; msg = { cls:"", text:"새 장비 +0으로 시작해요" }; if(S.itemPrice) S.st.itemCost += S.itemPrice; render(); }
async function monteCarlo(){
  const btn = $("enMC"), out = $("enMCOut");
  if(S.lv >= S.target){ out.textContent = "목표가 지금 단계보다 높아야 해요."; return; }
  btn.disabled = true; const N = 1000, A = [], D = [], C = [];
  for(let i = 0; i < N; i++){
    const r = E.runOnce(S.lv, S.target, S.assist, S.itemPrice, S.assistPrice, Math.random);
    A.push(r.attempts); D.push(r.destroys); C.push(r.cost);
    if(i % 40 === 39){ out.textContent = `돌리는 중… ${i + 1}/${N}`; await sleep(0); }
  }
  const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length*p))]; };
  out.innerHTML = `+${S.lv} → <b>+${S.target}</b> · ${N.toLocaleString()}번 돌린 결과<br>
    시도 횟수: 중앙값 <b>${fmtN(q(A, .5))}</b> · 운 나쁜 10% <b>${fmtN(q(A, .9))}</b>번 이상<br>
    장비 파괴: 중앙값 <b>${fmtN(q(D, .5))}</b>개 · 운 나쁜 10% <b>${fmtN(q(D, .9))}</b>개 이상<br>
    총 비용: 중앙값 <b>${fmtS(q(C, .5))}</b> S · 운 나쁜 10% <b>${fmtS(q(C, .9))}</b> S 이상`;
  btn.disabled = false;
}
function bind(){
  $("enKind").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; S.kind = b.dataset.v; msg = null; renderCtl(); render(); });
  $("enAssist").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; S.assist = b.dataset.v; renderCtl(); render(); });
  $("enStartBox").addEventListener("click", e => { const b = e.target.closest(".sb"); if(!b || running) return; S.lv = clampLv(S.lv + Number(b.dataset.d)); msg = null; render(); });
  $("enStartBox").addEventListener("change", e => { if(e.target.id === "enLvIn"){ S.lv = clampLv(e.target.value); msg = null; render(); } });
  $("enItemPrice").addEventListener("change", e => { S.itemPrice = Math.max(0, Math.round(Number(e.target.value) || 0)); render(); });
  $("enAssistPrice").addEventListener("change", e => { S.assistPrice = Math.max(0, Math.round(Number(e.target.value) || 0)); render(); });
  $("enTarget").addEventListener("change", e => { S.target = Number(e.target.value); render(); });
  $("enKeep").addEventListener("change", e => { S.keep = e.target.checked; save(); });
  $("enTry").addEventListener("click", doTry);
  $("enAuto").addEventListener("click", autoRun);
  $("enNew").addEventListener("click", newItem);
  $("enMC").addEventListener("click", monteCarlo);
  $("enClear").addEventListener("click", () => { Object.keys(S.st).forEach(k => { S.st[k] = 0; }); LOG = []; msg = null; $("enMCOut").textContent = ""; render(); });
}
renderCtl(); bind(); render();
})();
