/* OHR 강화 시스템 데이터와 계산 (강화 시뮬레이터, 능력치 계산기가 같이 써요)
   - 강화 가능 장비: 도끼, 곤봉, 창, 활, 투구, 갑옷 (장신구 등은 불가), 최대 +10
   - +1~+4 실패 시 장비 유지, +5 이상 실패 시 장비 파괴
   - 강화 보조제: D급 +5% / C급 +10% / B급 +15% (성공 확률에 더하고 최대 100%) */
(function(){
"use strict";
const MAX = 10, SAFE = 4;
const BASE = [100, 80, 60, 50, 40, 30, 30, 20, 20, 10];                          // 목표 +1 ~ +10 기본 확률(%)
const COST = [10900, 18950, 28510, 64040, 84450, 110410, 142300, 258400, 385410, 485445];   // 목표 +1 ~ +10 강화 비용(S)
const ASSIST = { none:{ label:"없음", plus:0 }, D:{ label:"D급", plus:5 }, C:{ label:"C급", plus:10 }, B:{ label:"B급", plus:15 } };
/* 단계별 추가 능력치: atk 공격, acc 명중(%), pen 관통, def 방어, hp 내구력, shld 쉴드 */
const GAIN = {
  weapon:[{atk:1},{atk:1},{atk:1},{atk:2},{atk:2},{atk:2,acc:5},{atk:3,pen:3},{atk:3,pen:5,acc:5},{atk:5,pen:8},{atk:5,pen:15,acc:5}],
  armor: [{def:1},{def:1},{def:1},{def:2},{def:2},{def:2,hp:5},{def:3,shld:3},{def:3,shld:5,hp:5},{def:5,shld:5},{def:5,shld:10,hp:15}]
};
const rate = (target, assist) => Math.min(100, BASE[target - 1] + (ASSIST[assist || "none"] || ASSIST.none).plus);
const cost = target => COST[target - 1];
const destroys = target => target > SAFE;               // 이 단계에 도전해서 실패하면 장비가 파괴되는지
function cum(kind, lv){                                 // 누적 능력치
  const o = {};
  for(let i = 0; i < lv; i++){ const g = GAIN[kind][i]; for(const k in g) o[k] = (o[k] || 0) + g[k]; }
  return o;
}
/* 강화 가능한 장비인지: 칸 종류(무기/투구/갑옷)와 이름으로 판단. 손톱, 부메랑, 스로잉은 강화 불가로 봐요 */
function kindOf(slotType, name){
  if(slotType === "head" || slotType === "body") return "armor";
  if(slotType === "weapon" && !/손톱|부메랑|스로잉/.test(name || "")) return "weapon";
  return null;
}
/* 기대값: start 단계(+start)에서 target 단계까지 가는 데 드는 평균 시도, 파괴 개수, 비용
   assistPrice: 시도 1번당 보조제 값, itemPrice: 파괴될 때마다 새로 사는 장비 값 (파괴되면 +0부터 다시) */
function expected(start, target, assist, itemPrice, assistPrice){
  if(start >= target) return { attempts:0, destroys:0, cost:0 };
  const usePrice = assist && assist !== "none" ? (assistPrice || 0) : 0;
  const solve = (perTry, perDestroy) => {                // E_k = A_k + B_k * E_0 꼴로 풀어요
    const A = new Array(MAX + 1).fill(0), B = new Array(MAX + 1).fill(0);
    for(let k = target - 1; k >= 0; k--){
      const p = rate(k + 1, assist) / 100, c = perTry(k + 1);
      if(!destroys(k + 1)){ A[k] = c / p + A[k + 1]; B[k] = B[k + 1]; }
      else { A[k] = c + p * A[k + 1] + (1 - p) * perDestroy; B[k] = p * B[k + 1] + (1 - p); }
    }
    const E0 = A[0] / (1 - B[0]);
    return A[start] + B[start] * E0;
  };
  return {
    attempts: solve(() => 1, 0),
    destroys: solve(() => 0, 1),
    cost: solve(t => cost(t) + usePrice, itemPrice || 0)
  };
}
/* 한 번 끝까지 돌려보기 (몬테카를로용) */
function runOnce(start, target, assist, itemPrice, assistPrice, rnd){
  const usePrice = assist && assist !== "none" ? (assistPrice || 0) : 0;
  let lv = start, attempts = 0, d = 0, money = 0;
  while(lv < target){
    attempts++; money += cost(lv + 1) + usePrice;
    if(rnd() * 100 < rate(lv + 1, assist)) lv++;
    else if(destroys(lv + 1)){ d++; money += itemPrice || 0; lv = 0; }
  }
  return { attempts, destroys:d, cost:money };
}
window.OHR_ENH = { MAX, SAFE, BASE, COST, ASSIST, GAIN, rate, cost, destroys, cum, kindOf, expected, runOnce };
})();
