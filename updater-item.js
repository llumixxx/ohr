/* OHR 아이템 데이터 갱신기 (수동)
   - 공홈(ohrsa.net) 아이템 페이지를 연 상태에서 같은 즐겨찾기 버튼을 누르면 실행돼요
   - 브라우저가 공홈 아이템 목록을 읽어서 items.json 을 만들고 깃허브(llumixxx/OHR)에 커밋 1번으로 저장해요
   - 새 아이템 이미지는 item-images/ 폴더에 사본으로 저장해요 */
(async () => {
  const OWNER = "llumixxx", REPO = "OHR", BRANCH = "main";
  const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const TOKEN_KEY = "ohr_gh_token";

  /* ── 공홈 카드 읽기 ── */
  const KEYS = { "공":"atk", "방":"def", "순":"agi", "내":"hp", "크리":"crit", "회피":"evas", "명중":"acc", "관통":"pen", "\uc274\ub4dc":"shld" };
  function range(txt) {                                  // "+46~69" → [46,69], "-25~30" → [-25,30], "-" → null
    const t = (txt || "").replace(/[가-힣]/g, "").replace(/[+%\s]/g, "");
    if (!t || t === "-") return null;
    const m = t.match(/(-?\d+(?:\.\d+)?)(?:~(-?\d+(?:\.\d+)?))?/);
    if (!m) return null;
    const a = +m[1], b = m[2] !== undefined ? +m[2] : a;
    return [Math.min(a, b), Math.max(a, b)];
  }
  function parseItemCards(doc) {
    const out = [];
    doc.querySelectorAll("div.item_obj").forEach(c => {
      const d = c.dataset;
      const text = (sel) => ((c.querySelector(sel) || {}).textContent || "").replace(/\s+/g, " ").trim();
      const s = {}, n = {};
      let attr = "";
      c.querySelectorAll("table.item_stats_table th").forEach(th => {
        const td = th.nextElementSibling; if (!td) return;
        const label = th.textContent.trim(), raw = td.textContent.replace(/\s+/g, " ").trim();
        if (label === "속성") { attr = raw === "-" ? "" : raw; return; }
        const k = KEYS[label]; if (!k) return;
        const r = range(raw);
        if (r) { s[k] = raw.replace(/^[가-힣]+/, ""); n[k] = r; }
      });
      const item = {
        id: String(d.wrId || ""), name: d.name || text(".item_name_title"),
        cat: d.cat || text(".item_badge"), img: d.img || "",
        obtain: text(".item_obtain_info").replace(/^획득:?\s*/, ""),
        desc: text(".item_desc_area"), attr, s, n
      };
      if (!item.id || !item.name) return;
      out.push(item);
    });
    return out;
  }
  if (window.__OHR_TEST) { window.__ohrParse = parseItemCards; return; }

  const SA = location.origin;
  if (!/(^|\.)ohrsa\.net$/.test(location.hostname)) {
    alert("공홈(ohrsa.net)에서 눌러주세요!\n예: https://ohrsa.net/item");
    return;
  }
  if (document.getElementById("ohrUpd")) document.getElementById("ohrUpd").remove();

  /* ── 화면 ── */
  const box = document.createElement("div");
  box.id = "ohrUpd";
  box.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;width:340px;background:#10181c;color:#eee;" +
    "font:13px/1.5 'Noto Sans KR',sans-serif;border:2px solid #f58fb0;border-radius:14px;padding:14px;box-shadow:0 8px 30px #0008";
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <b style="font-size:15px;color:#f58fb0">OHR 아이템 갱신</b>
      <span id="ouX" style="cursor:pointer;opacity:.7">✕</span></div>
    <label style="display:block"><input type="checkbox" id="ouImg" checked> 새 아이템 이미지도 저장</label>
    <button id="ouCheck" style="margin-top:10px;width:100%;padding:8px;border:1px solid #f58fb0;border-radius:9px;background:none;color:#f58fb0;font-weight:700;cursor:pointer">확인만 (저장 안 함)</button>
    <button id="ouGo" style="margin-top:6px;width:100%;padding:9px;border:0;border-radius:9px;background:#f58fb0;color:#2a0c18;font-weight:700;cursor:pointer">갱신 시작 (깃허브에 저장)</button>
    <div style="height:6px;background:#2a2d3a;border-radius:4px;margin-top:10px;overflow:hidden"><div id="ouFill" style="height:100%;width:0;background:#4caf50"></div></div>
    <div id="ouLog" style="margin-top:8px;max-height:240px;overflow:auto;font-size:12px;white-space:pre-wrap"></div>
    <div style="margin-top:8px;font-size:11px;opacity:.6;cursor:pointer" id="ouTok">토큰 다시 입력</div>`;
  document.body.appendChild(box);
  const $ = (id) => box.querySelector("#" + id);
  const log = (t) => { $("ouLog").textContent += t + "\n"; $("ouLog").scrollTop = 1e9; };
  const bar = (p) => { $("ouFill").style.width = Math.round(p * 100) + "%"; };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  $("ouX").onclick = () => box.remove();

  /* ── 깃허브 토큰 (펫 갱신기와 같은 토큰을 써요) ── */
  function getToken(force) {
    let t = !force && localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = prompt("깃허브 토큰을 붙여넣어 주세요 (처음 한 번만)\n\n만드는 곳: github.com > Settings > Developer settings > Fine-grained tokens\n· Repository access: llumixxx/OHR 만\n· Permissions > Contents: Read and write");
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
  const fetchDoc = async (url) => {
    const r = await fetch(url, { cache: "no-store", credentials: "include" });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return new DOMParser().parseFromString(await r.text(), "text/html");
  };

  async function loadAllItems() {
    const seen = new Map();
    const add = (list) => { let n = 0; list.forEach(c => { if (!seen.has(c.id)) { seen.set(c.id, c); n++; } }); return n; };
    add(parseItemCards(await fetchDoc(`${SA}/item`)));
    log(`1페이지: 아이템 ${seen.size}개`);
    for (let n = 2; n <= 40; n++) {                      // 한 페이지에 다 있으면 바로 끝나요
      await sleep(700);
      let added = 0;
      try { added = add(parseItemCards(await fetchDoc(`${SA}/item?page=${n}`))); } catch (e) { }
      if (!added) break;
      log(`${n}페이지: 누적 ${seen.size}개`);
      bar(Math.min(0.3, n / 10 * 0.3));
    }
    return [...seen.values()];
  }

  /* ── 실행 ── */
  async function run(save) {
    $("ouGo").disabled = $("ouCheck").disabled = true;
    try {
      log("공홈 아이템 목록 읽는 중…");
      const items = await loadAllItems();
      if (items.length < 20) throw new Error(`아이템이 ${items.length}개뿐이에요. 로그인 상태와 페이지를 확인해 주세요`);
      items.sort((a, b) => Number(b.id) - Number(a.id));
      const cats = {}; items.forEach(i => cats[i.cat] = (cats[i.cat] || 0) + 1);
      log(`아이템 ${items.length}개`);
      log("분류: " + Object.entries(cats).map(([k, v]) => `${k} ${v}`).join(", "));
      log("예: " + items.slice(0, 3).map(i => i.name).join(", "));
      bar(0.35);
      if (!save) { bar(1); log("확인만 했어요. 저장은 안 했어요."); return; }
      if (!getToken()) { log("토큰이 없어요"); return; }

      log("깃허브 상태 확인…");
      const ref = await gh(`/git/ref/heads/${BRANCH}`);
      const baseCommit = await gh(`/git/commits/${ref.object.sha}`);
      const tree = await gh(`/git/trees/${baseCommit.tree.sha}?recursive=1`);
      const shaOf = {}; tree.tree.forEach(t => shaOf[t.path] = t.sha);
      const files = {};

      const ext = (u) => ((u || "").split("?")[0].match(/\.(gif|png|jpe?g|webp)$/i) || [0, "png"])[1].toLowerCase();
      if ($("ouImg").checked) {
        const need = items.filter(p => p.img && !shaOf[`item-images/${p.id}.${ext(p.img)}`]);
        log(`새 아이템 이미지 ${need.length}개`);
        let n = 0;
        for (const p of need) {
          try { files[`item-images/${p.id}.${ext(p.img)}`] = await getBytes(p.img); } catch (e) { log(`  ! ${p.id} 실패`); }
          n++; bar(0.35 + n / Math.max(need.length, 1) * 0.45); await sleep(150);
        }
      }
      items.forEach(p => {                                       // 사본이 있으면 사본을 쓰게
        const path = `item-images/${p.id}.${ext(p.img)}`;
        if (files[path] || shaOf[path]) p.assetImage = path;
      });
      files["items.json"] = new TextEncoder().encode(JSON.stringify(items));

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
        message: `수동 아이템 갱신 ${stamp} (${changed.length}개)`, tree: newTree.sha, parents: [ref.object.sha] }) });
      await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
      bar(1);
      const nImg = changed.filter(p => p.startsWith("item-images/")).length;
      log(`완료! items.json` + (nImg ? ` + 아이템 이미지 ${nImg}개` : "") + " 저장했어요");
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
