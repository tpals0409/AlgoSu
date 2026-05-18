---
sprint: 109
title: "SQL Learning Experience Closure"
period: "2026-04-21"
status: complete
start_commit: 972ca49
end_commit: bc6758d
---

# Sprint 109 — SQL Learning Experience Closure

## Background

Sprint 108 completed the Programmers SQL problem pipeline from "search → registration → submission → AI feedback receipt." However, two quality debts remained.

1. **D2 Known Limitation**: The AI prompt applied algorithm rubrics ("time complexity," "space complexity," etc.) unchanged to SQL submissions, potentially generating feedback misaligned with SQL context.
2. **Herald medium follow-up**: The `parseLevelText` regex was extended but only had 4 boundary tests (stripSqlTitleSuffix-only), providing insufficient regression defense against future Programmers UI changes.

Sprint 109 closes these two items in a single session to achieve **qualitative completion** of Programmers SQL support.

Wave structure: W1 (Oracle inline reconnaissance) → W2-c1 (Architect: SQL rubric) → W2-c2 (Architect: regex tests) → W3 (Sensei verification) → W2.5 (Architect: emergency correction) → W4 (Scribe ADR).

## Goals

| Item | Content | Status |
|------|---------|--------|
| AI prompt SQL branch | `get_system_prompt(language)` + SQL_SYSTEM_PROMPT introduction | ✅ Complete |
| Weight SSOT extraction | `ALGORITHM_WEIGHTS` / `SQL_WEIGHTS` + `get_weights(language)` | ✅ Complete (W2.5) |
| `_parse_response` fallback correction | Hardcoded weights → `get_weights(language)` 1-line replacement | ✅ Complete (W2.5) |
| parseLevelText boundary tests | 13 added (Lv/Level/★/fallback/priority/range) | ✅ Complete |
| All service test regression defense | Thresholds met | ✅ Complete |

---

## Decisions

### D1. JSON Schema Compatibility Maintained

**Decision**: SQL rubrics also use the same 5 category names (`correctness`, `efficiency`, `readability`, `structure`, `bestPractice`) + same JSON response schema. Zero frontend parsing changes.

**Rationale**:
- Existing frontend parser renders based on category `name` field. Changing category names would require frontend modifications exceeding sprint scope.
- `timeComplexity` → "expected query execution method (Full Table Scan, Index Scan, etc.)", `spaceComplexity` → "temporary table/sort buffer usage (Using Temporary, etc.)" — **semantics reinterpreted only**, field names preserved.
- Full backward compatibility maintained with zero frontend code changes.

### D2. System Prompt Selection Function Introduction

**Decision**: Add `get_system_prompt(language: str) -> str` function to `prompt.py`. Replace `system=SYSTEM_PROMPT` hardcoding at `claude_client.py` L96 → `system=get_system_prompt(language)` call.

**Rationale**:
- Same structure as existing `_build_platform_context()` branching pattern. `analyze_code(language=)` parameter already exists — natural extension without new argument.
- `sql` → return `SQL_SYSTEM_PROMPT`, others → return `SYSTEM_PROMPT`. Case-insensitive (`language.lower()`).
- Future per-language prompt additions require only adding a branch to `get_system_prompt`.

### D3. SQL Weight Adjustment

**Decision**: Differentiate SQL category weights from algorithm.

| Category | Algorithm | SQL | Difference |
|----------|----------|-----|-----------|
| correctness | 30% | 30% | — |
| efficiency | 25% | 20% | -5% |
| readability | 15% | 15% | — |
| structure | 15% | 15% | — |
| bestPractice | 15% | 20% | +5% |

**Rationale**:
- In SQL, best practices like **ANSI SQL compliance, window function utilization, anti-pattern avoidance** have higher learning value than algorithmic efficiency.
- 5% transferred from `efficiency` to `bestPractice` to reflect SQL domain characteristics.
- Both weight sets verified to sum to 100% (tests verify `abs(sum - 1.0) < 1e-9`).

### D4. Fallback Weight SSOT Extraction (W3 Sensei Discovery → W2.5 Correction)

**Decision**: Add `ALGORITHM_WEIGHTS` / `SQL_WEIGHTS` constant dictionaries + `get_weights(language: str)` function to `prompt.py`. Extend `claude_client.py`'s `_parse_response` signature to `(raw_text, language="python")`, replace hardcoded weights at L203-209 with `get_weights(language)` 1 line.

**Rationale**:
- Sensei W3 verification discovered: `_parse_response` L203-209 had algorithm-only weights (`correctness: 0.30, efficiency: 0.25, ...`) hardcoded, causing algorithm weights to apply even when SQL submissions receive `totalScore=0` fallback.
- **Coherence problem** between prompt body weights and code weights → structurally resolved via SSOT constant extraction.
- `language` default `"python"` → existing calls (`test_parse_total_score_zero_with_categories_recalculates` etc.) preserve expected values using `ALGORITHM_WEIGHTS`.

---

## Fact Cross-Reference Table (Scribe verification)

| # | Fact item | Expected | Actual (source) | Match |
|---|-----------|---------|----------------|-------|
| 1 | Commit count (972ca49..HEAD) | 3 | 3 (`git log --oneline`) | ✅ |
| 2 | Changed file count | 5 | 5 (`git diff --stat`: prompt.py, claude_client.py, test_prompt.py, fetch-programmers-problems.ts, fetch-programmers-problems.spec.ts) | ✅ |
| 3 | Insertions/deletions | 321+/15- | 321 insertions, 15 deletions (`git diff --stat`) | ✅ |
| 4 | test_prompt.py tests added | 19 (TestSqlSystemPrompt 6 + TestGetSystemPrompt 5 + TestWeights 8) | 19 (L138-249 actual) | ✅ |
| 5 | parseLevelText tests added | 13 | 13 (fetch-programmers-problems.spec.ts L44-109 actual) | ✅ |
| 6 | Total tests added | 32 | 32 (19 + 13) | ✅ |
| 7 | Sprint 108 D2 Known Limitation resolved | YES | YES — `get_system_prompt("sql")` → SQL_SYSTEM_PROMPT return confirmed | ✅ |
| 8 | `_parse_response` language parameter | Added, default="python" | L149 `language: str = "python"` confirmed | ✅ |
| 9 | `get_weights("sql")` → SQL_WEIGHTS | is SQL_WEIGHTS | test_prompt.py L235-236 confirmed | ✅ |
| 10 | parseLevelText export | export function | L120 `export function parseLevelText` confirmed | ✅ |
| 11 | Level type export | export type | L65 `export type Level` confirmed | ✅ |
| 12 | SQL_WEIGHTS sum | 1.0 | correctness 0.30 + efficiency 0.20 + readability 0.15 + structure 0.15 + bestPractice 0.20 = 1.00 | ✅ |
| 13 | ALGORITHM_WEIGHTS sum | 1.0 | correctness 0.30 + efficiency 0.25 + readability 0.15 + structure 0.15 + bestPractice 0.15 = 1.00 | ✅ |

---

## Outputs and Changed Files

| File | Action | Wave | Description |
|------|--------|------|-------------|
| `services/ai-analysis/src/prompt.py` | Modified | W2-c1/W2.5 | SQL_SYSTEM_PROMPT constant, get_system_prompt(), ALGORITHM_WEIGHTS, SQL_WEIGHTS, get_weights() added |
| `services/ai-analysis/src/claude_client.py` | Modified | W2-c1/W2.5 | system= hardcoding → get_system_prompt(language), _parse_response(language=) parameter extension, weight SSOT integration |
| `services/ai-analysis/tests/test_prompt.py` | Modified | W2-c1/W2.5 | TestSqlSystemPrompt 6 + TestGetSystemPrompt 5 + TestWeights 8 = 19 added |
| `services/gateway/scripts/fetch-programmers-problems.ts` | Modified | W2-c2 | parseLevelText + Level type export added |
| `services/gateway/scripts/fetch-programmers-problems.spec.ts` | Modified | W2-c2 | parseLevelText boundary tests 13 added |

Commit list:
- `918409d` — feat(ai-analysis): SQL-specific rubric + get_system_prompt branch
- `69b02cb` — test(gateway): parseLevelText boundary test strengthening
- `bc6758d` — fix(ai-analysis): fallback weight SSOT extraction — per-language branch

---

## Lessons Learned

### 1. Scout Role Flexibility — Oracle Inline Reconnaissance Efficiency

W1 had Oracle directly analyzing code structure without separately dispatching a scout agent. Sprint 108's scout was primarily about Programmers SQL Kit **page navigation** (UX reconnaissance), but Sprint 109's core was **code structure analysis** — `prompt.py` rubric structure / `claude_client.py` call patterns / `parseLevelText` regex state. Code analysis reconnaissance absorbed inline by Oracle reduces agent round-trip costs.

### 2. Sensei Verification Effectiveness — Dry Review Pre-discovers Bug

W3 Sensei discovered the fallback weight hardcoding problem at `_parse_response` L203-209 while verifying SQL rubric quality and JSON schema compatibility. This bug only manifests when SQL submissions receive `totalScore=0` responses — it would not have appeared in general tests. **A dry review wave without code changes** proved its practical bug-discovery value.

### 3. In-Sprint Emergency Correction Decision — W2.5 Pattern Recurrence

Same pattern as Sprint 108 W4.5 (title suffix correction). The fallback weight bug found by W3 Sensei was immediately corrected as W2.5 instead of deferring to Sprint 110+. Judgment that correction cost (1 wave, 1 commit) is smaller than context reconstruction cost in a separate sprint. **2 consecutive applications** of the principle "close known quality defects within the same sprint."

### 4. SSOT Principle — Coherence Between Prompt Body and Code Weights

SQL_SYSTEM_PROMPT body explicitly states weights ("correctness 30%, efficiency 20%, ..."), and `_parse_response`'s fallback calculation also needs the same weights. Maintaining these two locations independently creates constant mismatch risk. Established a structure that extracts `ALGORITHM_WEIGHTS` / `SQL_WEIGHTS` constants to `prompt.py` as SSOT and cross-validates with prompt body weights and tests (`test_sql_efficiency_differs_from_algorithm`).

---

## Carried Over (Sprint 110+)

### Sprint 109 New Carry-overs

- **`_parse_response` fallback E2E verification**: E2E verification that fallback operates correctly on actual Claude API responses (totalScore=0 cases). Requires local Python 3.10+ environment.
- **GROUP_SYSTEM_PROMPT SQL branch**: SQL rubrics not yet applied to group analysis (`group_analyze`). Low priority since group analysis has low usage frequency for SQL.

### Carry-overs Inherited from Sprint 108 (No Change)

- **SQL Kit re-crawl cycle documentation** (Low): Specify re-crawl cycle in `PROGRAMMERS-QA.md`.
- **host-side build migration**: Blog/Frontend `npm run build` → GHA cache → Docker COPY only (LARGE — separate sprint). See `memory/sprint-106-deferred-items.md` for details.
- Small bundles: APK_CACHE_BUST conditionalization / NestJS tsc incremental / Monaco dynamic import / heavy deps audit / ai-analysis `pyproject.toml` `branch=true` activation / `scripts/check-coverage.mjs` per-service independent gate introduction.
- Blog `order` automation, series deep-dive option.

---

## Related Documents

- `services/ai-analysis/src/prompt.py` — SQL_SYSTEM_PROMPT, get_system_prompt(), ALGORITHM_WEIGHTS, SQL_WEIGHTS, get_weights()
- `services/ai-analysis/src/claude_client.py` — get_system_prompt(language) call, _parse_response(language) branch
- `services/ai-analysis/tests/test_prompt.py` — 19 SQL-related tests
- `services/gateway/scripts/fetch-programmers-problems.ts` — parseLevelText export, Level type export
- `services/gateway/scripts/fetch-programmers-problems.spec.ts` — parseLevelText boundary tests 13
- `docs/adr/sprints/sprint-108.md` — preceding sprint (D2 Known Limitation origin)
