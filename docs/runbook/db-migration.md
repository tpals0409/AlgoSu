# DB 마이그레이션 런북

## 배경

AlgoSu PostgreSQL 인스턴스들은 `statement_timeout=200`(200ms)으로 설정되어 있다.
일반 쿼리 보호에 유효하지만, 스키마 마이그레이션(ALTER TABLE, CREATE INDEX 등)은
200ms를 초과할 수 있어 timeout 오류가 발생한다.

**대상 인스턴스:**
- `postgres` (identity_db, submission_db) — `infra/k3s/postgres.yaml`
- `postgres-problem` (problem_db) — `infra/k3s/postgres-problem.yaml`

## 사전 준비

1. 마이그레이션 SQL을 사전 검토하고 예상 소요 시간을 파악한다.
2. 트래픽이 적은 시간대(심야)에 실행한다.
3. DB 백업을 수행한다:
   ```bash
   kubectl exec -n algosu pod/postgres-<hash> -- \
     pg_dump -U algosu_admin -d <db_name> > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

## 절차

### 1단계: statement_timeout 비활성화

마이그레이션 세션에서만 timeout을 해제한다. Pod 전체 설정은 변경하지 않는다.

```bash
# postgres Pod에 접속
kubectl exec -it -n algosu pod/postgres-<hash> -- \
  psql -U algosu_admin -d <db_name>

# 세션 레벨 timeout 해제
SET statement_timeout = 0;

# 확인
SHOW statement_timeout;
-- 0 이어야 함
```

> **주의**: `ALTER SYSTEM`이나 Pod args 변경은 하지 않는다. 세션 레벨로만 해제한다.

### 2단계: 마이그레이션 실행

같은 psql 세션에서 마이그레이션 SQL을 실행한다:

```sql
-- 예시: 컬럼 추가
BEGIN;
ALTER TABLE submissions ADD COLUMN new_col VARCHAR(255);
COMMIT;
```

대용량 테이블의 인덱스 생성은 `CONCURRENTLY` 옵션을 사용한다:

```sql
CREATE INDEX CONCURRENTLY idx_new_col ON submissions (new_col);
```

> `CREATE INDEX CONCURRENTLY`는 트랜잭션 블록 내에서 실행할 수 없다.

### 3단계: 복원 확인

마이그레이션 완료 후 psql 세션을 종료하면 세션 레벨 설정은 자동으로 사라진다.
Pod의 `statement_timeout=200`은 그대로 유지된다.

```bash
# 새 세션에서 timeout이 정상인지 확인
kubectl exec -n algosu pod/postgres-<hash> -- \
  psql -U algosu_admin -d <db_name> -c "SHOW statement_timeout;"
-- 200ms 이어야 함
```

### 4단계: 서비스 정상 확인

```bash
# Pod 상태 확인
kubectl get pods -n algosu | grep postgres

# 애플리케이션 health check
curl -s http://localhost:3000/health/ready
```

## 롤백

마이그레이션 실패 시:

1. `ROLLBACK;`으로 트랜잭션을 취소한다.
2. psql 세션을 종료한다 (timeout 자동 복원).
3. 필요 시 백업에서 복원:
   ```bash
   kubectl exec -i -n algosu pod/postgres-<hash> -- \
     psql -U algosu_admin -d <db_name> < backup_YYYYMMDD_HHMMSS.sql
   ```

## Dual-Write 활성 시 신 DB 마이그레이션 절차

> **현재 상태**: `DUAL_WRITE_MODE=off` (2026-05-22 기준) — 신 DB가 구 DB와 동일 인스턴스이므로
> 아래 절차는 향후 DUAL_WRITE_MODE=EXPAND 또는 SWITCH_READ 전환 시 적용한다.

### 배경

`DualWriteService`는 구 DB(`problem_db`)와 신 DB(`NEW_DATABASE_*`)에 이중 쓰기를 수행한다.
TypeORM 마이그레이션은 기본적으로 **구 DB(data-source.ts의 기본 연결)에만 적용**된다.
Dual-Write가 활성화된 경우, 신 DB 스키마가 구 DB와 달라지면 쓰기 실패가 발생한다.

### 절차

1. **마이그레이션 파일 적용 대상 확인**

   ```bash
   # 구 DB 최신 마이그레이션 확인
   kubectl exec -n algosu pod/postgres-problem-<hash> -- \
     psql -U problem_user -d problem_db -c \
     "SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 5;"
   ```

2. **신 DB에 동일 마이그레이션 적용**

   신 DB는 별도 `NEW_DATABASE_*` 환경변수로 접속한다:

   ```bash
   # 신 DB 접속 (NEW_DATABASE_HOST, NEW_DATABASE_PORT 참조)
   kubectl exec -it -n algosu pod/postgres-problem-<new-hash> -- \
     psql -U problem_user -d new_problem_db

   # statement_timeout 해제 (ALTER TYPE 등 rewrite 유발 마이그레이션 대비)
   SET statement_timeout = 0;

   # 마이그레이션 SQL 적용 (dist/ 빌드 후 수동 실행 또는 data-source override)
   \i /tmp/migration.sql
   ```

3. **schema 정합성 검증**

   ```sql
   -- 양쪽 DB의 컬럼 타입 비교
   SELECT column_name, data_type, udt_name
   FROM information_schema.columns
   WHERE table_name = 'problems'
   ORDER BY ordinal_position;
   ```

4. **DualWriteService 쓰기 정합성 확인**

   ```bash
   # algosu_problem_dual_write_total{result="failure"} 메트릭 확인
   kubectl exec -n algosu pod/problem-service-<hash> -- \
     curl -s http://localhost:3002/metrics | grep dual_write_total
   ```

### 주의사항

- GIN 인덱스(`CREATE INDEX CONCURRENTLY`)는 신 DB에서도 CONCURRENTLY 적용
- `DUAL_WRITE_MODE` 전환 전 양쪽 DB 스키마 정합성 검증 필수
- 신 DB 마이그레이션 실패 시 DUAL_WRITE_MODE를 OFF로 유지하고 조사 후 재시도

## 참고

- `statement_timeout` 설정 위치: `infra/k3s/postgres.yaml` args 라인 31-32
- `statement_timeout` 설정 위치: `infra/k3s/postgres-problem.yaml` args 라인 31-32
- 세션 레벨 SET은 해당 연결에만 적용되며 다른 클라이언트에 영향 없음

## 서비스별 컷오버 런북

- **SP217 퀴즈 기록**(`identity_db` `quiz_records`): [`sp217-quiz-records-cutover.md`](./sp217-quiz-records-cutover.md) — `db-migrate` initContainer 자동 마이그레이션(재배포=마이그레이션) + gateway/frontend 롤아웃 + 라이브 `/quiz` E2E 체크리스트. 신규 빈 테이블이라 `statement_timeout` 무관(본 런북의 timeout 해제 절차 불필요).
