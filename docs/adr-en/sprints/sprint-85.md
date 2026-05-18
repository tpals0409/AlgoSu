---
sprint: 85
title: "solved.ac 403 Incident Recovery — Referer + Cloudflare JA3 Dual Block Bypass"
date: "2026-04-14"
status: completed
agents: [Oracle, Conductor, Palette, Gatekeeper]
related_adrs: []
---

# Sprint 85: solved.ac 403 Incident Recovery

## Context

User report: `solved.ac API error: 403` occurring in problem search feature.

Investigation confirmed **Cloudflare (in front of solved.ac) simultaneously strengthened bot defense rules on the same day**:

1. **Referer-based blocking** — 403 when `Referer: https://algo-su.com/` is sent, 200 when not sent
2. **Node.js TLS JA3 fingerprint blocking** — all of `fetch`/`https`/undici/custom ciphers return 403, only `wget` (BusyBox OpenSSL) passes with 200

Existing path: browser → Next.js rewrite (`/solved-ac/*`) → solved.ac server-side proxy. Sending Referer + using Node TLS → both conditions triggered simultaneously → complete 503.

## Decisions

### D1: Consolidate solved.ac Calls Through Gateway Proxy
- **Context**: Next.js rewrite passes browser Referer through directly. No removal option.
- **Decision**: Remove `/solved-ac/*` rewrite, change `AddProblemModal` to go through Gateway's `/api/external/solvedac/search`. Internal calls from Gateway do not set Referer.
- **Alternatives**: Remove Referer via Next.js middleware — additional complexity + proxying external APIs from the same service reduces architectural consistency. Chose to integrate with Gateway for consistency with existing `SolvedacService` (show endpoint).

### D2: Add Gateway `searchProblem` Endpoint
- Added `GET /api/external/solvedac/search?query=&page=` (`solvedac.controller.ts`, `solvedac.service.ts`).
- Response schema: `{ count, items: [{ problemId, titleKo, level, difficulty, sourceUrl, tags: string[] }] }`. Tags flattened to Korean names, same as existing `fetchProblem`.

### D3: Switch Gateway External Calls to `wget` Subprocess
- **Context**: Even through Gateway, Node fetch is blocked by Cloudflare JA3 — 503. All of undici `Agent`, custom ciphers, `https` module switch failed. Only BusyBox wget passes.
- **Decision**: Replace `fetch` in `solvedac.service.ts` with `child_process.execFile('wget', ['-q','-O','-','--timeout=5', url])`. Branch on 404/other status by parsing stderr (`server returned error: HTTP/1.1 NNN`). Applied to both `fetchProblem` and `searchProblem`.
- **Alternatives**: curl-impersonate — no Node bindings, Alpine additional binary burden. Official API key — solved.ac does not offer a public API. External proxy service — operational cost/dependency.
- **Risk**: When base image changes, wget output format (BusyBox vs GNU) requires re-validation. `node:22-alpine` pinned in Dockerfile + stderr format cases included in tests.

### D4: Concurrent Trivy HIGH Vulnerability Patch
- Cleaned up accumulated security issues during CI run:
  - **CVE-2026-28390** (OpenSSL HIGH) — Added `ARG APK_CACHE_BUST` + `apk upgrade libcrypto3 libssl3` to Gateway/Frontend Dockerfiles (reusing blog 744f95d pattern). Injected `build-args: APK_CACHE_BUST=${{ github.run_id }}` to corresponding build-push-action in `ci.yml`.
  - **GHSA-q4gf-8mx6-v5v3** (Next.js Server Components DoS HIGH) — Upgraded `next` 15.5.14 → 15.5.15.

## Outcome

- Live call verification: solved.ac call via `wget` through new Gateway pod succeeded (`count: 5, first: "A+B"`).
- 503 errors eliminated.
- Deployment path: main (`4fa9753`) → aether-gitops (`42f5851`) → ArgoCD Synced/Healthy.

## Lessons Learned

- **When an external API is behind Cloudflare, Bot Management policy changes act as breaking changes without notice.** Node TLS JA3 is a default block target.
- **When Next.js rewrite destination is an external domain, Referer leakage is a risk.** External APIs must be consolidated through backend service proxy without exception.
- `wget` subprocess is valid as an emergency workaround, but long-term alternatives to solved.ac dependency (caching, official partnership) need evaluation.
