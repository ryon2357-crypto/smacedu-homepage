// 스마트폰 사진특강 랜딩페이지 전용 신청 처리 스크립트
// (이미 배포·인증이 끝난 프로젝트라, 후기 감사 선물 랜딩페이지 + 유튜브 기획 워크북(수강생용/리드마그넷)
// 제출 기록도 함께 처리합니다 — 아래 참고)
//
// 사용 방법:
// 1. 이 스프레드시트를 엽니다:
//    https://docs.google.com/spreadsheets/d/1mWvHb6H6YhtAe-j2y_PDGwfcK4jY8mpHyCO0OJHBA-0/edit
// 2. 확장 프로그램 → Apps Script 로 들어갑니다 (이 시트에 직접 바인딩되는 스크립트라 권한 문제가 없습니다).
// 3. 기본 코드를 지우고 이 파일 내용 전체를 붙여넣습니다.
// 4. 배포 → 배포 관리 → 기존 배포 옆 ✏️ → 새 버전으로 배포 (이미 인증된 배포를 재사용하므로 "차단된 앱" 문제가 없습니다).
// 5. 배포 후 나온 웹 앱 URL을 photo-lecture-landing.html과 review-gift-landing.html의 SCRIPT_URL에 붙여넣습니다.
//    (여러 랜딩페이지가 같은 웹 앱 URL을 공유하고, 요청에 form 파라미터로 분기합니다:
//     review-gift-landing.html → form=reviewgift, youtube-planner-수강생용.html → form=ytplanner,
//     youtube-planner.html(리드마그넷 워크북) → form=ytworkbook.)
// 6. 구글폼(forms.gle)으로 직접 제출해도 확인 메일이 가도록 트리거를 한 번 등록해야 합니다:
//    Apps Script 편집기 좌측 "트리거"(시계 아이콘) → 트리거 추가
//    → 실행할 함수: onFormSubmit / 이벤트 소스: 스프레드시트에서 / 이벤트 유형: 양식 제출 시 → 저장
//    (랜딩페이지 신청은 doGet이 처리하고, 구글폼 직접 제출은 이 트리거가 처리합니다 — 서로 겹치지 않습니다.
//     단, 이 트리거는 사진특강 시트 전용이며 후기 선물 시트의 폼 직접 제출까지는 커버하지 않습니다.)

const ADMIN_EMAIL = 'elanvital7@naver.com';
const SHEET_GID   = 12733408; // 신청서 응답 시트(설문지 응답 시트1)의 tab gid

// ── 후기 감사 선물 랜딩페이지(review-gift-landing.html) 겸용 ──
// 이 스크립트는 이미 배포되어 구글 인증이 통과된 프로젝트라, 후기 선물 신청도
// 여기에 얹어서 처리합니다 (새 스크립트 프로젝트를 새로 배포하면 "차단된 앱" 인증
// 문제를 다시 겪을 수 있어, 기존에 인증이 끝난 이 프로젝트를 재사용하는 방식입니다).
// review-gift-landing.html은 요청에 form=reviewgift 를 함께 보내 이 분기를 탑니다.
const REVIEWGIFT_SHEET_ID  = '1LQCmJX4Drdq2bBjo6fhaF_wr1vu_kJucN-e_ZSe6P6A'; // 혜택 선물 신청서(응답)
const REVIEWGIFT_TAB_NAME  = '후기선물신청'; // 기존 시트(다른 캠페인 응답 뒤섞여 있음) 대신 이 전용 탭에 기록 — 없으면 자동 생성
const GIFT_DRIVE_URL       = 'https://www.smacedu.kr/review-gift-download'; // drive.google.com 직링크는 스팸 신호가 되어, smacedu.kr 리다이렉트 페이지를 거칩니다
const RECAP_URL            = 'https://www.smacedu.kr/photo-lecture-recap'; // gamma.site 직링크는 스팸 신호가 되어, smacedu.kr 리다이렉트 페이지를 거칩니다
const RECRUIT_URL          = 'https://www.smacedu.kr/photo-artist-instructor';

// ── 유튜브 채널 기획 워크북(youtube-planner-수강생용.html) 제출 기록 겸용 ──
// 새 구글폼/새 스크립트 프로젝트를 또 만들면 "차단된 앱" 인증 문제를 다시 겪을 수 있어,
// 이미 인증이 끝난 이 프로젝트를 재사용합니다. 페이지에서 form=ytplanner 로 요청을 보냅니다.
const YTPLANNER_SHEET_ID   = '1Zp9bEwB-bqLK8UkhAFaoFOqY1kpT1O4k98P9RiF24o8'; // 유튜브 기획 워크북_수강생 제출 기록
const YTPLANNER_TAB_NAME   = '기획서 제출';

// ── 유튜브 채널 기획 워크북 리드마그넷(youtube-planner.html) 신청자 기록 겸용 ──
// 위 ytplanner(수강생용)와는 대상이 다른 별도 방문자(잠재고객)라 같은 스프레드시트의
// 별도 탭에 기록합니다. 페이지에서 form=ytworkbook 으로 요청을 보냅니다.
const WORKBOOK_TAB_NAME    = '워크북 리드';

function doGet(e) {
  const params0 = e.parameter || {};
  if (params0.form === 'reviewgift') {
    return _handleReviewGiftSubmit(params0);
  }
  if (params0.form === 'ytplanner') {
    return _handleYtPlannerSubmit(params0);
  }
  if (params0.form === 'ytworkbook') {
    return _handleWorkbookLead(params0);
  }

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

// 구글폼(forms.gle)으로 직접 제출했을 때 실행되는 트리거.
// doGet과 달리 question 제목 매칭에 의존하지 않고, 방금 추가된 행을 열 번호로 직접 읽습니다
// (열 순서는 doGet의 appendRow와 동일: 타임스탬프, 점수, 이름, 신청경로, 전화번호, 이메일, ...).
function onFormSubmit(e) {
  try {
    const sheet = e.range.getSheet();
    const row   = e.range.getRow();
    const name  = sheet.getRange(row, 3).getValue();
    const email = sheet.getRange(row, 6).getValue();

    if (email) _sendConfirmEmail(name, email);

    const total = sheet.getLastRow() - 1;
    if (total % 10 === 0) _sendAdminDigest(sheet, total);
  } catch (err) {
    console.error('onFormSubmit 오류: ' + err.message);
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
      참여 ZOOM 링크는 특강 당일인 7월 17일(금) 저녁 6시까지 이 메일로 다시 안내드리겠습니다.
    </p>

    <div style="background:linear-gradient(135deg,#ede9fe,#ddd6fe);border:1px solid #c4b5fd;border-radius:10px;padding:18px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#5b21b6;">✨ 신청해 주신 분께 드리는 VIP 특별 초대</p>
      <p style="margin:0 0 12px;font-size:13px;color:#5b21b6;">코딩 몰라도 괜찮아요 — VIP 특강 <strong>"AI 에이전트로 랜딩 페이지 만들기(바이브 코딩)"</strong>에도 초대드려요</p>
      <a href="https://www.smacedu.kr/lecture-landing.html" style="display:inline-block;background:#fff;color:#5b21b6;border:1px solid #c4b5fd;text-decoration:none;font-size:14px;font-weight:700;padding:11px 28px;border-radius:999px;">✨ 바이브 코딩 강의 보러가기</a>
    </div>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#92400e;">🎁엘란비탈 무료특강 아카데미 단톡방에 들어오시면</p>
      <p style="margin:0 0 12px;font-size:13px;color:#7c2d12;">다양한 장르 + 양질의 무료 특강을 자주 만날 수 있습니다.</p>
      <a href="https://invite.kakao.com/tc/sEmjtp7axZ" style="display:inline-block;background:#FEE500;color:#3c1e1e;text-decoration:none;font-size:14px;font-weight:700;padding:11px 28px;border-radius:999px;">💬 단톡방 입장하기</a>
    </div>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px;margin-bottom:20px;text-align:center;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626;">🗓 7월 17일(금) 저녁 8시 — 잊지 마세요!</p>
    </div>

    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:7px 0;color:#64748b;width:90px;">강의명</td>
          <td style="color:#1e293b;font-weight:600;">찍는 순간 작품이 되는 스마트폰 사진</td>
        </tr>
        <tr>
          <td style="padding:7px 0;color:#64748b;">일시</td>
          <td style="color:#1e293b;font-weight:600;">2026년 7월 17일(금) 저녁 8시</td>
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

// ════════════════════════════════════════════
// 후기 감사 선물 랜딩페이지 처리 (review-gift-landing.html)
// 이 스크립트는 사진특강 시트에 바인딩돼 있으므로, 후기 선물 시트는
// openById로 별도로 열어서 기록합니다. 기존 "설문지 응답 시트1"은 다른
// 캠페인 응답이 뒤섞여 있어, 이 전용 탭(REVIEWGIFT_TAB_NAME)에 따로 기록합니다.
// ════════════════════════════════════════════
function _getReviewGiftSheet(ss) {
  let sheet = ss.getSheets().find(s => s.getName() === REVIEWGIFT_TAB_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(REVIEWGIFT_TAB_NAME);
    sheet.appendRow(['타임스탬프', '이름', '전화번호', '이메일', '개인정보 동의']);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  }
  return sheet;
}

function _handleReviewGiftSubmit(params) {
  try {
    const name    = params.name  || '';
    const email   = params.email || '';
    const phone   = params.phone || '';
    const consent = params.consent === 'Y' ? '동의함' : '';

    const ss    = SpreadsheetApp.openById(REVIEWGIFT_SHEET_ID);
    const sheet = _getReviewGiftSheet(ss);

    const now       = new Date();
    const timestamp = _formatKoreanTimestamp(now, Session.getScriptTimeZone());

    sheet.appendRow([timestamp, name, phone, email, consent]);
    const total = sheet.getLastRow() - 1;

    // 후기 확인 절차 없이 신청 즉시 자료 발송
    if (email) _sendGiftEmail(name, email);
    if (total % 10 === 0) _sendReviewGiftAdminDigest(sheet, total);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function _sendGiftEmail(name, email) {
  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#172554;">
  <div style="background:linear-gradient(135deg,#f97316,#fbbf24);padding:32px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:24px;font-weight:900;">소중한 후기 감사합니다 💛</h1>
    <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:15px;">약속드린 실전 자료 12종을 모두 보내드립니다</p>
  </div>
  <div style="background:#fff9ec;padding:28px;border:1px solid #fcd9a8;border-top:none;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:16px;"><strong>${name}</strong>님, 반갑습니다!</p>
    <p style="margin:0 0 20px;color:#4b5563;line-height:1.7;">
      바쁘신 와중에도 소중한 후기를 남겨주셔서 진심으로 감사합니다.<br>
      그 마음에 보답하고자 사진·SNS·마케팅·AI 실전 자료 12가지를 아래 링크에서 바로 다운로드하실 수 있도록 준비했습니다.
    </p>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${GIFT_DRIVE_URL}" style="display:inline-block;background:linear-gradient(135deg,#f97316,#fbbf24);color:#fff;text-decoration:none;font-size:15px;font-weight:800;padding:14px 34px;border-radius:999px;">🎁 선물 자료 12종 다운로드</a>
    </div>

    <div style="background:#fff;border:1px solid #fcd9a8;border-radius:10px;padding:20px 22px;margin-bottom:22px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:800;color:#ea6b0c;">받으시는 자료 12가지</p>
      <ol style="margin:0;padding-left:18px;font-size:13px;color:#374151;line-height:1.9;">
        <li>엘란비탈 스마트폰 사진 용어집</li>
        <li>미드저니 V6→V7 활용 꿀팁 가이드</li>
        <li>네이버 블로그 상위노출 프리미엄 체크리스트</li>
        <li>프로처럼 사진 잘 찍는 법</li>
        <li>영상 하나로 알고리즘 타는 유튜브 전략</li>
        <li>적은 예산으로 큰 효과를 내는 마케팅 전략</li>
        <li>챗GPT로 돈 버는 현실적인 10가지 방법</li>
        <li>초보자용 사진촬영 체크리스트</li>
        <li>캔바 AI 활용법 — 기본기편</li>
        <li>캔바 단축키 모음</li>
        <li>퇴사 전에 반드시 준비해야 할 7가지</li>
        <li>윈도우 필수 단축키 2026</li>
      </ol>
    </div>

    <div style="background:#fff;border:1px solid #fcd9a8;border-radius:10px;padding:16px 18px;margin-bottom:22px;text-align:center;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:800;color:#ea6b0c;">🎁 보너스 선물 — 7월 1일(수) 스마트폰 사진특강 정리본</p>
      <a href="${RECAP_URL}" style="display:inline-block;background:#fff;color:#ea6b0c;border:1px solid #fcd9a8;text-decoration:none;font-size:14px;font-weight:700;padding:10px 26px;border-radius:999px;">정리본 보기</a>
    </div>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 18px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#92400e;">🗓 7월 17일(금) 저녁 8시 — 지금 열려 있는 무료 특강</p>
      <p style="margin:0 0 12px;font-size:13px;color:#7c2d12;">찍는 순간 작품이 되는 스마트폰 사진 — 촬영과 보정부터 AI 활용까지, ZOOM 온라인</p>
      <a href="https://www.smacedu.kr/photo-lecture-landing#curriculum" style="display:inline-block;background:#fff;color:#92400e;border:1px solid #fde68a;text-decoration:none;font-size:14px;font-weight:700;padding:11px 28px;border-radius:999px;">특강 커리큘럼 보기</a>
    </div>

    <div style="background:linear-gradient(135deg,#172554,#1e3a8a);border-radius:10px;padding:20px 22px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:800;color:#fde68a;">🟧 사진작가 23기 &amp; 사진강사 11기 모집 중</p>
      <p style="margin:0 0 14px;font-size:13px;color:rgba(255,255,255,0.85);">이 메일을 받으신 <strong style="color:#fde68a;">${name}</strong>님께는 등록 시 <strong style="color:#fde68a;">3만원 할인</strong> 혜택을 드립니다.</p>
      <a href="${RECRUIT_URL}" style="display:inline-block;background:#fde68a;color:#172554;text-decoration:none;font-size:14px;font-weight:800;padding:11px 28px;border-radius:999px;">과정 자세히 보기</a>
    </div>

    <p style="margin:0;font-size:13px;color:#9ca3af;">
      문의는 <a href="mailto:${ADMIN_EMAIL}" style="color:#f97316;">${ADMIN_EMAIL}</a>로 보내주세요.
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to:       email,
    subject:  '[SMAC EDU] 소중한 후기 감사합니다 — 실전 자료 12종을 보내드립니다',
    htmlBody: html
  });
}

function _sendReviewGiftAdminDigest(sheet, total) {
  const sheetUrl   = `https://docs.google.com/spreadsheets/d/${REVIEWGIFT_SHEET_ID}/edit#gid=${sheet.getSheetId()}`;
  const lastRow    = sheet.getLastRow();
  const batchSize  = Math.min(10, lastRow - 1);
  const startRow   = lastRow - batchSize + 1;
  // 열 순서: 타임스탬프(1), 이름(2), 전화번호(3), 이메일(4), ...
  const rows = sheet.getRange(startRow, 1, batchSize, 4).getValues();

  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:6px 10px;font-size:13px;color:#64748b;">${r[0]}</td>
      <td style="padding:6px 10px;font-size:13px;"><strong>${r[1]}</strong></td>
      <td style="padding:6px 10px;font-size:13px;">${r[3]}</td>
      <td style="padding:6px 10px;font-size:13px;">${r[2] || '미입력'}</td>
    </tr>`).join('');

  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#172554;color:#fff;padding:18px 22px;margin:0;border-radius:8px 8px 0 0;">
    🎁 후기 선물 신청 알림 (누적 ${total}명 — 최근 ${batchSize}명)
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
    subject:  `[SMAC EDU 후기선물] 신청 누적 ${total}명 — 최근 ${batchSize}명 알림`,
    htmlBody: html
  });
}

// ════════════════════════════════════════════
// 유튜브 채널 기획 워크북 수강생 제출 기록 (youtube-planner-수강생용.html)
// 리드폼 없이 바로 쓰는 파일이라, "기획서 완성하기" 클릭 시 화면 변화 없이
// 조용히 이 분기로 전송돼 시트에 쌓입니다. 이름은 선택 입력이라 빈 값일 수 있습니다.
// ════════════════════════════════════════════
function _getYtPlannerSheet(ss) {
  let sheet = ss.getSheets().find(s => s.getName() === YTPLANNER_TAB_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(YTPLANNER_TAB_NAME);
    sheet.appendRow(['타임스탬프', '이름', '기획서 내용']);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
  return sheet;
}

function _handleYtPlannerSubmit(params) {
  try {
    const name = params.name || '(이름 미입력)';
    const plan = params.plan || '';

    const ss    = SpreadsheetApp.openById(YTPLANNER_SHEET_ID);
    const sheet = _getYtPlannerSheet(ss);

    const now       = new Date();
    const timestamp = _formatKoreanTimestamp(now, Session.getScriptTimeZone());

    sheet.appendRow([timestamp, name, plan]);

    // 시트 기록과 별개로, 제출될 때마다 바로 확인할 수 있도록 관리자에게도 이메일 발송
    // (수업 중이라 시트를 계속 열어둘 필요 없이 메일함만 확인하면 됨)
    _sendYtPlannerAdminEmail(name, plan, timestamp);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function _escapeHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function _sendYtPlannerAdminEmail(name, plan, timestamp) {
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${YTPLANNER_SHEET_ID}/edit`;
  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#17213B;color:#fff;padding:18px 22px;margin:0;border-radius:8px 8px 0 0;">
    📺 유튜브 기획 워크북 제출 — ${_escapeHtml(name)}
  </h2>
  <div style="background:#f8fafc;padding:22px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 14px;font-size:13px;color:#64748b;">${timestamp}</p>
    <pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.7;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0 0 16px;">${_escapeHtml(plan)}</pre>
    <p style="margin:0;font-size:12px;color:#94a3b8;">
      <a href="${sheetUrl}">스프레드시트에서 전체 목록 확인 →</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to:       ADMIN_EMAIL,
    subject:  `[SMAC EDU 유튜브 워크북] ${name}님 기획서 제출`,
    htmlBody: html
  });
}

// ════════════════════════════════════════════
// 유튜브 채널 기획 워크북 리드마그넷 신청자 기록 (youtube-planner.html)
// 이름/연락처를 남겨야 기획서 복사·카카오 공유가 열리는 구조라, 위 수강생용과 달리
// 매 건마다 이름·전화번호·개인정보 동의가 함께 들어옵니다. 이메일은 수집하지 않으므로
// 신청자에게 보내는 확인 메일은 없고, 관리자에게만 즉시 알림 메일을 보냅니다.
// ════════════════════════════════════════════
function _getWorkbookSheet(ss) {
  let sheet = ss.getSheets().find(s => s.getName() === WORKBOOK_TAB_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(WORKBOOK_TAB_NAME);
    sheet.appendRow(['타임스탬프', '이름', '전화번호', '기획서 내용']);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
  return sheet;
}

function _handleWorkbookLead(params) {
  try {
    const name  = params.name  || '';
    const phone = params.phone || '';
    const plan  = params.plan  || '';

    const ss    = SpreadsheetApp.openById(YTPLANNER_SHEET_ID);
    const sheet = _getWorkbookSheet(ss);

    const now       = new Date();
    const timestamp = _formatKoreanTimestamp(now, Session.getScriptTimeZone());

    sheet.appendRow([timestamp, name, phone, plan]);

    _sendWorkbookAdminEmail(name, phone, plan, timestamp);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function _sendWorkbookAdminEmail(name, phone, plan, timestamp) {
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${YTPLANNER_SHEET_ID}/edit`;
  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#f59e0b;color:#fff;padding:18px 22px;margin:0;border-radius:8px 8px 0 0;">
    📺 유튜브 워크북 리드 — ${_escapeHtml(name)} (${_escapeHtml(phone)})
  </h2>
  <div style="background:#f8fafc;padding:22px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 14px;font-size:13px;color:#64748b;">${timestamp}</p>
    <pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.7;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0 0 16px;">${_escapeHtml(plan)}</pre>
    <p style="margin:0;font-size:12px;color:#94a3b8;">
      <a href="${sheetUrl}">스프레드시트에서 전체 목록 확인 →</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to:       ADMIN_EMAIL,
    subject:  `[SMAC EDU 유튜브 워크북 리드] ${name}님 (${phone}) 신청`,
    htmlBody: html
  });
}
