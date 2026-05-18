---
sprint: 108
title: "Programmers SQL Problem Support"
period: "2026-04-21"
status: complete
start_commit: f605c8d
end_commit: 7c7d518
---

# Sprint 108 — Programmers SQL Problem Support

## Background

AlgoSu has been crawling Programmers algorithm problems (`challenges?levels=0~5`) and managing them as a static JSON cache. However, the Programmers SQL High Score Kit (`tab=sql_practice_kit`) uses a separate URL structure (Part-based pages) that the existing crawler could not collect.

As a result, there were 4 gaps: **0** SQL problems in the gateway static cache, `'sql'` not registered in the submission DTO whitelist, no support in the frontend language dropdown or Monaco highlighting, and no auto-tagging logic in AddProblemModal.

Sprint 108 fills these four gaps through **core code extension + data regeneration**. The scoring method (AI feedback retained) and AI prompt branching are deferred to Sprint 109+; this sprint targets "completing the pipeline from search → registration → submission → AI feedback receipt."

Wave structure: W1 (scout reconnaissance) → W2 (architect 3 core modules) → W3 (palette UI) → W4 (herald crawling) → W4.5 (architect emergency correction) → W5 (scribe ADR).

## Goals

| Item | Content | Status |
|------|---------|--------|
| SQL data collection | Crawler SQL Kit path addition, JSON regeneration | ✅ Complete (106 items) |
| Submission pipeline | sql language whitelist addition | ✅ Complete |
| Frontend support | Language constants / Monaco mapping / SQL badge | ✅ Complete |
| Title contamination correction | Bulk removal of "Level N X completed" suffixes | ✅ W4.5 Complete |
| Test regression defense | All service thresholds met | ✅ Complete |

---

## Decisions

### D1. Scoring Method — Retain Existing AI Feedback

**Decision**: No new sql-judge service introduced. Existing AI feedback pipeline retained as-is.

**Rationale**:
- Service stability > feature completeness. SQL execution scoring requires separate execution environment (DB sandbox) setup and security isolation exceeding Sprint 108 scope.
- AI feedback can provide syntax/logic/style feedback for SQL queries too (quality is a Known Limitation per D2).
- Avoids complexity increase by maintaining non-execution scoring architecture.

**Alternative deferred**: sql-judge service separated into Sprint 110+ independent sprint for consideration.

### D2. AI Prompt SQL Branch Deferred

**Decision**: No SQL-specific branch (`language='sql'` prompt conversion) added to `ai-analysis/prompt.py`.

**Rationale**:
- Minimize Sprint 108 scope. Adding the branch requires additional AI response quality verification tests.
- Quality degradation where AI might give "time complexity" algorithm feedback in SQL context explicitly documented as **Known Limitation** in ADR and accepted.
- Sprint 109+: design `build_user_prompt(language)` branch + evaluation test set together.

**Known Limitation**: AI feedback quality for SQL submissions may be lower than algorithm submissions. Pipeline completion itself functions normally.

### D3. Crawler SQL Kit Path — Direct Part ID Constant Iteration

**Decision**: Add new `collectSqlPart(page, partId)` function that directly iterates Part ID constant array `[17042, 17043, 17044, 17045, 17046, 17047]` for SQL Kit collection.

**Rationale**:
- Scout W1 reconnaissance: After entering SQL Kit, branches into 6 `/parts/{id}` pages, each a single-scroll page (no pagination). Direct constant array iteration is simpler and more stable than dynamic link parsing.
- No `?page=N` loop needed. All problems within each Part exposed on a single page.
- Existing `extractCards` anchor selector (`a[href*="/learn/courses/30/lessons/"]`) also compatible with SQL Part pages.

### D4. Level Parsing Regex Extension

**Decision**: `parseLevelText` regex `/[Ll]v\.?\s*(\d)/` → `/(?:[Ll]v\.?\s*|[Ll]evel\s*)(\d)/`

**Rationale**:
- Scout W1 reconnaissance: Algorithm challenge pages use "Lv. 1" notation; SQL Part pages use "Level 1" notation. Both formats coexist.
- Existing regex cannot parse "Level N" format → risk of level value `null` fallback.
- After extended regex applied, Herald W4 actual measurement confirmed 0 level=null occurrences across 106 SQL items.

**Post-verification**: Herald W4 → SQL level distribution Lv1:31 / Lv2:36 / Lv3:20 / Lv4:17 / Lv5:2 / null:0.

### D5. category Field Introduction — ProgrammersRawItem

**Decision**: Add optional `category?: 'algorithm' | 'sql'` field to `ProgrammersRawItem`. Default `'algorithm'` in `loadFromFile()` when absent (legacy compatibility).

**Rationale**:
- `sourcePlatform` is for platform (BOJ/PROGRAMMERS) distinction — different semantics. Separate field needed for category distinction.
- Existing 613-item JSON has no `category` field → legacy compatible via `item.category ?? 'algorithm'`.
- `matchesQuery()` sql token search path also enhanced based on `category === 'sql'`.

### D6. Submission DTO Whitelist — Add sql

**Decision**: Add `'sql'` to `ALLOWED_LANGUAGES`. Alphabetical re-sort (`rust → sql → swift`).

**Rationale**:
- Unlocking DTO-level blocking activates SQL query submission pipeline.
- class-validator based whitelist — unregistered languages (`unknown_lang`) are still rejected.
- 2 unit tests added (allow/reject); submission 239 total tests — 0 regression.

### D7. Frontend sql Language Constant — Monaco Built-in SQL Mode

**Decision**: Add `{ value: 'sql', label: 'SQL' }` to `LANGUAGES`. Add `sql: 'sql'` to `MONACO_LANG_MAP` (Monaco built-in SQL mode).

**Rationale**:
- Monaco Editor officially supports SQL built-in → no custom language definition needed.
- `LANGUAGES` array and `MONACO_LANG_MAP` object are separate SSOT structures — simultaneous addition to both required.

### D8. AddProblemModal SQL Auto-tagging

**Decision**: `isSqlProblem(p)` — dual check: `category === 'sql'` OR `tags.includes('SQL')`. When matched: apply `allowedLanguages: ['sql']`, `tags: mergeSqlTag()`, show SQL badge.

**Rationale**:
- UX consistency. Removes burden of user manually selecting language or adding SQL tag when registering a SQL problem.
- Reuses existing design tokens `--primary-soft` (background) / `--primary` (text) → no new tokens added.
- WCAG AA text contrast ratio 4.5:1+ met (`--primary`: `#715DA8` Light / `#A08CD6` Dark).
- Algorithm problems: existing behavior 100% preserved (allowedLanguages not sent).

### D9. SQL Title Suffix Contamination — W4.5 Emergency Correction

**Decision**: Introduce pure function `stripSqlTitleSuffix(rawTitle: string): string`. Regex: `/\s+Level\s+\d+.*$/`. Apply title cleaning in `collectSqlPart`.

**Rationale**:
- Herald W4 actual result: All 106 SQL titles contained suffixes in "Level 1 94,495 completed" format. SQL Part page anchors wrap title+level+completion-count in a container structure — `anchor.textContent` collected the entire content.
- Non-blocker but affects UX of all 106 items → immediate correction in same sprint instead of deferring to Sprint 109+.
- Pure function separation: correction could have been an inline 1-line regex in the crawler script, but separated as an `export`able pure function with 4 unit tests. Allows easy regex modification when Programmers UI changes.
- **Correction result**: After W4.5 re-crawl (92,631ms), 0 suffix remaining.

---

## Fact Cross-Reference Table (Scribe verification, directly read all W1–W5 reports)

| # | Fact item | Expected | Actual (source) | Match |
|---|-----------|---------|----------------|-------|
| 1 | SQL Kit total problem count | 106 | 106 (scout W1 estimate, herald W4 actual) | ✅ |
| 2 | Per-Part collection | SELECT:33 / SUM,MAX,MIN:10 / GROUP BY:24 / IS NULL:8 / JOIN:12 / String,Date:19 | SELECT:33 / SUM,MAX,MIN:10 / GROUP BY:24 / IS NULL:8 / JOIN:12 / String,Date:19 (herald W4) | ✅ |
| 3 | Crawler execution time | W4: 96,141ms / W4.5: 92,631ms | W4: 96,141ms (herald W4) / W4.5: 92,631ms (architect W4.5) | ✅ |
| 4 | JSON total count | 613 before → 689 after (+76) | 613 → 689 (+76 items) (herald W4) | ✅ |
| 5 | Algorithm reclassification | 613 → 583 (-30) | 613 → 583 (-30 items, not deletion — sql reclassification) (herald W4) | ✅ |
| 6 | SQL level distribution | Lv1:31 / Lv2:36 / Lv3:20 / Lv4:17 / Lv5:2 / null:0 | Lv.1:31 / Lv.2:36 / Lv.3:20 / Lv.4:17 / Lv.5:2 / null:0 (herald W4) | ✅ |
| 7 | tags 'SQL' inclusion | 106/106 (all) | 106/106 all confirmed (herald W4) | ✅ |
| 8 | gateway tests | 760 passed | 760 passed (architect W4.5) | ✅ |
| 9 | submission tests | 239 passed | 239 passed (architect W2) | ✅ |
| 10 | frontend tests | 1238 passed | 1238 passed (palette W3) | ✅ |
| 11 | frontend coverage | lines 86.93% / branches 76.47% | lines 86.93% / branches 76.47% (palette W3) | ✅ |
| 12 | Commit count (Sprint 108) | **6** | **7** — a7d7b34·e9ef013·9f1d343 (architect W2) / b096190 (palette W3) / 6bb92af (herald W4) / 86a9ad0·7c7d518 (architect W4.5) | ⚠️ |
| 13 | title suffix remaining | 0 items | 0 items (architect W4.5 full check) | ✅ |

### Fact discrepancy — Item 12: Commit count

**Expected**: 6  
**Actual**: 7

**Original report citation**:
- architect W2 (task-20260421-175127): `c1: a7d7b34`, `c2: e9ef013`, `c3: 9f1d343` — **3 items**
- palette W3 (task-20260421-180723): `SHA: b096190` — **1 item**
- herald W4 (task-20260421-181921): `SHA: 6bb92af` — **1 item**
- architect W4.5 (task-20260421-183324): `c1: 86a9ad0`, `c2: 7c7d518` — **2 items**

Total: 3 + 1 + 1 + 2 = **7 items**. Oracle work order "6" was a miscount (inconsistent with the list). Actual commit count recorded as 7.

---

## Outputs and Changed Files

| File | Action | Wave | Description |
|------|--------|------|-------------|
| `services/gateway/scripts/fetch-programmers-problems.ts` | Modified | W2/W4.5 | SQL Kit collection path (collectSqlPart), regex extension, stripSqlTitleSuffix |
| `services/gateway/scripts/fetch-programmers-problems.spec.ts` | New | W4.5 | stripSqlTitleSuffix unit tests 4 items (scripts-only) |
| `services/gateway/src/external/programmers.service.ts` | Modified | W2 | category schema, matchesQuery sql path, response exposure |
| `services/gateway/src/external/programmers.service.spec.ts` | Modified | W2 | SQL fixture 2 items, 4 new tests, count update |
| `services/gateway/data/programmers-problems.json` | Regenerated | W4/W4.5 | 689 items (algorithm:583, sql:106), title suffixes removed |
| `services/gateway/data/PROGRAMMERS-QA.md` | Modified | W4/W4.5 | SQL Kit collection result and correction history section added |
| `services/submission/src/submission/dto/create-submission.dto.ts` | Modified | W2 | sql whitelist addition |
| `services/submission/src/submission/dto/create-submission.dto.spec.ts` | New | W2 | sql allow + unknown_lang reject unit tests 2 items |
| `frontend/src/lib/constants.ts` | Modified | W2 | sql added to LANGUAGES |
| `frontend/src/lib/api.ts` | Modified | W3 | ProgrammersSearchItem.category type addition |
| `frontend/src/components/submission/CodeEditor.tsx` | Modified | W2 | sql added to MONACO_LANG_MAP |
| `frontend/src/lib/__tests__/constants.test.ts` | Modified | W2 | language count 9→10, sql test added |
| `frontend/src/components/ui/AddProblemModal.tsx` | Modified | W3 | SQL auto-tagging logic + SQL badge + helper functions |
| `frontend/src/components/ui/__tests__/AddProblemModal.test.tsx` | Modified | W3 | SQL badge 2 + auto-tagging 2 tests added |

Commit list:
- `a7d7b34` — feat(gateway): add SQL kit crawling path + category schema
- `e9ef013` — feat(submission): allow sql in language whitelist
- `9f1d343` — feat(frontend): add sql to language list + monaco map
- `b096190` — feat(frontend): add SQL auto-tagging + badge in AddProblemModal
- `6bb92af` — chore(gateway): regenerate programmers-problems.json with SQL kit (106 problems)
- `86a9ad0` — fix(gateway): strip level/completion suffix from SQL problem titles
- `7c7d518` — chore(gateway): regenerate programmers-problems.json with clean SQL titles

---

## Lessons Learned

### 1. Scout Reconnaissance Effectiveness — Pre-discovered Regex Mismatch

W1 scout pre-discovered the level notation difference between algorithm pages ("Lv. N") and SQL Part pages ("Level N"). Without reconnaissance, running the crawler would have produced level=null fallback for 106 items, only discovered during herald W4 result verification. Pre-reconnaissance advanced the regex extension timing to the W2 design stage.

### 2. Value of Atomic Commit Separation — Isolating Impact Scope in W4.5 Correction

Architect W2 separated crawler/submission/frontend 3 modules into 1 commit each. During W4.5 correction, only the crawler script needed patching — isolating impact to the single file `fetch-programmers-problems.ts`. With a single large commit, submission/frontend code would have been intermingled, increasing review cost.

### 3. Necessity of Crawler Result Sample Verification — Immediate Title Suffix Discovery

Herald W4 manually verified 3 sample items (59034·59035·59036) after JSON regeneration, immediately discovering the "Level 1 94,495 completed" suffix contamination. If only count/category/level statistics were verified, the contamination could have been missed until the PR review stage. **Add sample title verification to the crawler execution checklist**.

### 4. Decision to Correct UX Before PR — 'Sprint Closing Quality > Speed'

Herald W4 classified it as "non-blocker" and proposed Sprint 109 follow-up, but Oracle decided on immediate correction in the same sprint considering the UX impact on all 106 items. Judgment not to defer known quality degradation as a Known Issue. W4.5 additional cost (1 wave, 2 commits, 92-second re-crawl) judged smaller than correction cost in Sprint 109.

### 5. Justification for Deferring AI Prompt Branch

Adding a prompt branch in SQL context requires an AI response quality verification test set. Exceeds Sprint 108 scope. Explicitly documenting as a Known Limitation and designing `build_user_prompt(language)` branch + evaluation criteria together in Sprint 109+ is more robust.

### 6. Design Benefit of stripSqlTitleSuffix Pure Function Separation

The correction could have worked as an inline 1-line regex in the crawler script, but Architect W4.5 separated it as an `export`able pure function and added 4 unit tests. When Programmers UI changes the suffix format, the response cycle of regex modification → test verification is preserved. Establishing **crawler utility functions as testable units** as a pattern.

---

## Carried Over (Sprint 109+)

### Sprint 108 New Carry-overs

- **AI prompt SQL branch** (D2): Add `language='sql'` branch to `ai-analysis/prompt.py` + design SQL response quality evaluation test set. Resolve Known Limitation.
- **SQL Part level notation regex re-check** (Medium): Monitor possibility of notations beyond "Level N" when Programmers UI changes. Maintain `parseLevelText` regex extension history.
- **SQL Kit re-crawl cycle documentation** (Low): Specify re-crawl cycle based on SQL Kit problem addition frequency (quarterly–biannual) in `PROGRAMMERS-QA.md`.

### Carry-overs Inherited from Sprint 106/107 (No Change)

- **host-side build migration**: Blog/Frontend `npm run build` → GHA cache → Docker COPY only (true L2 achievement path). See `memory/sprint-106-deferred-items.md` for details.
- APK_CACHE_BUST conditionalization, NestJS tsc incremental, Monaco dynamic import, heavy deps audit
- ai-analysis `pyproject.toml` `branch=true` activation (Python branches axis measurement)
- `scripts/check-coverage.mjs` per-service independent gate introduction
- submission/problem/identity lcov actual measurement collection
- Blog post `order` field automation (date-based sorting migration consideration)

---

## Related Documents

- `services/gateway/data/PROGRAMMERS-QA.md` — SQL Kit collection inspection history
- `services/gateway/scripts/fetch-programmers-problems.ts` — Crawler implementation (collectSqlPart, stripSqlTitleSuffix)
- `frontend/src/components/ui/AddProblemModal.tsx` — SQL auto-tagging implementation
- `memory/project-programmers-migration.md` — Sprint 95–97 BOJ→Programmers migration roadmap (reference)
- `/Users/leokim/.claude/plans/glistening-roaming-bear.md` — Approved plan
- Agent result reports:
  - scout W1: `~/.claude/oracle/inbox/scout-task-20260421-174340.md`
  - architect W2: `~/.claude/oracle/inbox/architect-task-20260421-175127.md`
  - palette W3: `~/.claude/oracle/inbox/palette-task-20260421-180723.md`
  - herald W4: `~/.claude/oracle/inbox/herald-task-20260421-181921.md`
  - architect W4.5: `~/.claude/oracle/inbox/architect-task-20260421-183324.md`
