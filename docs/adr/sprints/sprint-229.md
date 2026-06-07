---
sprint: 229
title: "quiz 'ALL' 모드 로딩 UX 개선 (진행률 바 + 프리페치 + 에러 토스트)"
date: "2026-06-07"
status: completed
agents: [Oracle, Herald, Scribe, Librarian, Critic]
related_adrs: ["sprint-228", "sprint-227", "sprint-224"]
related_memory: ["sprint-window"]
topics: ["quiz", "frontend", "ux", "lazy-load", "i18n"]
tldr: "Sprint 228의 lazy-load 전환(route 84.8→13.6kB) 이후 'ALL' 모드(기본값)는 10분야 청크를 Promise.all 병렬 로드하며 그동안 정적 SkeletonCard만 노출(진행 표시 없음), 동적 import 실패 시 SP228 P2로 idle 복귀하나 사용자 피드백이 없었다. 로딩 UX를 3축으로 개선했다: ① start() catch에 sonner toast(toast.error)를 추가해 동적 import 실패를 사용자 가시 피드백으로 보강(Toaster 기마운트라 신규 인프라 0) ② getRandomQuestions에 onProgress(loaded,total) 콜백을 5번째 positional로 추가(rng 4번째 유지, 하위호환)해 각 청크 로드마다 진행을 page state로 받아 신규 QuizLoading(quiz 로컬, Progress+SkeletonCard 재사용→신규 토큰 0) 진행률 바에 시각화 ③ prefetchQuestions(category)를 신규 export(fire-and-forget, 에러 swallow)하고 QuizStart Start 버튼 hover/focus에서 선택 분야 청크를 워밍(동적 import 캐시 재사용→체감 로딩 감소). total=0 division 가드 포함. jest 1649 PASS(+14), 글로벌 lines 88.07%/branches 79.39%, route /[locale]/quiz 13.9kB(+0.3kB, lazy-load 회귀 없음). 프론트 전용, merge≠라이브."
---
# Sprint 229 — quiz 'ALL' 모드 로딩 UX 개선 (진행률 바 + 프리페치 + 에러 토스트)

## 목표

- Sprint 228의 분야별 lazy-load 전환(`/[locale]/quiz` route 84.8 → 13.6kB) 이후, 'ALL' 모드(기본값)의 로딩 UX를 **3축**(에러 피드백 / 진행 표시 / 프리페칭)으로 개선한다.
- 신규 디자인 토큰 0 + 신규 인프라 0 + `components/ui` 신규 0(quiz 로컬만)으로 처리하고, Sprint 228의 lazy-load 회귀(route Size)를 내지 않는다.
- 프론트 전용 — merge ≠ 라이브(재배포 후 라이브 검증은 `quiz-ui-verification` 런북 이월에 합류).

## 배경

Sprint 228은 문항 데이터를 시작 시 `CATEGORY_LOADERS` 동적 import로 전환해 초기 번들에서 제거했다(route 84.8→13.6kB). 다만 'ALL' 모드(기본값)는 10분야 청크를 `Promise.all`로 병렬 로드하며, 그동안 사용자는 **정적 `SkeletonCard`만** 본다(진행 표시 없음). 또한 동적 import가 실패하면 Sprint 228 P2 수정으로 `idle`로 복귀하지만 **사용자에게 보이는 피드백이 없다**(stale chunk / 오프라인 / CDN 실패 시 조용히 시작 화면으로 되돌아감).

Sprint 229는 이 로딩 UX 갭을 3축으로 해소한다.

## 결정

### D0. 확정 결정 (사용자)

- **세 축 모두 포함** — 에러 피드백 + 진행 표시 + 프리페칭.
- **로딩 UI = 진행률 바** — 기존 Radix `Progress` 재사용.
- **프리페칭 트리거 = Start 버튼 hover/focus.**

### D1. 에러 피드백 = sonner toast (Wave C)

- `start()` catch에 `toast.error(t('start.loadError'))`를 추가해, Sprint 228 P2의 `idle` 복귀를 **사용자 가시 피드백**으로 보강한다.
- sonner는 `AppLayout`에 `Toaster`가 이미 마운트되어 있어 **신규 인프라 0**.

### D2. 로딩 진행 = onProgress 콜백 + QuizLoading 진행률 바 (Wave A·B·C)

- `getRandomQuestions`에 `onProgress(loaded, total)`를 **5번째 positional 선택 인자**로 추가한다(`rng`는 4번째로 유지 → **하위호환**). 각 청크의 `.then`에서 `loaded`를 증가시켜 콜백한다.
- `page.tsx`가 `loadProgress` state로 진행을 받아, 신규 `QuizLoading`(quiz 로컬 컴포넌트 — `components/ui` 아님 → Palette 트리거 회피) 진행률 바에 시각화한다.
- 기존 `Progress`(Radix) + `SkeletonCard` 재사용으로 **신규 디자인 토큰 0**.

### D3. 프리페칭 = prefetchQuestions fire-and-forget (Wave A·D)

- `prefetchQuestions(category)`를 신규 export한다 — **fire-and-forget**(결과 버림, 에러 swallow).
- `QuizStart`의 Start 버튼 `onMouseEnter` / `onFocus`에서 현재 선택 `category` 청크를 워밍한다. 동적 import는 캐시되므로 클릭 시 재사용되어 **체감 로딩이 감소**한다.
- 실제 로드 실패는 prefetch가 아니라 본 경로 `start()`의 `getRandomQuestions`에서 토스트로 표면화된다(prefetch는 에러를 삼킴 → 사용자 경로 피드백은 D1이 보장).

### D4. total=0 division 가드 (Wave B)

- `QuizLoading`은 `total > 0 ? round(loaded / total * 100) : 0`로 계산해 초기 스냅샷(아직 total 미설정)의 division을 안전하게 처리한다.

## 구현

총 6 atomic commit (start `834d07c`):

| 커밋 | Wave | 내용 |
|------|------|------|
| `eae614c` | A | `data/quiz/index.ts` — `getRandomQuestions`에 `onProgress` 5번째 positional 추가 + `prefetchQuestions(category)` 신규 export(fire-and-forget) |
| `d34bb99` | B | `components/quiz/QuizLoading.tsx` 신규 — `Progress`(Radix) + `aria-live` title + `SkeletonCard`, total=0 가드 |
| `94eab78` | C | `page.tsx` — `loadProgress` state, `onProgress` 배선, `start()` catch `toast.error`, `SkeletonCard` → `QuizLoading` |
| `3608f64` | D | `QuizStart.tsx` — Start 버튼 hover/focus에서 `prefetchQuestions` 호출 |
| `0ae0d87` | E | `messages/{ko,en}/quiz.json` — `start.loadError` + `loading` 네임스페이스(`title`/`progress`/`progressAria`) |
| `2c01053` | F | 테스트 — `index`(onProgress ALL 0..10·단일 0..1·prefetch reject swallow)·`page`(loading=QuizLoading progressbar·reject 시 toast.error 회귀)·`QuizLoading` 신규(6)·`QuizStart`(hover/focus/분야별 prefetch spy) |

## 검증

- **tsc**: 오류 0 (전 파일).
- **jest**: **1649 PASS / 0 FAIL** (Sprint 228 1635 → **+14**).
- **글로벌 커버리지**: lines **88.07%** / branches **79.39%** / statements **87.56%** / functions **85.23%** (게이트 83/71/81/82 통과).
- **next lint**: 0 errors.
- **next build**: "Compiled successfully". **`/[locale]/quiz` route Size 13.9kB** (Sprint 228 13.6kB 대비 +0.3kB — 문항 데이터는 여전히 route 밖 on-demand 청크로 분리, **lazy-load 회귀 없음**).
- **i18n**: ko/en 52키 정합.
- **ADR 게이트**: index count (sprint **167**) / adr-en coverage (KR/EN 1:1) / adr-links 0 broken / doc-refs no broken

## 교훈

1. **lazy-load 비동기 로드는 'loading' phase에 진행률을 노출해 체감을 개선한다** — `onProgress` 콜백으로 route 밖 데이터 청크를 N/total로 노출하면 'ALL' 병렬 로드의 진행을 사용자가 본다. 신규 컴포넌트는 기존 `Progress` + `SkeletonCard` 조합으로 토큰 0.
2. **프리페칭은 fire-and-forget + 에러 swallow로 분리하되, 실제 실패는 본 경로에서 토스트로 표면화한다** — prefetch가 에러를 삼켜도 사용자 경로(`getRandomQuestions`)에서 피드백을 보장해야 한다. 책임을 분리하되 피드백은 누락하지 않는다.
3. **동적 import 실패의 사용자 피드백은 idle 복귀(SP228 P2)에 더해 toast로 가시화해야 완결된다** — 조용한 idle 복귀만으로는 사용자가 무슨 일이 일어났는지 모른다.
4. **진행률 컴포넌트는 total=0 division 가드가 필수다** — 초기 스냅샷에서 total이 아직 0이면 `loaded/total`이 NaN/Infinity가 되므로 `total > 0` 가드로 0%를 반환한다.

신규패턴:
- **lazy-load 진행률 + 프리페치 UX 패턴** — `onProgress` 콜백을 데이터 레이어에 추가(하위호환 positional) + 기존 `Progress` 재사용 로딩 컴포넌트 + hover/focus fire-and-forget 프리페치.

## Sprint 230+ 이월

- **(운영 실행) 재배포 후 라이브 `/quiz` 검증** — `docs/runbook/quiz-ui-verification.md` 따라 실행(221~227 UI/a11y/UX/문항확장 + **228 로딩 스켈레톤 + 229 진행률 바/에러 토스트** 추가). SP217 컷오버와 같은 frontend 롤아웃으로 일괄 가능.
- SP217 컷오버 / GA4 / Sprint 196 problem_db / 하네스 --full cron — 기존 이월 유지.

## Critic 교차 리뷰

- **도구**: Codex codex-cli (Wave별 Auto-Critic + 최종 브랜치 전체)

**최종 브랜치 전체 Critic**: 머지 직전 Oracle이 별도 실행(브랜치 전체 = 권위 리뷰) — async 진행 콜백 정합·prefetch 에러 swallow·toast 피드백·total=0 가드 중점.

**종합 판정**: ✅ 머지 가능 — jest 1649 PASS(+14), route Size 13.9kB(lazy-load 회귀 없음), 커버리지·i18n·ADR 게이트 전 통과.
