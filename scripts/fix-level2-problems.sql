-- ============================================================
-- fix-level2-problems.sql
-- Sprint 53 작업 1-4: level=2 버그 데이터 수정
-- ============================================================
-- 배경:
--   AddProblemModal의 이전 버그로 인해 일부 문제의 level이
--   실제 난이도와 무관하게 2(Bronze IV)로 잘못 저장됨.
--   level 컬럼은 solved.ac rawLevel(1~30)을 저장하며,
--   difficulty enum은 별도 컬럼으로 관리됨.
--
-- 난이도 체계 (solved.ac rawLevel → 등급):
--   1~5: BRONZE (V~I)    |  16~20: PLATINUM (V~I)
--   6~10: SILVER (V~I)   |  21~25: DIAMOND (V~I) [DB: 25~28]
--   11~15: GOLD (V~I)    |  26~30: RUBY (V~I)    [DB: 29~30]
--
-- 실행 방법:
--   kubectl exec -n algosu pod/postgres-problem-<hash> -- \
--     psql -U problem_user -d problem_db -f /tmp/fix-level2-problems.sql
--
--   또는 로컬에서 단계별 실행:
--     1단계: 조회 (SELECT만) — 영향 범위 확인
--     2단계: 수정 (UPDATE) — 트랜잭션 내 실행
--     3단계: 검증 (SELECT) — 수정 결과 확인
-- ============================================================

-- ============================
-- 1단계: 조회 — 영향받는 문제 확인
-- ============================

-- 1-1. level=2인 전체 문제 목록
SELECT
  id,
  title,
  difficulty,
  level,
  source_url,
  status,
  week_number,
  created_at
FROM problems
WHERE level = 2
ORDER BY created_at;

-- 1-2. level=2이면서 difficulty가 BRONZE가 아닌 불일치 문제 (확실한 버그)
SELECT
  id,
  title,
  difficulty,
  level,
  source_url,
  status
FROM problems
WHERE level = 2
  AND difficulty != 'BRONZE'
ORDER BY created_at;

-- 1-3. 전체 level 분포 확인 (참고용)
SELECT
  level,
  difficulty,
  COUNT(*) AS cnt
FROM problems
WHERE status != 'DELETED'
GROUP BY level, difficulty
ORDER BY level, difficulty;

-- ============================
-- 2단계: 수정 — 트랜잭션 내 실행
-- ============================
-- 전략:
--   A) difficulty != BRONZE인데 level=2인 경우:
--      → difficulty에 맞는 최소 level로 수정 (해당 티어의 V 등급)
--   B) difficulty = BRONZE이고 level=2인 경우:
--      → 실제 Bronze IV일 수 있으므로 기본값 level=1(Bronze V)로 수정
--      → 정확한 난이도는 solved.ac API로 별도 검증 필요
--
-- 주의: 아래 UPDATE를 실행하기 전에 반드시 1단계 SELECT로 대상 확인!

BEGIN;

-- 2-A. difficulty와 level 불일치 수정 (확실한 버그 케이스)
-- difficulty enum에 맞는 tier 시작 level로 보정
UPDATE problems
SET
  level = CASE difficulty
    WHEN 'BRONZE'   THEN 1   -- Bronze V
    WHEN 'SILVER'   THEN 6   -- Silver V
    WHEN 'GOLD'     THEN 11  -- Gold V
    WHEN 'PLATINUM' THEN 16  -- Platinum V
    WHEN 'DIAMOND'  THEN 21  -- Diamond V
    WHEN 'RUBY'     THEN 26  -- Ruby V
  END,
  updated_at = NOW()
WHERE level = 2
  AND difficulty != 'BRONZE';

-- 2-B. difficulty=BRONZE이고 level=2인 경우 → level=1(Bronze V)로 수정
-- 이유: level=2가 버그로 인한 기본값이므로, Bronze V로 리셋 후
--       운영자가 필요 시 개별 수정하는 것이 안전
UPDATE problems
SET
  level = 1,
  updated_at = NOW()
WHERE level = 2
  AND difficulty = 'BRONZE';

COMMIT;

-- ============================
-- 3단계: 검증 — 수정 결과 확인
-- ============================

-- 3-1. level=2인 문제가 0건인지 확인
SELECT COUNT(*) AS remaining_level2
FROM problems
WHERE level = 2;

-- 3-2. 수정된 문제 목록 (updated_at 기준)
SELECT
  id,
  title,
  difficulty,
  level,
  source_url,
  status,
  updated_at
FROM problems
WHERE updated_at >= NOW() - INTERVAL '5 minutes'
  AND status != 'DELETED'
ORDER BY updated_at DESC;

-- ============================
-- 롤백 스크립트 (필요 시)
-- ============================
-- 수정 전에 백업 테이블을 만들어두면 안전합니다.
-- 아래 백업 → 복원 SQL을 2단계 실행 전에 먼저 수행하세요.

-- [백업] 2단계 실행 전에 실행:
-- CREATE TABLE problems_level2_backup AS
-- SELECT id, title, difficulty, level, updated_at
-- FROM problems
-- WHERE level = 2;

-- [복원] 롤백이 필요한 경우:
-- UPDATE problems p
-- SET
--   level = b.level,
--   updated_at = b.updated_at
-- FROM problems_level2_backup b
-- WHERE p.id = b.id;

-- [정리] 복원 완료 후:
-- DROP TABLE IF EXISTS problems_level2_backup;
