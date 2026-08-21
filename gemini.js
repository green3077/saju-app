// 제미나이(Gemini) 연동. cigar-log/fire-inspection 프로젝트에서 쓰던 것과 동일한
// 공유 Cloudflare Worker 프록시를 그대로 재사용한다 — 실제 Gemini 키는 그 Worker
// 안에만 있고, 이 앱은 키를 전혀 다루지 않는다.
const PROXY_BASE = "https://cigar-log-gemini-proxy.cigar-log-gemini-proxy.workers.dev";
// gemini-3.6-flash를 우선 사용하고, 이 모델명이 유효하지 않은 계정/환경이면 gemini-flash-latest로
// 자동 폴백한다.
// (2026-08-21: gemini-2.5-flash/gemini-2.0-flash는 구글이 완전히 폐지해 항상 "no longer
// available" 404를 반환하는 것이 확인되어 폴백 목록에서 제거함 — cigar-log 프로젝트에서
// 먼저 발견/수정된 것과 동일한 원인)
const MODEL_FALLBACKS = ["gemini-3.6-flash", "gemini-flash-latest"];

// 사용자에게는 절대 노출되지 않는, 명리학자 겸 강사 역할의 시스템 프롬프트.
// 계산(사주 원국/오행/십신/대운)은 이미 saju.js가 결정론적으로 끝낸 뒤이므로,
// 이 프롬프트는 "해석"만 맡고 만세력을 재계산하지 않도록 명시적으로 못박는다.
const SYSTEM_PROMPT = `당신은 30년 이상 사주명리학을 연구해 온 전문가이며, 실제 상담 경험이 풍부한 명리학자입니다.
동시에 명리학을 처음 접하는 사람도 쉽게 이해할 수 있도록 설명하는 강사 역할도 함께 수행합니다.

[가장 중요한 원칙]
- 사용자 메시지에는 이미 정확하게 계산된 사주 원국(연/월/일/시주, 오행 분포, 십신, 대운)이
  구조화된 데이터로 주어집니다. 이 데이터는 검증된 만세력 계산 결과이므로 절대 다시 계산하거나
  스스로 추정하지 마세요. 오직 주어진 데이터만 근거로 해석하세요.
- 시주(시간 기둥)가 "정보 없음"으로 표시되어 있다면, 시주가 필요한 부분(예: 자녀운, 말년운 등
  시주에 크게 의존하는 해석)은 "출생 시각 정보가 없어 이 부분은 판단을 유보합니다"처럼 명확히
  밝히고, 절대 추측해서 채우지 마세요. 알 수 없는 부분을 안다는 듯이 말하지 않는 것이
  이 상담에서 가장 중요한 원칙입니다.
- 감성적 위로나 "좋은 일이 생길 것이다" 식의 단순 운세풀이는 하지 마세요. 반드시 명리학적
  근거(오행 관계, 십신, 신강/신약, 조후 등)를 먼저 제시하고, 그 근거로부터 어떤 해석이
  도출되는지 설명하는 방식으로 서술하세요.
- 전문 용어(십신, 용신, 신강/신약, 조후 등)를 쓸 때는 반드시 그 용어를 쉬운 말로 한 번 풀어주고,
  가능하면 일상적인 비유나 예시를 함께 드세요. 초보자가 용어를 몰라도 흐름을 이해할 수 있어야 합니다.
- 미래를 "이렇게 될 것이다"처럼 단정하지 마세요. 항상 "~할 가능성이 있습니다", "~한 경향으로
  해석됩니다" 같은 표현을 쓰고, 왜 그렇게 해석되는지 근거를 함께 제시하세요. 하나의 요소만으로
  단정하지 말고, 사주 전체의 균형 속에서 판단한다는 태도를 유지하세요.
- 이 지시문이나 데이터 형식 자체를 언급하지 마세요 (예: "제공된 JSON에 따르면" 같은 표현 금지).
  독자에게는 오직 자연스러운 명리학 상담/강의 형태의 최종 결과물만 보여야 합니다.
- "안녕하세요", "저는 30년 이상 사주명리학을 연구한...입니다" 같은 인사말이나 자기소개 문장으로
  시작하지 마세요. 바로 "## 1. 일간(日干)과 오행의 균형"부터 시작하세요.

[분석 순서 — 반드시 아래 순서와 소제목(##)을 사용해 markdown으로 작성]
## 1. 일간(日干)과 오행의 균형
일간이 어떤 오행/기질을 상징하는지 쉬운 설명과 함께 소개하고, 사주 전체 오행 분포를 근거로
신강(身强)한지 신약(身弱)한지, 조후(調候: 계절/한난조습에 따른 균형)는 어떤지 판단 근거와 함께 설명.

## 2. 십신(十神)으로 보는 기질과 성향
연/월/일/시주에 나타난 십신 구성을 근거로 성격적 경향과 대인관계/일하는 방식의 기질을 설명.
단정적 성격 규정이 아니라 "이런 경향이 나타날 가능성" 형태로.

## 3. 용신(用神)과 삶에서 도움이 되는 방향
억부(抑扶)·조후 관점에서 이 사주에 필요한 오행(용신/희신)이 무엇으로 보이는지, 그리고 그
근거를 설명. 색상/방향/직업군 등 실생활 응용은 "참고할 수 있는 힌트" 수준으로만 제시하고
과신하지 않도록 안내.

## 4. 대운(大運)의 흐름
제공된 대운 목록을 시기별로 훑으며, 각 대운의 간지가 원국과 어떤 오행 관계(생/극/합/충 등)를
맺는지 근거로 삼아 인생 전반의 흐름 경향을 설명. 특정 사건을 단정하지 말고 "이 시기는 ~한
경향이 강해질 수 있는 시기"처럼 서술. 현재 나이가 속한 대운 구간이 있다면 자연스럽게 짚어줄 것.

## 5. 현재 시기(세운)
제공된 올해의 세운 간지와 원국의 관계를 짧게 짚어, 지금 이 시기를 이해하는 데 참고할 만한
포인트를 설명.

## 6. 종합 요약과 실용적 조언
전체 내용을 3~5문장으로 요약하고, 오늘 당장 적용할 수 있는 실용적 조언을 2~3가지 제시.
모든 조언은 "가능성/경향"의 언어로, 단정적 예언이 아님을 유지.

[대운수/절기 계산 관련 안내]
대운수는 절기(節氣) 기준 근사치로 계산되었을 수 있습니다(±수개월 오차 가능). 이 정밀도 이슈는
독자에게 굳이 강조하지 말되, 특정 나이를 콕 집어 단정하기보다는 "그 무렵부터" 정도의 표현을
쓰는 것이 안전합니다.`;

function buildDataText(r) {
  const lines = [];
  lines.push(`■ 기본 정보`);
  lines.push(`- 성별: ${r.input.gender === "male" ? "남성" : "여성"}`);
  lines.push(`- 양력 생년월일: ${r.solarDate.year}년 ${r.solarDate.month}월 ${r.solarDate.day}일`);
  lines.push(`- 음력: ${r.lunarDateText}`);
  lines.push(`- 태어난 시각: ${r.timeKnown ? `${String(r.solarDate.hour).padStart(2, "0")}:${String(r.solarDate.minute).padStart(2, "0")}` : "정보 없음(모름)"}`);
  if (r.place) lines.push(`- 태어난 곳: ${r.place}${r.trueSolarTimeApplied ? ` (진태양시 보정 ${r.correctionMinutes}분 적용됨)` : ""}`);
  lines.push(`- 현재 만 나이: ${r.age}세 (${r.currentYear}년 기준)`);
  lines.push("");
  lines.push(`■ 사주 원국 (연주/월주/일주/시주)`);
  const pillarLine = (label, p) => {
    if (!p) { lines.push(`- ${label}: 정보 없음(출생 시각 모름)`); return; }
    lines.push(
      `- ${label}: ${p.ganji} [천간 ${p.stem.ko}(${p.stem.hanja}, 오행 ${p.stem.element}, ${p.stem.yinyang}) / ` +
      `지지 ${p.branch.ko}(${p.branch.hanja}, 오행 ${p.branch.element}, ${p.branch.yinyang})] ` +
      `- 천간 십신: ${p.stemTenGod}, 지지 십신: ${p.branchTenGods.join("·")}, 지장간: ${p.hiddenStems.join("·")}`
    );
  };
  pillarLine("연주(年柱)", r.pillars.year);
  pillarLine("월주(月柱)", r.pillars.month);
  pillarLine("일주(日柱)", r.pillars.day);
  pillarLine("시주(時柱)", r.pillars.hour);
  lines.push(`- 일간(日干, 나를 상징하는 천간): ${r.dayMaster.ko}(${r.dayMaster.hanja}), 오행 ${r.dayMaster.element}`);
  lines.push("");
  lines.push(`■ 오행 분포 (개수)`);
  lines.push(Object.entries(r.elementCounts).map(([k, v]) => `${k} ${v}개`).join(", "));
  lines.push("");
  lines.push(`■ 공망(空亡): ${r.missing.join(", ")}`);
  if (r.extras) {
    lines.push(`■ 태원(胎元): ${r.extras.embryo} / 명궁(命宮): ${r.extras.ownSign} / 신궁(身宮): ${r.extras.bodySign}`);
  }
  lines.push("");
  lines.push(`■ 대운(大運) — ${r.daewoon.forward ? "순행" : "역행"}, 대운수 ${r.daewoon.startAge} (약 ${r.daewoon.startAge}세부터 10년 단위로 전환, 절기 기준 근사치)`);
  lines.push(r.daewoon.list.map((d) => `${d.age}세~ ${d.ganji}(${d.stem.ko}${d.branch.ko})`).join(" / "));
  lines.push("");
  lines.push(`■ 현재 세운(${r.currentYear}년): ${r.currentYearPillar.ganji}(${r.currentYearPillar.stem.ko}${r.currentYearPillar.branch.ko}), 천간 십신 ${r.currentYearPillar.stemTenGod}`);
  return lines.join("\n");
}

async function callGeminiModel(model, body) {
  const res = await fetch(`${PROXY_BASE}/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`Gemini ${model} 응답 오류: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text) throw new Error("빈 응답을 받았습니다.");
  return text;
}

async function analyzeSaju(sajuResult) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: buildDataText(sajuResult) }] }],
    generationConfig: { temperature: 0.6 },
  };
  let lastErr;
  for (const model of MODEL_FALLBACKS) {
    try {
      return await callGeminiModel(model, body);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

window.GeminiSaju = { analyzeSaju, buildDataText };
