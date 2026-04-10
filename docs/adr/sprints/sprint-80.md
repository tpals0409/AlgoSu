---
sprint: 80
title: "blog 롤링 업데이트 1033 에러 해결"
date: "2026-04-10"
status: in-progress
agents: [Oracle, Architect, Scout, Scribe]
related_adrs: ["sprint-69"]
---

# Sprint 80: blog 롤링 업데이트 1033 에러 해결

## Decisions

### D1: blog Deployment preStop hook으로 zero-downtime 배포 확보
- **Context**: blog.algo-su.com에서 Cloudflare Error 1033 재발. Sprint 69에서 cloudflared `--metrics` 플래그 누락으로 동일 에러를 해결했으나, 이번에는 cloudflared pod 자체는 정상(Running, 재시작 0회, `--metrics 0.0.0.0:2000` 적용됨). 근본 원인은 ArgoCD 롤링 업데이트 시 replicas=1 환경에서 구 pod readiness probe 실패 → Service endpoints 공백 → cloudflared가 upstream 502 → Cloudflare 1033 전파.
- **Choice**: blog Deployment spec에 `preStop: exec: command: ["sh", "-c", "sleep 5"]` lifecycle hook 추가. 구 pod이 SIGTERM 수신 후에도 5초간 트래픽을 계속 서빙하여 새 pod이 Ready 상태에 도달할 때까지 endpoints 공백을 제거.
- **Alternatives**: (a) replicas=2로 증설 — OCI ARM 리소스 한계(메모리 24GB, 6서비스+monitoring 가동 중)로 상시 2 replica 유지 비용 부담, 기각. (b) `maxSurge=1, maxUnavailable=0` 전략만 적용 — 이미 기본값이나 readiness 실패 시 endpoints 공백을 방지하지 못함, 기각. (c) Recreate 전략 — 의도적 다운타임 허용이므로 기각.
- **Code Paths**: `infra/k3s/blog.yaml` (또는 aether-gitops 해당 매니페스트)

## Patterns

### P1: replicas=1 서비스의 zero-downtime 롤링 업데이트 패턴
- **Where**: blog Deployment `spec.template.spec.containers[].lifecycle.preStop`
- **When to Reuse**: replicas=1인 Deployment에서 롤링 업데이트 시 트래픽 단절을 방지해야 할 때. 핵심 메커니즘: (1) `maxSurge=1, maxUnavailable=0`으로 새 pod을 먼저 기동, (2) 구 pod에 `preStop: sleep N` (N = 새 pod readiness 소요 시간 + 여유)을 적용하여 SIGTERM 후에도 일정 시간 트래픽 서빙 유지. `terminationGracePeriodSeconds`가 preStop sleep 시간 이상이어야 한다.

## Gotchas

### G1: replicas=1 + maxUnavailable=0이어도 readiness 실패로 endpoints 공백 발생 가능
- **Symptom**: blog 이미지 배포(commit 7fe12ea) 후 blog.algo-su.com에서 Cloudflare Error 1033 재발. cloudflared pod는 정상 가동 중.
- **Root Cause**: 롤링 업데이트 시 kubelet이 구 pod(blog-65869f5699)에 SIGTERM을 전송하면 즉시 readiness probe가 `connection reset by peer`로 실패. kube-proxy가 구 pod을 endpoints에서 제거하지만 새 pod(blog-64998d8b9f)은 아직 Ready가 아닌 상태. 결과적으로 blog Service의 endpoints가 0개가 되어 cloudflared가 upstream 502를 수신하고 Cloudflare가 Error 1033을 반환.
- **Fix**: `preStop: exec: command: ["sh", "-c", "sleep 5"]`로 구 pod이 SIGTERM 후 5초간 프로세스 종료를 지연. 이 5초 동안 구 pod은 여전히 트래픽을 서빙하고 readiness probe도 통과하므로 새 pod이 Ready가 될 때까지 endpoints 공백이 발생하지 않음.

## Metrics
- Commits: TBD
- Files changed: TBD
- 서비스 영향: blog.algo-su.com — 롤링 업데이트 시 Error 1033 재발 방지
