const $ = (id) => document.getElementById(id);

// ---------- 진입 비밀번호 게이트 ----------
// 정적 사이트라 완전한 보안은 아니며(뷰소스로 우회 가능), 우연한 방문을 막는
// 정도의 가벼운 잠금이다. 평문 대신 SHA-256 해시만 코드에 둔다.
const GATE_HASH = "2926a2731f4b312c08982cacf8061eb14bf65c1a87cc5d70e864e079c6220731";
const GATE_STORAGE_KEY = "sajuGateUnlocked";

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unlockApp() {
  $("gateOverlay").classList.add("hidden");
  $("app").classList.remove("hidden");
}

function setupGate() {
  if (localStorage.getItem(GATE_STORAGE_KEY) === "1") {
    unlockApp();
    return;
  }
  $("gateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("gatePassword").value;
    const hash = await sha256Hex(input);
    if (hash === GATE_HASH) {
      localStorage.setItem(GATE_STORAGE_KEY, "1");
      $("gateError").classList.add("hidden");
      unlockApp();
    } else {
      $("gateError").classList.remove("hidden");
      $("gatePassword").value = "";
      $("gatePassword").focus();
    }
  });
}

// ---------- 초기 셀렉트 채우기 ----------
function fillPlaceSelect() {
  const sel = $("placeSelect");
  for (const p of PLACES) {
    const opt = document.createElement("option");
    opt.value = p.key;
    opt.textContent = p.name;
    sel.appendChild(opt);
  }
  const other = document.createElement("option");
  other.value = PLACE_OTHER_KEY;
  other.textContent = "기타 / 해외 (보정 없음)";
  sel.appendChild(other);
}

function fillLunarSelects() {
  const y = $("lunarYear"), m = $("lunarMonth"), d = $("lunarDay");
  const thisYear = new Date().getFullYear();
  for (let year = thisYear; year >= 1900; year--) {
    const o = document.createElement("option");
    o.value = year; o.textContent = year + "년";
    y.appendChild(o);
  }
  y.value = 1995;
  for (let mo = 1; mo <= 12; mo++) {
    const o = document.createElement("option");
    o.value = mo; o.textContent = mo + "월";
    m.appendChild(o);
  }
  for (let da = 1; da <= 30; da++) {
    const o = document.createElement("option");
    o.value = da; o.textContent = da + "일";
    d.appendChild(o);
  }
}

// ---------- segmented control ----------
function setupSegmented() {
  document.querySelectorAll(".segmented").forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".seg-btn");
      if (!btn) return;
      group.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      if (group.dataset.name === "calendarType") {
        const isLunar = btn.dataset.value === "lunar";
        $("solarDateGroup").classList.toggle("hidden", isLunar);
        $("lunarDateGroup").classList.toggle("hidden", !isLunar);
      }
    });
  });
}

function getSegmentedValue(name) {
  return document.querySelector(`.segmented[data-name="${name}"] .seg-btn.is-active`).dataset.value;
}

// ---------- 시간/장소 옵션 상호작용 ----------
function setupTimeAndPlace() {
  $("timeUnknown").addEventListener("change", (e) => {
    $("birthTime").disabled = e.target.checked;
    syncTstAvailability();
  });
  $("placeSelect").addEventListener("change", syncTstAvailability);
}

function syncTstAvailability() {
  const timeUnknown = $("timeUnknown").checked;
  const isOther = $("placeSelect").value === PLACE_OTHER_KEY;
  const tst = $("applyTst");
  tst.disabled = timeUnknown || isOther;
  if (tst.disabled) tst.checked = false;
  else if (!isOther) tst.checked = true;
}

// ---------- 입력값 -> Saju.calculate 인자 ----------
function collectInput() {
  const gender = getSegmentedValue("gender");
  const calendarType = getSegmentedValue("calendarType");
  const timeUnknown = $("timeUnknown").checked;
  let hour = 12, minute = 0;
  if (!timeUnknown) {
    const t = $("birthTime").value;
    if (!t) throw new Error("태어난 시각을 입력하거나 '시간을 모릅니다'를 선택해 주세요.");
    [hour, minute] = t.split(":").map(Number);
  }
  const placeVal = $("placeSelect").value;
  const placeKey = placeVal === PLACE_OTHER_KEY ? null : placeVal;

  let dateArgs;
  if (calendarType === "solar") {
    const v = $("solarDate").value;
    if (!v) throw new Error("생년월일을 입력해 주세요.");
    const [y, m, d] = v.split("-").map(Number);
    dateArgs = { year: y, month: m, day: d };
  } else {
    dateArgs = {
      year: Number($("lunarYear").value),
      month: Number($("lunarMonth").value),
      day: Number($("lunarDay").value),
      isLeapMonth: $("lunarLeap").checked,
    };
  }

  return {
    calendarType,
    ...dateArgs,
    timeUnknown,
    hour,
    minute,
    gender,
    placeKey,
    applyTrueSolarTime: $("applyTst").checked,
  };
}

// ---------- 결과 렌더링 ----------
const PILLAR_META = [
  { key: "year", label: "연주" },
  { key: "month", label: "월주" },
  { key: "day", label: "일주" },
  { key: "hour", label: "시주" },
];
const ELEMENT_ORDER = ["목", "화", "토", "금", "수"];
const ELEMENT_CLASS = { 목: "el-wood", 화: "el-fire", 토: "el-earth", 금: "el-metal", 수: "el-water" };

function renderSummary(r) {
  const g = r.input.gender === "male" ? "남성" : "여성";
  const dateStr = `${r.solarDate.year}년 ${r.solarDate.month}월 ${r.solarDate.day}일`;
  const timeStr = r.timeKnown ? `${String(r.solarDate.hour).padStart(2, "0")}:${String(r.solarDate.minute).padStart(2, "0")}` : "시간 미상";
  $("resultSummary").innerHTML = `
    <div><strong>${g}</strong> · 양력 ${dateStr} · ${timeStr}${r.place ? " · " + r.place : ""}</div>
    <div>음력 ${r.lunarDateText}</div>
    <div>일간(日干) <strong>${r.dayMaster.ko}(${r.dayMaster.hanja})</strong> · 현재 만 ${r.age}세</div>
    ${r.trueSolarTimeApplied ? `<div>진태양시 보정 ${r.correctionMinutes}분 적용됨</div>` : ""}
  `;
}

function pillarCardHtml(label, p) {
  if (!p) {
    return `<div class="pillar-card is-empty"><div class="pillar-label">${label}</div><div class="pillar-hanja">?</div><div class="pillar-ko">정보 없음</div></div>`;
  }
  return `
    <div class="pillar-card">
      <div class="pillar-label">${label}</div>
      <div class="pillar-hanja">
        <span class="stem">${p.stem.hanja}</span>
        <span class="branch">${p.branch.hanja}</span>
      </div>
      <div class="pillar-ko">
        <span class="el-chip ${ELEMENT_CLASS[p.stem.element]}"></span>${p.stem.ko}
        <span class="el-chip ${ELEMENT_CLASS[p.branch.element]}"></span>${p.branch.ko}
      </div>
      <div class="pillar-tengod">${p.stemTenGod}<br>${p.branchTenGods.join("·")}</div>
    </div>`;
}

function renderPillars(r) {
  $("pillarsGrid").innerHTML = PILLAR_META.map((m) => pillarCardHtml(m.label, r.pillars[m.key])).join("");
}

function renderElementBars(r) {
  const max = Math.max(1, ...Object.values(r.elementCounts));
  $("elementBars").innerHTML = ELEMENT_ORDER.map((el) => {
    const count = r.elementCounts[el];
    const pct = Math.round((count / max) * 100);
    return `
      <div class="element-bar-row">
        <div class="element-bar-name"><span class="el-chip ${ELEMENT_CLASS[el]}"></span>${el}</div>
        <div class="element-bar-track"><div class="element-bar-fill ${ELEMENT_CLASS[el]}" style="width:${pct}%"></div></div>
        <div class="element-bar-count">${count}</div>
      </div>`;
  }).join("");
}

function renderDaewoon(r) {
  const d = r.daewoon;
  const items = d.list.map((item, i) => {
    const nextAge = d.list[i + 1] ? d.list[i + 1].age : item.age + 10;
    const isCurrent = r.age >= item.age && r.age < nextAge;
    return `
      <div class="daewoon-item ${isCurrent ? "is-current" : ""}">
        <div class="daewoon-age">${item.age}세~</div>
        <div class="daewoon-hanja">${item.stem.hanja}${item.branch.hanja}</div>
        <div class="pillar-ko">${item.stem.ko}${item.branch.ko}</div>
      </div>`;
  }).join("");
  $("daewoonTrack").innerHTML = `<div class="daewoon-item"><div class="daewoon-age">${d.forward ? "순행" : "역행"}</div><div class="daewoon-hanja" style="font-size:13px">대운수<br>${d.startAge}</div></div>` + items;
}

function renderResult(r) {
  renderSummary(r);
  renderPillars(r);
  renderElementBars(r);
  renderDaewoon(r);
}

// ---------- 화면 전환 ----------
// ---------- 로딩 진행률(체감용 가짜 진행바) ----------
let progressTimer = null;
function updateProgress(pct) {
  const rounded = Math.round(pct);
  $("loadingPercent").textContent = rounded + "%";
  $("loadingBarFill").style.width = rounded + "%";
}
function startFakeProgress() {
  const start = Date.now();
  const CAP = 97; // 실제 응답이 올 때까지는 100%를 찍지 않고 이 근처까지만 서서히 다가감
  const TAU_MS = 40000; // 클수록 뒤로 갈수록 더 천천히 올라감 (분석이 1~2분 걸리는 것을 감안)
  updateProgress(1);
  progressTimer = setInterval(() => {
    const elapsed = Date.now() - start;
    const pct = 1 + (CAP - 1) * (1 - Math.exp(-elapsed / TAU_MS));
    updateProgress(pct);
  }, 200);
}
function finishFakeProgress() {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
  updateProgress(100);
}

function showScreen(name) {
  ["form", "loading", "result"].forEach((s) => $("screen-" + s).classList.toggle("hidden", s !== name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- 메인 플로우 ----------
async function handleSubmit(e) {
  e.preventDefault();
  $("formError").classList.add("hidden");
  let input;
  try {
    input = collectInput();
  } catch (err) {
    $("formError").textContent = err.message;
    $("formError").classList.remove("hidden");
    return;
  }

  showScreen("loading");
  startFakeProgress();
  $("loadingText").textContent = "만세력을 계산하는 중입니다…";

  let result;
  try {
    result = Saju.calculate(input);
  } catch (err) {
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    showScreen("form");
    const friendly = /leap month/i.test(err.message)
      ? `선택하신 ${input.year}년 ${input.month}월에는 윤달이 없습니다. '윤달입니다' 체크를 해제하거나 연/월을 다시 확인해 주세요.`
      : "사주 계산 중 오류가 발생했습니다: " + err.message;
    $("formError").textContent = friendly;
    $("formError").classList.remove("hidden");
    return;
  }

  renderResult(result);
  $("aiAnalysis").innerHTML = "";

  $("loadingText").textContent = "AI가 명리학적으로 해설하는 중입니다… (내용이 깊어 1~2분 정도 걸릴 수 있습니다)";
  let aiText = null;
  try {
    aiText = await GeminiSaju.analyzeSaju(result);
    $("aiAnalysis").innerHTML = renderMarkdown(aiText);
  } catch (err) {
    $("aiAnalysis").innerHTML = `<p style="color:var(--text-faint)">AI 해설을 불러오지 못했습니다 (${err.message}). 위의 사주 원국 데이터는 정상적으로 계산되었으니, 잠시 후 다시 시도해 주세요.</p>`;
  }
  DriveLog.logRecordToDrive(result, aiText);
  finishFakeProgress();
  showScreen("result");
}

function init() {
  setupGate();
  fillPlaceSelect();
  fillLunarSelects();
  $("placeSelect").value = "seoul";
  setupSegmented();
  setupTimeAndPlace();
  $("sajuForm").addEventListener("submit", handleSubmit);
  $("restartBtn").addEventListener("click", () => showScreen("form"));
  $("versionTag").textContent = "v" + APP_VERSION;
}

init();
