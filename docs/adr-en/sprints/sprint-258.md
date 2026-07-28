---
sprint: 258
title: "Difficulty Chip Full-Tier Expansion + Recommendation Card Label Platform Binding"
date: "2026-07-24"
status: completed
agents: [Oracle]
related_adrs: ["sprint-257", "sprint-256"]
related_memory: ["sprint-window"]
topics: ["frontend", "recommendation"]
tldr: "Expands Sprint 256's conservative 3-tier (Bronze/Silver/Gold) exposure to the full platform-native tier range — BOJ Bronze~Diamond / Programmers Lv.1~5 (5 tiers). RUBY is excluded since it has no corresponding Programmers level (Lv.6). Adds PLATINUM/DIAMOND to `RECOMMENDABLE_DIFFICULTIES` + Lv.4→PLATINUM/Lv.5→DIAMOND to `PROGRAMMERS_LEVEL_BY_DIFFICULTY` (1:1 aligned with Gateway levelToDifficulty). Higher tiers are served from cross-study real data with no static-seed manipulation, showing a graceful empty state when absent to preserve data integrity. Then the recommendation **card** (result item) difficulty label is also branched by the item's own platform (BOJ→tier, Programmers→Lv.N). PR #488 `43d4307a` (chip full-tier) + PR #489 `a16d3b27` (card label binding)."
---
# Sprint 258 — Difficulty Chip Full-Tier Expansion + Card Label Platform Binding

_Date: 2026-07-24_

## Goal

Sprint 256 exposed only the seed-covered range (3 tiers) as a conservative measure against empty recommendations. Now expand the difficulty selection range to the **platform-native full tiers**. Also, following Sprint 257 which branched the selection **chip** labels per platform, bind the recommendation **card** (result item) difficulty labels to the item platform to complete notation consistency.

**Targets**
- PR #488 `43d4307a` — difficulty chip full-tier expansion (Bronze~Diamond / Lv.1~5)
- PR #489 `a16d3b27` — bind recommendation card difficulty labels to item platform

## Decisions

### D1. Expand selection chips to 5 tiers, exclude RUBY (#488)

Add PLATINUM/DIAMOND to `RECOMMENDABLE_DIFFICULTIES`, expanding 3 tiers → **5 tiers**. Add `Lv.4→PLATINUM`, `Lv.5→DIAMOND` to `PROGRAMMERS_LEVEL_BY_DIFFICULTY`, keeping **1:1 alignment with Gateway's `levelToDifficulty`** so storage/search/recommendation filters share the same enum. **RUBY is excluded** as it has no corresponding Programmers level (Lv.6) — expose only tiers that both platforms can support.

### D2. Higher tiers served from real data + graceful empty state (no static-seed manipulation) (#488)

The expanded higher tiers (PLATINUM/DIAMOND) are **served from cross-study real data rather than force-filling static seed**. When no real data exists for a tier, a graceful empty state is shown. Where Sprint 256 prevented empty recommendations by "hiding seed-uncovered tiers," Sprint 258 shifts to "expose them but honestly show an empty state when data is absent" — avoiding groundless seed labeling and prioritizing data integrity.

### D3. Bind recommendation card labels to item platform (#489)

Sprint 257 branched the selection **chip** labels per platform, but the recommendation result **card** difficulty labels remained mixed. Branch card label rendering by **the item's own platform** (BOJ item = solved.ac tier, Programmers item = Lv.N). Export the platform-detection helper from `problem-search.utils.ts` for reuse.

## Implementation

- **#488**: `SearchStep.tsx` add PLATINUM/DIAMOND to `RECOMMENDABLE_DIFFICULTIES` + Lv.4/Lv.5 mappings in `PROGRAMMERS_LEVEL_BY_DIFFICULTY` + `SearchStep.test.tsx` full-tier cases
- **#489**: `SearchStep.tsx` card label per-item-platform branching + `problem-search.utils.ts` export platform-detection helper + `SearchStep.test.tsx` 2 per-platform label cases

**Verification (Oracle re-verified directly — distrust self-reports)**: #488 tsc no new errors, ESLint 0 errors, jest 22+31 pass, next build exit 0. #489 per-platform card label suite green. Both PRs merged to origin/main (squash).

## Carryover

- [ ] Re-examine the actual representativeness of the BOJ recommendation seed list (ongoing from Sprint 255) — handled in Sprint 264

## Lessons

- **Expanding UI exposure goes hand in hand with data honesty**: expose higher tiers but handle them via real data / empty state without manipulating static seed, preserving integrity with no groundless labeling.
- **Enum alignment is maintained across service boundaries**: align the FE mapping (Lv↔Difficulty) 1:1 with Gateway `levelToDifficulty` so storage/search/recommendation share the same value.
- **Notation consistency is completed on both chip and card**: fixing only the selection UI (chip) leaves a mismatch on the result UI (card) — align the entire display layer together.
