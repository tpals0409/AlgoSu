---
sprint: 163
title: "ADR 상세 페이지 Phase D — PR 표 분리 + 교훈/이월 callout"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic]
related_adrs: ["sprint-162", "sprint-161"]
related_memory: ["sprint-window"]
---
# Sprint 163 — ADR 상세 페이지 Phase D: PR 표 분리 + 교훈/이월 callout

## 목표

- Sprint 161에서 분할 이월된 Phase D 범위 실행 — ADR detail의 PR 표를 본문 prose에서 분리하여 PhaseStrip 카드와 중복 차단
- 교훈/이월 섹션을 callout 박스(💡 / 📋)로 시각 강조 — H2 단순 헤딩에 그쳤던 핵심 정보의 가시성 향상
- Sprint 162 Critic R1 P3 이월 해소: 기존 ADR에 Mermaid 다이어그램 확대 적용 (sprint-157 P1~P10 + hotfix 사이클 시각화)

## 결정

- **sections 단위 chunk 렌더 + callout in-place 삽입**: 본문 markdown을 sections 순회하며 prose 누적 → lessons/carryover H2 만나면 flush + callout wrapper를 그 위치에 삽입. ordering 회귀 0
- **callout = wrapper, content 100% 보존**: list-entry 변환(sprint chip 등) 부가 가치는 폐기, lessons/carryover 그룹 raw markdown(H2 헤딩만 제거 + H3 포함)을 wrapper 안에 prose 렌더. H2/H3 mixed prose 누락 0
- **terminal 검사 폐기**: chunk 렌더가 in-place 삽입을 책임지므로 terminal 검사 불필요. 모든 ADR에서 callout 표시
- **tolerant heading matching**: CARRYOVER_RE + LESSONS_RE로 KR/EN/numbered prefix(`9.`)/plus suffix(`137+`)/variant 헤딩(`주요 교훈`, `Carry-Over Seeds`) 모두 커버
- **PR 표 strip은 implementation H2 안에서만**: PhaseStrip이 phases를 시각화하는 경우에만 표 라인 정밀 제거. graceful degradation

## 구현 (단일 PR, 브랜치 `feat/sprint-163-adr-pr-table-callouts`, 12 commits)

| Phase | 담당 | 변경 | 라인 |
|-------|------|------|------|
| A — PR 표 strip 기반(parser/types) | architect | `parser.ts` + `types.ts` | +269 +27 |
| B — Lessons/Carryover 추출 + i18n | architect | `parser.ts` + `i18n.ts` + `section-aliases.ts` | +10 +20 |
| C — callout 컴포넌트 + detail-view 통합 | architect | `adr-lessons-callout.tsx` 신규 + `adr-carryover-callout.tsx` 신규 + `adr-detail-view.tsx` | +57 +73 +(±) |
| D — sprint-157 Mermaid 다이어그램 | architect | `sprint-157.md` KR+EN | +22 ×2 |
| R1 P2 — EN carryover heading | architect | `section-aliases.ts` | +20 −4 |
| R2 P2 — terminal 검사 + TOC anchor | architect | `parser.ts` + callout 컴포넌트 2개 + `adr-detail-view.tsx` | +99 −5 |
| R3 P2 — TOC H2 유지 (H3만 strip) | architect | `adr-detail-view.tsx` | +12 −9 |
| R4 P2/P3 — chunks 렌더 + numbered prefix | architect | `parser.ts` + `section-aliases.ts` + `adr-detail-view.tsx` | +150 −53 |
| R5 P2 — preamble seed | architect | `adr-detail-view.tsx` | +19 |
| R6 P2 — prose-only H3 유지 | architect | `parser.ts` + `adr-detail-view.tsx` | +46 −12 |
| R7 P2 — callout을 wrapper로 전환 | architect | callout 2개 + `adr-detail-view.tsx` | +78 −118 |
| R8 P2 — plus-suffixed sprint heading | architect | `section-aliases.ts` | +1 −1 |
| R9 P2 — lessons tolerant matching | architect | `section-aliases.ts` | +11 |

### 세부 변경

1. **parser.ts**: `extractLessons`/`extractCarryover`/`buildBodyMarkdownForProse`/`stripPrTableLines`/`getCanonicalSectionIndices`/`isCanonicalTerminal`/`hasTopLevelListItem` 추가. H3 sub-section 통합(`collectCanonicalSectionMarkdown`), dash + 숫자 list + em-dash 구분자 인식
2. **types.ts**: `AdrLessonEntry` / `AdrCarryoverEntry` / `AdrDoc.bodyMarkdownForProse|lessons|carryover` 필드 추가
3. **section-aliases.ts**: CARRYOVER_RE(numbered/plus/EN/parenthetical 모두) + LESSONS_RE 추가, numbered prefix 정규화
4. **i18n.ts**: `lessonsTitle`/`carryoverTitle`/`carryoverSprintPrefix` KR+EN
5. **adr-lessons-callout.tsx** 신규: 💡 + callout-warn 톤 wrapper, prose-headings/p/li/strong fg 색상 매핑
6. **adr-carryover-callout.tsx** 신규: 📋 + callout-info 톤 wrapper
7. **adr-detail-view.tsx**: `renderSectionChunks` 도입 — preamble seed + sections H2 단위 chunk + lessons/carryover wrapper in-place + implementation PR 표 strip + TOC filter
8. **docs/adr/sprints/sprint-157.md** + EN: P1~P10 + hotfix 사이클 flowchart Mermaid 추가 (phase/hotfix/realfix 3색 분기)

## 검증

| 항목 | 결과 |
|------|------|
| tsc --noEmit | clean (0 errors) |
| npm run build | 247 페이지 정적 export 성공 |
| check-adr-links blog/out/adr | 1246 links 0 broken |
| check-adr-en-coverage --strict | 111/111 (100.0%) PASS |
| Critic R1 (Codex gpt-5) | P2 1건 EN carryover heading 미커버 → 해소 |
| Critic R2 | P2 2건 TOC out-of-sync + section ordering → 해소 |
| Critic R3 | P2 1건 TOC H2 누락 → 해소 |
| Critic R4 | P2 callout 순서 회귀 + P3 numbered heading → chunks 렌더 + numbered prefix 정규화 |
| Critic R5 | P2 1건 preamble 누락 → seed 추가 |
| Critic R6 | P2 1건 prose-only H3 누락 → list-bearing H3만 흡수 |
| Critic R7 | P2 2건 H2/H3 mixed prose 누락 → callout wrapper 전환 (list-entry 변환 폐기, content 100% 보존) |
| Critic R8 | P2 1건 plus-suffixed sprint → 정규식 fix |
| Critic R9 | P2 1건 lessons tolerant heading → LESSONS_RE 추가 |
| **Critic R10** | **PASS** — "no discrete regression" |

## 브랜치 규율 ✅ 31 스프린트 연속 준수

- 신규 브랜치 `feat/sprint-163-adr-pr-table-callouts` + Squash merge 예정
- main 직접 commit 0건, `--no-verify` 0건

## 신규 패턴

1. **sections 단위 chunk 렌더 + callout in-place 삽입** — 본문 markdown을 H2 단위 chunk로 분할하여 callout을 원래 위치에 정확히 삽입. ordering 회귀 차단 + 시각 강조 동시 달성
2. **callout = wrapper, content 100% 보존** — list-entry 변환은 부가 가치, 본문 보존이 핵심. wrapper가 raw markdown 그룹을 prose 안에 렌더하면 H2/H3 prose/list/separator 모든 content 자연 표시
3. **tolerant heading matching (CARRYOVER_RE + LESSONS_RE)** — 정확 alias 매치 + 정규식 fallback 이중 layer. numbered prefix, plus suffix, parenthetical suffix, KR/EN variant 모두 커버
4. **preamble seed 패턴** — frontmatter-less ADR의 첫 H2 직전 dash-list 메타가 sections 외부에 있는 한계를 본문 prefix slice로 seed. detail-view 상단 H1과 중복 차단 정규식 포함
5. **Critic 10 라운드 회귀 적발 패턴** — R1~R9 모두 P2 발견. 단순 정규식 변형부터 본질적 ordering/content 보존까지 점진 노출. R7에서 list-entry 변환 자체를 폐기하는 본질 결정 도출
6. **callout 토큰 4종 활용 분기** — 기존 `callout-warn`(교훈, 노란 톤) / `callout-info`(이월, 파란 톤) 토큰 재사용으로 Palette 신규 매핑 0건. prose-headings:text-* 등 prose 색상 매핑은 callout fg 일관

## 교훈

1. **Critic 1차 통과 ≠ 안전 통과** — 본 sprint 10 라운드 사이클이 단순 정규식 + ordering + content 보존 결함을 점진 노출. P0/P1 0건이라도 P2 누적이 사용자 인지 가능 회귀로 직결. 다중 라운드 누적이 안전 보장
2. **list-entry 변환은 부가, content 보존이 핵심** — 본 sprint 초기 callout 설계가 list items 만 그렸으나 H2/H3 mixed content 누락 회귀 노출. R7에서 wrapper 패턴으로 본질 회수. 본문 무손실 우선 + 시각 강조는 박스 wrapping으로 달성
3. **tolerant heading matching은 정규식 + alias 이중 layer 필수** — KR/EN/numbered/plus/parenthetical variant가 실데이터에 누적. 정확 alias만으로는 누락 불가피. CARRYOVER_RE + LESSONS_RE 패턴은 다른 canonical에도 확장 가능
4. **sections 단위 chunk 렌더가 in-place 변환의 기반** — markdown 본문을 단일 prose 렌더하는 단순 접근은 in-place 시각화 불가. sections 메타데이터를 활용한 chunk 분할이 본 sprint Phase D의 핵심 enabler
5. **preamble은 sections 외부 영역이라 별도 처리 필수** — frontmatter-less ADR의 H1 직후 dash-list 메타가 sections 배열에 없음. chunk 렌더 시작 시 bodyMarkdown 의 첫 H2 직전 slice + H1 제거를 명시 seed 해야 누락 방지
6. **brand-color callout 토큰 활용 = Palette 비용 0** — 기존 4종 callout(info/warn/success/danger) + accent 6색이 ADR 도메인 컴포넌트에 충분. `components/ui/` 공통 컴포넌트와 달리 도메인 컴포넌트는 Palette 가이드 없이도 안전
7. **Codex gpt-5 교차 검증의 ROI 정량 입증** — 단일 sprint 10 라운드 호출에서 P2 12건 적발 + 본질 결함(content 보존) 발견. Anthropic Claude family 맹점(자기참조 검증의 한계)을 OpenAI Codex로 보완하는 사이클 효과 본 sprint 최대 입증

## Sprint 164 이월

- **검증 후속**: 사용자 시각 검증 — 다양한 sprint ADR(sprint-160 carryover→verification ordering, sprint-141 prose-only H3, sprint-105 `주요 교훈`, sprint-127 `Sprint 128 시드`)에서 callout 렌더/TOC 동작 시각 확인
- **추가 자동화 후보**:
  - PR/H3-only PR 표 추출 (sprint-160 `### PR AlgoSu #274 세부` 같은 H3 sub-section PR 표 → extractPhaseEntries 확장)
  - implementation H2의 추가 텍스트 포함 헤딩(`## 구현 (3 PR squash merge + ...)`)의 canonical 매칭 — resolveCanonical partial matcher 또는 prefix-based
  - sprint-87 같은 H3-only carryover(`### 이월 항목` H3, H2 'Outcome' 아래)도 callout 흡수
- **이월 시드 계속** (Sprint 160 신규 #신규5~7, Sprint 159 #신규1~3, Sprint 158 #30/#31, Sprint 157 #24/#26~#28, UAT 시드 #5/#9, 이월 유지 #18/#23)
- **UAT 사용자 직접** (20 스프린트 누적): 본 sprint 신규 — sprint-160/161/162/87 등 각종 구조 ADR에서 callout 렌더 + TOC 점프 + Mermaid 다이어그램 sprint-157 시각 확인

## 관련 문서

- [sprint-162.md](./sprint-162.md) — 직전 sprint, Mermaid 활성화 + Critic P3 이월 인수
- [sprint-161.md](./sprint-161.md) — Phase D 분할 출발점, sections 단위 시각화 패턴
- [sprint-157.md](./sprint-157.md) — 본 sprint Phase D Mermaid 다이어그램 추가 대상
