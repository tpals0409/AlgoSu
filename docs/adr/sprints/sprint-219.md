---
sprint: 219
title: "퀴즈 lint 정리 (규칙 8 표기 중복 + apiStore GET 캐시 단언)"
date: "2026-06-03"
status: completed
agents: [Oracle, Curator, Herald, Critic, Librarian]
related_adrs: ["sprint-216", "sprint-217", "sprint-218"]
related_memory: ["sprint-window"]
topics: ["frontend", "quiz", "ci", "testing"]
tldr: "Sprint 218에서 선택적 후속으로 이월한 퀴즈 콘텐츠 lint·테스트 정리 두 항목을 소화한 작은 정리 스프린트. (1) check-quiz-content.mjs 규칙 8(acceptedAnswers 정규화 후 중복 WARN)이 normalizeAnswer로 공백·구두점을 전부 제거한 뒤 비교해 '연결리스트'/'연결 리스트'·'btree'/'b tree'/'b-tree' 같은 공백·하이픈 유무의 의도적 표기 변형 156건을 노이즈로 신고하던 문제를, 비교 키를 caseFoldKey(NFKC→소문자→trim, 내부 공백·하이픈·구두점 보존)로 교체해 '대소문자·앞뒤 공백만 다른 진짜 중복'만 잡도록 좁혔다. 156 WARN → 0. 좁힌 규칙이 진짜 중복 1건(db-22 '2PL'/'2pl' 대소문자 차이)을 정확히 잡아내 정리했다. (2) Sprint 218 Critic herald P4 이월 — 인증 경로 통합 테스트(page.test.tsx Scenario 2)가 saveResult POST만 단언하고 getBest 유발 GET·캐시 동작을 단언하지 않던 갭을, finish() 호출 순서 nth 단언 + toHaveBeenCalledTimes(2)로 보강하고 api-store.test.ts에 getBest 캐시 히트 단언을 추가했다. 사용자 결정: 규칙 8 기준은 '대소문자 무시 + 구두점/공백 보존'(의도적 표기 변형 보존). lint 스크립트 단위 테스트는 추가하지 않음(jest roots=src/만, scripts/*.mjs 대상 밖 — 216/218 관행 유지, node 실행 검증). 4 atomic commit. 검증 frontend tsc 0 / content-lint --strict exit 0(규칙 8·9 0건) / 147 suites 1498 tests PASS·global lines 87.6%·branches 78.96% 게이트 충족 / next build ✓ /[locale]/quiz 37.5kB(번들 무변경) / next lint 0 errors. Critic 1라운드 CLEAN. 코드측 정리 only — 라이브 배포 무관. start commit 1813a5f."
---
# Sprint 219 — 퀴즈 lint 정리 (규칙 8 표기 중복 + apiStore GET 캐시 단언)

## 목표

- Sprint 218에서 **선택적 후속**으로 이월한 퀴즈 콘텐츠 lint·테스트 정리 두 항목을 소화한다.
- **규칙 8 노이즈 제거**: `check-quiz-content.mjs` 규칙 8이 의도적 표기 변형 156건을 노이즈로 신고하던 것을, 진짜 중복만 잡도록 좁힌다.
- **apiStore GET 캐시 단언 보강**(Sprint 218 Critic herald P4): 인증 경로 통합 테스트의 GET·캐시 단언 갭을 메운다.
- **코드측 정리 only** — 라이브 배포 무관(운영 `migration:run` 이월과 분리).

## 배경

### 규칙 8이 의도적 표기 다양성을 노이즈로 신고

Sprint 218이 추가한 콘텐츠 lint 규칙 8(`checkNormalizedDuplicates`)은 `acceptedAnswers`를 `normalizeAnswer`(NFKC → 소문자 → 영숫자·한글 외 제거 → **공백 전부 제거**)로 정규화한 뒤 동일해지는 항목을 모두 WARN했다. 그런데 현재 156건 WARN이 **전부** `['연결리스트','연결 리스트']`, `['btree','b tree','b-tree']`, `['logn','log n']` 같은 **공백·하이픈 유무의 의도적 표기 쌍**이었다.

`normalizeAnswer`가 공백·구두점을 제거하므로 채점상 이 동의어들은 모두 동일 키로 매칭되지만, 콘텐츠에는 사람이 다양하게 입력할 표기를 가독성 목적으로 둘 다 보여주는 **정상 케이스**다. 규칙 8이 이 의도적 다양성을 중복으로 신고하면서, WARN-only 설계(`--strict` exit 0, CI 무차단)임에도 매 실행마다 156줄의 노이즈를 출력했다.

### apiStore GET 캐시 단언 미보강 (Sprint 218 Critic herald P4)

`page.test.tsx`의 인증 경로 Scenario 2(`completes game via apiStore`)는 `saveResult`의 POST 호출만 단언하고, 그 앞 `getBest`가 유발하는 GET 호출 및 캐시 동작(결과 화면 렌더 중 불필요한 재-GET 없음)을 단언하지 않았다. Sprint 218 Critic이 P4(비차단)로 후속 이월했다.

## 결정

### D1. 규칙 8 비교 기준 — 대소문자 무시 + 구두점/공백 보존 (사용자 확정)

규칙 8의 비교 키를 `normalizeAnswer`(공백·구두점 전부 제거)에서 `caseFoldKey`(NFKC → 소문자 → `trim`, **내부 공백·하이픈·구두점은 보존**)로 교체한다. 이로써:

- `'연결리스트'`/`'연결 리스트'`, `'btree'`/`'b tree'`/`'b-tree'` 같은 **공백·하이픈 유무의 의도적 표기 변형은 서로 다른 키**가 되어 통과한다(동의어 다양성 보존).
- `'stack'`/`'Stack'`, `'2PL'`/`'2pl'`처럼 **대소문자·앞뒤 공백만 다른 진짜 중복**은 동일 키가 되어 WARN으로 잡힌다.

현재 데이터 기준 156 → 0. 사용자는 "완전 exact-string"(대소문자도 구분)보다 이 기준을 택했다 — 미래의 대소문자-only 중복까지 안전망으로 잡기 위함.

### D2. lint 스크립트 단위 테스트 미추가 (Oracle 판단)

`check-quiz-content.mjs`에 jest 단위 테스트는 추가하지 않는다. jest `roots`가 `src/`만 포함하고 transform이 `.tsx?`만 처리하므로 `scripts/*.mjs`는 jest 대상 밖이다. Sprint 216(lint 신설)·218(규칙 8·9 추가) 모두 `node ... --strict` 실행 검증만 한 기존 관행을 유지한다. CI(`ci.yml:427`)가 `--strict`로 게이트하고, 본 스프린트에서 `node -e`로 `caseFoldKey`·`checkCaseFoldedDuplicates`의 실제 동작(대소문자 중복 WARN / 공백 차이 통과)을 직접 검증했다.

## 구현

브랜치 `chore/sprint-219-quiz-lint-cleanup`, start commit `1813a5f`, 4 atomic commit. Wave A(Curator lint/콘텐츠) → Wave B(Herald 테스트) → Wave C(Librarian ADR).

### 커밋

| 해시 | 내용 |
|------|------|
| `a087ba9` | chore(frontend) — Curator: `check-quiz-content.mjs` 규칙 8을 표기 중복으로 좁힘 — `caseFoldKey`(NFKC→소문자→trim) 비교 키로 교체, `checkNormalizedDuplicates`→`checkCaseFoldedDuplicates` 리네임, 헤더 주석·WARN 메시지 갱신. 156 WARN → 0 |
| `9cf0dc2` | fix(frontend) — Curator: db-22 `acceptedAnswers` `'2PL'`/`'2pl'` 대소문자 중복 제거(좁힌 규칙 8이 발견한 진짜 중복) |
| `2783db5` | test(frontend) — Herald: `page.test.tsx` Scenario 2 GET 캐시 단언 + `api-store.test.ts` getBest 캐시 히트 단언 |
| (ADR) | docs(adr) — Librarian: sprint-219 KR+EN + README 인덱스 156→157·범위 62~218→62~219 |

### Wave A — Curator (lint + 콘텐츠)

- **규칙 8 좁히기** (`a087ba9`): `caseFoldKey(raw)` 헬퍼 신설 — `raw.normalize('NFKC').toLowerCase().trim()`. 내부 공백·하이픈·구두점을 보존하므로 의도적 표기 변형은 서로 다른 키로 남는다. `checkNormalizedDuplicates`의 그룹핑 키를 `normalizeAnswerJs` → `caseFoldKey`로 교체하고, 의미가 "정규화 중복"에서 "대소문자·앞뒤 공백만 다른 중복"으로 바뀌므로 함수명을 `checkCaseFoldedDuplicates`로 리네임했다. 파일 헤더(규칙 8 정의·예시)·WARN 메시지·`checkWarnOnlyRules` 호출부·출력 라벨을 정합 갱신했다. **규칙 9(`checkEmptyNormalized`)·`normalizeAnswerJs`는 그대로 유지** — 규칙 9는 여전히 `normalizeAnswerJs`(공백·구두점 제거)로 "정규화 후 빈 문자열"을 검사하므로 `normalizeAnswerJs`는 export·존속한다. 156 WARN → **0**.
- **db-22 진짜 중복 정리** (`9cf0dc2`): 좁힌 규칙 8이 `['2PL','2pl']`(db-22) 단 1건을 진짜 중복으로 잡아냈다 — 대소문자만 차이라 `normalizeAnswer` 소문자화로 동일하게 채점된다. 표준 약어 표기 `'2PL'`을 유지하고 `'2pl'`을 제거했다. 좁힌 규칙이 노이즈를 제거하면서 동시에 **실제 정리 대상 1건을 정확히 발견**한 사례.

### Wave B — Herald (apiStore 캐시 단언)

- **`page.test.tsx` Scenario 2 GET 캐시 단언** (`2783db5`): `finish()` 흐름은 `store.getBest()`(GET 1회 + 메모리 캐시) → `store.saveResult()`(POST + 캐시 무효화)다. 기존 POST 단언을 호출 순서 nth 단언으로 보강 — 1번째 = 옵션 없는 GET(`getBest`→`fetchAllBest`), 2번째 = POST(`saveResult`). GET 결과가 캐시되어 결과 화면 렌더 중 재-GET 없이 정확히 2회만 호출됨을 `toHaveBeenCalledTimes(2)`로 고정했다. (Scenario 2는 localStorage가 비어 merge-up `fetchApi` 호출 0회 — `finish()`의 GET+POST만 발생.)
- **`api-store.test.ts` getBest 캐시 히트** (`2783db5`): 기존엔 `getAllBest` 캐시 히트만 커버했다. 서로 다른 키로 `getBest`를 2회 호출해도 캐시된 맵에서 조회해 `fetchApi`가 1회만 발생함을 직접 단언했다.

### Wave C — Librarian (ADR)

- sprint-219 KR+EN + `docs/adr/README.md` 인덱스 156→157·범위 62~218→62~219 갱신.

## 검증

Oracle 직접 확인 (frontend):

- `tsc --noEmit` → **0 errors**
- `check-quiz-content.mjs --strict` → **exit 0**(규칙 1~7 통과, **규칙 8·9 0건** — 156 WARN 제거 + db-22 정리)
- `node -e` 직접 검증 — `caseFoldKey`: `stack`/`Stack` 동일 키(✓), `연결리스트`/`연결 리스트` 다른 키(✓), `btree`/`b-tree`/`b tree` 모두 다른 키(✓), 앞뒤 공백 폴딩(✓). `checkCaseFoldedDuplicates`: 대소문자 중복 WARN 1건, 공백 차이 0건(✓).
- `jest --coverage` → **147 suites · 1498 tests PASS / 0 fail**(218의 1497 + getBest 캐시 1), 글로벌 lines **87.6%**(게이트 83) · branches **78.96%**(게이트 71)
- `next build` → ✓ Compiled, `ƒ /[locale]/quiz` **37.5kB**(218 동일 — 스크립트·테스트 전용이라 번들 무변경)
- `next lint` → **0 errors**(기존 `sidebar`·`sonner`·`useAutoSave` warning만, 퀴즈 무관)

## 교훈

1. **WARN-only lint 규칙은 의도적 표기 다양성을 차단하지 않으면서 진짜 위험만 가시화해야 한다** — 규칙 8이 채점용 정규화(`normalizeAnswer`, 공백·구두점 제거)를 중복 판정에 그대로 쓰면, 가독성 목적의 의도적 동의어 쌍을 노이즈로 신고한다. 검사 목적에 맞는 별도 비교 키(`caseFoldKey`, 표기 보존)를 분리해, 의도적 변형은 통과시키고 대소문자-only 같은 진짜 중복만 잡도록 좁혔다. **채점 정규화와 중복 판정 정규화는 목적이 다르므로 분리한다.**
2. **좁힌 규칙이 곧바로 진짜 중복 1건을 발견했다** — 156 노이즈를 제거하자 가려져 있던 db-22 `'2PL'`/`'2pl'` 대소문자 중복이 드러났다. 노이즈가 신호를 덮고 있었다는 방증 — 규칙을 정밀화하면 거짓 양성이 줄어드는 동시에 참 양성의 가시성이 올라간다.
3. **테스트 인프라 경계를 존중해 스코프를 키우지 않는다**(D2) — `scripts/*.mjs`는 jest `roots`(src/) 밖이라 단위 테스트 추가는 jest 설정 변경을 동반한다. 216/218 관행대로 `node` 실행 + `node -e` 직접 검증으로 마무리해, 작은 정리 스프린트가 인프라 작업으로 번지지 않게 했다.

## Sprint 220+ 이월

- **운영측 `identity_db` `migration:run`(SP217 `quiz_records`) + 서버 재배포 + 라이브 `/quiz` E2E 검증** (사용자/운영, 중요): merge ≠ 라이브. `20260602000000-SP217-CreateQuizRecords`를 운영 `identity_db`에 적용하고 재배포 후, 로그인 상태 `/quiz` 플레이 → 기기 간 best 동기화·난이도별 기록·merge-up 동작 확인. Sprint 218 회귀 안전망 + 219 lint 정리로 코드측은 검증됐으나 라이브는 미검증.
- **GA4 데이터 스트림 URL 정합 + Enhanced Measurement history page_view OFF + 프로덕션 page_view UAT** (사용자, Sprint 210/211/212 이월 지속)
- **운영 Sprint 196 `problem_db` 마이그레이션 실행** (사용자/운영)
- **하네스 `--full` CI 정기 실행 자동화 검토** (Sprint 209 이월 지속)

## Critic 교차 리뷰

**R1 — CLEAN** (Codex gpt-5.5, `codex review --base 1813a5f -c model=gpt-5.5`, codex-cli 0.130.0, session `019e8c2b-1feb-7cd0-ad56-c32cec2494ae`)

- Critical / High / Medium / Low **0건**.
- "The changes are limited to the quiz content warning logic, one redundant accepted answer removal that remains covered by normalization, and test assertions. I did not identify any introduced correctness, security, performance, or maintainability issue that warrants an actionable finding."

**최종 — CLEAN**. 단일 라운드, actionable finding 0건.
