-- ============================================================
-- AlgoSu PostgreSQL 초기화 스크립트 (2/2)
-- 최소 권한 부여, 크로스 접근 명시적 차단
-- ============================================================

-- identity_db: identity_user 전용
-- 테이블: profiles, studies, study_members, study_invites, users
\connect identity_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO identity_user;

-- 신규 테이블에 대한 명시적 권한 부여 (마이그레이션 실행 후 적용)
-- studies, study_members, study_invites, users 테이블은
-- identity_user가 schema owner이므로 자동 권한 보유
-- 아래는 향후 read-only 사용자 추가 시 참조용 명시적 선언
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO identity_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO identity_user;

-- problem_db: problem_user 전용
\connect problem_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO problem_user;

-- submission_db: submission_user 전용
\connect submission_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO submission_user;

-- analysis_db: analysis_user 전용
\connect analysis_db
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO analysis_user;
