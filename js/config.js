// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Supabase 계정 생성 후 아래 값을 교체하세요
// Project Settings → API 에서 확인 가능
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SUPABASE_URL      = 'YOUR_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 토스페이먼츠 클라이언트 키
// 테스트: test_ck_... / 라이브: live_ck_...
// 심사 완료 후 라이브 키로 교체하세요
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const TOSS_CLIENT_KEY = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eo0'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 상품 정보 — 가격 결정 후 수정하세요
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const PRODUCT = {
  id:    'nikon-school-replay',
  name:  '니콘 스쿨 온라인 강의 다시 보기',
  price: 29000  // 원 (예: 29000 = 29,000원)
}
