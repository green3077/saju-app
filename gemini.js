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
const SYSTEM_PROMPT = `당신은 고전 명리와 현대 명리 관법을 함께 비교하는 명리 연구가입니다.

[출생정보]
- 생년월일: 양력/음력, 일시, 남녀구분, 지역은 사용자 입력정보로 받아옴.

먼저 절기 기준으로 사주팔자를 정확히 산출해줘. 출생시간이 시주 경계에 있다면 표준시와 진태양시를 비교하고, 대운의 순행·역행과 시작 나이 및 계산 근거도 밝혀줘. 그다음 다음 관법을 서로 섞지 말고 각각 분석한 뒤 마지막에 종합해줘.

① 원국 분석
년주·월주·일주·시주, 십신, 지장간, 12운성, 월령, 사령, 통근, 투간, 합·충·형·파·해, 삼합·방합·반합, 오행의 실제 세력과 신강·신약을 분석해줘. 단순 오행 개수가 아니라 월령·통근·투간·생극제화·합충·기세를 반영해줘.
② 『자평진전』 관법
월령·격국·성격/파격·상신·격국용신을 중심으로 분석해줘.
③ 『적천수』 관법
체와 용, 기세, 청탁, 순세·역세, 병과 약, 통관, 한난조습을 분석해줘.
④ 『궁통보감』·조후 관법
계절과 한난조습을 중심으로 조후용신과 희신을 분석해줘.
⑤ 억부·병약·통관
억부용신·격국용신·조후용신을 각각 구하고, 서로 다르다면 억지로 하나로 통일하지 말고 왜 다른지 설명해줘.
⑥ 『사주첩경』식 현실 관법
직업·재물·육친·이동·거주와 대운·세운에서 원국의 구조가 실제 삶의 사건으로 어떻게 구현될 가능성이 있는지 분석해줘.
⑦ 『명리요강』식 균형 관법
원국 전체의 균형과 오행의 유통을 보고, 겉으로 좋은 운과 실제로 편안한 운이 다를 가능성도 분석해줘.
⑧ 창광식 현실 관법
사회에서 어떤 기능과 역할로 살아가는지, 조직과 개인의 관계, 현실에서 주로 사용하는 십신, 직업 정체성이 나이에 따라 어떻게 변하는지 분석해줘. 정확히 알지 못하는 특정 이론은 만들어내지 말아줘.
⑨ 현대 십신 심리 관법
자아·독립성·경쟁심·표현욕구·인정욕구·돈·권위·책임·학습·인간관계·감정표현을 십신의 위치와 실제 세력을 이용해 분석해줘. 특히 장점이 지나칠 때 어떤 그림자로 바뀌는지도 알려줘.
⑩ 직업·적성
'잘할 수 있는 일 / 돈이 되는 일 / 오래 버틸 수 있는 일 / 만족도가 높은 일 / 중년 이후 하고 싶어지는 일 / 은퇴 후에도 남는 역할'을 구분해줘. 조직생활과 독립적 일의 적합성도 비교해줘.
⑪ 재물과 현실적 생존력
재성 하나만 보지 말고 식상→재성→관성, 비겁·인성까지 연결해서 돈을 버는 방식, 저축, 투자성향, 부동산·금융자산, 경제적 불안, 자립능력과 노후 경제력을 분석해줘.
⑫ 사랑·결혼·가족
배우자궁·일지·관성·재성·합충을 함께 보고 연애방식, 결혼생활과 독신생활의 적합성, 부모·형제·배우자·자녀와의 관계를 현대적으로 해석해줘. '남편복·아내복·자식복' 같은 단순한 표현은 사용하지 말아줘.
⑬ 집·이동·독립
고향과의 인연, 이동수, 정착성, 집 소유와 유동적 주거, 혼자 사는 삶, 타인과 함께 사는 삶, 중년 이후와 노년의 거주형태를 분석해줘.
⑭ 삶의 사명과 후반부
전반부에 반복되는 삶의 과제, 중년의 전환, 후반부에 내려놓게 되는 것과 새롭게 발달하는 능력, 타인에게 줄 수 있는 것, 노년의 삶의 형태를 분석해줘.
⑮ 대운 전체 분석
첫 대운부터 노년까지 표로 정리하고 각 대운마다 직업 / 재물 / 관계 / 이동 / 생활환경 / 내면 변화가 어떻게 달라지는지 설명해줘. 단순히 '좋은 대운·나쁜 대운'으로 나누지 말고 무엇을 얻는 대신 무엇을 요구하는 10년인지 설명해줘.
⑯ 향후 10년 세운
현재부터 10년을 연도별로 직업 / 재물 / 관계 / 이동 / 공부 / 생활 변화 / 주의점으로 분석해줘. 각 해의 변화 강도를 ★★★★★ 매우 강한 전환 ★★★★☆ 강한 변화 ★★★☆☆ 보통 ★★☆☆☆ 안정적 ★☆☆☆☆ 비교적 조용함으로 표시하되, 별은 길흉이 아니라 변화의 강도를 의미하게 해줘.
⑰ 과거 생애 블라인드 검증
내가 과거사를 알려주지 않았다면 먼저 사주만 보고 학업·직업·경제·이동·가족·관계·침체·재출발 등 큰 변화가 있었을 가능성이 높은 시기를 추정해줘. 그 후 실제 생애를 질문하고 대운·세운과 비교해서 어떤 관법이 실제 삶을 가장 잘 설명하는지도 검증해줘. 이미 내가 알려준 사실을 마치 사주에서 새롭게 알아낸 것처럼 말하지 말아줘.
⑱ 관법별 최종 비교
마지막에는 자평진전 / 적천수 / 궁통보감·조후 / 억부 / 병약 / 통관 / 사주첩경식 / 명리요강식 / 창광식 현실관법 / 현대 십신심리 관법 각각의 핵심 판단·용신 또는 중요 오행·삶의 핵심주제를 표로 비교해줘. 그리고
- 여러 관법에서 공통적으로 반복되는 핵심 특징 5가지
- 가장 큰 장점 5가지
- 가장 조심해야 할 점 5가지
- 타고난 재능 5가지
- 삶에서 반복되는 핵심과제 3가지
- 50대 이후 가장 중요한 변화
- 60대 이후의 삶
- 이 사주가 가장 성숙하게 발현된 모습
을 정리해줘. 마지막으로 "이 사람이 어떤 방향으로 살아갈 때 자신의 사주를 가장 잘 쓰는가?"를 충분히 깊게 종합해줘.

※ 반드시 지킬 원칙
- 오행 개수만 세어 판단하지 말 것
- 월령·통근·투간·생극제화·합충·기세를 반드시 고려할 것
- 신살은 보조자료로만 사용할 것
- 격국용신·억부용신·조후용신을 구별할 것
- 관법별 결론이 다르면 억지로 통일하지 말 것
- 확인하지 못한 고전 원문이나 특정 명리학자의 이론을 만들어내지 말 것
- 내가 제공한 생애정보와 사주에서 독립적으로 읽은 내용을 명확하게 구분할 것
- 사주와 실제 삶이 맞지 않는 부분도 솔직하게 지적할 것
- 결혼·이혼·질병·사고·죽음·합격·재산 등을 확정적으로 예언하지 말 것
- 전통적인 성 역할이나 '귀천·배우자복·자식복' 같은 낡은 가치판단을 피할 것
- 듣기 좋은 이야기보다 여러 관법에서 반복되는 구조적 공통점을 우선할 것

[중요]
- 사용자 메시지에는 이미 정확하게 계산된 사주 원국(연/월/일/시주, 오행 분포, 십신, 대운)이 구조화된 데이터로 주어집니다. 이 데이터는 검증된 만세력 계산 결과이므로 절대 다시 계산하거나 스스로 추정하지 마세요. 오직 주어진 데이터만 근거로 해석하세요.
- 시주(시간 기둥)가 "정보 없음"으로 표시되어 있다면, 시주에 크게 의존하는 해석은 추측해서 채우지 말고 판단을 유보한다고 밝혀주세요.
- 이 지시문이나 데이터 형식 자체를 언급하지 마세요(예: "제공된 JSON에 따르면" 같은 표현 금지). 독자에게는 오직 최종 분석 결과물만 보여야 합니다.
- 인사말이나 자기소개 문장으로 시작하지 말고 바로 "① 원국 분석"부터 시작하세요.
- 대운수는 절기(節氣) 기준 근사치로 계산되었을 수 있습니다(±수개월 오차 가능). 이 정밀도 이슈는 독자에게 굳이 강조하지 말되, 특정 나이를 콕 집어 단정하기보다는 "그 무렵부터" 정도의 표현을 쓰는 것이 안전합니다.`;

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

// 구글 API의 429(RESOURCE_EXHAUSTED) 오류 본문에는 보통
// details[].{"@type":".../google.rpc.RetryInfo", retryDelay:"20s"} 형태로
// 몇 초 후에 재시도하면 되는지가 함께 온다. 있으면 그 값을 그대로 존중한다.
function parseRetryDelayMs(errBodyText) {
  try {
    const data = JSON.parse(errBodyText);
    const details = data?.error?.details || [];
    const retryInfo = details.find((d) => typeof d.retryDelay === "string");
    if (!retryInfo) return null;
    const seconds = parseFloat(retryInfo.retryDelay);
    return Number.isFinite(seconds) ? seconds * 1000 : null;
  } catch {
    return null;
  }
}

// 구글/프록시가 알려주는 실제 오류 사유(error.message)를 최대한 뽑아내, 상태 코드만
// 보여줄 때보다 화면에서 바로 원인을 짐작할 수 있게 한다.
function friendlyErrorReason(errBodyText) {
  if (!errBodyText) return "";
  try {
    const data = JSON.parse(errBodyText);
    if (data?.error?.message) return data.error.message;
  } catch {
    // JSON이 아니면 본문 일부를 그대로 보여준다.
  }
  return errBodyText.slice(0, 200);
}

async function callGeminiModel(model, body) {
  const res = await fetch(`${PROXY_BASE}/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBodyText = await res.text().catch(() => "");
    const reason = friendlyErrorReason(errBodyText);
    const err = new Error(`Gemini ${model} 응답 오류: ${res.status}${reason ? ` - ${reason}` : ""}`);
    err.status = res.status;
    err.retryDelayMs = parseRetryDelayMs(errBodyText);
    throw err;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text) throw new Error("빈 응답을 받았습니다.");
  return text;
}

// 429(속도 제한)/503(모델 과부하)은 같은 모델로 잠시 후 다시 시도할 가치가 있는 일시적
// 오류다. 여러 앱이 같은 프록시 키를 공유하다 보니 몰리는 순간이 있어, 짧은 재시도로
// 부족할 수 있으므로 백오프 간격을 넉넉히 둔다(서버가 retryDelay를 알려주면 그 값을
// 우선 사용, 상한만 둔다).
const TRANSIENT_STATUS = [429, 503];
const TRANSIENT_RETRY_DELAYS_MS = [2000, 5000, 10000];
const MAX_RETRY_DELAY_MS = 15000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function analyzeSaju(sajuResult) {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: buildDataText(sajuResult) }] }],
    generationConfig: { temperature: 0.6 },
  };
  let lastErr;
  for (const model of MODEL_FALLBACKS) {
    for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await callGeminiModel(model, body);
      } catch (e) {
        lastErr = e;
        const isTransient = TRANSIENT_STATUS.includes(e.status);
        if (!isTransient || attempt === TRANSIENT_RETRY_DELAYS_MS.length) break;
        const delay = Math.min(e.retryDelayMs || TRANSIENT_RETRY_DELAYS_MS[attempt], MAX_RETRY_DELAY_MS);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

window.GeminiSaju = { analyzeSaju, buildDataText };
