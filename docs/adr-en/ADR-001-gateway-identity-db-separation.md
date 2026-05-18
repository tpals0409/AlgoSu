# ADR-001: Gateway → Identity DB Separation

## Status
Implemented — Approved 2026-03-18, Implemented in Sprint 51 on 2026-03-20

## Context
The Gateway service was directly accessing identity_db and performing CRUD operations on 6 entities (User, Study, StudyMember, StudyInvite, Notification, ShareLink) across 19 files. The Identity service only had a migration runner and health check with 0 business APIs. This violates the DB per Service principle.

## Decision
**Option A: Full migration** — Build business APIs in the Identity service and convert all direct identity_db access from Gateway to Identity HTTP API calls.

### Entities to migrate (6)
| Entity | Gateway files using it | Primary operations |
|--------|----------------------|----------|
| User | 7 | OAuth upsert, profile, GitHub integration, account deletion |
| Study | 6 | CRUD, status validation |
| StudyMember | 6 | Join/leave, permission validation, nickname |
| StudyInvite | 2 | Invite code generation/consumption |
| Notification | 3 | CRUD, 30-day cleanup, SSE emission |
| ShareLink | 3 | CRUD, token validation, public profile |

### Architecture change
```
[Before]
Gateway ──TypeORM──▶ identity_db
Other services ──HTTP──▶ Gateway /internal/*

[After]
Gateway ──HTTP──▶ Identity Service ──TypeORM──▶ identity_db
Other services ──HTTP──▶ Gateway /internal/* ──HTTP──▶ Identity Service
```

### Design principles
1. **Retain Gateway /internal/***: Other services (submission, problem, github-worker) continue calling Gateway /internal/* as before. Gateway proxies to Identity. Minimizes changes to other services.
2. **Performance**: Guard/middleware hot paths retain existing Redis cache + Identity internal network calls (k8s ClusterIP)
3. **SSE**: SSE connection management stays in Gateway; only Notification CRUD is migrated to Identity
4. **OAuth**: OAuth redirect/callback flow stays in Gateway; only User upsert/query delegates to Identity API

## Alternatives (Rejected)
- **Option B (incremental migration)**: Migrate User first → high cross-references between entities mean partial migration increases dual-datasource complexity
- **Option C (keep current state)**: No functional issues but MSA principle violation continues, lacking architectural consistency for the portfolio

## Risks
- Added latency from Gateway ↔ Identity HTTP calls (k8s internal network, ~1ms)
- Gateway-wide impact when Identity service is down (Circuit Breaker under review)
- Large number of test modifications (identity-related among 597 Gateway tests)

## Implementation Results (Sprint 51)
- Identity service: 34 new API endpoints built
- Gateway identity_db direct access: 19 files converted to IdentityClient HTTP calls
- 4 Entity files deleted, Enum/types separated into `common/types/identity.types.ts`
- Gateway branches coverage maintained at 97.79%

## Follow-up
- Migrate other services → direct Identity calls (remove Gateway proxy) — separate sprint
- Identity service HPA/PDB configuration
- L-14 security headers migration to Traefik (deferred)
- L-15 rate limit monitoring (deferred)
