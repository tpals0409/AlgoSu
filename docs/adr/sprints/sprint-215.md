---
sprint: 215
title: "CS 퀴즈 미니게임 코어 (프론트엔드 단답형 게임 + PoC 콘텐츠)"
date: "2026-06-01"
status: completed
agents: [Oracle, Librarian, Critic]
related_adrs: ["sprint-105"]
related_memory: ["sprint-window", "feedback-commitlint-scope", "feedback-sprint-scoping"]
topics: ["frontend", "quiz", "i18n", "feature"]
tldr: "AlgoSu에 CS 지식 퀴즈를 신규 추가하되, 출제자가 문제를 등록/관리하는 백엔드 도메인 확장이 아니라 가볍게 플레이하는 프론트엔드 미니게임으로 형태를 확정했다. 객관식이 아닌 단답형(키워드 입력) 채점으로, normalizeAnswer(소문자화→한/영/숫자 외 공백 치환→trim→공백 제거)와 gradeAnswer(정규화 후 acceptedAnswers와 정확 일치 하나라도 있으면 정답)를 순수함수로 구현하고, acceptedAnswers를 정답+동의어(한/영/약어) 배열로 둬 입력 흔들림을 흡수했다. 기록 영속화는 QuizRecordStore 인터페이스 + createLocalStorageQuizStore() 구현으로 추상화하여 Sprint 217에서 서버 동기화로 무중단 교체 가능하게 했다. PoC로 자료구조·알고리즘 2개 분야 총 24문항을 src/data/quiz/ 정적 은행에 담고, /[locale]/quiz 라우트에 idle→playing→result 상태머신 게임 페이지를 추가했다(신규 ui 컴포넌트 0, Palette 권한 보존). 백엔드 0·코드 변경은 프론트엔드 only. 한 스프린트에 게임+채점+콘텐츠+백엔드+마이그레이션을 몰지 않도록 215(코어)/216(문항 은행·출제 UX)/217(로그인 기록 연동)의 3-스프린트 로드맵으로 분할했다. Critic(Codex) P2 1건(storage writeMap 미가드)을 수정 반영, 최종 CLEAN."
---
# Sprint 215 — CS 퀴즈 미니게임 코어 (프론트엔드 단답형 게임 + PoC 콘텐츠)

## 목표

- AlgoSu에 CS 지식 퀴즈를 신규 기능으로 추가하되, **가볍게 플레이하는 미니게임** 형태로 코어 플레이 루프를 완성한다.
- 객관식이 아닌 **단답형(키워드 입력)** 채점 엔진을 순수함수로 구현하고, 입력 흔들림(괄호/공백/한영/대소문자)을 동의어 배열로 흡수한다.
- 기록 영속화를 인터페이스로 추상화하여 Sprint 217의 서버 동기화 교체에 대비한다.
- 큰 피처를 한 스프린트에 몰지 않도록 3-스프린트 로드맵으로 분할한다.

## 배경

AlgoSu에 CS 지식 퀴즈 신규 기능 추가 요청이 들어왔다. 여기서 가장 먼저 정해야 할 것은 **형태**다. 출제자가 문제를 등록/관리하는 백엔드 도메인 기능(problem 서비스 확장)으로 키울지, 사용자가 가볍게 플레이하는 **미니게임**으로 갈지에 따라 작업 규모가 크게 달라진다. 사용자 요구사항의 핵심은 후자 — 객관식이 아닌 **단답형(키워드 입력)** 채점, 로그인 사용자 기록 영속화, 광범위 문항 은행이다.

이 세 요구사항을 한 스프린트에 (게임 UX + 채점 엔진 + 대량 콘텐츠 + 신규 백엔드 + 마이그레이션) 모두 몰면 리뷰/검증이 비대해지고, [[feedback-sprint-scoping]]에 정리된 "대규모 전환은 다중 스프린트 로드맵으로 분할" 교훈에 어긋난다. 따라서 **3-스프린트 로드맵**으로 분할한다.

- **Sprint 215 (본 스프린트)**: 프론트 미니게임 **코어** — 단답형 채점 엔진 + idle→playing→result 게임 루프 + PoC 2개 분야 문항. 기록은 localStorage(임시).
- **Sprint 216**: 광범위 문항 은행(전 분야) + 출제 UX 다양화 + 콘텐츠 lint + 채점 정확도(부분/유사 매칭) 보강.
- **Sprint 217**: 로그인 사용자 기록 연동(QuizRecord 엔티티 + 마이그레이션, Identity 확장 유력). localStorage → 서버 API 교체.

215는 **프론트엔드 only**로 코어 플레이 루프를 완성하고, 백엔드는 0이며, 기록은 localStorage 임시 저장으로 둔다.

## 결정

### D0. 미니게임 형태 확정 — frontend 정적 문항 은행, 백엔드 0

problem/submission 백엔드 도메인 확장이 아니라 `src/data/quiz/` 기반의 **frontend 정적 문항 은행**으로 구현한다. 215는 백엔드 변경이 0이며, 신규 서비스·엔티티·마이그레이션이 없다. 미니게임은 관리형 출제 시스템보다 압도적으로 가볍고, 코어 플레이 루프를 단독으로 완성·검증할 수 있다.

### D1. 단답형 키워드 채점 — 정규화 + 동의어 배열

순수함수 2개로 채점 엔진을 구성한다.

- `normalizeAnswer(input)` — 소문자화 → 한글·영문·숫자 외 문자를 공백으로 치환 → trim → 모든 공백 제거. 예) `"O(log n)!"` → `"ologn"`, `"이진 탐색"` → `"이진탐색"`.
- `gradeAnswer(input, acceptedAnswers)` — input과 acceptedAnswers를 각각 정규화한 뒤, 정확 일치하는 항목이 **하나라도** 있으면 정답.

`acceptedAnswers`를 정답 키워드 + 동의어(한/영/약어) 배열로 둬 입력 흔들림을 흡수한다(괄호/공백/한영/대소문자). 부분/유사 매칭(편집 거리 등)은 Sprint 216으로 이월한다 — 215는 정확 일치 + 동의어로 충분한 코어 정확도를 확보한다.

### D2. 3-스프린트 분할 — 각 스프린트 단독 머지/플레이 가능

각 스프린트가 단독으로 머지·플레이 가능한 산출물이어야 한다. 215 머지 시점에 **자료구조·알고리즘 2개 분야로 즉시 플레이 가능**하다. 216/217이 미완이어도 215는 그 자체로 동작하는 미니게임이다.

### D3. 기록 영속화 인터페이스 추상화

`QuizRecordStore` 인터페이스(`getBest` / `saveResult` / `getAllBest`)를 정의하고, 215에서는 `createLocalStorageQuizStore()` 구현을 제공한다. Sprint 217에서 localStorage → 서버 동기화로 **구현만 교체**할 수 있도록 인터페이스를 분리한다. 저장 키는 `'algosu.quiz.records'`, SSR 가드를 둔다(서버 렌더 시 localStorage 접근 차단).

### D4. commitlint scope — feat(frontend) 사용

quiz는 별도 디렉토리 scope가 아니라 frontend 내부 기능이므로, `feat(frontend)` / `test(frontend)` / `fix(frontend)`를 사용한다(scope-enum에 `quiz` 미추가). 신규 최상위 디렉토리를 만들 때만 scope-enum 등록이 필요하다 — [[feedback-commitlint-scope]] 및 [Sprint 105](./sprint-105.md)의 동적 scope-enum 구조 참조.

## 구현

브랜치 `feat/sprint-215-cs-quiz-minigame`, 8 atomic commit, 34 files (+2009 / −3). 프론트엔드 only(백엔드 0).

### 데이터 (`src/data/quiz/`)

- `types.ts` — 문항/분야 타입, `LocalizedText`(ko/en)
- `data-structure.ts` — 자료구조 분야 12문항
- `algorithm.ts` — 알고리즘 분야 12문항
- `index.ts` — `ALL_QUESTIONS` / `QUIZ_CATEGORIES` / `getQuestionsByCategory` / `getRandomQuestions`

PoC 2개 분야 총 **24문항**.

### 로직 (`src/lib/quiz/`)

- `grade.ts` — `normalizeAnswer` / `gradeAnswer` 순수함수 (D1)
- `storage.ts` — `QuizRecordStore` 인터페이스 + localStorage 구현. `readMap` / `writeMap` **둘 다** try-catch 가드(D3 + Critic P2 수정 반영).

### UI (`src/app/[locale]/quiz/`, `src/components/quiz/`)

- `page.tsx` (`'use client'`) — idle → playing → result 상태머신
- `layout.tsx` / `error.tsx` / `loading.tsx` — 라우트 보일러플레이트
- `QuizStart` / `QuizPlay` / `QuizQuestion` / `QuizFeedback` / `QuizResult` — 게임 컴포넌트. **기존 ui 컴포넌트 재사용(신규 ui 0, Palette 권한 보존)**. `useLocale`로 ko/en `LocalizedText` 분기.

### i18n / nav

- `messages/{ko,en}/quiz.json` (32키 정합) + `i18n/request.ts` NAMESPACES에 `'quiz'` 추가 + `test-utils/i18n.tsx` DEFAULT_MESSAGES 등록
- `AppLayout.tsx` NAV_ITEMS에 quiz 항목(Brain 아이콘, `/quiz`) + `messages/{ko,en}/layout.json` `nav.quiz`

### 커밋

| 해시 | 내용 |
|------|------|
| `66e6b17` | 데이터 모델 (types + 24문항 + index) |
| `89b1f5f` | 채점 엔진 + 저장소 (grade/storage) |
| `0b2f157` | 코어 단위 테스트 |
| `d8a39d8` | i18n (quiz.json + NAMESPACES + test-utils) |
| `104750c` | UI 컴포넌트 5종 |
| `d43a8be` | 게임 페이지 (상태머신 + 라우트) |
| `8dc2d39` | nav 항목 |
| `c289cb3` | Critic P2 fix — storage writeMap 가드 |

## 검증

Oracle 직접 검증 (P2 수정 반영 후):

- `tsc --noEmit` → 0
- `next lint` → 0 errors / 0 warnings (quiz 무관 변경)
- `test:coverage` → **146 suites · 1462 tests PASS**, 글로벌 lines 87.43% · branches 78.84% (게이트 83% / 71% 충족)
- **quiz 컴포넌트 5종 · `lib/quiz`(grade/storage) 모두 커버리지 100%**
- `next build` → ✓ Compiled 6.6s, `ƒ /[locale]/quiz` 라우트 생성 (12.4kB)
- CS 문항 24개 정확성 Oracle 검수 통과

## 교훈

1. **미니게임은 백엔드 없이 프론트 정적 데이터로 코어 플레이 루프를 완성할 수 있다** — 신규 기능을 무조건 백엔드 도메인으로 키우지 말고, 형태(미니게임 vs 관리형 출제 시스템)를 먼저 확정한다. 형태 확정이 작업 규모와 스프린트 분할을 결정한다.
2. **단답형 채점은 정규화 + 동의어 배열로 입력 흔들림을 흡수한다** — 괄호/공백/한영/대소문자를 `normalizeAnswer`로 평탄화하고, 정답을 단일 문자열이 아닌 `acceptedAnswers` 배열(정답 + 한/영/약어 동의어)로 둬야 사용자 입력의 다양성을 정확 일치만으로도 잡아낼 수 있다.
3. **영속화는 읽기·쓰기 양쪽을 모두 가드해야 한다** — `readMap`만 가드하고 `writeMap`을 누락하면 Safari 프라이빗 모드/쿼터 초과 같은 일부 브라우저 환경에서 `setItem`이 throw하여 완료 플로우가 라우트 error 바운더리로 빠진다(Critic P2). 영속화 실패와 결과 표시를 분리하고, 영속화는 best-effort로 처리한다.
4. **큰 프론트 피처는 Wave 분할(코어 로직 → UI)로 일관 구현 + 각 Wave 검증** — 데이터 모델 → 채점/저장 로직 → 단위 테스트 → i18n → UI → 페이지 → nav 순의 atomic commit으로 각 층을 독립 검증하며 쌓아 올린다.

## 신규 패턴

- **기록 영속화 인터페이스 추상화 패턴** — `Store` 인터페이스 + localStorage 구현을 분리해, 추후 서버 동기화로 무중단 교체(Sprint 217 대비)가 가능하다. 호출부(게임 페이지)는 인터페이스에만 의존하므로, 217에서 게스트=localStorage·로그인=서버 병합으로 구현을 갈아끼워도 UI 변경이 없다.
- **best-effort 영속화 패턴** — 읽기/쓰기 양쪽을 try-catch 가드하여, 스토리지 제약 환경(프라이빗 모드·쿼터 초과)에서도 핵심 UX(결과 표시)를 보존한다. 부수적 관심사(기록 저장) 실패가 주 플로우(플레이 → 결과)를 깨뜨리지 않는다.

## Sprint 216+ 이월

- **Sprint 216 — 광범위 문항 은행** (계획): 전 분야 문항 확장 + 콘텐츠 lint + 출제 다양화 + 채점 정확도 보강(부분/유사 매칭).
- **Sprint 217 — 로그인 사용자 기록 연동** (계획): QuizRecord 엔티티 + 마이그레이션, Identity 확장 유력. `storage.ts` 추상화를 서버 API로 교체, 게스트=localStorage·로그인=서버 병합.
- **서버 재배포 + 라이브 SEO 검증** (사용자/운영): Sprint 212/213 산출물. merge ≠ 라이브, 재배포 후 `curl https://algo-su.com/sitemap.xml`·`robots.txt`로 도메인 정합 확인 <!-- doc-ref-lint: ignore -->
- **GA4 데이터 스트림 URL 정합 + Enhanced Measurement history page_view OFF + 프로덕션 page_view UAT** (사용자, Sprint 210/211/212 이월 지속)
- **운영 Sprint 196 마이그레이션 실행** (사용자/운영)
- **하네스 `--full` CI 정기 실행 자동화 검토** (Sprint 209 이월 지속)

## Critic 교차 리뷰

**R1 — P2 1건** (Codex, `codex review --base 35fb77d`, codex-cli 0.130.0 / gpt-5.5, session `019e81c1-7834-78e0-b531-8be1d75dd74d`)

> storage.ts `writeMap()`의 `localStorage.setItem`이 가드되지 않아, Safari 프라이빗 모드/쿼터 초과 시 throw → `finish()`가 결과 화면 전환 전에 `saveResult`를 호출하면서 라우트 error 바운더리로 빠진다.

- **조치**: 작성자 수정 `c289cb3` — `writeMap`에 try-catch 가드 추가 + 회귀 테스트. `readMap` 폴백 패턴과 일관되게 처리했고, `storage.ts` 커버리지 100%를 유지했다. 영속화는 결과 표시에 부수적이므로 best-effort 처리가 타당하다.
- Critical / High **0건**.

**최종 — CLEAN**. P2 수정 반영 후 회귀 없음.
