---
sprint: 138
title: "demo-seed ConfigMap 자동 동기화 — Kustomize configMapGenerator + 3 DB 분리"
date: "2026-04-27"
status: completed
agents: [Oracle, Conductor]
related_adrs: ["sprint-137"]
---

# Sprint 138: demo-seed ConfigMap 자동 동기화

## Sprint Goal

Sprint 137 후속 시드 — `infra/k3s/demo-reset-cronjob.yaml`의 ConfigMap이 `SELECT 1;` placeholder
상태로 남아있던 문제를 해소한다. `scripts/demo-seed.sql`을 단일 SSoT로 두고
Kustomize `configMapGenerator`로 ConfigMap을 자동 생성하여, 6시간 주기 CronJob이
**항상 최신 seed**를 반영하도록 자동화한다.

## 배경

### Sprint 137 잔여 문제

Sprint 137에서 데모 계정 아바타 broken image는 해소했으나, 운영 환경 데모 자동 리셋 파이프라인은
여전히 placeholder ConfigMap(`data: { demo-seed.sql: "SELECT 1;" }`)을 참조하고 있었다.
즉 CronJob이 6시간마다 동작해도 실제 seed가 적용되지 않아, 운영 데모 환경에서 동일한 broken image
상태가 재발할 가능성이 잠재해 있었다.

### 구조적 원인

- `scripts/demo-seed.sql` (코드 SSoT) ↔ `demo-reset-cronjob.yaml` 내 inline ConfigMap (운영 SSoT) 이중화
- 코드 변경 시 yaml ConfigMap을 **수동 동기화**해야 했고, Sprint 137 시점에 누락 발생

## 수정안

### 옵션 A (채택): Kustomize configMapGenerator + 3 DB 분리

`infra/k3s/kustomization.yaml`에 `configMapGenerator`를 추가하여 `scripts/demo-seed-*.sql`
파일을 직접 ConfigMap 데이터로 등록. `disableNameSuffixHash` 옵션으로 ConfigMap 이름이
컨텐츠 해시로 변동되는 것을 막아 CronJob이 정적 이름으로 참조 가능하게 한다.

동시에 `scripts/demo-seed.sql` 단일 파일 → 3개 DB 분리:
- `scripts/demo-seed-identity.sql` — identity-service DB seed
- `scripts/demo-seed-problem.sql` — problem-service DB seed
- `scripts/demo-seed-submission.sql` — submission-service DB seed (구 `demo-seed.sql`에서 분리)

각 DB별 ConfigMap을 독립적으로 마운트하여 CronJob이 서비스별 DB에 정확한 seed만 주입.

**채택 이유**: 코드 SSoT와 운영 SSoT 일원화 + 향후 seed 변경 시 자동 반영 + DB 경계 명확화.

### 옵션 B (미채택): 단일 ConfigMap inline 유지 + CI 동기화 검증

CI에서 `scripts/demo-seed.sql`과 yaml inline ConfigMap의 동등성을 검증하는 스크립트 추가.
**미채택 이유**: 이중화 자체는 유지되어 동기화 누락의 근본 원인 미해소. CI 가드는 결국 사후 검증.

## 변경 내역

| 파일 | 라인 | 변경 |
|------|------|------|
| `infra/k3s/kustomization.yaml` | +9 | `configMapGenerator` 3종 추가 (identity/problem/submission) + `disableNameSuffixHash` |
| `infra/k3s/demo-reset-cronjob.yaml` | -18 / +18 | placeholder ConfigMap 섹션 제거 + 3개 ConfigMap 마운트 참조로 갱신 |
| `scripts/demo-seed-identity.sql` | +63 | identity-service DB seed 신규 (구 `demo-seed.sql`에서 분리) |
| `scripts/demo-seed-problem.sql` | +121 | problem-service DB seed 신규 |
| `scripts/demo-seed.sql` → `scripts/demo-seed-submission.sql` | rename / -182 | submission-service 영역만 잔존 |

- **총 변경**: 5 files / +207 -186 (rename 1)
- **브랜치**: `fix/sprint-138-demo-seed-configmap-sync` → PR #176 → Squash merge (main 직접 commit 0건 ✅)

## 검증 결과

| 항목 | 결과 |
|------|------|
| `kubectl kustomize build` | ConfigMap 3종 정상 생성 (identity/problem/submission) |
| ConfigMap 이름 안정성 | `disableNameSuffixHash` 적용 — 컨텐츠 변경 시에도 이름 고정 |
| CronJob 마운트 | 3개 ConfigMap 정확히 참조 |
| 다른 manifest 회귀 | 0건 |
| CI | 모든 체크 통과 (mergeStateStatus CLEAN) |

## 의사결정

### D1: 옵션 A 채택 — Kustomize configMapGenerator + 3 DB 분리

코드 SSoT(`scripts/demo-seed-*.sql`)와 운영 ConfigMap을 빌드 타임에 자동 동기화하여
이중화 자체를 제거. CronJob이 6시간마다 자동 실행되므로 **머지 → ArgoCD sync → 다음 CronJob 실행**
시점에 최신 seed가 자동 반영된다.

DB별 분리는 서비스 경계와 일치시켜 향후 단일 DB seed 변경이 다른 DB에 영향을 주지 않도록 격리.

### D2: `disableNameSuffixHash` 적용

기본 `configMapGenerator`는 ConfigMap 이름에 컨텐츠 해시 suffix를 붙인다(`demo-seed-identity-h7g8f9...`).
이는 ConfigMap 갱신 시 자동 롤아웃 트리거에 유리하지만, CronJob이 **정적 이름**으로 ConfigMap을
참조해야 하는 본 케이스에서는 매번 yaml 갱신이 필요해진다. `disableNameSuffixHash: true`로
이름을 고정하여 CronJob 참조를 단순화.

### D3: Critic 미호출

인프라 yaml 단순 구조 변경(파일 분리 + Kustomize 기능 활용)이며, 신규 비즈니스 로직 0건.
Critic 정의(코드 정확성·동시성·데이터 무결성·롤백 가능성)의 검토 대상에 해당하지 않는다.
Sprint 131/132/133/134/136/137 동일 정책 적용.

## 머지 정보

- PR: [#176](https://github.com/tpals0409/AlgoSu/pull/176) — MERGED 2026-04-27
- Squash commit: `71d1153`
- start_commit: `3c92997` (Sprint 137 종료 시점)
- end_commit: `71d1153` (origin/main, 2026-04-27)
- 브랜치: `fix/sprint-138-demo-seed-configmap-sync` (Squash merge 후 자동 삭제 예정)

## 산출물

- `infra/k3s/kustomization.yaml` (수정 — `configMapGenerator` 추가)
- `infra/k3s/demo-reset-cronjob.yaml` (수정 — placeholder 제거)
- `scripts/demo-seed-identity.sql` (신규)
- `scripts/demo-seed-problem.sql` (신규)
- `scripts/demo-seed-submission.sql` (rename from `demo-seed.sql`)
- ADR: 본 문서 (`docs/adr/sprints/sprint-138.md`)

## Sprint 139+ 이월

### 누적 시드 (Sprint 135부터 이월 유지, Sprint 138 후 미해소)

- [ ] github-worker errorFilter wrapper + WeakSet 동기화 (Wave A 일관성 회복)
- [ ] ai-analysis Python CB schema 통일 (state 0/0.5/1 → 0/1/2 + name label)
- [ ] CLAUDE.md `"ai-feedback"` → 실제 `"ai-analysis"` 명명 정정
- [ ] E2E 자동 PR CI 통합 (Sprint 134 이월 유지)

### 별건 처리 필요

- [ ] `docs/adr/sprints/sprint-136.md` untracked 상태 — Sprint 136 종료 시점 작성됐으나 미커밋 (별도 Housekeeping PR 필요)

### 운영 검증 후속

- [ ] 머지 후 ArgoCD sync 확인 + CronJob 다음 실행 시점에 데모 로그인 broken image 회복 검증 (운영 환경 작업)
