---
sprint: 137
title: "데모 계정 아바타 이미지 누락 수정 — seed 미존재 자산 참조 정정"
date: "2026-04-27"
status: completed
agents: [Oracle, Conductor]
related_adrs: []
---

# Sprint 137: 데모 계정 아바타 이미지 누락 수정

## Sprint Goal

데모 계정(`demo-alice`, `demo-bob`, `demo-charlie`) 로그인 시 아바타 이미지가 404로 깨지는 문제를 진단하고,
최소 변경으로 실존 자산을 참조하도록 seed 데이터를 정정한다.

## 배경

### 원인 진단

`scripts/demo-seed.sql` L48-50 에서 데모 3명의 `avatar_url` 값이 `preset:avatar-1`, `preset:avatar-2`, `preset:avatar-3`으로 설정되어 있었다.

그러나 `frontend/src/lib/avatars.ts`의 `AVATAR_PRESETS` 화이트리스트에는 해당 키가 존재하지 않는다.
프론트엔드는 프리셋 키로 `/avatars/{key}.svg` 경로를 구성하는데,
`avatar-1/2/3.svg` 자산이 `public/avatars/` 디렉토리에 없어 HTTP 404가 발생했다.

**정리**: seed → DB → API → 프론트엔드 → `/avatars/avatar-{n}.svg` 404 → broken image

### 영향 범위

데모 로그인 페이지에서 세 계정 모두 아바타 broken image 상태. 기능 로직(제출·AI 분석·피어 리뷰)에는 영향 없음.

## 수정안

### 옵션 A (채택): seed 데이터 정정 — 실존 자산 키로 교체

`preset:avatar-1/2/3` → `preset:tree/graph/sort` 교체.
`tree`, `graph`, `sort`는 `AVATAR_PRESETS` 화이트리스트에 등록된 키이며 `/avatars/{key}.svg` 자산이 실재한다.

**채택 이유**: 변경 범위 최소(1 file, 3줄), 기존 아바타 시스템과 완전 일관성, 사이드 이펙트 0건.

### 옵션 B (미채택): 미존재 자산 신규 추가

`avatar-1/2/3.svg` 파일을 `public/avatars/`에 신규 생성 + AVATAR_PRESETS 등록.
**미채택 이유**: 디자인 에셋 결정이 필요하고 변경 범위가 불필요하게 넓어짐. seed 값이 화이트리스트 외 키를 사용하는 구조적 문제는 옵션 A로도 해결 가능.

### 옵션 C (미채택): AVATAR_PRESETS 비검증 fallback 추가

화이트리스트 미등록 키도 허용하는 방어 로직 추가.
**미채택 이유**: 무결성 검증 레이어를 약화시키며, 오히려 미래 seed 오류를 은폐할 위험.

## 변경 내역

| 파일 | 라인 | 변경 |
|------|------|------|
| `scripts/demo-seed.sql` | L48-50 | `preset:avatar-1/2/3` → `preset:tree/graph/sort` (+3 / -3) |

- **총 변경**: 1 file / +3 -3 (net diff 0)
- **브랜치**: `fix/sprint-137-demo-avatar-seed` → PR → Squash merge (main 직접 commit 0건 ✅)

## 검증 결과

| 항목 | 결과 |
|------|------|
| 자산 실재 | `/avatars/tree.svg`, `/avatars/graph.svg`, `/avatars/sort.svg` 존재 확인 |
| AVATAR_PRESETS | `tree`, `graph`, `sort` 키 화이트리스트 등록 확인 |
| jest | 1361 passed (회귀 0건) |
| tsc | clean |
| lint | clean |
| CI | 27 pass / 12 skipping / 0 fail |
| mergeStateStatus | CLEAN |

## 의사결정

### D1: 옵션 A 선택 — seed 데이터 단순 정정

변경 범위가 1 file 3줄로 최소화되고, 실존 자산 + 화이트리스트 등록 키 사용으로 시스템 일관성이 즉시 회복된다.
신규 로직·아키텍처 변경이 없으므로 가장 안전한 경로.

### D2: Critic 미호출

변경 내용이 seed 데이터 문자열 3줄 교체에 불과하며, Critic 정의(코드 정확성·동시성·데이터 무결성·롤백 가능성)의
검토 대상에 해당하지 않는다. Sprint 131/132/133/134/136 동일 정책 적용.

## 머지 정보

- PR: [#174](https://github.com/tpals0409/AlgoSu/pull/174) — MERGED 2026-04-27
- Squash commit: `aaf6f7f`
- start_commit: `f580ce8` (Sprint 136 종료 시점)
- end_commit: `aaf6f7f` (origin/main, 2026-04-27)
- 브랜치: `fix/sprint-137-demo-avatar-seed` (Squash merge 후 자동 삭제)

## 산출물

- `scripts/demo-seed.sql` (수정)
- ADR: 본 문서 (`docs/adr/sprints/sprint-137.md`)

## Sprint 138+ 이월

### 신규 시드 (Sprint 137 발생)

- [ ] `infra/k3s/demo-reset-cronjob.yaml` ConfigMap seed가 `SELECT 1;` placeholder 상태 — 운영 환경 자동화 시 `scripts/demo-seed.sql` 내용으로 갱신 필요

### 누적 시드 (Sprint 135부터 이월 유지)

- [ ] github-worker errorFilter wrapper + WeakSet 동기화 (Wave A 일관성 회복)
- [ ] ai-analysis Python CB schema 통일 (state 0/0.5/1 → 0/1/2 + name label)
- [ ] CLAUDE.md `"ai-feedback"` → 실제 `"ai-analysis"` 명명 정정
- [ ] E2E 자동 PR CI 통합 (Sprint 134 이월 유지)
