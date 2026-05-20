---
sprint: 177
title: "Deterministic blog cross-check gate (seed #18)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-176", "sprint-175", "sprint-157"]
related_memory: ["sprint-window"]
---
# Sprint 177 — Deterministic blog cross-check gate

## Goal

- Recover Sprint 157 #18 (automate pre-merge domain-fact cross-check for blog posts) after a 7-sprint carryover. Since the carryover blocker was an "ambiguous validation scope", **scoping is the top priority**.
- Follow the standard cycle: single working branch + PR + Squash merge + Critic (Codex) cross-review. Seed #18 as a single PR (#307).

## Decisions

### D1. Scope cut — exclude prose domain facts, gate structural cross-check only (user-approved)

Many of a blog post's "domain facts" (e.g. "67 sprints", "2,432 tests", "branches 99.51%" in `sprint-journey.mdx`) are **past snapshots frozen at the time the retrospective was written**. Validating them automatically against the current codebase state would mass-produce false positives (the project kept growing throughout Sprint 95~176), and full prose fact validation is an LLM domain, unsuitable for a deterministic hard gate. We therefore explicitly exclude prose domain facts and, in line with the existing deterministic gate patterns (`check-i18n-residue.mjs`, `check-adr-index-count.mjs`), gate only the **three axes of structural cross-check**.

### D2. Zero-dependency constraint

The CI `quality-docs` job runs node scripts from the repo root without `npm install` (`gray-matter` exists only under `blog/node_modules` → it cannot be imported from the root). So the gate uses only node built-in modules and parses frontmatter directly with a lightweight in-house parser.

### D3. Three gate axes (`scripts/check-blog-crosscheck.mjs`, `--strict`/`--lint`/default, exit 0/1/2)

1. **KR↔EN parity**: bidirectional slug pairing between `blog/content/posts/` (KR 10) ↔ `posts-en/` (EN 10) (blocks orphans) + structural-field (date/category/order/tags/series/seriesOrder) match. title/excerpt are excluded since they are translation targets.
2. **frontmatter schema**: required fields (title/date/excerpt/tags/category) + category enum {journey, challenge} (SSOT `blog/src/lib/posts.ts` VALID_CATEGORIES) + date `YYYY-MM-DD` (non-string also rejected) + order unique within the same date.
3. **internal link integrity**: after excluding code fences/inline code (stripCode) — reject filesystem escapes/OS absolute paths + locale-aware post routes (a post links only to its own locale's route; slug existence is verified after fragment/query normalization). Non-post root-absolute paths such as `/adr/...` pass.

### D4. CI wiring

Register the script in the `ci.yml` `docs:` paths-filter + add a `--strict` step to the `quality-docs` job. Triggers automatically on `blog/content/**/*.mdx` changes.

## Implementation

### PR #307 `adceabf` — deterministic blog cross-check gate (#18)

- New `scripts/check-blog-crosscheck.mjs` of 485 lines: implements D3's three axes (parity/schema/link) using only node built-in modules + a lightweight in-house frontmatter parser (D2). Follows the entry-guard + exported pure-function pattern (`stripCode`/`classifyLink`/`checkPostRoute`, etc.).
- `.github/workflows/ci.yml` +4: register the script in the `docs:` paths-filter + a `--strict` step in the `quality-docs` job.
- `blog/content/posts-en/toward-model-agnostic-harness.mdx` 1 line: EN dogfood (recovering one real locale-leak bug, see Critic R2 below).

## Critic cycle

`codex review --base main`, 4 rounds — sequentially exposing both false positives and false negatives.

- **R1** (session `019e44dd-4d16-7110-ab9e-038810ed3595`): **2 P2 (false positives)** —
  ① `extractLinks` scanned even example links inside a code fence. The initial dogfood target `sliding-window-agent-context.mdx` line 239 turned out to be a MEMORY.md index example inside a ```` ```markdown ```` fence → **the initial dogfood itself was a false positive**.
  ② order uniqueness was enforced globally per locale, but `getAllPosts` (posts.ts) sorts by date first and uses order as a tiebreaker only within the same date → the same order on a different date is a false positive.
  **Fix (commit `b981006`)**: added the `stripCode` helper (fences ```` ``` ````/`~~~` + info string, multi/single backticks) + changed the order key to `${date}::${order}`. The dogfood mdx change that was inside a code fence was reverted (it is automatically ignored after stripCode, so it was unnecessary).

- **R2** (session `019e44e2-0782-7b23-b5be-56d56bcf7c92`): **2 P2 (false negatives)** —
  ① `classifyLink` ignored locale → an EN post linking to a bare `/posts/foo` passed if only the KO file existed (locale leak). Real instance: `posts-en/toward-model-agnostic-harness.mdx`.
  ② date format was validated only when it was a string → `date: 20260409` (number) bypassed it.
  **Fix (commit `da3e43c`)**: locale-aware `checkPostRoute` (only the same-locale route is valid; cross-locale is a leak violation) + **EN dogfood** (`/posts/baekjoon-gone` → `/en/posts/baekjoon-gone` in `posts-en/toward-model-agnostic-harness.mdx`, one real bug) + when date is present, a non-string is also a violation.

- **R3** (session `019e44e6-1000-7630-acae-fa71480b3264`): **1 P2 (false negative)** — `checkPostRoute` failed to match a fragment/query suffix (`/posts/missing#section`, `?ref=foo`) against the `$` anchor → it passed. **Fix (commit `771b954`)**: verify slug existence after `href.split(/[#?]/)[0]` normalization.

- **R4** (session `019e44e8-edb2-7ad2-bf1a-be76f5ffaa45`): **0 findings** — "no introduced issue, existing behavior and CI safe". Mergeable.

## Verification

### Local
- The gate `--strict` reports 0 violations on current content, exit 0.
- tamper regression — parity (orphan)/schema (category enum · duplicate order within same date · non-string date)/link (escape outside a fence → blocked, inside a fence → ignored, locale leak, fragment + nonexistent slug): each violation → exit 1, restore → exit 0.
- All inline assertions of the exported functions PASS.

### CI
- PR #307 38 checks green; `Quality — docs` SUCCESS demonstrates the new gate dogfooding.

## Result

- **Merge**: origin/main `5e931e2` → `adceabf` (PR #307 squash merge).
- **Net change**: `scripts/check-blog-crosscheck.mjs` 485 lines (new) + `.github/workflows/ci.yml` +4 + `blog/content/posts-en/toward-model-agnostic-harness.mdx` 1 line (EN dogfood).

## New patterns

- **Scope cut for deterministic cross-check**: prose domain facts (time-frozen snapshots) are an LLM domain, so they are excluded from the gate, and only structural invariants (parity/schema/link) are gated deterministically. Scope is cut by "deterministic verifiability" rather than "verifiability".
- **Code-fence-aware link checking**: code-block/inline-code content is example text rather than a rendered anchor and cannot produce a deployment 404, so it is excluded from link checking (avoids false positives).
- **locale-aware internal links**: i18n content must link only to its own locale's route — cross-locale is a leak violation.

## Lessons

- **The Critic cross-review caught an error in the dogfood premise itself**: R1 revealed that the initial "broken link" dogfood was actually an example inside a code fence → demonstrating that avoiding false positives is the gate's top quality criterion (inherited from Sprint 175).
- **Both false positives (R1) and false negatives (R2/R3) harm gate accuracy in both directions**: the adversarial cross-review exposed both sequentially. The perceived severity of each round's findings decreased from content blocking (R1) → real bug (R2) → theoretical edge (R3).
- **A deferred follow-up turned into a dogfood when a real instance was found during implementation**: locale-leak was deferred as a follow-up in the plan, but the gate implementation revealed a real bug (`/posts/baekjoon-gone` in EN) and recovered it within that PR.

## Carryover items (Sprint 178+)

- Additional blog cross-check dimensions (if needed in the future): reference-style links, broader frontmatter validation, etc.
- plan template remainder: sprint-157 leftovers.
- UAT user direct cumulative: #5 Programmers resubmission grading / #9 English Grafana CB dashboard + Sprint 160~177 cumulative.
- other follow-ups (inherited from sprint-176 §carryover): remove coverage-gate `skipped` tolerance, post-merge pre-deploy gate, prom-client check automation, `.claude-tools/` Phase 2 deletion, `(adr)` layout split, etc.
