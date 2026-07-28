---
sprint: 257
title: "Recommendation Difficulty Chips — Platform-Native Labels (BOJ Tier / Programmers Lv)"
date: "2026-07-23"
status: completed
agents: [Oracle]
related_adrs: ["sprint-256", "sprint-255"]
related_memory: ["sprint-window"]
topics: ["frontend", "recommendation", "i18n"]
tldr: "The Sprint 256 difficulty selection chips were hard-coded to Bronze/Silver/Gold (solved.ac tier names) regardless of platform, so BOJ tier names appeared even on the Programmers tab — a label mismatch. Since BOJ (solved.ac tiers) and Programmers (Lv.1~5) use different difficulty systems, `difficultyChipLabel(platform, difficulty)` branches the label per platform (BOJ→Bronze/Silver/Gold, PROGRAMMERS→Lv.1/Lv.2/Lv.3). The transmitted enum values (BRONZE/SILVER/GOLD) stay identical, preserving the seed band mapping (Lv.1→BRONZE, etc.) and the BE contract — a pure display-layer change. PR #487 `1263c3a0` (FE only: SearchStep label branching + platform prop wiring + per-platform label/enum-transmit tests)."
---
# Sprint 257 — Recommendation Difficulty Chips: Platform-Native Labels

_Date: 2026-07-23_

## Goal

The difficulty selection chips introduced in Sprint 256 had labels hard-coded to `Bronze/Silver/Gold` (solved.ac tier names) regardless of platform. Even though BOJ and Programmers use different difficulty systems (BOJ = solved.ac tiers, Programmers = Lv.1~5), **BOJ tier names appeared even on the Programmers tab** — a label mismatch. Branch the chip labels into each platform's native notation to eliminate user confusion.

**Target**
- PR #487 `1263c3a0` — `frontend` recommendation chip label per-platform branching (FE only)

**Constraint**: Change only the displayed label; never break the difficulty enum contract sent to the server (BRONZE/SILVER/GOLD) or the seed band mapping (BE/data unchanged).

## Decisions

### D1. Branch labels per platform, keep transmitted enum invariant (#487)

Introduce a `difficultyChipLabel(platform, difficulty)` helper that branches chip labels per platform:
- **BOJ**: `Bronze / Silver / Gold` (solved.ac tier names)
- **PROGRAMMERS**: `Lv.1 / Lv.2 / Lv.3` (Programmers native levels)

The key is **separating the transmitted value from the displayed value**. Only the user-visible label changes per platform; the enum sent to the server on click (BRONZE/SILVER/GOLD) stays identical. This preserves the seed band mapping (Lv.1↔BRONZE, etc.) and the BE difficulty-filter contract intact, confining the change scope to the pure display layer.

## Implementation

- `SearchStep.tsx`: `difficultyChipLabel(platform, d)` label branching + `platform` prop wiring into `RecommendationSection`
- `SearchStep.test.tsx`: per-platform label verification (PROGRAMMERS = Lv notation / BOJ = tier names) + assertion that the transmitted enum on click is platform-independent

**Verification (Oracle re-verified directly — distrust self-reports)**: FE suite green on both per-platform label rendering and enum-transmit invariance. PR merged to origin/main (squash).

## Carryover

- [ ] Expand difficulty chips from 3 seed tiers to platform-native full tiers — Sprint 258
- [ ] Branch recommendation **card** (result item, not chip) difficulty labels by item platform too — Sprint 258 (#489)

## Lessons

- **Separating displayed values from transmitted values** lets UI localization (platform-native notation) be done safely without touching the server contract. Fix the enum as SSOT and map labels in the presentation layer.
