/* OHR 공통 메뉴 - 메뉴를 늘리려면 아래 목록에 한 줄만 더 넣으면 돼요.
   href  : 이동할 주소 (같은 폴더의 파일명 또는 전체 주소)
   label : 메뉴 이름
   match : 이 파일들에서도 이 메뉴가 선택된 것으로 표시 (하위 페이지용, 선택)
   blank : true 이면 새 탭으로 열기 (선택)
   각 페이지에는 <div id="siteNav"></div> 한 줄과 이 파일만 넣으면 같은 메뉴가 나와요. */
const OHR_NAV_ITEMS = [
  { href: "index.html", label: "환각 계산기" },
  { href: "pokedex.html", label: "펫 도감" },
  { href: "items.html", label: "아이템 도감" },
  { href: "ride.html", label: "탑승효율" },
  { href: "stat.html", label: "능력치 계산기" },
  // 새 메뉴 예시:  { href: "새파일.html", label: "메뉴 이름" },
  { href: "https://ohrsa.net", label: "공홈", blank: true }
];
(function(){
  const box = document.getElementById("siteNav");
  if(!box) return;
  const cur = location.pathname.split("/").pop() || "index.html";
  const links = OHR_NAV_ITEMS.map(i => {
    const on = !i.blank && (i.href === cur || (i.match && i.match.indexOf(cur) !== -1));
    return `<a href="${i.href}"${i.blank ? ' target="_blank" rel="noopener"' : ""}${on ? ' class="on" aria-current="page"' : ""}>${i.label}${i.blank ? " ↗" : ""}</a>`;
  }).join("");
  box.className = "top";
  box.innerHTML = `<div class="top-in"><a class="brand" href="index.html">OHR Mate<small>- made by 해적 부족 반기노</small></a><nav class="menu" aria-label="메뉴">${links}</nav></div>`;
})();
