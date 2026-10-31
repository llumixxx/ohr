/* OHR 데이터 갱신기 (수동)
   - 공홈(ohrsa.net) 페트정보 페이지를 연 상태에서 즐겨찾기 버튼을 누르면 실행돼요
   - 브라우저가 공홈 목록을 읽어서 pets.json 을 만들고 깃허브(llumixxx/OHR)에 커밋 1번으로 저장해요
   - 새 펫 이미지는 pet-images/ 폴더에 사본으로 저장해요 */
(async () => {
  const OWNER = "llumixxx", REPO = "OHR", BRANCH = "main";
  const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const TOKEN_KEY = "ohr_gh_token";
  const SA = location.origin;

  if (!/(^|\.)ohrsa\.net$/.test(location.hostname)) {
    alert("공홈(ohrsa.net)에서 눌러주세요!\n예: https://ohrsa.net/petinfo");
    return;
  }
  if (document.getElementById("ohrUpd")) document.getElementById("ohrUpd").remove();

  /* ── 화면 ── */
  const box = document.createElement("div");
  box.id = "ohrUpd";
  box.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;width:340px;background:#10181c;color:#eee;" +
    "font:13px/1.5 'Noto Sans KR',sans-serif;border:2px solid #2dd4bf;border-radius:14px;padding:14px;box-shadow:0 8px 30px #0008";
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <b style="font-size:15px;color:#2dd4bf">OHR 데이터 갱신</b>
      <span id="ouX" style="cursor:pointer;opacity:.7">✕</span></div>
    <label style="display:block"><input type="checkbox" id="ouImg" checked> 새 펫 이미지도 저장</label>
    <button id="ouCheck" style="margin-top:10px;width:100%;padding:8px;border:1px solid #2dd4bf;border-radius:9px;background:none;color:#2dd4bf;font-weight:700;cursor:pointer">확인만 (저장 안 함)</button>
    <button id="ouGo" style="margin-top:6px;width:100%;padding:9px;border:0;border-radius:9px;background:#2dd4bf;color:#04110f;font-weight:700;cursor:pointer">갱신 시작 (깃허브에 저장)</button>
    <div style="height:6px;background:#2a2d3a;border-radius:4px;margin-top:10px;overflow:hidden"><div id="ouFill" style="height:100%;width:0;background:#4caf50"></div></div>
    <div id="ouLog" style="margin-top:8px;max-height:240px;overflow:auto;font-size:12px;white-space:pre-wrap"></div>
    <div style="margin-top:8px;font-size:11px;opacity:.6;cursor:pointer" id="ouTok">토큰 다시 입력</div>`;
  document.body.appendChild(box);
  const $ = (id) => box.querySelector("#" + id);
  const log = (t) => { $("ouLog").textContent += t + "\n"; $("ouLog").scrollTop = 1e9; };
  const bar = (p) => { $("ouFill").style.width = Math.round(p * 100) + "%"; };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  $("ouX").onclick = () => box.remove();

  /* ── 깃허브 토큰 ── */
  function getToken(force) {
    let t = !force && localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = prompt("깃허브 토큰을 붙여넣어 주세요 (처음 한 번만)\n\n" +
                 "만드는 곳: github.com > Settings > Developer settings > Fine-grained tokens\n" +
                 "· Repository access: llumixxx/OHR 만\n· Permissions > Contents: Read and write");
      if (t) localStorage.setItem(TOKEN_KEY, t.trim());
    }
    return t && t.trim();
  }
  $("ouTok").onclick = () => { getToken(true); log("토큰 저장됨"); };
  const gh = async (path, opt = {}) => {
    const r = await fetch(API + path, { ...opt, headers: { "Authorization": "Bearer " + getToken(),
      "Accept": "application/vnd.github+json", "Content-Type": "application/json", ...(opt.headers || {}) } });
    if (!r.ok) throw new Error(`깃허브 ${r.status}: ${(await r.text()).slice(0, 150)}`);
    return r.status === 204 ? null : r.json();
  };
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const gitSha = async (u8) => {
    const head = new TextEncoder().encode(`blob ${u8.length}\0`);
    const all = new Uint8Array(head.length + u8.length); all.set(head); all.set(u8, head.length);
    return [...new Uint8Array(await crypto.subtle.digest("SHA-1", all))].map(b => b.toString(16).padStart(2, "0")).join("");
  };
  const getBytes = async (url) => {
    const r = await fetch(url, { cache: "no-store", credentials: "include" });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return new Uint8Array(await r.arrayBuffer());
  };

  /* ── 공홈 목록 읽기 ── */
  function parseCards(doc) {
    const out = [];
    doc.querySelectorAll("div.pet_card_item").forEach(c => {
      const tb = c.querySelector("table.pet_stats_grid");
      if (!tb) return;
      const tds = [...tb.querySelectorAll("td")].map(x => x.textContent.trim());
      const desc = [...c.querySelectorAll(".pet_simple_desc > div")].map(x => x.textContent.replace(/\s+/g, " ").trim());
      const attrs = [...c.querySelectorAll(".attr_label_tag")].map(x => {
        const m = x.textContent.trim().match(/^(\S+)\s*\((\d+)\)/); return m ? [m[1], +m[2]] : null;
      }).filter(Boolean);
      const io = (tds[3] || "").split(/\s+/).map(Number);            // 공격 방어 순발 내구
      const d = c.dataset;
      const card = {
        id: String(d.wrId || ""), name: d.name || "", img: d.img || "",
        growth: [+d.hp, +d.atk, +d.def, +d.agi],                       // 내구 공격 방어 순발
        init: [io[3], io[0], io[1], io[2]],                            // 내구 공격 방어 순발
        attrs, cat: d.obtain || "",
        detail: ((desc.find(x => x.startsWith("획득")) || "").replace(/^획득:?\s*/, "")),
        ride: tds[2] === "탑승가능"
      };
      if (!card.id || !card.name || card.growth.some(v => !isFinite(v)) || card.init.some(v => !isFinite(v))) return;
      out.push(card);
    });
    return out;
  }
  const fetchDoc = async (url) => {
    const r = await fetch(url, { cache: "no-store", credentials: "include" });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return new DOMParser().parseFromString(await r.text(), "text/html");
  };
  function maxPageOf(doc) {
    let m = 1;
    doc.querySelectorAll("a[href]").forEach(a => { const x = (a.getAttribute("href") || "").match(/[?&]page=(\d+)/); if (x) m = Math.max(m, +x[1]); });
    return m;
  }
  async function loadAllCards() {
    const seen = new Map();
    const add = (cards) => { let n = 0; cards.forEach(c => { if (!seen.has(c.id)) { seen.set(c.id, c); n++; } }); return n; };
    const doc1 = await fetchDoc(`${SA}/petinfo`);
    add(parseCards(doc1));
    log(`1페이지: 펫 ${seen.size}마리`);
    const hint = maxPageOf(doc1);
    const styles = [n => `${SA}/petinfo?page=${n}`, n => `${SA}/bbs/board.php?bo_table=petinfo&page=${n}`];
    let style = -1;
    for (let n = 2; n <= 80; n++) {
      await sleep(700);
      let added = 0;
      if (style < 0) {                                   // 페이지 주소 방식 찾기
        for (let s = 0; s < styles.length && !added; s++) {
          try { added = add(parseCards(await fetchDoc(styles[s](n)))); if (added) style = s; } catch (e) { }
        }
      } else {
        try { added = add(parseCards(await fetchDoc(styles[style](n)))); } catch (e) { }
      }
      if (!added) { if (n > hint) break; else if (style < 0) break; }
      log(`${n}페이지: 누적 ${seen.size}마리`);
      bar(Math.min(0.3, n / Math.max(hint, n) * 0.3));
    }
    return [...seen.values()];
  }

  /* ── 원본계수·초기치 비율(k) 역산 (오르서버 계산기와 같은 방식) ── */
  const RANKS = [[100, null, 475], [95, 99, 495], [90, 94, 515], [85, 89, 535], [80, 84, 555], [null, 80, 575]];
  const rankOf = (s) => { for (let i = 0; i < 6; i++) { const [lo, hi] = RANKS[i]; if ((lo === null || s >= lo) && (hi === null || s <= hi)) return i; } return 5; };
  const disp = (g) => [4*g[0]+g[1]+g[2]+g[3], .1*g[0]+g[1]+.1*g[2]+.05*g[3], .1*g[0]+.1*g[1]+g[2]+.05*g[3], g[3]];
  const MINV = (() => {                                         // disp 의 역행렬
    const M = [[4,1,1,1],[.1,1,.1,.05],[.1,.1,1,.05],[0,0,0,1]];
    const A = M.map((r, i) => [...r, ...[0,1,2,3].map(j => i === j ? 1 : 0)]);
    for (let c = 0; c < 4; c++) {
      let p = c; for (let r = c + 1; r < 4; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]];
      const d = A[c][c]; for (let j = 0; j < 8; j++) A[c][j] /= d;
      for (let r = 0; r < 4; r++) if (r !== c) { const f = A[r][c]; for (let j = 0; j < 8; j++) A[r][j] -= f * A[c][j]; }
    }
    return A.map(r => r.slice(4));
  })();
  const floor3 = (x) => Math.floor(x * 1000 + 1e-7) / 1000;
  const initCalc = (O, k) => disp(O.map(o => k * (o + 4.5) / 100)).map(v => Math.floor(v + 1e-7));
  function solve(growth, init) {
    const h4 = MINV.map(row => row.reduce((s, v, i) => s + v * growth[i], 0));
    let best = null;
    for (let r = 0; r < 6; r++) {
      const B = RANKS[r][2];
      const Of = h4.map(x => x * 10000 / B - 4.5), O = Of.map(Math.round);
      if (rankOf(O.reduce((s, v) => s + v, 0)) !== r) continue;
      const gc = disp(O.map(o => (o + 4.5) * B / 10000)).map(floor3);
      const err = Math.max(...gc.map((v, i) => Math.abs(v - growth[i])));
      const dev = Math.max(...Of.map((v, i) => Math.abs(v - O[i])));
      if (!best || err < best.err - 1e-9 || (Math.abs(err - best.err) < 1e-9 && dev < best.dev)) best = { O, err, dev };
    }
    if (!best) return null;
    let k = null, kerr = Infinity;
    for (let kk = 1; kk <= 80; kk++) {
      const c = initCalc(best.O, kk), e = c.reduce((s, v, i) => s + Math.abs(v - init[i]), 0);
      if (e < kerr) { kerr = e; k = kk; if (e === 0) break; }
    }
    return { origin: best.O, k, approx: best.dev > 0.3 || kerr > 0 };
  }
  function variantOf(c) {
    if (c.cat !== "환생,진화") return "일반";
    const rest = c.detail.replace(/^환생,진화\s*/, "");
    const a = /환생/.test(rest), b = /진화/.test(rest);
    return a && !b ? "환생" : (b && !a ? "진화" : "환생·진화");
  }

  /* ── 실행 ── */
  async function run(save) {
    $("ouGo").disabled = $("ouCheck").disabled = true;
    try {
      log("공홈 목록 읽는 중… (천천히 받아요)");
      const cards = await loadAllCards();
      if (cards.length < 50) throw new Error(`펫이 ${cards.length}마리뿐이에요. 로그인 상태와 페이지를 확인해 주세요`);
      const pets = [];
      let approx = 0, unsolved = 0;
      cards.forEach(c => {
        const s = solve(c.growth, c.init);
        if (!s) { unsolved++; return; }
        if (s.approx) approx++;
        const variant = variantOf(c);
        pets.push({
          id: c.id, name: c.name, displayName: variant === "일반" ? c.name : `${c.name} · ${variant}`, variant,
          attrs: c.attrs, attr: c.attrs.map(a => a[0]).join(""), obtain: c.cat, obtainDetail: c.detail,
          growthS: c.growth, initS: c.init, origin: s.origin, k: s.k, rideable: c.ride, approx: s.approx, ok: true,
          imageUrl: c.img
        });
      });
      pets.sort((a, b) => Number(b.id) - Number(a.id));
      log(`펫 ${pets.length}마리 (탑승 가능 ${pets.filter(p => p.rideable).length}, 추정 ${approx}, 계산 못 한 것 ${unsolved})`);
      log("예: " + pets.slice(0, 3).map(p => p.displayName).join(", "));
      bar(0.35);
      if (!save) { bar(1); log("확인만 했어요. 저장은 안 했어요."); return; }
      if (!getToken()) { log("토큰이 없어요"); return; }

      log("깃허브 상태 확인…");
      const ref = await gh(`/git/ref/heads/${BRANCH}`);
      const baseCommit = await gh(`/git/commits/${ref.object.sha}`);
      const tree = await gh(`/git/trees/${baseCommit.tree.sha}?recursive=1`);
      const shaOf = {}; tree.tree.forEach(t => shaOf[t.path] = t.sha);
      const files = {};

      const ext = (u) => ((u || "").split("?")[0].match(/\.(gif|png|jpe?g|webp)$/i) || [0, "gif"])[1].toLowerCase();
      if ($("ouImg").checked) {
        const need = pets.filter(p => p.imageUrl && !shaOf[`pet-images/${p.id}.${ext(p.imageUrl)}`]);
        log(`새 펫 이미지 ${need.length}개` + (need.length > 60 ? " (처음에는 좀 걸려요)" : ""));
        let n = 0;
        for (const p of need) {
          try { files[`pet-images/${p.id}.${ext(p.imageUrl)}`] = await getBytes(p.imageUrl); } catch (e) { log(`  ! ${p.id} 실패`); }
          n++; bar(0.35 + n / Math.max(need.length, 1) * 0.45); await sleep(150);
        }
      }
      pets.forEach(p => {                                           // 사본이 있으면 사본을 쓰게
        const path = `pet-images/${p.id}.${ext(p.imageUrl)}`;
        if (files[path] || shaOf[path]) p.assetImage = path;
      });
      files["pets.json"] = new TextEncoder().encode(JSON.stringify(pets));

      const changed = [];
      for (const [path, u8] of Object.entries(files)) {
        if (shaOf[path] && shaOf[path] === await gitSha(u8)) continue;
        changed.push(path);
      }
      if (!changed.length) { bar(1); log("바뀔 게 없어요. 이미 최신!"); return; }
      log(`깃허브에 ${changed.length}개 파일 저장 중…`);
      const entries = [];
      for (const path of changed) {
        const blob = await gh(`/git/blobs`, { method: "POST", body: JSON.stringify({ content: b64(files[path]), encoding: "base64" }) });
        entries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
      }
      const newTree = await gh(`/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: entries }) });
      const stamp = new Date().toLocaleString("ko-KR");
      const commit = await gh(`/git/commits`, { method: "POST", body: JSON.stringify({
        message: `수동 데이터 갱신 ${stamp} (${changed.length}개)`, tree: newTree.sha, parents: [ref.object.sha] }) });
      await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
      bar(1);
      const nImg = changed.filter(p => p.startsWith("pet-images/")).length;
      log(`완료! pets.json` + (nImg ? ` + 펫 이미지 ${nImg}개` : "") + " 저장했어요");
      log("1~2분 뒤 사이트에 반영돼요");
    } catch (e) {
      log("오류: " + e.message);
      if (/401|403/.test(e.message)) log("토큰이 틀렸거나 권한이 없어요. 아래 '토큰 다시 입력'을 눌러주세요");
    } finally {
      $("ouGo").disabled = $("ouCheck").disabled = false;
    }
  }
  $("ouCheck").onclick = () => run(false);
  $("ouGo").onclick = () => run(true);
})();
