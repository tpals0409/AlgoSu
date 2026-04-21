---
sprint: 105
title: "CI 실측 데이터 확보 + 운영 규약 표준화 + 커밋 게이트 자동화"
date: "2026-04-21"
status: completed
scope: "rebuild_all 운영 규약 [A] + github-worker 실측 [B] + commitlint pre-commit 자동화 [C]"
start_commit: e520bb9
end_commit: 745fbbc
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
| [A] Sprint 105 ADR | Scribe | ✅ 완료 | 본 문서 |
| [B] dummy touch PR + rebuild_all 트리거 | Sensei | ✅ 완료 | PR #117 (`6f42b0f`) + run 24703075569 |
| [B] 실측 집계 + 비교표 소급 갱신 | Sensei | ✅ 완료 | `sprint-103.md`, `sprint-104.md` 소급 갱신 |
| [B] Sensei 실측 보고서 | Sensei | ✅ 완료 | `~/.claude/oracle/inbox/sensei-sprint-105-timing.md` |
| [C] root package.json + husky + 동적 scope-enum | Architect | ✅ 완료 | `package.json`, `.husky/commit-msg`, `commitlint.config.mjs` (PR #116) |
| [C] git-hooks 런북 | Architect | ✅ 완료 | `docs/runbook-git-hooks.md` (PR #116) |
| PR 생성/머지 | Postman | ✅ 완료 | PR #115 / #116 / #117 / #118 |

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

## [B] 측정 완료 결론

Sprint 103 파일럿부터 Sprint 105까지 3스프린트에 걸쳐 이월됐던 github-worker 실측이 최종 완료됐다. PR #117(`6f42b0f`)의 더미 앵커 주석으로 `detect-changes`를 트리거한 자연 런 2건(run 24702740418·24702828670)과 `workflow_dispatch(rebuild_all=true)` 합성 런 1건(run 24703075569)을 합쳐 Post n=3을 확보했으며, Pre n=4 대비 Quality +0.4% / Audit -8.9% / Test +3.9%로 전 잡이 ±10% 실용 임계 이내였다. Welch t-test 결과 3잡 모두 |t_obs| < 0.7 (t_crit=2.776) — composite action 확산은 github-worker 개별 잡 런타임에 측정 가능한 영향을 미치지 않음이 확인됐다. sprint-103.md·sprint-104.md 비교표의 `측정 불가¹` 셀은 실측 평균으로 소급 갱신됐으며, CI 리팩토링 4스프린트(102~105) 로드맵의 모든 측정 의무가 이로써 종결된다.

## [C] commitlint 자동화 결정 근거

### 문제 정의

Sprint 105 이전까지 commitlint는 CI의 `wagoid/commitlint@v6` 잡에서만 검증됐다. 개발자가 잘못된 scope/type으로 commit하면 PR 제출 후에야 발견되어 force-push로 재작성해야 했다. 또한 `commitlint.config.mjs:18-26`의 scope-enum 16개는 정적 하드코딩이라 새 서비스 디렉토리를 추가할 때마다 누락되기 쉬웠다 (`feedback-commitlint-scope.md` 피드백의 반복 원인).

### 결정

**husky + commit-msg hook + 동적 scope-enum**. 대안 비교:

| 방안 | 장점 | 단점 | 선택 여부 |
|------|------|------|-----------|
| husky + commitlint (채택) | root 단일 설정, 분산 monorepo 자연스러움, ESM config 재사용 | root `package.json` 신규 필요 | ✅ 채택 |
| lefthook | Go 바이너리로 경량 | 각 서비스 디렉토리에 `lefthook.yml` 분산 필요, Node 환경과 이질 | ❌ 기각 |
| pre-commit (Python) | 범용 | Python 도구 추가 → Node 중심 레포에 이질 | ❌ 기각 |

### scope-enum 동적 생성

`fs.readdirSync('./services', { withFileTypes: true })` + `isDirectory()` 필터로 런타임에 서비스 목록을 생성. 정적 scope 10개(`ci`, `docs`, `blog`, `frontend`, `infra`, `deps`, `security`, `adr`, `e2e`, `runbook`)와 병합 후 `.sort()`. 이로써 새 서비스 디렉토리 생성만으로 scope가 자동 등록된다. `feedback-commitlint-scope.md`의 "새 디렉토리 추가 시 scope-enum도 함께 등록"이라는 사람 의존 피드백이 구조적 자동화로 승격됐다.

### CI 영향

root `package.json` 추가에도 기존 CI 잡은 모두 `working-directory` 지정 또는 composite action 경유라 영향 없음 (PR #116 전체 잡 SUCCESS로 검증).

### 영향 파일 (커밋 `0b916cf`)

| 파일 | 작업 | 설명 |
|------|------|------|
| `package.json` | 신규 | root devDependencies: @commitlint/cli + config-conventional + husky |
| `.husky/commit-msg` | 신규 | `npx --no -- commitlint --edit "$1"` |
| `commitlint.config.mjs` | 수정 | scope-enum 정적 16개 → 동적 services/ + static 10 |
| `docs/runbook-git-hooks.md` | 신규 | 설치·트러블슈팅·CI 영향 분석 |

## 주요 교훈

1. **런북은 즉시 리허설돼야만 검증된다** — `docs/runbook-ci-rebuild-all.md`([A])는 머지 2시간 내 [B] 합성 run 실행으로 리허설됐다. 절차의 공백(예: 결과 검증 보고서 경로 명시 방식)은 리허설 없이는 발견되지 않는다. 인프라 런북 머지 → 최초 사용례를 동일 스프린트 내 배치하는 것이 문서 품질 보증의 최선.

2. **Pre 샘플이 통계적 MDE의 지배적 병목** — Welch-Satterthwaite 공식에서 Pre n=4가 df를 4로 고정하므로 Post n을 2→6으로 늘려도 MDE 개선 0.8s에 그친다. 원안 N=4는 오버엔지니어링. Sensei 자문 → N=1로 축소 → runner-minutes 75% 절감. "합성 샘플 다수 확보"보다 "Pre 샘플의 역사적 확보"가 투자 효율이 크다.

3. **CI timing은 실용적 유의성 기준이 현실적** — GitHub Actions 런너 jitter(±5~10s)와 소규모 표본 제약 때문에 formal significance(p<0.05)는 구조적으로 달성 불가. 3잡 모두 `|t_obs| < 0.7` / Delta ±10% 이내라는 실용 기준을 병기해 결론을 도출했다. n≥20 이상 요구되는 formal 기준을 단일 스프린트에서 시도하는 것은 비현실적.

4. **사람 의존 피드백은 시스템 자동화로 승격한다** — `feedback-commitlint-scope.md`는 "새 디렉토리 추가 시 scope-enum도 함께 등록"이라는 반복 피드백이었다. `services/` 디렉토리 동적 스캔으로 피드백 자체가 구조적으로 해소됨. 피드백 메모리는 자동화 완료 시 "구조적 해결" 상태로 승격/제거 대상.

5. **Oracle의 Sensei 선(先)자문 패턴은 N=1 의사결정 비용을 뒤집는다** — 플랜 원안 N=4 → 사용자 승인 → 실행 절차 대신, "Sensei에게 샘플 사이징 자문 → 결과 보고 → N 재결정" 2단계 분할로 runner 비용 75% 절감 + 런북 리허설 가치 포함. "계획 승인 → 즉시 실행"이 항상 최적은 아니며 정량 분석 선행이 유효한 경우가 있다.

## 이월 항목 (Sprint 106+)

- L2 캐시 레이어 (build output) — 범위 정의 후 진행
- Frontend 빌드 최적화 — 범위 정의 후 진행 (Turbopack + `.next/cache`는 이미 활성)
- 글로벌 coverage threshold 60% → 70% 상향 검토 — 실측 데이터 기반 결정

## 레퍼런스

- Sprint 104 ADR: `docs/adr/sprints/sprint-104.md` §주요 교훈 1
- Sprint 104 ADR: `docs/adr/sprints/sprint-104.md` §이월 항목
- rebuild_all 런북: `docs/runbook-ci-rebuild-all.md`
- 승인된 Sprint 105 실행 계획: `/Users/leokim/.claude/plans/eventual-hugging-cocke.md`
- 채널톡 CI 리팩토링: https://channel.io/ko/team/blog/articles/backend-ci-refactoring-73fca77d
- Sensei Sprint 104 측정 보고서: `~/.claude/oracle/inbox/sensei-sprint-104-timing.md`
- Sensei Sprint 105 최종 측정 보고서: `~/.claude/oracle/inbox/sensei-sprint-105-timing.md`
