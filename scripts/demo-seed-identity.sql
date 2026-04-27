-- =========================================================================
-- AlgoSu Demo Seed Data — identity_db
-- =========================================================================
-- @file demo-seed-identity.sql
-- @domain infra
-- @layer seed
-- @related demo-seed-problem.sql, demo-seed-submission.sql, infra/k3s/demo-reset-cronjob.yaml
--
-- 목적: 데모 환경 identity_db 시드 (users, studies, study_members)
-- 대상 DB: identity_db (postgres.algosu.svc.cluster.local)
-- 실행: psql -U algosu_admin -d identity_db -f demo-seed-identity.sql
-- 멱등성: DELETE → INSERT 패턴으로 반복 실행 안전
-- =========================================================================

-- 고정 UUID 목록
-- 유저:       00000000-0000-4000-a000-000000000001 ~ 003
-- 스터디:     00000000-0000-4000-a000-000000000010
-- 멤버:       00000000-0000-4000-a000-000000000021 ~ 023
-- 문제:       00000000-0000-4000-a000-000000000101 ~ 106
-- 제출:       00000000-0000-4000-a000-000000000201 ~ 20f
-- publicId:   00000000-0000-4000-b000-XXXXXXXXXXXX (별도 네임스페이스)

BEGIN;

-- ---------- users ----------
DELETE FROM study_members WHERE study_id = '00000000-0000-4000-a000-000000000010';
DELETE FROM studies WHERE id = '00000000-0000-4000-a000-000000000010';
DELETE FROM users WHERE id IN (
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000002',
  '00000000-0000-4000-a000-000000000003'
);

INSERT INTO users (id, email, name, avatar_url, oauth_provider, github_connected, github_user_id, github_username, github_token, "publicId", profile_slug, is_profile_public, created_at, updated_at, deleted_at)
VALUES
  ('00000000-0000-4000-a000-000000000001', 'demo@algosu.kr',  '김알고', 'preset:tree',     'google', false, NULL, NULL, NULL, '00000000-0000-4000-b000-000000000001', 'kim-algo',   true,  '2026-03-01 09:00:00+09', '2026-03-15 18:00:00+09', NULL),
  ('00000000-0000-4000-a000-000000000002', 'demo2@algosu.kr', '이코딩', 'preset:graph',    'naver',  false, NULL, NULL, NULL, '00000000-0000-4000-b000-000000000002', 'lee-coding',  true,  '2026-03-01 09:05:00+09', '2026-03-15 17:00:00+09', NULL),
  ('00000000-0000-4000-a000-000000000003', 'demo3@algosu.kr', '박수학', 'preset:sort',     'kakao',  false, NULL, NULL, NULL, '00000000-0000-4000-b000-000000000003', 'park-suhak', true,  '2026-03-01 09:10:00+09', '2026-03-14 20:00:00+09', NULL);

-- ---------- studies ----------
INSERT INTO studies (id, name, description, created_by, github_repo, status, "groundRules", avatar_url, "publicId", created_at, updated_at)
VALUES (
  '00000000-0000-4000-a000-000000000010',
  '알고리즘 마스터즈',
  '매주 알고리즘 문제를 함께 풀고 코드리뷰하는 스터디입니다.',
  '00000000-0000-4000-a000-000000000001',
  NULL,
  'ACTIVE',
  E'매주 3문제 풀기\n코드리뷰 필수',
  'preset:study-default',
  '00000000-0000-4000-b000-000000000010',
  '2026-03-01 10:00:00+09',
  '2026-03-15 10:00:00+09'
);

-- ---------- study_members ----------
INSERT INTO study_members (id, study_id, user_id, role, nickname, joined_at)
VALUES
  ('00000000-0000-4000-a000-000000000021', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000001', 'ADMIN',  '김알고', '2026-03-01 10:00:00+09'),
  ('00000000-0000-4000-a000-000000000022', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000002', 'MEMBER', '이코딩', '2026-03-01 10:30:00+09'),
  ('00000000-0000-4000-a000-000000000023', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000003', 'MEMBER', '박수학', '2026-03-01 11:00:00+09');

COMMIT;
