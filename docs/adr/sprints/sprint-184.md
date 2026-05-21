---
sprint: 184
title: "ADR implementation H2 partial matcher + PR 표 헤더 오인 차단"
date: "2026-05-21"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-183", "sprint-163"]
related_memory: ["sprint-window"]
---
# Sprint 184 — ADR implementation H2 partial matcher + PR 표 헤더 오인 차단

## 목표

- blog ADR detail-view는 implementation 섹션의 PR 표를 PhaseStrip 카드로 시각화한다(Sprint 163). 그런데 `resolveCanonical`이 implementation을 **exact alias 매칭**으로만 처리해, `## 구현 (8 PR squash merge, ...)` / `## Implementation (single PR, ...)` 처럼 괄호·접미사가 붙은 헤딩이 `'other'`로 분류되어 sprint-153~165(KR + EN)의 PR 표가 Phase 카드로 렌더되지 않던 갭을 회수한다(Sprint 163 이월 후속).
- 착수 후 브라우저 검증에서 더 깊은 **pre-existing 취약점**을 발견: `parsePrTable`의 헤더 탐지가 "PR" 문자열을 가진 **데이터 행**까지 헤더로 오인 → partial matcher 적용 시 sprint-163이 garbage Phase 카드를 렌더. 이를 함께 차단한다.

## 결정

### D1. resolveCanonical에 implementation tolerant 정규식 fallback 추가

`resolveCanonical`(section-aliases.ts)은 numbered prefix 제거 후 exact alias lookup → carryover/lessons만 tolerant 정규식(`CARRYOVER_RE`/`LESSONS_RE`) fallback을 가졌고 **implementation은 tolerant matcher가 없었다**. 따라서 `구현` exact는 매칭되나 `구현 (8 PR ...)`는 'other'로 떨어졌다.

`IMPLEMENTATION_RE = /^(?:구현|implementation|execution)(?:\s|$|\()/i`를 추가하고 carryover/lessons 다음 fallback으로 배치했다.

- 키워드 직후가 **공백/끝/`(`** 일 때만 매치 → `구현체`(비공백 후속)는 미매칭(보수적).
- FP 전수 측정: 전 corpus(KR sprints + EN sprints + permanent ADR)에서 old→new canonical 변화 **66건 전부 `other → implementation`** — 기존 올바른 분류(carryover/lessons/verification 등)를 빼앗는 변화 0건.
- Phase 카드 생성은 PR 표 + Phase 컬럼을 요구하는 다운스트림 가드(`extractPhaseEntries`)가 별도로 막으므로, PR 표 없는 섹션(`구현 작업`, `구현 예정 위치` 등)이 implementation으로 분류돼도 bogus 카드는 생성되지 않는다.

### D2. parsePrTable/stripPrTableLines 헤더 탐지를 "구분자 직전 라인"으로 한정

`parsePrTable`(parser.ts)의 헤더 탐지가 `lines.findIndex(l => /\|/ && /pr/i)`로 **임의의 "PR" 포함 라인**을 헤더로 잡았다. sprint-163의 implementation 표는 헤더가 `| Phase | 담당 | 변경 | 라인 |`(PR 컬럼 없음)인데, 데이터 행 `| A — PR 표 strip 기반 | ... |`의 "PR" 문자열이 헤더로 오인 → A를 헤더·B를 구분자로 먹고 C~R9를 garbage 카드로 추출, 표도 strip되지 않았다.

GFM 표의 헤더는 **항상 구분자(`|---|`) 직전 라인**이라는 불변식을 이용해, 헤더 탐지에 "다음 라인이 구분자" 조건을 추가했다(`isTableSeparatorRow` 헬퍼). 이로써 데이터 행 오인이 구조적으로 불가능해진다. 동일 취약점을 가진 `stripPrTableLines`도 같은 규칙으로 정렬(별도 구분자 검증 분기 제거, 헬퍼 공유).

PR 컬럼이 없는 표(sprint-163)는 헤더 탐지가 실패해 `undefined` 반환 → graceful하게 raw 표로 prose에 유지(변경 전과 동일, 회귀 없음).

## 구현

### PR #321 (단일 작업 브랜치 `fix/sprint-184-impl-h2-partial-matcher`, 1 commit → squash, 소스 2파일 +36/-10)

- `5640326` fix — section-aliases.ts에 `IMPLEMENTATION_RE` + resolveCanonical fallback 1줄, parser.ts에 `isTableSeparatorRow` 헬퍼 + parsePrTable/stripPrTableLines 헤더 탐지 보강.

핵심 변경 (section-aliases.ts):
```ts
const IMPLEMENTATION_RE = /^(?:구현|implementation|execution)(?:\s|$|\()/i;
// resolveCanonical fallback:
if (IMPLEMENTATION_RE.test(stripped)) return 'implementation';
```

핵심 변경 (parser.ts):
```ts
const headerIdx = lines.findIndex(
  (l, i) =>
    /\|/.test(l) &&
    /pr|pull\s*request/i.test(l) &&
    i + 1 < lines.length &&
    isTableSeparatorRow(lines[i + 1]),
);
```

## Critic 사이클

`codex review --base main` 1라운드.

- **R1**: **0건** 통과 — "변경은 PR 표 탐지를 GFM 구분자 직후를 요구하도록 강화하고 implementation 헤딩 aliasing을 확장하되 명백한 회귀를 도입하지 않는다. diff에서 조치 가능한 정확성 이슈를 찾지 못함." 머지 가능.

## 검증

### 브라우저 end-to-end (blog 빌드 후 정적 서버 + 실제 DOM 확인)
- **sprint-157 (KR)**: `구현 Phase` PhaseStrip 카드 10개 렌더(P1~UX추가, PR 링크·담당·요약 포함) + implementation 섹션 원시 PR 표 strip(Mermaid `작업 흐름`만 잔존) ✓
- **sprint-157 (EN)**: `Implementation Phases` 카드 10개 + 표 strip ✓
- **sprint-163**: garbage 카드(A/B 누락·C~R9 오추출) 완전 제거 → `구현 Phase` 섹션 미생성, 원시 표 graceful 유지 ✓

### document 단위 시뮬레이션 (old vs new)
- KR sprints 11개(153/154/155/156/157/158/159/160/161/164/165) + EN sprints 11개 = **22 ADR이 Phase 카드 신규 획득(0→N)**.
- 전 corpus 회귀 0건(N→0/N→M 변화 없음), permanent ADR 무영향(PR 컬럼 없는 `구현 작업` 등은 graceful).

### 로컬
- `tsc --noEmit` 0 errors · `npm run build` 244 페이지.
- ADR/blog 게이트 7종 무회귀: adr-conversion(fixture 10/10) · doc-refs(329 files 0 broken) · en-coverage(131/131) · index-count(8/1/122) · i18n(max 2.19%<8%) · blog-crosscheck(0 위반) · adr-links(KR 1616 / EN 1614, 0 broken).

### CI
- 작업 PR #321 전체 checks green(Build Blog 포함 — blog 소스 변경 트리거), mergeStateStatus CLEAN. ADR PR은 `sprints/**` 트리거로 green.

## 결과

- **머지**: origin/main → `c38a54f` (PR #321 squash merge, 작업 브랜치 삭제).
- **순변경**: `blog/src/lib/adr/section-aliases.ts`(+16) + `blog/src/lib/adr/parser.ts`(+20/-10). 신규 파일 없음.
- ADR sprint-184(KR+EN) + README sprint ADR count 122→123·범위 62~184 (별도 ADR PR).

## 신규 패턴

- **계획이 브라우저 검증으로 scope 재정의됨**: "implementation H2 partial matcher" 단일 변경으로 시작했으나, 1차 빌드의 브라우저 DOM 검증에서 partial matcher가 sprint-163의 기존 `parsePrTable` 취약점(데이터 행 헤더 오인)을 노출시켜 garbage 카드를 만드는 것을 발견 → `parsePrTable` 보강을 scope에 추가. 정적 시뮬레이션("PR 컬럼 있는 표는 렌더되어야 함")이 가리킨 것과 실제 렌더(garbage 카드)가 달랐고, 실제 DOM이 판정자였다(Sprint 183 "브라우저가 결정자" 계승).
- **구조적 불변식으로 휴리스틱 오인 차단**: "임의의 PR 포함 라인 = 헤더" 휴리스틱은 데이터 행을 오인했다. GFM의 "헤더는 구분자 직전 라인" 불변식을 탐지 조건에 넣으면 오인이 "운"이 아니라 "발생 불가"가 된다(Sprint 183 "정확한 패턴으로 입력 한정" 계승).

## 교훈

- **휴리스틱 확대는 다운스트림 가드 위에서만 안전하다**: implementation을 넓게 분류해도 Phase 카드는 PR 표 + Phase 컬럼이 있어야 생성되므로, `구현 작업` 같은 PR 표 없는 섹션은 graceful하게 무시된다. 분류기를 넓힐 때는 "오분류가 가시적 결함으로 이어지는가"를 다운스트림 가드 유무로 판정한다 — 가드가 막아주면 넓혀도 안전.
- **partial matcher가 인접 취약점을 깨운다**: 한 모듈(분류기)을 넓히면 그 출력을 소비하는 모듈(parsePrTable)의 잠재 결함이 처음으로 활성화될 수 있다. sprint-163은 이전엔 'other'라 parsePrTable이 호출조차 안 됐으나, partial matcher 후 호출되며 헤더 오인이 드러났다. 변경의 영향은 변경한 함수가 아니라 그 출력의 소비처에서 나타날 수 있으므로, 양끝을 브라우저로 확인해야 한다.

## 이월 항목 (Sprint 185+)

- **선택**: H3-only PR 표 추출 — sprint-135/143/146처럼 PR 표가 H3 sub-section(`### PR 별 머지 commit` 등) 아래 있는 경우는 그 헤딩이 implementation으로 resolve되지 않아 본 sprint 범위에서 제외(별개·고위험 접근 필요). Sprint 163 이월 잔재로 유지.
- **선택**: `sprint-87-plan.md` relocate/제거(Sprint 183 발생, loader 제외됐으나 디렉토리 잔존).
- **UAT 사용자 직접**: Sprint 160~183 누적 UAT 계승(레거시 Programmers SQL 상세 에디터 자동 sql 선택, 프로그래머스 재제출 채점, 영문 환경 Grafana CB dashboard).
- 후속: coverage-gate skipped 허용 제거(실제 skipped 0건이라 보류 가능), `(adr)` layout 분할, prom-client Case B~D 점검 자동화, `.claude-tools/` Phase 2 실제 삭제.
