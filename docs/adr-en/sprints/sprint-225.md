---
sprint: 225
title: "Root-Cause Fix for CI Trivy blog Failure (Unreferenced APK_CACHE_BUST Cache-Bust Bug)"
date: "2026-06-07"
status: completed
agents: [Oracle, Postman, Librarian, Critic]
related_adrs: ["sprint-224", "sprint-105"]
related_memory: ["sprint-window"]
topics: ["ci", "security", "docker", "infra"]
tldr: "Root-cause fix for the post-merge CI `Trivy Scan — blog` failure after the Sprint 224 merge (#392) — libxml2 CVE-2026-6732 (HIGH, fixed in 2.13.9-r1). The surface cause is a new base-image CVE unrelated to Sprint 224 code (quiz frontend), but the deeper problem is that the blog/frontend/gateway Dockerfiles declared `ARG APK_CACHE_BUST` without referencing it in the `RUN`, so BuildKit did not invalidate the apk upgrade layer cache when the value changed. As a result CI's `apk_bust=true` (workflow_dispatch) was a no-op, base-image CVE patches never flowed in, and the Trivy blog failure recurred (215/217/218). Fix: add `echo \"apk cache bust: ${APK_CACHE_BUST}\"` before the apk RUN to reference the ARG → a value change invalidates the layer → apk upgrade re-runs and pulls the latest patch. Added §3-4 (apk_bust base-image CVE patch procedure) to the ci-rebuild-all runbook. After merge, re-run CI with apk_bust=true to pull libxml2 2.13.9-r1. Critic R1 CLEAN."
---
# Sprint 225 — Root-Cause Fix for CI Trivy blog Failure

## Goal

- Resolve the root cause of the `Trivy Scan — blog` job failure in the post-merge `CI — Test, Build & Push` on main after the Sprint 224 merge (PR #392).
- Fix not only the surface cause (a new base-image CVE) but the **`apk_bust` cache-bust no-op bug** that produced the recurring failures.
- CI/infra-only — no service logic change.

## Background

After PR #392 (Sprint 224) merged, only `Trivy Scan — blog` failed on main CI:

```
libxml2  CVE-2026-6732  HIGH  fixed  2.13.9-r0 → 2.13.9-r1  (alpine 3.21.5)
DoS via crafted XSD-validated document
```

- Sprint 224 changes (quiz frontend) did not touch blog or any Dockerfile → this CVE is a **newly disclosed vulnerability in the base image (`nginx:1.28-alpine3.21`)**.
- PR #392 itself merged cleanly (PR gate passed); this failure only blocks **blog deploy** (no impact on other services).
- Per memory, the blog Trivy failure was a recurring "non-blocking" pattern in 215/217/218 — i.e., not a one-off but a **structural recurrence**.

Root-cause investigation found the same defect in all three of blog/frontend/gateway Dockerfiles:

```dockerfile
ARG APK_CACHE_BUST                                   # declared only
RUN apk update && apk upgrade --no-cache libxml2 ... # ARG not referenced
```

`APK_CACHE_BUST` is a build-arg that CI (`ci.yml`) sets to `github.run_id` when `apk_bust=true` is given via workflow_dispatch, but since it is **not referenced in the RUN, BuildKit does not change the cache key for this RUN layer** (BuildKit does not invalidate on an unreferenced ARG). So even with `apk_bust=true` the apk upgrade layer is a cache hit → never re-runs → patches do not flow until the base-image digest updates. This is the real reason the Trivy blog failure recurred.

## Decisions

### D1. Make the apk RUN reference `APK_CACHE_BUST`

Add `echo "apk cache bust: ${APK_CACHE_BUST}"` before the apk RUN in the three blog/frontend/gateway Dockerfiles.

- Because the ARG is now referenced in the RUN, a value change (`github.run_id` under apk_bust=true) changes the BuildKit cache key and invalidates the layer → `apk upgrade` re-runs.
- No behavioral/runtime change (build-time echo only). No security exposure (run_id is a public identifier).

### D2. Runbook augmentation

Add §3-4 (apk_bust — base-image CVE patch flow) to `docs/runbook/ci-rebuild-all.md` — fixed CVEs are resolved via `apk_bust=true`, unfixed CVEs via the `.trivyignore` path. New service Dockerfiles must include the same reference pattern.

### D3. Re-run CI after merge to apply the patch

After merging, run `gh workflow run ci.yml --ref main -f apk_bust=true` to invalidate the apk layer, pull libxml2 2.13.9-r1, and confirm Trivy passes.

## Implementation

2 atomic commits total (start `742fe90`):

| Commit | Agent | Content |
|---|---|---|
| `b76dc38` | Postman | blog/frontend/gateway Dockerfile apk RUN references `${APK_CACHE_BUST}` (1 echo line + comment) |
| `f582427` | Librarian | ci-rebuild-all runbook §3-4 apk_bust base-image CVE patch procedure |

## Verification

- **Critic**: R1 CLEAN — *"The changes correctly reference the existing APK_CACHE_BUST build argument in the Dockerfile RUN layers so BuildKit cache keys can change when apk_bust is enabled. No actionable regressions were identified in the modified files."*
- **ADR gates**: index count (sprint **163**, --strict) / adr-en coverage / adr-links 0 broken / doc-refs no broken.
- **CI**: merged after PR gate. After merge, re-run with `apk_bust=true` to confirm blog Trivy passes (carryover — record at execution time).

## Lessons

1. **A build ARG declared but not referenced does not act as a cache-bust under BuildKit** — `ARG X` + `RUN ...` (X unreferenced) does not invalidate the RUN layer when X changes. A cache-bust ARG must be referenced inside the RUN (e.g., `echo "${X}"`). "The input exists ≠ it works" — verify the mechanism by actual invalidation.
2. **A recurring "non-blocking" CI failure is a signal of a structural defect** — treating the blog Trivy failure as non-blocking in 215/217/218 delayed discovery of the root cause (apk_bust no-op). When the same failure recurs, suspect the mechanism itself, not a transient event.
3. **The presence of a fix splits the CVE response path** — fixed CVEs flow in via re-running `apk upgrade` (apk_bust); only unfixed CVEs go to `.trivyignore` "pending upstream patch". Even with `--ignore-unfixed`, fixed CVEs are caught, so the patch-flow path must remain functional.

New pattern: **cache-bust ARG reference obligation** — any Dockerfile with a package-upgrade layer must reference `${APK_CACHE_BUST}` inside the `RUN` for the `apk_bust` input to take effect.

## Sprint 226+ Carryover

- **(ops) After merge run `gh workflow run ci.yml --ref main -f apk_bust=true` → confirm blog Trivy passes (libxml2 2.13.9-r1)** — live verification of this fix.
- **(ops) Live `/quiz` verification after redeploy — UI (221), a11y (222/223), UX deepening (224)** (user/ops).
- **(ops) SP217 cutover** — per `sp217-quiz-records-cutover.md`, roll out + live E2E.
- GA4 / Sprint 196 problem_db / harness --full cron — existing carryover.

## Critic Cross-Review

- **Tool**: Codex codex-cli 0.130.0, `codex review --base 742fe90 -c model=gpt-5.5`
- **Rounds**: 1

**R1 — CLEAN** (0 P-findings): *"The changes correctly reference the existing APK_CACHE_BUST build argument in the Dockerfile RUN layers so BuildKit cache keys can change when apk_bust is enabled. No actionable regressions were identified in the modified files."*

**Overall verdict**: ✅ Mergeable — the Dockerfile RUNs reference APK_CACHE_BUST so the BuildKit cache key changes under apk_bust, with zero regressions. Single-round CLEAN.
