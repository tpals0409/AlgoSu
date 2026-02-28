-- ============================================================
-- AlgoSu PostgreSQL 초기화 스크립트 (1/2)
-- Database per Service 원칙: 물리 프로세스 1개, 논리 DB 4개
-- 보안: 서비스별 전용 사용자, 크로스 접근 완전 차단
-- ============================================================

-- 서비스별 사용자 생성 (비밀번호는 k3s Secret에서 주입)
CREATE USER identity_user   WITH PASSWORD 'identity_dev_password';
CREATE USER problem_user    WITH PASSWORD 'problem_dev_password';
CREATE USER submission_user WITH PASSWORD 'submission_dev_password';
CREATE USER analysis_user   WITH PASSWORD 'analysis_dev_password';

-- 서비스별 전용 데이터베이스 생성
CREATE DATABASE identity_db   OWNER identity_user;
CREATE DATABASE problem_db    OWNER problem_user;
CREATE DATABASE submission_db OWNER submission_user;
CREATE DATABASE analysis_db   OWNER analysis_user;

-- PUBLIC 접근 완전 차단 (Database per Service 격리)
REVOKE ALL ON DATABASE identity_db   FROM PUBLIC;
REVOKE ALL ON DATABASE problem_db    FROM PUBLIC;
REVOKE ALL ON DATABASE submission_db FROM PUBLIC;
REVOKE ALL ON DATABASE analysis_db   FROM PUBLIC;
