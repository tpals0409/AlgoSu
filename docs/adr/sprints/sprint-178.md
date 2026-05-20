---
sprint: 178
title: "problem category 입력 UI 회수 (Sprint 151 미연결 갭)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-177", "sprint-151"]
related_memory: ["sprint-window"]
---
# Sprint 178 — problem category 입력 UI 회수

## 목표

- Sprint 177에서 이월한 계획(plan 템플릿 잔여 · 블로그 cross-check 추가 차원)을 착수했으나, 탐색 결과 **둘 다 막다른 길**임이 드러나 방향을 전환했다.
  - plan 템플릿 잔여: PR 템플릿(`.github/pull_request_template.md`)·스크립트(`check-adr-index-count.mjs`)에 이미 구현 완료 → 작업 거리 없음.
  - 블로그 cross-check 추가 차원(reference-style 링크): 블로그 전체에서 **사용 0건**, frontmatter도 20개 글 균일 → 사용되지 않는 패턴을 위한 방어 게이트라 실효성 낮음(Sprint 177 교훈 "결정론적 검증 가능 + false-positive 회피 1순위"에 비춰 우선순위 하).
- 대신 이월 시드 잔재 중 **명확한 기능 갭**인 problem category 입력 UI를 회수. 정석 사이클(단일 작업 브랜치 + PR + Squash merge + Critic) 준수.

## 결정

### D1. 단순 UI 추가가 아니라 "절반 구현" 기능 갭 회수 (사용자 승인)

Sprint 151에서 SQL Kit 지원을 위해 `ProblemCategory`(ALGORITHM/SQL)를 **백엔드 entity·DTO·service·DB 마이그레이션 + frontend API 타입**까지 깔았으나, **frontend create/edit 폼이 `category`를 전송하는 경로가 누락**되어 있었다. 백엔드는 `dto.category ?? ProblemCategory.ALGORITHM`(`problem.service.ts:67`)로 입력에만 의존하고 sourceUrl 기반 자동 추론 로직이 없으며, 검색 훅(`useProgrammersSearch`)·`programmersApi` 결과에도 category가 없다. 결과적으로 **모든 신규/수정 문제가 ALGORITHM으로 저장**되어 SQL 문제를 등록할 방법이 없는 상태였다. 본 스프린트는 이 미연결 갭을 회수한다.

### D2. category는 순수 수동 선택 — difficulty의 "검색 적용 시 disabled" 패턴 미적용

difficulty는 BOJ/Programmers 검색 결과가 채우므로 검색 적용 시 `disabled`된다. category는 검색이 채우지 않고 자동 추론도 없으므로 **항상 활성인 수동 select**(`disabled={isSubmitting}`만)로 두고 기본값 ALGORITHM을 가진다. 검색 패턴을 무비판적으로 복제하지 않고 데이터 흐름의 실제 차이에 맞춘다.

### D3. native `<select>` 재사용 + i18n 라벨 — components/ui 신규 생성 없음

difficulty/status가 쓰는 native `<select>` + `selectClass`(`problem-form-utils.ts`) 패턴을 그대로 재사용해 `components/ui/` 신규 컴포넌트 생성을 피한다(Palette 가이드 회피, `_base.md` 규칙). 라벨은 difficulty(고유명사 상수)·status(기존 한국어 하드코딩 기술부채)와 달리 신규 코드이므로 **i18n(`problems.form.category.*`, ko/en)**으로 영문 환경까지 정석 지원한다. 상수 SSOT는 `PROBLEM_CATEGORIES`(`constants.ts`), Zod는 `z.enum(PROBLEM_CATEGORIES)`로 타입 안전.

## 구현

### PR #309 `20295e7` — problem 생성/수정 category 입력 UI (9파일 +94/-2)

- `lib/constants.ts`: `PROBLEM_CATEGORIES`(SSOT 튜플) + `ProblemCategory` 파생 타입.
- `lib/schemas/problem.ts`: `problemCreateSchema`에 `category: z.enum(PROBLEM_CATEGORIES)` 추가. `.default()`는 z.input/z.output 타입 분리로 RHF resolver와 충돌해 required enum 유지.
- `create/page.tsx`: defaultValues/reset에 `category: 'ALGORITHM'` + category select + onSubmit `data.category` 전송.
- `edit/page.tsx`: `EditFormState.category` + load 시 `data.category ?? 'ALGORITHM'` prefill + select + diff 기반 전송.
- `messages/{ko,en}/problems.json`: `categoryLabel` + `category.ALGORITHM/SQL`.
- 테스트: create(렌더+기본값 ALGORITHM), edit(prefill SQL), schema(enum 유효/무효), constants mock에 `PROBLEM_CATEGORIES` 추가.

## Critic 사이클

`codex review --base main` 1라운드 (session `019e453e-d1bd-78b3-806b-224e3fb9e60a`): **0건** — "category support를 create/edit 폼·번역·상수·스키마 검증에 추가하며 영향 흐름에 명확한 회귀나 breakage를 도입하지 않음". 머지 가능.

## 검증

### 로컬
- `tsc --noEmit` 통과.
- ESLint 신규 경고 0 (기존 플랫폼 토글 인라인 style만 baseline).
- jest 1361 통과 / 0 실패.
- 커버리지 게이트: Lines 86.46%(≥83), Branches 77.49%(≥71), JEST_EXIT=0.

### CI
- PR #309 "CI — Test, Build & Push" `conclusion: success` (전 job green).

## 결과

- **머지**: origin/main `06ebcc2` → `20295e7` (PR #309 squash merge, 작업 브랜치 삭제).
- **순변경**: frontend 9파일 +94/-2 (상수/스키마/create·edit page/i18n/테스트).

## 신규 패턴

- **"절반 구현" 기능 갭 회수**: 백엔드·타입·DB가 한 기능을 위해 갖춰졌어도 frontend 전송 경로 한 줄이 빠지면 기능 전체가 silent하게 무력화(전부 기본값 저장)된다. API 타입에 필드가 존재한다고 실제 전송된다는 보장은 없다 — 데이터 흐름 양 끝(폼 → DTO → service)을 추적해야 갭이 보인다.
- **패턴 재사용 시 데이터 흐름 차이 확인**: 인접 필드(difficulty)의 UI 패턴을 재사용하되, disabled 조건처럼 데이터 출처(검색 자동 채움 vs 수동)가 다른 부분은 복제하지 않고 분기한다.

## 교훈

- **탐색이 계획을 무효화할 수 있다**: 이월 계획 2건이 모두 막다른 길(이미 구현 / 사용 0건)임을 착수 탐색이 드러냄 → 방향을 즉시 재설정. 계획은 가설이고 코드베이스 현재 상태가 판정자다.
- **"단순 UI 추가"가 사실 기능 갭이었다**: category UI를 단순 select 추가로 보고 시작했으나, onSubmit 추적에서 전송 경로 자체가 없음을 발견 → 작업의 실제 가치(SQL 문제 등록 불가 해소)가 드러남.

## 이월 항목 (Sprint 179+)

- **UAT 사용자 직접**: PR #309 category 폼 제출→백엔드 저장 / edit prefill / `/en` 라벨 표기 / SQL 선택 시 Sprint 151 자동 언어 선택 연동 + Sprint 160~177 누적.
- 기타 후속(sprint-177 §이월 계승): coverage-gate skipped 허용 제거, post-merge pre-deploy gate, prom-client 점검 자동화, `.claude-tools/` Phase 2 삭제, `(adr)` layout 분할, Programmers URL 자동 카테고리 추론, 기존 SQL 문제 데이터 백필 등.
