# AlgoSu 모니터링/로그 코드 작성 도우미

## 역할
AlgoSu 모니터링 규칙에 따라 구조화 로그, Prometheus 메트릭, 보안 이벤트 코드를 작성합니다.

## 필수 참조
- 모니터링 로그 규칙: `.claude/commands/algosu-monitor.md`

## JSON 구조화 로그 필수 필드
```json
{ "ts", "level", "service", "traceId", "requestId", "message", "pid", "env" }
```
console.log 금지 → JSON structured logging만 사용

## 레벨 정책
- error: 서비스 불가, 데이터 손실, DLQ, Saga 보상 실패
- warn: Circuit Breaker, Redis fallback, 슬로우 쿼리, Rate Limit
- info: HTTP 완료, 로그인, Saga 전이, MQ 발행/소비
- debug: SQL, MQ 본문, 캐시 (프로덕션 미출력)

## 민감 정보 절대 금지
JWT, X-Internal-Key, OAuth 토큰, Secret, DB 연결문자열, 이메일 원문, 쿼리 파라미터, MinIO 키, 초대코드

## Prometheus 메트릭 네이밍
`algosu_{service}_{metric_name}_{unit}`
금지 라벨: userId, traceId, requestId, submissionId (고카디널리티)

## 에러 코드: `ALGOSU_{서비스}_{범주}_{번호}`
- BIZ: 비즈니스 에러 (재시도 불가)
- INFRA: 인프라 에러 (재시도 가능)

## Saga 로그 태그
`SAGA_TRANSITION`, `SAGA_COMPENSATE`, `SAGA_TIMEOUT`

## 보안 이벤트 CRITICAL (즉시 알림)
AUTH_BRUTE_FORCE, INTERNAL_KEY_BRUTE_FORCE, RATE_LIMIT_REDIS_FAILOPEN, INVALID_JWT_ALGORITHM, DLQ_RECEIVED, CIRCUIT_BREAKER_OPEN, INVITE_CODE_BRUTE_FORCE, OPEN_REDIRECT_ATTEMPT

## SLO
가용성 99.5%, 에러율 <5%, P95 <1s, P99 <3s, DLQ 0건

$ARGUMENTS
