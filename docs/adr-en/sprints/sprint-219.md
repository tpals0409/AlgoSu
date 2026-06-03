---
sprint: 219
title: "Quiz lint cleanup (rule 8 surface-form duplicates + apiStore GET cache assertions)"
date: "2026-06-03"
status: completed
agents: [Oracle, Curator, Herald, Critic, Librarian]
related_adrs: ["sprint-216", "sprint-217", "sprint-218"]
related_memory: ["sprint-window"]
topics: ["frontend", "quiz", "ci", "testing"]
tldr: "A small cleanup sprint clearing the two optional follow-up items deferred from Sprint 218. (1) check-quiz-content.mjs rule 8 (post-normalization duplicate WARN) compared acceptedAnswers after normalizeAnswer stripped all whitespace and punctuation, so it flagged 156 intentional surface-form variants such as '연결리스트'/'연결 리스트' and 'btree'/'b tree'/'b-tree' (whitespace/hyphen presence) as noise. The comparison key was switched to caseFoldKey (NFKC→lowercase→trim, preserving inner whitespace/hyphens/punctuation) so the rule only catches real duplicates that differ by case or leading/trailing whitespace. 156 WARN → 0. The narrowed rule immediately caught one genuine duplicate (db-22 '2PL'/'2pl', case-only), which was cleaned up. (2) Sprint 218 Critic herald P4 follow-up — the authenticated-path integration test (page.test.tsx Scenario 2) asserted only the saveResult POST and not the getBest-triggered GET/cache behavior; this was shored up with nth-call ordering assertions on finish() plus toHaveBeenCalledTimes(2), and a getBest cache-hit assertion was added to api-store.test.ts. User decision: rule 8 basis is 'case-insensitive + punctuation/whitespace preserved' (intentional variants preserved). No jest unit test for the lint script (jest roots=src/ only, scripts/*.mjs out of scope — keeping the 216/218 convention, node-run verification). 4 atomic commits. Verification: frontend tsc 0 / content-lint --strict exit 0 (rules 8 & 9 zero) / 147 suites 1498 tests PASS · global lines 87.6% · branches 78.96% gates met / next build ✓ /[locale]/quiz 37.5kB (bundle unchanged) / next lint 0 errors. Critic single round CLEAN. Code-side cleanup only — independent of live deploy. start commit 1813a5f."
---
# Sprint 219 — Quiz lint cleanup (rule 8 surface-form duplicates + apiStore GET cache assertions)

## Goal

- Clear the two items deferred as **optional follow-ups** from Sprint 218.
- **Remove rule 8 noise**: narrow `check-quiz-content.mjs` rule 8, which flagged 156 intentional surface-form variants as noise, so it only catches genuine duplicates.
- **Shore up apiStore GET cache assertions** (Sprint 218 Critic herald P4): fill the GET/cache assertion gap in the authenticated-path integration test.
- **Code-side cleanup only** — independent of live deploy (separate from the deferred operational `migration:run`).

## Background

### Rule 8 flagged intentional surface-form diversity as noise

The content lint rule 8 added in Sprint 218 (`checkNormalizedDuplicates`) WARNed any `acceptedAnswers` entries that became identical after `normalizeAnswer` (NFKC → lowercase → strip non-alphanumeric/Hangul → **strip all whitespace**). But all 156 current WARNs were **whitespace/hyphen surface-form pairs** like `['연결리스트','연결 리스트']`, `['btree','b tree','b-tree']`, `['logn','log n']`.

Because `normalizeAnswer` strips whitespace and punctuation, these synonyms all match against the same grading key — but in the content they are a **legitimate case**: both surface forms are shown for readability since people type them differently. Rule 8 reported this intentional diversity as duplication, emitting 156 lines of noise on every run despite being WARN-only (`--strict` exit 0, no CI block).

### apiStore GET cache assertion not shored up (Sprint 218 Critic herald P4)

`page.test.tsx`'s authenticated-path Scenario 2 (`completes game via apiStore`) asserted only the `saveResult` POST, not the GET triggered by the preceding `getBest` nor its cache behavior (no redundant re-GET during result-screen render). Sprint 218 Critic deferred this as P4 (non-blocking).

## Decision

### D1. Rule 8 basis — case-insensitive + punctuation/whitespace preserved (user-confirmed)

Switch rule 8's comparison key from `normalizeAnswer` (strips all whitespace/punctuation) to `caseFoldKey` (NFKC → lowercase → `trim`, **preserving inner whitespace/hyphens/punctuation**). As a result:

- Whitespace/hyphen surface-form variants like `'연결리스트'`/`'연결 리스트'`, `'btree'`/`'b tree'`/`'b-tree'` become **distinct keys** and pass (synonym diversity preserved).
- **Genuine duplicates differing only by case or leading/trailing whitespace** like `'stack'`/`'Stack'`, `'2PL'`/`'2pl'` become the same key and are caught as WARN.

156 → 0 on the current data. The user chose this over "strict exact-string" (case-sensitive too) — to keep a safety net for future case-only duplicates.

### D2. No unit test for the lint script (Oracle call)

No jest unit test is added to `check-quiz-content.mjs`. jest `roots` only includes `src/` and transform handles only `.tsx?`, so `scripts/*.mjs` is out of scope. We keep the Sprint 216 (lint introduced) / 218 (rules 8 & 9 added) convention of `node ... --strict` run verification. CI (`ci.yml:427`) gates with `--strict`, and this sprint verified `caseFoldKey`/`checkCaseFoldedDuplicates` behavior directly via `node -e` (case duplicate WARN / whitespace difference passes).

## Implementation

Branch `chore/sprint-219-quiz-lint-cleanup`, start commit `1813a5f`, 4 atomic commits. Wave A (Curator lint/content) → Wave B (Herald tests) → Wave C (Librarian ADR).

### Commits

| Hash | Content |
|------|---------|
| `a087ba9` | chore(frontend) — Curator: narrow `check-quiz-content.mjs` rule 8 to surface-form duplicates — switch to `caseFoldKey` (NFKC→lowercase→trim) comparison key, rename `checkNormalizedDuplicates`→`checkCaseFoldedDuplicates`, update header comment & WARN message. 156 WARN → 0 |
| `9cf0dc2` | fix(frontend) — Curator: remove db-22 `acceptedAnswers` `'2PL'`/`'2pl'` case-only duplicate (genuine duplicate found by the narrowed rule 8) |
| `2783db5` | test(frontend) — Herald: `page.test.tsx` Scenario 2 GET cache assertions + `api-store.test.ts` getBest cache-hit assertion |
| (ADR) | docs(adr) — Librarian: sprint-219 KR+EN + README index 156→157 · range 62~218→62~219 |

### Wave A — Curator (lint + content)

- **Narrow rule 8** (`a087ba9`): add a `caseFoldKey(raw)` helper — `raw.normalize('NFKC').toLowerCase().trim()`. It preserves inner whitespace/hyphens/punctuation, so intentional variants remain distinct keys. Switch `checkNormalizedDuplicates`'s grouping key from `normalizeAnswerJs` → `caseFoldKey`; since the meaning shifts from "normalization duplicate" to "case/leading-trailing-whitespace-only duplicate," rename the function to `checkCaseFoldedDuplicates`. Update the file header (rule 8 definition/examples), WARN message, the `checkWarnOnlyRules` caller, and the output label consistently. **Rule 9 (`checkEmptyNormalized`) and `normalizeAnswerJs` are kept** — rule 9 still uses `normalizeAnswerJs` (whitespace/punctuation stripped) to check "empty after normalization," so `normalizeAnswerJs` remains exported. 156 WARN → **0**.
- **Clean up the db-22 genuine duplicate** (`9cf0dc2`): the narrowed rule 8 caught exactly one real duplicate — `['2PL','2pl']` (db-22) — case-only, so `normalizeAnswer`'s lowercasing already grades them identically. Keep the standard abbreviation `'2PL'` and drop `'2pl'`. A case where narrowing the rule **removed noise and simultaneously surfaced one real cleanup target**.

### Wave B — Herald (apiStore cache assertions)

- **`page.test.tsx` Scenario 2 GET cache assertions** (`2783db5`): the `finish()` flow is `store.getBest()` (1 GET + memory cache) → `store.saveResult()` (POST + cache invalidate). The existing POST assertion was strengthened into nth-call ordering — 1st = option-less GET (`getBest`→`fetchAllBest`), 2nd = POST (`saveResult`). `toHaveBeenCalledTimes(2)` pins that the GET result is cached so there is no re-GET during result-screen render. (Scenario 2 has empty localStorage, so merge-up makes 0 `fetchApi` calls — only `finish()`'s GET+POST occur.)
- **`api-store.test.ts` getBest cache hit** (`2783db5`): previously only `getAllBest` cache-hit was covered. Asserted directly that calling `getBest` twice with different keys reads from the cached map, so `fetchApi` fires only once.

### Wave C — Librarian (ADR)

- sprint-219 KR+EN + `docs/adr/README.md` index 156→157 · range 62~218→62~219.

## Verification

Confirmed directly by Oracle (frontend):

- `tsc --noEmit` → **0 errors**
- `check-quiz-content.mjs --strict` → **exit 0** (rules 1–7 pass, **rules 8 & 9 zero** — 156 WARN removed + db-22 cleaned)
- `node -e` direct check — `caseFoldKey`: `stack`/`Stack` same key (✓), `연결리스트`/`연결 리스트` distinct keys (✓), `btree`/`b-tree`/`b tree` all distinct (✓), leading/trailing whitespace folded (✓). `checkCaseFoldedDuplicates`: 1 case-duplicate WARN, 0 for whitespace difference (✓).
- `jest --coverage` → **147 suites · 1498 tests PASS / 0 fail** (218's 1497 + getBest cache 1), global lines **87.6%** (gate 83) · branches **78.96%** (gate 71)
- `next build` → ✓ Compiled, `ƒ /[locale]/quiz` **37.5kB** (same as 218 — script/test-only, bundle unchanged)
- `next lint` → **0 errors** (only pre-existing `sidebar`/`sonner`/`useAutoSave` warnings, unrelated to quiz)

## Lessons

1. **WARN-only lint rules must surface only real risk without blocking intentional surface-form diversity** — when rule 8 used the grading normalization (`normalizeAnswer`, whitespace/punctuation stripped) for duplicate detection, it flagged readability-oriented intentional synonym pairs as noise. Separating a comparison key fit for the check's purpose (`caseFoldKey`, surface-form preserving) lets intentional variants pass while catching only genuine duplicates like case-only ones. **Grading normalization and duplicate-detection normalization have different purposes, so keep them separate.**
2. **The narrowed rule immediately found one genuine duplicate** — once the 156 noise lines were removed, the previously buried db-22 `'2PL'`/`'2pl'` case duplicate surfaced. Evidence that noise had been masking signal — refining a rule reduces false positives while raising the visibility of true positives.
3. **Respect test-infra boundaries to avoid scope creep** (D2) — `scripts/*.mjs` sits outside jest's `roots` (src/), so adding a unit test would entail a jest config change. Following the 216/218 convention with `node` run + `node -e` direct verification kept a small cleanup sprint from sprawling into infra work.

## Carry-over to Sprint 220+

- **Operational `identity_db` `migration:run` (SP217 `quiz_records`) + server redeploy + live `/quiz` E2E verification** (user/ops, important): merge ≠ live. Apply `20260602000000-SP217-CreateQuizRecords` to the operational `identity_db`, redeploy, then play `/quiz` while logged in to confirm cross-device best sync, per-difficulty records, and merge-up. Sprint 218's regression safety net + 219's lint cleanup verified the code side, but live is unverified.
- **GA4 data stream URL alignment + Enhanced Measurement history page_view OFF + production page_view UAT** (user, carried from Sprint 210/211/212)
- **Operational Sprint 196 `problem_db` migration run** (user/ops)
- **Evaluate automating periodic harness `--full` CI runs** (carried from Sprint 209)

## Critic cross-review

**R1 — CLEAN** (Codex gpt-5.5, `codex review --base 1813a5f -c model=gpt-5.5`, codex-cli 0.130.0, session `019e8c2b-1feb-7cd0-ad56-c32cec2494ae`)

- Critical / High / Medium / Low **0**.
- "The changes are limited to the quiz content warning logic, one redundant accepted answer removal that remains covered by normalization, and test assertions. I did not identify any introduced correctness, security, performance, or maintainability issue that warrants an actionable finding."

**Final — CLEAN**. Single round, 0 actionable findings.
