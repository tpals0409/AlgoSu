---
sprint: 260
title: "Programmers Recommendation Seeds 12→34 Expansion — Full Lv.1~5 Coverage"
date: "2026-07-23"
status: completed
agents: [Oracle]
related_adrs: ["sprint-254", "sprint-255"]
related_memory: ["sprint-window"]
topics: ["problem", "recommendation", "seed", "cold-start"]
tldr: "Expanded the Programmers entries in the recommendation cold-start static seed list `recommendation-seeds.ts` (Tier3 fallback used when a study has 0 registered problems or lacks cross-study solves) from 12 to 34. First pass balanced Lv.1/2/3 at 8 each (24 total); then added the previously-empty higher tiers Lv.4 (PLATINUM)×6 / Lv.5 (DIAMOND)×4 to cover the full Lv.1~5 range. Since Programmers is an SPA and levels are not rendered in lesson HTML, levels were confirmed against the gateway `data/programmers-problems.json` (crawler dataset of 689 problems) `level` field as SSOT rather than guessed. The `difficulty` field is only an internal normalized value from the gateway `levelToDifficulty` (Lv.1~5→BRONZE~DIAMOND) canonical mapping (used as a recommendation filter key and badge color); the on-screen label is rendered by the FE `DifficultyBadge` as `Lv.N`. Consumer/tests unchanged (limit slice), zero external API. jest 77/77, ESLint clean, Critic (Codex gpt-5.5) CLEAN. PR #495 `960db90`."
---
# Sprint 260 — Programmers Recommendation Seeds 12→34 Expansion

_Date: 2026-07-23_

## Goal

Reinforce the **number of Programmers problems** in the recommendation cold-start fallback (the static seeds used at Tier3 when a new study has 0 registered problems or lacks cross-study solves). The existing 12 seeds only shallowly covered Lv.1/2/3, with no higher tiers (Lv.4/Lv.5) at all, so we populate representative problems across the full difficulty range.

**Target**: `services/problem/src/problem/recommendation-seeds.ts` (Tier3 cold-start static seeds, constant layer)
**Constraints**: Seeds must be real Programmers lessons (no fabricated links), and level labels must be grounded in a verifiable source of truth.

## Decisions

### D1. Expand only the seed pool, consumer unchanged (safe expansion)

The consumer (`problem.service.ts`) filters by platform/difficulty, then shuffles and takes a `limit` slice — there is no hardcoded count. Tests also only verify counts based on the requested `limit` slice (8/5/3). Therefore expanding the seed array is applied safely without touching consumer logic or tests. Indeed, both expansions (12→24→34) passed `problem.service.spec` 77/77 with no test changes.

### D2. Level accuracy = confirmed via crawler dataset SSOT (no guessing)

Programmers is an SPA, so the difficulty level is not rendered in lesson HTML. An HTTP 200 + `<title>` match only proves the lesson exists and its title, not its level. Hardcoding higher-tier (Lv.4/5) seeds with an arbitrary mapping would produce false levels, so we used the `level` field of the gateway `services/gateway/data/programmers-problems.json` (a crawler-generated dataset of 689 problems) as the level SSOT to confirm the Lv.4/Lv.5 candidates (representative picks among Lv.4=45 / Lv.5=21 in the dataset).

### D3. `difficulty` is an internal normalized value — distinct from the on-screen label

The seed `difficulty` (BRONZE~DIAMOND) is an internal normalized value that **exactly matches** the gateway `levelToDifficulty` canonical mapping (`programmers.service.ts`: Lv.1→BRONZE, Lv.2→SILVER, Lv.3→GOLD, Lv.4→PLATINUM, Lv.5→DIAMOND). Its only uses are (1) the recommendation difficulty filter key and (2) badge color selection; the on-screen label is rendered by the platform-aware FE `DifficultyBadge`, which for Programmers uses `PROGRAMMERS_LEVEL_LABELS[level]` → `Lv.N`. Thus BRONZE/SILVER/GOLD text is never exposed to the user.

## Implementation

- `recommendation-seeds.ts` Programmers seeds **12 → 34**:
  - Lv.1×8 / Lv.2×8 / Lv.3×8 (first pass, balanced increase)
  - **Lv.4 (PLATINUM)×6 / Lv.5 (DIAMOND)×4** (second pass, higher tiers added) → full Lv.1~5 coverage
- Each entry: `level`=Programmers Lv number, `difficulty`=`levelToDifficulty(level)` canonical value, `sourceUrl`=real lesson URL
- Corrected the file header/section comments to lead with Lv, clarifying that `difficulty` is an internal mapping value
- Consumer (`problem.service.ts`), BOJ seeds, and recommendation response projection logic **unchanged**; zero external API calls

**Verification (Oracle direct re-check — distrust self-reports)**: `problem.service.spec` 77/77 pass (ts-jest compilation doubles as a type check), ESLint exit 0 (0 warnings). Seed existence/titles confirmed via lesson HTTP 200 + title match; levels confirmed against the crawler dataset `level` field.

**Critic (Codex gpt-5.5, base `b6b6794`, background PTY wrapper)**: 0 findings — verdict: "only a static recommendation seed list expansion and test-comment adjustment; did not find a discrete correctness issue caused by this diff." CLEAN → merged via auto-merge (`--squash --auto`) on CI green (`960db90`, PR #495).

## Incidents

1. **Misleading report wording**: The first-pass report expressed tier names (BRONZE/SILVER/GOLD) as if they were Programmers difficulties → flagged by the user. Programmers uses the Lv system, and the tiers are internal mapping values. The code/data were sound (matching the canonical mapping); only the report wording and file comments needed correction.
2. **First-pass scope omission**: "Reinforce problem count" was interpreted only as increasing Lv.1~3, leaving the empty Lv.4/5 untouched → after the user flagged it ("there were no Lv.4/5 problems at all — did you actually reinforce it?"), Lv.4/5 were added in a second pass.
3. **Critic ACP `.done` marker not created**: The background PTY wrapper left the CLEAN verdict in the log and exited normally, but due to an ACP constraint the `.done` marker was not written → the watchdog cron did not auto-notify → Oracle concluded by reading the log directly (same constraint as Sprint 251/254).
4. **Stale sprint-window + parallel session**: On session entry the window was 5 sprints stale at 254, while the actual repo had 255~259 merged. This work proceeded as a standalone, unnumbered feature and was closed as 260. The 256~259 retrospective ADR gaps are owned by the parallel session and explicitly noted (this session does not reconstruct them — forgery prevention).

## Carry-over

- [ ] Re-review the actual representativeness of the BOJ recommendation seed list (continued from Sprint 255 — Oracle-judged draft, subject to replacement)
- [ ] 256~259 retrospective ADR gaps — owned by the parallel Oracle session (not in this session's scope)

## Lessons

- **Programmers uses the Lv system (Lv.0~5); BRONZE/SILVER/GOLD are BOJ/solved.ac tiers.** The code's `difficulty` field is only an internal normalized value produced by the gateway `levelToDifficulty` (for filter key/color); do not report it conflated with the on-screen label (`Lv.N`).
- **Do not guess unverifiable attributes like level — confirm against a verifiable SSOT.** For values absent from SPA HTML, find and cross-check a canonical source such as the crawler dataset (`programmers-problems.json`).
- **Ambiguous directives like "reinforce problem count" require explicit confirmation of full-range coverage.** Do not repeat the mistake of increasing only existing difficulties while leaving the empty higher range untouched.
