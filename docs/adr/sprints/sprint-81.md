---
sprint: 81
title: "개발 서버 이전 — k3d 클러스터 동기화"
date: "2026-04-13"
status: completed
agents: [Oracle, Architect]
related_adrs: []
---

# Sprint 81: 개발 서버 이전 — k3d 클러스터 동기화

## Decisions

### D1: kube-state-metrics 신규 배포 (base 매니페스트)
- **Context**: Prometheus config에 `kube-state-metrics:8080` scrape 타겟이 정의되어 있으나, 해당 리소스의 매니페스트가 없어 OCI/dev 모두 scrape 실패 상태.
- **Choice**: `infra/k3s/kube-state-metrics.yaml`에 Deployment/Service/ServiceAccount/ClusterRole/ClusterRoleBinding을 신규 작성. `--namespaces=algosu` 제한으로 리소스 절약.
- **Alternatives**: (a) Helm chart로 설치 — kustomize 기반 운영과 불일치, 기각. (b) scrape 타겟 자체를 제거 — HPA/PDB 등 k8s 리소스 메트릭 수집 불가, 기각.
- **Code Paths**: `infra/k3s/kube-state-metrics.yaml`, `infra/k3s/kustomization.yaml`, `infra/k3s/metrics-network-policy.yaml`

### D2: dev overlay에서 stateful 서비스 securityContext 제거
- **Context**: k3d의 local-path provisioner가 fsGroup을 제대로 지원하지 않아, `securityContext.fsGroup: 999`가 설정된 postgres/rabbitmq/minio 파드가 PVC 마운트 후 권한 에러로 기동 실패.
- **Choice**: `infra/overlays/dev/kustomization.yaml`에 JSON Patch로 postgres, postgres-problem, minio, rabbitmq의 pod-level securityContext를 제거. 이미지 기본 uid로 실행.
- **Alternatives**: (a) initContainer로 chown — pod-level `runAsNonRoot: true`가 root initContainer를 차단, 기각. (b) base에서 securityContext 제거 — 운영(OCI) 보안 약화, 기각.
- **Code Paths**: `infra/overlays/dev/kustomization.yaml`

### D3: dev overlay에서 readinessProbe /health → fallback
- **Context**: 현재 `:dev` 이미지에 `/health/ready` 엔드포인트가 미구현(404) 또는 Gateway 인증 미들웨어 차단(401). readinessProbe 실패로 파드가 영구 Not Ready.
- **Choice**: dev overlay에서 5개 앱 서비스의 readinessProbe path를 `/health`로 패치.
- **Code Paths**: `infra/overlays/dev/kustomization.yaml`

## Patterns

### P1: dev overlay JSON Patch 패턴으로 k3d 호환성 확보
- **Where**: `infra/overlays/dev/kustomization.yaml` patches 섹션
- **When to Reuse**: base 매니페스트의 운영 설정이 k3d/local 환경과 호환되지 않을 때. securityContext, readinessProbe, imagePullSecrets 등을 dev overlay에서 선택적으로 제거/변경하여 base 무수정 유지.

## Gotchas

### G1: k3d local-path provisioner + fsGroup 비호환
- **Symptom**: postgres, minio, rabbitmq 파드가 PVC 마운트 후 `data directory has wrong ownership`, `file access denied` 에러로 CrashLoopBackOff.
- **Root Cause**: local-path provisioner가 볼륨 생성 시 root(GID 0)으로 파일을 생성하며, kubelet의 fsGroup 재귀 chown이 제대로 동작하지 않음.
- **Fix**: dev overlay에서 pod securityContext 제거. 이미지 기본 uid(postgres=999, minio=1000)로 실행하면 initdb가 정상 동작.

### G2: problem-service DB 분리 후 시크릿 불일치
- **Symptom**: problem-service init container가 `ECONNREFUSED` — NetworkPolicy가 postgres(main) 접근을 차단.
- **Root Cause**: `problem-service-secrets.DATABASE_HOST`가 여전히 `postgres`(main)를 가리키지만, `problem-policy` NetworkPolicy는 egress를 `postgres-problem`만 허용. DB 분리 완료 후 시크릿 미갱신.
- **Fix**: `problem-service-secrets.DATABASE_HOST`를 `postgres-problem`으로, 비밀번호를 `postgres-problem-secret`과 동기화.

## Metrics
- Commits: 1건 (515c817)
- Files changed: 4개 (+226/-0)
- 클러스터 상태: 18 파드 Running, HPA 3, PDB 3, NetworkPolicy 19, kube-state-metrics scrape up
