// 랜딩페이지 기획 인터뷰 — 신청서 응답 처리 스크립트
//
// 사용 방법:
// 1. 새 구글 스프레드시트를 하나 만듭니다 (예: "랜딩페이지 기획 인터뷰 응답").
// 2. 확장 프로그램 → Apps Script 로 들어갑니다 (이 시트에 직접 바인딩되는 스크립트라 권한 문제가 없습니다).
// 3. 기본 코드를 지우고 이 파일 내용 전체를 붙여넣습니다.
// 4. 배포 → 새 배포 → 유형: 웹 앱 → 액세스 권한: "전체" → 배포.
// 5. 배포 후 나온 웹 앱 URL을 landing-interview.html의 SCRIPT_URL에 붙여넣습니다.

const ADMIN_EMAIL = 'elanvital7@naver.com';

const HEADERS = [
  '타임스탬프', '이름', '이메일', '연락처',
  '상품/서비스', '타깃 고객', '고객의 고민', '구매 망설임 이유', '핵심 장점 3가지',
  '경쟁사 약점', '숫자/증거', '신뢰 요소', '실제 후기', '마감 이벤트', '효율화 앱 아이디어'
];

function doGet(e) {
  try {
    const p = e.parameter || {};

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    } else if (sheet.getLastColumn() < HEADERS.length) {
      // 나중에 질문이 추가되어 헤더보다 칸이 늘어난 경우, 빠진 헤더만 채워 넣습니다.
      const lastCol = sheet.getLastColumn();
      sheet.getRange(1, lastCol + 1, 1, HEADERS.length - lastCol).setValues([HEADERS.slice(lastCol)]);
    }

    const now = new Date();
    const timestamp = _formatKoreanTimestamp(now, Session.getScriptTimeZone());

    sheet.appendRow([
      timestamp,
      p.name || '',
      p.email || '',
      p.phone || '',
      p.product || '',
      p.target || '',
      p.worry || '',
      p.hesitation || '',
      p.advantages || '',
      p.competitor || '',
      p.numbers || '',
      p.trust || '',
      p.review || '',
      p.event || '',
      p.appIdea || ''
    ]);

    if (p.email) _sendConfirmEmail(p.name, p.email, p);
    _sendAdminNotice(p);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function _formatKoreanTimestamp(date, tz) {
  const hour24   = parseInt(Utilities.formatDate(date, tz, 'H'), 10);
  const ampm     = hour24 < 12 ? '오전' : '오후';
  const hour12   = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const datePart = Utilities.formatDate(date, tz, 'yyyy. M. d');
  const minSec   = Utilities.formatDate(date, tz, 'mm:ss');
  return `${datePart} ${ampm} ${hour12}:${minSec}`;
}

function _sendConfirmEmail(name, email, p) {
  const summary = _escapeHtml(_buildPlainTextSummary(p));

  const html = `
<div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1e293b;">
  <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:32px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">인터뷰 응답이 접수됐어요! 🎉</h1>
  </div>
  <div style="background:#f8fafc;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:16px;"><strong>${name || '수강생'}</strong>님, 답변 잘 받았습니다.</p>
    <p style="margin:0 0 20px;color:#475569;line-height:1.7;">
      답변하신 내용을 정리해서 아래에 준비했어요.
    </p>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;margin-bottom:18px;">
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.7;">
        <strong>사용 방법</strong> — 아래 박스를 한 번 클릭한 다음 Ctrl+A(전체 선택) → Ctrl+C(복사)를 누르면 박스 안 내용만 복사됩니다.
        그대로 웹페이지를 만들어주는 AI 프로그램이나 앱의 채팅창에 붙여넣기만 하면 돼요.
      </p>
    </div>

    <textarea readonly style="width:100%;height:340px;background:#0f172a;color:#e2e8f0;padding:14px 16px;border:none;border-radius:10px;font-size:13px;line-height:1.7;font-family:inherit;resize:vertical;margin:0 0 20px;">${summary}</textarea>

    <p style="margin:0;color:#475569;line-height:1.7;">
      궁금한 점이 있으면 언제든 회신 주세요.
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to: email,
    subject: '[SMAC EDU] 랜딩페이지 기획 인터뷰 응답이 접수됐습니다',
    htmlBody: html
  });
}

function _escapeHtml(str) {
  return (str || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 인터뷰 답변을 읽기 쉬운 텍스트로 정리하고, AI 페이지 빌더에 그대로 붙여넣을 수 있는 요청 문구를 덧붙입니다.
function _buildPlainTextSummary(p) {
  const v = x => (x && x.toString().trim()) || '(미입력)';

  return `[상품/서비스]
${v(p.product)}

[타깃 고객]
${v(p.target)}

[고객의 고민]
${v(p.worry)}

[구매 망설임]
${v(p.hesitation)}

[핵심 장점 3가지]
${v(p.advantages)}

[경쟁사 약점]
${v(p.competitor)}

[숫자/증거]
${v(p.numbers)}

[신뢰 요소]
${v(p.trust)}

[실제 후기]
${v(p.review)}

[마감 이벤트]
${v(p.event)}

[연결할 링크]
필요한 경우 기재

[푸터(이메일 주소나 연락처)]
필요한 경우 기재`;
}

function _sendAdminNotice(p) {
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();

  const rows = [
    ['상품/서비스', p.product], ['타깃 고객', p.target], ['고객의 고민', p.worry],
    ['구매 망설임', p.hesitation], ['핵심 장점', p.advantages], ['경쟁사 약점', p.competitor],
    ['숫자/증거', p.numbers], ['신뢰 요소', p.trust], ['실제 후기', p.review], ['마감 이벤트', p.event],
    ['효율화 앱 아이디어', p.appIdea]
  ].map(([k, v]) => `
    <tr>
      <td style="padding:6px 10px;font-size:13px;color:#64748b;width:120px;vertical-align:top;">${k}</td>
      <td style="padding:6px 10px;font-size:13px;">${(v || '').toString().replace(/\n/g, '<br>') || '<span style="color:#cbd5e1;">(미입력)</span>'}</td>
    </tr>`).join('');

  const html = `
<div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#1e3a5f;color:#fff;padding:18px 22px;margin:0;border-radius:8px 8px 0 0;">
    📝 랜딩페이지 인터뷰 신규 응답 — ${p.name || '이름없음'}
  </h2>
  <div style="background:#f8fafc;padding:22px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 12px;font-size:13px;color:#64748b;">이메일: ${p.email || '-'} · 연락처: ${p.phone || '-'}</p>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:6px;">
      ${rows}
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
      <a href="${sheetUrl}">스프레드시트에서 전체 응답 확인 →</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: `[SMAC EDU] 랜딩페이지 인터뷰 응답 — ${p.name || '이름없음'}`,
    htmlBody: html
  });
}
