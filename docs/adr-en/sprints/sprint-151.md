# Sprint 151 — Programmers SQL Problem Entry: Editor Language Auto SQL Selection

- **Status**: Completed ✅
- **Period**: 2026-05-13 (single day)
- **Trigger**: User feedback
- **start_commit**: `2f68402` (Sprint 150 end)
- **end_commit**: `4313561` (Sprint 151 hotfix end)
- **Merged PRs**: 2 (squash merge)

## 1. Background / User Feedback

When users enter Programmers SQL category problems (MySQL/Oracle), the editor default language was hardcoded to `'python'`, requiring manual switching to SQL every time — creating friction. User requested removal of this friction.

## 2. Decisions

### 2.1 Schema Decision
- New `category` enum column on Problem entity (`'ALGORITHM' | 'SQL'`, default `'ALGORITHM'`, NOT NULL)
- Enum name: `ProblemCategory` (PascalCase, matching existing `Difficulty`/`ProblemStatus` pattern)
- Enum values: UPPER_SNAKE_CASE (backend standard)
- Migration timestamp: `1709000016000` (sequential, after existing 1709000015000)
- **Reason**: Same enum (`'algorithm'/'sql'`) already exists in Gateway sync stage (Sprint 108) → SSOT consistency. More explicit than tags marker

### 2.2 UX Decision
- `useRef` guard on Problem mount for single-time `setLanguage('sql')` application
- After user manual change within same mount: not forced again (ref true)
- New page mount → new ref → SQL again (intended UX, matches user feedback)
- ALGORITHM or category undefined (legacy): keep existing `'python'`

### 2.3 PR Strategy
- Single feature PR + separated atomic commits (backend → gateway sync → frontend)
- Dependencies clear, so splitting would cause frontend fallback debt → bundled

### 2.4 SQL Language Identifier
- Use existing `'sql'` single value (LANGUAGES constant, Sprint 108)
- MySQL/Oracle split does not exist → simplified

## 3. Implementation Flow

### 3.1 PR #229 — Main PR (`998ec4e`)
**11 commits, 13 files, +449/-10**

| Wave | Agent | Changed Files | Verification |
|------|-------|--------------|-------------|
| Wave 1 (Backend) | architect (sonnet) | `problem.entity.ts` (+ProblemCategory enum) / `create-problem.dto.ts` (@IsEnum) / `1709000016000-AddCategoryToProblems.ts` (migration) / `problem.service.ts` (inject in create/update) | problem 170 PASS (+6) |
| Wave 2 (Gateway sync) | architect (sonnet) | `programmers.service.ts` (toProblemCategoryEnum helper export, lowercase→uppercase conversion) | gateway 783 PASS (+4) |
| Wave 3 (Frontend READ) | palette (opus) | `types.ts` (`Problem.category`) / `page.tsx` (useRef + useEffect ref-guarded setLanguage) / `__tests__/sql-auto-language.test.tsx` (4 scenarios 270 lines) | frontend 1356 PASS (+4) |
| Wave 3 R2 (Frontend WRITE) | palette (opus) | `types.ts` (`CreateProblemData.category` + `UpdateProblemData.category`) / `AddProblemModal.tsx:675` (SQL branch `category: 'SQL' as const`) / `AddProblemModal.test.tsx` (+2 verifications) | AddProblemModal 7/7 PASS |

### 3.2 PR #230 — Trivy Hotfix (`4313561`)
**2 commits, 4 lockfiles, +74/-58**

| Package | Before → After | CVE | Affected Services |
|---------|---------------|-----|------------------|
| Next.js | 15.5.15 → 15.5.18 | CVE-2026-44578 SSRF / CVE-2026-44579 DoS / GHSA-8h8q-6873-q5fj etc. (total 9 HIGH) | frontend |
| fast-uri | 3.1.0 → 3.1.2 | CVE-2026-6321 path traversal | frontend, gateway, submission, problem |
| fast-xml-builder | 1.1.4 → 1.2.0 | CVE-2026-44665 XML Comment/CDATA Injection | gateway (transitive of fast-xml-parser 5.5.6) |

**npm audit final**: HIGH/CRITICAL = **0** across all services, package.json caret unchanged (lockfile only updated)

## 4. Critic Rounds (Auto-Critic Queued 4 Times)

### 4.1 Wave 1+2 Auto-Critic R1
- session: `019e1eeb-1fdb-71a0-879c-fea828bb6efb`
- P0/P1 0, **P2 1**: `category` not passed in gateway → problem-service write path → risk of silent ALGORITHM storage for SQL problems
- Resolution: Found in Wave 3 R2 at exact entry point (AddProblemModal) and handled in bulk

### 4.2 Wave 3 Auto-Critic R1
- session: `019e1ef2-96f4-7953-9e68-87e5071c09f9`
- P0/P1 0, **P2 1**: Same essence — `AddProblemModal.tsx:675` passes `allowedLanguages: ['sql']` but `category: 'SQL'` not passed
- Codex identified exact entry point (concrete example of Wave 1+2 P2)
- Resolution path specified: `CreateProblemData` type + `AddProblemModal` payload + test strengthening

### 4.3 Wave 3 R2 Auto-Critic
- session: `019e1efa-8ae4-7df3-859b-b7e189b884d9`
- ✅ **Critical/High/Medium 0, mergeable**
- Low 2 (optional): test name mismatch, UpdateProblemData.category proactive expansion (neither blocking)
- Codex original: "I did not find a discrete regression or blocking issue in the modified lines"

### 4.4 Hotfix Auto-Critic
- session: `019e1f14-e88e-75a3-a266-1e7abfe8c8ba`
- ✅ **Mergeable, 0 introduced defects**
- Additional observations: gateway `xml-naming@0.1.0` new transitive (NaturalIntelligence MIT, no risk), Next.js patch 3-step SWC binary all-platform consistent

## 5. Verification

### 5.1 PR #229 (Main PR)
- problem 170 / gateway 783 / frontend 1356 tests PASS
- ESLint / tsc --noEmit / Next.js + NestJS build clean
- CI: 30 pass / 0 fail / 9 skip, mergeStateStatus CLEAN
- merged at 2026-05-13T01:47:30Z, mergeCommit `998ec4e`

### 5.2 Main Push CI Failure + Hotfix
- run `25773141824` (main push @ `998ec4e`): **Trivy Scan frontend + gateway FAILED** (HIGH 9 + 1)
- Cause: New CVEs exposed by Trivy DB update (unrelated to Sprint 151 changes)
- **Sprint 150 lesson #1 directly reproduced**: paths filter PR-stage TRIVY SKIPPING → main push + image build + fresh DB exposure

### 5.3 PR #230 (Hotfix)
- frontend 1356 / gateway 783 tests PASS (no regressions)
- CI: 30 pass / 0 fail / 9 skip, MERGEABLE/CLEAN
- merged at 2026-05-13T02:15:21Z, mergeCommit `4313561`

### 5.4 Main Push CI (After Hotfix) — Core Verification
- run `25774076614` (main push @ `4313561`):
  - **state=completed | conclusion=success**
  - **38 jobs pass / 0 fail**
  - **Trivy Scan 8 services all SUCCESS** (frontend/gateway/submission/problem/identity/ai-analysis/blog/github-worker)
- Main green restored ✅

## 6. Regression Blocking Core 8 Layers (Sprint 145~150 Cumulative Pattern Inherited)

| # | Layer | Location |
|---|-------|----------|
| 1 | Backend entity enum | `problem.entity.ts` ProblemCategory |
| 2 | Backend DTO validation | `create-problem.dto.ts` @IsEnum |
| 3 | Backend migration | `1709000016000-AddCategoryToProblems.ts` |
| 4 | Backend service injection | `problem.service.ts` create/update |
| 5 | Gateway sync conversion | `programmers.service.ts` toProblemCategoryEnum() |
| 6 | Frontend type | `types.ts` (Problem + CreateProblemData + UpdateProblemData) |
| 7 | Frontend WRITE payload | `AddProblemModal.tsx` SQL branch category delivery |
| 8 | Frontend READ auto-selection | `page.tsx` ref-guarded useEffect |

**8th cumulative dimension** — Sprint 145 (metric) → 146 (label) → 147 (panel-title+variable) → 148 (rule-label+dashboard-structure) → 149 (regex-robustness) → 150 (submission service problem context fallback) → **151 (Problem schema + Frontend integration 6 layers + Gateway conversion + Hotfix dependency security)**

## 7. New Patterns

1. **Auto-Critic R1 → R2 Same Essence Refinement Pattern** — Wave 1+2 AC identified general issue (write path), Wave 3 AC identified exact entry point (AddProblemModal). Integrating two perspectives allowed reaching exact change location with single R2 delegation
2. **Frontend WRITE/READ Separated Diagnosis** — User feedback was READ scenario, but prerequisite is WRITE flow (admin registration storing category 'SQL'). This PR closes both sides, achieving core satisfaction
3. **palette Entry Point Autonomous Evaluation** — create/edit page evaluated as low user scenario frequency → outside this PR scope (avoids overscope, subsequent optional)
4. **Sprint 150 Lesson #1 Direct Reproduction → Immediate Hotfix Standardization** — Standard response to debt from paths filter PR-stage SKIP / main-stage execution jobs (Trivy) exposed post-main-push. This cycle is reproduction case + lockfile-only hotfix as response becomes standard workflow
5. **Auto-Critic Auto-Queuing 4 Times in Short Cycle** — Auto-queued for all Wave splits + R2 + hotfix in same PR. R1/R2 results immediately reflected without human intervention. Single day / 2 PRs / Auto-Critic 4 times / all clean finalized

## 8. Lessons

1. **User feedback essence closes both sides of data flow, not just surface** — "Auto SQL on SQL entry" is READ surface, but prerequisite WRITE flow must be closed for operation. Simultaneous analysis of surface + prerequisite required when handling user feedback
2. **Paths filter bypass debt exposed only at main push time — immediate hotfix is standard** — Sprint 150 lesson #1 verified. PR CI green does not guarantee main green. Pattern of immediately responding with separate hotfix PR to main push CI failure is standard (no wait/defer)
3. **Dependency CVE exposure from Trivy DB update can be handled lockfile-only** — package.json caret range unchanged, lockfile only updated via `npm install`/`npm update` to auto-apply patch-level. Near zero breaking change risk. Standard hotfix pattern
4. **Auto-Critic R1 different perspectives refined in R2** — Wave 1+2 AC vs Wave 3 AC caught the same essence P2 from different perspectives (general vs exact entry point). Integrating two perspectives allows reaching exact change location with single R2 delegation (variation of Sprint 146 R1 1 → R2 2 additional catches pattern)
5. **Auto-Critic Codex cross-verification value reconfirmed** — All 4 invocations made accurate P2 catches or clean verdicts. P0/P1 0 + accurate essential non-fulfillment P2 identification → effectively served as pre-merge safety net. **This cycle strongly validates Auto-Critic auto-queuing policy (Sprint 117~) effectiveness**

## 9. Sprint 152 Carryover Seeds

### UAT User Direct (Outside Oracle's Scope)
- **Seed #5**: Programmers resubmission scoring pass confirmation (8 sprints accumulated, SQL auto-selection UAT naturally included with this PR)
- **Seed #9**: English environment + production Grafana CB dashboard ai-analysis visual consistency

### Follow-up (Optional, Outside this PR Scope)
- create/edit page.tsx category UI addition (palette evaluation: low user scenario frequency → outside this PR scope)
- Programmers URL automatic category inference (admin input friction reduction via sourceUrl pattern matching)
- Existing SQL problem data backfill (manual ADMIN work or import script — new SQL problems auto-applied)
- Sprint 150 remaining 3 candidates (`.claude-tools/` Oracle dispatch tool cleanup / CI paths filter bypass debt check automation / prom-client default metric stale check)

## 10. Metrics

| Item | Value |
|------|-------|
| Period | 2026-05-13 (single day) |
| origin/main | `2f68402` → **`4313561`** |
| Merged PRs | 2 (#229 main / #230 hotfix) |
| Main PR commits | 11 (squash 1) |
| Hotfix commits | 2 (squash 1) |
| Changed files (main PR) | 13 (+449 / -10) |
| Changed files (hotfix) | 4 lockfiles (+74 / -58) |
| Auto-Critic invocations | 4 (R1×3 + R2 hotfix) — all P0/P1 0 |
| Regression blocking layers | 8 (Sprint 145~150 cumulative 8th dimension) |
| Branch discipline | 17 consecutive sprints compliant (0 direct commits to main) |
| Tests | problem 170 / gateway 783 / frontend 1356 PASS |
| Main CI final | run `25774076614` SUCCESS, 38 pass / 0 fail, Trivy 8 services all SUCCESS ✅ |
