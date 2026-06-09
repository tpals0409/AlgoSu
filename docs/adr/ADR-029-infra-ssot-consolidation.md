---
topics:
  - cicd
---
# ADR-029: 인프라 배포 정의 SSOT를 aether-gitops로 일원화 (AlgoSu 평행 매니페스트 폐기)

- **상태**: 채택됨 (Accepted)
- **날짜**: 2026-06-09
- **스프린트**: Sprint 234
- **의사결정자**: Oracle (심판관)
- **사용자 요청**: 2026-06-09 "근본적인 문제 해결 방법" + "근본 해결하면서 안정성도 최대의 방향으로"
- **관련**: ADR-027 (aether-gitops 브랜치 규율), ADR-028 (dev cluster 분리), ADR-026 (인시던트 종합)

---

## 컨텍스트

표면 작업은 "loki Deployment 하드닝 갭 검증"이었으나, 라이브/gitops/미러 3자 비교 결과 하드닝 갭은 이미 해소된 상태였고 실제 문제는 더 깊은 구조에 있었다.

### 근본 원인: 하나의 시스템에 진실원천(SSOT)이 둘

- **운영 SSOT**: aether-gitops (`algosu/base/` + `algosu/overlays/prod/`) — ArgoCD가 이것만 sync
- **평행 정의**: AlgoSu 레포의 `infra/k3s/` (자체 kustomize base) + `infra/overlays/{dev,staging,prod}/` + `scripts/deploy.sh`

두 정의가 사람에 의해 독립 편집되어 필연적으로 어긋났다. `infra/k3s/monitoring`은 git log상 "미러 드리프트 재정합"으로 반복 수동 보정되는 만성 부채였다.

### divergence가 만든 실제 증상 (검증으로 확인)

- **prometheus-rules.yaml**: 미러 214줄(구버전) vs aether 297줄(정본) — 미러가 오히려 stale
- **grafana.yaml**: 미러가 하드닝(securityContext/probe) 보유, aether/운영엔 부재 — loki와 반대 방향
- **grafana-cb-dashboard.yaml**: 미러+CI에만 존재, aether/운영엔 누락 — circuit breaker 대시보드 영구 미반영
- **CB 알림 스키마 버그**: 운영 `CircuitBreakerOpen`(severity: critical) rule이 `== 1`(HALF_OPEN)에 묶여 실제 OPEN(=2)에 발사되지 않던 가용성 사각지대. 미러에만 올바른 `== 2` 수정이 있었음.

"미러를 자동 동기화"하는 것은 두 정의를 한 방향으로 맞추는 우회책일 뿐, 두 번째 정의가 존재하는 한 어긋남의 가능성은 영구히 남는다.

## 결정

**k8s 매니페스트 SSOT를 aether-gitops 하나로 일원화하고, AlgoSu 레포 내 평행 매니페스트 정의를 폐기한다.**

1. **평행 정의 흡수 후 폐기**: 미러에만 있던 실질 개선(CB 버그 수정, grafana 하드닝/probe/readOnlyRootFS, cb 대시보드, datasources uid)을 aether-gitops로 흡수한 뒤, `infra/k3s/` + `infra/overlays/`를 삭제.
2. **deploy.sh를 aether 기반으로 전환**: 긴급복구 스크립트가 aether-gitops를 clone하여 `kubectl apply -k overlays/prod`로 적용. 평행 정의 없이도 긴급복구 안전망 유지.
3. **검증을 SSOT에 직접 연결**: monitoring 검증 스크립트(`check-prometheus-rules.mjs`, `check-grafana-metrics.mjs`)가 `MONITORING_SRC` env로 aether-gitops를 직접 읽도록 재배선. CI는 aether sparse-checkout 후 주입.
4. **부수 발견 부채 해소**: prometheus에 configmap-reload sidecar 추가(rule 자동 reload), grafana strategy Recreate(PVC 멀티어태치 방지).
5. **보존**: postgres-init은 로컬 dev(docker-compose.dev.yml)가 마운트하므로 `infra/postgres-init/`로 이전. `infra/sealed-secrets/` 템플릿/문서 보존.

## 결과

### 긍정
- drift 원천을 구조적으로 제거 — 편집 가능한 진실원천이 하나(aether-gitops)로 수렴
- "검증과 배포가 같은 소스를 본다" — CI monitoring 검증이 운영 SSOT를 직접 게이트
- 잠복 운영 버그(CB 알림 무발사) + 누락(cb 대시보드) 해소
- 이중 유지보수(수동 미러 재정합) 비용 제거

### 부정 / 트레이드오프
- AlgoSu CI는 aether-gitops 매니페스트 변경을 더는 감지하지 못함 → 매니페스트 검증 책임을 aether-gitops 측으로 이전해야 함 (후속 과제)
- postgres-init이 dev(AlgoSu)와 운영(aether) 양쪽에 사본 2부로 존속

## 대안

- **미러 자동 파생(read-only 산출물화)**: 평행 트리를 유지하되 CI가 aether에서 기계 생성. divergence는 막지만 이중 구조와 유지비용이 남아 기각.
- **monitoring만 부분 동기화**: 근본이 아니며 나머지 평행 트리는 여전히 어긋날 수 있어 기각.

## 후속 과제

- aether-gitops 레포에 코드↔대시보드 cross-check job 이식 (매니페스트 검증 SSOT화)
- postgres-init dev/운영 사본 정합 lint
- grafana admin user/email은 안정성(로그인 동작 변경 리스크)·무가치로 흡수하지 않고 폐기 결정 — 필요 시 SealedSecret 경유 별도 도입
- 런북(monitoring-system-audit, gitops-migration, oncall-alerts, sp217 등) 내 `infra/k3s` 역사 참조 일괄 정리

### 미러 전용 미적용 정의 처리 (운영·aether 모두 부재였음)

미러에만 존재하고 운영에 한 번도 적용된 적 없던 정의들. 평행 정의가 만든 "작성됐으나 SSOT 미전파" 부채.

- **PDB** (gateway/identity/submission, minAvailable:1): 본 작업에서 aether 흡수 — 저위험 가용성 개선
- **HPA** (gateway/submission/ai-analysis, CPU 70%): replicas 관리 주체 변경(고정→오토스케일) + overlays patch 조정 + metrics-server 의존 → **별도 검증 작업으로 보류**
- **demo-reset CronJob** (6h 주기 DB seed 실행): `postgres-credentials` secret 의존 + 운영 데이터 영향 검토 필요 → **보류**
- **NetworkPolicy** (default-deny/metrics/service): 통신 차단 장애 리스크 → 서비스 간 통신 매트릭스 검증 후 **별도 도입**
- 보류분 정의는 git history(본 PR 직전 커밋)에 보존
