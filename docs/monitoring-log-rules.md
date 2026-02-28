# AlgoSu 모니터링 로그 규칙

> Oracle(심판관) 확정 문서 | 2026-02-28
> Agent 상의 결과 종합: Architect, Gatekeeper, Conductor, Librarian

---

## 1. 구조화 로그 포맷

모든 서비스는 **JSON structured logging**을 사용한다. `console.log` 문자열 출력 금지.

### 1-1. 공통 필수 필드

```json
{
  "ts": "2026-02-28T12:00:00.000Z",
  "level": "info",
  "service": "gateway",
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "requestId": "a1b2c3d4-...",
  "message": "HTTP request completed",
  "pid": 12345,
  "env": "production",
  "version": "1.0.0"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `ts` | string | O | ISO 8601 UTC (밀리초 포함) |
| `level` | string | O | `error` / `warn` / `info` / `debug` |
| `service` | string | O | `gateway` / `identity` / `problem` / `submission` / `ai-analysis` / `github-worker` |
| `traceId` | string | O | 제출 추적 시 `submissionId` 재사용, 일반 요청 시 UUID 생성 |
| `requestId` | string | O | HTTP 요청당 UUID, `X-Request-ID` 헤더로 전파 |
| `message` | string | O | 사람이 읽을 수 있는 메시지 |
| `pid` | number | O | 프로세스 ID |
| `env` | string | O | `production` / `development` |
| `version` | string | - | 서비스 버전 |

### 1-2. HTTP 확장 필드

```json
{
  "method": "POST",
  "path": "/api/v1/submissions",
  "statusCode": 201,
  "latencyMs": 142,
  "userId": "550e8400-...",
  "ip": "192.168.1.**"
}
```

### 1-3. 에러 확장 필드

```json
{
  "error": {
    "name": "QueryFailedError",
    "message": "duplicate key value",
    "code": "SUB_INFRA_001",
    "stack": "(development 환경에서만)"
  }
}
```

### 1-4. traceId 규칙 (Conductor 확정)

- **제출 흐름**: `traceId = submissionId` (별도 생성하지 않음)
- **일반 HTTP**: Gateway에서 `X-Trace-Id` 헤더 생성, 하위 서비스로 전파
- **MQ 전파**: Message Body의 `submissionId` + AMQP Header `x-trace-id` 이중 기록

---

## 2. 로그 레벨 정책

### 2-1. 레벨별 사용 기준

| 레벨 | 사용 상황 | 예시 |
|------|----------|------|
| `error` | 서비스 정상 동작 불가, 데이터 손실, 처리 불가 예외 | DB 연결 실패, MQ nack 후 DLQ, Saga 보상 실패 |
| `warn` | 동작 계속되나 주의 필요, 일시적 실패, 재시도 | Circuit Breaker half-open, Redis fallback, 슬로우 쿼리, Rate Limit 초과 |
| `info` | 정상 비즈니스 이벤트, 상태 변화 | HTTP 완료, 로그인, Saga 전이, MQ 발행/소비 |
| `debug` | 개발/진단 목적 (프로덕션에서 출력 안 함) | SQL 쿼리, MQ 메시지 본문, 캐시 히트/미스 |

### 2-2. 환경별 기본 레벨

```
production:  INFO  (error + warn + info)
development: DEBUG (전체)
```

---

## 3. 민감 정보 마스킹 규칙 (Gatekeeper 확정)

### 3-1. 절대 로그 금지 목록

```
JWT 원문 (Authorization 헤더 값)
X-Internal-Key 헤더 값
OAuth access_token / refresh_token / authorization_code
OAuth state 값
JWT_SECRET / GOOGLE_CLIENT_SECRET / NAVER_CLIENT_SECRET / KAKAO_CLIENT_SECRET / GITHUB_CLIENT_SECRET
REDIS_URL (비밀번호 포함)
DB 연결 문자열 (비밀번호 포함)
사용자 이메일 원문
DB 쿼리 파라미터 원본값
```

### 3-2. 마스킹 처리

| 대상 | 방법 | 예시 |
|------|------|------|
| 이메일 | 앞 2자 + `**@domain` | `us**@example.com` |
| IP | 마지막 옥텟 마스킹 | `192.168.1.**` |
| 헤더 | `authorization`, `x-internal-key`, `cookie` → `[REDACTED]` | |
| 외부 API 응답 | response body 전체 `[RESPONSE_BODY_REDACTED]` | |

### 3-3. Log Injection 방지

```
- path, userAgent 등 사용자 입력값은 제어문자(\r \n \t \x00-\x1f) 제거 후 기록
- path 최대 500자, userAgent 최대 200자 truncate
- 문자열 concatenation 방식 금지 → 반드시 JSON 구조화 출력
```

---

## 4. 보안 이벤트 분류 (Gatekeeper 확정)

### 4-1. CRITICAL (즉시 알림 → Discord #emergency-alert)

| 이벤트 | 조건 |
|--------|------|
| `AUTH_BRUTE_FORCE` | 동일 IP, 5분 내 인증 실패 10회+ |
| `INTERNAL_KEY_BRUTE_FORCE` | 동일 IP, 5분 내 X-Internal-Key 불일치 5회+ |
| `RATE_LIMIT_REDIS_FAILOPEN` | Redis 장애로 Rate Limit 무력화 발생 즉시 |
| `INVALID_JWT_ALGORITHM` | `none` 알고리즘 또는 허용 외 알고리즘 토큰 수신 |
| `OAUTH_STATE_REUSE` | 이미 소비된 OAuth state 재사용 시도 |
| `SSE_IDOR_REPEATED` | 동일 IP, 타인 submissionId SSE 구독 3회+ |
| `DLQ_RECEIVED` | Dead Letter Queue 메시지 발생 즉시 |
| `CIRCUIT_BREAKER_OPEN` | ai-analysis Circuit Breaker OPEN 상태 |

### 4-2. WARNING (모니터링 대상)

```
AUTH_FAILURE, RATE_LIMIT_EXCEEDED, INTERNAL_KEY_MISSING,
INTERNAL_KEY_MISMATCH, INVALID_STUDY_ID, PROXY_ERROR,
SSE_REDIS_ERROR, REFRESH_TOKEN_INVALID, SLOW_QUERY,
POOL_CHECKOUT_TIMEOUT, SAGA_TIMEOUT
```

### 4-3. INFO (정상 감사)

```
AUTH_SUCCESS, OAUTH_CALLBACK, OAUTH_GITHUB_LINK,
TOKEN_REFRESH, SSE_CONNECT, SSE_DISCONNECT,
SAGA_TRANSITION, MQ_PUBLISH, MQ_CONSUME, MIGRATION_COMPLETE
```

---

## 5. Saga 로그 규칙 (Conductor 확정)

### 5-1. 상태 전이 로그

태그 접두어: `[SAGA_TRANSITION]`

```json
{
  "tag": "SAGA_TRANSITION",
  "traceId": "{submissionId}",
  "from": "DB_SAVED",
  "to": "GITHUB_QUEUED",
  "studyId": "{studyId}",
  "userId": "{userId}",
  "durationMs": 45,
  "service": "submission"
}
```

### 5-2. 보상 트랜잭션 로그

태그: `[SAGA_COMPENSATE]`

```json
{
  "tag": "SAGA_COMPENSATE",
  "traceId": "{submissionId}",
  "step": "GITHUB_QUEUED",
  "compensationType": "GITHUB_FAILED_CONTINUE",
  "reason": "TOKEN_INVALID",
  "errorCode": "GHW_BIZ_001",
  "action": "ADVANCE_TO_AI",
  "service": "submission"
}
```

### 5-3. 단계별 타임아웃

| SagaStep | 타임아웃 | 이유 |
|----------|---------|------|
| `DB_SAVED` | 5분 | MQ 발행 직후 전이 — 길면 MQ 장애 |
| `GITHUB_QUEUED` | 15분 | GitHub API 재시도 3회 포함 |
| `AI_QUEUED` | 30분 | AI 분석 소요 시간 |

타임아웃 초과 시 `[SAGA_TIMEOUT]` 태그로 error 레벨 기록.

---

## 6. MQ 메시지 로그 규칙 (Conductor 확정)

### 6-1. 발행 시

```json
{
  "tag": "MQ_PUBLISH",
  "traceId": "{submissionId}",
  "exchange": "submission.events",
  "routingKey": "submission.github_push",
  "sagaStep": "GITHUB_QUEUED",
  "messageSize": 256,
  "service": "submission"
}
```

AMQP 메시지 headers에 `x-trace-id`, `x-published-at` 포함.

### 6-2. 소비 시

```json
{
  "tag": "MQ_CONSUME",
  "traceId": "{submissionId}",
  "queue": "submission.github_push",
  "deliveryTag": 42,
  "redelivered": false,
  "messageAgeMs": 120,
  "service": "github-worker"
}
```

처리 완료 시 `MQ_CONSUME_DONE` + `result` (ACK / NACK_DLQ) + `durationMs`.

### 6-3. DLQ 모니터링

- DLQ 메시지 발생 즉시 `[DLQ_RECEIVED]` error 레벨 기록
- DLQ 누적 5건 이상 → Oracle → PM 보고
- DLQ 메시지는 ACK만 (자동 재처리 금지, 수동 개입 필요)

---

## 7. 에러 코드 체계 (Conductor 확정)

### 형식: `ALGOSU_{서비스}_{범주}_{번호}`

### 7-1. 비즈니스 에러 (재시도 불가)

| 코드 | 설명 |
|------|------|
| `SUB_BIZ_001` | GitHub 미연동 |
| `SUB_BIZ_002` | 멱등성 키 중복 |
| `SUB_BIZ_003` | 스터디 멤버 아님 |
| `SUB_BIZ_004` | 제출 없음 (404) |
| `SUB_BIZ_005` | IDOR — 타인 제출 접근 |
| `GHW_BIZ_001` | GitHub 토큰 만료/무효 |
| `GHW_BIZ_002` | 레포 미존재 |
| `GHW_BIZ_003` | MQ 메시지 studyId 누락 |
| `GHW_BIZ_004` | owner/repo 형식 오류 |

### 7-2. 인프라 에러 (재시도 가능)

| 코드 | 설명 |
|------|------|
| `SUB_INFRA_001` | DB 저장 실패 |
| `SUB_INFRA_002` | MQ 발행 실패 |
| `SUB_INFRA_003` | Gateway Internal API 불통 |
| `GHW_INFRA_001` | GitHub API Rate Limit (429) |
| `GHW_INFRA_002` | GitHub API 타임아웃 |
| `GHW_INFRA_003` | Submission 콜백 실패 |
| `GHW_INFRA_004` | Redis Pub/Sub 발행 실패 |

### 7-3. 공통 에러

| 코드 | 설명 |
|------|------|
| `MQ_001` | JSON 파싱 실패 → DLQ |
| `MQ_002` | 최대 재시도 초과 → DLQ |
| `MQ_003` | MQ 채널 미초기화 |
| `GWY_001` | X-Internal-Key 불일치 |
| `SSE_001` | Redis 구독 실패 |

---

## 8. DB 로그 규칙 (Librarian 확정)

### 8-1. 슬로우 쿼리

| 서비스 | ORM | 임계값 |
|--------|-----|--------|
| NestJS 4개 서비스 | TypeORM | **200ms** |
| ai-analysis | SQLAlchemy | **500ms** |

TypeORM 설정: `maxQueryExecutionTime: 200`

슬로우 쿼리 로그 필수 항목:
```json
{
  "tag": "SLOW_QUERY",
  "service": "problem",
  "db": "problem_db",
  "elapsedMs": 342,
  "queryNormalized": "SELECT * FROM problems WHERE study_id = $1",
  "paramCount": 1,
  "operation": "SELECT",
  "table": "problems"
}
```

**쿼리 파라미터 원본값 절대 금지** — normalized 쿼리 + paramCount만 기록.

### 8-2. 마이그레이션 로그

Init Container 실행 시 구조화 로그:

```json
{"tag": "MIGRATION_START", "service": "identity", "db": "identity_db", "podName": "..."}
{"tag": "MIGRATION_EXECUTE", "name": "1709000000-CreateUsersTable", "seq": 1, "total": 3, "elapsedMs": 145}
{"tag": "MIGRATION_COMPLETE", "executed": 3, "skipped": 0, "totalElapsedMs": 412, "result": "success"}
```

실패 시 exit code 1 → Pod 재시작. 수동 롤백은 Oracle 승인 필수.

### 8-3. DB 제약 위반

PostgreSQL 에러 코드별 분류:

| pg 에러코드 | 유형 | 로그 레벨 |
|------------|------|----------|
| `23503` | FK 위반 | error |
| `23505` | UNIQUE 위반 | warn (멱등성 처리 시 info) |
| `23514` | CHECK 위반 | error |
| `40P01` | Deadlock | error + 즉시 알림 |

### 8-4. 커넥션 풀 모니터링

PgBouncer 임계값:

| 메트릭 | 알람 조건 |
|--------|----------|
| `cl_waiting > 0` | 5분 지속 시 warning |
| `maxwait > 500ms` | warning |
| 포화율 > 80% | warning |

---

## 9. Prometheus 메트릭 규칙 (Architect 확정)

### 9-1. 네이밍 컨벤션

```
algosu_{service}_{metric_name}_{unit}
```

예시:
```
algosu_gateway_http_requests_total
algosu_submission_saga_duration_seconds
algosu_github_worker_messages_processed_total
algosu_ai_analysis_circuit_breaker_state
```

### 9-2. 라벨 정책

**허용 라벨**:
```
service, method, path(정규화), status(그룹: 2xx/4xx/5xx), queue
```

**금지 라벨** (고카디널리티):
```
userId, traceId, requestId, submissionId
path에 동적 세그먼트 포함 금지 (/problems/123 → /problems/:id)
```

### 9-3. 서비스별 필수 메트릭

**전 서비스 공통**:
```
algosu_{svc}_http_requests_total          Counter    {method, path, status}
algosu_{svc}_http_request_duration_seconds Histogram  {method, path, status}
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1.0, 2.0, 5.0]
algosu_{svc}_http_active_requests         Gauge      {service}
algosu_{svc}_http_errors_total            Counter    {method, path, status}
```

**Gateway 추가**:
```
algosu_gateway_auth_attempts_total        Counter    {outcome, reason}
algosu_gateway_rate_limit_exceeded_total   Counter    {throttler}
algosu_gateway_sse_active_connections      Gauge
algosu_gateway_proxy_request_duration_seconds Histogram {target_service, status}
```

**Submission 추가**:
```
algosu_submission_saga_completed_total     Counter    {result}
algosu_submission_saga_duration_seconds    Histogram  {final_step}
algosu_submission_github_sync_total        Counter    {status}
```

**GitHub Worker**:
```
algosu_github_worker_messages_processed_total Counter  {queue, status}
algosu_github_worker_github_api_duration_seconds Histogram {operation}
```

**AI Analysis**:
```
algosu_ai_analysis_circuit_breaker_state   Gauge      (0=closed, 1=open, 2=half-open)
algosu_ai_analysis_gemini_api_calls_total  Counter    {status}
```

### 9-4. `/metrics` 엔드포인트

- 클러스터 내부 전용 (외부 접근 차단)
- Gateway가 `/metrics` 를 프록시하지 않도록 라우팅 제외
- github-worker: HTTP 서버가 없으므로 최소 HTTP 서버 추가하여 `/metrics` 노출

---

## 10. Loki 로그 수집 (Architect 확정)

### 10-1. Promtail DaemonSet

- `algosu` 네임스페이스만 수집
- JSON pipeline stage로 `level`, `service` 필드 파싱 → Loki 라벨 승격
- monitoring 컴포넌트 자체 로그 제외

### 10-2. Loki 라벨 (최대 5개)

```
namespace="algosu"
service="gateway"
pod="gateway-7d9f8b-xk2p9"
container="gateway"
level="error"
```

`traceId`, `requestId`, `userId`는 라벨이 아닌 로그 본문 필드.
LogQL로 검색: `{service="submission"} | json | traceId="550e8400-..."`

### 10-3. 보존 기간

```
기본: 72h (Loki retention)
CRITICAL 보안 이벤트: 별도 아카이브 검토 (Phase 3+)
```

---

## 11. 알림 규칙 (SLO/SLI)

### 11-1. SLO 목표

| SLI | SLO | 측정 |
|-----|-----|------|
| 가용성 | 99.5% / 월 | `up` 메트릭 |
| 에러율 | < 5% (5분 윈도우) | 5xx / 전체 |
| 응답시간 P95 | < 1.0s | HTTP 히스토그램 |
| 응답시간 P99 | < 3.0s | HTTP 히스토그램 |
| DLQ | 0건 유지 | DLQ 카운터 |

k3s 단일 노드 환경 현실 반영, 99.5% 설정.

### 11-2. Prometheus Alert 요약

| Alert | 조건 | severity |
|-------|------|----------|
| `ServiceDown` | `up == 0` 30s | critical |
| `HighErrorRate` | 5xx > 5% (5분) | warning |
| `CriticalErrorRate` | 5xx > 15% (5분) | critical |
| `HighLatencyP95` | P95 > 1s (3분) | warning |
| `AuthFailureRateHigh` | 인증 실패율 > 30% (5분) | critical |
| `InternalKeyViolation` | 5분 내 5회+ | critical |
| `RateLimitRedisFailopen` | 발생 즉시 | critical |
| `DLQReceived` | DLQ > 0 | critical |
| `CircuitBreakerOpen` | CB state == 1 | critical |
| `HighMemoryUsage` | 메모리 > 80% (5분) | warning |
| `DeadlockDetected` | deadlock 증가 | critical |
| `PgBouncerWaiting` | cl_waiting > 0 (5분) | warning |

---

## 12. 감사 로그 구조 (Gatekeeper 확정)

### 5W 구조

```json
{
  "tag": "AUDIT",
  "requestId": "...",
  "userId": "...",
  "ip": "192.168.1.**",
  "ts": "2026-02-28T12:00:00.000Z",
  "latencyMs": 42,
  "event": "AUTH_SUCCESS",
  "method": "POST",
  "path": "/api/v1/submissions",
  "statusCode": 201,
  "service": "gateway",
  "targetService": "submission",
  "outcome": "SUCCESS"
}
```

### 보존 기간

| 이벤트 등급 | 보존 |
|------------|------|
| CRITICAL | 365일 |
| WARNING | 90일 |
| INFO (인증/인가) | 90일 |
| INFO (일반 요청) | 30일 |

---

## 13. 구현 우선순위

### P0 — 즉시 (배포 전 필수)

1. `RequestIdMiddleware` 추가 (전 요청 추적 기반)
2. JSON structured logger 구현 (NestJS/FastAPI/plain Node 각각)
3. 민감 정보 마스킹 함수 (`sanitizeHeaders`, `sanitizePath`)
4. `jwt.middleware.ts` 로그에 ip, path, reason 추가
5. TypeORM `maxQueryExecutionTime: 200` 설정

### P1 — 배포 직후

6. `prom-client` 설치 + `/metrics` 엔드포인트 (NestJS 4개)
7. `prometheus-client` 설치 + FastAPI 미들웨어
8. github-worker 최소 HTTP 서버 + `/metrics`
9. Saga 로그 구조화 (`[SAGA_TRANSITION]` / `[SAGA_COMPENSATE]`)
10. MQ 메시지에 `x-trace-id` 헤더 추가

### P2 — 운영 안정화

11. Promtail DaemonSet 배포
12. Prometheus Alert 규칙 적용
13. Grafana SLO 대시보드 구성
14. postgres_exporter + pgbouncer_exporter sidecar
15. Init Container 마이그레이션 로그 래퍼

---

## 부록: 서비스별 구현 파일 경로

| 서비스 | 수정 대상 | 내용 |
|--------|----------|------|
| gateway | `src/auth/jwt.middleware.ts` | 보안 로그 구조화 |
| gateway | `src/rate-limit/rate-limit.middleware.ts` | Rate Limit 로그 + fail-open 감지 |
| gateway | `src/sse/sse.controller.ts` | SSE 구독자 본인 확인 + IDOR 로그 |
| gateway | `src/proxy/proxy.module.ts` | 프록시 로그 + traceId 전파 |
| submission | `src/saga/saga-orchestrator.service.ts` | Saga 전이/보상 구조화 로그 |
| submission | `src/saga/mq-publisher.service.ts` | MQ 발행 로그 + AMQP 헤더 |
| github-worker | `src/worker.ts` | MQ 소비 로그 + 에러 분류 |
| github-worker | `src/status-reporter.ts` | X-Trace-Id 헤더 전파 |
| ai-analysis | `src/main.py` | JSON 로거 교체 + HTTP 미들웨어 |
| 전 서비스 | `src/common/logger/` | 구조화 로거 공통 모듈 (신규) |
| 전 서비스 | `src/common/metrics/` | Prometheus 메트릭 모듈 (신규) |
