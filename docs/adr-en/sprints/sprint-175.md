---
sprint: 175
title: "Carryover seed recovery — PR template · blog trigger · i18n residue gate (seeds #24/#23/#171/#26/#27/#30/#31)"
date: "2026-05-20"
status: completed
agents: [Oracle, Architect, Herald, Critic, Scribe]
related_adrs: ["sprint-174", "sprint-171", "sprint-158", "sprint-157"]
related_memory: ["sprint-window"]
---
# Sprint 175 — Carryover seed recovery (PR template · blog trigger · i18n residue gate)

## Goal

- After recovering the security-sensitive single seed (#new7) in Sprint 174, recover the remaining **inherited carryover seeds** as independent per-seed PRs.
- Three priorities: ① plan/PR template hardening (#24/#23/#171), ② ADR/blog CI hardening (#26/#27/#28), ③ i18n/lint (#30/#31).
- **Regression isolation**: independent PR per seed + Critic (Codex) cross-review + Squash merge.

## Decisions

### D0. #28 is already implemented → excluded from work

The ROOT auto-detection in `check-adr-links.mjs` is already implemented via `scripts/check-adr-links.mjs:33` (`resolve(import.meta.dirname, '..')`) + `deriveOutRoot()`, so no additional work is required. The ADR/blog hardening is reduced to the two items #26/#27.

### D1. #26 — positive glob narrowing instead of a negation pattern

Verifying the dorny/paths-filter source (`src/filter.ts`) directly shows that each pattern is compiled into its own `picomatch` matcher and then combined with the default `predicate-quantifier: some` (OR). Therefore, adding a `!docs/adr/README.md` negation pattern to the blog filter would be **neutralised** because `docs/adr/**` matches first under OR (negation only works under the `every` quantifier, but `every` would break every filter in the single dorny step). Instead, narrow the filter to **positive globs that match exactly what the blog SSG actually consumes**.

- Consumers: `blog/src/lib/adr/loader.ts` (`DIR_KIND_MAP = [sprints, topics]`) + `blog/scripts/generate-search-index.mjs` → read only root `ADR-*.md` + `sprints/` + `topics/`, with `README.md` explicitly excluded (`loader.ts:62`, `generate-search-index.mjs:86`).
- `'docs/adr/**'` → `'docs/adr/ADR-*.md'` + `'docs/adr/sprints/**'` + `'docs/adr/topics/**'`.
- A picomatch simulation confirmed `docs/adr/README.md` skip / real ADR content trigger.

### D2. #27 — out/ fail-fast guard

If `next build` (output:export) fails silently, an empty `out/` is copied verbatim into Docker and an empty site could be deployed. Add a step that verifies `out/` exists and is non-empty before the link check.

### D3. #30/#31 — gate the translation source instead of the build artifact (shift-left)

A direct Hangul grep over the build artifact (`out/en/**`) would falsely flag legitimate KR-fallback banner pages (`hasEnTranslation=false`). Instead, gate the prose Hangul density of the translation **source** (`docs/adr-en/**/*.md`). Because the blog `/en` ADR body is rendered verbatim from `docs/adr-en` (`loader.ts readLocalized`), gating the source blocks build-artifact Korean residue shift-left while avoiding the banner false-positive.

- **i18n 3 layers**: layer 1 KR SSOT exists → layer 2 EN file exists (`check-adr-en-coverage --strict`, existing) → layer 3 EN actually translated (`check-i18n-residue --strict`, new).
- Code fences/inline code excluded (Korean log/commit examples are legitimate) + violation only when the ratio threshold (default 8%) AND the absolute floor (10 chars) are both met. The current corpus max prose Hangul is 2.19%, leaving 3.6x headroom.

## Implementation (independent PR per seed)

### PR #300 `9b8f964` — PR template hardening (#24/#23/#171)

`docs(ci): PR 템플릿에 문서 양면/소비처/누적카운트 체크리스트 추가`

- Added a「Docs/ADR change」section (KR+EN dual update #24, README cumulative count after rebase #23) and a「New artifact — adoption ≠ consumption」section (#171) to `.github/pull_request_template.md`, following the existing section style (`>` rationale blockquote).

### PR #301 `43fe210` — blog trigger + out/ verification (#26/#27)

`ci(blog): blog 트리거 소비처 일치 + SSG out/ 산출물 검증`

- Narrowed the detect-changes blog filter in `ci.yml` to consumer-aligned positive globs (README excluded).
- Added a `Verify SSG output (out/)` fail-fast step to the build-blog job.

### PR #302 `966fa56` — i18n residue gate (#30/#31)

`feat(ci): EN ADR 한국어 잔재 게이트 (i18n 계층 3)`

- New `scripts/check-i18n-residue.mjs` — follows the en-coverage structure (ROOT auto-detect/`--strict`/exit 0·1·2/entry guard/exports), reuses `collectAdrFiles` (DRY). Modes: stats/`--lint`/`--strict`/`--max-ratio=N`.
- Added a residue `--strict` step to the `ci.yml` quality-docs job + registered the script in the docs paths-filter.
- Documented the i18n 3-layer model in `docs/adr-en/README.md`.

## Critic cycle

- **PR1** (`codex review --base main`, session `019e442b-eaa7-7483-bbcc-9d61f8097889`): 0 findings — "checklist guidance only, no runtime impact".
- **PR2** (session `019e4432-db17-7d62-a5a6-5bccdd71e8fa`): 0 findings — "path-filter narrowing + SSG output check consistent, existing workflows unbroken".
- **PR3** (session `019e443b-ef00-7f81-b493-b6edd046ce0e`): 0 findings — "new CI check/script works, integrates with the docs quality gate".

All three PRs passed in a single review round with zero P0–P3 findings.

## Verification

### Local
- `check-i18n-residue --strict`: 122 EN files PASS (max prose Hangul 2.19% < 8%).
- Exported-function unit checks 9/9 (English / stub 94.1% / code-fence excluded / inline excluded / absolute floor / arg parsing), error path exit 2, import side-effect-free.
- `check-doc-refs` (311 files, 0 broken) / `check-adr-en-coverage --strict` (122/122) / `check-regex-robustness` clean.
- Validated the ci.yml outer YAML + dorny inner filters YAML parse, plus a picomatch matching simulation passing all cases.

### CI
- PR #300/#301/#302 each merged via Squash after CI green (mergeStateStatus CLEAN).

### New UAT (Sprint 175)
- Real user direct: group analysis partial-recovery rendering on truncated responses (inherited from Sprint 174); visual check for Korean residue on the English blog `/en` ADR pages.

## Result

- **Merge**: origin/main `3f938fe` → `966fa56` (PR #300 `9b8f964` / #301 `43fe210` / #302 `966fa56`, all squash merge)
- **Net change**: +~250 (PR template 15 lines, ci.yml 24 lines, check-i18n-residue.mjs 197 lines, README 17 lines)

## New patterns

- **Consumer-aligned trigger**: a CI path filter is aligned with the exact set of paths the consuming code actually reads. In an OR-quantifier environment where negation patterns are neutralised, use positive glob narrowing to remove unnecessary triggers.
- **i18n 3-layer gate**: separate existence (en-coverage) from quality (i18n-residue) to close the "file exists but is an untranslated stub" gap. The source gate blocks build-artifact residue shift-left.

## Lessons

- **Verify an external library's actual behaviour before building on it**: had we not confirmed from source that the dorny/paths-filter negation pattern is neutralised under the `some` quantifier, the README exclusion would have failed silently. Pre-validate CI changes with a picomatch simulation.
- **False-positive avoidance is the #1 gate-design priority**: switched from a direct build-artifact check (with banner false-positives) to a source gate. A CI gate that blocks legitimate PRs loses trust.
- **Practising "name the consumer too" (Sprint 171 lesson)**: PR2 (#26) implemented exactly the checklist (#171) added in PR1 — aligning the trigger with the consumer is the CI edition of "adoption ≠ consumption".

## Carryover (Sprint 176+)

### New finding
- **adr-en blog trigger gap**: `docs/adr-en/**` is absent from the blog rebuild trigger (missing since the original filter). Re-translating EN alone does not rebuild the blog `/en` pages → a candidate #26 follow-up for Sprint 176.

### Inherited carryover seeds
- Remaining plan-template items: blog-post pre-merge cross-check automation (#18, target is ambiguous → scope to be defined).
- Real user direct UAT: #5 Programmers resubmission grading / #9 English Grafana CB dashboard + Sprint 160–175 accumulation.
- Other follow-ups: removing coverage-gate `skipped` tolerance, post-merge pre-deploy gate, prom-client check automation, `.claude-tools/` Phase 2 deletion, `(adr)` layout split, etc., inherited from sprint-174 §carryover.
