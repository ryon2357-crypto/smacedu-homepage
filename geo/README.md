# geo/ — 강사별 개인 AI GEO 프로필 페이지

[[reference_143ai_geo_chatbot_case]]를 참고해 만든 개인 GEO(생성형 검색엔진 노출) 프로필 페이지를
smacedu.kr 밑에서 강사별로 찍어내는 파이프라인. `smacedu.kr/geo/{slug}` 로 배포된다.

## 신청서 (강사가 직접 입력)

강사 본인이 채워서 보내는 신청서: [AI GEO 프로필 신청서](https://docs.google.com/forms/d/e/1FAIpQLSf973WAcLKNvrBbegPItT-mtLthSMkZn4sN2uRmugxS4b08ww/viewform)
(폼 편집: `https://docs.google.com/forms/d/1ziRTZIddJY86ocAFJxbSXG_OmBHVUNpVXDO6W0Ri7F4/edit`,
생성 스크립트는 `claude-code/setup_geo_profile_form.py` — 문항 구조를 바꿀 땐 이 스크립트를 고치고 재실행하지 말고
편집 화면에서 직접 수정할 것, 재실행하면 새 폼이 또 생긴다.)

응답은 아직 자동으로 JSON이 되지 않는다 — `google_forms.list_responses(form_id)`로 읽어서 아래 1번 JSON을
사람이 채우거나 다듬어야 한다. 신청서 문항과 JSON 필드 매핑:

| 신청서 문항 | JSON 필드 |
|---|---|
| 성함 / 활동명 | `name` / `alt_name`, `display_name` |
| 이메일 | `email`, `contact_label` |
| 한 줄 소개·직함 | `role`, `og_title`, `eyebrow` |
| 소속 | `org`, `org_name` |
| 자기소개 | `intro`, FAQ "~는 누구인가요?" |
| 핵심 경력·숫자 | `stats[]` (`value`/`label`로 쪼개기) |
| 자격증·학력 / 강의 이력 / 수상 경력 | 각각 FAQ 항목으로 |
| 프로필 사진 링크 | `og_image` (직접 호스팅 필요 — 드라이브 링크를 그대로 쓰면 안 뜬다, 이미지 파일을 내려받아 저장소에 올릴 것) |
| 홍보 링크 | `links[]` |

결제 방법 문항은 확인용이고 아직 실제 결제 수납(계좌이체 수동 확인 or PG)은 미연동 —
[[project_geo_profile_subscription_idea]] 참고.

## 새 강사 페이지 만들기

1. `geo/data/{slug}.json`을 새로 만든다. 기존 `geo/data/elanvital.json`을 복사해서 필드를 채우면 된다.
   - `faq[].a_html`은 방문자가 실제로 보는 HTML(볼드·리스트 가능), `faq[].a_text`는 생략 가능(비우면
     `a_html`에서 태그만 제거해 FAQPage 스키마용 텍스트를 자동 생성).
   - `links[]`는 `{label, href, primary?, external?}`. `primary` 하나만 강조 버튼(클레이색), 나머진 보조 버튼.
2. 생성만: `python geo/_template/generate.py {slug}`
3. 생성+배포(commit+push까지): `python geo/_template/generate.py {slug} --push`
   - smacedu-homepage는 `git push origin main`이 곧 배포다([[project_smacedu_homepage_deploy]]).
   - `--push`는 방금 생성한 `geo/{slug}/index.html`만 add한다 — 이 저장소는 여러 세션이 동시에 건드려서
     미관련 변경(M 표시)이 항상 좀 있다. 절대 `git add -A`로 쓸어담지 말 것.
4. 새 slug를 만들면 `sitemap.xml`에도 `<url><loc>https://www.smacedu.kr/geo/{slug}</loc>...</url>`를
   손으로 한 줄 추가한다(자동화 안 돼 있음 — 페이지 수가 늘면 스크립트화 고려).

## 구조

- `geo/_template/template.html` — `string.Template`용 `$PLACEHOLDER` 치환 템플릿. 크림+클레이 팔레트,
  다크모드 없음([[feedback_light_claude_palette_no_dark_bg]]).
- `geo/_template/generate.py` — JSON → HTML 렌더링 + Person/FAQPage JSON-LD 자동 생성 + 선택적 push.
- `geo/data/{slug}.json` — 강사별 데이터. 여기가 유일한 편집 지점(HTML을 직접 고치지 않는다).
- `geo/{slug}/index.html` — 생성된 결과물(커밋 대상). 직접 수정하지 말고 항상 JSON을 고친 뒤 재생성한다.

## 전제

루트 `robots.txt`에 AI 크롤러(GPTBot·ClaudeBot·PerplexityBot 등)를 명시적으로 허용해 뒀다 —
[[project_geo_profile_subscription_idea]] 사업 아이디어(강사반 수강생 대상 월 1만원 구독)의 기술 기반.
