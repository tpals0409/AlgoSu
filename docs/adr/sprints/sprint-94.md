---
sprint: 94
title: "Grafana Loki 로그 매칭 수정"
date: "2026-04-16"
status: completed
---

# Sprint 94 — Grafana Loki 로그 매칭 수정

## 목표
Grafana 대시보드(`algosu-service-debug`)에서 서비스 로그가 조회되지 않는 문제 해결.

## 버그 분석

복합 버그 3개가 중첩되어 로그 파이프라인이 완전히 무작동 상태였다.

### 1. Promtail 레이블 불일치
- 대시보드 쿼리: `{namespace="algosu", pod=~"${service}.*"}`
- Promtail은 `static_configs`만 사용 → `pod` 레이블을 부여하지 않음
- 결과: 쿼리 매칭 0건

### 2. NetworkPolicy 차단
- `default-deny-ingress`가 모든 Pod의 inbound 트래픽 차단
- Loki 전용 ingress 허용 정책 미존재 → Promtail이 Loki에 연결 불가 (`connection refused`)
- Sprint 56 NetworkPolicy 도입 시 Loki가 누락되었음

### 3. structured_metadata 비호환
- Promtail이 `traceId`를 structured_metadata로 전송
- Loki config `allow_structured_metadata: false`와 충돌
- 결과: `HTTP 400 Bad Request` — 로그 전량 드롭

## 작업 요약
| 커밋 | 내용 |
|------|------|
| `f801475` | Promtail Kubernetes SD 전환 — pod/app 레이블 수집 |
| `981e2d6` | Loki ingress NetworkPolicy 추가 + structured_metadata 제거 |

## 수정 내용

### Promtail (`infra/k3s/monitoring/promtail.yaml`)
- `static_configs` → `kubernetes_sd_configs` (role: pod)
- `spec.nodeName=${HOSTNAME}` 셀렉터로 현재 노드 Pod만 수집 (DaemonSet 표준)
- `-config.expand-env=true` 플래그 + `HOSTNAME` env 주입 (downwardAPI)
- `relabel_configs`로 pod/app/container/namespace 자동 레이블링
- `__path__` 경로를 Pod UID 기반으로 동적 생성 (`/var/log/pods/*<uid>/<container>/*.log`)
- `structured_metadata: traceId` 제거 (Loki 호환)

### NetworkPolicy (`infra/k3s/service-network-policies.yaml`)
- `loki-ingress` 추가: Promtail, Grafana에서 Loki 3100 포트 접근 허용

## 검증
1. Promtail targets: `24/38 active targets` → 정상 수집
2. Loki pod labels: `18개 Pod 레이블 수집`
3. 대시보드 쿼리 `{namespace="algosu", pod=~"gateway.*"}` → 실제 로그 반환 확인

## 결정
- **DaemonSet 표준 패턴 유지**: `spec.nodeName=${HOSTNAME}` 셀렉터 사용 (단일 노드에서도 표준 패턴 적용)
- **structured_metadata 미사용**: `traceId`는 로그 본문 JSON에 포함되어 있으며 Grafana에서 `line_format`으로 추출 가능. Loki 설정 변경은 비용 대비 효용 낮음
- **NetworkPolicy는 별도 정책으로 추가**: 기존 `metrics-network-policy.yaml`에 넣지 않고 `service-network-policies.yaml`에 추가 (서비스 간 정책 집중 관리)

## 교훈
- 로그 파이프라인 디버깅은 **end-to-end 각 단계**를 독립적으로 검증해야 한다
  - Promtail SD → Promtail push → Loki ingestion → Loki query → Grafana render
- `default-deny-ingress` 도입 시 **모든 의존 통신 경로**를 NetworkPolicy로 명시해야 함 (Loki 누락 사례)
- Promtail 2.9.8은 DaemonSet 기본값에서 `spec.nodeName=<pod-name>` 오설정을 자동 생성 → 명시적 `selectors` 필요
- Loki의 `allow_structured_metadata: false`는 Promtail의 `structured_metadata:` 파이프라인과 충돌 — 두 설정을 함께 검토해야 함
