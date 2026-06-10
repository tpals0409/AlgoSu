---
sprint: 245
title: "Blog Post \"The Art of Deletion\" (KR+EN) — Retrospective on Things We Built and Removed"
date: "2026-06-10"
status: completed
agents: [Oracle, Scribe, Critic]
related_adrs: ["sprint-157", "sprint-189", "sprint-193", "sprint-201", "sprint-244"]
related_memory: ["sprint-window", "feedback-blog-workflow"]
topics: ["blog", "retrospective", "refactoring"]
tldr: "Wrote the blog material carried over from Sprint 244 — \"The Art of Deletion\" (deleting-with-discipline.mdx) KR+EN, category retrospective, order 12, relatedAdrs sprint-157/189/193/201. The user-confirmed direction is to frame it not as 'what we deleted' but as 'how to delete safely' as a methodology. Using the ADR graph (built in S189 → removed in S193) and search (built in S157 → removed in S201) as examples, three principles of deletion are derived: ①before starting, use grep to separate feature-exclusive assets (minisearch·search* i18n·SearchDoc / graph components ×5·buildGraph·44 i18n keys) from shared assets (buildUrl·groupByKind·kind* i18n / related-ADR text links·inline mermaid) ②kill dead fields together with the feature (searchDocs·outgoingLinks) ③deletion breaks outside its target (the S201 incident: grep scope limited to blog/ → missed the root check-adr-links.mjs validating search-index.json (exit 2) → not a required check, so main merged broken → caught by the /stop gate). Scribe authored (9c50de1) → Critic (Codex gpt-5.5, session 019eb181) ✅ mergeable (Critical/High/Medium 0, fact consistency all 12 items matched against ADRs·KR↔EN 1:1·correct agent attribution) → one Low (sprint-157 relatedAdrs asymmetric omission) fixed by Scribe (2a903b1). Verification crosscheck --strict 0 (KR/EN 14)·SSG EXIT=0 (new KR+EN routes)·doc-refs 465 clean·CI green·post-merge main green. PR #438 squash c8e4ee4."
---
# Sprint 245 — Blog Post "The Art of Deletion" (KR+EN)

## Goal

- Write the blog material ("Things We Built and Removed") carried over from Sprint 244.
- User-confirmed direction: **"The Art of Deletion"** — frame it not as "what we deleted" but as **"how to delete safely"** as a methodology, with the two cases (ADR graph built in S189 → removed in S193, ADR search built in S157 → removed in S201) placed as examples of that methodology.
- Apply the blog pattern established in Sprint 237/244 (register consistency + crosscheck --strict + blog Critic).

## Background

- AlgoSu later removed two carefully built features in full: the ADR relationship graph (S189 mermaid-based `/adr/graph` page + mini graph + legend/filter → fully removed in S193), and ADR full-text search (S157 MiniSearch + build-time `search-index.json` → removed in S201).
- During /start, asked the user for the narrative center of gravity → confirmed "art of deletion focus" (how to delete safely) + category `retrospective`.

## Decisions

### D1. Narrative frame — "The Art of Deletion" methodology (user)
- Not a retrospective of "what we deleted" but a methodology of "how to delete safely". The two cases serve only as examples. The goal is to convey to the reader the discipline a solo developer follows when removing a feature.

### D2. category·meta — retrospective / order 12 / relatedAdrs ×4
- category `retrospective` (same classification as baekjoon-gone, a retrospective topic). order 12 (previous max 11 = model-selection-strategy).
- relatedAdrs ["sprint-157","sprint-189","sprint-193","sprint-201"] — search built·graph built·graph removed·search removed. **The draft omitted sprint-157** (included graph-built 189 but excluded search-built 157 = asymmetric), but it was added after Critic flagged it as a Low (D4).

### D3. The three principles (the spine)
1. **Split with grep before deleting** — feature-exclusive vs shared assets. Evidence: S201 (exclusive = minisearch dependency·search* i18n keys·SearchDoc type·toSearchDoc/toPlainText / shared preserved = kind*/metaSprint i18n·buildUrl/groupByKind/mapBySprint/filterAdrsByTopic), S193 (graph-exclusive = 5 components·buildGraph/getSubgraph/filterAdjacency·44 i18n keys·fixtures / preserved = related-ADR text links·inline mermaid·--diagram-bg/grid tokens).
2. **Kill dead fields together with the feature** — AdrIndex.searchDocs (S201), AdrDoc.outgoingLinks (S193), both explicitly removed as dead fields.
3. **(climax) Deletion breaks outside its target** — the S201 incident: the first PR limited grep scope to `blog/` → missed the root `scripts/check-adr-links.mjs` validating the existence of the deleted `search-index.json` (exit 2) → the CI `Build Blog (SSG)` job failed, but since it was not a required check the squash merge proceeded → main merged broken → caught by the local check-adr-links run in the `/stop` gate → patched in a follow-up PR. Lesson: code referencing a deleted file can live outside that file's directory; open the grep scope to the whole repository.

### D4. (post-Critic) Add sprint-157 to relatedAdrs
- Critic Low: the body explicitly states "the ADR search built in Sprint 157 was removed in Sprint 201," yet relatedAdrs omitted sprint-157 (no runtime impact due to graceful skip, but asymmetric). frontmatter curation is Scribe's domain → re-delegated a 1-line addition to Scribe (KR/EN simultaneously, `2a903b1`).

## Implementation

### Authoring (Scribe, `9c50de1`)
- New: `blog/content/posts/deleting-with-discipline.mdx` (KR, SSOT) + `blog/content/posts-en/deleting-with-discipline.mdx` (EN, 1:1), 105 lines each.
- Title "The Art of Deletion". MDX components: Problem/Decision/Result/Callout (type="info"). Register: consistent with model-selection-strategy.mdx (solo-developer first-person retrospective).
- **Scribe's pre-authoring fact-consistency check**: after reading all 4 source ADRs (157/189/193/201), cross-checked the figures used — 44 i18n keys (22 each KR/EN), dead field names, check-adr-links exit 2, not-a-required-check, /stop capture, CI 37/0 (S193), all ✅.

### Low fix (Scribe, `2a903b1`)
- Added "sprint-157" to the relatedAdrs array (KR/EN). Re-confirmed crosscheck --strict EXIT=0, then atomic commit.

## Verification

- crosscheck --strict 0 violations (blog posts KR/EN 14 each).
- blog SSG build EXIT=0 — confirmed new routes `/posts/deleting-with-discipline` + `/en/posts/deleting-with-discipline` generated.
- doc-refs lint 465 files clean (regression fixtures 8/8).
- **Critic (Codex gpt-5.5 --base 95ae0b3, session `019eb181`) ✅ mergeable** — Critical/High/Medium 0. Across all 4 axes: ①fact consistency all 12 items matched against ADRs ②KR↔EN 1:1 (sections·MDX·figures·symbols) ③model/agent attribution (Critic=Codex correct, 0 misattribution) ④MDX tag balance 4:4·frontmatter format valid. Only one Low (sprint-157 relatedAdrs) recommended → fixed in D4.
- CI (PR #438) all checks green (0 fail) → squash merge `c8e4ee4` → post-merge main run success.

## Lessons

1. **A deletion retrospective is itself a deletion methodology.** "What we deleted" is mere record, but extracting the common discipline (exclusive/shared grep split·dead-field co-removal·deletion-coupling detection) from two deletion cases produces a reusable methodology. The user's frame choice (the pivot to "how") determined the post's value.
2. **Executed the S244 model-attribution lesson as a gate.** Explicitly added "model/agent attribution check" to the Critic instructions → Critic cross-checked the body's "Critic 0 issues" (citing S193) against the actual ADR `agents:[..Critic]` to confirm correct attribution. The prior sprint's lesson settled as a verification item in the next sprint.
3. **relatedAdrs asymmetry is caught by cross-checking against body mentions.** The asymmetry — including graph-built (189) but only search-removed (201) — was flagged by Critic via the fact that the body explicitly mentions "the search built in S157." Metadata curation is also subject to body-consistency checks.
4. **Value of Scribe's pre-authoring fact-consistency check.** Cross-checking all 4 source ADRs before authoring → 0 fact errors by the time it reached Codex Critic. A post backed by solid facts passes downstream gates quickly.

## Carryover

- Blog material: CS quiz (S215~229) · zstd compression and other remaining topics → next sprint.
- Consider formally adding a model/agent attribution check to the fact-consistency gate (applied 2 sprints in a row, S244·S245 — pattern-settling stage).
- Existing carryover: (harness slot) permanent pane guard + root fix for window decoration (--full FAIL 1) + Codex model pin + status mis-recording 3x in a row · `Quality — docs` promotion to required · synchronous-log singleton context·i18n·ConfirmStep tErrors·inline style (S242 carryover) · Q-4 libs/ spike (backlog) · CI helper unit-test policy · (user console) GA4 ×3·live SEO redeploy·harness cron·webhook regenerate·cumulative UAT.
