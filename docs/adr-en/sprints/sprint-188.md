---
sprint: 188
title: "Blog UI/UX revamp — About page + Footer componentization (Phase 4)"
date: "2026-05-21"
status: completed
agents: [Oracle, Palette, Herald, Critic, Scribe]
related_adrs: ["sprint-187", "sprint-186", "sprint-185"]
related_memory: ["sprint-window", "feedback-blog-workflow"]
---
# Sprint 188 — Blog UI/UX revamp — About page + Footer componentization (Phase 4)

## Goal

- **Phase 4** of the 5-phase revamp (user `/goal` plan) that turns the tech blog into a "portfolio-style" one. Add an About page and tidy up the Footer to create an entry point for "the person who built this blog/service".
- Let first-time visitors and recruiters move naturally from posts/ADRs to "who built this" (About page + a Footer link on every page).
- Existing routes stay **non-destructive**. KO+EN simultaneously. Work on top of the Phase 1 (Sprint 185) Engineering Editorial design system.

## Decisions

### D1. External links SSOT = `site-content.ts` constants + About skills as group data (user-confirmed input)

External links shown on About/Footer live as constants in `site-content.ts` — `GITHUB_URL = 'https://github.com/tpals0409'` (profile; user switched repo → profile), and the existing `ALGOSU_SERVICE_URL` is reused. About core skills live as an `ABOUT_SKILL_GROUPS` (5 groups) structure where **only the group labels are i18n keys** (Backend/AI & LLM/Infrastructure/Data/Frontend) and **the skill names (FastAPI·NestJS·k3s, etc.) are plain arrays** because they are product/framework proper nouns (not translation targets). This inherits the Sprint 185/186 philosophy: "structural data in the site-content SSOT, display text in i18n".

### D2. Footer componentization = pathname-based locale resolution (Palette)

The `<footer>AlgoSu Team</footer>` previously duplicated inline across the `(ko)`/`en`/`(adr)` layouts is extracted into a single `Footer` component. The `(adr)` layout **shares** ko/en routes (one server layout serves both locales, like `AdrHeader`), so locale cannot be passed statically as a prop → it is implemented as a **client component that resolves locale via `usePathname()`**, exactly like `AdrHeader`/`LocaleToggle`. All three layouts render just `<Footer />` with no prop (DRY). During static export (SSG) the pathname is fixed per route prerender, so the Footer text/links are baked into the SSR HTML per locale correctly.

### D3. About page = concise form (user-confirmed)

About is the **concise form** (self-intro + core skills + external links, no profile image). Content is written referencing the user's portfolio (portfolio.leo0409.work): name 김세민/Semin Kim, role Agentic AI Engineer & Builder, tagline "Not an observer, but a doer", a 2-paragraph intro, and 5 core-skill groups. Components reuse home patterns (`HomeHero` CTA·`FOCUS_RING`, `MetricGrid` card grid) — `AboutHero` + `SkillGroups` + a composing `AboutPage` (home-page.tsx pattern) + 2 thin entries.

### D4. ADR/README as a separate docs PR at /stop (convention)

The implementation (About/Footer) ships as a feature PR, while the sprint-188 ADR (KR+EN) + README count update ship as a **separate `docs(adr)` PR at /stop**. Same pattern as Sprint 186 (#326) and 187 (#329) — the ADR records a merged sprint, so writing it before merge is premature.

## Implementation

### PR #330 (About + Footer, 1 commit → squash, 12 files +370/-9)

- `e40bc45` feat — About page + Footer componentization + Header nav + SSOT extension.

New files:
- `blog/src/components/footer.tsx` — shared Footer (client, pathname locale resolution). Brand+copyright + nav (Blog/ADR/About) + external links (GitHub/service).
- `blog/src/components/about-page.tsx` — About composition (AboutHero → SkillGroups).
- `blog/src/components/about/about-hero.tsx` — name·role badge·tagline·2-paragraph intro + external link CTAs.
- `blog/src/components/about/skill-groups.tsx` — 5 core-skill group cards (group labels i18n + skill tags).
- `blog/src/app/(ko)/about/page.tsx`·`en/about/page.tsx` — thin entries (with metadata).

Modified files:
- `blog/src/lib/site-content.ts` — `GITHUB_URL` constant + `ABOUT_SKILL_GROUPS` (5 groups) +48.
- `blog/src/lib/i18n.ts` — About/Footer/nav keys ko+en (navAbout·aboutName·aboutRole·aboutTagline·aboutIntro1/2·aboutSkillsTitle·5 group labels·aboutCtaGithub·footerCopyright·footerService).
- `blog/src/app/(ko)/layout.tsx`·`en/layout.tsx`·`(adr)/layout.tsx` — inline `<footer>` → `<Footer />`.
- `blog/src/components/header.tsx` — About nav link (next to ADR, navAbout).

## Critic cycle

`codex review --base main` — **0 findings**. "No discrete correctness issues were found in the changes. The new About pages, navigation links, shared footer, and i18n additions are consistent with the existing routing and type checks."

## Verification

### Browser end-to-end (blog build → static server + DOM/accessibility tree)
- **KO** `/about`: role badge·name (김세민)·tagline·2-paragraph intro · GitHub profile/AlgoSu service CTA · 5 core-skill groups (all skill tags) render correctly. Header About link·GitHub profile href `github.com/tpals0409` (profile correct) ✓.
- **EN** `/en/about`: Semin Kim · "Not an observer, but a doer" · English intro · GitHub Profile/Visit AlgoSu · Core Skills, **zero Korean residue** ✓. Header/footer nav all `/en`-prefixed ✓.
- **Footer regression**: across home (`/`·`/en`) and ADR (`/adr`·`/en/adr`) 4 routes, copyright locale is correct (© 2026 김세민 / Semin Kim), old "AlgoSu Team" residue **0** ✓.

### Local
- `tsc --noEmit` 0 errors · `npm run build` all routes static prerender (`/about`·`/en/about` newly generated).
- Blog/ADR gates no regression: i18n-residue (2.19%<8%) · doc-refs (337 0 broken) · adr-links (1851 0 broken) · index-count (8/1/126) · en-coverage (135/135) · blog-crosscheck (KR10/EN10 0 violations) · adr-conversion (10/10).

### CI
- PR #330 — **37 checks pass / 0 fail** (Build Blog SSG·Coverage Gate·E2E Programmers all SUCCESS, E2E Integration SKIP).

## Result

- **Merge**: origin/main → `e40bc45` (#330), work branch deleted.
- **Net change**: 6 new files (Footer·About 4·thin entry 2) + 6 modified files (layout 3·header·i18n·site-content). +370/-9.
- **Phase 4 complete**: an About page (KO/EN) + a site-wide shared Footer (brand·nav·external links·copyright) establish the "who built this" entry point.
- sprint-188 ADR (KR+EN) + README sprint ADR count 126→127·range 62~188 (this /stop commit).

## New patterns

- **Locale-dependent components in a shared layout unify via pathname resolution**: when a single server layout (like `(adr)`) serves both ko/en locales, locale cannot be passed as a static prop. Resolving via `usePathname()` in a client component lets every layout reuse the same component without a prop, and SSG prerender fixes each route's pathname so locale-specific text/links are baked into the SSR HTML (extends the `AdrHeader`/`LocaleToggle` pattern to the Footer).
- **Proper-noun data is separated from i18n**: tech stack (FastAPI·k3s, etc.) and brand names (GitHub) are not translation targets, so they live as site-content plain arrays/literals rather than i18n keys. Keeping only "classification text" like group labels in i18n prevents the dictionary from bloating and keeps the residue gate unaffected.

## Lessons

- **Removing inline duplication hinges on extraction + exhaustive regression check**: when extracting a footer scattered across 3 layouts into a single component, the real verification value was "do all consumers (home/post/ADR × ko/en) render identically/better with no regression after extraction". An automated cross-check on the static output — zero old-text ("AlgoSu Team") residue + correct copyright locale per route via grep — blocked omissions.
- **The Phase 1 foundation accelerates Phase 4 too (4 in a row)**: thanks to the Engineering Editorial tokens·home component patterns (CTA·card grid·FOCUS_RING)·i18n/site-content SSOT, About/Footer finished with zero new tokens. "Foundation first" proved itself with zero rework across Phases 2–4.

## Carryover (Sprint 189+)

- **Phase 5 (next — Sprint 189)**: ADR graph captions/legend/filter · category 7-class expansion (post re-classification) · ADR topic auto-classification (Security·Product refinement) · search/auto-collections.
- **Existing seed remnants**: H3-only PR-table extraction (sprint-135/143/146) · `sprint-87-plan.md` relocate/removal · accumulated UAT (Programmers re-submission grading·English Grafana CB dashboard) · follow-ups (remove coverage-gate skipped allowance·`(adr)` layout split·prom-client Case B–D·`.claude-tools/` Phase 2 deletion·doc-refs bare-path expansion).
