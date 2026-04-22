---
sprint: 113
title: "SWR 데이터 페칭 표준화"
period: "2026-04-22"
status: complete
start_commit: 75cb80f
end_commit: 2c7fd08
---

# Sprint 113 — SWR 데이터 페칭 표준화

## 배경

AlgoSu 프론트엔드는 모든 데이터 페칭을 `useState + useEffect + useCallback` 보일러플레이트로 수동 관리하고 있었다. 동일한 3-state 패턴(data/isLoading/error)이 problems, submissions, settings, dashboard 등 전 페이지에 반복되어 유지보수 비용이 높고, 캐싱/재검증/중복 요청 방지 등 기본 기능이 부재했다.

MEMORY.md "후속 처리 필요" 섹션 3항목(SWR 도입, Redis 통계 캐시, problem.tags JSON 전환) 중 최우선 순위로 선정되어 단일 스프린트로 편성.

## 목표

| 항목 | 내용 | 상태 |
|------|------|------|
| Phase A | SWR 인프라 구축 (fetcher, Provider, 4개 훅, test-utils) | ✅ 완료 |
| Phase B | 3개 페이지 마이그레이션 (problems/submissions/settings) | ✅ 완료 |
| Phase C | NotificationBell 폴링 → refreshInterval 전환 | ✅ 완료 |
| Phase D | 신규 훅 테스트 + 기존 페이지 테스트 수정 | ✅ 완료 |

---

## 결정 사항

### D1. SWR 선택 (vs TanStack Query / React Query)

**배경**: 프론트 데이터 페칭 라이브러리 선택. 두 후보 비교 필요.

**선택지**:
- (A) TanStack Query (React Query) — 고급 캐싱/동기화, 번들 ~40KB, 풍부한 DevTools
- (B) SWR — 경량 ~8KB, 단순 API, httpOnly Cookie 친화 ← **선택**

**선택**: (B) — AlgoSu의 기술 스택과 정확히 맞음:
- httpOnly Cookie 인증: `credentials: 'include'` 자동 처리, Authorization 헤더 수동 주입 불필요
- 기존 fetch wrapper (`fetchApi`)와 최소 변경으로 통합 — key를 API path 그대로 사용
- SSE + 폴링 실시간 기능과 충돌 없음
- 번들 크기 이점 (~8KB)
- 현 데이터 페칭 복잡도(단순 CRUD)가 낮아 React Query의 고급 기능 필요 없음

**결과**: `swr@2.x` 도입. `lib/swr.ts`에 공통 fetcher + cacheKeys 팩토리, `SWRProvider`로 글로벌 설정.

---

### D2. 캐시 키 = API path (별도 키 체계 없음)

**배경**: SWR은 key로 인덱싱된 캐시를 가지며, key 네이밍 규칙이 필요.

**선택지**:
- (A) 도메인별 튜플 키 (예: `['problems', 'all', studyId]`)
- (B) API path 그대로 사용 (예: `/api/problems/all`) ← **선택**

**선택**: (B) — `fetchApi(path)` 시그니처가 이미 path 기반이므로, key = path일 때 fetcher(`(key) => fetchApi(key)`)가 자연스럽게 성립. 캐시 키 디버깅 시 네트워크 탭과 1:1 매핑. `cacheKeys` 팩토리로 타입 안전성만 확보.

**결과**: `cacheKeys.problems.all()` → `/api/problems/all` 반환. 쿼리 파라미터는 `URLSearchParams`로 path에 직렬화.

---

### D3. 스터디 전환 시 `invalidateAllCache()` 호출

**배경**: `fetchApi` 내부가 모듈 레벨 `_currentStudyId`를 읽어 `X-Study-ID` 헤더를 주입한다. 같은 path라도 스터디가 바뀌면 서버 응답이 달라지는데, SWR 캐시 키에 studyId가 없으면 이전 스터디 데이터가 stale 상태로 보인다.

**선택지**:
- (A) 모든 스터디-스코프 키에 studyId 포함 (예: `['study-1', '/api/problems/all']`)
- (B) 스터디 전환 이벤트에서 전체 SWR 캐시 무효화 ← **선택**

**선택**: (B) — 스코프 데이터가 많아 (A)는 키 관리 비용 높음. 스터디 전환은 드문 이벤트이므로 전체 재검증 오버헤드 허용 가능. `StudyContext.setCurrentStudy`에서 `invalidateAllCache()` 호출.

**결과**: `lib/swr.ts`에 `invalidateAllCache()` export. `StudyContext.tsx`에서 studyId 변경 시 호출 → 모든 SWR 캐시 재검증.

---

### D4. SWR 범위 제외: SSE 훅 / useAutoSave / 검색 훅

**배경**: 프론트엔드에 7개 커스텀 훅 존재. 모두 SWR로 전환할지 범위 선정 필요.

**선택**: 전환 대상 4개 + 제외 3개
- **전환**: useProblems, useStudyStats, useSubmissions, useProfileSettings (단순 GET read cache)
- **제외**:
  - `useNotificationSSE`, `useSubmissionSSE` — 실시간 스트림 (SWR 대상 아님, ReadableStream 유지)
  - `useAutoSave` — localStorage + 30s 서버 동기화 (SWR read-cache 패턴과 부적합)
  - `useBojSearch`, `useProgrammersSearch` — 사용자 액션 기반 form 상태 연동 (SWR로 전환 시 오히려 복잡도 증가)

**결과**: SWR 도입 범위가 "선언적 GET + 자동 캐싱" 용도로 명확해짐. 실시간/form은 기존 패턴 유지.

---

## 산출물

### 신규 파일 (7)

| 파일 | 역할 |
|------|------|
| `frontend/src/lib/swr.ts` | swrFetcher + cacheKeys + invalidateAllCache |
| `frontend/src/components/providers/SWRProvider.tsx` | 글로벌 SWRConfig (401/403/404 재시도 차단, dedupingInterval 2s) |
| `frontend/src/lib/test-utils.tsx` | SWRTestWrapper (테스트 캐시 격리) |
| `frontend/src/hooks/use-problems.ts` | 문제 목록 SWR 훅 |
| `frontend/src/hooks/use-study-stats.ts` | 스터디 통계 SWR 훅 |
| `frontend/src/hooks/use-submissions.ts` | 제출 목록 페이지네이션 SWR 훅 |
| `frontend/src/hooks/use-profile-settings.ts` | 프로필 설정 SWR 훅 |

### 수정 파일 (7)

| 파일 | 변경 | 설명 |
|------|------|------|
| `frontend/src/lib/api.ts` | +1 | `fetchApi` export 추가 (SWR fetcher 재사용) |
| `frontend/src/app/layout.tsx` | +3 | SWRProvider 삽입 (StudyProvider > SWRProvider) |
| `frontend/src/contexts/StudyContext.tsx` | +2 | setCurrentStudy 시 invalidateAllCache 호출 |
| `frontend/src/app/problems/page.tsx` | +12/-22 | useState+useEffect → useProblems+useStudyStats 전환 |
| `frontend/src/app/submissions/page.tsx` | +31/-35 | useSubmissions+useProblems 전환 (Herald) |
| `frontend/src/app/settings/page.tsx` | +26/-19 | useProfileSettings 전환 + useEffect로 폼 초기화 |
| `frontend/src/components/layout/NotificationBell.tsx` | +52/-70 | 60s setInterval 제거 → useSWR refreshInterval (Herald) |

### 신규 테스트 파일 (4)

| 파일 | 테스트 수 |
|------|-----------|
| `use-problems.test.tsx` | 5 |
| `use-study-stats.test.tsx` | 5 |
| `use-submissions.test.tsx` | 6 |
| `use-profile-settings.test.tsx` | 5 |

### 수정 테스트 파일 (2)

| 파일 | 변경 | 설명 |
|------|------|------|
| `NotificationBell.test.tsx` | +90/-30 | notificationApi 모킹 → swrFetcher 모킹 전환 (26 tests 재활성) |
| `settings/__tests__/page.test.tsx` | +37/-20 | settingsApi 모킹 → swrFetcher 모킹 전환 |

### 커밋 (6, 전부 atomic)

```
2c7fd08 feat(frontend): SWR 인프라 + problems 페이지
6f2e591 test(frontend): NotificationBell/settings 테스트 수정
192170a test(frontend): SWR 훅 4개 테스트 추가 (21 tests)
8c5614d refactor(frontend): NotificationBell SWR refreshInterval
1e57f71 refactor(frontend): settings 페이지 SWR
4d7425d refactor(frontend): submissions 페이지 SWR
```

## 검증

- `npx tsc --noEmit`: 0 에러
- `npm test`: **1259/1259 passed** (120 suites, 신규 21개 포함)
- 커버리지: 신규 훅 4개 모두 조건부 페칭/성공/실패/mutate 케이스 커버

## 교훈

### Herald tmux dispatch 특성
**관찰**: 동일 에이전트(Herald)에 대해 태스크 규모에 따라 성공률이 현격히 달라짐.
- ✅ 성공 패턴: 단일 파일 대상 + 명시적 instruction (submissions, NotificationBell, 훅 테스트 4개)
- ❌ 실패 패턴: 다중 파일 + 광범위 스코프 (초기 "페이지 3개 + 테스트" 태스크 → 945s 타임아웃, 누적 CPU 17s)
- ⚠️ 부분 성공: 테스트 수정 태스크는 작업 완료했으나 commit/inbox 작성 전 타임아웃

**교훈**: `claude -p` 독립 프로세스 Herald는 **단일 파일 단위 디스패치**로 좁혀야 안정적. 멀티파일 배치 작업은 Oracle이 직접 수행하거나 순차 디스패치로 분할 권장.

### SWR 통합 최소침습 원칙
기존 `fetchApi` wrapper를 그대로 활용하여 SWR fetcher로 위임하는 전략이 주효했다.
- API 네임스페이스 16개 변경 없음 (호환성 유지)
- 캐시 키 = API path → 네트워크 탭 디버깅과 1:1
- `cache: 'no-store'` Next.js HTTP 설정과 SWR 인메모리 캐시는 충돌 없음

### 점진 마이그레이션이 맞는 선택
전체 전환이 아닌 대표 페이지 3개 + 1 컴포넌트만 전환. dashboard/admin-feedbacks는 복잡도 높아 향후 스프린트로 분할. 이 분할이 단일 스프린트 완료를 가능하게 함.

### React 안티패턴 감지 — Herald 결과물 검수 필요
Herald가 settings/page.tsx에서 render-phase state update 패턴을 사용했던 것을 Oracle이 useEffect로 교정. Herald 산출물을 무조건 수용하지 말고 검수 후 커밋해야 함.

## 이월 항목

없음.

## 후속 처리 필요 (MEMORY.md 상시)

- Redis 통계 캐시 (대시보드 통계 DB 직접 조회 → 캐시 전환)
- problem.tags JSON 컬럼 전환 + seed 데이터 확충
- dashboard/page.tsx SWR 전환 (4개 병렬 fetch → 개별 SWR 훅)
- admin/feedbacks/page.tsx SWR 전환 (useSWRInfinite 검토)
- useSWRMutation 기반 mutation 패턴 도입 (현 직접호출 + mutate 방식의 대안)
