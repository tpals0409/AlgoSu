---
sprint: 82
title: "그라파나 모니터링 데이터 불일치 해결"
date: "2026-04-10"
status: completed
agents: [Oracle, Architect, Scout]
related_adrs: ["sprint-81"]
---

# Sprint 82: 그라파나 모니터링 데이터 불일치 해결

## Decisions

### D1: Recording rule 메트릭명 불일치 수정
- **Context**: Sprint 81에서 도입한 `algosu:http_error_rate:5m` recording rule이 존재하지 않는 `http_errors_total` 메트릭을 참조하여 항상 빈 결과 반환. 실제 메트릭은 `http_requests_total{status_code=~"5.."}`.
- **Choice**: `http_errors_total` → `http_requests_total{status_code=~"5.."}` 로 수정. 분자·분모 모두 동일 메트릭 기반으로 통일.
- **Alternatives**: (a) 별도 `http_errors_total` counter 추가 — 이중 계측, 기각.
- **Code Paths**: `infra/k3s/monitoring/prometheus-rules.yaml`

### D2: Memory usage recording rule join 전략 변경 (on(pod) → on(job) + label_replace)
- **Context**: `algosu:memory_usage_pct` recording rule이 `on(pod)` join을 사용했으나, `process_resident_memory_bytes`와 `kube_pod_container_resource_limits`의 pod label이 매치되지 않아 빈 결과.
- **Choice**: `label_replace`로 `kube_pod_container_resource_limits`의 `container` label을 `job`으로 변환 후 `on(job)` join. prefixed 메트릭명(`algosu_.+_process_resident_memory_bytes`)으로 매치.
- **Alternatives**: (a) relabel_config로 pod label 통일 — Prometheus config 복잡도 증가, 기각. (b) 고정값 사용 — limits 동적 참조 불가, 기각.
- **Code Paths**: `infra/k3s/monitoring/prometheus-rules.yaml`

### D3: Prometheus Deployment strategy → Recreate
- **Context**: RollingUpdate 전략에서 신규 Pod가 기존 Pod의 PVC TSDB lock을 획득하지 못해 CrashLoopBackOff 발생. ConfigMap 변경 시마다 재시작 실패.
- **Choice**: `strategy.type: Recreate`로 변경. 기존 Pod를 완전 종료 후 신규 Pod 기동하여 TSDB lock 충돌 제거.
- **Alternatives**: (a) emptyDir 사용 — TSDB 데이터 유실, 기각. (b) StatefulSet 전환 — 단일 인스턴스에 불필요한 복잡도, 기각.
- **Code Paths**: `infra/k3s/monitoring/prometheus-config.yaml`

### D4: SLO 대시보드 Gateway 에러율 쿼리 통일
- **Context**: Grafana SLO 대시보드의 Gateway 에러율 패널 2곳이 존재하지 않는 `http_errors_total` 메트릭을 사용하여 데이터 미표시.
- **Choice**: `http_requests_total{status_code=~"5.."}` 기반으로 통일. recording rule과 동일한 메트릭 소스 사용.
- **Code Paths**: `infra/k3s/monitoring/grafana-slo-dashboard.yaml`

## Patterns

### P1: Prometheus cross-metric join은 label_replace + on(job) 패턴 사용
- **Where**: `prometheus-rules.yaml` — `algosu:memory_usage_pct` recording rule
- **When to Reuse**: 서로 다른 exporter의 메트릭을 join할 때. pod label이 매치되지 않는 경우 공통 식별자(job/service명)로 변환 후 join.

### P2: PVC 사용하는 단일 인스턴스 Deployment는 Recreate 전략
- **Where**: `prometheus-config.yaml` — Prometheus Deployment
- **When to Reuse**: TSDB, SQLite 등 단일 프로세스 lock이 필요한 스토리지를 PVC로 마운트하는 경우.

## Gotchas

### G1: Recording rule은 실제 존재하는 메트릭명으로 검증 필수
- **Symptom**: recording rule health는 OK이나 결과가 항상 빈 벡터. Prometheus는 존재하지 않는 메트릭 참조를 에러로 처리하지 않음.
- **Root Cause**: Sprint 81에서 `http_errors_total`이라는 존재하지 않는 메트릭명을 사용. 실제 5xx 에러는 `http_requests_total{status_code=~"5.."}` label로 구분.
- **Fix**: rule 작성 후 `prometheus/api/v1/query`로 실제 데이터 반환 여부 검증 필수.

### G2: Prometheus RollingUpdate + PVC = TSDB lock 충돌
- **Symptom**: ConfigMap 변경 후 Prometheus Pod CrashLoopBackOff. `opening storage failed: lock DB directory: resource temporarily unavailable`.
- **Root Cause**: RollingUpdate는 신규 Pod를 먼저 기동하는데, PVC(ReadWriteOnce)에 기존 Pod가 lock을 보유 중이므로 신규 Pod가 TSDB를 열지 못함.
- **Fix**: Recreate 전략으로 전환. 단일 인스턴스이므로 짧은 다운타임은 허용.

### G3: aether-gitops 이미지 태그 PLACEHOLDER 잔류
- **Symptom**: Gateway Pod `InvalidImageName` 상태 + ArgoCD Health `Degraded`. 정상 Pod 2개는 이전 ReplicaSet에서 Running.
- **Root Cause**: Sprint 81에서 NODE_OPTIONS 추가 시 aether-gitops gateway.yaml 이미지를 `OWNER/main-PLACEHOLDER`로 남긴 채 커밋.
- **Fix**: 실제 운영 이미지 태그(`tpals0409/algosu-gateway:main-6f13a80...`)로 수정. gitops 변경 시 이미지 태그가 유효한지 반드시 확인.

## Metrics
- Commits: 1건 (e68ea00)
- Files changed: 3개 (+15/-5)
- aether-gitops: 2건 (c02c9ca recording rule 동기화, aa4afc4 gateway PLACEHOLDER 수정)
- 이월 항목: Anonymous access, Loki 재시작, Grafana 업그레이드, Promtail structured_metadata
