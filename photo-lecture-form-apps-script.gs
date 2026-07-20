// 사진특강 "신규 신청서"(구글폼) 전용 처리 스크립트
// — 기존 photo-lecture-apps-script.gs와는 별개의 새 프로젝트입니다.
//   (기존 프로젝트는 트리거 추가 시 "차단된 앱" 문제가 있어 새로 분리했습니다.)
//
// 대상 폼: https://forms.gle/iR8R9gSycL1qB8Rk7
// 응답 시트: https://docs.google.com/spreadsheets/d/1qOHgGH9PvLS5X0bghrOLvdfnacSxKGv6OXjY1l4l4Pg/edit
// (기존 "사진 강의 신청서"와 동일한 질문 문구를 재사용한 폼이라, 아래 FIELD_* 상수도 그 문구 그대로 맞췄습니다.)
//
// 사용 방법:
// 1. 위 응답 스프레드시트 열기 → 확장 프로그램 → Apps Script
// 2. 기본 코드 지우고 이 파일 내용 전체 붙여넣기 → 저장(Ctrl+S)
// 3. 왼쪽 "트리거"(시계 아이콘) → 트리거 추가
//    → 실행할 함수: onFormSubmit / 이벤트 소스: 스프레드시트에서 / 이벤트 유형: 양식 제출 시 → 저장
//    → 구글 계정 권한 승인 창이 뜨면 승인
//    ⚠️ 이 프로젝트는 새로 만드는 것이라 "Google에서 확인하지 않은 앱"(차단 아님, 경고) 화면이 뜰 수 있습니다.
//       그 경우 "고급" → "(프로젝트명)으로 이동(안전하지 않음)" 링크를 누르면 진행됩니다.
//       만약 "This app is blocked"이고 "고급" 링크 자체가 안 보인다면 예전과 같은 GCP 기본 프로젝트
//       문제이니 바로 알려주세요 — 그때는 별도 조치가 필요합니다.
// 4. 폼을 실제로 한 번 테스트 제출해서 확인 메일이 오는지 확인하세요.

// 사용자 입력값을 이메일 HTML 본문에 넣기 전 이스케이프 (HTML/링크 삽입 방지)
function escapeHtml(str) {
  return String(str === null || str === undefined ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ADMIN_EMAIL         = 'elanvital7@naver.com';
const PHOTO_MATERIALS_URL = 'https://drive.google.com/drive/folders/1DWd2knB3-oH2SxnyseGhkqykuduF-DzI?usp=sharing';

// 구글폼 질문 제목과 정확히 일치해야 값을 읽어옵니다 (응답 시트 헤더에서 그대로 복사함).
const FIELD_NAME  = '이름';
const FIELD_EMAIL = '이메일 @포함한 정확한 이메일을 작성해 주세요.';
const FIELD_PHONE = '전화번호  (010-1234-5678 형식으로 - 포함하여 입력해 주세요.)';

function onFormSubmit(e) {
  try {
    const values = (e && e.namedValues) || {};
    const name  = (values[FIELD_NAME]  || [''])[0] || '';
    const email = (values[FIELD_EMAIL] || [''])[0] || '';
    const phone = (values[FIELD_PHONE] || [''])[0] || '';

    if (email) _sendConfirmEmail(name, email);

    const sheet = e.range.getSheet();
    const total = sheet.getLastRow() - 1; // 헤더 행 제외
    if (total % 10 === 0) _sendAdminDigest(sheet, total, name, email, phone);
  } catch (err) {
    console.error('onFormSubmit 오류: ' + err.message);
  }
}

function _sendConfirmEmail(name, email) {
  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:32px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:24px;font-weight:900;">신청이 완료됐습니다! 📸</h1>
    <p style="color:rgba(255,255,255,0.85);margin:10px 0 0;font-size:15px;">찍는 순간 작품이 되는 스마트폰 사진 — 촬영과 보정부터 AI 활용까지</p>
  </div>
  <div style="background:#f8fafc;padding:28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 16px;font-size:16px;"><strong>${escapeHtml(name)}</strong>님, 반갑습니다!</p>
    <p style="margin:0 0 20px;color:#475569;line-height:1.7;">
      특강 신청이 정상적으로 접수됐어요.<br>
      참여 ZOOM 링크는 특강 당일인 7월 17일(금) 저녁 6시까지 이 메일로 다시 안내드리겠습니다.
    </p>

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:18px 18px 8px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#c2410c;text-align:center;">🎁 늘 함께해주셔서 감사합니다</p>
      <p style="margin:0 0 14px;font-size:13px;color:#7c2d12;text-align:center;">신청해 주신 분께 <strong style="color:#c2410c;font-weight:800;">유료급</strong> 실전 자료 6종을 함께 보내드려요</p>
      <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 6px;">
        <tr>
          <td style="background:#fffaf5;border-left:5px solid #1e3a5f;border-radius:0 6px 6px 0;padding:9px 12px;">
            <span style="font-family:Georgia,'Nanum Myeongjo',serif;font-size:13px;font-weight:700;color:#292524;">적은 예산으로 큰 효과를 내는 마케팅 전략</span>
          </td>
        </tr>
        <tr>
          <td style="background:#fffaf5;border-left:5px solid #16a34a;border-radius:0 6px 6px 0;padding:9px 12px;">
            <span style="font-family:Georgia,'Nanum Myeongjo',serif;font-size:13px;font-weight:700;color:#292524;">챗GPT로 돈 버는 현실적인 10가지 방법</span>
          </td>
        </tr>
        <tr>
          <td style="background:#fffaf5;border-left:5px solid #dc2626;border-radius:0 6px 6px 0;padding:9px 12px;">
            <span style="font-family:Georgia,'Nanum Myeongjo',serif;font-size:13px;font-weight:700;color:#292524;">영상 하나로 알고리즘 타는 유튜브 전략</span>
          </td>
        </tr>
        <tr>
          <td style="background:#fffaf5;border-left:5px solid #ca8a04;border-radius:0 6px 6px 0;padding:9px 12px;">
            <span style="font-family:Georgia,'Nanum Myeongjo',serif;font-size:13px;font-weight:700;color:#292524;">퇴사 전에 반드시 준비해야 할 7가지</span>
          </td>
        </tr>
        <tr>
          <td style="background:#fffaf5;border-left:5px solid #2563eb;border-radius:0 6px 6px 0;padding:9px 12px;">
            <span style="font-family:Georgia,'Nanum Myeongjo',serif;font-size:13px;font-weight:700;color:#292524;">윈도우 필수 단축키 2026</span>
          </td>
        </tr>
        <tr>
          <td style="background:#fffaf5;border-left:5px solid #1e3a8a;border-radius:0 6px 6px 0;padding:9px 12px;">
            <span style="font-family:Georgia,'Nanum Myeongjo',serif;font-size:13px;font-weight:700;color:#292524;">팔지 않아도 고객이 찾아오는 SNS 마케팅</span>
          </td>
        </tr>
      </table>
      <div style="text-align:center;margin:14px 0 0;">
        <a href="${PHOTO_MATERIALS_URL}" style="display:inline-block;background:linear-gradient(135deg,#f97316,#fbbf24);color:#fff;text-decoration:none;font-size:14px;font-weight:800;padding:12px 30px;border-radius:999px;">🎁 자료 받으러 가기</a>
      </div>
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

    <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">
      문의는 <a href="mailto:${ADMIN_EMAIL}" style="color:#f59e0b;">${ADMIN_EMAIL}</a>로 보내주세요.
    </p>
    <p style="margin:0;font-size:12px;color:#b8c0cc;">
      더 이상 안내 메일을 받고 싶지 않으시면 이 메일에 회신해 "수신거부"라고 남겨주세요.
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to:       email,
    subject:  '[SMAC EDU] 스마트폰 사진특강 신청 완료 — ZOOM 링크는 특강 당일 안내드립니다',
    htmlBody: html
  });
}

// 신청 10명마다 한 번씩, 최근 제출 1건 정보를 관리자에게 알려줍니다.
function _sendAdminDigest(sheet, total, name, email, phone) {
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheet.getParent().getId()}/edit#gid=${sheet.getSheetId()}`;

  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <h2 style="background:#1e3a5f;color:#fff;padding:18px 22px;margin:0;border-radius:8px 8px 0 0;">
    📸 사진특강 신청서 누적 ${total}명
  </h2>
  <div style="background:#f8fafc;padding:22px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:7px 0;color:#64748b;width:70px;">이름</td><td><strong>${escapeHtml(name)}</strong></td></tr>
      <tr><td style="padding:7px 0;color:#64748b;">이메일</td><td>${escapeHtml(email)}</td></tr>
      <tr><td style="padding:7px 0;color:#64748b;">연락처</td><td>${escapeHtml(phone || '미입력')}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
      <a href="${sheetUrl}">스프레드시트에서 전체 목록 확인 →</a>
    </p>
  </div>
</div>`;

  MailApp.sendEmail({
    to:       ADMIN_EMAIL,
    subject:  `[SMAC EDU 사진특강] 신청서 누적 ${total}명`,
    htmlBody: html
  });
}
