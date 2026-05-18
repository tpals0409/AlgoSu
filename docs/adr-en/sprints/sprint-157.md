---
sprint: 157
title: "ADR md → Human-Friendly HTML Dual Output Automation (blog integration + KR/EN UI + content i18n infra)"
date: "2026-05-18"
status: completed
agents: [Oracle, Architect, Scribe]
related_adrs: ["sprint-152", "sprint-155", "sprint-156"]
related_memory: ["sprint-window"]
---
# Sprint 157 — ADR md → Human-Friendly HTML Dual Output Automation

## Goals

- Keep ADR md files as LLM-friendly SSOT while automatically generating an HTML site that lets humans quickly grasp decision flow, impact, and context
- 105 ADRs (8 permanent + 1 topic + 96 sprint) authored once → automatically converted via blog `(adr)` routing group with visualization + search + Related ADR graph
- Establish Sprint 152 seed #19 (KR/EN dual-language plan mandate) — UI i18n routing + content i18n infrastructure + `/stop` workflow obligation

## Decisions

- **Build model**: Integrate into blog/ Next.js 15 + MDX infrastructure as `(adr)` routing group (user-confirmed). Reuse single Docker image + nginx + k3s GitOps cycle — 0 new workflow files. `ci.yml:132-134`'s `blog` paths filter already includes `docs/adr/**`
- **Scope**: Extended (conversion + visualization + search + categories full package) — user-confirmed
- **PR bundling**: 4 PRs integrated in a single sprint (P1 / P2~P8 / P9 / P10) — inheriting Sprint 150/153/154 bundle pattern. Avoids inefficiency of 8 sequential PR merges with CI wait
- **i18n dimension 1 (UI)**: User direct feedback ("ADR doesn't seem to work for both English and Korean") → P9 hotfix added immediately. Apply existing blog `(ko)/`+`en/` pattern to ADR. `/adr/` ↔ `/en/adr/` routing + LocaleToggle + 50 dictionary keys
- **i18n dimension 2 (Content)**: Explicit user requirement → P10 added. `docs/adr-en/` separate directory (blog `content/posts-en/` pattern) + loader locale extension + Claude API auto-translator + `/stop` workflow EN mandate

## Implementation (4 PRs squash merge, origin/main `9f1217a` → **`7d0fedf`**)

| PR | Phase | Owner | Changes | Lines |
|----|-------|-------|---------|-------|
| [#253](https://github.com/tpals0409/AlgoSu/pull/253) | P1 | architect | `blog/src/lib/adr/{types,loader,parser,section-aliases,index-builder,markdown,fixtures}.ts` 7 files + minisearch dependency | +1,139 |
| [#254](https://github.com/tpals0409/AlgoSu/pull/254) | P2~P8 | architect | `scripts/check-adr-{conversion,links}.mjs` + `(adr)/` 6 routing pages + 12 visualization components + minisearch search + mermaid Related ADR graph + ci.yml 2 steps | +3,620 |
| [#255](https://github.com/tpals0409/AlgoSu/pull/255) | P9 | architect | UI i18n: `/en/adr/` 6 routes + LocaleToggle integrated header + i18n dictionary ~50 keys + 12 components `locale` prop propagation + KoreanOnlyBanner | +926 −203 |
| [#256](https://github.com/tpals0409/AlgoSu/pull/256) | P10 | architect | Content i18n infra: `docs/adr-en/` + `getAllAdrs(locale)` extension + `hasEnTranslation` flag + `scripts/translate-adr.mjs` Claude API auto-translator + `/stop` workflow + Scribe persona EN mandate | +771 −44 |

## Verification

- **All 4 PRs CI fail 0, mergeStateStatus CLEAN ✅** (auto-merge flow)
- `npx tsc --noEmit` — 0 errors
- `npm run build` — **244 static pages** (KR 122 + EN 122, prior 31 → 244)
- `node scripts/check-adr-conversion.mjs` — 10 fixture pass + 105 ADRs parsed successfully
- `node scripts/check-adr-links.mjs blog/out/adr` — 1,109 links, **0 broken**
- `node scripts/check-adr-links.mjs blog/out/en/adr` — 1,213 links, **0 broken**
- `node scripts/check-doc-refs.mjs --include-untracked` — 172 files, **0 broken refs**
- `node scripts/check-adr-en-coverage.mjs --lint` — 105 WARN (strict activation deferred to Sprint 158+)
- Browser visual verification: `/adr/` (index + timeline + cards) + `/adr/sprints/156/` (3-column TOC + body + meta sidebar + Related ADR mini-graph) + `/en/adr/` (English UI) + `/en/adr/sprints/156/` (KoreanOnlyBanner + Korean body)
- Sprint 155 3-layer safety net (plan + pre-push + CI lint) effective on all sprint commits — 0 violations

## Branch discipline ✅ 25 sprints consecutive compliance

All 4 PRs used new branches + Squash merge, 0 direct commits to main (since Sprint 134 violation).

## New patterns

1. **User direct feedback → immediate hotfix cycle (inheriting Sprint 150~152 pattern)** — UI i18n gap (P9), content i18n omission (P10) both addressed via separate PRs immediately. Plan-stage omissions recovered in real-time through user verification cycle
2. **Single sprint 4-PR bundle + auto-merge flow** — `gh pr merge --squash --auto` auto-merges on CI green. Avoids inefficiency of 8 sequential PR CI wait. Evolution of Sprint 150/153/154 bundle pattern
3. **External directory static import (blog → docs/adr)** — `path.resolve(process.cwd(), '..', 'docs', 'adr')` + explicit `outputFileTracingIncludes`. Verified pattern for safely referencing external SSOT in `output: 'export'` static export environment
4. **Fallback chain — no frontmatter + English section names** — gray-matter failure gracefully degrades to body H1/dash-list/H2 pattern. sprint-62~87 English section alias mapping handles 90+ sprint ADRs + 8 permanent ADRs in single pipeline
5. **`hasEnTranslation` flag + conditional KoreanOnlyBanner** — natural English page when EN translation exists, Korean body + banner + original link when absent. Seamlessly supports gradual translation migration
6. **Auto-translator infrastructure first → actual translation gradual** — `translate-adr.mjs` infrastructure complete + `/stop` mandate + lint (advisory) in this sprint. 95-file batch translation immediately possible upon user API key availability. Infrastructure-first separation
7. **`/stop` workflow KR+EN dual-write mandate self-bootstrap** — Rule introduced this sprint (P10) immediately self-applied to this sprint's ADR creation. Meta-self-verification cycle (inheriting Sprint 154~155 pattern)

## Lessons

1. **Plan-stage i18n omissions are only recovered via user verification cycle** — Sprint 152 seed #19 (KR/EN dual mandate) again omitted in this sprint's plan stage. User direct feedback ("Ko/En buttons exist") triggered P9/P10 hotfix. Need to automate seed #19 as plan template checklist item (Sprint 158 candidate)
2. **UI i18n and content i18n are separate efforts** — P9 alone shows English pages, but Korean body limits utility. Must include content infrastructure (P10) for completeness. Both dimensions must be addressed simultaneously in plan stage
3. **Don't create `(adr)/page.tsx` inside `(adr)` route group** — conflicts with existing `(ko)`'s `/` route. Route groups don't affect URL, so registering same root path causes build failure. Only `/adr/...` subroutes are safe
4. **Mermaid code fences require pre-renderMdx transformation** — ADR body ```` ```mermaid ... ``` ```` must be pre-replaced with `<Mermaid chart={String.raw\`...\`} />` JSX. To work with compileMDX(`format: 'md'`), mermaid code blocks render as code blocks and graphs are separated into components
5. **Forbid placeholder API key when ANTHROPIC_API_KEY missing** — Verify env var → exit 2 + guidance only if missing. Pilot translation separated to user direct execution. Security + cost transparency achieved together
6. **CI paths filter reuse → 0 new workflow files** — `ci.yml:132-134`'s `blog` filter already includes `docs/adr/**`, so this sprint created 0 new workflow files. Existing infrastructure leveraged
7. **Browser visual verification is the last safety net** — tsc/lint/link integrity all passing doesn't catch visual regressions. Only after directly verifying index/detail/graph/English pages in browser was safety confirmed
8. **`outputFileTracingIncludes` + `output: 'export'` combo silently skips `out/` generation** — Sprint 157 P10 added `outputFileTracingIncludes`, but despite `next build` returning exit 0 + 239-page build log output, `out/` directory was generated 0 times. Surfaced as `ADR link integrity` step failure in CI only. After 4-PR auto-merge, **user direct feedback "CI all failed"** triggered post-merge hotfix (removed option from `next.config.ts`). Static export has no runtime file access, so trace include itself is unnecessary. Even on CI green, mandatory build artifact existence check (`ls out/`) required when adding new configuration — Sprint 158 candidate

## Sprint 158 carryover

- **User direct execution (after API key acquisition)**:
  - Pilot translate 10 ADRs — 8 permanent + 1 topic + sprint-156 (`node scripts/translate-adr.mjs --target <path>`)
  - After validation, batch translate remaining 95 via `--all`
- **New automation candidates**:
  - Seed #24: Auto-insert i18n dual-language mandate checklist into plan template (automate Sprint 152 seed #19 at plan stage)
  - Seed #25: Activate `check-adr-en-coverage.mjs --strict` as CI hard gate (currently advisory)
  - Seed #26: `docs/adr/README.md` paths filter negation (block unnecessary blog builds)
- **UAT user direct (14 sprints accumulated)**:
  - Seed #5: Programmers re-submission grading verification
  - Seed #9: English environment + production Grafana CB dashboard ai-analysis visual consistency
- **Carryover maintained**:
  - Seed #18: Pre-merge domain fact cross-check automation for blog posts
  - Seed #23: Plan template "rebase post cumulative count fix" checklist (Sprint 156)
- **Follow-up (optional)**:
  - create/edit page.tsx category UI
  - Programmers URL auto-category inference
  - Backfill existing SQL problem data
  - Remove `skipped` allowance from coverage-gate (Sprint 156 Phase B option B)
  - Post-merge pre-deploy gate (Sprint 156 Phase B option C)
  - prom-client Case B~D check automation
  - `.claude-tools/` Phase 2 actual deletion (after trigger path verification)

## Related documents

- [docs/adr/README.md](../../adr/README.md) — English directory guidance + auto-translator usage added
- [docs/adr-en/README.md](../README.md) — English translation policy SSOT
- [scripts/translate-adr.mjs](../../../scripts/translate-adr.mjs) — Claude API auto-translator
- [scripts/check-adr-conversion.mjs](../../../scripts/check-adr-conversion.mjs) — 10 fixture self-test
- [scripts/check-adr-links.mjs](../../../scripts/check-adr-links.mjs) — Build output link integrity
- [scripts/check-adr-en-coverage.mjs](../../../scripts/check-adr-en-coverage.mjs) — EN translation coverage lint
- [sprint-152.md](./sprint-152.md) — Seed #19 (KR/EN dual mandate) established this sprint
- [sprint-156.md](./sprint-156.md) — Previous sprint, this sprint's starting point (`9f1217a`)
