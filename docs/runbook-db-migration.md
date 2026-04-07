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

## 참고

- `statement_timeout` 설정 위치: `infra/k3s/postgres.yaml` args 라인 31-32
- `statement_timeout` 설정 위치: `infra/k3s/postgres-problem.yaml` args 라인 31-32
- 세션 레벨 SET은 해당 연결에만 적용되며 다른 클라이언트에 영향 없음
