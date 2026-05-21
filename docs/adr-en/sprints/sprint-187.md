---
sprint: 187
title: "Blog UI/UX revamp — post detail portfolio-ization (TL;DR·PDR·related ADRs, Phase 3)"
date: "2026-05-21"
status: completed
agents: [Oracle, Palette, Herald, Critic, Scribe]
related_adrs: ["sprint-186", "sprint-185", "sprint-163"]
related_memory: ["sprint-window", "feedback-blog-workflow"]
---
# Sprint 187 — Blog UI/UX revamp — post detail portfolio-ization (TL;DR·PDR·related ADRs, Phase 3)

## Goal

- **Phase 3** of the 5-phase revamp (user `/goal` plan) that turns the tech blog into a "portfolio-style" one. Convert post detail pages from "body-only articles" into **portfolio-style articles where the TL;DR·Problem/Decision/Result structure is visible**.
- Let first-time visitors and recruiters quickly scan the core (problem → decision → result) without reading the whole article (plan §6).
- Existing posts/URLs and body narrative are **non-deleting, non-breaking** (frontmatter fields added + body bands inserted only). KO+EN simultaneously. Work builds on the Phase 1 (Sprint 185) Engineering Editorial design system.

## Decision

### D1. TL;DR data source = frontmatter `tldr` field (user-confirmed)

The TL;DR block at the top of each post sources from a new frontmatter `tldr` (optional string) field (the MDX body component alternative was rejected). It always renders in a fixed position at the very top, can be reused in list/card views, and aligns with Sprint 185's structured-data SSOT philosophy. Added `tldr?`·`relatedAdrs?` to `PostMeta`, exposed `tldr` in `getAllPosts`; `getPostBySlug` exposes them automatically via frontmatter spread.

### D2. Problem/Decision/Result = MDX body compact intro bands (Palette)

PDR is implemented as **section intro bands** (eyebrow label + left accent border) — not full-section wrapping, but a short band with a 1–2 sentence framing inserted before each section (user-confirmed style). The existing body stays unchanged (insertion only), so it's non-breaking and matches the Engineering Editorial tone. Color tones **reuse existing callout tokens** (Problem=warn amber · Decision=info cobalt · Result=success green) — zero new tailwind tokens, so the Palette→Herald token-registration order is unnecessary. Labels follow the `Callout` title pattern as per-locale inline (`<Problem label="문제">` / `<Problem label="Problem">`). `ResultCallout` is a DRY success-`Callout` preset wrapper.

### D3. Related ADRs = frontmatter `relatedAdrs` field, mirroring FeaturedAdrSection (user-confirmed)

Post ↔ ADR linking uses frontmatter `relatedAdrs: ["ADR-001", "sprint-82", ...]` (an AdrMeta.id array) (the tag auto-matching alternative was rejected — explicit and precise). `post-page.tsx` builds an id→AdrMeta map via `buildAdrIndex(getAllAdrs(locale))`, and cards mirror the Sprint 186 `FeaturedAdrSection` pattern (id badge·title·tldr·`buildUrl` link). Unresolved ids graceful-skip. The related-posts section is separate, via `getRelatedPosts` (same series +3, shared tag +1 score).

### D4. Scope = all 10 posts, with phased pacing (Oracle/user)

Target all 10 posts (KO+EN), but split pacing into **infra+pilot 1 post (Phase A/B) → remaining 9 posts (Phase C)**. This conflicts with `feedback-blog-workflow` (blog content per-post), but PDR application is **structural insertion, not body rewriting**, and the pilot locked the style first, so the user chose Phase C as **"fully delegate (report results only)."** That is, "after the pattern is locked, structural application can be bulk-delegated" — a signal confirmed this sprint.

## Implementation

### PR #327 (infra + pilot, 1 commit → squash, 10 files +344/-2)

- `a16ee50` feat — infra (types·components·post-page·i18n) + pilot orchestration-structure (KO+EN).

New files:
- `blog/src/components/blog/pdr.tsx` — `Problem`/`Decision`/`Result` compact intro bands (per-phase callout tokens).
- `blog/src/components/blog/result-callout.tsx` — `ResultCallout` (success `Callout` preset wrapper).
- `blog/src/components/post/related-adrs.tsx` — related ADRs section (`relatedAdrs`→`AdrMeta` cards, `buildUrl`).
- `blog/src/components/post/related-posts.tsx` — related posts section (`getRelatedPosts` result cards).

Modified files:
- `blog/src/lib/posts.ts` — added `PostMeta.tldr`·`relatedAdrs` + `getRelatedPosts` helper + `tldr` exposure in `getAllPosts`.
- `blog/src/components/post-page.tsx` — TL;DR block (brand left accent) + related ADRs/posts section wiring.
- `blog/src/components/mdx-components.tsx` — registered `Problem`/`Decision`/`Result`/`ResultCallout`.
- `blog/src/lib/i18n.ts` — `postTldrLabel`·`relatedAdrsTitle`·`relatedAdrsSubtitle`·`relatedPostsTitle` ko+en.
- `blog/content/posts/orchestration-structure.mdx`·`posts-en/...` — tldr·3 PDR bands·relatedAdrs (sprint-82/116/114).

### PR #328 (remaining 9 posts, 1 commit → squash, 18 files +244)

- `319a633` feat — bulk-applied tldr·PDR bands·relatedAdrs to 9 posts (KO+EN).

Applied posts + relatedAdrs mapping:
- agent-orchestration-solo-dev(sprint-82/116/117) · baekjoon-gone(sprint-95/97) · ci-refactoring-reference-to-reality(sprint-105/107/ADR-027) · cicd-ai-guardrails(ADR-027/028/sprint-105) · session-policy-sync(sprint-71/65) · sliding-window-agent-context(sprint-82/116) · sprint-journey(ADR-001/002/026, a retrospective so Problem+Result 2 bands) · system-architecture-overview(ADR-001/002/003) · toward-model-agnostic-harness(sprint-114/117/136).

## Critic cycle

`codex review --base main` — **0 findings on both PRs**. For Phase C, Codex ran its own verification scripts confirming every post's `tldr`+`relatedAdrs` validity and that all relatedAdrs ids resolve (0 missing).

## Verification

### Browser end-to-end (after blog build + static server, DOM/screenshot)
- **Pilot KO/EN** `/posts/orchestration-structure`·`/en/...`: TL;DR band (cobalt accent) · PDR bands (Problem amber/Decision cobalt/Result green) · 3 related-ADR cards+links · related-posts cards render correctly, 0 Korean residue in EN ✓.
- **Phase C spot-check** `/posts/cicd-ai-guardrails` (KO): TL;DR band + Problem band render identically to the pilot ✓.

### Local
- `tsc --noEmit` 0 errors · `npm run build` all routes statically prerendered (incl. KO/EN posts ×10).
- **Related-ADR card count matches expectation per post** (graceful-skip 0) · all relatedAdrs ids resolve to real ADRs.
- Blog gates no regression: i18n-residue(2.19%<8%) · blog-crosscheck(KR10/EN10 0 violations) · adr-links(1694 0 broken) · doc-refs(335 0 broken) · index-count(8/1/125) · en-coverage(134/134).

### CI
- PR #327 76 checks green · PR #328 SUCCESS 38/SKIP 11/NEUTRAL 1/FAILURE 0.

## Result

- **Merged**: origin/main → `a16ee50`(#327) → `319a633`(#328), both work branches deleted.
- **Net change**: 4 new files (components) + 6 modified (infra) + 20 content files (10 posts KO+EN). Infra +344/-2, content +244.
- **Phase 3 complete**: all 10 post details portfolio-ized with TL;DR + PDR + related ADRs/posts.
- ADR sprint-187 (KR+EN) + README sprint ADR count updated (this /stop commit).

## New patterns

- **Structural content transformation paces as "infra+pilot → bulk delegation"**: even content work, if (1) it's structural insertion rather than body rewriting and (2) a pilot has locked the style/pattern, is more efficient to bulk-delegate without per-post review. `feedback-blog-workflow` (per-post review) applies to **tone/frame rewriting**, whereas **post-lock structural insertion** suits bulk delegation — distinguish the two modes.
- **Related ADRs via frontmatter id reference + build-time meta lookup**: storing post↔ADR links as frontmatter `relatedAdrs` (AdrMeta.id) and looking up title/tldr at build time + graceful skip means no drift on ADR edits and a bad id won't break the build (Sprint 186 curation pattern carried to the per-post level).

## Lessons

- **Applying content over verified components carries low regression risk — focus verification on card resolution count**: Phase C had zero new code (reusing verified components), so visual regression risk was low; the real verification value was "do all relatedAdrs resolve to real ADRs" (since graceful-skip hides defects). Auto-comparing per-post card count = expected id count in the build output caught omissions.
- **Phase 1/2 foundation accelerates Phase 3 too (3rd consecutive proof)**: thanks to Engineering Editorial tokens·`AdrMeta`/`buildUrl`·i18n structure, Phase 3 infra was done by reusing callout tokens + mirroring FeaturedAdrSection, with 0 new tokens. "Foundation first" proved out with 0 rework in Phase 3, following Phase 2 (Sprint 186).

## Carryover (Sprint 188+)

- **Phase 4 (next — Sprint 188)**: About page + Footer links — **personal URL required** (awaiting user input at kickoff).
- **Phase 5**: ADR graph description/legend/filter · category 7-class expansion (requires post re-classification) · ADR topic auto-classification (Security·Product subdivision) · search/auto collections.
- **Existing seed remnants**: H3-only PR table extraction (sprint-135/143/146) · `sprint-87-plan.md` relocate/remove · accumulated UAT (Programmers re-submission grading · English Grafana CB dashboard) · follow-ups (remove coverage-gate skipped allowance · `(adr)` layout split · prom-client Case B~D · `.claude-tools/` Phase 2 removal · doc-refs bare-path expansion).
