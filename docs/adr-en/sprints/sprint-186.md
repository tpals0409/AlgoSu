---
sprint: 186
title: "Blog UI/UX revamp — /adr curated landing + /adr/archive split (Phase 2)"
date: "2026-05-21"
status: completed
agents: [Oracle, Palette, Architect, Herald, Critic, Scribe]
related_adrs: ["sprint-185", "sprint-163", "sprint-157"]
related_memory: ["sprint-window"]
---
# Sprint 186 — Blog UI/UX revamp — /adr curated landing + /adr/archive split (Phase 2)

## Goal

- **Phase 2** of the 5-phase revamp (user `/goal` plan) that turns the tech blog into a "portfolio-style" one. Convert the ADR main page (`/adr`) from a **full list dump into a curated entry point**.
- Let first-time visitors and recruiters avoid facing all 124 sprint ADRs at once, instead entering progressively through **featured ADRs → topic collections → graph → full archive** (plan §6).
- Existing ADRs/URLs are **non-deleting, non-breaking**. The full list moves to `/adr/archive` while ADR detail URLs stay unchanged. KO+EN simultaneously. Work builds on the Engineering Editorial design system laid down in Phase 1 (Sprint 185).

## Decision

### D1. Make `/adr` a curated landing; relocate the full list to `/adr/archive` without breakage (Architect)

The old `/adr` had `AdrIndexView` list every ADR chronologically — 124 sprint ADRs + 8 permanent + 1 topic dumped on the first screen, so first-time visitors couldn't tell where to start. Replace `/adr` with a **curated landing** (`AdrLandingView`) and **relocate the existing full-list component (`AdrIndexView`) to `/adr/archive` as-is**.

- ADR detail URLs (`/adr/sprints/{n}`·`/adr/{slug}`) stay unchanged → external links and search indexes unbroken.
- New `/adr/archive`·`/en/adr/archive` (existing list preserved). ADRs not reached from curation are still fully accessible in the archive.
- Both KO/EN are placed under the `(adr)` route group with identical structure.

### D2. Curation is a static config SSOT — referenced by AdrMeta.id (Palette/Architect)

Since this is a static-export environment, curation data is collected in Phase 1's `site-content.ts` (inheriting the home curation SSOT pattern). ADR references use **AdrMeta.id** (permanent: `ADR-001`, sprint: `sprint-130`, topic: slug), and titles/one-line summaries are looked up from `AdrMeta` (title/tldr) — the config only holds the "why read this" as an i18n key. Display text is referenced only via i18n DICTIONARY keys for simultaneous ko/en localization (a missing key is a TS compile error).

- **`FEATURED_ADRS`** (5, user-confirmed): `ADR-001`·`ADR-002`·`ADR-026`·`ADR-027`·`ADR-028` — each with a `whyKey`.
- **`ADR_TOPICS`** (4 topics, user-confirmed): operations·agents·cicd·data — each member is an `adrIds` array (permanent/sprint/topic may mix).
- **`ADR_READING_STEPS`** (4 steps): problem → options → decision → verification frame.

### D3. Featured 5 ADRs / 4 topics user-confirmed (Oracle/user)

The user confirmed the 5 featured ADRs proposed as candidates in the plan.

- **Featured 5 ADRs**: ADR-001 (Gateway→Identity DB separation)·ADR-002 (Outbox)·ADR-026 (Sprint 130 incident: stuck rollouts + SealedSecrets)·ADR-027 (Aether GitOps branch discipline)·ADR-028 (Dev cluster separation) — core decisions in AlgoSu's system evolution.
- **4 topics**: operations · agents · cicd (CI·GitOps) · data. **Security·Product subdivision and automatic classification are deferred to Phase 5** (this stage prioritizes a static curated list).

## Implementation

### PR #325 (single work branch, 1 commit → squash, 11 files +551/-15)

- `ca8a085` feat — ADR curated landing + `/adr/archive` split + curation config·i18n·5 components.

New files:
- `blog/src/components/adr/adr-landing-hero.tsx` — ADR Hero + "how to read an ADR" 4 steps (problem→options→decision→verification).
- `blog/src/components/adr/featured-adr-section.tsx` — featured 5 ADR cards (title·tldr·why-read·tags, looked up from `AdrMeta`).
- `blog/src/components/adr/adr-topic-collections.tsx` — 4-topic collections (member ADR id references).
- `blog/src/components/adr/adr-graph-cta.tsx` — graph entry card (legend/description in P5; this round, an entry CTA).
- `blog/src/components/adr/adr-landing-view.tsx` — landing assembly (Hero→Featured→Topics→Graph CTA→Archive link).
- `blog/src/app/(adr)/adr/archive/page.tsx`·`blog/src/app/(adr)/en/adr/archive/page.tsx` — relocated full-list (`AdrIndexView`) routes.

Modified files:
- `blog/src/app/(adr)/adr/page.tsx`·`blog/src/app/(adr)/en/adr/page.tsx` — `AdrIndexView` → `AdrLandingView` swap.
- `blog/src/lib/site-content.ts` — `FEATURED_ADRS`(5)·`ADR_TOPICS`(4)·`ADR_READING_STEPS`(4) + interfaces (+95/-3).
- `blog/src/lib/i18n.ts` — ADR landing keys added as ko+en pairs (Hero·4 reading steps·5 featured why·4 topic title/desc).

The curation components reuse Phase 1's Engineering Editorial tokens and the existing `AdrCard`·`buildUrl`, so the new surfaces inherit design consistency automatically.

## Critic cycle

`codex review --base main` run. (Green at PR #325 merge time — Critic passed.)

## Verification

### curl end-to-end (after blog build, static server + DOM check)
- **KO `/adr`**: curated landing (Hero·4 reading steps·5 featured ADRs·4 topic collections·graph CTA·archive link) ✓ · topic member ADRs link correctly ✓.
- **KO `/adr/archive`**: existing full list (`AdrIndexView`) renders without breakage ✓ · ADR detail URLs unchanged ✓.
- **EN `/en/adr`·`/en/adr/archive`**: fully English, zero Korean residue ✓.
- **No regression**: existing ADR detail·home·post routes 200, design consistent (Engineering Editorial tokens).

### Local
- `tsc --noEmit` 0 errors · `npm run build` all routes static prerender (`/adr`·`/adr/archive`·`/en/adr`·`/en/adr/archive` included).
- Blog gates no regression: adr-links (KO/EN 0 broken) · index-count · en-coverage (133/133) · adr-conversion (10/10) · i18n-residue (2.19%<8%) · doc-refs (0 broken) · blog-crosscheck (0 violations).

### CI
- Work PR #325 all checks green (Build Blog included), zero non-success checks.

## Result

- **Merge**: origin/main → `ca8a085` (PR #325 squash merge, work branch deleted).
- **Net change**: 7 new files (5 components + 2 KO/EN archive routes), 4 modified. +551/-15.
- ADR sprint-186 (KR+EN) + README sprint ADR count 124→125·range 62~186 (this /stop commit).

## New patterns

- **Non-breaking information restructure — curation for entry, archive for exhaustive access**: as content accumulates (124 ADRs), a full list becomes an entry barrier for first-time visitors. Swapping the main route to a curated landing while relocating the existing full-list component to a separate route (`/adr/archive`) improves the new-user experience while preserving detail URLs and exhaustive access (URLs unchanged → external links and search indexes unbroken).
- **Curation as a static config referencing AdrMeta.id — display data looked up from meta**: duplicating titles/summaries into the curation config drifts when the source ADR is edited. Keeping only **id + why-read (i18n)** in the config and looking up title/tldr from `AdrMeta` at build time maintains a single source of truth (inherits Sprint 185's `getAllAdrs().length` dynamic-injection pattern).

## Lessons

- **In a multi-sprint revamp, the Phase 1 foundation accelerates Phase 2**: because Phase 1 laid down the design tokens, the `site-content.ts` curation SSOT, and the i18n structure, Phase 2 was reduced to adding new curation data to the same config and reusing existing tokens·`AdrCard`·`buildUrl`. "Foundation first" (Sprint 185 lesson) proved out as zero rework in the actual follow-on phase.
- **Shared components and route groups keep KO+EN simultaneous**: placing KO/EN routes under the `(adr)` route group with identical structure and referencing display text only via i18n keys means a single landing implementation + ko/en keys completes both locales at once (inherits the Sprint 185 home pattern). New display text must be ko+en pairs from the start (a TS compile error is the guard).

## Carryover (Sprint 187+)

- **Phase 3 (next — Sprint 187)**: post detail — TL;DR·Problem/Decision/Result (MDX body)·ResultCallout·related ADR/post sections.
- **Phase 4**: About page + Footer links (personal URL needed).
- **Phase 5**: ADR graph description/legend/filter · category 7-way expansion (post reclassification needed) · ADR topic automatic classification (Security·Product subdivision) · search/automatic collections review.
- **Existing seed remnants**: H3-only PR table extraction (sprint-135/143/146) · `sprint-87-plan.md` relocate/remove · accumulated UAT (Programmers resubmission grading·EN Grafana CB dashboard) · follow-ups (coverage-gate skipped allowance removal·`(adr)` layout split·prom-client Case B–D·`.claude-tools/` Phase 2 deletion·doc-refs bare-path expansion).
