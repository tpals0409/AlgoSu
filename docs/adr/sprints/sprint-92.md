---
sprint: 92
title: "AI 분석 핫픽스 — ANTHROPIC_API_KEY 401 장애 복구 + 실패 제출 재분석"
date: "2026-04-16"
status: completed
agents: [Oracle]
related_adrs: []
---

# Sprint 92: AI 분석 핫픽스

## Decisions

### D1: ANTHROPIC_API_KEY 긴급 교체
- **Context**: ai-analysis 서비스 Circuit Breaker가 OPEN 상태로 고정. Claude API 직접 호출 시 401 `invalid x-api-key` 확인. Sprint 90에서 보안 목적으로 RABBITMQ_URL 기본값을 ""로 변경한 것과 별개로 API 키 자체가 만료/무효화된 이중 장애.
- **Choice**: `kubectl patch secret ai-analysis-secrets` → base64 인코딩된 신규 키 주입 → `rollout restart deploy/ai-analysis-service`
- **Alternatives**: Sealed Secrets 도입 후 GitOps 경유 교체 → 긴급 상황에 부적합, 후속 스프린트로 이월
- **Code Paths**: `infra/k3s/` (secret 외부), `services/ai-analysis/src/claude_client.py`

### D2: 실패 제출 4건 DB 초기화 + RabbitMQ 재발행
- **Context**: 2026-04-15 발생한 AI 분석 실패 제출 4건 (ai_score=0, saga_step=FAILED/AI_QUEUED). Sprint 90 RABBITMQ_URL 빈값 버그 + API 키 무효 이중 원인.
- **Choice**: DB에서 `ai_analysis_status='pending'`, `ai_score=NULL` 초기화 → ai-analysis pod 내 pika로 `submission.events` exchange에 직접 publish → worker 자동 재처리
- **Alternatives**: submission-service 내부 retry API 호출 → 해당 엔드포인트 미존재
- **Code Paths**: `services/ai-analysis/src/worker.py` (QUEUE, EXCHANGE, ROUTING_KEY 상수 참조)

### D3: Sealed Secrets 도입 결정 (Sprint 93 이월)
- **Context**: API 키 수동 관리의 한계 노출. kubectl edit/patch 방식은 이력 미보존, GitOps 원칙 위반.
- **Choice**: Sealed Secrets 도입 (ArgoCD GitOps 흐름과 일관, solo-dev 운영 부담 최소)
- **Alternatives**: GitHub Secrets → Actions sync job (명령형, GitOps 깨짐), External Secrets Operator (OCI ARM에 오버킬)

## Patterns

### P1: ai-analysis pod 내 pika 직접 publish
- **Where**: `kubectl exec -n algosu ai-analysis-service-{hash} -- python -c "import pika; ..."`
- **When to Reuse**: RabbitMQ 메시지 재발행이 필요하나 rabbitmqadmin CLI 미설치 시. ai-analysis pod에 pika가 이미 설치되어 있으므로 Python one-liner로 publish 가능.

## Gotchas

### G1: Circuit Breaker OPEN + 무한 requeue 루프
- **Symptom**: 4건 메시지가 초당 수십 회 requeue 반복, 로그 폭주
- **Root Cause**: Classic queue에서 `x-delivery-count` 헤더가 증가하지 않아 `_get_delivery_count()`가 항상 0 반환 → `MAX_REQUEUE` 도달 불가 → DLQ 전송 안 됨
- **Fix**: 이번엔 키 교체 후 CB 리셋(pod restart)으로 해결. 근본 수정: 커스텀 `retry_count` 헤더를 requeue 시 증가시키거나 quorum queue 전환 검토 필요

### G2: ANTHROPIC_API_KEY 무효 시 조용한 전체 장애
- **Symptom**: 새 제출의 AI 분석이 전부 실패하지만 별도 알림 없음
- **Root Cause**: CB OPEN → HALF_OPEN → 401 실패 → OPEN 반복. Prometheus alert 미설정
- **Fix**: `claude_requests_total{status="error"}` 연속 증가 또는 CB state gauge OPEN 지속 시 Alertmanager 알림 필요

## Metrics
- Commits: 0건 (순수 운영 핫픽스), DB 레코드 수정: 4건
- 재분석 결과: 4건 completed (score 72/82/82/72)
