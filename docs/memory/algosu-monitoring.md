# AlgoSu 모니터링/로그 규칙 요약

> 원본: `/root/AlgoSu/docs/monitoring-log-rules.md`

## JSON 구조화 로그 필수 필드
ts, level, service, traceId, requestId, message, pid, env

## 로그 레벨
- error: 서비스 불가, 데이터 손실
- warn: 동작 계속되나 주의 (Circuit Breaker, Redis fallback, 슬로우 쿼리)
- info: 정상 비즈니스 이벤트
- debug: 개발/진단 (프로덕션 미출력)

## traceId 규칙
- 제출 흐름: `traceId = submissionId`
- 일반 HTTP: Gateway `X-Trace-Id` 생성 → 전파
- MQ: Body submissionId + AMQP Header `x-trace-id`

## 민감 정보 절대 금지
JWT 원문, X-Internal-Key, OAuth 토큰, Secret, DB 연결문자열, 이메일 원문, 쿼리 파라미터, MinIO 키, 초대코드

## 에러 코드 체계: `ALGOSU_{서비스}_{범주}_{번호}`
- SUB_BIZ_001~007, REV_BIZ_001~003, GHW_BIZ_001~004
- SUB_INFRA_001~003, GHW_INFRA_001~004, AI_INFRA_001~003, MINIO_INFRA_001~002
- NTF_BIZ_001, STD_BIZ_001~005, MQ_001~003, GWY_001, SSE_001

## Prometheus 메트릭: `algosu_{service}_{metric}_{unit}`
- 금지 라벨 (고카디널리티): userId, traceId, requestId, submissionId

## SLO
- 가용성: 99.5%/월
- 에러율: <5% (5분 윈도우)
- P95 < 1.0s, P99 < 3.0s
- DLQ: 0건 유지

## 보안 이벤트 CRITICAL (즉시 알림)
AUTH_BRUTE_FORCE, INTERNAL_KEY_BRUTE_FORCE, RATE_LIMIT_REDIS_FAILOPEN, INVALID_JWT_ALGORITHM, OAUTH_STATE_REUSE, SSE_IDOR_REPEATED, DLQ_RECEIVED, CIRCUIT_BREAKER_OPEN, INVITE_CODE_BRUTE_FORCE, OPEN_REDIRECT_ATTEMPT

## Loki
- Promtail: algosu 네임스페이스만 수집
- 라벨 최대 5개: namespace, service, pod, container, level
- 보존: 72h
