---
type: convention
domain: observability
---
# 모니터링 / 로깅 규칙

AlgoSu 모든 서비스(Node.js / FastAPI / 인프라)가 따라야 할 구조화 로깅 + 메트릭 + 알람 규칙. 코드 주석 `규칙 근거: /docs/conventions/monitoring-logging.md §N` 참조의 SSOT.

## §1 구조화 로깅 (Structured Logging)

모든 stdout 출력은 **JSON 한 줄**. `console.log` 문자열 금지(ESLint `no-console: 'error'` + Python Ruff `T20`로 차단).

### §1-1 공통 필수 필드

모든 로그 라인은 다음 필드 포함:

| 필드 | 타입 | 의미 |
|------|------|------|
| `timestamp` | ISO 8601 | UTC `2026-05-13T03:14:15.123Z` |
| `level` | string | `debug` / `info` / `warn` / `error` |
| `service` | string | `gateway` / `submission` / `ai-analysis` 등 |
| `message` | string | 사람이 읽는 요약 |
| `request_id` | string \| null | §1-4 request-id 미들웨어 전파값 |
| `trace_id` | string \| null | (확장) OpenTelemetry trace |

JSON 파싱 → Loki/Grafana 직행 (`promtail.yaml` §1-1 참조).

### §1-3 에러 확장 필드 + production stack trace 정책

`level=error` 라인은 다음 추가 필드 포함:

| 필드 | 의미 |
|------|------|
| `error_code` | `GHW_BIZ_001` 등 §7 명명 규칙 |
| `error_class` | `Error` / `HttpException` / 도메인 에러 클래스명 |
| `stack_trace` | **non-production만 노출**. `NODE_ENV=production` / `ENV=production`에서는 제거 (PII/internal-path 누출 방지) |

### §1-4 request-id 전파

Gateway 진입 시 `X-Request-Id` 헤더 검사 → 없으면 ULID 생성 → 모든 downstream HTTP/MQ에 전파. 미들웨어: `services/gateway/src/common/middleware/request-id.middleware.ts`.

## §2 로그 레벨

### §2-2 환경별 최소 레벨

| 환경 | 최소 레벨 | 비고 |
|------|----------|------|
| local / test | `debug` | 디버깅 편의 |
| dev | `info` | |
| staging | `info` | |
| production | `info` | warn/error만 알람 발생 |

`LOG_LEVEL` 환경변수로 override 가능. 코드 기본값: `info`.

## §3 민감 정보 sanitize (PII / Secrets)

다음은 **로그/메트릭/에러 메시지에 절대 포함 금지** (보안 규칙):

- JWT, refresh token, OAuth state/code
- DB connection string, password
- 사용자 이메일/실명/전화번호 (해시값으로만 기록)
- API key, internal-key, sealed secret 평문
- request body raw (whitelisted field만 mask 후 기록)

구현: `services/gateway/src/common/logger/sanitize.ts` — JSON 직렬화 직전 deep walk + key-pattern 매칭으로 `[REDACTED]` 치환.

## §5 Saga 확장 필드

분산 트랜잭션(Saga) 로그는 다음 필드 포함:

| 필드 | 의미 |
|------|------|
| `saga_id` | Saga 인스턴스 고유 ID |
| `saga_step` | `PROBLEM_REQUESTED` / `AI_ANALYSIS_COMPLETED` 등 |
| `saga_status` | `started` / `compensated` / `completed` |
| `correlation_id` | 비즈니스 식별자 (submission_id 등) |

`services/github-worker/src/logger.ts` 헬퍼 사용.

## §6 RabbitMQ MQ 로깅

MQ publish/consume/ack/nack/retry/DLQ 모든 단계 로깅 의무.

| 필드 | 의미 |
|------|------|
| `mq_exchange` | exchange 이름 |
| `mq_routing_key` | routing key |
| `mq_queue` | consume queue |
| `mq_action` | `publish` / `consume` / `ack` / `nack` / `retry` / `dlq` |
| `mq_attempt` | retry 시도 횟수 |

### §6-3 DLQ_RECEIVED 즉시 error

DLQ 도달 메시지는 **즉시 `level=error`** + Grafana alert. retry budget 소진 = 운영 개입 신호.

## §7 에러 코드 명명 규칙

`{SERVICE}_{CATEGORY}_{NNN}` 형식.

| 부분 | 예시 |
|------|------|
| SERVICE | `GHW` (github-worker) / `GW` (gateway) / `AI` (ai-analysis) |
| CATEGORY | `BIZ` (business) / `INF` (infra) / `SEC` (security) / `INT` (internal-key) |
| NNN | 3자리 zero-padded |

예: `GHW_BIZ_001` = github-worker 비즈니스 에러 #1.

## §8 DB 쿼리

### §8-1 Slow query 경고 (200ms threshold)

TypeORM `maxQueryExecutionTime: 200` 설정. 200ms 초과 쿼리는 자동 `level=warn` 로그. N+1 / index 누락 조기 감지.

위치: `services/{identity,submission}/src/app.module.ts` 등.

## §9 메트릭 수집 (Prometheus)

모든 서비스 `/metrics` 엔드포인트 노출 (Gateway 외부 미공개).

### §9-1 표준 메트릭

| 메트릭 | 타입 | 라벨 |
|--------|------|------|
| `http_requests_total` | counter | `method`, `path`, `status` |
| `http_request_duration_seconds` | histogram | `method`, `path` |
| `algosu_{service}_{domain}_{action}_total` | counter | 도메인별 |

Node.js: `prom-client` default metrics + 커스텀.
Python (ai-analysis): `prometheus_client` Counter/Histogram/Gauge.

### §9-2 메트릭 명명

`algosu_{service}_{snake_case}` prefix. 외부 exporter(`up`/`rabbitmq_*`/`kube_*`) 는 prefix 제외.

### §9-3 Default Metric Stale 점검

Container restart 또는 모듈 중복 import 시 prom-client default metric이 stale/duplicate 상태에 빠지는 4가지 케이스와 방어 패턴.

| Case | 증상 | 원인 | 방어 |
|------|------|------|------|
| A (duplicate registration) | 부팅 실패, `Error: A metric with the name ... has already been registered` | 동일 Registry에 MetricsService 2회 인스턴스화 | `@Global()` 모듈로 싱글턴 보장 (Sprint 135 Wave C P1) |
| B (label cardinality) | 메모리 누수, /metrics 응답 비대 | 동적 path 세그먼트가 라벨로 삽입 | `normalizePath()` UUID/숫자 → `:id` 치환 |
| C (worker registry 혼입) | github-worker 메트릭 누락 | 별도 HTTP 서버(port 9100) 라이프사이클 불일치 | 독립 Registry + `startMetricsServer()` 격리 |
| D (Python default 미활성) | ai-analysis에 `gc_*`/`process_*` 부재 | `prometheus_client` default 미호출 (의도적) | Node.js만 default 권장, Python은 명시적 메트릭만 |

**점검 도구**: `scripts/check-prom-default-metrics.mjs`

```bash
# 로컬 전체 서비스 점검
node scripts/check-prom-default-metrics.mjs

# 특정 서비스만
node scripts/check-prom-default-metrics.mjs --services gateway,submission

# staging port-forward 환경
node scripts/check-prom-default-metrics.mjs --base-url http://staging.internal
```

**회귀 차단 spec**: `services/submission/src/common/metrics/metrics.service.spec.ts` — `onModuleInit()` 중복 호출 + 동일 Registry 이중 생성 방어 (Case A 직접 검증).

## §11 Prometheus Alert Rule

### §11-2 Alert Rule 컨벤션

`infra/k3s/monitoring/prometheus-rules.yaml` 정의. 각 rule는:

- `alert:` PascalCase 이름
- `expr:` PromQL (recording rule 또는 raw)
- `for:` 지속 시간 (단발 noise 제거)
- `labels.severity:` `page` / `ticket`
- `annotations.summary` / `annotations.runbook_url` 필수

CI: `scripts/check-grafana-metrics.mjs` recording rule 라벨 정합 + dashboard panel title ↔ metric 정합 자동 검증 (Sprint 145~149 누적).

## 관련 문서

- [annotation-dictionary](./annotation-dictionary.md) — 코드 어노테이션(`@guard` / `@event` / `@domain`) 사전
- [../runbook/regex-robustness](../runbook/regex-robustness.md) — monitoring 검증 스크립트 정규식 강건성
- [`promtail.yaml`](../../infra/k3s/monitoring/promtail.yaml) — Loki 수집 파이프라인
- [`prometheus-rules.yaml`](../../infra/k3s/monitoring/prometheus-rules.yaml) — Alert rule
