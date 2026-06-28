// 랜딩페이지 기획 인터뷰 + VIP 1:1 신청 + 특강 자료 신청 — 응답 처리 스크립트
//
// 같은 스프레드시트 안에서 세 가지 폼을 처리합니다.
// - 랜딩페이지 기획 인터뷰(landing-interview.html) → 첫 번째 탭(시트1)
// - VIP 1:1 신청(vip-1on1-landing.html, type=vip 파라미터) → "VIP신청" 탭 (없으면 자동 생성)
// - 특강 자료 신청(materials-request.html, type=material 파라미터) → "자료신청" 탭 (없으면 자동 생성)
//
// 사용 방법:
// 1. 새 구글 스프레드시트를 하나 만듭니다 (예: "랜딩페이지 기획 인터뷰 응답").
// 2. 확장 프로그램 → Apps Script 로 들어갑니다 (이 시트에 직접 바인딩되는 스크립트라 권한 문제가 없습니다).
// 3. 기본 코드를 지우고 이 파일 내용 전체를 붙여넣습니다.
// 4. 배포 → 새 배포 → 유형: 웹 앱 → 액세스 권한: "전체" → 배포.
// 5. 배포 후 나온 웹 앱 URL을 landing-interview.html, vip-1on1-landing.html, materials-request.html의 SCRIPT_URL에 붙여넣습니다.

const ADMIN_EMAIL = 'elanvital7@naver.com';

const HEADERS = [
  '타임스탬프', '이름', '이메일', '연락처',
  '상품/서비스', '타깃 고객', '고객의 고민', '구매 망설임 이유', '핵심 장점 3가지',
  '경쟁사 약점', '숫자/증거', '신뢰 요소', '실제 후기', '마감 이벤트', '효율화 앱 아이디어'
];

const VIP_SHEET_NAME = 'VIP신청';
const VIP_HEADERS = ['타임스탬프', '이름', '이메일', '연락처'];

const MATERIAL_SHEET_NAME = '자료신청';
const MATERIAL_HEADERS = ['타임스탬프', '이름', '이메일', '연락처', '신청유형'];
const MATERIAL_DRIVE_LINK = 'https://drive.google.com/file/d/1eyQJL9qXZDdlukf1zISDTWC1pEYqo5jn/view?usp=sharing';
const MATERIAL_DOC_LINK = 'https://docs.google.com/document/d/15XxOk0NGt0cilQh1yNGvZFEYVUQ-kDN8CmC5X1beTsE/edit?usp=sharing';

function doGet(e) {
  try {
    const p = e.parameter || {};
    if (p.type === 'vip') return _handleVipSubmission(p);
    if (p.type === 'material') return _handleMaterialSubmission(p);

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

function _handleVipSubmission(p) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(VIP_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(VIP_SHEET_NAME);
      sheet.appendRow(VIP_HEADERS);
      sheet.getRange(1, 1, 1, VIP_HEADERS.length).setFontWeight('bold');
    }

    const timestamp = _formatKoreanTimestamp(new Date(), Session.getScriptTimeZone());
    sheet.appendRow([timestamp, p.name || '', p.email || '', p.phone || '']);

    if (p.email) _sendVipConfirmEmail(p.name, p.email);
    _sendVipAdminNotice(p);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function _handleMaterialSubmission(p) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(MATERIAL_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(MATERIAL_SHEET_NAME);
      sheet.appendRow(MATERIAL_HEADERS);
      sheet.getRange(1, 1, 1, MATERIAL_HEADERS.length).setFontWeight('bold');
    }

    const tierLabel = p.tier === 'paid' ? '녹화본+수강생 전용 자료 (유료)' : '자료만 (무료)';
    const timestamp = _formatKoreanTimestamp(new Date(), Session.getScriptTimeZone());
    sheet.appendRow([timestamp, p.name || '', p.email || '', p.phone || '', tierLabel]);

    if (p.email) _sendMaterialConfirmEmail(p.name, p.email, p.tier);
    _sendMaterialAdminNotice(p, tierLabel);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function _sendMaterialConfirmEmail(name, email, tier) {
  const isPaid = tier === 'paid';

  const bodyHtml = isPaid
    ? `
    <p style="margin:0 0 16px;color:#475569;line-height:1.8;">
      <strong>녹화본 + 수강생 전용 자료</strong> 신청이 접수됐습니다.
    </p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:18px 20px;margin-bottom:18px;">
      <p style="margin:0;font-size:14px;color:#92400e;line-height:1.9;">
        <strong>입금 계좌</strong> 신한은행 110-050-892636 박성욱<br>
        <strong>입금 금액</strong> 30,000원
      </p>
    </div>
    <p style="margin:0;color:#475569;line-height:1.8;">
      입금 확인 후 담당자가 이 이메일로 녹화본과 수강생 전용 자료를 보내드립니다.
    </p>`
    : `
    <p style="margin:0 0 16px;color:#475569;line-height:1.8;">
      신청하신 특강 자료를 바로 보내드립니다. 아래 링크에서 확인해 주세요.
    </p>
    <p style="margin:0 0 8px;">
      <a href="${MATERIAL_DRIVE_LINK}" style="color:#ef4444;font-weight:700;">📁 강의 자료 다운로드 →</a>
    </p>
    <p style="margin:0;">
      <a href="${MATERIAL_DOC_LINK}" style="color:#ef4444;font-weight:700;">📄 강의 자료 문서 보기 →</a>
    </p>`;

  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:32px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">자료 신청이 접수됐어요! 🎉</h1>
    <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px;">클로드 AI에서 클로드 코드까지</p>
  </div>
  <div style="background:#f8fafc;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:16px;"><strong>${name || '신청자'}</strong>님, 신청 잘 받았습니다.</p>
    ${bodyHtml}
    <p style="margin:20px 0 0;color:#475569;line-height:1.8;">
      궁금한 점이 있으면 언제든 회신 주세요.
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to: email,
    subject: isPaid
      ? '[SMAC EDU] 녹화본+전용자료 신청이 접수됐습니다 — 입금 확인 후 발송'
      : '[SMAC EDU] 특강 자료를 보내드립니다',
    htmlBody: html
  });
}

function _sendMaterialAdminNotice(p, tierLabel) {
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();

  const html = `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#1e3a5f;color:#fff;padding:18px 22px;margin:0;border-radius:8px 8px 0 0;">
    📚 특강 자료 신청 — ${p.name || '이름없음'}
  </h2>
  <div style="background:#f8fafc;padding:22px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0;font-size:14px;color:#334155;line-height:1.9;">
      <strong>신청 유형</strong> ${tierLabel}<br>
      <strong>이름</strong> ${p.name || '-'}<br>
      <strong>이메일</strong> ${p.email || '-'}<br>
      <strong>연락처</strong> ${p.phone || '-'}
    </p>
    ${p.tier === 'paid' ? '<p style="margin:14px 0 0;font-size:13px;color:#dc2626;font-weight:700;">⚠️ 입금 확인 후 직접 자료를 보내주세요.</p>' : ''}
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
      <a href="${sheetUrl}">스프레드시트에서 확인 →</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: `[SMAC EDU] 특강 자료 신청 — ${p.name || '이름없음'} (${tierLabel})`,
    htmlBody: html
  });
}

function _sendVipConfirmEmail(name, email) {
  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <div style="background:#c9a84c;padding:32px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:#000;margin:0;font-size:22px;font-weight:900;">VIP 신청이 접수됐어요 ✦</h1>
  </div>
  <div style="background:#f8fafc;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:16px;"><strong>${name || '신청자'}</strong>님, 신청 잘 받았습니다.</p>
    <p style="margin:0;color:#475569;line-height:1.7;">
      입금 계좌: 신한은행 110-050-892636 박성욱<br>
      입금 확인 후 24시간 이내로 일정 조율 연락을 드릴게요.<br>
      궁금한 점이 있으면 언제든 회신 주세요.
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to: email,
    subject: '[SMAC EDU] VIP 1:1 지도 신청이 접수됐습니다',
    htmlBody: html
  });
}

function _sendVipAdminNotice(p) {
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();

  const html = `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#1e3a5f;color:#fff;padding:18px 22px;margin:0;border-radius:8px 8px 0 0;">
    ✦ VIP 1:1 지도 신규 신청 — ${p.name || '이름없음'}
  </h2>
  <div style="background:#f8fafc;padding:22px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0;font-size:14px;color:#334155;line-height:1.9;">
      <strong>이름</strong> ${p.name || '-'}<br>
      <strong>이메일</strong> ${p.email || '-'}<br>
      <strong>연락처</strong> ${p.phone || '-'}
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
      <a href="${sheetUrl}">스프레드시트에서 확인 →</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: `[SMAC EDU] VIP 1:1 지도 신청 — ${p.name || '이름없음'}`,
    htmlBody: html
  });
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
