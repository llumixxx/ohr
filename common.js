/* OHR 공통 코드 - 계산기와 도감이 같이 써요 */
(function(){
"use strict";
const OHR = window.OHR = {};
OHR.$ = id => document.getElementById(id);
OHR.esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
OHR.smooth = () => !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
OHR.ATTRS = ["지","수","화","풍"];
OHR.ATTR_COLOR = { "지":"#4aa84a", "수":"#3d8ee0", "화":"#e5604a", "풍":"#d29a00" };
OHR.CATS = ["필드포획","퀘스트","희귀","레이드","복권","듀얼","환생,진화","지원","기타"];
OHR.catOf = p => OHR.CATS.indexOf(p.cat) >= 0 ? p.cat : "기타";

OHR.norm = function(p){
  if(!p || !p.name) return null;
  const arr = (a, n) => (Array.isArray(a) && a.length === n) ? a.map(Number) : null;
  const g = arr(p.growthS, 4), i0 = arr(p.initS, 4), o = arr(p.origin, 4), k = Number(p.k);
  return {
    id:String(p.id), name:String(p.displayName || p.name), group:String(p.name), variant:String(p.variant || "일반"),
    attrs:Array.isArray(p.attrs) ? p.attrs : [], cat:String(p.obtain || ""), detail:String(p.obtainDetail || p.obtain || ""),
    growthS:g || [0,0,0,0], initS:i0 || [0,0,0,0], origin:o, k:isFinite(k) ? k : null,
    rideable:!!p.rideable, approx:!!p.approx,
    ok:p.ok !== false && !!o && isFinite(k) && !!i0,
    img:String(p.assetImage || p.imageUrl || "")
  };
};
OHR.loadPets = async function(){
  const res = await fetch("pets.json", { cache:"no-cache" });
  if(!res.ok) throw new Error("pets.json " + res.status);
  const d = await res.json();
  const rows = Array.isArray(d) ? d : (d && d.pets) || [];
  const pets = rows.map(OHR.norm).filter(Boolean);
  pets.forEach(p => { p._cho = OHR.chosung(p.name); });
  return pets;
};

const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
OHR.chosung = function(str){
  let out = "";
  for(const ch of str){ const c = ch.charCodeAt(0) - 0xAC00; out += (c >= 0 && c <= 11171) ? CHO[Math.floor(c/588)] : ch; }
  return out;
};
const CLUSTER = { "ㄳ":"ㄱㅅ","ㄵ":"ㄴㅈ","ㄶ":"ㄴㅎ","ㄺ":"ㄹㄱ","ㄻ":"ㄹㅁ","ㄼ":"ㄹㅂ","ㄽ":"ㄹㅅ","ㄾ":"ㄹㅌ","ㄿ":"ㄹㅍ","ㅀ":"ㄹㅎ","ㅄ":"ㅂㅅ" };
OHR.expandClusters = s => Array.from(s).map(ch => CLUSTER[ch] || ch).join("");
OHR.nameMatch = (p, q) => p.name.includes(q) || p._cho.includes(OHR.expandClusters(q));

/* 즐겨찾기 (이 브라우저에만 저장) */
const FAV_KEY = "ohr-fav-ids";
OHR.favs = new Set();
try{ OHR.favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); }catch(e){}
OHR.saveFavs = () => { try{ localStorage.setItem(FAV_KEY, JSON.stringify([...OHR.favs])); }catch(e){} };

/* 이미지는 화면 근처에 왔을 때만 불러와요 */
const io = ("IntersectionObserver" in window)
  ? new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ io.unobserve(e.target); e.target.src = e.target.dataset.src; } }), { rootMargin:"300px 0px" })
  : null;
OHR.lazy = function(root){
  root.querySelectorAll("img[data-src]").forEach(im => {
    im.onerror = () => im.remove();
    if(io) io.observe(im); else im.src = im.dataset.src;
  });
};
OHR.imgTag = p => p.img ? `<img data-src="${OHR.esc(p.img)}" alt="" referrerpolicy="no-referrer" decoding="async">` : "";
})();
