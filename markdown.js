// 아주 작은 마크다운(##, ###, **bold**, - 목록, 문단) → HTML 변환기.
// Gemini 응답이 정해진 소제목(##) 구조로 오도록 프롬프트에서 지시했으므로
// 외부 라이브러리 없이 이 정도만으로 충분하다.
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMd(s) {
  s = escapeHtml(s);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return s;
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let listOpen = false;
  const closeList = () => { if (listOpen) { html += "</ul>"; listOpen = false; } };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    let m;
    if (/^-{3,}$/.test(line)) { closeList(); html += `<hr>`; continue; }
    if ((m = line.match(/^###\s+(.*)$/))) { closeList(); html += `<h4>${inlineMd(m[1])}</h4>`; continue; }
    if ((m = line.match(/^##\s+(.*)$/))) { closeList(); html += `<h3>${inlineMd(m[1])}</h3>`; continue; }
    if ((m = line.match(/^#\s+(.*)$/))) { closeList(); html += `<h3>${inlineMd(m[1])}</h3>`; continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/))) {
      if (!listOpen) { html += "<ul>"; listOpen = true; }
      html += `<li>${inlineMd(m[1])}</li>`;
      continue;
    }
    closeList();
    html += `<p>${inlineMd(line)}</p>`;
  }
  closeList();
  return html;
}

window.renderMarkdown = renderMarkdown;
