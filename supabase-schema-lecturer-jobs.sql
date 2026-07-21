-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 평생교육/공공기관 강사모집 공지 게시판용 테이블
-- Supabase SQL Editor에서 실행하세요 (supabase-schema.sql과 별개로, 이것만 추가 실행하면 됨)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.lecturer_jobs (
  id           bigint generated always as identity primary key,
  title        text not null,
  url          text unique not null,
  institution  text,
  category     text,        -- 사진/영상/AI/컴퓨터/외국어/공예/음악/체육/요리/육아/인문교양/기타
  keyword      text,        -- 어떤 검색어로 찾았는지
  deadline     date,        -- 접수 마감일 (원문에서 자동 추출, 못 찾으면 null)
  collected_at timestamptz  default now(),
  status       text         default 'active' check (status in ('active', 'expired', 'removed'))
);

create index if not exists lecturer_jobs_deadline_idx on public.lecturer_jobs (deadline);
create index if not exists lecturer_jobs_status_idx on public.lecturer_jobs (status);

-- Row Level Security 활성화
alter table public.lecturer_jobs enable row level security;

-- 누구나 조회 가능 (공개 게시판)
create policy "누구나 조회 가능"
  on public.lecturer_jobs for select
  using (true);

-- 쓰기는 service_role(크롤러 스크립트)만 — 별도 정책 없음 = anon/authenticated는 insert/update/delete 불가
