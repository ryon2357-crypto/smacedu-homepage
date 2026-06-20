// Google Apps Script for collecting review submissions into Google Sheets
// 1. Google Sheets를 만들고, 시트 이름을 "후기" 등으로 설정하세요.
// 2. Apps Script에서 새 스크립트를 만들고 이 코드를 붙여넣습니다.
// 3. 배포 > 웹 앱으로 배포 > "익명 사용자도 실행" 또는 "Anyone" 권한으로 설정합니다.
// 4. 배포 후 나온 URL을 reviews.html과 admin.html의 GOOGLE_SCRIPT_URL에 붙여넣으세요.

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
    const ss = SpreadsheetApp.openById('18_lHsuigFPMoxPioQV9FTK1PUQmEAuIEpD8nG--Pq0I');
    const sheet = ss.getSheetByName('후기') || ss.getSheets()[0];
    const headers = _ensureHeaders(sheet);
    const params = e.parameter || {};
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

function _sendDashboardEmail(sheet, headers, totalReviews) {
  const RECIPIENT = 'ryon2357@gmail.com';
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
    .map(([c, n]) => `<tr><td style="padding:6px 12px;">${c}</td><td style="padding:6px 12px;text-align:center;">${n}건</td></tr>`)
    .join('');

  const recent = values.slice(-5).reverse()
    .map(r => `<tr>
      <td style="padding:6px 12px;">${r[timeIdx]}</td>
      <td style="padding:6px 12px;">${r[nameIdx]}</td>
      <td style="padding:6px 12px;">${r[courseIdx]}</td>
      <td style="padding:6px 12px;">${String(r[contentIdx]).slice(0, 40)}…</td>
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
      <strong>${name}</strong> 님의 후기 상태가
      <span style="color:${color};font-weight:700;">${label}</span> 으로 변경되었습니다.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#64748b;width:80px;">과정</td><td>${course}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">내용</td><td>${content}…</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
      <a href="https://docs.google.com/spreadsheets/d/18_lHsuigFPMoxPioQV9FTK1PUQmEAuIEpD8nG--Pq0I/edit">스프레드시트 바로가기</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to: 'ryon2357@gmail.com',
    subject: `[스마트미디어아트센터] 후기 상태 변경: ${label} — ${name}`,
    htmlBody: html
  });
}

// ════════════════════════════════════════════
// 특강 신청 처리
// ════════════════════════════════════════════

const LECTURE_SHEET_NAME = '특강신청';
const ADMIN_EMAIL        = 'ryon2357@gmail.com';
const SHEET_ID           = '18_lHsuigFPMoxPioQV9FTK1PUQmEAuIEpD8nG--Pq0I';
const SHEET_URL          = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

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
    _sendLectureAdminNotify(name, email, phone, timestamp, total);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function _sendLectureConfirmEmail(name, email) {
  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:32px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:24px;font-weight:900;">신청이 완료됐습니다! 🎉</h1>
    <p style="color:rgba(255,255,255,0.85);margin:10px 0 0;font-size:15px;">AI 에이전트로 랜딩 페이지 만들기 — 2시간 무료 특강</p>
  </div>
  <div style="background:#f8fafc;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:16px;"><strong>${name}</strong>님, 반갑습니다!</p>
    <p style="margin:0 0 20px;color:#475569;line-height:1.7;">
      특강 신청이 정상적으로 접수됐어요.<br>
      일정 및 참여 링크는 특강 하루 전에 이 메일로 다시 안내드리겠습니다.
    </p>

    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:7px 0;color:#64748b;width:90px;">강의명</td>
          <td style="color:#1e293b;font-weight:600;">AI 에이전트로 랜딩 페이지 만들기</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#64748b;">시간</td>
          <td style="color:#1e293b;">2시간 (무료)</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#64748b;">준비물</td>
          <td style="color:#1e293b;">노트북, Claude 계정 (무료 가입 가능)</td>
        </tr>
      </table>
    </div>

    <p style="margin:0;font-size:13px;color:#94a3b8;">
      문의는 <a href="mailto:${ADMIN_EMAIL}" style="color:#7c3aed;">${ADMIN_EMAIL}</a>로 보내주세요.
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to:       email,
    subject:  '[SMAC EDU] AI 에이전트 특강 신청이 완료됐습니다',
    htmlBody: html
  });
}

function _sendLectureAdminNotify(name, email, phone, timestamp, total) {
  const html = `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#1e3a5f;color:#fff;padding:18px 22px;margin:0;border-radius:8px 8px 0 0;">
    ✦ 특강 신청 알림 (누적 ${total}명)
  </h2>
  <div style="background:#f8fafc;padding:22px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:7px 0;color:#64748b;width:80px;">신청일시</td><td>${timestamp}</td></tr>
      <tr><td style="padding:7px 0;color:#64748b;">이름</td><td><strong>${name}</strong></td></tr>
      <tr><td style="padding:7px 0;color:#64748b;">이메일</td><td>${email}</td></tr>
      <tr><td style="padding:7px 0;color:#64748b;">연락처</td><td>${phone || '미입력'}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
      <a href="${SHEET_URL}">스프레드시트에서 전체 목록 확인 →</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to:       ADMIN_EMAIL,
    subject:  `[SMAC EDU 특강] 신청 접수 — ${name} (총 ${total}명)`,
    htmlBody: html
  });
}
