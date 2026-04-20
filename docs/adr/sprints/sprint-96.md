---
sprint: 96
title: "프런트 UX — 문제 추가 플로우 프로그래머스 통합"
date: "2026-04-20"
status: completed
---

# Sprint 96 — 프런트 UX (검색 + 문제 추가)

## 배경
Sprint 95에서 Gateway에 프로그래머스 외부 엔드포인트(`/api/external/programmers/*`)와 번들 데이터셋(373건)이 선행 구축되었으나, 프런트엔드의 문제 추가 플로우는 여전히 BOJ(Solved.ac)에 하드코딩되어 있어 백엔드 신규 엔드포인트가 활용되지 못했다. BOJ → 프로그래머스 전환 3-스프린트 로드맵(95 백엔드 → 96 프런트 → 97 제출·문서)의 2단계로, 이번 스프린트는 **프로그래머스를 기본 플랫폼으로 승격**시키고 BOJ는 토글 선택으로 유지하는 UX 재편을 목표로 한다.

## 목표
- 프런트 문제 추가/수정 플로우에 플랫폼 세그먼트 토글 도입(기본값 PROGRAMMERS)
- `programmersApi` 클라이언트 + `useProgrammersSearch` 훅 신규 — BOJ 훅과 **완전 대칭 계약**
- `AddProblemModal`의 `SearchStep`/`ConfirmStep` 제네릭화(`searchFn` 주입 + `platform` prop)
- `Problem.sourcePlatform` 타입을 `string` → `'BOJ' | 'PROGRAMMERS'` 리터럴 유니언으로 강화
- BOJ 검색 경로 회귀 0건 보장

## 작업 요약
| 커밋 | 담당 | 내용 |
|---|---|---|
| `9392f31` | architect | `SourcePlatform` 타입 + `PROGRAMMERS_LEVEL_LABELS` 상수 추가, `toTierLevel` BOJ 전용 경고 |
| `e5c3c34` | architect | `programmersApi` 클라이언트 + `Problem/CreateProblemData/UpdateProblemData.sourcePlatform` 리터럴 유니언 강화 |
| `121d6c0` | architect | `useProgrammersSearch` 훅 신규 (BOJ 훅 대칭, `sourcePlatform:'PROGRAMMERS'` 세팅) |
| `3fd2e04` | scribe | `AddProblemModal` 제네릭화 + 플랫폼 세그먼트 토글 UI + `searchFn` 주입 + `ConfirmStep` 플랫폼 분기 |
| `e100f09` | scribe | `/problems/create` 페이지 플랫폼 토글 통합 (기본값 PROGRAMMERS) |
| `9bb0cd4` | scribe | `/problems/[id]/edit` 페이지 플랫폼 토글 + 전환 경고(`window.confirm`) |
| `7b430cb` | curator | `useProgrammersSearch` 단위 테스트 13건 (BOJ 대칭 1:1) |
| `97a9fea` | curator | `AddProblemModal` 플랫폼 토글 테스트 3건 (fake timer 디바운스 포함) |
| `8cb7651` | gatekeeper | 기존 `ProblemCreatePage` 테스트의 기본값/제목 PROGRAMMERS 전환 반영 |

## 수정 내용

### 타입 & 상수
- `frontend/src/lib/constants.ts` — `SourcePlatform = 'BOJ' | 'PROGRAMMERS'` export, `PROGRAMMERS_LEVEL_LABELS: Record<number, string>` (Lv.1~5 라벨), `toTierLevel` JSDoc에 BOJ 전용 경고 추가
- `frontend/src/lib/api.ts` — `Problem.sourcePlatform`, `CreateProblemData.sourcePlatform`, `UpdateProblemData.sourcePlatform` 모두 `'BOJ' | 'PROGRAMMERS'` 리터럴 유니언으로 강화. `ProgrammersProblemInfo`, `ProgrammersSearchItem`, `ProgrammersSearchResult` 인터페이스 + `programmersApi.{search, searchByQuery}` 클라이언트 추가 (solvedacApi 직후 배치)

### 훅
- `frontend/src/hooks/useProgrammersSearch.ts` — `useBojSearch.ts` 대칭 복제. 모든 prefix `boj` → `programmers`, 내부적으로 `programmersApi.search(id)` 호출 및 `sourcePlatform:'PROGRAMMERS'` 세팅. 에러 메시지·리셋 로직 원본과 동일

### UI 컴포넌트
- `frontend/src/components/ui/AddProblemModal.tsx` — `SearchStep`에 `platform: 'BOJ' | 'PROGRAMMERS'`, `searchFn: (q) => Promise<SolvedProblem[]>`, `onPlatformChange` props 추가. `ConfirmStep`에 `platform` prop 추가. `searchProgrammers` 함수 신규(solved.ac 대칭). 모달 헤더의 BOJ 뱃지를 `platform === 'PROGRAMMERS' ? 'PG' : 'BOJ'`로 분기. `SolvedProblem`에 `difficulty?: Difficulty`/`sourceUrl?: string` 옵셔널 필드 추가 — 프로그래머스는 Gateway가 이미 difficulty를 반환하므로 직접 pass-through. `NewProblemData.sourcePlatform`도 리터럴 유니언으로 강화

### 페이지
- `frontend/src/app/problems/create/page.tsx` — `useBojSearch` + `useProgrammersSearch` **두 훅 동시 마운트**, `activePlatform` state(기본값 `'PROGRAMMERS'`), `role="tablist"` 세그먼트 토글(좌/우 화살표 내비), 활성 플랫폼에 따라 검색 UI/에러/결과 분기. `defaultValues.sourcePlatform` 및 '다시 등록' reset 모두 PROGRAMMERS
- `frontend/src/app/problems/[id]/edit/page.tsx` — 동일 패턴. 단 `activePlatform` 초기값은 서버 응답의 `data.sourcePlatform`을 따름(fallback `'BOJ'`). 플랫폼 전환 시 검색 결과가 이미 적용된 상태라면 `window.confirm` 경고 후 두 훅 모두 리셋

### 테스트
- `frontend/src/hooks/__tests__/useProgrammersSearch.test.ts` — 초기 상태/유효성 4종/성공 폼 동기화(`sourcePlatform==='PROGRAMMERS'` 검증 핵심)/difficulty null/실패 2종/Enter 키/리셋/에러 수동 설정 — 총 13건
- `frontend/src/components/ui/__tests__/AddProblemModal.test.tsx` — ① 기본 탭 PROGRAMMERS `aria-selected="true"` ② 토글 전환 시 보조 문구 변경 ③ 400ms 디바운스 후 `programmersApi.searchByQuery` / `solvedacApi.searchByQuery` 올바른 경로 호출
- `frontend/src/app/problems/create/__tests__/page.test.tsx` — 기본 플랫폼 전환 반영(제목 "프로그래머스 문제 검색", `useProgrammersSearch` 모킹 추가)

## 검증 결과
| 항목 | 결과 |
|---|---|
| Frontend `tsc --noEmit` | ✅ 오류 0 |
| Frontend `next lint` | ✅ 오류 0 (기존 inline-style 경고는 Sprint 96 무관) |
| Frontend Jest | ✅ **1153 tests / 113 suites PASS** |
| `useBojSearch.test.ts` 회귀 | ✅ 13건 무변경 green |
| `useProgrammersSearch.test.ts` 신규 | ✅ 13건 green |
| `AddProblemModal.test.tsx` 신규 | ✅ 3건 green |
| API 엔드포인트 정합성 (Gateway ↔ Frontend) | ✅ 일치 |
| BOJ 검색 경로 diff | ✅ 0줄 변경 (activePlatform === 'BOJ' 분기로만 접근) |

## 결정
- **훅 대칭 복제 > 제네릭 단일 훅**: `usePlatformSearch(platform)` 단일 훅은 런타임 플랫폼 전환 시 상태 리셋/재마운트 엣지케이스가 증가해 회귀 표면이 넓어진다. BOJ/Programmers 훅 2개를 페이지에서 **동시 마운트**하고 UI만 분기하는 방식이 회귀 0 달성에 최적
- **`programmersLevelToDifficulty()` 생성 생략** — 원본 계획 대비 편차: Gateway의 `ProgrammersProblemInfo.difficulty`가 이미 `'BRONZE'..'DIAMOND' | null`을 반환하므로, 프런트에서 재매핑하면 Sprint 95형 DTO 드리프트가 재발한다. 대신 표시 전용 `PROGRAMMERS_LEVEL_LABELS` 상수만 도입
- **`SolvedProblem` 타입 확장 > 신규 `ProgrammersProblem` 타입 도입**: 필드 호환도가 높아(problemId/titleKo/level/tags) `difficulty?`·`sourceUrl?` 옵셔널 2개만 추가해 `AddProblemModal` 내부 로직 재사용. 이름은 레거시지만 리네이밍은 Sprint 97+로 이관
- **SearchStep `searchFn` 주입 패턴**: fetch 계층과 프레젠테이션 계층 분리로 단위 테스트가 mocking 없이 가능하고, 플랫폼 추가 시 컴포넌트 수정 없이 props만 교체
- **Create 기본값 PROGRAMMERS, Edit 기본값 서버값**: BOJ→프로그래머스 전환기에는 신규 문제는 기본 프로그래머스, 기존 BOJ 문제 편집 시에는 플랫폼 보존이 UX 기대와 일치
- **`window.confirm` 사용 한정**: edit 페이지 플랫폼 전환 시 이미 검색이 적용된 경우에만. 신규 흐름·기본 진입에는 confirm 없음

## 교훈
- **타입 강화는 컴파일러를 surfacing 도구로 활용**한다. `Problem.sourcePlatform: string → 'BOJ' | 'PROGRAMMERS'` 한 번의 변경으로 create 페이지 defaultValues, AddProblemModal의 하드코딩, 테스트 mock까지 연쇄적으로 type error 노출 → 누락 없이 모두 수정
- **사용자 계획의 "모든 작업 수행"에 얽매이지 말고 중복/불필요 제거를 제안**한다. 원본 계획의 `programmersLevelToDifficulty()`는 Gateway가 이미 해결한 영역으로, 프런트에서 재매핑하면 Sprint 95 DTO 드리프트 이슈가 반복됐을 것. Plan 단계에서 편차 명시 + 승인 받기로 오버엔지니어링 회피
- **두 훅 동시 마운트는 상태 비용이 거의 0**이다. React에서 훅 추가 비용은 초기 렌더링 시 useState 호출 몇 번뿐이고, 플랫폼 전환마다 unmount/mount이 발생하지 않아 디바운스 타이머·포커스 상태 보존이 쉬움
- **세그먼트 토글의 접근성은 `role="tablist"` + 화살표 키 + 선택적 `tabIndex`로 완성**. Radix ToggleGroup을 새로 도입하지 않고도 네이티브 버튼 2개로 WCAG 계약 충족
- **Curator 테스트에 `jest.useFakeTimers`가 필요한 시점**: 400ms 디바운스가 있는 SearchStep 테스트에서 `act()` 안에서 `jest.advanceTimersByTime(400)` 호출 없이는 결과를 기다릴 수 없음. 기존 `useBojSearch.test.ts`는 훅 레벨 디바운스가 없어 필요 없었던 패턴

## 이월 항목 (Sprint 97)
- **WCAG AA 대비비 수동 검증 미수행**: palette 담당을 Wave 압축으로 생략. Sprint 97 `ui-review` 또는 별도 시각 감사에서 세그먼트 토글 `--bg-alt/--primary` 대비를 라이트/다크 모두 4.5:1+ 확인 필요
- **GitHub Worker 확장**: `formatPlatform()` `'programmers' → 'PROGRAMMERS'` 케이스 + 제출 파일명 `prg_` 접두어 (Sprint 97)
- **AI 피드백 프롬프트 동적 주입**: `sourcePlatform`에 따라 프롬프트 템플릿 분기 (Sprint 97)
- **tags 빈 배열 보강**: Sprint 95에서 이월된 개별 상세 페이지 breadcrumb 크롤링 (Sprint 97 또는 별도 postman 작업)
- **`SolvedProblem` → `ExternalProblem` 리네이밍**: 레거시 이름으로 남겨둠. 호출부 안정화 이후 리팩토링 스프린트에서 처리
