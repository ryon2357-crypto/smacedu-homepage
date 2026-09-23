-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Supabase SQL Editor에서 실행하세요
-- (supabase.com → 프로젝트 → SQL Editor → New query)
-- 강사 등록(인력풀) — instructor-apply.html 제출을 저장하고
-- admin.html "강사풀" 탭에서 조회합니다.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create table if not exists public.instructor_applications (
  id               uuid        default gen_random_uuid() primary key,
  name             text        not null,
  phone            text        not null,
  email            text,
  specialties      text[]      default '{}',
  specialty_other  text,
  region           text,
  certifications   text,
  career           jsonb       default '[]',
  intro            text,
  resume_file_path text,
  resume_file_name text,
  status           text        default 'new'
                               check (status in ('new', 'contacted', 'active', 'inactive')),
  memo             text,
  created_at       timestamptz default now()
);

alter table public.instructor_applications enable row level security;

-- 누구나(anon key) 등록 제출(INSERT)은 가능 — 공개 등록 폼이므로
create policy "누구나 강사 등록 제출 가능"
  on public.instructor_applications for insert
  with check (true);

-- 조회/수정/삭제 정책은 없음 → anon/authenticated는 불가.
-- api/instructor-applications.js 가 SUPABASE_SERVICE_KEY로 RLS를 우회해 조회·수정합니다.
-- (purchases/lecturer_jobs 테이블과 동일한 패턴 — 관리자 API만 service_role 사용)

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 이력서 파일 업로드용 Storage 버킷 (비공개)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
insert into storage.buckets (id, name, public)
values ('instructor-resumes', 'instructor-resumes', false)
on conflict (id) do nothing;

-- 누구나(anon) 이 버킷에 파일 업로드(INSERT)는 가능 — 등록 폼의 이력서 첨부용
create policy "누구나 이력서 업로드 가능"
  on storage.objects for insert
  with check (bucket_id = 'instructor-resumes');

-- 다운로드(SELECT)는 정책 없음 → anon 불가. 관리자 API가 service_role로
-- signed URL을 발급해야만 열람 가능합니다 (개인정보가 든 파일이므로 비공개 유지).
