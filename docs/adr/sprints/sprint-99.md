---
sprint: 99
title: "PM QA 연속 라운드 — 프로그래머스 프론트엔드 전면 마감"
date: "2026-04-20"
status: completed
---

# Sprint 99 — PM QA 연속 라운드: 프로그래머스 프론트엔드 전면 마감

## 배경

Sprint 95~97 BOJ→프로그래머스 이전, Sprint 98 검색 장애 수정 이후 PM QA에서
프론트엔드 이슈가 연속 보고됨. 공통 근인: BOJ 전제 로직이 프론트엔드 전반에 잔존하고,
문제 생성 후 데이터 신선도 관리 + 주차 계산 로직이 미흡했음.

단일 세션에서 5회 연속 라운드로 모두 해소.

## 라운드별 조치

### 1차 라운드 (PR #91, 커밋 cd80db1) — Sprint 99-1~4

| # | 이슈 | 심각도 | 근인 |
|---|------|--------|------|
| 1 | `/problems` 난이도가 백준 티어(Bronze 5 등)로 표시 | Major | `toTierLevel()` BOJ 전용인데 `sourcePlatform` 분기 없이 호출 |
| 2 | 플랫폼 아이콘 "PROGRAMMERS" 글자 영역 초과 | Minor | `w-10` 컨테이너에 11글자 직접 렌더 |
| 3 | 신규 문제 대시보드 미반영 | Major | 생성 후 `loadDashboard()` 재호출 메커니즘 부재 |
| 4 | 신규 문제 통계 미반영 | Major | 이슈 3과 동일 근인 — `/analytics` 동일 |

**조치**:
- `PROGRAMMERS_LEVEL_LABELS`에 Lv.0 추가
- `PLATFORM_SHORT_LABELS` 상수 도입 (`PROGRAMMERS`→`PG`)
- `StudyContext.problemsVersion` 카운터 + `incrementProblemsVersion()` 추가, 대시보드·통계에서 별도 useEffect로 refetch 트리거

### 2차 라운드 (PR #92, 커밋 f1ab881) — Sprint 99-5

**이슈**: 4월3주차로 표시된 주가 4/15부터 시작 (사용자 체감 4월4주차와 불일치).

**근인**: `Math.ceil(date/7)` 단순 공식은 매월 1일의 요일을 고려하지 않음. 2026-04-20(월)이
시스템상 4월3주차로 오판되어 사용자가 선택한 `4월4주차` 등록 문제가 대시보드 "진행 중"
필터에서 누락.

**조치**: 달력 기준 공식 `ceil((date + firstDayOfWeek) / 7)`로 통일. 매월 1일이 속한 주가 1주차.
- `lib/utils.ts`, `lib/problem-form-utils.ts` — 중복 제거 + 재사용 (DRY)
- `AddProblemModal`의 `generateWeekOptions`, `getWeekDates`에도 동일 로직 적용
- 테스트 추가 (2026-04-20 → 4월4주차 케이스)

### 3차 라운드 (PR #93, 커밋 fb8b9b6) — Sprint 99-6

**이슈**: "문제목록을 제외한 모든 화면에서 프로그래머스 난이도가 백준 기준으로 표시됨".

**근인**: 1차에서 `/problems` 목록만 수정, `DifficultyBadge` 공통 컴포넌트와 다른 화면의
수동 렌더링은 여전히 `toTierLevel` + `DIFFICULTY_LABELS`만 사용.

**조치**: 근본 해결 — `DifficultyBadge`를 **플랫폼 인지형**으로 확장하고 수동 렌더링 전수 통합:
- Props에 `sourcePlatform?: SourcePlatform | null` 추가, `difficulty: Difficulty | null` 허용
- 내부 분기: PROGRAMMERS면 `Lv.N` 라벨, BOJ면 기존 티어 라벨
- Lv.0(difficulty null)은 neutral fallback 토큰 적용
- 수동 렌더링 5곳 통합: `/problems`, `/problems/[id]`, `/submissions`, `/submissions/[id]/analysis`, `DashboardTwoColumn` (최근 제출 + 마감 임박)

### 4차 라운드 (PR #94, 커밋 9b1e912) — Sprint 99-7

**이슈**: 대시보드 "진행 중인 문제"에서 프로그래머스 Lv.3이 Gold 3로 표시됨.

**근인**: Sprint 99-6의 전수 통합에서 `DashboardThisWeek` 컴포넌트를 놓침. 탐색 리포트가
"DifficultyBadge 사용 (안전)"이라고 오판했으나 실제로는 수동 렌더링이었음.

**조치**: `DashboardThisWeek` + `shared/[token]/page.tsx` 2곳 수동 렌더링 제거. 공유 페이지는
스트라이프/진행바 색상이 뱃지 스타일을 공유하므로 `stripeColor` 로컬 변수로 분리하여 보존.

### 5차 라운드 (PR #95, 커밋 8ef6665) — Sprint 99-8

**이슈**: 스터디룸에서도 프로그래머스 Lv.3이 Gold 3로 표시됨.

**근인**: 3차 라운드에서 `DifficultyBadge`를 확장했으나 스터디 영역 4개 호출처가
`sourcePlatform` prop을 전달하지 않음 → 컴포넌트 내부에서 BOJ 기본 분기로 떨어짐.

**조치**: 4개 호출처에 `sourcePlatform={problem.sourcePlatform}` 추가:
- `studies/[id]/page.tsx` — 로컬 매핑(activeProblems/endedProblems)에 `sourcePlatform` 포함 + `ProblemCard` prop 타입 확장
- `studies/[id]/room/WeekSection.tsx`
- `studies/[id]/room/AnalysisView.tsx`
- `studies/[id]/room/SubmissionView.tsx`

## 검증

- `tsc --noEmit`: 전 PR PASS
- Jest: 최종 **113 suites / 1157 tests ALL PASS**
- 신규 테스트: 2026-04-20 → `4월4주차` 주차 계산 회귀
- 테스트 mock 보정: `DashboardTwoColumn`, `DashboardThisWeek`의 `DifficultyBadge` mock을 실제 플랫폼 분기 로직 반영

## 설계 판단

### SWR/React Query 전면 도입 — 이월
`problemsVersion` 카운터는 최소 변경으로 데이터 신선도를 해결. SWR/React Query 전환은
데이터 페칭 아키텍처 전면 변경이라 별도 스프린트로 이월.

### 프로그래머스 뱃지 색상 — BOJ 토큰 재사용
Gateway의 `levelToDifficulty(Lv.1~5 → BRONZE~DIAMOND)` 매핑 덕분에 기존 난이도 색상 토큰
(bronze/silver/gold/platinum/diamond) 재활용. Lv.0은 neutral fallback.
프로그래머스 전용 별도 색상 체계 도입은 과잉으로 판단.

### DifficultyBadge 단일 진실 공급원 (SSOT)
난이도 렌더링 로직을 한 곳으로 모으고 모든 호출처가 컴포넌트를 통해 표시하도록 통합.
향후 새 화면 추가 시에도 `sourcePlatform` 전달만 하면 플랫폼별 규칙이 자동 적용.

## 프로세스 교훈

### 탐색 에이전트의 오판
3차 라운드 전수조사에서 `DashboardThisWeek`를 "DifficultyBadge 사용 (안전)"으로 오판 →
4차 라운드 재작업 발생. **전수 조사 시 직접 Grep/Read로 교차 검증** 필요.

### 컴포넌트 확장 시 호출처 prop 전파 검증
3차 라운드에서 `DifficultyBadge`에 `sourcePlatform` prop 추가 후, 기존 호출처가 이를 전달하는지
별도 검증하지 않음 → 5차 라운드(스터디룸)에서 재작업. **컴포넌트 prop 추가 시 모든 호출처 grep**을
같은 커밋에서 수행하는 체크리스트 필요.

## 이월 항목

**이번 스프린트 생성**:
- SWR/React Query 전면 도입 (데이터 페칭 아키텍처)
- Submission Service Redis 통계 캐시 — 성능 최적화

**기존 유지**:
- 레벨 0 240건 tags 보강 (Sprint 98 이월, fetch-programmers-tags.ts 2차 패스)
- H5 UX 개선: 키워드 검색 프론트 연동 — 낮음
- ESLint pre-existing 경고 6건 정리 — 낮음
- Register UI 이식, NotFound 404 이식, SolvedProblem→ExternalProblem 리네이밍
