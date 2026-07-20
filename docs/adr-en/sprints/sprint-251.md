---
sprint: 251
title: "SSOT Backlog Resolution — Internal Key Naming Revision · Sprint-250 ADR Frontmatter · ADR Count · c-ares CVE"
date: "2026-07-17"
status: completed
agents: [Oracle, Scribe]
related_adrs: ["sprint-249", "sprint-250", "sprint-248"]
related_memory: ["sprint-window", "sprint-249-ssot-drift"]
topics: ["ssot", "internal-key-naming", "adr", "security", "docs"]
tldr: "Three backlog doc items from Sprint 249–250 resolved. ①CLAUDE.md Q-5 internal key naming SSOT revised — two patterns separated by call direction: Gateway→MSA (`INTERNAL_KEY_<TARGET>`) and inter-service direct calls (`<TARGET>_SERVICE_KEY`) (Sprint 249 decision applied). ②Sprint-250 ADR KR+EN frontmatter fields added (Critic P2 resolved). ③docs/adr/README.md ADR count updated to 188 + blog/Dockerfile c-ares CVE fixed. 3 commits (04b74bb · 854c90e · ee4d4fe), Critic CLEAN."
---
# Sprint 251 — SSOT Backlog Resolution

_Date: 2026-07-17_

## Goal

Fully resolve documentation backlog items carried over from Sprint 249–250:
1. CLAUDE.md Q-5 internal key naming SSOT only described a single pattern (`<SERVICE>_SERVICE_KEY`) — the two actual code patterns (Gateway outbound vs. inter-service direct calls) were not reflected.
2. Sprint-250 ADR KR+EN had missing frontmatter fields — Critic P2 unresolved.
3. docs/adr/README.md ADR count was stale + blog/Dockerfile c-ares CVE still present.

## Decisions

### D1. Internal Key Naming SSOT — Two-Pattern Split (CLAUDE.md Q-5 revision)

**Before**: Only a single pattern `<SERVICE>_SERVICE_KEY` was documented.  
**After**: Two patterns separated by call direction.

| Direction | Env Var Pattern | Example | SSOT Code File |
|-----------|----------------|---------|----------------|
| **Inbound** (own service key verification) | `INTERNAL_API_KEY` | — | Common to all services |
| **Outbound — Gateway → MSA** | `INTERNAL_KEY_<TARGET>` | `INTERNAL_KEY_PROBLEM` | `services/gateway/src/common/config/service-keys.config.ts` |
| **Outbound — Inter-service direct calls** | `<TARGET>_SERVICE_KEY` | `PROBLEM_SERVICE_KEY` | `services/submission/src/common/problem-service-client/problem-service-client.ts`, `services/github-worker/src/config.ts` |

**Rationale**: Prevents recurrence of the Sprint 248 incident — when sealing SealedSecrets, the actual code config field names (not CLAUDE.md examples) must be used as SSOT. This lesson is now codified in the SSOT document itself.

### D2. Sprint-250 ADR Frontmatter Missing Fields Added

`docs/adr/sprints/sprint-250.md` and `docs/adr-en/sprints/sprint-250.md` were both missing frontmatter fields (`related_memory`, etc.) flagged as Critic P2 — resolved.

### D3. Docs and CVE Updates

- `docs/adr/README.md`: ADR count corrected to 188.
- `blog/Dockerfile`: c-ares CVE vulnerable version fixed.

## Completed Items

| Commit | PR | Description |
|--------|----|-------------|
| `04b74bb` | — | docs/adr/README.md ADR count updated to 188 + blog c-ares CVE fix |
| `854c90e` | #468 | CLAUDE.md Q-5 internal key naming SSOT revision (two-pattern split) |
| `ee4d4fe` | #469 | Sprint-250 ADR KR+EN frontmatter fields added + ADR count aligned |

**Critic Result**: Codex gpt-5.5 (`--base 04b74bb`) — docs-only changes → 0 findings, **CLEAN**.

## Carryover

- [ ] 🔴 Security: ANTHROPIC_API_KEY rotation recommended (user on hold — revoke in Anthropic Console, issue new key, re-seal SealedSecret)
- [ ] GA4 admin Enhanced Measurement OFF (user action)
- [ ] GA4 production UAT (user action)
- [ ] Server redeploy + live SEO verification (ops, Sprint 212/213 artifacts)
- [ ] GA4 admin data stream URL `algo-su.com` alignment (user action)

## Lessons Learned

- **Catch SSOT drift before an incident occurs**: The Sprint 248 `INTERNAL_KEY_PROBLEM` vs. `PROBLEM_SERVICE_KEY` confusion originated from an incorrect SSOT document. This revision ensures a clear two-pattern table backed by two code locations is now canonical in CLAUDE.md.
- **Resolve Critic P2 before the next sprint starts**: Frontmatter omissions like these carried over as Critic P2 findings. Resolving them before the next sprint start avoids ADR gate WARNs at close time.
- **Routine CVE fixes on discovery**: The blog/Dockerfile c-ares CVE was carried over unnecessarily — small CVEs should be resolved immediately on discovery to minimize technical debt.
