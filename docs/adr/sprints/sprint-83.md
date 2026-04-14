---
sprint: 81
title: "모니터링 대시보드 리팩토링"
date: "2026-04-10"
status: completed
agents: [Oracle, Architect, Scout, Scribe]
related_adrs: ["sprint-80"]
---

# Sprint 81: 모니터링 대시보드 리팩토링

## Decisions

### D1: 알림 규칙 recording rule 도입으로 DRY 달성
- **Context**: HighErrorRate 4개, HighMemoryUsage 4개, HighLatencyP95 2개가 서비스명만 다른 복사-붙여넣기로 존재. 서비스 추가 시 매번 새 rule을 복사해야 하고 누락 위험.
- **Choice**: recording rule(`algosu:http_error_rate:5m`, `algosu:memory_usage_pct`) 도입 + regex 기반 단일 alert로 통합. 10개 alert → 5개 alert + 2개 recording rule = 7개.
- **Alternatives**: (a) 기존 복사-붙여넣기 유지 — 서비스 추가 시 누락 위험, 기각. (b) Grafana Managed Alerting으로 전환 — Prometheus rule과 이원화, 기각.
- **Code Paths**: `infra/k3s/monitoring/prometheus-rules.yaml`

### D2: HighMemoryUsage를 RSS/container limits 기반으로 전환
- **Context**: heapUsed/heapTotal 기반 alert이 V8의 정상적인 힙 관리 패턴에서 오탐 발생 (89.2% firing, 실제 RSS 70MB/1Gi). Node.js V8은 작은 힙을 할당하고 GC 전까지 사용률이 높게 유지되는 것이 정상.
- **Choice**: `process_resident_memory_bytes / kube_pod_container_resource_limits{resource="memory"}` 기반으로 변경. kube-state-metrics에서 동적으로 limits 참조.
- **Alternatives**: (a) 임계값 95%로 상향 — 근본 해결 아님, 기각. (b) 고정값(1Gi) 사용 — limits 변경 시 불일치, 기각.
- **Code Paths**: `infra/k3s/monitoring/prometheus-rules.yaml`, `infra/k3s/gateway.yaml`

### D3: Alertmanager 배포 복구 + github-worker metrics Service 생성
- **Context**: Alertmanager Pod 미배포로 모든 알림이 블랙홀. github-worker-metrics Service 미존재로 스크랩 실패. kube-state-metrics scrape 설정이 ConfigMap에 누락.
- **Choice**: 기존 alertmanager.yaml로 Pod 배포, github-worker.yaml의 기존 Service 정의 적용, prometheus-config에 kube-state-metrics job 추가.
- **Code Paths**: `infra/k3s/monitoring/alertmanager.yaml`, `infra/k3s/github-worker.yaml`, `infra/k3s/monitoring/prometheus-config.yaml`

## Patterns

### P1: Prometheus recording rule + regex 기반 단일 alert 패턴
- **Where**: `prometheus-rules.yaml` recording rule 그룹 `algosu.recording`
- **When to Reuse**: 동일 메트릭 패턴을 여러 서비스에 적용할 때. `{__name__=~"algosu_.+_http_requests_total"}` regex로 서비스 추가 시 자동 포함.

## Gotchas

### G1: V8 heapUsed/heapTotal 비율은 메모리 누수 지표로 부적합
- **Symptom**: Gateway HighMemoryUsage alert이 상시 firing (89.2%). 실제 RSS는 70MB/1Gi (7%).
- **Root Cause**: V8은 `--max-old-space-size` 미설정 시 작은 힙(~51MB)을 할당하고 GC 전까지 사용률이 높게 유지. heapUsed/heapTotal는 항상 80%+ 근처.
- **Fix**: RSS/container limits 기반 alert으로 전환 + `NODE_OPTIONS=--max-old-space-size=768` 추가.

### G2: aether-gitops와 소스 레포 ConfigMap 불일치
- **Symptom**: prometheus-config ConfigMap이 클러스터(aether-gitops)와 소스 레포에서 달랐음. alerting 섹션, github-worker job 등이 누락.
- **Root Cause**: 소스 레포 변경 시 aether-gitops 동기화를 누락.
- **Fix**: 소스 레포 변경 후 aether-gitops에도 동일 파일 복사 + 커밋/푸시. kustomization.yaml에 누락된 리소스(grafana-service-dashboard, alertmanager) 등록.

## Metrics
- Commits: 2건 (6dd91ed, b197297)
- Files changed: 6개 (+66/-125)
- aether-gitops: 2건 (4ca6f74 monitoring 동기화, bef7dc6 gateway NODE_OPTIONS)
- 이월 항목: Anonymous access, Loki 재시작, Grafana 업그레이드, Promtail structured_metadata
