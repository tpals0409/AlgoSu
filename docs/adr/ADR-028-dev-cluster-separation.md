# ADR-028: 개발 서버(k3d/별도 dev cluster) 분리 — 운영 직접 수정 차단 구조

- **상태**: 제안됨 (Proposed)
- **날짜**: 2026-04-25
- **스프린트**: Sprint 130 (Wave +개발서버 — 다음 Sprint 시작점 ADR)
- **의사결정자**: Oracle (심판관)
- **사용자 요청**: 2026-04-25 "서버에서 직접 수정하는것이 좋은 방향은 아니기 때문에"
- **관련**: ADR-027 (aether-gitops 브랜치 규율), ADR-026 (인시던트 종합)

---

## 컨텍스트

### 현재 작업 환경
- **운영 cluster**: OCI ARM (Ubuntu 24.04, k3s v1.34.4)
- **Claude Code 실행 위치**: 운영 cluster와 동일한 OCI ARM 인스턴스 (kubeconfig 권한 = cluster-admin)
- **개발 환경**: k3d (로컬 머신용으로 명시되어 있으나 실제 사용 빈도 불명, 메모리에 동기화 부재)
- 결과: 운영 cluster에 직접 `kubectl patch / edit / apply / rollout restart` 가능한 환경에서 모든 진단·작업이 일어남

### 노출된 안티패턴 (Sprint 130)

**Wave A-2 트랙 1**: identity-service-secrets에 `GITHUB_TOKEN_ENCRYPTION_KEY` 누락 → SealedSecret 매니페스트 PR 머지했으나 controller unseal 실패 → **cluster Secret 직접 `kubectl patch`로 임시 회복**

**근본 문제**:
- GitOps 정합성 깨짐 (cluster ≠ 매니페스트 일시 상태)
- 변경 추적 불가 (kubectl 명령은 git history에 안 남음)
- 같은 작업을 다른 환경에서 검증할 수 없음 (운영 = 유일한 환경)
- **사고 시 blast radius 운영 100%**

### 사용자 우선순위 (직접 명시)
- "서버에서 직접 수정하는것이 좋은 방향은 아니기 때문에, 빠르게 이번 스프린트 내에서 문제를 해결하고, 이후 개발 서버에서 작업을 할 수 있도록 진행합니다."

---

## 결정

운영 cluster와 별도로 **개발 환경(dev)을 분리**한다. 모든 변경은 dev에서 검증 후 GitOps로 운영 반영한다.

### 옵션 비교

| 옵션 | 비용 | 운영 유사도 | dev↔prod 동기화 | 장단점 |
|---|---|---|---|---|
| **A. 로컬 k3d** | 무료 | 중 (ARM 차이) | 수동 (matrix 매니페스트) | 가장 가벼움. ARM/x86 차이 회귀 가능 |
| **B. 별도 OCI ARM 인스턴스 (dev)** | 추가 비용 | 높음 (동일 ARM/k3s) | semi-auto (sync script) | 운영 유사. 비용·리소스 부담 |
| **C. 운영 cluster 내 dev namespace** | 무료 | 매우 높음 | none (같은 cluster) | 운영과 격리 부족. 사고 blast 잔존 |
| **D. GitHub Codespaces / 외부 dev** | 무료~유료 | 중 | git-driven | 외부 의존, 네트워크 latency |

**권고**: Sprint 131에서 **A + B 조합** — 일상 개발은 k3d, 인시던트 검증은 dev OCI 인스턴스. 또는 OCI Free Tier 제약 검토 후 **B 단독**.

### 운영 cluster kubeconfig 제한
- 운영 cluster의 kubeconfig는 **read-only 권한**으로 제한 (get/describe/logs/exec 허용, patch/apply/edit/delete 차단)
- 변경 권한은 ArgoCD service account에 한정
- 운영 핫픽스가 부득이한 경우: ADR 별도 기록 + GitOps 사후 정합성 회복 PR 필수 (메모리 `feedback_avoid_prod_direct_edit.md` 정합)

### Claude Code 실행 환경 이전
- 현재: 운영 OCI ARM 인스턴스
- 이전 후: dev 환경 (k3d 또는 별도 인스턴스)
- 운영 데이터 진단 필요 시: 운영 read-only kubeconfig 별도 컨텍스트 사용

---

## 결과

### 긍정적
- 운영 직접 수정 안티패턴 **구조적으로 차단** (kubeconfig 권한)
- dev에서 사전 검증 후 운영 반영 → 사고 위험 감소
- Sprint 130 같은 "운영 cluster 직접 patch + 사후 GitOps 정합성 회복" 흐름 불필요
- 인시던트 재현 환경 제공 (운영 영향 없이 디버깅)

### 부정적
- dev 인프라 추가 비용 (옵션 B/D 선택 시)
- 매니페스트 동기화 복잡성 (dev/prod overlay 관리)
- 초기 setup 비용 (~1주일)
- 운영 진단 시 추가 단계 (kubeconfig switch)

### 중립
- ArgoCD selfHeal=true는 운영 cluster 그대로 유지 — 사고 시 자동 복구는 변하지 않음

---

## 구현 작업 (Sprint 131 시작점)

1. **dev 환경 옵션 결정** — 사용자/PM 검토 후 A/B/C/D 중 선택
2. **dev cluster 셋업** (선택된 옵션 따라)
3. **운영 kubeconfig read-only 분리** (sealed-secrets-controller / ArgoCD service account 외 모두 read-only)
4. **Claude Code 실행 환경 이전** (dev 환경으로)
5. **검증** — 1주일 운영 + 변경 흐름 안정성 평가

담당: Architect (인프라 설계) + Gatekeeper (kubeconfig 권한 분리)

---

## 참조
- ADR-026 (Sprint 130 인시던트 종합 — 운영 직접 patch 안티패턴 사고 사례)
- ADR-027 (aether-gitops 브랜치 규율 — 본 ADR과 합쳐 GitOps 정합성 가드 이중화)
- 메모리: `feedback_avoid_prod_direct_edit.md`
- CLAUDE.md "k3d(개발) / k3s(운영, OCI ARM)" 분리 원칙 (현재 미실현)
