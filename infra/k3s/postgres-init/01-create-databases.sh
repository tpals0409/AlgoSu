#!/bin/bash
# ============================================================
# AlgoSu PostgreSQL 초기화 스크립트 (1/2)
# Database per Service 원칙: 물리 프로세스 1개, 논리 DB 4개
# 보안: 서비스별 전용 사용자, 비밀번호는 k3s Secret에서 환경변수 주입
# ============================================================
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- 서비스별 사용자 생성 (비밀번호: Secret → 환경변수)
    CREATE USER identity_user   WITH PASSWORD '${PG_IDENTITY_PASSWORD}';
    CREATE USER problem_user    WITH PASSWORD '${PG_PROBLEM_PASSWORD}';
    CREATE USER submission_user WITH PASSWORD '${PG_SUBMISSION_PASSWORD}';
    CREATE USER analysis_user   WITH PASSWORD '${PG_ANALYSIS_PASSWORD}';

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
EOSQL
