-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Supabase SQL Editor에서 실행하세요
-- (supabase.com → 프로젝트 → SQL Editor → New query)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 구매 내역 테이블
create table if not exists public.purchases (
  id          uuid      default gen_random_uuid() primary key,
  user_id     uuid      references auth.users(id) on delete cascade not null,
  product_id  text      not null,
  order_id    text      unique not null,
  payment_key text,
  amount      integer   not null,
  status      text      default 'pending'
                        check (status in ('pending', 'done', 'canceled', 'failed')),
  created_at  timestamptz default now()
);

-- Row Level Security 활성화
alter table public.purchases enable row level security;

-- 본인 구매 내역만 조회 가능
create policy "사용자는 본인 구매 내역만 조회"
  on public.purchases for select
  using (auth.uid() = user_id);

-- 서비스 롤(서버)만 삽입 가능 (RLS 우회)
-- api/payment-confirm.js 에서 service_role 키를 사용하므로 별도 정책 불필요
