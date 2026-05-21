---
sprint: 182
title: "Reinforce doc-refs bare-path asymmetry"
date: "2026-05-21"
status: completed
agents: [Oracle, Architect, Critic, Scribe]
related_adrs: ["sprint-176", "sprint-177", "sprint-155", "sprint-154"]
related_memory: ["sprint-window"]
---
# Sprint 182 — Reinforce doc-refs bare-path asymmetry

## Goal

- `scripts/check-doc-refs.mjs` statically validates markdown cross-ref integrity (introduced in Sprint 154). Three functions cooperate: `validateRef` (path resolve + existence check), `extractMarkdownLinks` (`[text](path)` extraction), and `extractBareDocPaths` (bare path extraction for plain-text exposure).
- **Asymmetry**: `validateRef`'s repo-root resolve branch supports 8 top-level prefixes (`docs/`, `scripts/`, `blog/`, `frontend/`, `services/`, `infra/`, `.claude/`, `.github/`), and `extractMarkdownLinks` extracts every `.md` link regardless of prefix. But `extractBareDocPaths`'s regex matched only `docs/` → bare references exposed as **plain text rather than a markdown link**, such as `frontend/README.md` or `services/gateway/X.md`, went undetected even when broken.
- This resolves the asymmetry so the gate's validation scope is aligned consistently across the three functions, and structurally blocks the asymmetry from recurring.

## Decision

### D1. Consolidate prefixes into a single SSOT

The hardcoded prefix `||` chain (8 entries) in `validateRef` was extracted into the module-level constant `REPO_ROOT_PREFIXES`. `validateRef`'s resolve branch (`some(p => decoded.startsWith(\`${p}/\`))`) and `extractBareDocPaths`'s bare-matching regex now share the **same source**. Adding a new top-level directory requires updating only this array, which reflects into both rules simultaneously, making the "only docs/ matched on one side" asymmetry structurally impossible to recur.

### D2. Restrict the bare regex to the `.md` extension

The `extractBareDocPaths` regex is generated dynamically from the SSOT array (with the `.` in `.claude`/`.github` regex-escaped), restricted to the `.md` extension. Since `validateRef` actually validates `.md` paths (or the `docs/` prefix), aligning bare extraction to `.md` matches the extract-validate contract. As a side effect, non-`.md` plain-text mentions like the `services/` layer or the `infra/` directory don't match, blocking false positives.

### D3. Consumer applied consistently and automatically

`extractBareDocPaths` is also reused by `check-staging-integrity.mjs` (staged/untracked .md integrity check). This reinforcement fixes a single function and reflects into both gates (`check-doc-refs` + `check-staging-integrity`) simultaneously — with no separate synchronization code, a single SSOT function consistently updates behavior across all consumers.

## Implementation

### PR #317 (single work branch `feat/sprint-182-doc-refs-bare-path`, 1 commit → squash)

- `f1286cb` fix — introduce `REPO_ROOT_PREFIXES` SSOT, replace `validateRef`'s hardcoded chain with `some()`, generate `extractBareDocPaths`'s regex dynamically from SSOT (8 prefixes), fix JSDoc. self-test fixtures 5→8 (non-docs prefix dogfood). Update runbook §2.2/§6/§9.

Core change (extractBareDocPaths):
```js
const alt = REPO_ROOT_PREFIXES.map((p) => p.replace(/\./g, '\\.')).join('|');
const re = new RegExp(`(?<![[(\\w/.-])((?:${alt})\\/[\\w./-]+\\.md(?:#[\\w-]+)?)`, 'g');
```

The negative lookbehind `(?<![[(\w/.-])` blocks double-matching with markdown link paths (preceded by `(`) and excludes a word-char before the prefix (non-path cases like `v2.github/...`).

## Critic cycle

`codex review --base main`, 1 round.

- **R1** (session `019e47f0`): **0 issues**, passed — "The change centralizes repo-root prefixes and extends bare markdown path detection consistently with the existing resolver. The updated self-test passes and no actionable regression was identified." Mergeable.

## Verification

### Local
- `node scripts/check-doc-refs.mjs`: self-test **8/8** broken detected (5 docs slugs regression baseline + 3 non-docs prefix dogfood) + 325 files **0 broken**.
- `node scripts/check-staging-integrity.mjs`: self-test 2/2, no regression. `node scripts/check-regex-robustness.mjs`: passes.
- Edge-case verification (inline import): valid bare ref (`frontend/README.md`) extracted and passes / markdown link `[x](.github/foo.md)` not double-matched / standalone `.github/...md` matches / nested `services/gateway/src/x.md` matches / non-`.md` plain text (`services/`/`infra/`) no match / word-char prefix (`v2.github/x.md`) no match.

### dry-run (reinforcement impact measurement)
- Running the broadened regex against the entire tracked .md corpus yielded **0 new matches / 0 new broken refs**. So at the time of reinforcement the corpus has no plain-text bare non-docs references to fix, making this work **preventive and structural alignment** (closing a latent gate inconsistency + auto-covering future references). The self-test fixtures serve as proof of the new coverage.

### CI
- Work PR #317 all 37 checks green. The ADR PR is green including Build Blog (triggered by `sprints/**`).

## Result

- **Merge**: origin/main `e3d0983` → `6c92415` (PR #317 squash merge, work branch deleted).
- **Net change**: `scripts/check-doc-refs.mjs` (+34/-17), `docs/runbook/doc-ref-lint.md` (+14/-5). No new files.
- ADR sprint-182 (KR+EN) + README sprint ADR count 120→121, range 62~182 (separate ADR PR).

## New patterns

- **Extract-validate contract alignment (extractor↔validator symmetry)**: when a static-validation gate separates "extraction (what is a check candidate)" from "validation (is the candidate valid)", a divergence in their coverage creates a silent gap where **the validator is broad but the extractor is narrow, so some defects are dropped from the candidate set**. The extractor must cover the same input range the validator supports — bind them with an SSOT so the gate behaves as intended.
- **SSOT-ifying a hardcoded list structurally blocks asymmetry**: when the same prefix list lives separately in two functions, extending only one creates asymmetry (this case). Extracting a single array turns the asymmetry from a "forgot to update" mistake into an "impossible to express" state.

## Lessons

- **0 findings can still be valuable reinforcement (preventive/structural)**: the dry-run's 0 new findings clarified that this work is not a bug fix but a preventive reinforcement closing a latent inconsistency. Its value is in (1) auto-covering future plain-text bare references, (2) structurally blocking recurrence of the extractor↔validator asymmetry, and (3) dogfood-proving the new coverage with self-test fixtures. This matches Sprint 181's "marginal value" assessment of this item, but the SSOT refactor adds structural value.
- **An SSOT fix to a reused function is a 1:N consistent update**: since `extractBareDocPaths` is shared by two gates, an SSOT reinforcement in one function applies consistently across consumers with no separate synchronization — a gate-domain demonstration of the shared-helper pattern (inherited from Sprint 180/181).

## Carry-over (Sprint 183+)

- **Manual UAT by user**: inherit the Sprint 160~181 accumulated UAT (legacy Programmers SQL detail editor auto-selects sql, Programmers re-submission grading, EN-environment Grafana CB dashboard).
- Follow-ups: removing the coverage-gate skipped allowance (deferrable since actual skipped = 0), `(adr)` layout split, prom-client Case B~D automation, `.claude-tools/` Phase 2 actual deletion (after trigger-path verification), Sprint 162 R1 P3 (deep relative `.md` links uncovered), Sprint 163 (H3-only PR table extraction).
