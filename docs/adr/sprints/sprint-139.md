---
sprint: 139
title: 문제 등록 UX 개선 — 캘린더 기반 등록 + 주차 자동 계산
status: completed
period: 2026-04-28
start_commit: 608e276
end_commit: b86dc08
pr: https://github.com/tpals0409/AlgoSu/pull/181
related_sprints:
  - sprint-99 (주차 계산 알고리즘 정립)
  - sprint-95 (백준 → 프로그래머스 이전 — 외부 종속성 회상)
---

# Sprint 139 — 캘린더 기반 문제 등록 + 주차 자동 계산

## 컨텍스트
사용자 피드백: "문제 추가 시 weekNumber를 직접 선택하던 두 단계 select 드롭다운 대신, 캘린더에서 마감일만 선택하면 주차는 프로그램 내부에서 자동 계산되도록 변경하자."

기존 흐름:
- 사용자가 `weekNumber` 드롭다운에서 "5월3주차" 선택 → 그 주에 속한 요일 select에서 deadline 선택
- DB에는 `week_number` varchar(20) 컬럼 + `deadline` timestamp가 별도 저장
- 한 도메인 개념(스터디 주차)을 사용자가 두 번 입력해야 하는 UX 마찰

## 결정 (옵션 A 채택)
**클라이언트가 deadline에서 weekNumber를 derive하여 API payload에 포함**.

| 옵션 | 변경 범위 | 채택 여부 |
|------|---------|-----------|
| A: 클라이언트 derive + backend payload 동봉 | frontend만 | ✅ 선택 |
| B: backend가 deadline에서 계산 | frontend + backend service | 별건 시드 |
| C: `week_number` 컬럼 제거, 항상 derive | frontend + backend + DB migration | 별건 시드 |

옵션 A를 선택한 이유:
- DB schema 무변경 — 기존 `findByWeekAndStudy` 등 backend 로직 그대로 유지
- 회귀 위험 최소화 (frontend 단일 도메인)
- 옵션 B/C는 더 깔끔한 SSoT 구조이지만 별건 스프린트로 분리

## 영향 범위 (3 진입점)
사용자 피드백의 "문제 추가 UI"는 사실상 **2곳**이었음 — 탐색 단계에서 (1)만 식별, 작업 중 (2) 발견:

1. `/problems/create` 풀스크린 페이지 (admin 전용)
2. `/problems` 목록 페이지의 `AddProblemModal` 모달 (더 일반적인 UI)
3. `/problems/[id]/edit` 수정 페이지 (대칭성 유지)

세 진입점 모두 동일 패턴(2단계 select)을 사용하고 있어 함께 변경.

## 변경 내역

### Wave A — 점검만 (별 commit 없음)
- 기존 `getCurrentWeekLabel(date: Date = new Date())` 시그니처가 이미 임의 Date 인자를 받음 → 신규 함수 추가 불필요, 그대로 재사용
- `getWeekOptions`/`getWeekDates`/`matchDeadlineToWeekDate`는 create/edit page에서만 사용 중 → Wave B/C 적용 후 제거 가능 확인

### Wave B+C+D — 통합 commit (`4dbae8f`)
schemas/utils 공유로 인해 atomic 변경 필요.

- `frontend/src/lib/schemas/problem.ts`: `weekNumber` 필드 제거
- `frontend/src/lib/problem-form-utils.ts`: `ProblemFormState`/`ProblemFormErrors`/`validateProblemForm`에서 weekNumber 제거
- `frontend/src/app/[locale]/problems/create/page.tsx`: 2단계 select → `<Calendar mode="single">` 단일 위젯, derived weekNumber 읽기 전용 표시
- `frontend/src/app/[locale]/problems/[id]/edit/page.tsx`: 동일 패턴
- i18n 신규 키: `problems.form.calculatedWeek` ("자동 계산: {week}" / "Auto-calculated: {week}")
- 테스트: Calendar/buttonVariants mock 추가, schemas/utils 테스트의 weekNumber 케이스 갱신

### `d1f4e49` — AddProblemModal 동일 변경
- `ConfirmStep`: 두 단계 select 제거, 캘린더 위젯 통합
- 미사용 헬퍼 제거: `generateWeekData`/`getWeekDateData`/`WeekOption`/`DateOption`/`DAY_KEYS` (-178 lines)
- 미사용 i18n 키 정리: `weekLabel`/`weekPlaceholder`/`deadlinePlaceholder`/`weekFormat`/`dateFormat`
- 테스트: `selectWeekAndSubmit` 헬퍼를 캘린더 클릭 패턴으로 갱신

### `9301354` — Sprint 139 cleanup
- `problem-form-utils.ts`: `getWeekOptions`/`getWeekDates`/`matchDeadlineToWeekDate`/`DAY_NAMES` 제거 (-76 lines)
- `problem-form-utils.test.ts`: 위 함수 describe 블록 제거 (-128 lines)
- create/edit page test의 stale `jest.mock` 항목 정리
- i18n 미사용 키 제거: `form.weekLabel`, `errors.validation.problem.weekNumberRequired`, `addModal.dayNames`, `addModal.validation.weekRequired`

### `a26f9d5` — Critic P1 수정
**Codex 리뷰가 P1 회귀 2건 적발**:
> create/edit 페이지의 `Calendar onSelect`에서 `date.toISOString()` 직접 호출 시 KST 등 UTC+ 타임존에서 local midnight으로 직렬화됨 → deadline이 의도한 날의 00:00에 만료되어 사실상 하루 전 종료 효과. 기존 select 방식은 23:59:59로 정규화했고, AddProblemModal에서도 동일 정규화를 적용했으나 create/edit 신규 코드에서 누락.

수정: AddProblemModal에서 이미 적용한 패턴 동일 적용:
```ts
const iso = date
  ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).toISOString()
  : '';
```

Critic 재검증 통과: "P1 회귀 해결, 추가 결함 없음".

## 검증
- `pnpm type-check` pass (frontend)
- `pnpm lint` clean (warnings only, 기존 코드 무관 항목)
- `pnpm test` **1348 tests passed** (130 suites, 회귀 0건; 이전 1361 → 미사용 유틸 테스트 13건 제거 후 1348)
- CI: 30 SUCCESS / 8 SKIPPED / 0 FAILURE (mergeStateStatus CLEAN)
- Critic 2 라운드 (P1 2 → 0)

## 브랜치 규율 준수 ✅
- 신규 브랜치 `feat/sprint-139-calendar-based-problem-create` (608e276 base)
- 4 atomic commits → PR #181 → Squash merge
- main 직접 commit 0건 (Sprint 134 위반 이후 Sprint 135/136/137/138/139 5스프린트 연속 준수)

## 발견 사항 / 별건 시드

### Oracle 디스패치 인프라 이슈 (P1)
- `oracle-spawn.sh architect`로 Architect spawn 시도 → tmux pane에서 즉시 `env: claude: No such file or directory` 실패
- 원인 추정: tmux pane 환경 PATH에서 `claude` CLI 미발견 (Sprint 125 D2 H1 sensitive path 보호와 별건)
- **회피**: Oracle 직접 진행 (PM 합의 plan + Wave 단위 atomic commit + Critic 외부 검증으로 보완 — 결과적으로 Critic이 P1 2건 적발 → 회피 정당화)
- **Sprint 140 시드**: `oracle-spawn.sh` PATH 환경 점검 + `claude` 미발견 시 fallback 또는 명시적 에러 출력

### 사용자 피드백의 "문제 추가" 범위 모호성
- "문제 추가" UI가 어디인지 정확히 식별하지 않은 채 작업 시작 → 작업 중 AddProblemModal 추가 발견 → 같은 commit 묶음에 포함
- **교훈**: 사용자 피드백의 키워드("문제 추가" 등)는 동일 패턴이 반복되는지 사전 grep으로 검증 후 plan 확정

### 미사용 i18n 키 누적
- `addModal.dayNames` (7키 × 2lang), `addModal.validation.weekRequired`, `form.weekLabel` 등 — 변경 후 미사용이 되었으나 즉시 정리되지 않으면 ko/en 불일치/혼란 유발
- 본 스프린트에서 모두 정리. 향후 i18n 키 추가/제거는 PR 단위 cleanup commit에 포함 권장.

### Critic 호출 정책 적용 사례
- Sprint 131~138은 인프라 yaml/seed 변경으로 Critic 미호출 정책이 적절했음
- Sprint 139는 **폼 검증 로직 + 사용자 입력 흐름 + 타임존 정규화**로 정확성 위험이 높아 Critic 호출 → P1 2건 적발 → 호출 정책의 가치 입증
- 향후 정책 가이드: "사용자 입력 흐름 변경" 또는 "타임 처리 변경" 시 Critic 호출 필수

## Sprint 140 이월
- Oracle `oracle-spawn.sh` PATH 환경 점검 (Sprint 139 발생)
- 누적 시드 4건 유지:
  - github-worker errorFilter wrapper + WeakSet 동기화 (Sprint 135 이월)
  - ai-analysis Python CB schema 통일 (state 0/0.5/1 → 0/1/2 + name label)
  - CLAUDE.md `"ai-feedback"` → `"ai-analysis"` 명명 정정
  - E2E 자동 PR CI 통합 (Sprint 134부터 누적)
- backend가 deadline에서 weekNumber 계산 (옵션 B) — 별건 시드
- `week_number` 컬럼 제거 (옵션 C) — 별건 시드
- 운영 검증: ArgoCD sync 후 데모 로그인 broken image 회복 (Sprint 138 이월 유지)
