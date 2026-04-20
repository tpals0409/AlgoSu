---
sprint: 99
title: "PM QA 1차 — 프로그래머스 프론트엔드 마감 (난이도·뱃지·신선도)"
date: "2026-04-20"
status: completed
---

# Sprint 99 — PM QA 1차 라운드: 프로그래머스 프론트엔드 마감

## 배경

Sprint 95~97의 BOJ→프로그래머스 전환, Sprint 98의 검색 장애 수정 이후 PM QA에서
프론트엔드 4건의 이슈가 보고되었다. 공통 원인은 BOJ 전제 로직이 프론트엔드에 잔존하고,
문제 생성 후 데이터 신선도 관리가 부재한 것이었다.

## PM QA 이슈 4건

| # | 이슈 | 심각도 | 근인 |
|---|------|--------|------|
| 1 | 문제 목록 난이도가 백준 티어(Bronze 5 등)로 표시 | Major | `toTierLevel()` BOJ 전용 함수가 `sourcePlatform` 분기 없이 호출 |
| 2 | 플랫폼 아이콘 "PROGRAMMERS" 글자 영역 초과 | Minor | `w-10`(40px) 컨테이너에 11글자 직접 렌더링 |
| 3 | 신규 문제 대시보드 미반영 | Major | 문제 생성 후 `loadDashboard()` 재호출 메커니즘 부재 |
| 4 | 신규 문제 통계 미반영 | Major | 이슈 3과 동일 근인 — `/analytics` 페이지도 refetch 트리거 없음 |

## 수정 내용

### 커밋 1: 난이도 렌더링 플랫폼 분기 (`ba3c2ef`)

**변경 파일**: `frontend/src/lib/constants.ts`, `frontend/src/app/problems/page.tsx`

- `PROGRAMMERS_LEVEL_LABELS`에 `0: 'Lv.0'` 추가 (기존 1~5만 정의)
- `/problems` 문제 목록 렌더링에서 `sourcePlatform === 'PROGRAMMERS'` 분기 추가
  - 프로그래머스: `Lv.0`~`Lv.5` 라벨 표시 (toTierLevel 호출 제거)
  - BOJ: 기존 `Bronze 5` 등 표시 유지
- 렌더링 조건을 `problem.difficulty || problem.sourcePlatform === 'PROGRAMMERS'`로 변경하여 Lv.0(difficulty: null)도 표시

### 커밋 2: 플랫폼 뱃지 오버플로 (`d8d175d`)

**변경 파일**: `frontend/src/lib/constants.ts`, `frontend/src/app/problems/page.tsx`

- `PLATFORM_SHORT_LABELS` 상수 추가 (`BOJ` → `'BOJ'`, `PROGRAMMERS` → `'PG'`)
- 문제 목록 플랫폼 아이콘에서 약어 라벨 사용

### 커밋 3: 대시보드·통계 데이터 신선도 (`9574f39`)

**변경 파일**: `StudyContext.tsx`, `dashboard/page.tsx`, `analytics/page.tsx`, `problems/create/page.tsx`, `problems/page.tsx`

- `StudyContext`에 `problemsVersion: number` 상태 + `incrementProblemsVersion()` 콜백 추가
- `/dashboard`와 `/analytics`에 `problemsVersion > 0` 변경 시 refetch하는 별도 useEffect 추가
- `/problems/create` 생성 성공 시 및 AddProblemModal `handleAddProblem` 콜백에서 `incrementProblemsVersion()` 호출

## 검증

- `tsc --noEmit`: PASS
- Jest: 113 suites / 1153 tests ALL PASS
- ESLint: PASS (pre-existing 경고 외 신규 없음)

## 설계 판단

### `problemsVersion` 카운터 vs SWR/React Query

SWR/React Query 전면 도입은 데이터 페칭 아키텍처 전면 변경이므로 이번 스프린트 범위 초과로 판단.
Context 카운터 방식은 최소 변경으로 문제를 해결하며, 향후 SWR 전환 시 자연스럽게 대체 가능.

### 프로그래머스 뱃지 색상

프로그래머스 Lv.1~5는 gateway의 `levelToDifficulty()`가 BRONZE~DIAMOND로 매핑하므로
기존 난이도 색상 토큰을 재활용. 별도 프로그래머스 전용 색상 체계 도입은 과잉으로 판단.
Lv.0은 `difficulty: null`이므로 neutral fallback 스타일 적용.

## 이월 항목

- [ ] SWR/React Query 전면 도입 (데이터 페칭 아키텍처 변경) — 별도 스프린트
- [ ] 레벨 0 240건 tags 보강 (Sprint 98 이월)
- [ ] H5 UX 개선: 키워드 검색 프론트 연동 — 낮음
- [ ] ESLint pre-existing 경고 6건 정리 — 낮음
- [ ] Register UI 이식, NotFound 404 이식, SolvedProblem→ExternalProblem 리네이밍 (기존 이월)
