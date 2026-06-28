// 랜딩페이지 기획 인터뷰 + VIP 1:1 신청 + 특강 자료 신청 — 응답 처리 스크립트
//
// 같은 스프레드시트 안에서 세 가지 폼을 처리합니다.
// - 랜딩페이지 기획 인터뷰(landing-interview.html) → 첫 번째 탭(시트1)
// - VIP 1:1 신청(vip-1on1-landing.html, type=vip 파라미터) → "VIP신청" 탭 (없으면 자동 생성)
// - 특강 자료 신청(materials-request.html, type=material 파라미터) → "자료신청" 탭 (없으면 자동 생성)
//
// 관리자(ADMIN_EMAIL) 알림은 신청마다 보내지 않고, _notifyAdmin()이 폼 종류별로
// ADMIN_DIGEST_BATCH_SIZE(20)건씩 쌓일 때마다 모아서 한 번에 보냅니다.
// 새 신청서 폼을 추가할 때도 이 _notifyAdmin()을 그대로 재사용하세요 (개별 알림 함수를 새로 만들지 마세요).
//
// 사용 방법:
// 1. 새 구글 스프레드시트를 하나 만듭니다 (예: "랜딩페이지 기획 인터뷰 응답").
// 2. 확장 프로그램 → Apps Script 로 들어갑니다 (이 시트에 직접 바인딩되는 스크립트라 권한 문제가 없습니다).
// 3. 기본 코드를 지우고 이 파일 내용 전체를 붙여넣습니다.
// 4. 배포 → 새 배포 → 유형: 웹 앱 → 액세스 권한: "전체" → 배포.
// 5. 배포 후 나온 웹 앱 URL을 landing-interview.html, vip-1on1-landing.html, materials-request.html의 SCRIPT_URL에 붙여넣습니다.

const ADMIN_EMAIL = 'elanvital7@naver.com';
const ADMIN_DIGEST_BATCH_SIZE = 20; // 관리자 알림은 매번 보내지 않고, 이 건수만큼 쌓일 때마다 한 번에 모아 보냅니다.

const HEADERS = [
  '타임스탬프', '이름', '이메일', '연락처',
  '상품/서비스', '타깃 고객', '고객의 고민', '구매 망설임 이유', '핵심 장점 3가지',
  '경쟁사 약점', '숫자/증거', '신뢰 요소', '실제 후기', '마감 이벤트', '효율화 앱 아이디어'
];

const VIP_SHEET_NAME = 'VIP신청';
const VIP_HEADERS = ['타임스탬프', '이름', '이메일', '연락처', '신청유형'];
const VIP_TIER_LABELS = {
  full:  { label: 'VIP 풀코스 (8시간·50만원)', amount: '50만원' },
  light: { label: '90분 라이트 (15만원)', amount: '15만원' }
};

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
    _notifyAdmin(sheet, '랜딩페이지 기획 인터뷰');

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
    } else if (sheet.getLastColumn() < VIP_HEADERS.length) {
      // 나중에 "라이트" 옵션이 추가되어 헤더보다 칸이 늘어난 경우, 빠진 헤더만 채워 넣습니다.
      const lastCol = sheet.getLastColumn();
      sheet.getRange(1, lastCol + 1, 1, VIP_HEADERS.length - lastCol).setValues([VIP_HEADERS.slice(lastCol)]);
    }

    const tierInfo = VIP_TIER_LABELS[p.tier] || VIP_TIER_LABELS.full;
    const timestamp = _formatKoreanTimestamp(new Date(), Session.getScriptTimeZone());
    sheet.appendRow([timestamp, p.name || '', p.email || '', p.phone || '', tierInfo.label]);

    if (p.email) _sendVipConfirmEmail(p.name, p.email, tierInfo);
    _notifyAdmin(sheet, 'VIP 1:1 지도 신청');

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
    _notifyAdmin(sheet, '특강 자료 신청');

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

function _sendVipConfirmEmail(name, email, tierInfo) {
  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <div style="background:#c9a84c;padding:32px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:#000;margin:0;font-size:22px;font-weight:900;">신청이 접수됐어요 ✦</h1>
    <p style="color:rgba(0,0,0,.65);margin:8px 0 0;font-size:14px;">${tierInfo.label}</p>
  </div>
  <div style="background:#f8fafc;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:16px;"><strong>${name || '신청자'}</strong>님, 신청 잘 받았습니다.</p>
    <p style="margin:0;color:#475569;line-height:1.7;">
      입금 계좌: 신한은행 110-050-892636 박성욱<br>
      입금 금액: <strong>${tierInfo.amount}</strong><br>
      입금 확인 후 일정 조율 연락을 드릴게요.<br>
      궁금한 점이 있으면 언제든 회신 주세요.
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to: email,
    subject: `[SMAC EDU] 1:1 신청이 접수됐습니다 — ${tierInfo.label}`,
    htmlBody: html
  });
}

// 신청이 쌓일 때마다 매번 메일을 보내면 너무 많아지므로, ADMIN_DIGEST_BATCH_SIZE건마다
// 한 번씩 최근 건들을 모아서 관리자에게 보냅니다. 모든 신청서 폼(인터뷰/VIP/자료신청 등)이
// 이 함수를 공유합니다 — 새 폼을 추가할 때도 이 함수를 그대로 재사용하세요.
function _notifyAdmin(sheet, formLabel) {
  const total = sheet.getLastRow() - 1; // 헤더 행 제외
  if (total <= 0 || total % ADMIN_DIGEST_BATCH_SIZE !== 0) return;

  const lastCol     = sheet.getLastColumn();
  const headerNames = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const batchSize   = Math.min(ADMIN_DIGEST_BATCH_SIZE, total);
  const startRow    = sheet.getLastRow() - batchSize + 1;
  const rows        = sheet.getRange(startRow, 1, batchSize, lastCol).getValues();
  const sheetUrl     = `${SpreadsheetApp.getActiveSpreadsheet().getUrl()}#gid=${sheet.getSheetId()}`;

  const headerHtml = headerNames.map(h =>
    `<th style="padding:8px 10px;text-align:left;font-size:12px;color:#64748b;white-space:nowrap;">${h}</th>`
  ).join('');

  const rowsHtml = rows.map(row => `
    <tr>
      ${row.map(cell => `<td style="padding:6px 10px;font-size:13px;border-top:1px solid #e2e8f0;">${
        (cell || '').toString().replace(/\n/g, '<br>') || '<span style="color:#cbd5e1;">-</span>'
      }</td>`).join('')}
    </tr>`).join('');

  const html = `
<div style="font-family:sans-serif;max-width:720px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#1e3a5f;color:#fff;padding:18px 22px;margin:0;border-radius:8px 8px 0 0;">
    📥 ${formLabel} — 누적 ${total}건 (최근 ${batchSize}건 알림)
  </h2>
  <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:6px;">
      <tr style="background:#f1f5f9;">${headerHtml}</tr>
      ${rowsHtml}
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
      <a href="${sheetUrl}">스프레드시트에서 전체 확인 →</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: `[SMAC EDU] ${formLabel} — 누적 ${total}건 (최근 ${batchSize}건)`,
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
