---
sprint: 115
title: "Phase E 검증 — Critic Codex 교차 코드리뷰 시연 및 결함 수정"
period: "2026-04-22"
status: complete
start_commit: 24ac1b7
end_commit: 35ccc2b
---

# Sprint 115 — Phase E 검증 — Critic Codex 교차 코드리뷰 시연 및 결함 수정

## 배경

Sprint 114에서 Critic(비평가) 에이전트를 신설하고 Codex CLI 설치·페르소나·파이프라인 통합을 완료했으나, **Phase E(실제 시연 검증)** 가 사용자 로그인 대기로 이월되었다. 본 스프린트는 이월된 Phase E를 실행하여 Critic의 실전 가치를 입증하고, 리뷰에서 발견된 결함을 수정한다.

검증 대상은 Sprint 113의 SWR 데이터 페칭 표준화 커밋(`75cb80f..e4f0641`)이며, Codex CLI 직접 호출(`codex review --base <SHA>`)로 Claude Code 내장 슬래시 커맨드 우회 경로를 함께 입증한다.

## 목표

| Phase | 내용 | 상태 |
|-------|------|------|
| E1 | Codex CLI 직접 호출 경로 확인 (`codex review --base`) | ✅ 완료 |
| E2 | Sprint 113 SWR 커밋 1차 리뷰 — P2 2건 발견 | ✅ 완료 |
| E3 | P2 수정 커밋 (`24ac1b7`) + 재리뷰 — P1 1건 발견 | ✅ 완료 |
| E4 | P1 수정 커밋 (`35ccc2b`) + 최종 리뷰 — 회귀 없음 확인 | ✅ 완료 |

---

## 결정 사항

### D1. SWR 키 전략 = `[path, studyId]` 튜플

**배경**: SWR 캐시 키가 API path만으로 구성되어, 스터디 전환 시 이전 스터디 데이터가 잔존하는 캐시 오염 문제 발생.

**선택지**:
- (A) `path` 단일 문자열 키 유지 + `invalidateAllCache()`로 전환 시 전체 무효화
- (B) **`[path, studyId]` 튜플 키** ← 선택 — studyId가 키에 포함되어 자동 캐시 분리

**선택**: (B) — 튜플 키가 SWR의 자동 캐시 분리를 활용하므로 `invalidateAllCache()` 의존도가 감소하고, 스터디 전환 시 이전 데이터가 즉시 분리된다.

**결과**: `use-problems.ts`, `use-submissions.ts`에서 SWR 키를 `[path, studyId]`로 변경.

---

### D2. 에러 표시 = SWR error 직접 바인딩

**배경**: 기존 패턴은 `useState`로 local error state를 두고 `useEffect`로 SWR error를 복사하는 이중 구조. 에러 해소 후에도 local state가 잔존하여 UI에 오래된 에러가 남는 문제.

**선택지**:
- (A) local error state + `useEffect` 복사 패턴 유지 + 해제 로직 추가
- (B) **SWR `error` 직접 바인딩** ← 선택 — `problemsError?.message` 직접 사용, onClose에서 `mutate()` 재시도

**선택**: (B) — SWR가 에러 상태를 자체 관리하므로 local state 중복이 불필요. `mutate()` 호출 시 SWR가 자동으로 에러를 갱신하여 상태 동기화 문제를 근본적으로 해소.

**결과**: `problems/page.tsx`, `submissions/page.tsx`에서 local error state 제거, SWR error 직접 참조.

---

### D3. `invalidateAllCache()` in `setCurrentStudy` = safety net 유지

**배경**: D1에서 튜플 키로 캐시 분리를 달성했으므로 `setCurrentStudy` 내 `invalidateAllCache()` 호출이 불필요해 보임.

**선택지**:
- (A) **유지 (safety net)** ← 선택 — 튜플 키 미적용 훅이 남아있을 경우 대비
- (B) 제거 — 튜플 키가 완전히 커버한다고 가정

**선택**: (A) — 모든 SWR 훅이 튜플 키로 전환 완료되기 전까지 안전망으로 유지. 제거는 전체 훅 튜플 전환 완료 후 별도 스프린트에서 진행.

---

### D4. SWR 2.x fetcher = tuple key 감지 후 path 추출

**배경**: Critic 재리뷰에서 P1으로 발견. SWR 1.x는 array key를 `...args`로 spread 전달하지만, **SWR 2.x는 array key를 단일 tuple 인자**로 전달. 초기 `swrFetcher(...args)` 시그니처가 SWR 2.x와 호환되지 않음.

**선택지**:
- (A) fetcher에서 rest params로 spread 수신 (SWR 1.x 방식)
- (B) **`string | readonly [string, ...]` 시그니처 + `Array.isArray` 분기** ← 선택

**선택**: (B) — SWR 2.x 공식 동작에 맞춰 tuple 여부를 감지하고, tuple이면 첫 번째 요소를 path로 추출. 향후 SWR 버전 업그레이드에도 안정.

**결과**: `swr.ts`의 `swrFetcher` 시그니처를 `string | readonly [string, ...]`로 변경, `Array.isArray` 분기 추가. 테스트 mock도 동일 타입 적용.

---

### D5. Critic 재리뷰 = P2 수정 후 반드시 1회 재검증

**배경**: 1차 리뷰에서 P2 2건을 수정한 커밋에 대해 재리뷰를 실행한 결과, 수정 자체에서 P1 1건이 새로 발견됨. "수정했으니 끝"이라는 가정이 위험함을 실증.

**선택지**:
- (A) P2 수정 후 재리뷰 생략 (크레딧 절약 우선)
- (B) **P2 수정 후 반드시 1회 재검증** ← 선택 — 크레딧 절약하되 P1 발견 가능

**선택**: (B) — Codex 크레딧 소모를 최소화하면서도 수정 커밋의 2차 결함을 포착할 수 있는 균형점. 본 스프린트에서 실제로 P1을 발견하여 가치 입증.

**결과**: Critic 운용 규칙에 "P2 이상 수정 후 최소 1회 재리뷰" 원칙 확립.

---

## Phase E 검증 결과

| 단계 | 내용 | 결과 |
|------|------|------|
| 1 | Codex CLI 직접 호출 (`codex review --base <SHA>`) | ✅ `/codex:*` 슬래시 커맨드 우회 경로 입증 |
| 2 | ChatGPT device-auth 로그인 상태 확인 | ✅ 재로그인 불필요 |
| 3 | `--base`와 `[PROMPT]` 동시 사용 불가 확인 | ✅ 상호배제 확인 |
| 4 | 1차 리뷰: Sprint 113 SWR 커밋 | P2 2건 발견 (캐시 오염 + 에러 잔존) |
| 5 | P2 수정 + 재리뷰 | P1 1건 발견 (SWR 2.x tuple key 전달 방식) |
| 6 | P1 수정 + 최종 리뷰 | ✅ 회귀 없음, 머지 가능 |

---

## 주요 산출물

**수정 7** (커밋 `24ac1b7`):
- `frontend/src/hooks/use-problems.ts` — SWR 키 `[path, studyId]` 튜플 전환
- `frontend/src/hooks/use-submissions.ts` — SWR 키 `[path, studyId]` 튜플 전환
- `frontend/src/lib/swr.ts` — swrFetcher rest params 추가 (초기 시도)
- `frontend/src/app/(main)/problems/page.tsx` — SWR error 직접 바인딩, local state 제거
- `frontend/src/app/(main)/submissions/page.tsx` — SWR error 직접 바인딩, local state 제거
- `frontend/src/hooks/__tests__/use-problems.test.tsx` — 튜플 키 테스트 대응
- `frontend/src/hooks/__tests__/use-submissions.test.tsx` — 튜플 키 테스트 대응

**수정 3** (커밋 `35ccc2b`):
- `frontend/src/lib/swr.ts` — swrFetcher 시그니처 `string | readonly [string, ...]` + `Array.isArray` 분기
- `frontend/src/app/(main)/settings/page.test.tsx` — 테스트 mock 타입 수정
- `frontend/src/components/__tests__/NotificationBell.test.tsx` — 테스트 mock 타입 수정

---

## 리스크 & 완화

- **R1 SWR 2.x 호환성**: SWR 메이저 버전 간 fetcher 인자 전달 방식 차이 — `Array.isArray` 분기로 1.x/2.x 모두 대응
- **R2 미전환 훅 잔존**: 아직 튜플 키 미적용 SWR 훅이 존재 가능 — `invalidateAllCache()` safety net 유지 (D3)
- **R3 Codex 크레딧 소모**: 재리뷰 사이클이 크레딧을 추가 소모 — 머지 직전/대규모 변경에만 호출, P2 수정 후 최대 1회 재검증 원칙

## 교훈

- **Critic 3중 가치 입증**: (1) 다른 모델 패밀리의 맹점 포착 — Claude가 놓친 캐시 오염을 Codex가 발견, (2) 수정 커밋의 2차 결함 발견 — P2 수정에서 SWR 2.x API 차이라는 P1이 새로 발생, (3) 최종 회귀 없음 확인으로 머지 안전성 보장
- **`codex review` CLI는 플러그인 없이도 동작**: `/codex:*` 슬래시 커맨드가 차단되어도 바이너리 직접 호출(`codex review --base <SHA>`)이 동등한 결과를 제공. 플러그인 활성화가 블로커가 되지 않음
- **SWR 2.x array key는 단일 tuple 인자**: SWR 1.x의 spread 방식(`...args`)과 다르게 2.x는 array key 전체를 하나의 인자로 전달. fetcher 시그니처에 반드시 tuple 대응 필요 — 공식 문서 확인 없이 1.x 패턴을 답습하면 런타임 실패
- **교차 리뷰 후 재검증 필수**: P2 수정 자체에서 P1이 발생할 수 있음. "수정했으니 끝"이 아닌 재검증 사이클이 품질을 보장한다는 것을 실증. Critic 운용 시 수정 후 최소 1회 재리뷰를 기본 원칙으로 확립

## 이월

없음 — Phase E 검증 완결.
