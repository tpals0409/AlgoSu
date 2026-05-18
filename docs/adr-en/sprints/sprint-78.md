---
sprint: 78
title: "CI Deprecation Response"
date: "2026-04-10"
status: completed
agents: [Oracle, Herald, Gatekeeper]
related_adrs: []
---

# Sprint 78: CI Deprecation Response

## Decisions

### D1: Bulk Version Upgrade of 11 Actions (Node.js 24 Response)
- **Context**: GitHub Actions runner switching to Node.js 24 as default from 2026-06-02, with complete removal of Node 20 scheduled for 2026-09-16. CI 15 jobs depend on Node 20-based actions.
- **Choice**: Bulk bump of 11 actions to latest major versions supporting Node 24. Processed as a single commit for full CI validation.
- **Alternatives**: Gradual incremental upgrade of individual actions → rejected (change scope is only `uses:` tags, making bulk processing more efficient)
- **Code Paths**: `.github/workflows/ci.yml`

### D2: docker/build-push-action v5 → v7 (2 Major Jump)
- **Context**: v6 is Node 20 based, v7 switches to Node 24 + ESM. Upgrading directly to v7 without going through v6.
- **Choice**: Go directly to v7. Confirmed all existing parameters (context, platforms, push, tags, cache-from, cache-to) are compatible.
- **Alternatives**: Stepwise v5 → v6 → v7 transition → rejected (v6 also scheduled for deprecation soon)
- **Code Paths**: `.github/workflows/ci.yml` (build-services, build-frontend, build-blog jobs)

## Patterns

### P1: GitHub Actions Version Upgrade Bulk Processing
- **Where**: `.github/workflows/ci.yml`
- **When to Reuse**: Apply the same pattern for the next major deprecation cycle (Node 24 → Node 26, etc.). Extract `uses:` lines with grep → research latest versions → bulk replacement with replace_all → full CI validation

## Gotchas

### G1: wagoid/commitlint-github-action is Docker Container Based
- **Symptom**: Could be mistakenly identified as a Node.js 20 deprecation target
- **Root Cause**: Docker container actions use their own runtime, independent of the runner's Node.js version
- **Fix**: Docker-based actions (`wagoid/commitlint-github-action@v6`) do not require Node.js deprecation response. Use `runs.using` field in `action.yml` to distinguish JavaScript vs Docker

### G2: actions/checkout v4 → v6 is a 2 Major Jump
- **Symptom**: Concern about accumulated breaking changes from skipping v5
- **Root Cause**: v5 is Node 20 → Node 22 transition, v6 is Node 24 transition. No compatibility issues with actually used parameters (fetch-depth, sparse-checkout, etc.)
- **Fix**: Verify list of parameters in use before upgrading. In this case, `fetch-depth: 0`, `sparse-checkout`, and `sparse-checkout-cone-mode` all confirmed working normally

## Metrics
- Commits: 1, Files changed: 1 (42 uses lines changed, +48/-48)
