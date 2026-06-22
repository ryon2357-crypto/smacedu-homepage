// 스마트폰 사진특강 랜딩페이지 전용 신청 처리 스크립트
//
// 사용 방법:
// 1. 이 스프레드시트를 엽니다:
//    https://docs.google.com/spreadsheets/d/1mWvHb6H6YhtAe-j2y_PDGwfcK4jY8mpHyCO0OJHBA-0/edit
// 2. 확장 프로그램 → Apps Script 로 들어갑니다 (이 시트에 직접 바인딩되는 스크립트라 권한 문제가 없습니다).
// 3. 기본 코드를 지우고 이 파일 내용 전체를 붙여넣습니다.
// 4. 배포 → 새 배포 → 유형: 웹 앱 → 액세스 권한: "전체" → 배포.
// 5. 배포 후 나온 웹 앱 URL을 photo-lecture-landing.html의 SCRIPT_URL에 붙여넣습니다.

const ADMIN_EMAIL = 'elanvital7@naver.com';
const SHEET_GID   = 12733408; // 신청서 응답 시트(설문지 응답 시트1)의 tab gid

function doGet(e) {
  try {
    const params  = e.parameter || {};
    const name    = params.name  || '';
    const email   = params.email || '';
    const phone   = params.phone || '';
    const consent = params.consent === 'Y' ? '동의함' : '';

    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheets().find(s => s.getSheetId() === SHEET_GID) || ss.getSheets()[0];

    const now       = new Date();
    const timestamp = _formatKoreanTimestamp(now, Session.getScriptTimeZone());

    // 열 순서: 타임스탬프, 점수, 이름, 신청 경로, 전화번호, 이메일, 배우고 싶은 것, 기대하는 것, 녹화본 구입, 개인정보 동의, 저작권 동의
    // 랜딩페이지에서 직접 입력받지 않는 항목(점수·배우고 싶은 것 등)은 비워 둡니다.
    // 개인정보 동의는 랜딩페이지의 실제 체크박스 응답을 그대로 반영합니다.
    sheet.appendRow([timestamp, '', name, '랜딩페이지', phone, email, '', '', '', consent, '']);
    const total = sheet.getLastRow() - 1;

    if (email) _sendConfirmEmail(name, email);
    if (total % 10 === 0) _sendAdminDigest(sheet, total);

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

function _sendConfirmEmail(name, email) {
  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:32px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:24px;font-weight:900;">신청이 완료됐습니다! 📸</h1>
    <p style="color:rgba(255,255,255,0.85);margin:10px 0 0;font-size:15px;">찍는 순간 작품이 되는 스마트폰 사진 — 촬영과 보정부터 AI 활용까지</p>
  </div>
  <div style="background:#f8fafc;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:16px;"><strong>${name}</strong>님, 반갑습니다!</p>
    <p style="margin:0 0 20px;color:#475569;line-height:1.7;">
      특강 신청이 정상적으로 접수됐어요.<br>
      참여 ZOOM 링크는 특강 당일인 7월 1일(수) 저녁 6시까지 이 메일로 다시 안내드리겠습니다.
    </p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px;margin-bottom:20px;text-align:center;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626;">🗓 7월 1일(수) 저녁 9시 — 잊지 마세요!</p>
    </div>

    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:7px 0;color:#64748b;width:90px;">강의명</td>
          <td style="color:#1e293b;font-weight:600;">찍는 순간 작품이 되는 스마트폰 사진</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#64748b;">일시</td>
          <td style="color:#1e293b;font-weight:600;">2026년 7월 1일(수) 저녁 9시</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#64748b;">진행 방식</td>
          <td style="color:#1e293b;">ZOOM 온라인 (전국 어디서든 참여 가능)</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#64748b;">강사</td>
          <td style="color:#1e293b;">엘란비탈 박성욱 작가 — 스마트미디어아트센터 대표</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:20px;">
      <a href="https://www.smacedu.kr/photo-lecture-landing.html" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 32px;border-radius:999px;">특강 페이지 다시 보기</a>
    </div>

    <p style="margin:0;font-size:13px;color:#94a3b8;">
      문의는 <a href="mailto:${ADMIN_EMAIL}" style="color:#f59e0b;">${ADMIN_EMAIL}</a>로 보내주세요.
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to:       email,
    subject:  '[SMAC EDU] 스마트폰 사진특강 신청 완료 — ZOOM 링크는 특강 당일 안내드립니다',
    htmlBody: html
  });
}

// 신청 10명마다 한 번씩, 최근 10명을 모아서 알려줍니다 (매번 메일이 오면 너무 정신없어서 배치 처리).
function _sendAdminDigest(sheet, total) {
  const sheetUrl   = `https://docs.google.com/spreadsheets/d/${SpreadsheetApp.getActiveSpreadsheet().getId()}/edit#gid=${SHEET_GID}`;
  const lastRow    = sheet.getLastRow();
  const batchSize  = Math.min(10, lastRow - 1);
  const startRow   = lastRow - batchSize + 1;
  // 열 순서: 타임스탬프(1), 점수(2), 이름(3), 신청 경로(4), 전화번호(5), 이메일(6), ...
  const rows = sheet.getRange(startRow, 1, batchSize, 6).getValues();

  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:6px 10px;font-size:13px;color:#64748b;">${r[0]}</td>
      <td style="padding:6px 10px;font-size:13px;"><strong>${r[2]}</strong></td>
      <td style="padding:6px 10px;font-size:13px;">${r[5]}</td>
      <td style="padding:6px 10px;font-size:13px;">${r[4] || '미입력'}</td>
    </tr>`).join('');

  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#1e3a5f;color:#fff;padding:18px 22px;margin:0;border-radius:8px 8px 0 0;">
    📸 사진특강 신청 알림 (누적 ${total}명 — 최근 ${batchSize}명)
  </h2>
  <div style="background:#f8fafc;padding:22px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:6px;">
      <tr style="background:#f1f5f9;font-size:12px;color:#64748b;">
        <th style="padding:8px 10px;text-align:left;">신청일시</th>
        <th style="padding:8px 10px;text-align:left;">이름</th>
        <th style="padding:8px 10px;text-align:left;">이메일</th>
        <th style="padding:8px 10px;text-align:left;">연락처</th>
      </tr>
      ${rowsHtml}
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
      <a href="${sheetUrl}">스프레드시트에서 전체 목록 확인 →</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to:       ADMIN_EMAIL,
    subject:  `[SMAC EDU 사진특강] 신청 누적 ${total}명 — 최근 ${batchSize}명 알림`,
    htmlBody: html
  });
}
