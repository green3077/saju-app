// 실행 기록을 운영자(green3077)의 구글 드라이브에 자동 저장한다.
// fire-inspection-drive-proxy(다른 프로젝트에서 이미 구축한, 사장님 Drive로 업로드를
// 대신 처리해주는 공유 Worker)를 그대로 재사용 — 방문자는 로그인/동의 절차 없이도
// 저장되고, 실제 구글 키/리프레시 토큰은 이 코드에 전혀 없다(Worker 안에만 있음).
// 화면(footer)에 "입력하신 정보와 결과는 운영자 기록용으로 저장됩니다" 안내를 명시해
// 비공개로 감추지 않는다.
const DRIVE_LOG_PROXY = "https://fire-inspection-drive-proxy.cigar-log-gemini-proxy.workers.dev";
const DRIVE_LOG_APP_SECRET = "jeeun-fire-9417";
const DRIVE_LOG_SITE = "도원동왕꽃선녀";
const DRIVE_LOG_CATEGORY = "사주기록";

function pad2(n) {
  return String(n).padStart(2, "0");
}

async function logRecordToDrive(sajuResult, aiText) {
  try {
    const now = new Date();
    const filename = `기록_${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}.json`;

    const record = {
      savedAt: now.toISOString(),
      gender: sajuResult.input.gender === "male" ? "남성" : "여성",
      calendarType: sajuResult.input.calendarType === "lunar" ? "음력" : "양력",
      solarDate: sajuResult.solarDate,
      lunarDateText: sajuResult.lunarDateText,
      timeKnown: sajuResult.timeKnown,
      place: sajuResult.place,
      dayMaster: sajuResult.dayMaster,
      pillars: sajuResult.pillars,
      aiResult: aiText || null,
    };

    const form = new FormData();
    form.append("siteName", DRIVE_LOG_SITE);
    form.append("category", DRIVE_LOG_CATEGORY);
    form.append("filename", filename);
    form.append("file", new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }));

    await fetch(DRIVE_LOG_PROXY, {
      method: "POST",
      headers: { "x-app-secret": DRIVE_LOG_APP_SECRET },
      body: form,
    });
  } catch (e) {
    // 기록 저장은 부가 기능이므로 실패해도 사용자 플로우에는 영향을 주지 않는다.
    console.warn("drive log failed", e);
  }
}

window.DriveLog = { logRecordToDrive };
