---
sprint: 249
title: "AI Analysis Difficulty Context + Structured Parsing — difficulty/level Injection + Problem Structured Fields"
date: "2026-07-15"
status: completed
agents: [Oracle, Conductor, Sensei, Curator, Critic]
related_adrs: ["sprint-248", "sprint-238", "sprint-97"]
related_memory: ["sprint-window", "sprint-249-ssot-drift"]
topics: ["ai-analysis", "problem", "submission", "crawler", "difficulty", "structured-content"]
tldr: "Second-phase expansion of Sprint 248 AI context enrichment. Wave C: Added difficulty/level columns to Submission entity (TypeORM migration) → copied from Problem Service on submission creation → injected into ai-analysis via _build_difficulty_context() for difficulty-aware rubric calibration. Wave D: Added inputDescription/outputDescription/constraints/examples structured fields to Problem entity + TypeORM migration → extended Programmers crawler to parse I/O example tables and constraints separately → injected as <structured_content> block in ai-analysis. Wave C PR #464 merge commit 6882dc7 / Wave D PR #465 commits b5b1fbb+87ee8bb. Submission 388 passed·98.69% / AI Analysis 379 passed·98.89% / Problem 213 passed·96.79%. Critic gate: Wave D P2 example cell sanitize missing → fixed → CLEAN."
---
# Sprint 249 — AI Analysis Difficulty Context + Structured Parsing

## Goal

- **Wave C**: Inject difficulty (`difficulty`/`level`) context into AI analysis prompts to calibrate rubrics by tier — Bronze vs Platinum should be evaluated against different expectations.
- **Wave D**: Extend the Programmers crawler to store I/O examples and constraints in dedicated structured fields, then inject them as a `<structured_content>` block in AI prompts.
- Overcome the limitation from Sprint 248 where only problem title and description were injected, giving AI access to the full problem specification.

## Background

- Sprint 248 completed group analysis problem injection (Wave B) and the Programmers crawler (Wave A), but two gaps remained:
  1. **No difficulty context**: AI evaluated Bronze and Platinum code with identical rubrics — no calibration possible.
  2. **Full description text injection**: Crawled HTML injected verbatim — I/O examples and constraints buried in natural-language description, increasing AI parsing overhead.
- An assumption existed that `Submission` entity already had `difficulty`/`level` fields — Wave C pre-check disproved this (migration required).

## Decisions

### D1. Difficulty Context — Copy-on-Submit Strategy

- Rather than querying the Problem entity on each analysis request, **copy `difficulty`/`level` at submission creation time** into the Submission record.
- Rationale: avoids an extra Problem Service call during analysis; preserves the difficulty as-of-submission as an immutable snapshot.
- Migration: `difficulty VARCHAR(20) NULL`, `level INT NULL` columns added to Submission.
- ai-analysis `_build_difficulty_context()`: generates rubric calibration text based on level and difficulty tier (Bronze/Silver/Gold/Platinum/Diamond + Programmers Level 1–5).

### D2. Structured Parsing — Dedicated Problem Fields + Crawler Extension

- Added four structured fields to `Problem` entity: `inputDescription TEXT NULL`, `outputDescription TEXT NULL`, `constraints TEXT NULL`, `examples TEXT NULL`.
- Extended `crawler.service.ts`: parsing `div.markdown` now separates I/O example tables (`.example-io`) and constraints (`<h5>`) into dedicated fields — stored independently in the Problem record.
- ai-analysis `<structured_content>` block: injects `<input_spec>`, `<output_spec>`, `<constraints>`, `<examples>` sub-blocks only when structured fields are present — reuses ADR-030 S-5 prompt injection defense pattern.

### D3. Critic P2 — Apply sanitize to Example Cells

- `_format_examples()` injected I/O table cell values directly without `_sanitize_problem_field()` → risk of breaking prompt boundaries if cells contained `<problem_context>` tags.
- Fix: applied `_sanitize_problem_field()` to all headers and cell values.
- Added 2 tests: normal sanitize + malicious tag blocking.

## Implementation

### Wave C — difficulty/level Context Injection (ai-analysis + submission, Oracle direct)

| File | Change |
|------|--------|
| `submission/src/submission/submission.entity.ts` | `difficulty`/`level` nullable columns added |
| `submission/src/database/migrations/…AddDifficultyLevel.ts` | TypeORM migration |
| `submission/src/submission/submission.service.ts` | `create()` copies difficulty/level from ProblemServiceClient response |
| `ai-analysis/src/prompt.py` | `_build_difficulty_context()` added + `build_user_prompt()` parameters extended |
| `ai-analysis/src/worker.py` | difficulty/level extracted from message fields → passed to `analyze_code()` |
| `ai-analysis/tests/` | Tests updated |

- PR #464 squash merge → **`6882dc7`** (2026-07-15)
- **Submission**: 388 passed · Branches 98.69% ≥ 98%
- **AI Analysis**: 359 passed · TOTAL 99%+
- Security patch bundled: `multer` CVE-2026-5079 — submission service 2.1.1 → 2.2.0 (Sprint 248 patched only problem/ai-analysis; submission was missed)

### Wave D — Structured Parsing + AI Injection (problem + ai-analysis, Oracle direct)

| File | Change |
|------|--------|
| `problem/src/problem/problem.entity.ts` | `inputDescription`/`outputDescription`/`constraints`/`examples` 4 fields added |
| `problem/src/database/migrations/…AddStructuredContentToProblems.ts` | TypeORM migration |
| `problem/src/crawler/crawler.service.ts` | Structured parsing (I/O example tables + constraints separation) |
| `ai-analysis/src/prompt.py` | `_format_examples()` + `<structured_content>` block (I/O + constraints) |
| `ai-analysis/src/worker.py` | structured content fields extracted + passed to `analyze_code()` |
| `ai-analysis/src/claude_client.py` | structured data parameter added |
| `ai-analysis/src/main.py` | structured fields forwarded via Problem Service query |
| Tests (multiple) | ai-analysis +138 lines, problem +163 lines new cases |

- Wave D commits: `b5b1fbb` (Wave D core) · `ac70dbd` (ruff auto-format) · `87ee8bb` (Critic P2 sanitize fix)
- **AI Analysis**: 379 passed · TOTAL 98.89% ≥ 98%
- **Problem**: 213 passed · Branches **96.79%** ≥ 96% · Functions 98.61% ≥ 98%
- **ESLint**: Errors 0

### Critic Gate (Wave D)

| Severity | Finding | Fix |
|----------|---------|-----|
| **P2** example cell sanitize missing | `_format_examples()` — cell values injected without `_sanitize_problem_field()` → malicious tags could break prompt boundaries | sanitize applied to all headers and cells + 2 tests added (`87ee8bb`) |

- Wave C Critic gate: **CLEAN** (0 findings)
- Wave D Critic gate: P2 1 finding fixed → **CLEAN**

## Verification

| Item | Wave C | Wave D |
|------|--------|--------|
| **CI** | ✅ 38/38 PASS | ✅ 38/38 PASS |
| **Submission** | 388 passed · 98.69% | — |
| **AI Analysis** | 359 passed | 379 passed · 98.89% |
| **Problem** | — | 213 passed · Branches 96.79% |
| **Critic** | ✅ CLEAN | ✅ CLEAN (after P2 fix) |
| **PR** | #464 → `6882dc7` | #465 → `b5b1fbb`+`87ee8bb` |

## Lessons Learned

1. **Always grep-verify Submission fields before assuming they exist.** Assumed `difficulty`/`level` were already in the entity — they weren't → migration required. "Already exists" assumptions must be confirmed with `grep` before starting implementation.
2. **Structured field decomposition improves AI prompt efficiency.** Injecting full description text is less effective than `<input_spec>`·`<output_spec>`·`<constraints>` sub-blocks — clearer boundaries reduce AI parsing ambiguity. Extends Sprint 248 lesson on pattern reuse.
3. **Sanitize must be applied explicitly in every new formatting function.** `_format_examples()` bypassed `_sanitize_problem_field()` for cell values → Critic flagged P2. New formatter functions must follow the "external data is untrusted" principle: all inputs must pass sanitize before prompt injection.
4. **Multi-service CVE patches require exhaustive grep across all services.** Sprint 248 patched multer in ai-analysis/problem only → submission missed → Wave C CI Trivy FAIL. Multi-service vulnerability patches should start with `find . -name "package.json" | xargs grep "multer"` across the entire monorepo.
5. **Always run ruff format before committing.** Initial Wave D commit triggered CI `Quality — ai-analysis` ruff format FAIL → required a separate fix commit. Add `ruff format .` + `ruff check .` to pre-commit checklist or hook.

## Carry-Over

- **Sprint 250 (planned)** — SSOT drift decision: CLAUDE.md Sprint 239 Q-5 outbound key spec (`INTERNAL_KEY_<TARGET>`) vs actual code pattern (`<SERVICE>_SERVICE_KEY`) — (B) document update direction to be confirmed by Scribe ADR.
- GA4 Enhanced Measurement OFF · GA4 production UAT · server redeploy + live SEO verification (ongoing carry-over).
- 🔴 Security: ANTHROPIC_API_KEY rotation (user hold).
