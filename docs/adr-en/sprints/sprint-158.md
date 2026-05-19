---
sprint: 158
title: "ADR KR/EN Translation Gap Bulk Backfill (Blog-Published ADR Bilingual Completion)"
date: "2026-05-19"
status: completed
agents: [Oracle, Scribe, Architect]
related_adrs: ["sprint-157"]
related_memory: ["sprint-window"]
---
# Sprint 158 — ADR KR/EN Translation Gap Bulk Backfill

## Goals

- Backfill actual EN content into the `docs/adr-en/` structure introduced by Sprint 157 P10 (content i18n infrastructure), raising EN coverage 1/106 (0.9%) → 106/106 (100%)
- Eliminate API key dependency via Scribe direct translation (no `scripts/translate-adr.mjs`)
- Establish Sprint 157 seed #25 (`check-adr-en-coverage --strict` CI hard gate) for automatic regression prevention
- Address user direct feedback → immediate hotfix cycle (Sprint 157 pattern inheritance) to fix 4 UI i18n mapping gaps

## Decisions

- **Translation method**: User-confirmed option — skip `translate-adr.mjs` (Claude API, requires ANTHROPIC_API_KEY), use **Scribe Agent direct translation** instead. Claude session has native translation capability → bypasses API key requirement + zero cost
- **Batch split (Phase B 95 files)**: 3 parallel Agents (B-1: sprint-40~87-plan 30 / B-2: sprint-91~127 37 / B-3: sprint-128~155 28) — distributes single-Agent context burden + reduces wall-clock time
- **Phase separation**: Phase A (pilot 10 — permanent 8 + sprint-156 + topics/sprint-95) → verification → Phase B (full 95) → Phase C (CI gate). Risk minimization through pilot quality check before full batch
- **Simultaneous CI hard gate activation (seed #25 settlement)**: Immediately after Phase B reaches 100%, added `--strict` step to `quality-docs` job → new ADR EN omissions blocked automatically via CI fail
- **Translation policy**: Compliance with `docs/adr-en/README.md` policy — preserve frontmatter (translate only `title`), keep technical terms in English (Outbox/Saga/MSA/Gateway etc.), preserve code blocks/PR links/file paths/sprint slugs 100%, translate only mermaid node labels
- **Intentional Korean preservation allowed**: i18n bilingual reference tables, KR blog body quotations (sprint-100), regex patterns (`주차`/`월`), accessibility label examples (`일요일`), code literals (`'알림'`/`'분류'` etc.), API query examples (`query=입문`) — 9 EN sprint pages retain intentional Korean

## Implementation (2 PR squash merge, origin/main `1ba57d6` → **`a73c596`**)

| PR | Phase | Owner | Changes | Lines |
|----|-------|-------|---------|-------|
| [#269](https://github.com/tpals0409/AlgoSu/pull/269) | Phase A/B/C (3 commits) | scribe×4 + architect | 105 ADR EN translation + CI hard gate | +14,939 |
| [#270](https://github.com/tpals0409/AlgoSu/pull/270) | hotfix UI i18n | architect | EN page Korean leak 4 locations fix | +20 −6 |

### PR #269 Details (Phase A/B/C)

**Phase A — Permanent 8 + topic 1 + sprint-156 = 10 files** (commit 22b7cc5, +1,292):
- Permanent ADRs (8): ADR-001 (Gateway → Identity DB Separation), ADR-002 (Outbox Pattern), ADR-003 (Redis/RabbitMQ ACL), ADR-024 (Admin Server-side Guard), ADR-025 (Gateway OAuth Error Normalization), ADR-026 (Stuck Rollouts & Sealed Secrets Debt), ADR-027 (Aether GitOps Branch Discipline), ADR-028 (Dev Cluster Separation)
- Sprint (1): sprint-156 (Sprint 150 Unresolved Automation Debt 3-Item Batch)
- Topic (1): topics/sprint-95-programmers-dataset
- 2 parallel Agents (permanent 8 / sprint+topic 2)

**Phase B — Sprint 95 files** (commit 86734c9, +13,643):
- B-1 (30): sprint-40, 48, 51, 62~71, 72~87, 87-plan
- B-2 (37): sprint-91~99 (Programmers migration), 100~127 (CI refactoring)
- B-3 (28): sprint-128~155 (safety net + recent)
- 3 parallel Agents simultaneous execution — distributes single-session context burden

**Phase C — CI hard gate** (commit 0509d91, +4 −1):
- `.github/workflows/ci.yml` `quality-docs` job step added:
  ```yaml
  - name: Check ADR EN coverage (strict)
    run: node scripts/check-adr-en-coverage.mjs --strict
  ```
- Added `scripts/check-adr-en-coverage.mjs` to `detect-changes` paths filter
- Updated `docs/adr-en/README.md` coverage tracking section (advisory → hard gate)

### PR #270 Details (hotfix UI i18n)

**Direct user feedback**: "the English translation doesn't seem to match" → build output analysis discovered 4 locations:

1. **`blog/src/app/(adr)/layout.tsx`** — Korean description hardcoded → English-only
   - `"AlgoSu 프로젝트의 아키텍처 결정 기록"` → `"architecture decisions and sprint retrospectives"`
2. **`blog/src/components/locale-toggle.tsx`** — aria-label/title asymmetry (KR shown on EN pages, EN shown on KR pages)
   - Fix: `isEn ? 'Switch to Korean' : '영어로 전환'` (native language per locale)
3. **`blog/src/components/blog/code-block.tsx`** — copy button "코드 복사"/"복사"/"복사됨" Korean hardcoded
   - Fix: `usePathname()`-based locale detection → `t(locale, ...)` applied
4. **`blog/src/lib/i18n.ts`** — codeBlockCopy/Copied/CopyAriaLabel keys added (KR/EN)

**Effect**: EN sprint pages Korean leakage **96 → 9** (remaining 9 all intentional preservation in ADR content)

## Verification

- All 4 PR commits (#269 Phase A/B/C + #270 hotfix): CI fail 0, mergeStateStatus CLEAN ✅
- `node scripts/check-adr-en-coverage.mjs --strict` → **106/106 (100.0%)** exit 0 ✅
- `node scripts/check-adr-links.mjs blog/out/adr` → 108 HTML, 1,125 links, 0 broken ✅
- `node scripts/check-adr-links.mjs blog/out/en/adr` → 108 HTML, 1,125 links, 0 broken ✅
- `node scripts/check-doc-refs.mjs` → 279 files, 0 broken refs ✅
- `npm run build` (blog) → 240 static pages (KR 108 + EN 108 ADR pages + 24 posts) ✅
- Korean leak grep: 96 EN sprint pages → 9 (all intentional preservation)
- Per-page precise verification of 9 intentional preservation cases: blog KR original quotation / i18n bilingual mapping / regex patterns / accessibility labels / code literals / API query examples — 0 translation omissions

## Branch Discipline ✅

- All 3 PRs created on new branches + Squash merge — **26 sprint consecutive compliance** (since Sprint 134 violation)
- 0 direct main commits
- Work branches: `feat/sprint-158-adr-en-batch` (#269), `fix/sprint-158-ui-i18n-hotfix` (#270)

## New Patterns

1. **Scribe direct translation + parallel batch split pattern** — Eliminates API key dependency. 105 ADRs processed by 5 Scribe Agents in parallel (permanent 8 / sprint+topic 2 / sprint-40~87 30 / sprint-91~127 37 / sprint-128~155 28). Skipped `translate-adr.mjs` infrastructure → zero cost. Large-scale batch model for Sprint 157 seed #19 content settlement
2. **User feedback → immediate build output analysis → precise diagnosis → hotfix cycle** — From "EN translation not matching" feedback, accurately located Korean leak positions via build EN HTML grep (per code line). Identified 3 components (description/LocaleToggle/code-block) precisely → 4 commits in single PR. Avoids guessing cycle (Sprint 157 probe pattern direct inheritance)
3. **Simultaneous CI hard gate activation (right after Phase B 100% reach)** — Infrastructure settlement → content filling → regression blocking completed within single sprint. Sprint 157's advisory (WARN) → Sprint 158's strict (FAIL) transition safely executed at the 100% content moment. "Measure → strengthen" pattern (Sprint 156 option A pattern inheritance)
4. **Per-page precise verification of 9 retained Korean cases** — Avoids bulk "Korean = defect" classification. i18n code literals / blog quotations / regex explanations / accessibility labels are intentional preservation and classified separately. Precise verification result: 0 translation omissions
5. **Meta description vs UI text vs body text — 3-layer i18n gap separation** — Phase C completed body (`docs/adr-en/*.md`) 100% matching, but UI matching (description/LocaleToggle/code-block) revealed as separate defect. Caught only by user verification cycle. Sprint 159 seed #31 candidate: "i18n matching checklist 3-layer (meta/UI/body) separation"

## Lessons Learned

1. **Translation infrastructure ≠ actual matching completeness** — Sprint 157 completed `translate-adr.mjs` + `getAllAdrs(locale)` + KoreanOnlyBanner, but UI text / description outside body content were separately missing. UI i18n, content i18n, and meta i18n must all be inspected separately
2. **Post-merge user direct feedback is the last safety net** — `--strict` CI gate, link integrity, doc-ref-lint, browser build verification all passing — only user visual verification catches "Korean visible on EN page". Sprint 157 hotfix cycle pattern immediately reproduced in this sprint
3. **Build output grep as precise diagnostic tool** — Korean grep on built HTML (not source code) accurately identifies leak locations. 3 components (`(adr)/layout.tsx`, `locale-toggle.tsx`, `code-block.tsx`) identified at once. 4-commit hotfix completed without user guessing cycle
4. **Scribe parallel batch split avoids single-session token burden** — Delegating 105 ADRs to single Agent → context limit. 3 parallel Agents (30+37+28) + 2 Agents (8+2) = 5 Agent distribution is safe. Each Agent used 110K~166K tokens (single Agent would risk ~400K+)
5. **commit message scope pre-check required** — `adr-en` not in commitlint scope-enum → first commit fail → retry with `docs(adr)` scope. This sprint's scope-enum: `[adr, ai-analysis, blog, ci, deps, docs, e2e, frontend, gateway, github-worker, identity, infra, problem, runbook, security, submission]`. New scope addition is a CLAUDE.md conscious decision
6. **`(adr)` layout shared by KR+EN → meta description i18n impossible (static export environment)** — `headers()` API doesn't work in static export. Layout split (`(adr)/layout.tsx` KR + `(adr)/en/adr/layout.tsx` EN override) or description English-only. This sprint chose the latter (simplest). Layout split deferred to Sprint 159+
7. **9 body Korean cases all intentional — avoid bulk "defect" classification** — i18n bilingual reference (sprint-122), code literals (sprint-87/125), blog original quotations (sprint-100), regex patterns (sprint-123/126), accessibility labels (sprint-146), tone change examples (sprint-86), API query examples (sprint-98) — all preservation justified. Precise classification is the core of user communication

## Sprint 159 Carryover

### User Direct Execution (Optional)
- Seed #30 candidate (new): blog `header.tsx` / `footer.tsx` / `(en)/layout.tsx` etc. additional Korean leak checks in other UI components

### New Automation Candidates
- Seed #30: Build output Korean leak automatic CI verification step — `grep -lE "[가-힣]" blog/out/en/**/*.html` allowlist-based (intentional preservation only passes). Sprint 158 hotfix cycle automation
- Seed #31: i18n matching checklist 3-layer separation (meta description / UI text / body) — plan template auto-application

### Sprint 157 Carryover Seeds (Continuing)
- Seed #24: plan template i18n dual-language mandate checklist automation
- Seed #25: ✅ **Settled this sprint** (CI hard gate activation completed)
- Seed #26: `docs/adr/README.md` paths filter negation (block unnecessary blog builds)
- Seed #27: CI build-blog job `ls out/` artifact actual verification step
- Seed #28: `check-adr-links.mjs` ROOT auto-detection
- Seed #29: plan template "new CI step addition requires probe step mandate"

### UAT User Direct (15 sprints cumulative)
- Seed #5: Programmers re-submission grading pass verification
- Seed #9: English environment + production Grafana CB dashboard ai-analysis visual integrity

### Carried Over
- Seed #18: blog post pre-merge domain fact cross-check automation
- Seed #23: plan template "rebase post cumulative count fix" checklist

### Follow-up (Optional)
- create/edit page.tsx category UI
- Programmers URL automatic category inference
- Existing SQL problem data backfill
- coverage-gate `skipped` allowance removal (Sprint 156 Phase B option B)
- post-merge pre-deploy gate (Sprint 156 Phase B option C)
- prom-client Case B~D check automation
- `.claude-tools/` Phase 2 actual deletion (after trigger path verification)
- `(adr)` layout split (KR + EN override) — alternative to Sprint 158's description single-form
