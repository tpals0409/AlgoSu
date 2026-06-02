---
sprint: 218
title: "퀴즈 검증 (코드측 회귀 안전망 보강)"
date: "2026-06-02"
status: completed
agents: [Oracle, Curator, Herald, Critic, Librarian]
related_adrs: ["sprint-215", "sprint-216", "sprint-217"]
related_memory: ["sprint-window", "feedback-sprint-scoping"]
topics: ["frontend", "identity", "quiz", "testing", "ci"]
tldr: "215~217로 구축한 CS 퀴즈 기능(미니게임 코어 + 150문항 + 로그인 기록 연동) 전반을, 라이브가 아닌 코드 관점에서 검증·고정하는 안전망 스프린트. 라이브 동작 검증은 운영측 identity_db migration:run + 재배포가 선행되어야 하므로(merge ≠ 라이브) 운영 이월로 분리하고, 코드측에서 가능한 회귀 안전망에 집중했다. Playwright 등 신규 E2E 인프라는 미도입 — 기존 jest/RTL 통합 테스트 스타일로 확장했다. Curator가 150문항(5분야×30) explanation을 전수 재검수해 사실관계 오류 0건을 확인하고 acceptedAnswers 누락분 3건만 보강했으며, 콘텐츠 lint에 규칙 8(정규화 후 중복)·규칙 9(정규화 후 빈 문자열)를 WARN 전용으로 추가했다. Herald가 grade 채점 엣지케이스 +8(공백류 제거·한영 혼용·전각 NFKC)·page 플레이 플로우 통합 +5(가변 mock 플래그로 게스트/로그인 분기 한 파일 커버)·identity upsert 경계 +1을 회귀 고정했다. 추가 테스트 총 15건, 실제 버그 0건 — 모든 추가 테스트가 기존 215~217 구현을 정확히 통과해 채점 로직·저장소·merge-up·best-effort 폴백·upsert higher-only가 의도대로 동작함을 확인했다. 6 atomic commit. 검증 frontend tsc 0 / content-lint --strict exit 0 / 147 suites 1497 tests PASS·global lines 87.6%·branches 78.96% 게이트 충족 / identity quiz-record 7 PASS·gateway 8 PASS. Critic 두 라운드 모두 CLEAN. start commit 4c8d3b7."
---
# Sprint 218 — 퀴즈 검증 (코드측 회귀 안전망 보강)

## 목표

- 215~217로 구축한 CS 퀴즈 기능(미니게임 코어 + 150문항 + 로그인 기록 연동) 전반을 **라이브가 아닌 코드 관점에서 검증·고정**한다.
- 콘텐츠 정확성·채점 견고성·플레이 플로우를 **회귀 안전망으로 굳혀**, 후속 스프린트가 해당 로직을 건드릴 때 무방비로 깨지지 않게 한다.
- 라이브 동작 검증과 배포는 운영 이월로 **분리**한다(merge ≠ 라이브). 신규 E2E 인프라(Playwright)는 미도입.

## 배경

[Sprint 215](./sprint-215.md)·[216](./sprint-216.md)·[217](./sprint-217.md)은 CS 퀴즈 기능 구축에 집중했고, best 기록은 로그인 사용자 백엔드 영속화([identity_db](./sprint-217.md))까지 완성됐다. 그러나 두 가지가 남았다.

- (a) **라이브 동작 검증**은 운영측 `identity_db` `migration:run` + 재배포가 선행되어야 하므로(merge ≠ 라이브, 배포는 수동 ops) 코드 스프린트에서 직접 검증할 수 없다.
- (b) **채점/플레이 플로우 일부 경계**가 회귀 안전망 없이 남아, 후속 스프린트가 해당 로직을 건드릴 때 무방비다.

따라서 218은 코드측에서 가능한 검증·안전망에 집중한다. 라이브 검증은 운영 선행 작업에 묶여 있으므로 별도 이월로 분리한다([[feedback-sprint-scoping]] — 배포 의존 작업과 코드측 작업의 분리).

## 결정

### D0. 검증 축 — 코드측 회귀 안전망 보강

검증 축을 **코드측 회귀 안전망 보강**으로 잡는다. 라이브 동작 검증은 운영측 `migration:run` + 재배포가 선행되어야 하므로 별도 이월로 분리한다. 근거: merge ≠ 라이브, 배포는 수동 ops라 코드 스프린트에서 라이브를 직접 검증할 수 없다. (사용자 확정)

### D1. E2E 도입 — Playwright 미도입, jest/RTL 통합 테스트로 확장

신규 브라우저 E2E 인프라(Playwright)는 **미도입**하고, 기존 jest/RTL 통합 테스트 스타일로 확장한다. 근거: 신규 브라우저 E2E 인프라는 그 자체로 별도 스프린트 규모이고, `page.test.tsx` 통합 테스트로 플레이 플로우(게스트/로그인 분기·merge-up·결과 화면)를 충분히 커버할 수 있다. (사용자 확정)

### D2. 콘텐츠 lint 규칙 8의 156 WARN 수용 (Oracle 판단)

콘텐츠 lint 규칙 8(`acceptedAnswers` 정규화 후 중복)이 보고하는 **156건 WARN을 현 상태로 수용**한다. 규칙 8은 WARN 전용 설계라 `--strict`에서도 exit 0(CI 무차단)이고, 156건은 의도적 표기 쌍(`'이진 탐색'` + `'이진탐색'` 등 공백 유무)에서 비롯된 **가시성 정보**다. 콘텐츠 대규모 churn 위험을 피하고자 현 상태를 수용하고, 규칙 8을 exact-string 중복으로 좁히는 정리는 선택적 후속 이월로 둔다. (Oracle 판단)

## 구현

브랜치 `test/sprint-218-quiz-validation`, start commit `4c8d3b7`, 6 atomic commit. Wave A(Curator 콘텐츠/lint) → Wave B·C·C-2(Herald 테스트).

### 커밋

| 해시 | 내용 |
|------|------|
| `d2f126b` | fix(frontend) — Curator: 150문항 explanation 전수 재검수(사실관계 오류 0건) + `acceptedAnswers` 보강 3건(ds-30 '순차표현' / os-02 '문맥전환' / os-20 '엘알유') |
| `4684c33` | chore(frontend) — Curator: `check-quiz-content.mjs` 규칙 8(정규화 후 중복 WARN)·규칙 9(정규화 후 빈 문자열 WARN) 추가, 둘 다 WARN 전용(`--strict` exit 0) |
| `c7d368c` | chore(frontend) — Oracle: `normalizeAnswerJs` JSDoc 일본어→한국어 교정(Critic R1 Low 관찰 해소) |
| `0c380c8` | test(frontend) — Herald: `grade.test.ts` +8 — 공백류 제거·한영 혼용·전각 NFKC·한글+숫자 회귀 고정(19→27) |
| `9cb82d5` | test(frontend) — Herald: `page.test.tsx` +5 — 가변 mock 플래그 기반 게스트/로그인 분기 통합 테스트(6→11) |
| `4fe291b` | test(identity) — Herald: `quiz-record.service.spec.ts` +1 — upsertBest 동점 재제출 시 `played_at` 미갱신 경계(6→7) |

### Wave A — Curator (콘텐츠 + lint)

- **150문항(5분야×30) explanation 전수 재검수** (`d2f126b`): 사실관계 오류 **0건**. `acceptedAnswers` 누락분만 보강 3건 — `ds-30` `'순차표현'`(완전 이진 트리 배열 저장의 표준 한국어 표기) / `os-02` `'문맥전환'`(문맥교환 병행 표현) / `os-20` `'엘알유'`(LRU 음소 표기, `ds-25`와 일관성). 과적합 없이 한·영·약어 누락분만 보강.
- **콘텐츠 lint 규칙 8·9 추가** (`4684c33`): 규칙 8(`acceptedAnswers`를 `normalizeAnswer` 적용 후 중복 WARN)·규칙 9(정규화 후 빈 문자열 = 절대 미매칭 WARN). 둘 다 **WARN 전용**(`--strict` exit 0). `normalizeAnswerJs`(`grade.ts` 로직 JS 포팅)·`checkNormalizedDuplicates`·`checkEmptyNormalized`·`checkWarnOnlyRules` export. 헤더 주석 7→9 갱신. 규칙 9 현재 0건, 규칙 8 현재 156건(기존 표기 쌍, D2).

### Wave B — Herald (채점 회귀)

- **`grade.test.ts` +8** (`0c380c8`): Sprint 216 교훈(추측 케이스 남발 금지)을 엄수해, `node -e`로 `normalizeAnswer` 파이프라인의 **실제 반환을 직접 검증한 뒤 기존 미커버 갭만** 회귀 고정. 탭/개행/캐리지리턴 공백류 제거, 한·영 혼용(`'TCP 프로토콜'` → `'tcp프로토콜'`), 전각 숫자 NFKC(`'２의보수'` · `'ＩＰｖ４'`), 한글+숫자(`'base64인코딩'`). 19→27 tests.

### Wave C — Herald (플레이 플로우 통합)

- **`page.test.tsx` +5** (`9cb82d5`): 게스트만 커버하던 통합 테스트에 **인증 분기**를 추가. 가변 `mockIsAuthenticated` 플래그 + `@/lib/api/client` `fetchApi` 모킹 + `createLocalStorageQuizStore` 사전 적재. 시나리오:
  1. **재플레이 best 표시** — 만점 → 배지, 동점 재플레이 → 배지 미표시(higher-only).
  2. **인증 apiStore 완주** — 서버 `POST` 호출·결과 정상.
  3. **merge-up 멱등** — localStorage 1건 → 마운트 `POST` 1회 → 재렌더에도 1회(`ref` 플래그).
  4. **난이도별 기록 분리** — 키 `${category}::${difficulty}`, `DATA_STRUCTURE::ALL` 존재 / `::EASY` 미존재.
  5. **api-store 네트워크 전체 실패 시 결과 화면 크래시 없음**(best-effort).
  - 6→11 tests.

### Wave C-2 — Herald (identity upsert 경계)

- **`quiz-record.service.spec.ts` +1** (`4fe291b`): `upsertBest` **동점 재제출 시 `played_at` 미갱신** 경계(`WHERE best_score_percent < EXCLUDED`는 등호 미포함). 기존 spec이 낮은 점수만 커버하던 갭 보강. 6→7 tests.

### Oracle 직접 (Critic 관찰 해소)

- **`normalizeAnswerJs` JSDoc 일본어→한국어 교정** (`c7d368c`): Critic R1 Low 관찰. 코드 동작 무변경.

## 검증

Oracle 직접 재확인:

**Frontend**

- `tsc --noEmit` → 0
- `check-quiz-content.mjs --strict` → **exit 0**(규칙 1~7 통과, 규칙 8·9 WARN-only)
- `jest --coverage` → **147 suites · 1497 tests PASS / 0 fail**, 글로벌 lines **87.6%**(게이트 83) · branches **78.96%**(게이트 71)
- `next build` → ✓ Compiled, `ƒ /[locale]/quiz` 37.5kB(217 동일 — 테스트 전용이라 번들 무변경)
- `next lint` → 0 errors(기존 `sonner`·`useAutoSave` warning만, 퀴즈 무관)

**Identity / Gateway**

- identity quiz-record **7 PASS** / gateway quiz-record **8 PASS**

## 교훈

1. **검증 스프린트는 "테스트가 현 동작을 먼저 검증한 뒤 갭만 고정"한다** — 추측 케이스 남발은 금지다(Sprint 216 교훈 재확인). Herald가 `node -e`로 `normalizeAnswer`의 실제 반환을 확인하고 **미커버 갭만** 추가해, 채점 파이프라인의 현 동작에 정확히 맞물린 회귀 안전망을 깔았다.
2. **WARN-only lint 규칙은 의도적 표기 다양성을 차단하지 않으면서 위험을 가시화한다** — 규칙 8·9는 정규화 후 중복·빈 문자열을 **가시화하되 hard gate와 분리**했다. 공백 유무 동의어(`'이진 탐색'` + `'이진탐색'`) 같은 의도적 표기 쌍은 차단하지 않으면서, 실수로 들어간 빈 정규화·완전 중복은 드러낸다.
3. **추상화 경계가 라이브 없이 검증을 가능하게 한다** — `QuizRecordStore` 인터페이스(215)·순수함수 `grade`(215) 덕에 플레이 플로우·채점을 단위/통합 테스트로 라이브 배포 없이 검증할 수 있었다. 추상화 경계는 테스트 가능성을 함께 높인다.
4. **검증/안전망 작업은 라이브 배포 의존과 코드측을 분리하면 배포 대기 없이 독립 진행된다** — 라이브 동작 검증은 운영 `migration:run`에 묶여 있으므로 이월로 분리하고, 코드측 회귀 안전망은 머지 가능한 단위로 독립 완료했다.

## 신규 패턴

- **가변 mock 플래그 기반 인증 분기 통합 테스트** — `let mockIsAuthenticated` + 글로벌/중첩 `beforeEach` 순서로 게스트·로그인 두 경로를 **한 파일에서 오염 없이** 커버한다. `fetchApi` 모킹 + `createLocalStorageQuizStore` 사전 적재로 인증 사용자 플로우(서버 POST·merge-up 멱등·best-effort 폴백)를 라이브 없이 통합 검증한다.

## Sprint 219+ 이월

- **운영측 `identity_db` `migration:run`(SP217 `quiz_records`) + 서버 재배포 + 라이브 `/quiz` E2E 검증** (사용자/운영, 중요): merge ≠ 라이브. `20260602000000-SP217-CreateQuizRecords`를 운영 `identity_db`에 적용하고 재배포 후, 로그인 상태 `/quiz` 플레이 → 기기 간 best 동기화·난이도별 기록·merge-up 동작 확인.
- **규칙 8을 exact-string 중복으로 좁히는 정리** (선택, D2): 의도적 공백 유무 동의어 쌍을 제외하고 완전 동일 문자열 중복만 WARN하도록 좁히는 후속 정리.
- **api-store GET 캐시 히트 단언 보강** (Critic P4): 인증 시나리오 2에서 GET 캐시 히트 단언을 보강.
- **GA4 데이터 스트림 URL 정합 + Enhanced Measurement history page_view OFF + 프로덕션 page_view UAT** (사용자, Sprint 210/211/212 이월 지속)
- **운영 Sprint 196 `problem_db` 마이그레이션 실행** (사용자/운영)
- **하네스 `--full` CI 정기 실행 자동화 검토** (Sprint 209 이월 지속)

## Critic 교차 리뷰

**Curator R1 — CLEAN** (Codex gpt-5.5, `codex review --base 4c8d3b7`, codex-cli, session `019e868a-23c9-7b61-8e16-188caf469a80`)

- Critical / High / Medium / Low **0건**.
- 관찰 [Low] `normalizeAnswerJs` JSDoc 일본어 → `c7d368c`로 해소. [Info] 규칙 8 156 WARN 의도 확인(D2).

**Herald R1 — CLEAN** (Codex gpt-5.5, `codex review --base c7d368c`, session `019e869e-8a0a-72c2-a036-4ddace7ea102`)

- Critical / High / Medium / Low **0건**.
- 테스트 전용·mock 설계가 페이지 실행 흐름과 정확히 일치하고 테스트 오염 방지 구조가 완비됨.
- P4(비차단) — 인증 시나리오 2에서 GET 캐시 히트 단언 미보강(후속 이월).

**최종 — CLEAN**. 두 라운드 모두 Critical/High/Medium/Low 0건, P4 비차단만 이월.
