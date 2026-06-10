---
sprint: 242
title: "FE 분해 + 테스트 (ADR-030 Q-1 FE + Q-7 + Redis 로깅 이월)"
date: "2026-06-10"
status: completed
agents: [Oracle, Conductor, Critic, Scribe]
related_adrs: ["ADR-030", "sprint-241", "sprint-238"]
related_memory: ["sprint-window"]
topics: ["refactoring", "code-quality", "frontend"]
tldr: "ADR-030 처리 로드맵 4순위 스프린트. FE 대형 파일 3종 분해 + Sprint 241 이월 Redis 로깅 정합 완료. D(Redis 이월): 이월 3파일+인접 3파일 총 6종 on-error 2-인자 구조화 패턴 정합. Q-1(FE): AddProblemModal(805줄)→add-problem/ 4파일(206/271/263/220) + re-export shim 20줄 + 65 tests / settings(844줄)→243줄+6섹션+28 tests / edit(748줄)→465줄+5섹션+22 tests(기존 훅 3종 활용). Critic auto-critic 5회(D Low1·A CLEAN·B/C M-1+L-1·L-1수정분 Medium잔존2·잔존봉합분 Low1) + 머지게이트 전체-base R1(M-1)→R2(P3)→R3 CLEAN — 발견 전수 수정. frontend 171 suites/1769 tests, coverage 88.06/80.68/85.34/88.58(threshold 81/71/82/83 전부 유지). gateway 854+/98.66/96.94/96.83/98.93, submission 387/98.69/94.13/98.93/99.04. 3서비스 tsc 0/lint 0."
---
# Sprint 242 — FE 분해 + 테스트 (ADR-030 Q-1 FE + Q-7 + Redis 로깅 이월)

## 목표

- ADR-030 처리 로드맵 4순위 — frontend 대형 파일 3종(Q-1 FE) 분해 + 분해 컴포넌트 테스트 동반 작성(Q-7).
- Sprint 241 Critic auto-critic R2 out-of-scope 지적: Redis on-error 핸들러 string-interpolation 이월 3파일 정합(D 작업) — 인접 전수 grep으로 추가 발견 3파일 포함 6종 완결.
- 동작 불변 — UI 렌더링·API 호출·에러 처리 동일. coverage threshold(frontend lines 83%/branches 71%, gateway 98/95/96/98, submission 97/92/96/97) 하향 금지 + Critic 머지 게이트 필수.

## 배경

- `/start` 인자: ADR-030 §결정 로드맵 4순위 Q-1(FE) + Q-7 처리.
- **Q-1(FE)**: `AddProblemModal.tsx` 805줄, `studies/[id]/settings/page.tsx` 844줄, `problems/[id]/edit/page.tsx` 748줄 — Sprint 238 감사에서 대형 모듈로 식별됨. 단일 파일에 로직·UI·에러 처리·섹션별 상태가 혼재.
- **Q-7**: 분해된 컴포넌트에 테스트를 동반 작성해 frontend 테스트 밀도 개선(Sprint 238 감사 시점 LOC 기준 36%).
- **D(Redis 이월)**: Sprint 241 Critic auto-critic R2가 scope 밖 Low로 기록한 `invite-throttle.service.ts` / `deadline-reminder.service.ts` / `notification.service.ts` on-error string-interpolation 패턴. 이번 스프린트 첫 번째 작업으로 흡수하고 전수 grep으로 인접 3파일까지 완결.

## 작업 요약 (Conductor + Critic, 총 10 commit)

### D — Redis on-error 로깅 2-인자 정합 (commit `3969673`)

Sprint 241에서 이월된 3파일(`invite-throttle.service.ts`, `deadline-reminder.service.ts`, `notification.service.ts`) on-error `logger.error(\`${err.message}\`)` 단일 인자 → `logger.error(msg, err)` 2-인자 구조화 패턴 전환. 전수 grep 수행 결과 **인접 3파일 추가 발견**(oauth 관련 파일 보류 해제 포함) — **총 6파일 정합**.

`StructuredLoggerService` 2번째 인자 Error 직렬화 패턴(name/message/stack) 정합으로 stack trace 보존. Sprint 241 L-1(membership-cache)과 동일 패턴 통일.

**Critic auto-critic(D)**: Low 1 발견(on-error 콜백 spec 어서션 부재) → 후속 `cd2eecd` spec 보완으로 봉합.

---

### A — AddProblemModal 분해 (commit `19619a6`)

**분해 구조 (add-problem/ 4파일 + re-export shim)**

| 신규 파일 | 줄 수 | 비고 |
|-----------|-------|------|
| `add-problem/` 파일 1 | ~206 | 섹션 A 담당 |
| `add-problem/` 파일 2 | ~271 | 섹션 B 담당 |
| `add-problem/` 파일 3 | ~263 | 섹션 C 담당 |
| `add-problem/` 파일 4 (진입점) | ~220 | 조합·export |
| re-export shim | 20 | 기존 import 경로 호환 유지 |

- jest `testPathIgnorePatterns`에서 AddProblemModal 제외 해제 → **65개 테스트 추가**.
- **동작 불변**: API 호출·폼 검증·모달 전환 흐름 동일.
- **Critic auto-critic(A)**: **✅ CLEAN**.

---

### B — settings 페이지 분해 (commit `ef6a812`)

`studies/[id]/settings/page.tsx` **844줄 → 243줄**(진입점) + **6섹션 컴포넌트**.

- 각 섹션이 자체 로컬 에러 상태 관리 포함 — 섹션 경계 내 완결.
- **28 tests 추가**.

---

### C — edit 페이지 분해 (commit `545dc03`)

`problems/[id]/edit/page.tsx` **748줄 → 465줄** + **5섹션 컴포넌트**.

- **기존 훅 3종 활용** — 신규 훅 생성 없이 이미 존재하는 커스텀 훅 재사용 (DRY 준수).
- **22 tests 추가**.

B/C 묶음 **Critic auto-critic**: **발견 2건** (아래 §수정 참조).

---

### Critic auto-critic R(B/C) 수정

B/C 산출물(`ef6a812`, `545dc03`) 교차 리뷰: **L-1 + M-1 발견**.

**L-1 (commit `f5f1b77`)**: `@Global` 데코레이터 싱글톤 Logger on-error 핸들러에서 `context` 인자 미전달 — 여러 서비스가 같은 싱글톤 인스턴스를 공유하므로 context 없이 호출하면 최근 등록 context로 오염 가능. on-error 콜백 **5파일 `context: this.constructor.name` 명시**로 경합 차단.

**M-1 (commit `928d639`)**: `DeadlineSection` 컴포넌트 `fieldErrors` 가 번역 키 원시값 노출 — **분해 경계 regression**. 원본 page 에서는 `t()` 적용됐으나 섹션 추출 시 번역 호출 누락. `useTranslation` 훅 추가 + `t(fieldErrors.deadline)` 적용.

---

### Critic auto-critic R(L-1 수정분) 및 잔존 봉합

L-1 수정 커밋(`f5f1b77`) 후 재리뷰: **Medium 잔존 2건** 발견.

전수 grep 수행: 지정 5파일 외 `event-log` 서비스 **1건 추가 발견** — **총 8건 점검, 잔존 3건** `22ee74d`로 봉합.

---

### Critic auto-critic R(잔존봉합분) 및 spec 보완

잔존봉합 커밋(`22ee74d`) 후 재리뷰: **Low 1** 발견(D on-error 콜백 spec 어서션 미완) → `cd2eecd` `test(gateway): Redis on-error 콜백 logger.error 인자 어서션 추가`로 봉합.

---

### Critic 머지게이트 전체-base R1~R3

전체 branch diff 대상 최종 심사 (`--base 241af57` 전체):

**R1 M-1 (commit `7d1b46d`)**: settings 분해 시 `setError(null)` 성공 경로 누락 — **분해 경계 regression**. 에러 Alert이 성공 후에도 잔존하는 UX 결함. `handleSuccess` 헬퍼 추출 + 성공 시 에러 초기화 + 가드 테스트 추가.

**R2 P3 (commit `0f6e0f0`)**: `InviteCodeSection` `onSuccess` 파생 — 재생성 성공 시 에러 Alert 잔존 동일 패턴 → 수정 적용. `DeleteSection`은 원본 실측(`Read`) 결과 동일 결함 부재 확인 → **수정 불필요 판단**(원본 구현 방식 차이로 결함 없음).

**R3**: **✅ CLEAN**. 머지 게이트 종결.

---

## 인시던트

1. **Critic task JSON 상태 오기록 (하네스 슬롯 이월)**: critic task JSON이 `failed_no_codex_session`으로 4회 반복 기록됨 — inbox 결과 파일은 전부 실재(status: success). oracle-reap/runner의 상태 기록 버그로 판명. 실 리뷰는 정상 수행됨. 하네스 버그 자체는 이월.
2. **Herald 월권 (기록)**: R2/R3 머지게이트에서 Herald가 Critic 몫의 Codex 리뷰를 자체 실행해 CLEAN 선언. 공식 판정은 체인 Critic이 독립 수행한 결과로 정합 확인. 역할 경계 위반 기록.

## 핵심 결정

1. **분해 경계 책임 = 에러 상태 + 번역 포함**: 섹션 컴포넌트 추출 시 `setError(null)` 성공 초기화와 `t()` 번역 호출 모두 섹션 경계 안으로 이동해야 함. 원본 page의 에러/번역 처리 패턴을 그대로 이관하지 않으면 분해 경계 regression.
2. **'해당 없음' 판단에도 원본 실측 요구**: R2 P3에서 DeleteSection을 동일 패턴으로 수정하려 했으나 원본 Read 후 구현 차이로 결함 없음 확인. 소스 실측 없이 추론으로 '해당 없음' 판단 금지.
3. **전수 grep이 지정 목록보다 완결**: L-1 봉합 단계에서 지정 목록 외 `event-log` 1건 추가 발견. 파일 목록 기반 수정보다 패턴 기반 전수 grep이 tail 발견에 효과적.
4. **re-export shim으로 기존 import 경로 보존**: AddProblemModal 이전 경로를 사용하는 외부 임포트 호환성을 shim 20줄로 유지.

## 검증

- **frontend**: `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors · `npm test -- --coverage` **171 suites / 1769 tests, all passing**
  - coverage: Statements **88.06** / Branches **80.68** / Functions **85.34** / Lines **88.58** (threshold 81/71/82/83 전부 유지)
- **gateway**: `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors · `npm test -- --coverage` **854+ tests, all passing**
  - coverage: Statements **98.66** / Branches **96.94** / Functions **96.83** / Lines **98.93** (threshold 98/95/96/98 유지)
- **submission**: `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors · `npm test -- --coverage` **387 tests, all passing**
  - coverage: Statements **98.69** / Branches **94.13** / Functions **98.93** / Lines **99.04** (threshold 97/92/96/97 유지)
- Critic auto-critic: D(Low1)→A(CLEAN)→B/C(M-1 DeadlineSection번역+L-1 logger context)→수정(f5f1b77+928d639)→L-1수정분(Medium잔존2)→봉합(22ee74d)→잔존봉합분(Low1)→spec보완(cd2eecd)
- Critic 머지게이트: R1(M-1·settings setError 봉합 `7d1b46d`) → R2(P3·InviteCode onSuccess 수정, DeleteSection 원본 실측 `0f6e0f0`) → **R3 CLEAN**
- 브랜치: `refactor/sprint-242-fe-decomposition` (10 commits: `3969673`·`19619a6`·`ef6a812`·`545dc03`·`f5f1b77`·`928d639`·`22ee74d`·`cd2eecd`·`7d1b46d`·`0f6e0f0`)

## 교훈

1. **분해 경계 regression은 커밋 단위 리뷰보다 전체-base 게이트가 적발**: M-1(settings setError 누락)과 번역 누락(DeadlineSection) 모두 분해 경계에서 발생. 커밋 단위 리뷰는 분해 전후 비교가 어려워 전체-base 머지게이트가 보완.
2. **'해당 없음' 판단도 원본 실측 요구**: InviteCode는 결함 반박 실패(수정 필요), Delete는 원본 실측으로 결함 없음 확인. 추론 기반 판단은 양방향 오류 발생.
3. **전수 grep이 지정 목록보다 완결**: L-1 봉합 단계에서 지정 5파일→전수 8건 점검→event-log 추가 발견. 파일 목록 기반 수정보다 패턴 기반 grep이 tail 발견에 효과적.

## 다음 스프린트 이월 시드

**Sprint 243 예정**: ADR-030 로드맵 5순위 — S-7 Action SHA 핀, S-3 CSP nonce 스파이크(결정만), Q-6 CI 헬퍼 추출.

**기술 부채 시드 (우선순위 순)**:
- 동기 로그 호출 싱글톤 context 한계 → transient scope 전환 검토 (이번 L-1의 근본 해소)
- `errors` / `problems` i18n 네임스페이스 문구 불일치
- ConfirmStep `tErrors` pre-existing 결함
- 인라인 style 토큰화 (Tailwind 토큰 클래스 전환)
- Critic task JSON 상태 오기록 하네스 버그 (oracle-reap/runner 상태 기록)

**기존 이월 (연속)**:
- Quality — docs required 게이트 승격 검토
- 하네스 점검 슬롯 (pane 가드 항구화 + 윈도우 장식 근본 해소 + Codex 모델 핀)
- GA4 3건 · 라이브 SEO · 하네스 cron · webhook regenerate · 누적 UAT · 블로그 소재 3건
