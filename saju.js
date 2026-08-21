// 사주 원국(四柱原局) 계산 엔진.
// 만세력(절기/음양력) 계산은 오픈소스 라이브러리 lunisolar(+ char8ex 플러그인)에
// 전적으로 위임하고, 이 파일은 (1) 음력 입력 처리 (2) 진태양시 보정 (3) 대운(大運)
// 계산 (4) 결과를 한글 용어로 정리하는 역할만 담당한다.
// -> 계산은 항상 결정론적 코드가 담당하고, AI(제미나이)는 "이미 정확히 계산된
//    데이터"를 해석만 하도록 역할을 분리한다 (LLM에게 역법 계산을 직접 맡기지 않음).

const STEM_KO = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const BRANCH_KO = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
const STEM_ELEMENT = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"];
const BRANCH_ELEMENT = ["수", "토", "목", "목", "토", "화", "화", "토", "금", "금", "토", "수"];
const ELEMENT_HANJA = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" };

const TEN_GOD_KO = {
  日主: "일간(비아)",
  比肩: "비견",
  劫財: "겁재",
  食神: "식신",
  傷官: "상관",
  偏財: "편재",
  正財: "정재",
  七殺: "편관(칠살)",
  正官: "정관",
  梟神: "편인(효신)",
  正印: "정인",
};

function koStem(stem) {
  return { hanja: stem.name, ko: STEM_KO[stem.value], element: STEM_ELEMENT[stem.value], yinyang: stem.value % 2 === 0 ? "양" : "음" };
}
function koBranch(branch) {
  return { hanja: branch.name, ko: BRANCH_KO[branch.value], element: BRANCH_ELEMENT[branch.value], yinyang: branch.value % 2 === 0 ? "양" : "음" };
}
function koTenGod(tenGod) {
  if (!tenGod) return null;
  return TEN_GOD_KO[tenGod.key] || tenGod.name;
}

function kstDate(y, m, d, h, mi) {
  // y,m(1-12),d,h,mi 를 "한국 표준시(KST, UTC+9) 벽시계 시각"으로 해석해
  // 브라우저/서버의 로컬 타임존과 무관하게 항상 같은 실제 시각(Date)을 만든다.
  return new Date(Date.UTC(y, m - 1, d, h, mi) - 9 * 60 * 60 * 1000);
}

function pillarInfo(pillar) {
  return {
    ganji: pillar.name,
    stem: koStem(pillar.stem),
    branch: koBranch(pillar.branch),
    stemTenGod: koTenGod(pillar.stemTenGod),
    branchTenGods: pillar.branchTenGod.map(koTenGod),
    hiddenStems: pillar.branch.hiddenStems.map((s) => `${STEM_KO[s.value]}(${s.name})`),
    takeSound: pillar.takeSound,
  };
}

function tallyElements(pillars) {
  const counts = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const p of pillars) {
    counts[STEM_ELEMENT[p.stem.value]]++;
    counts[BRANCH_ELEMENT[p.branch.value]]++;
  }
  return counts;
}

// 대운(大運) 계산: 절입(節入, 12절) 기준 순행/역행 + 대운수(일수/3, 반올림).
// 절기 날짜는 lunisolar가 "일(day) 단위"로만 제공하므로(시각까지의 완전한
// 천문 정밀도는 아님) 대운수는 근사치이며, 화면에도 이를 명시한다.
function calcDaewoon(lunisolar, ls, char8ex, birthDate, isMale) {
  const SolarTerm = lunisolar.SolarTerm;
  const yearStemValue = char8ex.year.stem.value;
  const isYangYear = yearStemValue % 2 === 0;
  const forward = (isYangYear && isMale) || (!isYangYear && !isMale);

  const [, prevJie, prevJieDate] = ls.getMonthBuilder(0); // prevJie: 직전(또는 현재) 절, 짝수 index만 나옴
  let anchorDate, daysDiff;
  if (forward) {
    // prevJieDate가 실제로 속한 연도를 기준으로 다음 절의 연도를 판단한다
    // (출생일의 연도가 아님 — 예: 1985-01-01생은 prevJie가 1984년 12월 대설이므로
    //  다음 절인 소한은 1985년, 즉 prevJie 연도+1 이지 출생 연도+1이 아니다).
    const prevJieYear = lunisolar(prevJieDate, { utcOffset: 9 }).year;
    const nextIndex = (prevJie.value + 2) % 24;
    const nextYear = nextIndex < prevJie.value ? prevJieYear + 1 : prevJieYear;
    const [yy, mm, dd] = SolarTerm.findDate(nextYear, nextIndex);
    anchorDate = kstDate(yy, mm, dd, 0, 0);
    daysDiff = (anchorDate - birthDate) / 86400000;
  } else {
    anchorDate = prevJieDate;
    daysDiff = (birthDate - anchorDate) / 86400000;
  }
  daysDiff = Math.max(0, daysDiff);
  const startAge = Math.max(1, Math.round(daysDiff / 3));

  const monthValue = char8ex.month.value;
  const list = [];
  for (let i = 1; i <= 9; i++) {
    const val = ((monthValue + (forward ? i : -i)) % 60 + 60) % 60;
    const sb = new lunisolar.SB(val);
    list.push({
      age: startAge + (i - 1) * 10,
      ganji: sb.name,
      stem: koStem(sb.stem),
      branch: koBranch(sb.branch),
    });
  }
  return { forward, startAge, list, approximate: true };
}

function currentAge(birthSolarDate, now) {
  let age = now.getFullYear() - birthSolarDate.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > birthSolarDate.getMonth() ||
    (now.getMonth() === birthSolarDate.getMonth() && now.getDate() >= birthSolarDate.getDate());
  if (!hasHadBirthdayThisYear) age--;
  return Math.max(0, age);
}

/**
 * @param {Object} input
 *  calendarType: 'solar' | 'lunar'
 *  year, month, day: number (lunar인 경우 음력 연월일)
 *  isLeapMonth: boolean (음력 윤달 여부)
 *  timeUnknown: boolean
 *  hour, minute: number (0-23 / 0-59), timeUnknown이면 무시
 *  gender: 'male' | 'female'
 *  placeKey: string | null (places.js의 key)
 *  applyTrueSolarTime: boolean
 */
function calculateSaju(input) {
  const ls_ = window.lunisolar;
  const isMale = input.gender === "male";

  let solarY, solarM, solarD;
  if (input.calendarType === "lunar") {
    const lunarResolved = ls_.fromLunar({
      year: input.year,
      month: input.month,
      day: input.day,
      hour: 0,
      isLeapMonth: !!input.isLeapMonth,
    });
    solarY = lunarResolved.year;
    solarM = lunarResolved.month;
    solarD = lunarResolved.day;
  } else {
    solarY = input.year;
    solarM = input.month;
    solarD = input.day;
  }

  const timeKnown = !input.timeUnknown;
  const hour = timeKnown ? input.hour : 12;
  const minute = timeKnown ? input.minute : 0;

  let correctionMinutes = 0;
  const place = input.placeKey ? findPlace(input.placeKey) : null;
  const trueSolarTimeApplied = !!(timeKnown && input.applyTrueSolarTime && place);
  if (trueSolarTimeApplied) {
    correctionMinutes = Math.round((place.lon - 135) * 4);
  }

  let birthDate = kstDate(solarY, solarM, solarD, hour, minute);
  if (trueSolarTimeApplied) {
    birthDate = new Date(birthDate.getTime() + correctionMinutes * 60000);
  }

  const ls = ls_(birthDate, { utcOffset: 9 });
  const char8 = ls.char8;
  const char8ex = ls.char8ex(isMale ? 1 : 0);

  const pillars = {
    year: pillarInfo(char8ex.year),
    month: pillarInfo(char8ex.month),
    day: pillarInfo(char8ex.day),
    hour: timeKnown ? pillarInfo(char8ex.hour) : null,
  };

  const dayMaster = koStem(char8.me);

  const elementList = [char8.year, char8.month, char8.day];
  if (timeKnown) elementList.push(char8.hour);
  const elementCounts = tallyElements(elementList);

  const daewoon = calcDaewoon(ls_, ls, char8ex, birthDate, isMale);

  const missing = char8ex.missing.map((b) => koBranch(b).ko + "(" + b.name + ")");

  let extras = null;
  if (timeKnown) {
    extras = {
      embryo: char8ex.embryo().name,
      ownSign: char8ex.ownSign().name,
      bodySign: char8ex.bodySign().name,
    };
  }

  const now = new Date();
  const nowLs = ls_(now, { utcOffset: 9 });
  const currentYearPillar = pillarInfo(nowLs.char8ex(isMale ? 1 : 0).year);

  return {
    input,
    solarDate: { year: solarY, month: solarM, day: solarD, hour: timeKnown ? hour : null, minute: timeKnown ? minute : null },
    lunarDateText: ls.lunar.toString(),
    timeKnown,
    place: place ? place.name : (input.placeText || null),
    trueSolarTimeApplied,
    correctionMinutes,
    pillars,
    dayMaster,
    elementCounts,
    daewoon,
    missing,
    extras,
    age: currentAge(kstDate(solarY, solarM, solarD, 12, 0), now),
    currentYearPillar,
    currentYear: now.getFullYear(),
  };
}

window.Saju = { calculate: calculateSaju };
