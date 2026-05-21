---
sprint: 189
title: "Blog UI/UX revamp — Graph legend/filter + Category 7-class + ADR topic auto-classification (Phase 5)"
date: "2026-05-21"
status: completed
agents: [Oracle, Herald, Architect, Palette, Critic, Scribe]
related_adrs: ["sprint-188", "sprint-187", "sprint-186", "sprint-185"]
related_memory: ["sprint-window", "feedback-blog-workflow"]
topics: ["product"]
tldr: "5-phase blog revamp complete — post category 7-class, ADR topic frontmatter auto-classification (KR SSOT + EN injection), and graph legend/filter (WCAG AA) round out the portfolio navigation UI."
---
# Sprint 189 — Blog UI/UX revamp — Graph legend/filter + Category 7-class + ADR topic auto-classification (Phase 5)

## Goal

- **Phase 5 (final)** of the 5-phase revamp (user `/goal` plan) that turns the tech blog into a "portfolio-style" one. Complete the portfolio navigation UI with ADR graph legend/filter, post category 7-class, and ADR topic frontmatter auto-classification.
- Visitors can filter posts by genre, explore ADRs by topic, and immediately grasp the meaning of graph nodes/edges.
- Existing routes stay **non-destructive**. KO+EN simultaneously. Work on top of the Phase 1 (Sprint 185) Engineering Editorial design system.

## Decisions

### D1. Post category 2-class → 7-class + dynamic tab rendering (Herald)

Replace the 2-class category scheme (journey/challenge) with **7 classes** (ai-agent/cicd/architecture/backend/platform/frontend/retrospective). `posts.ts` holds the `VALID_CATEGORIES` constant and fallback logic. `category-tabs` **renders only categories with at least one post** (empty frontend tab graceful skip). `post-list-with-filter` manages filter state via `availableCategories` useMemo. i18n ko+en 7 keys. Re-classify frontmatter for 10 posts × 2 locales. Synchronize the `VALID_CATEGORIES` enum in `check-blog-crosscheck` to the 7-class set and add a SSOT comment to prevent future enum drift.

### D2. ADR topic frontmatter auto-classification = KR SSOT + loader EN injection (Architect)

Declare ADR topic classification as `AdrMeta.topics` (array) frontmatter, and have the **loader inject KR topics into EN locale ADRs at build time** (no EN frontmatter modification required → duplicate/drift structurally prevented). Add `resolveTopics` parser, `filterAdrsByTopic` (date desc) in the index builder, and expand `site-content` `ADR_TOPICS` to 6 topics (existing 4 + new security/product). Remove `adrIds` hard-coding and switch to frontmatter aggregation. Backfill KR frontmatter for 15 files (8 permanent ADRs with new frontmatter insertion + 7 sprint/topic merges; multi-topic support: ADR-003/ADR-025 = operations+security, sprint-95-programmers-dataset = data+product). Add `check-adr-conversion` F11/F12 fixtures.

### D3. ADR graph legend/filter + WCAG AA colors (Palette)

Add `filterAdjacency` pure helper + convert `adr-graph-view` from server → **client component** (filter state: `activeKinds`/`showResolved`/`showUnresolved`). Filter UI: kind 3 toggles (sprint/topic/permanent) + edge 2 toggles (resolved/unresolved), role=checkbox for accessibility. Legend: kind 3-color swatches + meaning descriptions. Apply `KIND_COLORS` node kind colors in `related-adr-graph`. i18n ko+en 11 keys. Patch (e1e9d70): fix `filterAdjacency` unresolved-edge bug (`toOk = resolved ? has(to) : true`) + **WCAG AA** colors (sprint `#0e7490` 5.35:1 / topic `#7c3aed` 5.71:1 / permanent `#2347e6` 6.75:1, all white-text 4.5:1+) + remove orphan `graphNodeNormal` i18n key.

## Implementation

### Implementation commits (5 commits, 51 files +654/-99)

- `9eeeff0` feat — post category 7-class replacement (KO+EN simultaneously)
- `3dc780c` chore — check-blog-crosscheck category enum sync to 7-class + SSOT comment
- `28156b6` feat — Sprint 189 D2 ADR topic frontmatter auto-classification (KO+EN)
- `1c297da` feat — ADR relationship graph legend/filter enhancement (KO+EN)
- `e1e9d70` fix — 3 Critic findings resolved (graph filter bug + WCAG AA + orphan key)

Key changed files:

**D1 (Herald)**:
- `blog/src/lib/posts.ts` — `VALID_CATEGORIES` 7-class constant + `PostMeta.category` type update + fallback
- `blog/src/components/category-tabs.tsx` — dynamic render (availableCategories-based, empty tabs graceful skip)
- `blog/src/components/post-list-with-filter.tsx` — availableCategories useMemo
- `blog/src/components/post-card.tsx` — badge for 7 classes
- `blog/src/lib/i18n.ts` — category 7 keys ko+en added
- `blog/content/posts/`·`posts-en/` 10 posts×2 — frontmatter category reclassified
- `scripts/check-blog-crosscheck.mjs` — VALID_CATEGORIES enum synced to 7-class + SSOT comment

**D2 (Architect)**:
- `blog/src/lib/adr-parser.ts` — `resolveTopics` + `AdrMeta.topics`
- `blog/src/lib/adr-loader.ts` — EN locale topics injection from KR (build time)
- `blog/src/lib/adr-index-builder.ts` — `filterAdrsByTopic` (date desc)
- `blog/src/lib/site-content.ts` — `ADR_TOPICS` 6 topics (`adrIds` removed → frontmatter aggregation) + new security/product
- `blog/src/lib/i18n.ts` — ADR topic keys ko+en 4 keys
- `blog/src/components/adr-topic-collections.tsx` — frontmatter aggregation switch
- `blog/content/adr/`·`adr-en/` frontmatter backfill 15 files (8 permanent ADRs + 7 sprint/topic)
- `scripts/check-adr-conversion.mjs` — F11/F12 fixtures added

**D3 (Palette)**:
- `blog/src/lib/adr-graph.ts` — `filterAdjacency` pure helper + KIND_COLORS
- `blog/src/components/adr-graph-view.tsx` — server→client, filter state (activeKinds/showResolved/showUnresolved), filter UI, legend
- `blog/src/components/related-adr-graph.tsx` — KIND_COLORS node kind colors
- `blog/src/lib/i18n.ts` — graph legend/filter ko+en 11 keys

## Critic cycle

- **D1 wave auto-critic** — `codex review --base main` **0 findings**. Category enum type-safe, graceful skip implemented, zero EN Korean residue.
- **D2 wave auto-critic** — `codex review --base main` **0 findings**. Loader KR→EN topics injection, filterAdrsByTopic index, fixtures — all clean.
- **D3 wave auto-critic (1R)** — `codex review --base main` **3 findings**:
  - P1: `filterAdjacency` unresolved-edge `to` node missing bug (incorrect `toOk` logic)
  - P2: Colors not meeting WCAG AA (original sprint/topic/permanent hues)
  - P3: Orphan i18n key (`graphNodeNormal`) residue
  - → All resolved in `e1e9d70` patch commit.
- **Final consolidated** (`codex review --base main`) — **0 findings**. "Critical/High/Medium 0. Category tab filtering, topic frontmatter injection, and graph filter/legend are consistent and type-safe."

## Verification

### Browser end-to-end (blog build → static server + DOM)

- **Category 7-class** (KO/EN): all + 6 tabs (frontend has no posts → graceful skip, tab absent) · each post badge shows correct 7-class · zero i18n residue ✓
- **ADR topic 6 collections** (KO `/adr` · EN `/en/adr`): operations/incidents 4 · Agent 3 · CI 3 · Data 3 · **new Security 3 · new Product 2** · multi-topic ADRs (ADR-003/ADR-025/sprint-95-programmers-dataset) appear in both collections simultaneously · KR→EN topics injection working (EN frontmatter unmodified, KR SSOT reflected) ✓
- **Graph legend/filter** (`/adr` · `/en/adr`): kind filter (135→9 with sprint-only) · edge filter · kind-specific colors (sprint/topic/permanent) · legend swatches + descriptions · current unresolved edges 0 (SVG dashed lines 0 confirmed) ✓
- **Regression**: existing post/ADR detail routes intact · zero EN Korean residue ✓

### Local

- `tsc --noEmit` 0 errors · `npm run build` all routes static prerender.
- Blog/ADR gates no regression:
  - i18n-residue (2.19%<8%)
  - doc-refs (339 0 broken)
  - adr-links KO/EN 0 broken
  - adr-conversion (12/12, F11/F12 new)
  - index-count (8/1/127→128 after this ADR)
  - en-coverage (136/136→137/137 after this ADR)
  - blog-crosscheck (KR10/EN10 0 violations)

### CI

- Implementation commits — Build Blog SSG·Coverage Gate·E2E Programmers all SUCCESS.

## Result

- **Implementation**: feat/sprint-189-blog-phase5 branch, 5 commits (`9eeeff0`·`3dc780c`·`28156b6`·`1c297da`·`e1e9d70`), 51 files +654/-99.
- **5-phase revamp complete**: Phase 1 (Sprint 185 home landing+Engineering Editorial) → Phase 2 (Sprint 186 ADR curation) → Phase 3 (Sprint 187 post detail PDR) → Phase 4 (Sprint 188 About+Footer) → **Phase 5 (this sprint, navigation UI complete)**.
- sprint-189 ADR (KR+EN) + README sprint ADR count 127→128·range 62~189 (this /stop commit).

## New patterns

- **Frontmatter topic auto-classification = KR SSOT + loader EN injection**: declare `topics` array in KR frontmatter; the loader injects them into EN locale at build time. Manual copy-and-update of EN frontmatter disappears and drift becomes structurally impossible. Multi-topic ADRs appear in both collections automatically via the array (removes the `adrIds` hard-coding from Sprint 186 curation).
- **Dynamic category tabs = render only categories with posts**: `availableCategories` useMemo produces tabs only for classes that have at least one post. Expanding to 7 classes doesn't expose empty tabs (frontend graceful skip), and a tab appears automatically once the first post of that class is added — no UX debt.
- **Gate enum SSOT sync + SSOT comment**: when changing a SSOT constant like `VALID_CATEGORIES`, synchronize the validation gate (`check-blog-crosscheck`) enum simultaneously and add a SSOT comment (`// SSOT: keep in sync with posts.ts VALID_CATEGORIES`) so future contributors know exactly what else needs updating.

## Lessons

- **5-phase streak confirmed — Engineering Editorial foundation accelerates Phase 5 too**: the Engineering Editorial tokens·AdrCard·buildUrl·i18n/site-content SSOT built in Phase 1 meant Phase 5 finished with zero new tokens as well, just component/data additions. "Foundation first" proved zero-rework across all 5 phases.
- **Browser is the judge (unresolved-edge verdict)**: Critic flagged D3's "unresolved edge toggle might be a dead feature". Static reasoning alone couldn't determine "are there currently 0 unresolved edges?", but checking SVG dashed-line count in a real browser confirmed "0 edges → P2 carryover has zero impact today". The filter bug (`toOk` logic) was also caught in browser DOM verification as a behavioral mismatch.
- **Frontmatter SSOT + build-time aggregation makes content-meta drift impossible**: the `adrIds` hard-coding approach required a manual site-content update every time an ADR was added (a drift entry point). Switching to frontmatter `topics` declaration + build-time aggregation makes the ADR frontmatter the sole source of truth, so inconsistency has no structural path to occur (inherits Sprint 185 "display metrics injected at build time").

## Carryover (Sprint 190+)

- **P2 (carryover)**: `filterAdjacency` unresolved-edge `to` node missing → mermaid implicit node / count mismatch. Zero unresolved edges today → no impact; inherits original `buildChart` design intent → deferred to Sprint 190.
- **Existing seed remnants**: H3-only PR-table extraction (sprint-135/143/146) · `sprint-87-plan.md` relocate/removal · accumulated UAT (Programmers re-submission grading · English Grafana CB dashboard) · follow-ups (remove coverage-gate skipped allowance · `(adr)` layout split · prom-client Case B–D · `.claude-tools/` Phase 2 deletion · doc-refs bare-path expansion).
- **Low / informational**: EN topics direct mutation (in-place instead of loader inject) · category-tabs arrow-key navigation not supported.
