---
sprint: 69
title: "cloudflared 핫픽스 + GitOps 정합성 개선"
date: "2026-04-09"
status: completed
agents: [Oracle, Architect]
related_adrs: []
---

# Sprint 69: cloudflared 핫픽스 + GitOps 정합성 개선

## Decisions

### D1: cloudflared 핫픽스는 AlgoSu 직접 apply 방식 유지, GitOps 편입은 이월
- **Context**: Cloudflare Error 1033으로 blog.algo-su.com 접근 불가. 근본 원인 진단 과정에서 cloudflared가 ArgoCD 관리 대상이 아님을 발견(`kubectl.kubernetes.io/last-applied-configuration`만 존재, ArgoCD tracking-id 없음). GitOps 편입 작업을 동시에 진행할지, 핫픽스만 먼저 적용할지 결정 필요.
- **Choice**: 핫픽스만 먼저 `AlgoSu/infra/k3s/cloudflared.yaml` 경로를 그대로 유지한 채 `kubectl apply`로 즉시 반영. GitOps 편입(69-2)·태그 고정(69-3)·고아 매니페스트 정리(69-4)는 이월.
- **Alternatives**: (a) 핫픽스와 GitOps 편입을 동시 진행 — 서비스 다운타임 연장 위험으로 기각. (b) 클러스터에 직접 `kubectl edit`만 적용 — 소스 파일과 드리프트 발생으로 기각.
- **Code Paths**: `infra/k3s/cloudflared.yaml`

## Patterns

해당 없음 (단일 플래그 추가 핫픽스)

## Gotchas

### G1: cloudflared `--metrics` 명시 필수 — liveness probe와 포트 정합
- **Symptom**: cloudflared pod가 28시간 동안 누적 427회 CrashLoopBackOff. 각 사이클에서 pod가 ~88초 기동 후 `Initiating graceful shutdown due to signal terminated` 로그와 함께 종료. blog.algo-su.com에서 간헐적으로 Cloudflare Error 1033(Argo Tunnel error) 노출.
- **Root Cause**: Deployment args에 `--metrics` 플래그가 없어 cloudflared가 metrics/ready 엔드포인트를 랜덤 포트(실측 `[::]:20241`)에서 바인딩. 그러나 `livenessProbe.httpGet.port: 2000`으로 고정돼 있어 probe가 `dial tcp 10.42.0.216:2000: connection refused`로 1275회 실패 → kubelet이 3회 실패 후 SIGTERM → 컨테이너가 Exit 0으로 정상 종료 → CrashLoopBackOff 백오프 루프.
- **Fix**: `args` 맨 앞에 `- --metrics` / `- 0.0.0.0:2000` 추가. 재배포 후 로그에서 `Starting metrics server on [::]:2000/metrics` 확인, 신규 pod `Running 1/1` 유지, 재시작 0회, blog.algo-su.com HTTP 200 복구.

### G2: 외부 도메인 라우팅 검증 시 Ingress만 보지 말 것
- **Symptom**: CD 배포 검증 중 `kubectl get ingress` 결과에 blog 라우트가 없어 "blog는 외부에 노출되지 않았다"고 순간 오해.
- **Root Cause**: blog 서비스는 Ingress를 경유하지 않고 `algosu/cloudflared` pod가 Cloudflare Tunnel(QUIC)로 직접 in-cluster `blog` Service(ClusterIP)로 전달. Ingress에는 흔적이 없음.
- **Fix**: 외부 도메인 응답을 확인할 때는 (1) `kubectl get pods | grep cloudflared`로 터널 pod 존재 확인, (2) 실제 `curl -sSI https://<domain>/`으로 HTTP 응답 검증, (3) Cloudflare Zero Trust 대시보드 경유 경로 확인. `reference_domain.md`에 blog 도메인 및 라우팅 메커니즘을 기록해 재발 방지.

### G3: cloudflared가 GitOps 관리 외부 — 드리프트 탐지 불가
- **Symptom**: `kubectl -n argocd get application algosu` 결과가 `Synced / Healthy`인데도 불구하고 cloudflared는 `--metrics` 플래그 없는 상태로 28시간 CrashLoop 상태였음. ArgoCD는 이 문제를 보고하지 않음.
- **Root Cause**: cloudflared Deployment가 `kubectl apply -f AlgoSu/infra/k3s/cloudflared.yaml`로 직접 적용돼 ArgoCD tracking 대상이 아님. 별도로 aether-gitops `algosu/base/monitoring/cloudflared.yaml` 고아 매니페스트도 존재하지만 overlays/prod kustomization에서 참조하지 않아 무시됨.
- **Fix**: (이월) 69-2에서 cloudflared를 aether-gitops base에 편입하고 overlays/prod resources에 포함. 이후 `AlgoSu/infra/k3s/cloudflared.yaml` 삭제, aether-gitops `algosu/base/monitoring/cloudflared.yaml`을 정리(또는 SSoT 승격). 편입 후에는 ArgoCD Health 가 드리프트/장애를 보고할 수 있음.

## Metrics
- Commits: 1건 (49b719a)
- Files changed: 1개 (+4/-0)
- 서비스 영향: blog.algo-su.com — 간헐적 Error 1033 상태(28h)에서 HTTP 200 상시 응답으로 복구
- 이월 작업: 3건 (69-2 GitOps 편입, 69-3 태그 고정, 69-4 고아 매니페스트 정리)
