---
sprint: 180
title: "Programmers 검색 결과 category 자동 전파"
date: "2026-05-21"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-178", "sprint-151"]
related_memory: ["sprint-window"]
---
# Sprint 180 — Programmers 검색 결과 category 자동 전파

## 목표

- Sprint 178이 problem에 category(ALGORITHM/SQL) 입력 UI를 백엔드 entity~프론트 타입·DB 마이그레이션까지 깔았으나, **Programmers 검색 결과의 category를 폼에 자동 전파하는 마지막 단계가 누락**되어 있었다. 그 결과 사용자가 SQL 문제를 검색해도 폼은 항상 category를 채우지 못한 채 ALGORITHM 기본값으로 저장하는 "절반 구현" 갭이 남아 있었다(SQL 문제 등록 사실상 불가).
- 후보 3개(coverage-gate skipped 허용 제거 / `(adr)` layout 분할 / Programmers category 자동추론)를 착수 탐색한 결과, 앞 둘은 각각 "실제 skipped 테스트 0건이라 갭 아님"·"분할 필요성 모호"로 기각되고 **category 자동추론만 명확한 갭**으로 확인됐다 — 백엔드는 이미 검색 응답에 category를 반환하지만 프론트 단건 fetch 타입 `ProgrammersProblemInfo`에만 category 필드가 빠져 있어 전파 사슬이 끊겨 있었다.

## 결정

### D1. category를 difficulty 자동추론 패턴으로 미러링

기존에 difficulty가 검색 훅을 통해 자동 채워지던 것과 동일한 방식으로, 양쪽 검색 훅이 category를 채우도록 한다. `useProgrammersSearch`는 검색 결과의 category를, `useBojSearch`는 항상 ALGORITHM을 채운다(solved.ac/BOJ에는 SQL 개념이 없음). 데이터 흐름의 양끝(검색 응답 → 폼 상태 → DTO)을 연결해 "절반 구현" 사슬을 완성한다.

### D2. `ProblemFormState.category`는 느슨한 `string` + 브리지 캐스팅 + 공유 헬퍼 SSOT

`ProblemFormState.category`는 difficulty/sourcePlatform 컨벤션과 일치시켜 느슨한 `string`으로 둔다. create 폼은 RHF(react-hook-form)가 진짜 폼 상태이고, 검색 훅(`ProblemFormState`)과 RHF 사이를 `setFormAndSync` 프록시가 연결한다. 그런데 RHF의 `category`는 `z.enum(['ALGORITHM','SQL'])` 엄격 타입이라, 브리지에서 단 1곳 `as ProblemCategory` 캐스팅이 필요하다. SQL 판정 로직은 **category 또는 'SQL' 태그를 함께 보는 dual-check** 공유 헬퍼 `isProgrammersSqlProblem`로 추출해 `AddProblemModal`의 기존 로컬 `isSqlProblem`과 SSOT를 통일했다(legacy 항목이 category='algorithm'으로 defaulted되어 있어도 태그로 SQL을 식별할 수 있도록).

### D3. category select disable → 편집 가능한 스마트 기본값으로 번복 (Critic 근거)

초기 구현은 difficulty 미러링을 그대로 따라, 검색 적용 시 category select를 disable했다. 그러나 Critic R2가 **RHF는 disabled registered 필드를 undefined로 제출 → required `z.enum` 검증 실패 → create 폼이 제출 자체가 안 되는(silent fail) 버그**를 적발했다. difficulty는 `.optional()`이라 disabled→undefined가 안전했지만, category는 required라 그대로 미러링하면 안 됐던 것이다. → category를 disable 대신 **편집 가능한 스마트 기본값**으로 전환했다(검색이 채우되 사용자가 교정 가능 — Sprint 178의 "수동 선택" 의도와도 합치). 동시에, 프록시 동기화의 `next.category !== prev.category` 가드가 검색 전 수동 SQL 선택을 비-SQL 검색 적용 후에도 잔존시키는 stale 버그(P2)를 유발하므로, category만 **무조건 setValue**로 동기화하도록 변경했다.

## 구현

### PR #313 — Programmers 검색 결과 category 자동 전파 (15파일 +280/-21, 3 commits)

- `7fb7aac` feat — category 전파 기본 구조(타입·훅·폼·테스트).
- `f6b66ca` fix (Critic R1 P2) — SQL 태그 dual-check 공유 헬퍼 `isProgrammersSqlProblem` 추출 + 위임.
- `b49db22` fix (Critic R2 P1+P2) — category select disable 제거 + 검색 적용 시 무조건 동기화.

핵심 파일:
- `lib/api/external.ts`: `ProgrammersProblemInfo`에 category 필드 추가 + `isProgrammersSqlProblem` 공유 헬퍼.
- `lib/api/index.ts`: barrel 재노출.
- `lib/problem-form-utils.ts`: `ProblemFormState`에 category(`string`) 추가.
- `hooks/useProgrammersSearch.ts`·`hooks/useBojSearch.ts`: category 채움(Programmers=결과 category, BOJ=항상 ALGORITHM, reset도 ALGORITHM).
- `app/[locale]/problems/create/page.tsx`·`app/[locale]/problems/[id]/edit/page.tsx`: 프록시·sync·reset·createAnother에 category 전파, disable 제거 + 무조건 동기화.
- `components/ui/AddProblemModal.tsx`: 로컬 `isSqlProblem`을 공유 헬퍼로 위임(DRY 단일 출처).

## Critic 사이클

`codex review --base main` 3라운드.

- **R1** (session `019e4679-3e43-74d3-91b2-8e1858fea23b`): **P2** — `useProgrammersSearch`가 category만 검사해 legacy SQL 문제(category='algorithm'으로 defaulted됐으나 태그에 'SQL' 보유)를 오분류 + disabled select라 사용자가 교정 불가. → category 또는 'SQL' 태그 dual-check 공유 헬퍼로 해소.
- **R2**: **P1** — category select disable이 RHF required enum을 undefined로 만들어 create 제출을 차단(silent fail) + **P2** — `setFormAndSync` 프록시가 stale category 값을 잔존시킴. → disable 제거 + category 무조건 동기화로 해소. (이 과정에서 zodResolver mock이 RHF 계약 `{values, errors}`를 위반하고 있어 **테스트가 제출 경로를 실제로 통과한 적이 없었음**도 드러나, mock을 교정했다.)
- **R3**: **0건** 통과 — 머지 가능.

## 검증

### 로컬
- `tsc --noEmit` 0 errors.
- `next lint` 0 errors / 0 warnings.
- jest 132 suites · 1368 tests 전부 통과(1361→1368).
- 커버리지: Lines 86.9%(≥83), Branches 78.23%(≥71), JEST_EXIT=0.

### CI
- PR #313 39 checks green.

## 결과

- **머지**: origin/main `4867592` → `15fd56f` (PR #313 squash merge, 작업 브랜치 삭제).
- **순변경**: 15파일 +280/-21, 3 commits.

## 신규 패턴

- **"절반 구현" 기능 갭 (Sprint 178 계승 실증)**: 백엔드·타입·DB가 모두 갖춰져도 프론트 전파 한 줄이 누락되면 기능이 silent 무력화된다(전부 기본값 저장). API 타입에 필드가 존재하는 것 ≠ 실제 전파이므로, 데이터 흐름의 양끝(폼 → DTO → service)을 추적해야 한다.
- **미러링의 함정 — 검증 스키마 제약 차이**: 한 필드의 UI 패턴(difficulty의 "검색 적용 시 disable")을 다른 필드(category)에 그대로 복제하면 안 된다. difficulty는 `z.optional`, category는 required `z.enum`이라 "disabled registered → undefined"라는 RHF 동작이 한쪽만 안전했다. UI 패턴을 복제하기 전에 두 필드의 검증 스키마 제약이 동일한지 확인해야 한다.
- **공유 헬퍼 SSOT**: 동일 판정 로직(SQL 분류)이 2곳 이상 생기면 추출해 단일 출처화한다. legacy 데이터 default로 인한 오분류를 한 곳에서 막을 수 있다.

## 교훈

- **교차 리뷰의 가치 실증**: Critic(Codex 교차 검증)이 동일 모델 가족이 놓친 **프레임워크 계약 위반**(RHF disabled→undefined가 required enum과 충돌)을 적발했다. 게다가 "테스트가 핵심 제출 경로를 실제로 통과한 적이 없었다"(mock이 RHF 계약 위반)는 사실까지 드러나, 회귀 테스트가 골든 패스를 실제로 커버하는지 의심해야 함을 재확인했다.
- **FN 양방향 적발**: R1(태그 fallback 누락)·R2(disable 제출 차단 + 프록시 stale) 모두 실제 사용자 영향이 있는 false-negative 버그였다 — 검색해도 category가 안 채워지거나, 채워져도 제출이 막히거나, 이전 선택이 잘못 잔존하는 경로.

## 이월 항목 (Sprint 181+)

- **UAT 사용자 직접**: create/edit에서 Programmers SQL 문제 검색 시 category가 자동으로 SQL로 반영되는지 / edit prefill / `/en` 라벨 확인 + Sprint 178~179 누적 UAT 계승.
- 후속: coverage-gate skipped 허용 제거(실제 skipped 0건이라 보류 가능), `(adr)` layout 분할, 기존 SQL 문제 데이터 백필(category 미설정 레거시).
- 참고: 본 스프린트로 **검색 기반 category 자동추론은 해소**됐다 — URL 직접 입력 경로는 create에 없으므로 N/A.
