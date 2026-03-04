#!/bin/bash
# ============================================================
# AlgoSu PostgreSQL 초기화 스크립트 (2/2)
# 최소 권한 부여, 크로스 접근 명시적 차단
# ============================================================
set -euo pipefail

# identity_db: identity_user 전용
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "identity_db" <<-EOSQL
    REVOKE ALL ON SCHEMA public FROM PUBLIC;
    GRANT ALL ON SCHEMA public TO identity_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO identity_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO identity_user;
EOSQL

# problem_db: problem_user 전용
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "problem_db" <<-EOSQL
    REVOKE ALL ON SCHEMA public FROM PUBLIC;
    GRANT ALL ON SCHEMA public TO problem_user;
EOSQL

# submission_db: submission_user 전용
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "submission_db" <<-EOSQL
    REVOKE ALL ON SCHEMA public FROM PUBLIC;
    GRANT ALL ON SCHEMA public TO submission_user;
EOSQL

# analysis_db: analysis_user 전용
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "analysis_db" <<-EOSQL
    REVOKE ALL ON SCHEMA public FROM PUBLIC;
    GRANT ALL ON SCHEMA public TO analysis_user;
EOSQL
