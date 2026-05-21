---
sprint: 193
title: "Full Removal of the Blog ADR Graph Feature"
date: "2026-05-21"
status: completed
agents: [Oracle, Herald, Critic]
related_adrs: ["sprint-189"]
related_memory: ["sprint-window"]
topics: ["product"]
tldr: "Remove the mermaid-based ADR relationship graph added in Sprint 189 (the dedicated /adr/graph page + the mini graph in the detail sidebar) in full. Delete 5 graph-only components, lib logic (buildGraph/getSubgraph/filterAdjacency), dead data (outgoingLinks), 44 i18n keys, and fixtures F7/F8 — while preserving the graph-independent 'Related ADRs' text links, blog body mermaid, and the --diagram-bg/grid tokens. tsc 0, build (routes gone), 7 gates no-regression, Critic 0 findings, CI #339 37 pass / 0 fail."
---
# Sprint 193 — Full Removal of the Blog ADR Graph Feature

## Goal

- Remove the **mermaid-based ADR relationship graph** from the tech blog (`blog/`) ADR section entirely.
- Delete both ① the dedicated graph page (`/adr/graph`, KR/EN — legend, filters, full graph) and ② the mini relationship graph (1-hop subgraph) in the ADR detail page sidebar, both introduced in Sprint 189.
- Preserve graph-independent functionality (the text representation of relationship data, blog body diagrams), clean up dependencies, and guarantee gate no-regression and KR/EN parity.

## Background

- The user's `/start` argument directed: "Remove the graph feature from the Blog ADR." On kickoff, a key ambiguity surfaced — "graph feature" had two possible scopes.
- Exploration revealed that the ADR detail sidebar (`adr-meta-sidebar.tsx`) contained **two separate things**: ① "Related ADRs" (`RelatedLinks`, text links based on `meta.relatedAdrs` — not a graph), and ② the mini relationship graph (`RelatedAdrGraph`, mermaid visualization). That is, relationship data was already shown as text links, and the mini graph was an additional visualization layered on top.
- Additionally, the blog body mermaid diagrams (`blog/src/components/blog/mermaid.tsx`, etc.) were a completely separate feature unrelated to the ADR graph.

## Decision

### D1. Deletion scope — the entire graph visualization (user)

- Confirmed scope via AskUserQuestion → **"remove the entire graph feature."** Remove the dedicated page + sidebar mini graph + all graph components, lib logic, and i18n keys.
- **Preserve**: the sidebar "Related ADRs" text link list (not a graph), the blog body mermaid diagrams, and the `--diagram-bg/grid` CSS tokens (potentially shared with blog body mermaid, harmless).

### D2. lib graph logic — remove all

- `getSubgraph` was used to build the mini graph in the 6 detail routes, but since the mini graph itself is deleted, `getSubgraph`, `buildGraph`, `mergeTargets`, `filterAdjacency`, the `AdrIndex.graph` field, and the `AdjacencyList` type are removed together. Non-graph lib (`buildUrl`/`filterAdrsByTopic`/`groupByKind`/`mapBySprint`) is kept.

### D3. Remove dead data (`outgoingLinks`) alongside

- `AdrDoc.outgoingLinks` was graph-only data consumed solely by `buildGraph`/`mergeTargets`. After graph removal it becomes a dead field, so the extraction logic in `parser.ts` (`extractOutgoingLinks`) and its dedicated regex `ADR_LINK_RE` are removed too. `normalizeAdrId` is kept since it is also used in related_adrs extraction.

### D4. fixtures F7/F8 — removed (no loss of regression coverage)

- F7/F8 were graph-only regressions that directly verified `index.graph.edges`. With `AdrIndex.graph` removed, they lose meaning, so both fixtures are deleted (12→10). ADR relationship regression is still covered by F6 (`relatedAdrs` non-empty).

## Implementation

### Implementation commit (1 commit, PR #339 squash → `81c62e8`)

- `b1da63d` chore(blog) — full removal of the ADR graph feature (20 files, +15 / −845)
  - **Deleted (5)**: `adr/graph/page.tsx` (KR/EN), `adr-graph-view.tsx`, `adr-graph-cta.tsx`, `related-adr-graph.tsx`
  - **Components (4)**: `adr-header` (nav "Graph" link), `adr-landing-view` (graph CTA), `adr-meta-sidebar` (mini graph block + its sole consumer, the now-unused `prefix` variable), `adr-detail-view` (`miniGraph` prop)
  - **Routes (6)**: sprints/permanent/topics × KR/EN — removed `getSubgraph`/`buildAdrIndex().graph`/`miniGraph` passing
  - **lib**: `index-builder` (buildGraph/mergeTargets/getSubgraph/filterAdjacency + graph field), `types` (AdjacencyList·AdrIndex.graph·AdrDoc.outgoingLinks), `parser` (extractOutgoingLinks·ADR_LINK_RE)
  - **i18n**: removed 22 graph keys each in KR/EN
  - **fixtures**: removed F7/F8 (12→10) + header comment update

## Verification

- **Type/build**: `tsc --noEmit` source errors 0 (the remaining 6 are stale `.next/types` cache referencing deleted pages — gone after `.next` regeneration). `next build` succeeds → output confirms `/adr/graph`·`/en/adr/graph` routes are gone, while the rest of the ADR/posts/about routes work in both KR/EN.
- **7 gates no-regression**: doc-refs 347 (0 broken) · adr-en-coverage 139/139 · i18n-residue 2.19% (<8%) · adr-index-count consistent · blog-crosscheck KR10/EN10 (0 violations) · adr-links 0 broken · adr-conversion 139 all passed.
- **Full grep of residual references**: 0 references to graph-only symbols or the `/adr/graph` route (only comment mentions cleaned up).
- **lint**: blog has no ESLint config (N/A) — quality gates are tsc/build.
- **Critic**: `codex review --base main` — 0 findings ("removal is internally consistent: source references to removed components/types/helpers were cleaned up, and TypeScript passes. No actionable regressions").
- **CI #339**: **Passed 37 / Failed 0** — Build Blog (SSG) pass (2m21s) · Coverage Gate · E2E Programmers pass.

## Lessons / Patterns

- ① **When deleting a feature, separate "relationship data" from "data visualization"** — "Related ADRs" already existed separately as text links (`RelatedLinks`), independent of the graph. Removing only the visualization (mini graph) while preserving the relationship-data representation keeps the information the user perceives (which ADRs connect) while shedding the heavy mermaid dependency. Rather than leaving scope ambiguous, the full visualization removal was explicitly confirmed via AskUserQuestion.
- ② **Deletion tracks dependent symbols so no dead code is left behind** — the `prefix` variable (the mini graph block's sole consumer) and `outgoingLinks`/`ADR_LINK_RE` (graph-only) were removed together to block unused-symbol warnings and dead fields. Before removal, `grep` selected multi-consumer symbols (`normalizeAdrId` is also used by related_adrs → kept), avoiding over-deletion.
- ③ **The core verification for a deletion PR is "0 residual references + routes gone + gates no-regression"** — automatically cross-checking that routes actually disappeared from the build output, that graph-only symbols are 0 in a full grep, and that content/index gates still pass blocks "silent breakage."

## Carryover

- (Optional carryover) **Raise CI PYTHON_VERSION 3.12 → 3.13** (Dockerfile 3.13 parity) — split off in Sprint 192 D1, to be considered in a separate sprint.
- Accumulated UAT (user-driven): Programmers re-submission grading / English production Grafana CB dashboard / Sprint 160–193 accumulated.
