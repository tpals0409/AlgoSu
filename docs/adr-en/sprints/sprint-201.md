---
sprint: 201
title: "Remove Blog ADR Search (SearchBox/MiniSearch)"
date: "2026-05-22"
status: completed
agents: [Oracle, Herald, Critic]
related_adrs: ["sprint-193"]
related_memory: ["sprint-window"]
topics: ["blog", "frontend", "cleanup"]
tldr: "Completely removed the MiniSearch-based client-side full-text search (SearchBox) from the blog ADR site header. The search — introduced in Sprint 157 (minisearch dependency + build-time search-index.json generation) — is independent of ADR rendering (list/detail/archive/topics), so removal has no impact on other ADR display features. Before starting, grep separated search-only assets from shared assets — removed only search-only assets (minisearch dependency, search* i18n keys, SearchDoc type, AdrIndex.searchDocs dead field, toSearchDoc/toPlainText) while preserving shared assets (kind*/metaSprint i18n keys, buildUrl/groupByKind/mapBySprint/filterAdrsByTopic functions). The first PR #355 (d4660b0) cleaned up blog/ internals, but because the grep scope was limited to blog/, it missed that the root scripts/check-adr-links.mjs validates the (now-deleted) search-index.json existence (exit 2) → CI #355's Build Blog (SSG) job was actually a failure, but since that job is not a branch-protection required check, the squash merge proceeded and main was merged in a broken state. The /stop gate's local check-adr-links run caught it → a follow-up PR removed the search-index validation in check-adr-links.mjs + tidied the ci.yml paths-filter comment. tsc 0 · next lint 0/0 · build 329 pages (search-index.json not regenerated) · check-adr-links KR/EN exit 0 · doc-refs 363 0 broken · grep residue 0 · Critic (Codex) Critical/High 0."
---
# Sprint 201 — Remove Blog ADR Search (SearchBox/MiniSearch)

## Goal

- Completely remove the **MiniSearch-based client-side full-text search (SearchBox)** from the blog (`blog/`) ADR site header.
- Cleanly remove search-related code, build artifacts, dependencies, translation keys **and the CI gate that validated the search artifact**, while preserving the rest of the ADR site (list/detail/archive/topics rendering) and build/type/lint/link-integrity gate consistency.

## Background

- ADR search was introduced in Sprint 157 (`minisearch` dependency + `scripts/generate-search-index.mjs` building `public/adr/search-index.json` at build time → runtime fuzzy search via `fetch` + `MiniSearch`). It was a dropdown UI opened via the `/` keyboard shortcut, searching ADR titles, agent names, and body text.
- Search is **independent** of the ADR rendering pipeline (loader/parser → `buildAdrIndex` → list/detail/archive/topics views). SearchBox is mounted only in `AdrHeader` and fetches the search index (`search-index.json`) directly, so removing it has no impact on other ADR display features.
- Technical key: the `AdrIndex.searchDocs` field is produced by `buildAdrIndex` in `index-builder.ts`, but its consumers (`adr/page.tsx`·`archive/page.tsx`·`post-page.tsx`) all read only `.all`/`.byKind`/`.bySprint` and never read `.searchDocs` — it was effectively a **dead field**. Thus removal has zero runtime impact.

## Decisions

### D0. Search-only vs shared assets — separated up front via grep

- Getting the deletion scope wrong would break ADR rendering, so before starting, grep separated **assets used only by search** from **shared assets used by non-search components too**.
  - **Search-only (safe to delete)**: `minisearch` dependency, `searchPlaceholder`/`searchAriaLabel`/`searchEmpty` i18n keys (referenced only in SearchBox), `SearchDoc` type, `AdrIndex.searchDocs` field, `toSearchDoc`/`toPlainText` functions.
  - **Shared (must keep)**: `kindPermanent`/`kindTopic`/`kindSprint`/`metaSprint` i18n keys — also used in `adr-card`·`adr-category-tabs`·`sprint-timeline`·`adr-meta-sidebar`. `buildUrl`/`groupByKind`/`mapBySprint`/`filterAdrsByTopic` — still used by ADR rendering.

### D1. Full-deletion vs modification classification

- **Full deletion (3 files)**: `search-box.tsx` (search UI), `generate-search-index.mjs` (build script), `search-index.json` (artifact, `.gitignore`'d so removed from disk only).
- **Modification (5 files)**: `package.json` (prebuild hook + minisearch dependency), `adr-header.tsx` (SearchBox mount), `i18n.ts` (search* keys), `types.ts` (SearchDoc type + searchDocs field), `index-builder.ts` (search helpers + searchDocs return).

### D2. Remove minisearch dependency / prebuild hook together

- Search was the only minisearch consumer, so `dependencies.minisearch` is removed and the lockfile synced via `npm install`. The `scripts.prebuild` (index generation hook) is removed too → `search-index.json` is no longer regenerated at build time.

### D3. (Follow-up) Remove the CI gate that validated the search artifact — grep-scope miss correction

- The first pass's grep scope was limited to `blog/` (src·scripts·package.json), so it missed that the **root `scripts/check-adr-links.mjs`** sanity-checks the build artifact's `search-index.json` existence + entry count (exit 2 on missing).
- Since search-index.json is no longer generated, that gate always fails. So the search-index validation block in `check-adr-links.mjs` (header comments·runMain step 3·the `checkSearchIndex` function·export) is removed, leaving **only internal link integrity checks** (exit 0/1). The `generate-search-index.mjs` mention in the `ci.yml` paths-filter comment is also tidied.

## Implementation

### Pass 1 — Remove the search feature (1 commit, PR #355 squash → `d4660b0`)

- `689d0d6` chore(blog): remove ADR search (SearchBox/MiniSearch) (8 files, +4/-520)
  - **Deleted**: `blog/src/components/adr/search-box.tsx` (-265), `blog/scripts/generate-search-index.mjs` (-176), `blog/public/adr/search-index.json` (artifact, not a `git rm` target → `rm`).
  - **`package.json` / `package-lock.json`**: removed `prebuild` hook + `minisearch` dependency, synced lockfile via `npm install`.
  - **`adr-header.tsx`**: removed `SearchBox` import + `<SearchBox />` render, tidied `@related` comment (only Blog link·LocaleToggle remain).
  - **`i18n.ts`**: removed ko+en `searchPlaceholder`/`searchAriaLabel`/`searchEmpty`. Key type auto-derived as `DictKey = keyof typeof DICTIONARY['ko']` → no separate union edit needed. `kind*`/`metaSprint` preserved.
  - **`types.ts`**: removed `SearchDoc` interface + `AdrIndex.searchDocs` field.
  - **`index-builder.ts`**: removed `SearchDoc` import·`toSearchDoc`·`toPlainText`·`CODE_FENCE_RE`/`MD_SYMBOL_RE`, removed `searchDocs` from `buildAdrIndex` return. `buildUrl`/`groupByKind`/`mapBySprint`/`filterAdrsByTopic` preserved.

### Pass 2 — Clean up the CI gate (follow-up PR, caught by the /stop gate)

- `fix(ci): remove search-index validation from check-adr-links.mjs (Sprint 201 search removal follow-up)`
  - **`scripts/check-adr-links.mjs`**: removed the search-index sanity-check block + `checkSearchIndex` function + export + related header comments/exit 2. Performs only internal link integrity (exit 0/1). All imports remain used by surviving functions.
  - **`.github/workflows/ci.yml`**: tidied the `generate-search-index.mjs` mention in the blog paths-filter comment (kept `loader.ts(DIR_KIND_MAP)` + a Sprint 201 removal note).

## Verification

- **Type/build**: `tsc --noEmit` 0. `next lint` 0 errors / 0 warnings. `npm run build` — 329 static pages, ADR routes (KR/EN) OK, `search-index.json` not regenerated after prebuild removal.
- **Link integrity gate**: with the fixed `check-adr-links.mjs`, both KR (`blog/out/adr`) and EN (`blog/out/en/adr`) **exit 0** (151 HTML, ~1200 internal links all resolved, including the sprint-201 ADR). Right after pass 1 it was `[FAIL] search-index.json not found` (exit 2).
- **Other gates**: `check-doc-refs.mjs` 363 files 0 broken. `check-adr-index-count.mjs --strict` sprint 139 match. `check-adr-en-coverage.mjs --lint` 148/148.
- **grep residue**: `SearchBox`/`minisearch`/`searchDocs`/`SearchDoc`/`search-index`/`checkSearchIndex`/search* i18n → **0** globally (blog/ + root scripts/).
- **Critic (pass 1)**: `codex review --base main` (Codex, session `019e4eec-c0d8-7df3-becd-a9230ebb3156`) — Critical/High/Medium/Low **0** ("the deletion appears internally consistent"). However codex's review scope was the pass-1 diff (blog/ + package.json); the root gate script was out of scope, so the search-index gate miss went undetected → caught by the /stop local gate.
- **CI**: #355's Build Blog (SSG) job was actually a **failure** (the search-index gate) but merged due to it not being a required check. The follow-up PR re-triggers Build Blog (SSG) via `docs/adr/sprints/**`·`docs/adr-en/sprints/**` changes → passes with the fixed gate.

## Lessons / Patterns

- ① **Extend feature-deletion grep scope to "all consumers" — looking only inside blog/ misses root gate scripts** — the gate validating the deleted artifact (`search-index.json`) lived in root `scripts/`, not `blog/`. Limiting pass-1 grep to `blog/` missed it and main merged broken. When deleting artifacts/symbols, trace references **repo-wide** (root scripts·CI workflows included).
- ② **Verify CI by per-job conclusion — `$?` of `gh pr checks --watch | tail` is tail's exit, not trustworthy** — the pipe-tail's exit (0) was misread as overall CI pass. Actually check per-job conclusion via `gh run view --json jobs -q '.jobs[]|{conclusion}'`, and **a non-required job does not block merge even on failure** (depends on branch protection).
- ③ **Gate scripts are part of the feature — remove gates that validated a deleted artifact together** — deleting search invalidates the `check-adr-links.mjs` sanity check of the search artifact. On feature removal, remove not only the artifact's producer (prebuild) but also its **consumer (the validation gate)** for a consistent pipeline.
- ④ **Clean up dead fields / i18n key type auto-derivation** — `AdrIndex.searchDocs` was a build byproduct nobody read, removed together. With `DictKey = keyof typeof DICTIONARY['ko']`, dropping keys from the ko dictionary auto-narrows the union so tsc catches residual references.

## New Patterns

- **Pre-deletion grep — repo-wide classification** — exhaustively trace the target feature's symbols/artifacts (components·types·fields·i18n keys·dependencies·**build artifacts + the root gates/CI steps that validate them**) via repo-wide grep and classify into "exclusive (delete) / shared (keep)" before starting. Limiting grep to a subdirectory like blog/ causes root-gate misses → CI regressions.

## Carryover

- **Operational Sprint 196 migration run + redeploy** (user/ops): run `npm run migration:run` on problem_db (jsonb conversion + GIN, runbook `SET statement_timeout=0`).
- (Optional) **CI PYTHON_VERSION 3.12 → 3.13** bump (separate sprint).
- (Optional) **Promote Build Blog (SSG) to a branch-protection required check** — prevent recurrence of a blog gate failure not blocking merge as happened here.
- Cumulative UAT (user directly): Programmers re-submission grading / English production Grafana CB dashboard.
