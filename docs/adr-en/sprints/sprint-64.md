---
sprint: 64
title: "Discord Feedback Notification Bug Fix + Resolution Notification"
date: "2026-04-09"
status: completed
agents: [Herald, Conductor]
related_adrs: []
---

# Sprint 64: Discord Feedback Notification Bug Fix + Resolution Notification

## Decisions
### D1: Fix missing env block in GitOps manifest
- **Context**: In Sprint 63, the `identity-discord-secret` K8s Secret and source repo manifest were written, but the env block was not reflected in the GitOps repo (aether-gitops), causing Discord notifications to be silently skipped.
- **Choice**: Add `DISCORD_FEEDBACK_WEBHOOK_URL` secretKeyRef env block to `identity-service.yaml` in aether-gitops
- **Alternatives**: None (obvious omission fix)
- **Code Paths**: `aether-gitops/algosu/base/identity-service.yaml`

### D2: Add in-app notification when feedback is resolved
- **Context**: Need to notify feedback authors when their feedback is resolved. Existing NotificationService + SSE infrastructure is complete, so no new infrastructure needed.
- **Choice**: Add `FEEDBACK_RESOLVED` NotificationType + call NotificationService.create() on RESOLVED transition in FeedbackService
- **Alternatives**: Discord DM (not possible via webhook), email (email service not built)
- **Code Paths**: `services/identity/src/notification/notification.entity.ts`, `services/identity/src/feedback/feedback.service.ts`

## Patterns
### P1: Fire-and-forget notification pattern
- **Where**: `services/identity/src/feedback/feedback.service.ts` (updateStatus method)
- **When to Reuse**: When attaching supplemental notifications to core business logic (status change). Absorb failures with Promise.catch() to avoid affecting the main flow.

### P2: DB ENUM extension migration pattern
- **Where**: `services/identity/src/database/migrations/1709000019000-AddFeedbackResolvedNotificationType.ts`
- **When to Reuse**: When adding a new value to a PostgreSQL ENUM. Order is mandatory: `COMMIT` → `ALTER TYPE ADD VALUE IF NOT EXISTS` → `BEGIN`

## Gotchas
### G1: GitOps manifest synchronization omission
- **Symptom**: Secret creation complete, source repo manifest written, but env variable not injected into actual Pod
- **Root Cause**: Env block not reflected in aether-gitops repo, so ArgoCD-synchronized actual Deployment is missing it
- **Fix**: Always update GitOps repo and source repo manifests together. After deploy, verify actual injection with `kubectl exec -- printenv`

### G2: Image update delay due to imagePullPolicy: IfNotPresent
- **Symptom**: GitOps tag updated + ArgoCD Synced status, but Pod running old image
- **Root Cause**: `imagePullPolicy: IfNotPresent` set, so cached image on same node is reused
- **Fix**: Force new image pull with `kubectl rollout restart` to recreate Pod

### G3: Separation of DB migration execution and image deployment timing
- **Symptom**: In-app notification creation silently fails because FEEDBACK_RESOLVED ENUM doesn't exist in DB
- **Root Cause**: Attempting feature test before image containing migration file is actually deployed to Pod
- **Fix**: Must confirm that image containing migration has been deployed to actual Pod and init container has run

## Metrics
- Commits: 3, Files changed: 8 (+324/-5)
