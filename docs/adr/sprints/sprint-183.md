---
sprint: 183
title: "ADR 상세 callout 렌더 복구 — H3 정규화 + plan 슬러그 충돌 차단"
date: "2026-05-21"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-182", "sprint-163", "sprint-162"]
related_memory: ["sprint-window"]
---
# Sprint 183 — ADR 상세 callout 렌더 복구 — H3 정규화 + plan 슬러그 충돌 차단

## 목표

- blog ADR detail-view는 carryover/lessons 섹션을 callout 박스(📋/💡)로 렌더한다(Sprint 163). 그런데 구 ADR 일부가 carryover/lessons 섹션을 표준 H2 대신 **H3**로 작성해 callout이 렌더되지 않는 갭을 회수한다.
- 착수 탐색 중 더 깊은 **pre-existing 버그**를 발견: `sprint-87-plan.md`가 ADR 로더에 잡혀 `sprint-87.md`와 슬러그 충돌 → `/adr/sprints/87/` 라우트가 plan 본문으로 오염. 사용자 승인하에 본 충돌까지 함께 차단한다.

## 결정

### D1. H3 carryover/lessons를 H2로 데이터 정규화 (파서 변경 대신)

`collectCanonicalSectionMarkdown`(parser.ts)이 canonical 섹션을 `s.canonical === canonical && s.level === 2`로만 찾는다. 따라서 carryover/lessons 헤딩이 H3이면 callout이 렌더되지 않는다.

해소 방식으로 **파서에 H3 인식을 추가하지 않고** 구 ADR 3개를 H2로 정규화했다. 근거: 착수 탐색에서 "H3에 이월/교훈 키워드"를 가진 9개 ADR 중 **진짜 H3-only carryover/lessons 섹션은 3개뿐**(sprint-86/87/139)이고, 나머지 6개는 **false-positive**(Decisions 하위 결정 제목 `### D1: ...이월`, 컨텍스트 하위 유입 이월 `### Sprint N 이월`, lessons 하위 서브항목)였다. 파서에 H3 인식을 넣으면 이 6개를 잘못된 callout으로 오추출하므로(높은 FP 위험), 데이터 정규화가 정확하고 안전하다(sprint-162 "코드 결함이 아닌 데이터 정합성 해소" 선례 계승).

- sprint-86/87: `### 이월 항목` / `### Carryover Items` → H2 (carryover)
- sprint-139: `### 교훈` / `### Lessons` → H2 (lessons)

### D2. sprint ADR 로더를 `sprint-NNN.md`로 정확히 한정 (plan 슬러그 충돌 차단)

`deriveSlug`(loader.ts)가 sprint kind에 대해 `sprint-(\d+)`로 슬러그를 추출하는데, 로더 스캔이 `*.md`를 모두 포함해 `sprint-87.md`와 `sprint-87-plan.md`가 **둘 다 슬러그 `'87'`로 충돌**했다. 알파벳 순으로 나중인 plan 파일이 `/adr/sprints/87/` 라우트를 덮어써 ADR 본문 대신 plan 본문이 서빙되고 있었다(carryover/lessons 섹션 자체가 누락).

loader 스캔 필터를 kind-aware로 변경: sprint ADR은 정확히 `/^sprint-\d+\.md$/`만 인정(`isAdrFile` 헬퍼). 이로써 plan/draft 등 비-ADR 파일이 ADR 라우트로 leak되는 것을 구조적으로 차단한다(미래 파일에도 적용).

## 구현

### PR #319 (단일 작업 브랜치 `fix/sprint-183-adr-h3-callout-and-plan-collision`, 1 commit → squash, 소스 7파일 +18/-7)

- `462b8fb` fix — `loader.ts`에 `isAdrFile(filename, kind)` 헬퍼 추가(스캔 필터를 `f.endsWith('.md') && f !== 'README.md'` → `isAdrFile(f, kind)`로 교체) + sprint-86/87/139 KR+EN 6개 헤딩 H3→H2 정규화.

핵심 변경 (loader.ts):
```ts
function isAdrFile(filename: string, kind: AdrKind): boolean {
  if (!filename.endsWith('.md') || filename === 'README.md') return false;
  if (kind === 'sprint') return /^sprint-\d+\.md$/.test(filename);
  return true;
}
```

## Critic 사이클

`codex review --base main` 1라운드.

- **R1** (session `019e485d`): **0건** 통과 — "loader 변경이 sprint ADR 탐색을 정규 숫자 sprint 파일로 좁히고, 문서 헤딩 조정이 파서의 H2 기반 섹션 추출과 정렬된다. 도입된 회귀나 조치 가능한 버그를 식별하지 못함." 머지 가능.

## 검증

### 브라우저 end-to-end (blog 빌드 후 정적 서버 + 실제 DOM 확인)
- **sprint-86**: 📋 carryover + 💡 lessons callout 둘 다 렌더 ✓
- **sprint-87**: 슬러그 충돌 해소로 진짜 ADR("블로그 카테고리 시스템 + Post 6 리프레이밍")을 서빙(plan 아님) + 📋 carryover + 💡 lessons 둘 다 렌더 ✓
- **sprint-139**: 📋 carryover 렌더 ✓ / `## 교훈`은 내용이 list가 아닌 prose라 callout 대상이 아니며(Sprint 163 R6 P2 "prose-only 유지" 설계) H2 prose 섹션으로 정상 표시 ✓
- `/adr/sprints/87-plan/` 라우트 미생성, `/87/`이 진짜 ADR 서빙 확인

### 로컬
- `tsc --noEmit` 0 errors (loader 변경).
- ADR/blog 게이트 6종 무회귀: adr-conversion(fixture 10/10) · doc-refs(327 files 0 broken) · en-coverage(130/130) · index-count(8/1/121) · i18n(max 2.19%<8%) · blog-crosscheck.

### CI
- 작업 PR #319 전체 38 checks green(Build Blog 포함 — blog 소스 변경 트리거). ADR PR은 `sprints/**` 트리거로 green.

## 결과

- **머지**: origin/main → `d6202bd` (PR #319 squash merge, 작업 브랜치 삭제).
- **순변경**: `blog/src/lib/adr/loader.ts`(+12/-1) + 구 ADR 6개 헤딩 H3→H2(각 +1/-1). 신규 파일 없음.
- ADR sprint-183(KR+EN) + README sprint ADR count 121→122·범위 62~183 (별도 ADR PR).

## 신규 패턴

- **계획이 탐색으로 무효화·재정의됨**: "H3 callout 미렌더"를 단순 파서 보강으로 보고 시작했으나, 탐색에서 (1) 진짜 갭은 3개뿐이고 6개는 FP라 파서 보강이 위험함 → 데이터 정규화로 전환, (2) sprint-87은 더 깊은 슬러그 충돌이 진짜 원인임을 브라우저 검증으로 발견 → scope 재정의(사용자 승인). 코드베이스의 실제 렌더 상태가 계획의 판정자다(Sprint 178 계승 실증).
- **식별자 추출은 정확한 파일 패턴으로 한정**: `sprint-(\d+)` 같은 느슨한 추출은 `sprint-NNN-plan.md` 같은 변종 파일을 동일 식별자로 충돌시킨다. 스캔 단계에서 정규 패턴(`^sprint-\d+\.md$`)으로 입력을 한정하면 충돌이 "처리 순서 운"이 아니라 "애초에 발생 불가"가 된다.

## 교훈

- **정적 grep만으로는 렌더 버그를 판정할 수 없다 — 브라우저 검증이 결정자**: 파서 로직 재현은 sprint-87 callout이 "렌더되어야 함"을 가리켰으나 실제 페이지는 plan 본문이었다. HTML grep은 RSC escape·class 다중성으로 신뢰 불가했고, 정적 빌드 산출물의 "stale"로 보이던 현상은 사실 슬러그 충돌이었다. `get_page_text`로 실제 DOM을 읽고서야 진짜 원인(plan 오염)이 드러났다. frontend 변경은 브라우저 end-to-end 검증이 필수.
- **데이터 정규화 vs 코드 보강의 판단 기준은 FP 위험**: 동일 증상(H3 미렌더)에 대해 파서 보강은 6개 FP를 만들고 데이터 정규화는 3개 진짜 케이스만 정확히 고친다. 휴리스틱(키워드 매칭)을 넓히기 전에 실제 매칭 분포를 측정해 진짜/거짓을 가르는 것이 우선이다.

## 이월 항목 (Sprint 184+)

- **선택**: `sprint-87-plan.md`는 loader에서 제외되었으나 여전히 `docs/adr/sprints/`에 남은 비-ADR 파일 — 적절한 위치(예: `docs/planning/`)로 relocate 또는 제거 검토(별건, 데이터 정리).
- **UAT 사용자 직접**: Sprint 160~182 누적 UAT 계승(레거시 Programmers SQL 상세 에디터 자동 sql 선택, 프로그래머스 재제출 채점, 영문 환경 Grafana CB dashboard).
- 후속: coverage-gate skipped 허용 제거(실제 skipped 0건이라 보류 가능), `(adr)` layout 분할, prom-client Case B~D 점검 자동화, `.claude-tools/` Phase 2 실제 삭제, Sprint 163 추가(H3-only PR 표 추출 + implementation H2 partial matcher).
