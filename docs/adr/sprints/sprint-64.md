---
sprint: 64
title: "Discord 피드백 알림 미전송 버그 수정 + 해결 알림"
date: "2026-04-09"
status: completed
agents: [Herald, Conductor]
related_adrs: []
---

# Sprint 64: Discord 피드백 알림 미전송 버그 수정 + 해결 알림

## Decisions
### D1: GitOps 매니페스트 env 블록 누락 수정
- **Context**: Sprint 63에서 `identity-discord-secret` K8s Secret과 소스 레포 매니페스트는 작성했으나, GitOps 레포(aether-gitops)에 env 블록 반영을 누락하여 Discord 알림이 silent skip됨
- **Choice**: aether-gitops의 `identity-service.yaml`에 `DISCORD_FEEDBACK_WEBHOOK_URL` secretKeyRef env 블록 추가
- **Alternatives**: 없음 (명백한 누락 수정)
- **Code Paths**: `aether-gitops/algosu/base/identity-service.yaml`

### D2: 피드백 해결 시 인앱 알림 추가
- **Context**: 피드백 작성자에게 해결 사실을 알려야 함. 기존 NotificationService + SSE 인프라가 완비되어 있어 신규 인프라 도입 불필요
- **Choice**: `FEEDBACK_RESOLVED` NotificationType 추가 + FeedbackService에서 RESOLVED 전이 시 NotificationService.create() 호출
- **Alternatives**: Discord DM (webhook으로 불가), 이메일 (이메일 서비스 미구축)
- **Code Paths**: `services/identity/src/notification/notification.entity.ts`, `services/identity/src/feedback/feedback.service.ts`

## Patterns
### P1: fire-and-forget 알림 패턴
- **Where**: `services/identity/src/feedback/feedback.service.ts` (updateStatus 메서드)
- **When to Reuse**: 핵심 비즈니스 로직(상태 변경)에 부가 알림을 연결할 때. Promise.catch()로 실패를 흡수하여 메인 흐름에 영향 없도록 함

### P2: DB ENUM 확장 migration 패턴
- **Where**: `services/identity/src/database/migrations/1709000019000-AddFeedbackResolvedNotificationType.ts`
- **When to Reuse**: PostgreSQL ENUM에 새 값을 추가할 때. `COMMIT` → `ALTER TYPE ADD VALUE IF NOT EXISTS` → `BEGIN` 순서 필수

## Gotchas
### G1: GitOps 매니페스트 동기화 누락
- **Symptom**: Secret 생성 완료, 소스 레포 매니페스트 작성 완료이나 실제 Pod에 환경변수 미주입
- **Root Cause**: aether-gitops 레포에 env 블록을 반영하지 않아 ArgoCD가 동기화하는 실제 Deployment에 누락
- **Fix**: GitOps 레포와 소스 레포 매니페스트를 항상 함께 갱신. 배포 후 `kubectl exec -- printenv` 로 실제 주입 검증 필수

### G2: imagePullPolicy: IfNotPresent로 인한 이미지 갱신 지연
- **Symptom**: GitOps 태그 갱신 + ArgoCD Synced 상태이나 Pod가 이전 이미지 사용
- **Root Cause**: `imagePullPolicy: IfNotPresent`로 설정되어 동일 노드에 캐시된 이미지를 재사용
- **Fix**: `kubectl rollout restart` 로 Pod 재생성하여 새 이미지 pull 유도

### G3: DB migration 실행 시점과 이미지 배포 분리
- **Symptom**: FEEDBACK_RESOLVED ENUM이 DB에 없어 인앱 알림 생성 silent fail
- **Root Cause**: migration 파일이 포함된 커밋의 이미지가 배포되지 않은 상태에서 기능 테스트 시도
- **Fix**: migration이 포함된 이미지가 실제 Pod에 배포되어 init container가 실행되었는지 확인 필수

## Metrics
- Commits: 3건, Files changed: 8개 (+324/-5)
