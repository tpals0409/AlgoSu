---
sprint: 176
title: "adr-en blog trigger gap recovery + README count auto-gate (seeds #1/#3)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-175", "sprint-171", "sprint-157"]
related_memory: ["sprint-window"]
---
# Sprint 176 — adr-en blog trigger gap recovery + README count auto-gate

## Goal

- Recover the two **CI/docs gate hardening** items discovered and carried over from Sprint 175 #26 as independent per-seed PRs.
  - #1: `docs/adr-en/**` is missing from the blog rebuild trigger, so an EN-only re-translation does not rebuild blog `/en`.
  - #3: Automate the README ADR cumulative count drift (Sprint 157 #23) from a manual checklist into a CI hard gate.
- **Regression isolation**: independent PR per seed + Critic (Codex) cross-review + Squash merge.
- #2 (blog cross-check) has an ambiguous validation scope → carried over to Sprint 177 (confirmed out of scope).

## Decisions

### D1. #1 — inherit the consumer-aligned trigger for EN too

In Sprint 175 #26 the KR blog trigger was narrowed to consumer-aligned positive globs, but the consumer `blog/src/lib/adr/loader.ts:28` (`ADR_EN_BASE = path.resolve(cwd, '..', 'docs', 'adr-en')`) reads EN ADRs with the same structure as KR (root `ADR-*.md` + `sprints/` + `topics/`) via `readLocalized`. The original blog filter never had `docs/adr-en/**`, so EN-only re-translation left build-blog untriggered.

- Add three positive globs `'docs/adr-en/ADR-*.md'` + `'docs/adr-en/sprints/**'` + `'docs/adr-en/topics/**'` (symmetric with the KR globs).
- Because of the dorny/paths-filter `predicate-quantifier: some` (OR) environment (source-verified in Sprint 175 #26), negation patterns are forbidden — `README.md` is naturally excluded by not matching `ADR-*.md`.
- A picomatch simulation over 5 cases confirms EN sprint/topic/ADR trigger and `README.md` skip.

### D2. #3 — the count gate as a non-destructive drift detector

Automatically block cases where the "(N개)" declarations in `docs/adr/README.md` diverge from the actual file count during rebase/merge (Sprint 157 #23). The counting basis is aligned with README's current declarations (permanent `ADR-*.md`=8 / topic `topics/*.md`=1 / sprint `sprints/*.md`=114, README.md excluded), so adoption is non-destructive. The sprint count 114 is the total `.md` basis (standard `sprint-NN.md` 113 + non-standard `sprint-87-plan.md` 1), which matches README's current notation, so the gate enforces no naming policy and detects pure drift only.

- The convention follows `scripts/check-i18n-residue.mjs`: entry guard (`process.argv[1] === __selfPath`) + exported pure functions (`countActualAdrs`/`parseDeclaredCounts`/`diffCounts`) + `--strict` exit 1 / option/I-O error exit 2.
- Because the sprint declaration can carry trailing text such as `(114개, Sprint 62~175)`, only the sprint regex omits the requirement for a closing parenthesis.

### D3. Critic P2 — enforce declaration occurrence count (block partial drift)

The initial `diffCounts` only flagged `missing` when a category had **zero declarations**, so partial drift where only some of the six spots are removed (e.g. removing the section-heading count while keeping the ASCII-tree count) would pass (Critic R1 P2). Introducing `EXPECTED_OCCURRENCES` (2 per category = ASCII tree + section heading) enforces the occurrence count itself → partial removal, zero, and excess are all blocked as `occurrences` mismatches.

## Implementation (independent PR per seed)

### PR #304 `97277ab` — adr-en blog trigger gap (#1)

`ci(blog): trigger blog /en rebuild on adr-en-only re-translation`

- Add three `docs/adr-en/` positive globs to the `ci.yml` detect-changes blog filter (right after the KR globs, with a comment naming the consumer `loader.ts` ADR_EN_BASE).
- picomatch simulation 5 cases PASS: EN `sprints/`·`topics/`·`ADR-*.md` = true, `README.md` = false, non-standard `sprint-87-plan.md` = true.

### PR #305 `297a04a` — README count auto-gate (#3)

`ci(docs): README ADR index count consistency gate`

- New `scripts/check-adr-index-count.mjs` (235→257 lines incl. the P2 hardening). Compares per-category actual `.md` counts against the six README declarations + enforces occurrence count.
- Wire a `--strict` step into the `ci.yml` quality-docs job + register the script in the `docs` paths-filter.
- Add a one-line count-consistency gate note to `docs/adr/README.md` (blockquote above the classification section).

## Critic cycle

- **PR #304** (`codex review --base main`): 0 findings — "expands EN ADR source paths to match the consumer, no impact on existing behavior." Passed on first review.
- **PR #305 R1**: **1 P2** — `diffCounts` only blocks when zero declarations exist, so partial-removal drift is not blocked → recommended an occurrence-count check.
- **PR #305 R2** (after P2 fix): 0 findings — "scoped to docs changes, matches the README/counting conventions, passes against the repository state, no discrete introduced issue."

### Delegation handling (P2)
Critic → re-delegated to Architect → introduced `EXPECTED_OCCURRENCES` + added the `occurrences` mismatch kind → merged after confirming R2 0 findings.

## Verification

### Local
- `check-adr-index-count --strict`: current 114/8/1 PASS.
- export units: counter (8/1/114) + parser (6 spots + sprint trailing) + diffCounts match/partial-removal (1 spot)/zero/excess (3 spots)/value mismatch all detected (11+5 cases PASS).
- e2e: temporarily tampering the README sprint count → exit 1, `git checkout` restore → exit 0.
- regression gates: `check-doc-refs` (313 files 0 broken) / `check-adr-en-coverage --strict` (123/123) / `check-i18n-residue --strict` (max 2.19% < 8%) / ci.yml YAML parse all clean.

### CI
- PR #304 CI green (36 checks pass) → squash merge. PR #305 CI green (37 checks pass, `Quality — docs` SUCCESS dogfoods the new gate, `Build Blog` SKIPPED demonstrates the #1 narrowing) → squash merge.

### New UAT (Sprint 176)
- Real user direct: visual check of Korean residue in the English blog `/en` ADR (inherited from Sprint 175), and verify the blog `/en` rebuild trigger fires on adr-en re-translation.

## Result

- **Merge**: origin/main `966fa56` → `297a04a` (PR #304 `97277ab` / #305 `297a04a`, both squash merged)
- **Net change**: +~271 (ci.yml +12, check-adr-index-count.mjs 257, README +2)

## New patterns

- **EN-symmetric extension of the consumer-aligned trigger**: extend the consumer-aligned trigger applied to KR (Sprint 175 #26) symmetrically to the EN consume path (`ADR_EN_BASE`). When consumers are split per locale, the trigger must stay locale-symmetric to avoid a gap.
- **Index count consistency gate**: a drift detector that compares a doc index's declared figures against the actual file count. It enforces not only the value but the **declaration occurrence count** to block partial removal.

## Lessons

- **The consumer-alignment principle must be symmetric across locales too**: narrowing only KR leaves the EN gap intact. When applying trigger-consumer alignment, check all consume paths (including per-locale) at once.
- **An invariant must gate not just the "value" but the "structure" (Critic P2)**: comparing only the count value misses drift where the declaration itself disappears. The gate must enforce the invariant it intends to guarantee (six spots synchronized) literally (occurrence count) to block the bypass.
- **A new gate is dogfooded at merge time**: PR #305's `Quality — docs` SUCCESS demonstrates the gate's own correct operation, while `Build Blog` SKIPPED simultaneously demonstrates the #1 narrowing.

## Carryover items (Sprint 177+)

### Inherited carryover seeds
- **blog cross-check automation (#18)**: pre-merge validation for blog posts — ambiguous validation scope → needs scoping.
- plan template remainder: sprint-157 leftovers.
- UAT user direct: #5 Programmers resubmission grading / #9 English Grafana CB dashboard + Sprint 160~176 cumulative.
- other follow-ups: remove coverage-gate `skipped` tolerance, post-merge pre-deploy gate, prom-client check automation, `.claude-tools/` Phase 2 deletion, `(adr)` layout split, etc. inherited from sprint-175 §carryover.
