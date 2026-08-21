// 태어난 곳 목록과 진태양시(眞太陽時) 보정을 위한 대표 경도(동경, °E).
// 한국 표준시(KST, UTC+9)는 동경 135°를 기준으로 하므로, 실제 출생지의 경도가
// 135°보다 서쪽일수록(우리나라 대부분) 태양이 그 자리에 남중하는 실제 시각은
// 시계보다 늦다 — 즉 "진태양시 = 시계 시각 + (경도-135)*4분" 만큼 보정한다.
// (등화문·일광절약시 등은 고려하지 않은 경도 기준의 지방시 보정으로, 완전한
//  균시차(equation of time) 보정은 아님을 결과 화면에 명시한다.)
const PLACES = [
  { key: "seoul", name: "서울", lon: 126.98 },
  { key: "incheon", name: "인천", lon: 126.7 },
  { key: "suwon", name: "수원", lon: 127.03 },
  { key: "chuncheon", name: "춘천", lon: 127.73 },
  { key: "gangneung", name: "강릉", lon: 128.9 },
  { key: "cheongju", name: "청주", lon: 127.49 },
  { key: "daejeon", name: "대전", lon: 127.38 },
  { key: "sejong", name: "세종", lon: 127.29 },
  { key: "jeonju", name: "전주", lon: 127.15 },
  { key: "gwangju", name: "광주", lon: 126.85 },
  { key: "mokpo", name: "목포", lon: 126.39 },
  { key: "yeosu", name: "여수", lon: 127.66 },
  { key: "daegu", name: "대구", lon: 128.6 },
  { key: "pohang", name: "포항", lon: 129.36 },
  { key: "busan", name: "부산", lon: 129.08 },
  { key: "ulsan", name: "울산", lon: 129.31 },
  { key: "changwon", name: "창원", lon: 128.68 },
  { key: "jeju", name: "제주", lon: 126.53 },
  { key: "uijeongbu", name: "의정부", lon: 127.05 },
  { key: "ansan", name: "안산", lon: 126.83 },
  { key: "anyang", name: "안양", lon: 126.95 },
  { key: "goyang", name: "고양", lon: 126.83 },
  { key: "seongnam", name: "성남", lon: 127.14 },
  { key: "yongin", name: "용인", lon: 127.18 },
  { key: "cheonan", name: "천안", lon: 127.15 },
  { key: "wonju", name: "원주", lon: 127.94 },
  { key: "sokcho", name: "속초", lon: 128.59 },
  { key: "andong", name: "안동", lon: 128.73 },
  { key: "gumi", name: "구미", lon: 128.34 },
  { key: "jinju", name: "진주", lon: 128.09 },
  { key: "tongyeong", name: "통영", lon: 128.43 },
  { key: "gunsan", name: "군산", lon: 126.74 },
  { key: "suncheon", name: "순천", lon: 127.49 },
  { key: "chungju", name: "충주", lon: 127.93 },
  { key: "pyeongyang", name: "평양(북한)", lon: 125.75 },
  { key: "sinuiju", name: "신의주(북한)", lon: 124.4 },
  { key: "hamhung", name: "함흥(북한)", lon: 127.54 },
];

const PLACE_OTHER_KEY = "__other__";

function findPlace(key) {
  return PLACES.find((p) => p.key === key) || null;
}
