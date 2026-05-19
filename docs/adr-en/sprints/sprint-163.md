---
sprint: 163
title: "ADR Detail Phase D — PR Table Separation + Lessons/Carryover Callouts"
date: "2026-05-19"
status: completed
agents: [Oracle, Architect, Critic]
related_adrs: ["sprint-162", "sprint-161"]
related_memory: ["sprint-window"]
---
# Sprint 163 — ADR Detail Phase D: PR Table Separation + Lessons/Carryover Callouts

## Goals

- Execute Phase D split-carried from Sprint 161 — separate PR table from ADR detail prose to block duplication with PhaseStrip cards
- Visually emphasize lessons/carryover sections via callout boxes (💡 / 📋) — improve visibility of key information previously rendered as plain H2 headings
- Resolve Sprint 162 Critic R1 P3 carryover: expand Mermaid diagrams in existing ADRs (sprint-157 P1~P10 + hotfix cycle visualization)

## Decisions

- **sections-level chunk render + in-place callout insertion**: traverse body markdown by sections, accumulate prose, flush on lessons/carryover H2 → insert callout wrapper at that position. Zero ordering regression
- **callout = wrapper, 100% content preservation**: discard list-entry transform (sprint chip etc.) as auxiliary value, render lessons/carryover group raw markdown (H2 heading removed + H3 included) as prose inside the wrapper. Zero H2/H3 mixed prose loss
- **drop terminal check**: chunk render's in-place insertion handles ordering, so terminal check is unnecessary. callout shown on all ADRs
- **tolerant heading matching**: CARRYOVER_RE + LESSONS_RE cover KR/EN/numbered prefix (`9.`)/plus suffix (`137+`)/variant headings (`주요 교훈`, `Carry-Over Seeds`)
- **PR table strip only within implementation H2**: precise table-line removal only when PhaseStrip visualizes phases. Graceful degradation

## Implementation (single PR, branch `feat/sprint-163-adr-pr-table-callouts`, 12 commits)

| Phase | Owner | Changes | Lines |
|-------|-------|---------|-------|
| A — PR table strip infra (parser/types) | architect | `parser.ts` + `types.ts` | +269 +27 |
| B — Lessons/Carryover extraction + i18n | architect | `parser.ts` + `i18n.ts` + `section-aliases.ts` | +10 +20 |
| C — callout components + detail-view integration | architect | new `adr-lessons-callout.tsx` + new `adr-carryover-callout.tsx` + `adr-detail-view.tsx` | +57 +73 +(±) |
| D — sprint-157 Mermaid diagram | architect | `sprint-157.md` KR+EN | +22 ×2 |
| R1 P2 — EN carryover heading | architect | `section-aliases.ts` | +20 −4 |
| R2 P2 — terminal check + TOC anchor | architect | `parser.ts` + 2 callout components + `adr-detail-view.tsx` | +99 −5 |
| R3 P2 — TOC H2 preservation (H3 strip only) | architect | `adr-detail-view.tsx` | +12 −9 |
| R4 P2/P3 — chunks render + numbered prefix | architect | `parser.ts` + `section-aliases.ts` + `adr-detail-view.tsx` | +150 −53 |
| R5 P2 — preamble seed | architect | `adr-detail-view.tsx` | +19 |
| R6 P2 — prose-only H3 preservation | architect | `parser.ts` + `adr-detail-view.tsx` | +46 −12 |
| R7 P2 — callout to wrapper conversion | architect | 2 callouts + `adr-detail-view.tsx` | +78 −118 |
| R8 P2 — plus-suffixed sprint heading | architect | `section-aliases.ts` | +1 −1 |
| R9 P2 — lessons tolerant matching | architect | `section-aliases.ts` | +11 |

### Detailed changes

1. **parser.ts**: `extractLessons`/`extractCarryover`/`buildBodyMarkdownForProse`/`stripPrTableLines`/`getCanonicalSectionIndices`/`isCanonicalTerminal`/`hasTopLevelListItem` added. H3 sub-section unification (`collectCanonicalSectionMarkdown`), dash + numbered list + em-dash separator recognition
2. **types.ts**: `AdrLessonEntry` / `AdrCarryoverEntry` / `AdrDoc.bodyMarkdownForProse|lessons|carryover` fields added
3. **section-aliases.ts**: CARRYOVER_RE (numbered/plus/EN/parenthetical) + LESSONS_RE added, numbered prefix normalization
4. **i18n.ts**: `lessonsTitle`/`carryoverTitle`/`carryoverSprintPrefix` KR+EN
5. **adr-lessons-callout.tsx** new: 💡 + callout-warn tone wrapper, prose-headings/p/li/strong fg color mapping
6. **adr-carryover-callout.tsx** new: 📋 + callout-info tone wrapper
7. **adr-detail-view.tsx**: introduced `renderSectionChunks` — preamble seed + sections H2-level chunks + lessons/carryover wrapper in-place + implementation PR table strip + TOC filter
8. **docs/adr/sprints/sprint-157.md** + EN: P1~P10 + hotfix cycle flowchart Mermaid added (phase/hotfix/realfix 3-color branch)

## Verification

| Item | Result |
|------|--------|
| tsc --noEmit | clean (0 errors) |
| npm run build | 247 pages static export successful |
| check-adr-links blog/out/adr | 1246 links 0 broken |
| check-adr-en-coverage --strict | 111/111 (100.0%) PASS |
| Critic R1 (Codex gpt-5) | P2 1 EN carryover heading miss → resolved |
| Critic R2 | P2 2 TOC out-of-sync + section ordering → resolved |
| Critic R3 | P2 1 TOC H2 missing → resolved |
| Critic R4 | P2 callout order regression + P3 numbered heading → chunks render + numbered prefix normalization |
| Critic R5 | P2 1 preamble drop → seed added |
| Critic R6 | P2 1 prose-only H3 drop → list-bearing H3 only absorbed |
| Critic R7 | P2 2 H2/H3 mixed prose drop → callout wrapper conversion (list-entry transform discarded, 100% content preservation) |
| Critic R8 | P2 1 plus-suffixed sprint → regex fix |
| Critic R9 | P2 1 lessons tolerant heading → LESSONS_RE added |
| **Critic R10** | **PASS** — "no discrete regression" |

## Branch Discipline ✅ 31 consecutive sprints

- New branch `feat/sprint-163-adr-pr-table-callouts` + Squash merge planned
- main direct commit 0, `--no-verify` 0

## New Patterns

1. **sections-level chunk render + in-place callout insertion** — split body markdown into H2-level chunks to insert callout at original position. Blocks ordering regression and achieves visual emphasis simultaneously
2. **callout = wrapper, 100% content preservation** — list-entry transform is auxiliary, content preservation is core. Wrapper renders raw markdown group inside prose, naturally displaying all H2/H3 prose/list/separator content
3. **tolerant heading matching (CARRYOVER_RE + LESSONS_RE)** — exact alias matching + regex fallback dual layer. Covers numbered prefix, plus suffix, parenthetical suffix, KR/EN variants
4. **preamble seed pattern** — solve sections-external limitation of frontmatter-less ADR's dash-list meta below first H2 by body prefix slice seed. Includes H1 deduplication regex with detail-view's top H1
5. **Critic 10-round regression detection pattern** — R1~R9 all P2 findings. Progressive exposure from simple regex variations to fundamental ordering/content preservation. R7 reached essential decision to discard list-entry transform itself
6. **callout 4-token utilization branching** — reuse existing `callout-warn` (lessons, yellow tone) / `callout-info` (carryover, blue tone) tokens, 0 new Palette mappings. prose-headings:text-* prose color mapping consistent with callout fg

## Lessons

1. **First-pass Critic ≠ safe pass** — this sprint's 10-round cycle progressively exposed simple regex + ordering + content preservation defects. Even with 0 P0/P1, accumulating P2 directly leads to user-visible regression. Multi-round accumulation ensures safety
2. **list-entry transform is auxiliary, content preservation is core** — initial callout design rendered only list items, exposing H2/H3 mixed content drop regression. R7 reclaimed essence via wrapper pattern. Content losslessness first + visual emphasis via box wrapping
3. **tolerant heading matching requires regex + alias dual layer** — KR/EN/numbered/plus/parenthetical variants accumulate in real data. Exact alias alone inevitably misses. CARRYOVER_RE + LESSONS_RE pattern extensible to other canonicals
4. **sections-level chunk render is the foundation of in-place transformation** — simple single-prose-render approach makes in-place visualization impossible. Chunk splitting using sections metadata is Phase D's core enabler
5. **preamble is sections-external, requires separate handling** — frontmatter-less ADR's H1+dash-list meta below H1 absent from sections array. Must explicitly seed bodyMarkdown's first-H2-prefix slice + H1 removal at chunk render start to prevent drop
6. **brand-color callout token utilization = 0 Palette cost** — existing 4-token callout (info/warn/success/danger) + accent 6 colors sufficient for ADR domain components. Unlike `components/ui/` shared components, domain components safe without Palette guide
7. **Codex gpt-5 cross-validation ROI quantitatively proven** — single sprint 10-round calls detected P2 12 items + uncovered fundamental defect (content preservation). This sprint maximally proves the cycle effect of complementing Anthropic Claude family blind spots (self-reference verification limits) with OpenAI Codex

## Sprint 164 Carryover

- **Post-verification**: user visual verification — confirm callout render/TOC behavior on various sprint ADRs (sprint-160 carryover→verification ordering, sprint-141 prose-only H3, sprint-105 `주요 교훈`, sprint-127 `Sprint 128 시드`)
- **Additional automation candidates**:
  - H3-only PR table extraction (sprint-160 `### PR AlgoSu #274 details` style H3 sub-section PR table → extend extractPhaseEntries)
  - implementation H2 with additional text headings (`## 구현 (3 PR squash merge + ...)`) canonical matching — resolveCanonical partial matcher or prefix-based
  - sprint-87 H3-only carryover (`### 이월 항목` H3 under H2 'Outcome') also absorbed in callout
- **Carryover seeds continued** (Sprint 160 new #new5~7, Sprint 159 #new1~3, Sprint 158 #30/#31, Sprint 157 #24/#26~#28, UAT seeds #5/#9, maintained carryover #18/#23)
- **UAT user-direct** (20 sprints accumulated): this sprint new — visual confirmation of callout render + TOC jump + Mermaid diagram on sprint-160/161/162/87 various structures, sprint-157

## Related Documents

- [sprint-162.md](./sprint-162.md) — Previous sprint, Mermaid activation + Critic P3 carryover inheritance
- [sprint-161.md](./sprint-161.md) — Phase D split origin, sections-level visualization pattern
- [sprint-157.md](./sprint-157.md) — Target of this sprint's Phase D Mermaid diagram
