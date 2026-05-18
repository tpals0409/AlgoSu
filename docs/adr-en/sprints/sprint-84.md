---
sprint: 84
title: "Blog English Version Addition + solved.ac 403 Incident Recovery"
date: "2026-04-14"
status: completed
agents: [Oracle, Conductor, Palette, Gatekeeper]
related_adrs: ["sprint-85"]
---

# Sprint 84: Blog English Version Addition

## Context

Added an English version to the technical blog (Docusaurus) for global accessibility. In parallel, a solved.ac Cloudflare blocking incident occurred requiring emergency response.

## Decisions

### D1: Docusaurus i18n — /en Path Locale Routing
- **Context**: Need to provide blog content in Korean (default) + English.
- **Decision**: Use Docusaurus built-in i18n plugin. Set `i18n.defaultLocale: 'ko'`, `locales: ['ko', 'en']`. English accessed via `/en` prefix.
- **Alternatives**: (a) Separate site deployment — dual management cost, rejected. (b) Conditional rendering in MDX — high authoring complexity, rejected.
- **Code Paths**: `blog/docusaurus.config.ts`, `blog/i18n/en/`

### D2: Enable trailingSlash — Resolving Static Export 403
- **Context**: `/en` path returning 403 Forbidden on GitHub Pages. Static export failing to generate `index.html` causes directory access failure.
- **Decision**: Set `trailingSlash: true` in `docusaurus.config.ts`. All paths generated as `/{path}/index.html` for static hosting compatibility.
- **Code Paths**: `blog/docusaurus.config.ts`

### D3: Remove Dark Mode Toggle — Fixed to Light Mode
- **Context**: Design tokens defined only for light mode. Some components don't meet contrast ratios when switching to dark mode.
- **Decision**: Set `colorMode.disableSwitch: true`, `respectPrefersColorScheme: false`. Fixed to single light mode theme.
- **Code Paths**: `blog/docusaurus.config.ts`

### D4: solved.ac 403 Incident Recovery (Details: sprint-85.md)
- Gateway proxy consolidation (Referer removal) + wget subprocess switch (Cloudflare JA3 bypass).
- Detailed decisions and lessons in [Sprint 85 ADR](./sprint-85.md).

### D5: Trivy HIGH Vulnerability Concurrent Patch
- CVE-2026-28390 (OpenSSL) — APK cache bust applied.
- GHSA-q4gf-8mx6-v5v3 (Next.js DoS) — 15.5.14 → 15.5.15 upgrade.

## Patterns

### P1: Docusaurus Static Export + GitHub Pages Requires trailingSlash
- **Where**: `blog/docusaurus.config.ts`
- **When to Reuse**: When deploying Docusaurus to GitHub Pages (static hosting). If subpaths return 403, check this setting first.

## Gotchas

### G1: Docusaurus i18n Locale Path and Static Hosting Compatibility
- **Symptom**: `/en` access returns 403 Forbidden.
- **Root Cause**: With `trailingSlash: false` (default), static export generates `/en.html`, but GitHub Pages interprets it as a directory and looks for `index.html`.
- **Fix**: Set `trailingSlash: true` to generate `/en/index.html`.

## Metrics
- Commits: 11 (0be3048..641b857)
- Blog i18n: 3 PRs (#86, #87, #88)
- solved.ac recovery: 5 commits (gateway proxy + wget switch + schema alignment)
- Security patches: 2 (Trivy + Next.js)
- Carryover items: None
