---
sprint: 228
title: "퀴즈 분야별 문항 lazy-load 번들 최적화"
date: "2026-06-07"
status: completed
agents: [Oracle, Herald, Scribe, Librarian, Critic]
related_adrs: ["sprint-227", "sprint-224", "sprint-215"]
related_memory: ["sprint-window"]
topics: ["quiz", "frontend", "performance", "bundle-optimization", "ci", "codegen"]
tldr: "Sprint 227로 350문항(10분야) 확장되며 /[locale]/quiz route 번들이 40.2→84.8kB로 증가한 것을, 분야별 dynamic import(lazy-load)로 전환해 초기 번들에서 문항 데이터를 제거했다. 근본 원인은 index.ts의 eager ALL_QUESTIONS 정적 합산 — 클라이언트 배럴에서 이 합산을 제거하고, 동기 카운트는 빌드타임 codegen(question-counts.ts)으로 공급(CI 신선도 게이트 + 실데이터 대조 테스트 이중 가드), getRandomQuestions는 async화(단일 분야=청크 1개, 'ALL'=Promise.all 10청크), shuffle은 shuffle.ts로 추출(DRY), eager 동기 API는 all.ts(테스트 전용)로 격리. 로딩 UI는 기존 SkeletonCard 재사용(신규 컴포넌트 0). 결과: route Size 84.8kB→13.6kB(−71.2kB, −84%). jest 1634 PASS(+79), 글로벌 lines 88.0%/branches 79.4%. 프론트 전용 + CI/codegen, merge≠라이브."
---
# Sprint 228 — 퀴즈 분야별 문항 lazy-load 번들 최적화

## 목표

- Sprint 227로 350문항(10분야)으로 확장되며 `/[locale]/quiz` route 번들이 **40.2 → 84.8kB**로 증가한 것을, 분야별 **dynamic import(lazy-load)** 로 전환해 초기 번들에서 문항 데이터를 제거한다.
- 동기 UI(문항수 옵션 결정)에 필요한 분야별 카운트는 데이터 로드 없이 경량 메타로 공급하되, **빌드타임 codegen + 이중 가드**로 드리프트/부정확을 차단한다.
- 프론트 전용 + CI/codegen — merge ≠ 라이브(재배포 후 라이브 검증은 `quiz-ui-verification` 런북 이월에 합류).

## 배경

Sprint 227은 CS 퀴즈(`/quiz`)를 150→350문항(10분야)으로 확장하면서, 교훈 ⑤로 "클라이언트 번들 문항 데이터는 풀 확장이 번들 크기에 선형 반영"을 기록하고 분야별 lazy-load를 이월 시드로 남겼다.

근본 원인은 `index.ts`(클라이언트 배럴)의 **eager `ALL_QUESTIONS` 정적 합산**이었다. 배럴이 10분야 문항 모듈(~270KB raw)을 모두 정적 import해 합산하므로, 어떤 컴포넌트가 배럴에서 무엇 하나만 import해도 전 분야 데이터가 번들에 끌려왔다. 코드 스플리팅의 전제는 이 eager 합산을 클라이언트 배럴에서 제거하는 것이다.

Sprint 228은 이 갭을 해소한다.

## 결정

### D0. 확정 결정 (사용자)

- **카운트 공급 = 빌드타임 codegen**: `question-counts.ts`를 자동 생성하고(수동 갱신 불필요), CI 신선도 게이트로 드리프트를 차단한다.
- **로딩 UI = 기존 SkeletonCard 재사용**: 신규 컴포넌트 0.

### D1. eager 합산 제거 + 데이터 레이어 분리 (Wave A)

- **근본 원인 해소**: `index.ts`(클라이언트 배럴)에서 eager `ALL_QUESTIONS` 합산을 제거한다.
- **동적 로더**: `loaders.ts`에 `CATEGORY_LOADERS`(분야→동적 `import()` 맵)를 정의한다.
- **순수 유틸 추출(DRY)**: `shuffle`은 데이터 무관 순수함수이므로 `shuffle.ts`로 추출해 `index.ts`·`all.ts`가 공유한다.
- **eager 동기 API 격리**: 동기 eager가 필요한 `ALL_QUESTIONS`·`getQuestionsByCategory`·`getQuestionsByFilter`는 `all.ts`(테스트/서버 전용)로 이동한다. 클라이언트 런타임 경로에서는 import되지 않는다.

### D2. 동기 카운트 codegen 공급 (Wave A)

- `QuizStart`는 문항수(5/10) 옵션을 결정하기 위해 **동기 카운트**가 필요하다(신규 분야는 HARD 6문항 < 10이므로 옵션 동적 결정 필수).
- 데이터를 로드하지 않고 카운트만 공급하기 위해 `question-counts.ts`를 **빌드타임 codegen**(`gen-quiz-counts.mjs`)으로 생성한다. codegen은 `check-quiz-content.mjs`의 텍스트 파서를 재사용해 분야×난이도 카운트를 추출한다.
- `counts.ts`의 `getAvailableCount`가 생성물 `QUESTION_COUNTS`에서 카운트를 공급한다(데이터 미로드).

### D3. getRandomQuestions async화 (Wave A)

- `getRandomQuestions`를 async로 전환한다:
  - **단일 분야**: 해당 분야 청크 1개만 동적 로드.
  - **'ALL'**: `Promise.all`로 10분야 청크를 병렬 로드 후 합산.
- 정적 `QUIZ_CATEGORIES`는 데이터가 아니라 `Object.keys(QUESTION_COUNTS)`로 산출(경량 메타).

### D4. 이중 가드 (Wave A·D)

데이터(소스)와 카운트(codegen 생성물)가 어긋날 위험을 두 겹으로 차단한다:

1. **CI 신선도 게이트**: `gen-quiz-counts.mjs` 재실행 후 `git diff --exit-code`로 생성물 드리프트를 차단(소스 변경 후 codegen 미재실행 시 fail).
2. **실데이터 대조 테스트**: `counts.test`가 실데이터(`ALL_QUESTIONS`, `all.ts` 경유)의 분야×난이도 집계를 `QUESTION_COUNTS`와 대조한다.

### D5. UI async 전환 (Wave B)

- `QuizStart`: `getAvailableCount`로 카운트 공급(동기, 데이터 미로드).
- `page.tsx`: `start()` async화 + `'loading'` Phase 추가 + 기존 `SkeletonCard`(void 래퍼) 표시. **신규 컴포넌트 0**.

## 구현

총 6 atomic commit (start `30ff82b`):

| 커밋 | 에이전트 | 내용 |
|------|---------|------|
| `faaf0c0` | Herald | Wave A — `shuffle.ts`·`loaders.ts`(`CATEGORY_LOADERS` 동적 import 맵)·`all.ts`(eager, 테스트 전용) 추가 |
| `3eecbeb` | Herald | Wave A — `gen-quiz-counts.mjs`(codegen, check-quiz-content.mjs 텍스트 파서 재사용)·`question-counts.ts`(생성물) 추가 |
| `59bf50a` | Herald | Wave A — `index.ts` 배럴 lazy-load 리팩터(eager 제거, async `getRandomQuestions`, 정적 `QUIZ_CATEGORIES=Object.keys(QUESTION_COUNTS)`)·`counts.ts`(`getAvailableCount`) |
| `03dbb86` | Scribe | Wave B — `QuizStart` `getAvailableCount` 전환·`page.tsx` async `start()`+`'loading'` Phase+`SkeletonCard`(void 래퍼) |
| `fc6f3b7` | Herald | Wave C — 테스트 6파일: `data-integrity`·`index` 테스트 `../all` import+async 전환, `counts.test`(가드②)·`loaders.test` 신규 |
| `1874b92` | Librarian | Wave D — `ci.yml` codegen 신선도 게이트·`package.json` `gen:quiz-counts` 스크립트 |

## 검증

- **codegen 멱등성**: YES (2회 실행 byte-identical). `question-counts`: 원본 5분야 16/17/17=50, 신규 5분야 7/7/6=20, 총 **350**.
- **tsc**: 오류 0 (전 파일).
- **jest**: **1634 PASS / 0 FAIL** (Sprint 227 1555 → **+79**).
- **글로벌 커버리지**: lines **88.0%** / branches **79.4%** (게이트 83/71 통과).
- **next build**: "Compiled successfully". **`/[locale]/quiz` route Size 84.8kB → 13.6kB (−71.2kB, −84%)** — 문항 데이터가 별도 on-demand 청크로 분리(빌드 산출물에서 확인). First Load JS 308kB.
- **check-quiz-content --strict**: 통과(회귀 0). CI 신선도 게이트 로컬 exit 0.
- **ADR 게이트**: index count (sprint **166**) / adr-en coverage (KR/EN 1:1) / adr-links 0 broken / doc-refs no broken

## 교훈

1. **eager 합산 배럴이 lazy-load의 근본 장애물** — 클라이언트 배럴이 데이터를 정적 import해 합산하면, 단 하나만 import해도 전 데이터가 번들에 끌려온다. 배럴에서 데이터 정적 import를 제거하는 것이 코드 스플리팅의 전제다.
2. **동기 UI 의존(카운트)은 데이터와 분리된 경량 메타로 공급하되 드리프트를 가드한다** — 카운트를 codegen 생성물로 분리하면 데이터 로드 없이 동기 UI를 그릴 수 있다. 단 소스↔생성물 드리프트/부정확을 **이중 가드(CI 신선도 게이트 + 실데이터 대조 테스트)** 로 막아야 한다.
3. **route Size가 핵심 추적 지표** — 84.8→13.6kB로 데이터가 route 밖 on-demand 청크로 이동했음을 빌드 산출물에서 확인. "번들 크기"가 아니라 "route Size"가 lazy-load 성공의 객관 지표다.
4. **Auto-Critic 격리 리뷰는 멀티-Wave 작업에서 "후속 Wave 미반영 BLOCK"을 낼 수 있다** — Auto-Critic은 단일 커밋셋만 격리 리뷰하므로 후속 Wave 계획을 모른다. Wave A BLOCK(C1 page await·C2 QuizStart getAvailableCount·C3 테스트 import)은 전부 후속 Wave B/C 계획 작업이었고 이미 `03dbb86`/`fc6f3b7`에서 해소됐다. **최종 브랜치 전체 리뷰가 권위.**
5. **async 전환은 'loading' phase + 기존 SkeletonCard 재사용으로 신규 컴포넌트 0** — 데이터 비동기화에 따른 로딩 상태는 전용 phase + 기존 스켈레톤 재사용으로 흡수하면 신규 UI 컴포넌트 없이 처리할 수 있다.

신규패턴:
- **lazy-load 데이터 레이어 패턴** — 클라이언트 배럴은 경량 메타(카운트) + 동적 로더만 노출하고, eager 합산은 별도 테스트 전용 모듈(`all.ts`)로 격리한다.
- **codegen + 이중 가드 패턴** — 빌드타임 생성물(`question-counts.ts`) + CI 신선도 게이트(gen 재실행 + git diff) + 실데이터 대조 테스트로 소스↔생성물 정합을 보장한다.

## Sprint 229+ 이월

- **(운영 실행) 재배포 후 라이브 `/quiz` 검증** — `docs/runbook/quiz-ui-verification.md` 따라 실행(221~227 UI/a11y/UX/문항확장 + **228 로딩 스켈레톤** 추가). SP217 컷오버와 같은 frontend 롤아웃으로 일괄 가능.
- SP217 컷오버 / GA4 / Sprint 196 problem_db / 하네스 --full cron — 기존 이월 유지.

## Critic 교차 리뷰

- **도구**: Codex codex-cli (자동 큐잉 Auto-Critic + Wave별 + 최종 브랜치 전체)

**Auto-Critic (Wave별 격리 리뷰)**:
- **Wave A**: 격리 리뷰 BLOCK 판정 — C1(page await)·C2(QuizStart getAvailableCount)·C3(테스트 import). 단 전부 후속 Wave B/C 계획 작업이었고 이미 `03dbb86`/`fc6f3b7`에서 해소됨. (Auto-Critic은 단일 커밋셋만 격리 리뷰해 후속 Wave를 모름 — 교훈 ④.)
- **Wave C**: R1 CLEAN (P-finding 0) — *"limited to tests, consistent with async loading architecture."*
- **Wave D-1**: R1 CLEAN (P-finding 0) — *"freshness 게이트 설계 정상, 멱등성 보장."*

**최종 브랜치 전체 Critic**: 머지 직전 Oracle이 별도 실행(브랜치 전체 = 권위 리뷰).

**종합 판정**: ✅ 머지 가능 — Wave별 BLOCK은 전부 후속 Wave 계획 작업으로 해소, Wave C/D CLEAN. jest 1634 PASS + route Size −84% 검증, 커버리지·ADR 게이트 전 통과.
