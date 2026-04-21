---
sprint: 105
title: "CI 실측 데이터 확보 + 운영 규약 표준화 + 커밋 게이트 자동화"
date: "2026-04-21"
status: in-progress
scope: "rebuild_all 운영 규약 [A] + github-worker 실측 [B] + commitlint pre-commit 자동화 [C]"
start_commit: e520bb9
---

# Sprint 105 — CI 실측 데이터 확보 + 운영 규약 표준화 + 커밋 게이트 자동화

## 배경

Sprint 104는 채널톡 CI 리팩토링 레퍼런스 원리 ⑤(확산 단계)를 완료했으나, 실측 데이터 확보에 실패했다. 원인은 명확하다: CI 인프라 PR(`.github/workflows/ci.yml` 단독 수정)이 `detect-changes` path-filter를 통과하지 못해 서비스 잡 전체가 skip됐다. Sprint 104 ADR 교훈 1은 이를 "CI 인프라 PR은 detect-changes skip으로 자기 자신의 실측 데이터를 생성하지 못한다"고 기록하고 표준 프로세스화를 Sprint 105로 이월했다.

Sprint 105는 CI 리팩토링 4스프린트 로드맵(102~105)의 **마감 스프린트**다. 세 가지 과제로 구성된다:

1. **[A] rebuild_all 운영 규약 표준화** — `workflow_dispatch.inputs.rebuild_all` 은 Sprint 103 시점부터 존재하나 언제/누가/어떻게 트리거하는지 규약이 부재했다. 이번 스프린트에서 런북과 PR 템플릿 체크박스로 규약을 제도화한다.
2. **[B] github-worker 실측 강제 수집** — rebuild_all 4회 + dummy touch PR 1회로 Post 5건 확보. sprint-103/104 비교표 "측정 불가¹" 칸을 실수값으로 갱신한다.
3. **[C] commitlint pre-commit 자동화** — CI 단계에서만 검증하던 commitlint를 로컬 commit 단계로 앞당기고, scope-enum을 `services/` 디렉토리 동적 생성 방식으로 전환해 수동 유지 제거.

## 목표

1. `docs/runbook-ci-rebuild-all.md` 신규 작성 — CI 인프라 PR 담당자가 따를 표준 절차 제공
2. `.github/pull_request_template.md` 체크박스 추가 — PR 오픈 시점부터 rebuild_all 계획 여부를 명시하도록 강제
3. github-worker 잡 Post 실측 5건 수집 → sprint-103/104 비교표 소급 갱신
4. root `package.json` + husky commit-msg hook + 동적 scope-enum으로 commitlint 로컬 자동화

## 작업 요약

| 작업 | 담당 | 상태 | 산출물 |
|---|---|---|---|
| [A] rebuild_all 런북 + PR 템플릿 체크박스 | Architect | ✅ 완료 | `docs/runbook-ci-rebuild-all.md`, `.github/pull_request_template.md` |
| [A] Sprint 105 ADR | Scribe | 🔄 진행 중 | 본 문서 |
| [B] dummy touch PR + rebuild_all 4회 실행 | Sensei | ⏳ 대기 | `services/github-worker/src/main.ts` |
| [B] 실측 집계 + 비교표 소급 갱신 | Sensei | ⏳ 대기 | `sprint-103.md`, `sprint-104.md` 갱신 |
| [B] Sensei 실측 보고서 | Sensei | ⏳ 대기 | `~/.claude/oracle/inbox/sensei-sprint-105-timing.md` |
| [C] root package.json + husky + 동적 scope-enum | Architect | ⏳ 대기 | `package.json`, `.husky/commit-msg`, `commitlint.config.mjs` |
| [C] git-hooks 런북 | Architect | ⏳ 대기 | `docs/runbook-git-hooks.md` |
| PR 생성/머지 | Postman | 🔄 진행 중 | PR #115 예정 |

## [A] 운영 규약 결정 근거

### 문제 정의 (Sprint 104 교훈 1)

`detect-changes` path-filter 최적화는 CI 비용을 절감하는 핵심 설계다. 그러나 이 설계는 CI 인프라 파일 자체를 수정하는 PR에서 역설적 공백을 만든다: 워크플로를 수정해도 그 워크플로가 실행하는 서비스 잡이 skip된다. PR #111(Sprint 103)과 PR #113(Sprint 104) 모두 이 경로로 실패했고, github-worker 실측 Post 데이터는 0건으로 남았다.

### 결정

`workflow_dispatch.inputs.rebuild_all=true`는 이미 `ci.yml:131-139`에 구현되어 있었다. 추가 코드 변경 없이 **운영 규약 문서화**만으로 표준 프로세스를 수립한다.

규약의 핵심 원칙:
- **발동 조건 3개** 명문화: `.github/workflows/*.yml` 단독 변경 / `.github/actions/**` composite 변경 / `scripts/check-coverage.mjs` 등 CI 공통 스크립트 변경
- **PR 템플릿 체크박스 삽입**: PR 오픈 시점부터 rebuild_all 계획 여부를 author가 명시하도록 강제 (사후 누락 방지)
- **금지 사례 명문화**: 서비스 코드 변경 PR에서 남용 시 GHA 비용 낭비 발생 → path-filter로 충분함을 명시

### 대안 비교

| 방안 | 장점 | 단점 | 선택 여부 |
|------|------|------|-----------|
| 런북 + PR 템플릿 (채택) | 구현 없음, 즉시 적용 가능, 의도 명시적 | 사람 의존 (체크리스트 기반) | ✅ 채택 |
| path-filter에 CI 파일 경로 추가 | 자동화 | 전 서비스 빌드가 CI PR마다 자동 발생 → 비용 증가 | ❌ 기각 |
| 별도 `ci-infra.yml` 워크플로 분리 | 관심사 분리 명확 | 워크플로 파일 분산, 유지보수 복잡도 증가 | ❌ 이월 검토 |

### 영향 파일 (커밋 `6d6233b`)

| 파일 | 작업 | 설명 |
|------|------|------|
| `docs/runbook-ci-rebuild-all.md` | 신규 | 용도·발동조건·실행절차·검증·금지사례 5개 섹션 |
| `.github/pull_request_template.md` | 수정 | 인프라 변경 섹션에 rebuild_all 체크박스 1줄 추가 |

## 레퍼런스

- Sprint 104 ADR: `docs/adr/sprints/sprint-104.md` §주요 교훈 1
- Sprint 104 ADR: `docs/adr/sprints/sprint-104.md` §이월 항목
- rebuild_all 런북: `docs/runbook-ci-rebuild-all.md`
- 승인된 Sprint 105 실행 계획: `/Users/leokim/.claude/plans/eventual-hugging-cocke.md`
- 채널톡 CI 리팩토링: https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d
- Sensei Sprint 104 측정 보고서: `~/.claude/oracle/inbox/sensei-sprint-104-timing.md`
