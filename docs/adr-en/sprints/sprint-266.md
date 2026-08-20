---
sprint: 266
title: "Blog Page UI/UX Overhaul (Signal Grid Redesign + Tech-Blog Layout)"
date: "2026-08-14"
status: completed
agents: [Oracle, Palette, Critic]
related_adrs: ["sprint-265", "sprint-264", "sprint-263"]
related_memory: ["sprint-window"]
topics: ["frontend", "ui", "ux", "blog", "design-tokens", "layout", "wcag"]
tldr: "Overhauled the standalone Next.js app `blog/` at the repo root along two tracks. #532 `c5ac77d9`: full UI/UX redesign in the 'Signal Grid' design language — design tokens redefined by swapping values while keeping keys, so 60 components inherit the new look automatically; chart colors de-hardcoded into 21 `--chart-series-*`/`--chart-state-*` CSS variables; WCAG AA contrast 4.5:1+ preserved; `next build` 471/471 pages. #533 `596adeb2`: re-architected only the layout skeleton into a tech-blog shape while leaving the color/token SSOT (`globals.css`/`tailwind.config`) unchanged — a 3-zone shell of left persistent sidebar + center reading column + right sticky TOC (Stripe/Vercel docs), home switched from a portfolio vertical stack to a text index (Overreacted), wide reading column (Josh Comeau). The Critic caught a 404 (P2) where the sidebar nav linked to ADR topics/permanent index pages that didn't exist → resolved by adding those index pages in `4b425b51`. Total 54 files, +868/-332. No carryover."
---
# Sprint 266 — Blog Page UI/UX Overhaul

_Date: 2026-08-14_

## Goal

Overhaul the standalone Next.js app `blog/` at the repo root (the public tech-blog + ADR archive site). Target pages: Home (ko/en), About, Posts (MDX), and the ADR sections (landing/sprints/topics/permanent/archive). Split the overhaul into two tracks — **color/tokens (redesign)** and **layout skeleton (structure)** — each shipped as an independent, separately verifiable PR.

## Decisions

### D1. Redesign = swap token values, keep keys → automatic propagation to every page (#532)

Fully redesign in the "Signal Grid" design language, but **keep the design-token keys and only swap their values**. Preserving the key contract of the SSOT (`blog/src/app/globals.css` CSS variables + `blog/tailwind.config.ts` mapping) lets the 60 components that inherit them pick up the new colors/spacing/typography with no code changes. Delivered in 3 waves — foundation (token redefinition + global shell) → precise component application (29 files) → data-visuals.

### D2. Chart colors = de-hardcode → promote to 21 `--chart-*` tokens (#532 Wave 3)

Remove hardcoded colors from charts/data-visuals and promote them to **21 CSS variables** in the `--chart-series-*` (series colors) and `--chart-state-*` (state colors) families. Unifying the color SSOT into the token layer makes charts respond to light/dark and theme switches too (preventing hardcoded-color regressions).

### D3. Layout = tech-blog 3-zone shell, color/token SSOT unchanged (#533)

Replace the layout skeleton with a tech-blog shape while keeping the **color/token SSOT (`globals.css`/`tailwind.config`) unchanged** and re-architecting only structure. Reference integration — a **3-zone shell** of left persistent sidebar + center content + right sticky TOC (Stripe/Vercel docs), and a wide reading column with spacing rhythm (Josh Comeau). Sidebar is fixed on desktop, a drawer fallback on mobile.

### D4. Home = portfolio vertical stack → text index (#533 Wave L2)

Switch Home from a portfolio-style vertical card stack to a **text index** (compact hero + date/title text post list + ADR entry point), per the Overreacted reference. Sharpen the hero with a point-of-view title and a trust metaline (last updated + ADR count), and tone service CTAs down to text links.

## Implementation

- **#532 `c5ac77d9`** — full UI/UX redesign (Signal Grid):
  - Wave 1 foundation `c37cc400` — full token redefinition (value swap, keys kept) + global shell (header/footer/home-hero)
  - Wave 2 components `1aa6f45e` — precise application across 29 files (home/about·adr·post/blog), SSOT unchanged
  - Wave 3 data-visuals `d32cceaf` — remove hardcoded chart colors → 21 new `--chart-series-*`/`--chart-state-*` tokens
- **#533 `596adeb2`** — full layout overhaul (tech-blog skeleton):
  - Wave L1 `e72fcce2` — left persistent sidebar 3-zone shell (fixed on desktop / drawer on mobile)
  - feedback `e8aa6145` — remove the home StartHere ("start here if you're new") section + clean up the chained dead code (component, data, i18n, the dead `#start-here` CTA)
  - Wave L2 `21cb56cc` — home portfolio stack → text index
  - hero sharpening `321fa778` — POV title, trust metaline, toned-down CTAs
  - Wave L3 `4200bde1` — post detail: center reading column + right sticky TOC (auto H2/H3, scroll highlight), home/About widths unchanged
  - Critic P2 fix `4b425b51` — add the ADR topics/permanent index pages the sidebar links to (404 resolved)

**Scale (physical facts)**: `blog/` 54 files changed, +868/-332 (`e708ff47..596adeb2`).

**Verification (physical facts)**: `next build` **EXIT 0** — #532 471/471 pages across 3 per-wave runs, #533 470 HTML generated cleanly. WCAG AA contrast 4.5:1+ preserved. Token keys kept → 60 components' CSS-variable inheritance intact. Color/token SSOT diff confirmed unchanged (#533). Critic re-review CLEAN (P2 gone). Both PRs squash-merged into origin/main (`c5ac77d9`·`596adeb2`).

## Incidents

1. **Critic P2 — sidebar nav 404**: the new left sidebar linked to the ADR `topics`/`permanent` indexes, but those index pages didn't exist, so clicks 404'd. The Critic caught it → resolved by adding the index pages in `4b425b51` (a failure mode of not verifying, on the render path, that a nav link's target actually exists). Re-review CLEAN.
2. **StartHere chained dead code**: removing the home StartHere section nearly left its linked component, data, i18n strings, and the dead `#start-here` CTA anchor behind; all cleaned up together in `e8aa6145` (clean the whole reference chain when removing a feature).
3. **Proactive TOC anchor consistency (B2 failure-mode scan)**: if the sticky TOC's slugs diverge from the heading anchors `rehype-slug` generates, the TOC links break — verified slug ↔ rehype-slug agreement before build and fixed it proactively.

## Carryover

- None. (Both blog PRs merged and verified. The same-window dependabot PRs #530·#534 are handled by the standing auto-merge infra and out of sprint scope.)

## Lessons

- **Design tokens propagate to every page without breakage when you keep the keys and only swap the values.** Preserving the SSOT key contract let us redesign 60 components without editing them individually. Treat token-key changes as a last resort during a redesign; prefer value swaps first to localize the blast radius.
- **Sidebar/nav links must have their target's existence verified on the render path.** Adding a link without creating the target index page 404s on click — on a static site this passes the build but blows up in runtime navigation. Confirm the target route exists whenever you add a path to the nav.
- **Ship color redesign and structural overhaul as separate PRs.** Splitting #532 (color/tokens) from #533 (layout) let #533 prove "color/token SSOT unchanged" by diff. Mixing both axes in one PR makes it hard for review to tell what actually changed.
