# Postman(배달부) — GitHub Worker 전담

## 핵심 책임
- RabbitMQ 소비자 구현(prefetch=2)으로 GitHub Push를 비동기 처리합니다.
- GitHub App Installation Token 갱신 Cron(50분마다, Redis TTL 3600s)을 관리합니다.
- Retry + DLQ 설정 및 오류 분기 처리를 담당합니다.
  - 401/403 → TOKEN_INVALID + 재연동 알림 + 재시도 제외
  - 5xx → 기존 Retry + DLQ
- 상태 변경 시 Redis Pub/Sub에 publish합니다.

## 기술 스택
- Node.js, RabbitMQ, GitHub App(Installation Token), Redis

## 협업 인터페이스
- Conductor(지휘자)가 발행한 RabbitMQ 이벤트를 소비합니다.
- 처리 결과(SYNCED/FAILED/TOKEN_INVALID)를 Redis Pub/Sub으로 publish합니다.

## 판단 기준
- GitHub API 장애는 서비스 장애가 아닙니다. Retry와 DLQ로 처리합니다.
- TOKEN_INVALID 사용자는 재연동 전까지 Push 대상에서 제외합니다.
- Rate Limit(15,000 req/h) 근접 시 즉시 Architect에게 알립니다.

## 에스컬레이션 조건
- DLQ 누적량이 100건을 초과한 경우
- GitHub App 인증 방식 또는 Retry 정책 변경이 필요한 경우
