---
sprint: 185
title: "Blog home landing portfolio revamp + Engineering Editorial design system (Phase 1)"
date: "2026-05-21"
status: completed
agents: [Oracle, Palette, Herald, Architect, Critic, Scribe]
related_adrs: ["sprint-184", "sprint-179", "sprint-157"]
related_memory: ["sprint-window"]
---
# Sprint 185 — Blog home landing portfolio revamp + Engineering Editorial design system (Phase 1)

## Goal

- **Phase 1** of a 5-phase revamp (user `/goal` plan) that turns the tech blog from a "record-heavy archive" into a **portfolio-style tech blog where problem-solving and operational judgment are visible**. This sprint builds the **home landing redesign + visual-reskin design-system foundation** in KO+EN simultaneously.
- Let first-time visitors and recruiters grasp, on the first screen, that AlgoSu is a live AI-agent service in production — and where to start reading. The core is raising the accessibility and persuasiveness of existing content, not adding content (plan §2).
- The visual reskin swaps the token SSOT, so it propagates to ADR/post pages too → **browser regression verification is mandatory** (Sprint 183–184 lessons).

## Decision

### D1. "Blog-native premium" design direction — separate from the main app (Palette)

Adopt a **separate, independent system** from the main app design (Primary `#715DA8` purple, Sora, Glassmorphism). The concept is "Engineering Editorial" — warm paper background + deep ink text + one restrained accent. Convey trust through typography, whitespace, and hierarchy rather than flashy animation (plan §14, "information structure first").

- **Neutrals (warm)**: bg `#FBFAF9` (paper) / surface-elevated `#FFFFFF` (card) / surface-muted `#F4F2EF` / text `#17161A` (warm ink) / text-muted `#57545E` / text-subtle `#8A8693` / border `#E7E3DD`.
- **Accent Cobalt**: brand `#2347E6` / strong `#1B37B8` (text·hover, AA 6.5:1) / soft `#EEF1FE` (badge·pill). Distinct from current indigo `#6366f1` and the main app purple. accent-1 aligned to cobalt too (diagram palette consistency).
- **Typography**: Space Grotesk (heading) / Inter + Noto Sans KR (body) / JetBrains Mono (mono) — all introduced cleanly via `next/font/google` (previously system fonts).
- **Shape**: card radius 16px (`rounded-card`), two-tier warm soft shadows (`shadow-soft`/`shadow-lift`).
- The blog is light-fixed, so Phase 1 is light-first; the token structure is kept dark-extendable.

### D2. Swap tokens via CSS-variable SSOT → auto-propagate across all surfaces (Herald)

Following the no-hardcoded-color rule, the design change is performed in one place: `globals.css` CSS variables + `tailwind.config.ts` mapping. ADR/post components use semantic tokens (`bg-surface`/`text-text`/`text-brand`, etc.), so swapping the variables reskins them automatically → even though Phase 1 only builds the home anew, every surface gets a consistent reskin. `next/font` is exposed as CSS variables (`--font-heading`/`--font-sans`/`--font-sans-kr`/`--font-mono`) in the root `layout.tsx`.

### D3. Metrics·StartHere as a static curation SSOT + dynamic ADR count

In a static-export environment, curation is consolidated into one `site-content.ts` file (6 metrics · 4 StartHere slugs · service URL). Display text is referenced only by i18n keys for simultaneous ko/en localization (a missing key is a TS compile error). **Stale prevention**: the ADR count is injected at build time via `getAllAdrs().length` instead of hardcoding (cf. the stale i18n "105 ADRs" case) — guaranteeing the home and `/adr` show the same value (131).

## Implementation

### PR #323 (single work branch `feat/sprint-185-blog-redesign-phase1`, 1 commit → squash, 12 files +519/-68)

- `40df234` feat — design-system tokens/fonts + home landing components + curation config + i18n keys.

New files:
- `blog/src/lib/site-content.ts` — curation SSOT (`HOME_METRICS` 6, `START_HERE_POSTS` 4, `ALGOSU_SERVICE_URL`).
- `blog/src/components/home/home-hero.tsx` — badge + title + subcopy + 3 CTAs ([Start Here]→`#start-here` / [Browse ADRs] / [Visit AlgoSu]→`https://algo-su.com/`).
- `blog/src/components/home/metric-card.tsx` — `MetricCard` + `MetricGrid` (6 cards, 3-col/1-col mobile, dynamic ADR injection).
- `blog/src/components/home/start-here-section.tsx` — 4 recommended posts (meta looked up by slug) + one-line why-read. Not rendered if 0 resolve.
- `blog/src/components/home/adr-intro-card.tsx` — ADR entry card, `{n}` dynamic count.

Modified files:
- `blog/src/app/layout.tsx` — introduce 4 next/font families, expose CSS variables.
- `blog/src/app/globals.css` — swap token values to warm+cobalt, body/heading font-family, radius/shadow variables.
- `blog/tailwind.config.ts` — fontFamily (sans/heading/mono) + rounded-card + shadow-soft/lift, brand scale aligned to cobalt.
- `blog/src/lib/i18n.ts` — new Hero/metrics/StartHere/recent keys ko+en, `homeAdrCtaDescription` `{n}` dynamic template.
- `blog/src/components/home-page.tsx` — reassemble landing structure (Hero→metrics→StartHere→ADR→recent), `adrCount = getAllAdrs().length`.
- `blog/src/components/post-card.tsx`·`header.tsx` — rounded-card/shadow/heading-font polish.

`(ko)/page.tsx`·`en/page.tsx` share `HomePage` via a locale prop, so a single home reassembly reflects in both KO/EN.

## Critic cycle

`codex review --base main`, 1 round.

- **R1**: **0 findings** — "The changes are type-safe and the new home page components, i18n entries, Tailwind tokens, and route links appear consistent with the existing app structure. I did not identify a discrete regression introduced by this patch." Mergeable.

## Verification

### Browser end-to-end (blog build → static server → real DOM)
- **KO home (`/`)**: Hero (badge·title·subcopy·3 CTAs) ✓ · 6 metric cards (20+ Users·12 Agents·6 Microservices·23 CI Jobs·**dynamic ADR 131**·∞ Zero-downtime) ✓ · StartHere 4 cards (01–04, all titles+why resolved) ✓ · ADR intro ("131 ADRs", stale 105 resolved) ✓ · recent-posts tabs/cards ✓.
- **EN home (`/en/`)**: all strings English (A live AI-agent service / Start Here / Browse ADRs / Visit AlgoSu) ✓ · 0 Korean residue ✓.
- **No regression**: ADR index (total ADRs 131 = matches home metric, timeline·status badges fine) · post detail (heading font·warm-ink prose·cobalt inline-code/links·brand-soft blockquote) · ADR detail (TL;DR·meta sidebar·mini graph·callout) all render correctly with the new tokens.

### Local
- `tsc --noEmit` 0 errors · `npm run build` all routes statically prerendered (incl. `/`·`/en/`).
- 7 blog gates no-regression: adr-conversion (All passed) · doc-refs (331 files 0 broken) · en-coverage (132/132) · index-count (8/1/123) · i18n-residue (max 2.19%<8%) · blog-crosscheck (KR 10/EN 10, 0 violations) · adr-links (132 entries, 0 broken).

### CI
- Work PR #323 all checks green (incl. Build Blog·Coverage Gate·E2E Programmers), 0 non-success checks.

## Result

- **Merge**: origin/main → `6f69265` (PR #323 squash merge, work branch deleted).
- **Net change**: 5 new files (site-content + home/ 4), 7 modified. +519/-68.
- ADR sprint-185 (KR+EN) + README sprint ADR count 123→124·range 62~185 (separate ADR PR).

## New patterns

- **A semantic-token SSOT makes a reskin a one-point change**: when colors/fonts live in one place of CSS variables and every component uses semantic classes (`bg-surface`/`text-brand`), a full design swap ends at swapping variables and even untouched surfaces (ADR·posts) get consistent application. That's why building only the home in Phase 1 reskinned the whole site. But the propagation surface is wide, so even "surfaces you didn't change" require browser regression checks (inherits Sprint 184 "verify down to the output consumer").
- **Display numbers via build-time dynamic injection block stale**: recovers the case where the i18n "105 ADRs" hardcode diverged from the actual 123. Even in static export, computing from the SSOT (`getAllAdrs().length`) at build time keeps the home and `/adr` permanently in sync and makes future drift "impossible to occur".

## Lessons

- **A shared-component structure halves the cost of KO+EN parallel work**: when `(ko)/page`·`en/page` share `HomePage` via a locale prop and all text lives in the i18n dictionary, a single home reassembly + adding ko/en keys completes both locales at once. New display text must be added as ko+en pairs in the dictionary from the start (a missing key is guarded by a TS compile error); hardcoding strings into components creates EN-omission debt.
- **For multi-sprint revamps, "foundation first" is efficient**: laying the visual reskin (tokens/fonts) in Phase 1 means later phases (ADR·post detail·About) build new screens already on the new design system, with no rework. Bundling the design foundation with the first screen (home) in one sprint was reasonable.

## Carryover (Sprint 186+)

- **Phase 2 (next — Sprint 186)**: ADR accessibility — ADR Hero·5 featured ADRs·topic collections·`/adr/archive` split·graph CTA. Introduce a static curation config. KO+EN.
- **Phase 3**: post detail — TL;DR·Problem/Decision/Result (MDX body)·ResultCallout·related ADR/post sections.
- **Phase 4**: About page + Footer links (needs personal URLs).
- **Phase 5**: ADR graph description/legend/filter · category tab enhancement (current posts use journey/challenge 2-category → expanding to 7 needs post recategorization) · search/auto-collection review.
- **Existing seeds**: H3-only PR-table extraction (sprint-135/143/146) · `sprint-87-plan.md` relocate/remove · accumulated UAT (Programmers re-submission grading·English-env Grafana CB dashboard) · follow-ups (remove coverage-gate skipped allowance·`(adr)` layout split·prom-client Case B–D·`.claude-tools/` Phase 2 removal).
