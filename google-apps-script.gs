// Google Apps Script for collecting review submissions into Google Sheets
// 1. Google Sheets를 만들고, 시트 이름을 "후기" 등으로 설정하세요.
// 2. Apps Script에서 새 스크립트를 만들고 이 코드를 붙여넣습니다.
// 3. 배포 > 웹 앱으로 배포 > "익명 사용자도 실행" 또는 "Anyone" 권한으로 설정합니다.
// 4. 배포 후 나온 URL을 reviews.html과 admin.html의 GOOGLE_SCRIPT_URL에 붙여넣으세요.

// 사용자 입력값을 이메일 HTML 본문에 넣기 전 이스케이프 (HTML/링크 삽입 방지)
function escapeHtml(str) {
  return String(str === null || str === undefined ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _ensureHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  const currentHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  const expected = ['timestamp', 'type', 'rating', 'name', 'email', 'course', 'age', 'content', 'status'];
  let headers = currentHeaders.slice();

  if (!headers.length || !headers[0]) {
    sheet.clear();
    sheet.appendRow(expected);
    return expected;
  }

  if (headers.length < expected.length) {
    expected.slice(headers.length).forEach((value, index) => {
      sheet.getRange(1, headers.length + index + 1).setValue(value);
      headers.push(value);
    });
  }

  if (headers.indexOf('status') === -1) {
    sheet.getRange(1, headers.length + 1).setValue('status');
    headers.push('status');
  }

  return headers;
}

function doGet(e) {
  try {
    const params = e.parameter || {};

    // ── 특강 신청 처리 (GET 방식) ──
    if (params.sheetType === 'lecture') {
      return _handleLectureSignup(params);
    }

    // ── 출강·수강 문의 처리 (GET 방식) ──
    if (params.sheetType === 'contact') {
      return _handleContactInquiry(params);
    }

    // ── 회원 가입 처리 (GET 방식) ──
    if (params.sheetType === 'member') {
      return _handleMemberSignup(params);
    }

    const ss = SpreadsheetApp.openById('18_lHsuigFPMoxPioQV9FTK1PUQmEAuIEpD8nG--Pq0I');
    const sheet = ss.getSheetByName('후기') || ss.getSheets()[0];
    const headers = _ensureHeaders(sheet);
    const action = params.action || 'fetch';

    if (action !== 'fetch') {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const values = sheet.getDataRange().getValues();
    const rows = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const item = { rowIndex: i + 1 };
      headers.forEach((key, index) => {
        item[key] = row[index] !== undefined ? row[index] : '';
      });
      rows.push(item);
    }

    if (params.status) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        reviews: rows.filter(r => String(r.status || '').toLowerCase() === String(params.status).toLowerCase())
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', reviews: rows }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const params = e.parameter || {};

    // ── 특강 신청 처리 ──
    if (params.sheetType === 'lecture') {
      return _handleLectureSignup(params);
    }

    const ss = SpreadsheetApp.openById('18_lHsuigFPMoxPioQV9FTK1PUQmEAuIEpD8nG--Pq0I');
    const sheet = ss.getSheetByName('후기') || ss.getSheets()[0];
    const headers = _ensureHeaders(sheet);
    const action = params.action || '';
    const statusCol = headers.indexOf('status') + 1;

    if (action === 'update' && params.row) {
      const rowIndex = parseInt(params.row, 10);
      if (isNaN(rowIndex) || rowIndex < 2 || rowIndex > sheet.getLastRow()) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid row index.' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      sheet.getRange(rowIndex, statusCol).setValue(params.status || 'pending');
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const now = new Date();
    const data = params;
    const row = [
      Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      data.type || '',
      data.rating || '',
      data.name || '',
      data.email || '',
      data.course || '',
      data.age || '',
      data.content || '',
      data.status || 'approved'
    ];

    sheet.appendRow(row);

    const totalReviews = sheet.getLastRow() - 1;
    _sendNewReviewNotify(data, totalReviews);
    if (totalReviews > 0 && totalReviews % 10 === 0) {
      _sendDashboardEmail(sheet, headers, totalReviews);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function _sendNewReviewNotify(data, total) {
  const stars = '★'.repeat(parseInt(data.rating) || 0) + '☆'.repeat(5 - (parseInt(data.rating) || 0));
  const html = `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#1e3a5f;color:#fff;padding:16px 20px;margin:0;border-radius:8px 8px 0 0;">
    ⭐ 새 수강후기 접수 (누적 ${total}건)
  </h2>
  <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#64748b;width:70px;">별점</td><td style="color:#f59e0b;font-size:16px;">${stars}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">이름</td><td><strong>${escapeHtml(data.name || '-')}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">과정</td><td>${escapeHtml(data.course || '-')}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">내용</td><td style="line-height:1.6;">${escapeHtml(String(data.content || '-').slice(0, 120))}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
      <a href="https://docs.google.com/spreadsheets/d/18_lHsuigFPMoxPioQV9FTK1PUQmEAuIEpD8nG--Pq0I/edit">스프레드시트에서 확인 →</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to:       'elanvital7@naver.com',
    subject:  `[SMAC EDU 후기] ${data.name || '(이름없음)'} — ${data.course || ''} ${data.rating || '-'}점`,
    htmlBody: html
  });
}

function _sendDashboardEmail(sheet, headers, totalReviews) {
  const RECIPIENT = 'elanvital7@naver.com';
  const values = sheet.getDataRange().getValues().slice(1);

  const statusIdx  = headers.indexOf('status');
  const courseIdx  = headers.indexOf('course');
  const ratingIdx  = headers.indexOf('rating');
  const nameIdx    = headers.indexOf('name');
  const contentIdx = headers.indexOf('content');
  const timeIdx    = headers.indexOf('timestamp');

  const approved = values.filter(r => String(r[statusIdx]).toLowerCase() === 'approved').length;
  const pending  = values.filter(r => String(r[statusIdx]).toLowerCase() === 'pending').length;

  const ratingSum = values.reduce((s, r) => s + (parseFloat(r[ratingIdx]) || 0), 0);
  const avgRating = totalReviews > 0 ? (ratingSum / totalReviews).toFixed(1) : '-';

  const courseCounts = {};
  values.forEach(r => {
    const c = r[courseIdx] || '미입력';
    courseCounts[c] = (courseCounts[c] || 0) + 1;
  });
  const courseRows = Object.entries(courseCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `<tr><td style="padding:6px 12px;">${escapeHtml(c)}</td><td style="padding:6px 12px;text-align:center;">${n}건</td></tr>`)
    .join('');

  const recent = values.slice(-5).reverse()
    .map(r => `<tr>
      <td style="padding:6px 12px;">${r[timeIdx]}</td>
      <td style="padding:6px 12px;">${escapeHtml(r[nameIdx])}</td>
      <td style="padding:6px 12px;">${escapeHtml(r[courseIdx])}</td>
      <td style="padding:6px 12px;">${escapeHtml(String(r[contentIdx]).slice(0, 40))}…</td>
    </tr>`).join('');

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#1e3a5f;color:#fff;padding:20px 24px;margin:0;border-radius:8px 8px 0 0;">
    📊 스마트미디어아트센터 — 후기 대시보드
  </h2>
  <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;">
    <p style="margin:0 0 16px;color:#64748b;">총 <strong>${totalReviews}번째</strong> 후기가 접수되었습니다.</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="background:#fff;border:1px solid #e2e8f0;padding:16px;text-align:center;border-radius:6px;">
          <div style="font-size:28px;font-weight:700;color:#1e3a5f;">${totalReviews}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">전체 후기</div>
        </td>
        <td style="width:12px;"></td>
        <td style="background:#fff;border:1px solid #e2e8f0;padding:16px;text-align:center;border-radius:6px;">
          <div style="font-size:28px;font-weight:700;color:#16a34a;">${approved}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">승인됨</div>
        </td>
        <td style="width:12px;"></td>
        <td style="background:#fff;border:1px solid #e2e8f0;padding:16px;text-align:center;border-radius:6px;">
          <div style="font-size:28px;font-weight:700;color:#f59e0b;">${pending}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">검토 대기</div>
        </td>
        <td style="width:12px;"></td>
        <td style="background:#fff;border:1px solid #e2e8f0;padding:16px;text-align:center;border-radius:6px;">
          <div style="font-size:28px;font-weight:700;color:#f97316;">★ ${avgRating}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">평균 별점</div>
        </td>
      </tr>
    </table>

    <h3 style="margin:0 0 8px;font-size:14px;color:#475569;">과정별 후기 수</h3>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:24px;">
      ${courseRows}
    </table>

    <h3 style="margin:0 0 8px;font-size:14px;color:#475569;">최근 후기 5건</h3>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:6px;">
      <tr style="background:#f1f5f9;font-size:12px;color:#64748b;">
        <th style="padding:8px 12px;text-align:left;">시간</th>
        <th style="padding:8px 12px;text-align:left;">이름</th>
        <th style="padding:8px 12px;text-align:left;">과정</th>
        <th style="padding:8px 12px;text-align:left;">내용</th>
      </tr>
      ${recent}
    </table>

    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">
      스프레드시트에서 전체 내용 확인:
      <a href="https://docs.google.com/spreadsheets/d/18_lHsuigFPMoxPioQV9FTK1PUQmEAuIEpD8nG--Pq0I/edit">바로가기</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to: RECIPIENT,
    subject: `[스마트미디어아트센터] 후기 ${totalReviews}건 달성 대시보드`,
    htmlBody: html
  });
}

// 최초 1회 실행해서 onEdit 트리거를 설치합니다.
function setupEditTrigger() {
  const ss = SpreadsheetApp.openById('18_lHsuigFPMoxPioQV9FTK1PUQmEAuIEpD8nG--Pq0I');
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onStatusEdit')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onStatusEdit').forSpreadsheet(ss).onEdit().create();
}

function onStatusEdit(e) {
  const sheetName = e.range.getSheet().getName();
  if (sheetName !== '후기') return;

  const col = e.range.getColumn();
  const row = e.range.getRow();
  if (col !== 9 || row < 2) return;

  const newStatus = String(e.value || '').trim().toLowerCase();
  const oldStatus = String(e.oldValue || '').trim().toLowerCase();
  if (newStatus === oldStatus) return;

  const sheet = e.range.getSheet();
  const rowData = sheet.getRange(row, 1, 1, 9).getValues()[0];
  const name    = rowData[3] || '(이름 없음)';
  const course  = rowData[5] || '';
  const content = String(rowData[7] || '').slice(0, 80);

  const label = newStatus === 'approved' ? '✅ 승인됨' : '⏸ 숨김 처리됨';
  const color = newStatus === 'approved' ? '#16a34a' : '#f59e0b';

  const html = `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#1e3a5f;color:#fff;padding:16px 20px;margin:0;border-radius:8px 8px 0 0;">
    후기 상태 변경 알림
  </h2>
  <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 12px;">
      <strong>${escapeHtml(name)}</strong> 님의 후기 상태가
      <span style="color:${color};font-weight:700;">${label}</span> 으로 변경되었습니다.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#64748b;width:80px;">과정</td><td>${escapeHtml(course)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">내용</td><td>${escapeHtml(content)}…</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
      <a href="https://docs.google.com/spreadsheets/d/18_lHsuigFPMoxPioQV9FTK1PUQmEAuIEpD8nG--Pq0I/edit">스프레드시트 바로가기</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to: 'elanvital7@naver.com',
    subject: `[스마트미디어아트센터] 후기 상태 변경: ${label} — ${name}`,
    htmlBody: html
  });
}

// ════════════════════════════════════════════
// 특강 신청 처리
// ════════════════════════════════════════════

const LECTURE_SHEET_NAME = '특강신청';
const ADMIN_EMAIL        = 'elanvital7@naver.com';
const SHEET_ID           = '18_lHsuigFPMoxPioQV9FTK1PUQmEAuIEpD8nG--Pq0I';
const SHEET_URL          = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

// 시트의 자동 포맷으로 "08210-4717-0624"처럼 깨진 연락처를 "010-4717-0624" 형식으로 일괄 정리.
// 편집기에서 이 함수를 선택해 한 번만 실행하면 됩니다 (배포 불필요).
function normalizeLecturePhoneNumbers() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(LECTURE_SHEET_NAME);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const range = sheet.getRange(2, 4, lastRow - 1, 1); // D열 = 연락처
  const fixed = range.getValues().map(([v]) => [_normalizePhone(String(v || ''))]);
  range.setValues(fixed);
}

function _normalizePhone(raw) {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return raw;

  let fixedDigits = digits;
  if (/^0?82\d{10}$/.test(digits)) {
    fixedDigits = '0' + digits.slice(-10);
  }

  if (fixedDigits.length === 11) {
    return fixedDigits.slice(0, 3) + '-' + fixedDigits.slice(3, 7) + '-' + fixedDigits.slice(7);
  }
  return raw; // 11자리로 안 맞으면 수동 확인이 필요하니 원본 유지
}

function _handleLectureSignup(params) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    let   sheet = ss.getSheetByName(LECTURE_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(LECTURE_SHEET_NAME);
      sheet.appendRow(['신청일시', '이름', '이메일', '연락처']);
      sheet.setFrozenRows(1);
      sheet.getRange('A1:D1').setBackground('#1e3a5f').setFontColor('#ffffff').setFontWeight('bold');
    }

    const now       = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const name      = params.name  || '';
    const email     = params.email || '';
    const phone     = params.phone || '';

    sheet.appendRow([timestamp, name, email, phone]);
    const total = sheet.getLastRow() - 1;

    if (email) _sendLectureConfirmEmail(name, email);
    if (total % 10 === 0) _sendLectureAdminDigest(sheet, total);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

const PRE_MATERIAL_LINKS = {
  part1: 'https://drive.google.com/file/d/10kpffzU20qvmGSVlo22i6jF9QRbrCO9B/view?usp=drive_link',
  part2: 'https://drive.google.com/file/d/1opLUlKh-QnZOFTLJUp6QQ9lNSbYVtHu1/view?usp=drive_link',
  part3: 'https://drive.google.com/file/d/17ZveAlTk4EquoA47rweZSE2JDVZ5cLPZ/view?usp=drive_link'
};

function _sendLectureConfirmEmail(name, email) {
  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:32px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:24px;font-weight:900;">신청이 완료됐습니다! 🎉</h1>
    <p style="color:rgba(255,255,255,0.85);margin:10px 0 0;font-size:15px;">AI 에이전트로 랜딩 페이지 만들기 — 2시간 VIP 특강</p>
  </div>
  <div style="background:#f8fafc;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:16px;"><strong>${escapeHtml(name)}</strong>님, 반갑습니다!</p>
    <p style="margin:0 0 20px;color:#475569;line-height:1.7;">
      특강 신청이 정상적으로 접수됐어요.<br>
      참여 링크는 특강 전날인 6월 26일(금)에 이 메일로 다시 안내드리겠습니다.
    </p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px;margin-bottom:20px;text-align:center;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626;">🗓 6월 27일(토) 저녁 8시 — 잊지 마세요!</p>
    </div>

    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:7px 0;color:#64748b;width:90px;">강의명</td>
          <td style="color:#1e293b;font-weight:600;">AI 에이전트로 랜딩 페이지 만들기</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#64748b;">일시</td>
          <td style="color:#1e293b;font-weight:600;">2026년 6월 27일(토) 저녁 8시</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#64748b;">소요시간</td>
          <td style="color:#1e293b;">2시간</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#64748b;">준비물</td>
          <td style="color:#1e293b;">노트북, Claude 유료 개인 계정 (1주일 무료체험 가능 — 특강 당일 안내)</td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1e293b;">사전 자료 (PDF 3종)</p>
    <p style="margin:0 0 14px;color:#475569;line-height:1.6;font-size:14px;">
      아래 PART를 클릭하면 구글 드라이브에서 바로 열람·다운로드할 수 있습니다.<br>
      특강 전날까지 읽어보시면 당일이 훨씬 빨라요.
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
          <a href="${PRE_MATERIAL_LINKS.part1}" style="text-decoration:none;color:#1e293b;">
            <div style="font-size:11px;font-weight:700;color:#7c3aed;letter-spacing:0.05em;margin-bottom:4px;">PART 1</div>
            <div style="font-size:13px;font-weight:700;margin-bottom:4px;">설치 가이드 ↓</div>
            <div style="font-size:12px;color:#64748b;">Claude Desktop + Claude Code 설치 3단계 안내</div>
          </a>
        </td>
      </tr>
      <tr><td style="height:10px;"></td></tr>
      <tr>
        <td style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
          <a href="${PRE_MATERIAL_LINKS.part2}" style="text-decoration:none;color:#1e293b;">
            <div style="font-size:11px;font-weight:700;color:#7c3aed;letter-spacing:0.05em;margin-bottom:4px;">PART 2</div>
            <div style="font-size:13px;font-weight:700;margin-bottom:4px;">개념 예습 ↓</div>
            <div style="font-size:12px;color:#64748b;">챗봇 vs 에이전트, Cowork vs Code 차이</div>
          </a>
        </td>
      </tr>
      <tr><td style="height:10px;"></td></tr>
      <tr>
        <td style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
          <a href="${PRE_MATERIAL_LINKS.part3}" style="text-decoration:none;color:#1e293b;">
            <div style="font-size:11px;font-weight:700;color:#7c3aed;letter-spacing:0.05em;margin-bottom:4px;">PART 3</div>
            <div style="font-size:13px;font-weight:700;margin-bottom:4px;">사전 과제 ↓</div>
            <div style="font-size:12px;color:#64748b;">내 랜딩 페이지 아이디어 미리 메모하기</div>
          </a>
        </td>
      </tr>
    </table>

    <div style="text-align:center;margin-bottom:20px;">
      <a href="https://www.smacedu.kr/lecture-landing" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 32px;border-radius:999px;">특강 페이지 다시 보기</a>
    </div>

    <p style="margin:0;font-size:13px;color:#94a3b8;">
      문의는 <a href="mailto:${ADMIN_EMAIL}" style="color:#7c3aed;">${ADMIN_EMAIL}</a>로 보내주세요.
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to:       email,
    subject:  '[SMAC EDU] AI 에이전트 특강 신청 완료 + 사전 자료를 보내드립니다',
    htmlBody: html
  });
}

// 신청 10명마다 한 번씩, 최근 10명을 모아서 알려줍니다 (매번 메일이 오면 너무 정신없어서 배치 처리).
function _sendLectureAdminDigest(sheet, total) {
  const lastRow   = sheet.getLastRow();
  const batchSize = Math.min(10, lastRow - 1);
  const startRow  = lastRow - batchSize + 1;
  // 열 순서: 신청일시(1), 이름(2), 이메일(3), 연락처(4)
  const rows = sheet.getRange(startRow, 1, batchSize, 4).getValues();

  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:6px 10px;font-size:13px;color:#64748b;">${r[0]}</td>
      <td style="padding:6px 10px;font-size:13px;"><strong>${escapeHtml(r[1])}</strong></td>
      <td style="padding:6px 10px;font-size:13px;">${escapeHtml(r[2])}</td>
      <td style="padding:6px 10px;font-size:13px;">${escapeHtml(r[3] || '미입력')}</td>
    </tr>`).join('');

  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#1e3a5f;color:#fff;padding:18px 22px;margin:0;border-radius:8px 8px 0 0;">
    ✦ 특강 신청 알림 (누적 ${total}명 — 최근 ${batchSize}명)
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
      <a href="${SHEET_URL}">스프레드시트에서 전체 목록 확인 →</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to:       ADMIN_EMAIL,
    subject:  `[SMAC EDU 특강] 신청 누적 ${total}명 — 최근 ${batchSize}명 알림`,
    htmlBody: html
  });
}

// ════════════════════════════════════════════
// 회원 가입 처리
// ════════════════════════════════════════════

function _handleMemberSignup(params) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    let   sheet = ss.getSheetByName('회원');

    if (!sheet) {
      sheet = ss.insertSheet('회원');
      sheet.appendRow(['가입일시', '이름', '이메일']);
      sheet.setFrozenRows(1);
      sheet.getRange('A1:C1').setBackground('#1e3a5f').setFontColor('#ffffff').setFontWeight('bold');
    }

    const now       = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const name      = params.name  || '';
    const email     = params.email || '';
    const total     = sheet.getLastRow();

    sheet.appendRow([timestamp, name, email]);

    MailApp.sendEmail({
      to:      'elanvital7@naver.com',
      subject: `[SMAC EDU 회원] 새 회원 가입 — ${name} (누적 ${total}명)`,
      htmlBody: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#1e3a5f;color:#fff;padding:16px 20px;margin:0;border-radius:8px 8px 0 0;">
    👤 새 회원 가입 (누적 ${total}명)
  </h2>
  <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#64748b;width:70px;">가입일시</td><td>${timestamp}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">이름</td><td><strong>${escapeHtml(name)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">이메일</td><td>${escapeHtml(email)}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
      <a href="${SHEET_URL}">스프레드시트에서 전체 회원 목록 확인 →</a>
    </p>
  </div>
</div>`
    });

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ════════════════════════════════════════════
// 출강·수강 문의 처리
// ════════════════════════════════════════════

const CONTACT_RECIPIENT = 'elanvital7@naver.com';

function _handleContactInquiry(params) {
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    let   sheet = ss.getSheetByName('문의');

    if (!sheet) {
      sheet = ss.insertSheet('문의');
      sheet.appendRow(['접수일시','기관명','담당자명','연락처','이메일','교육분야','교육대상','예상인원','희망일정','교육시간','교육장소','예산','요청내용']);
      sheet.setFrozenRows(1);
      sheet.getRange('A1:M1').setBackground('#1e3a5f').setFontColor('#ffffff').setFontWeight('bold');
    }

    const now       = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    sheet.appendRow([
      timestamp,
      params.orgName     || '',
      params.contactName || '',
      params.phone       || '',
      params.email       || '',
      params.field       || '',
      params.target      || '',
      params.headcount   || '',
      params.schedule    || '',
      params.duration    || '',
      params.venue       || '',
      params.budget      || '',
      params.message     || '',
    ]);

    _sendContactEmail(params, timestamp);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function _sendContactEmail(p, timestamp) {
  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#1e3a5f;color:#fff;padding:20px 24px;margin:0;border-radius:8px 8px 0 0;">
    📋 출강·수강 문의 접수
  </h2>
  <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;color:#64748b;">접수일시: ${timestamp}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr style="background:#f1f5f9;"><td style="padding:8px 12px;font-weight:700;width:110px;">기관명</td><td style="padding:8px 12px;">${escapeHtml(p.orgName || '-')}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:700;background:#f8fafc;">담당자명</td><td style="padding:8px 12px;">${escapeHtml(p.contactName || '-')}</td></tr>
      <tr style="background:#f1f5f9;"><td style="padding:8px 12px;font-weight:700;">연락처</td><td style="padding:8px 12px;">${escapeHtml(p.phone || '-')}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:700;background:#f8fafc;">이메일</td><td style="padding:8px 12px;">${escapeHtml(p.email || '-')}</td></tr>
      <tr style="background:#f1f5f9;"><td style="padding:8px 12px;font-weight:700;">교육 분야</td><td style="padding:8px 12px;">${escapeHtml(p.field || '-')}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:700;background:#f8fafc;">교육 대상</td><td style="padding:8px 12px;">${escapeHtml(p.target || '-')}</td></tr>
      <tr style="background:#f1f5f9;"><td style="padding:8px 12px;font-weight:700;">예상 인원</td><td style="padding:8px 12px;">${escapeHtml(p.headcount || '-')}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:700;background:#f8fafc;">희망 일정</td><td style="padding:8px 12px;">${escapeHtml(p.schedule || '-')}</td></tr>
      <tr style="background:#f1f5f9;"><td style="padding:8px 12px;font-weight:700;">교육 시간</td><td style="padding:8px 12px;">${escapeHtml(p.duration || '-')}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:700;background:#f8fafc;">교육 장소</td><td style="padding:8px 12px;">${escapeHtml(p.venue || '-')}</td></tr>
      <tr style="background:#f1f5f9;"><td style="padding:8px 12px;font-weight:700;">예산</td><td style="padding:8px 12px;">${escapeHtml(p.budget || '-')}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:700;background:#f8fafc;">요청 내용</td><td style="padding:8px 12px;">${escapeHtml(p.message || '-')}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">
      <a href="${SHEET_URL}">스프레드시트에서 전체 문의 목록 확인 →</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to:       CONTACT_RECIPIENT,
    subject:  `[SMAC EDU 문의] ${p.orgName || '(기관명 없음)'} — ${p.contactName || ''} ${p.phone || ''}`,
    htmlBody: html
  });
}
