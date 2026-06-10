---
sprint: 238
title: "Codebase-wide Security & Improvement Audit + Sprint Roadmap (ADR-030)"
date: "2026-06-10"
status: completed
agents: [Oracle]
related_adrs: ["ADR-030", "ADR-029", "sprint-99", "sprint-235"]
related_memory: ["sprint-window", "feedback-sprint-scoping", "feedback-plan-recommendation-flow"]
topics: ["security", "audit", "planning"]
tldr: "First sprint after switching to the fable model. Started via /start argument 'analyze all code for security issues and improvements → list them → establish a sprint plan'. After a 3-axis parallel exploration (security surface / code quality / CI·infra), every key suspect item was re-verified by reading files directly per the sprint-99 lesson — 5 preliminary findings turned out to be misjudgments/already-resolved/downgraded (Saga compensation exists, Monaco lazy load already applied, SP196 GIN already resolved, ShareLinkGuard sound, key naming is a convention), and 1 new finding was added (POST /api/events is unauthenticated + plain interface, so ValidationPipe performs zero validation). Conclusion: zero High Risk; 3 Medium (S-1 missing @Public, S-2 events DTO, S-3 CSP unsafe-inline) + 5 Low + 7 improvements codified as ADR-030 (new permanent ADR, KR+EN) with a remediation roadmap for Sprints 239–243 (quick wins → runbooks → BE decomposition → FE decomposition → supply chain). Verification: 6 ADR gates pass (index permanent 10, EN 186/186, links 0, i18n 0, doc-refs clean, conversion PASS), Critic (Codex gpt-5.5 --base aea9528) R1 CLEAN, PR #426 CI green auto-merge squash 22da1f3."
---
# Sprint 238 — Codebase-wide Security & Improvement Audit + Sprint Roadmap

## Goals

- Perform a global audit of all services (frontend/gateway/identity/submission/problem/github-worker/ai-analysis) + infra + CI from a security and improvement perspective.
- Codify verified findings into a prioritized list (SSOT) and establish a multi-sprint remediation roadmap.

## Background

- Started via the `/start` argument "Switched to the fable model. Analyze all our code for security issues and improvements, list them up, then establish a sprint plan" — the first sprint after the fable model switch.
- Across 237 sprints, security fixes had been applied sprint-by-sprint in a scattered fashion — no global audit had been performed.
- The harness checkup, previously the Sprint 238 candidate, was carried over to a later slot.

## Work summary (start `aea9528`, 1 commit → squash `22da1f3`, PR #426)

- **3-axis parallel exploration**: 3 Explore agents launched concurrently — ① security surface (auth/secrets/input validation/external input/frontend/hardening) ② code quality (debt/tests/dependencies/resilience/structure/DB/performance) ③ CI·infra (workflows/Dockerfiles/scripts/documentation gaps).
- **Verification pass**: every key suspect item from the exploration reports (M1–M3, I1, I4, I5, etc.) re-verified by reading files directly. 5 misjudgments removed/downgraded + 1 new finding (S-2) discovered.
- **ADR-030 authored**: findings list (3 Medium / 5 Low / 7 improvements, each with evidence file:line + recommended action + assigned sprint) + misjudgment-correction record + roadmap for Sprints 239–243. New permanent ADR (9th→10th), KR+EN authored together, README index updated (next free number ADR-031).

## Key decisions

1. **Zero High Risk → no emergency hotfix, roadmap at normal cadence**: fundamentals confirmed solid — JWT pinned to HS256 with double expiry validation, timingSafeEqual across all services, ValidationPipe whitelist, httpOnly cookies, Redis rate limiting, CI least-privilege + gitleaks + Trivy, non-root Dockerfiles.
2. **Exploration reports adopted only after a verification pass** (institutionalizing the sprint-99 lesson): taken at face value, 5 misjudgments including "Saga compensation missing (High)" would have entered the backlog. The verification pass also produced a genuine new finding (S-2) — verification doesn't just remove, it discovers.
3. **Backlog SSOT = ADR-030**: when an item is handled, the sprint ADR references its S-N/Q-N ID, and ADR-030's table is annotated with the resolving sprint.
4. **Roadmap split** ([feedback-sprint-scoping]): Sprint 239 (security quick wins, code) → 240 (operational runbooks) → 241 (BE structural decomposition) → 242 (FE decomposition + tests) → 243 (supply chain, CSP spike, CI cleanup). Code-changing sprints must keep coverage thresholds and pass Critic.

## Verification

- **6 ADR gates**: index count (permanent 10 / topic 1 / sprint 175) · EN coverage 186/186 · links 0 broken (1,584 internal links) · i18n residue max 2.19% (threshold 8%) · doc-refs 447 clean · conversion PASS.
- **Critic** (Codex gpt-5.5, `codex review --base aea9528`): **R1 CLEAN** — "no blocking issues were found".
- **CI PR #426**: all checks green (Failed 0), auto-merge SQUASH → `22da1f3`. Post-merge local main FF sync + working branch cleanup confirmed.

## Lessons

1. **A global audit requires the two-stage "explore → verify → list" structure** — parallel exploration provides coverage; the verification pass provides accuracy. Both the 5 removed misjudgments and the 1 new finding came out of the verification pass.
2. **ValidationPipe is class-metadata based** — a body received as a plain TS interface gets zero validation regardless of whitelist settings. "ValidationPipe applied across all services" does not mean "all endpoints validated" (S-2).
3. **Misjudgment corrections are record assets too** — documenting what was wrong and why (isomorphic to the non-deployed-mirror incident, sprint-232) in the ADR blocks the same items from being re-raised.
4. **Even a "healthy" audit produces deliverables** — the fact-checked confirmation of zero High Risk, plus a global coordinate system (roadmap) over scattered fix history, are the outputs.

New pattern: **3-axis parallel exploration + verification-pass audit pattern** (parallel Explore for coverage → direct re-verification of all key suspects → backlog codified as SSOT together with the misjudgment-correction record).

## Carryover

- **(Sprint 239 confirmed) Security quick wins**: S-1 `@Public()` introduction, S-2 events DTO validation, S-4 remove code-preview logging, S-5 prompt isolation guard, S-8 token log cleanup, Q-5 CLAUDE.md/key-naming doc fixes — see ADR-030.
- Harness checkup (harness-checkup `--full` + permanent Codex model pin) — separate slot.
- (User console) GA4 remaining 3 items · (user/ops) live SEO verification · harness cron review · (optional) webhook regenerate · accumulated UAT.
- (Future blog material) CS quiz minigame · things we built and deleted · zstd experiment rollback.
