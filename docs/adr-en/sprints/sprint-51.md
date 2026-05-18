---
sprint: 51
title: "Gateway → Identity DB Separation"
date: "2026-03-18"
status: completed
---
# Sprint 51 — Gateway → Identity DB Separation

## Goals
Convert Gateway's direct access to identity_db (19 files, 6 entities) to Identity service API calls to comply with the DB per Service principle.

## Background
ADR-001: `docs/adr/ADR-001-gateway-identity-db-separation.md`

## Wave Plan

### W1 — Identity Service Foundation
| # | Task | Agent |
|------|------|-------|
| 1-1 | Register 6 Identity Entities (Study, StudyMember, StudyInvite, Notification, ShareLink + User supplement) | Architect |
| 1-2 | Create Identity module structure (UserModule, StudyModule, NotificationModule, ShareLinkModule) | Architect |
| 1-3 | Identity InternalKeyGuard + HttpModule infrastructure | Architect |

### W2 — Identity API Construction
| # | Task | Agent |
|------|------|-------|
| 2-1 | User API: findById, findByEmail, upsert, update, softDelete, GitHub integration | Gatekeeper |
| 2-2 | Study API: CRUD + StudyMember management + StudyInvite management | Gatekeeper |
| 2-3 | Notification API: CRUD + unreadCount + markRead + 30-day cleanup | Postman |
| 2-4 | ShareLink API: CRUD + verify + profileSettings | Postman |

### W3 — Gateway Conversion
| # | Task | Agent |
|------|------|-------|
| 3-1 | Create Gateway IdentityClient service (Identity HTTP call wrapper) | Gatekeeper |
| 3-2 | OAuthService conversion: userRepository → IdentityClient | Gatekeeper |
| 3-3 | StudyService conversion: repository → IdentityClient | Gatekeeper |
| 3-4 | NotificationService + DeadlineReminderService conversion | Postman |
| 3-5 | ShareLinkService + PublicProfile/PublicShare conversion | Postman |
| 3-6 | Guards conversion (StudyMemberGuard, StudyActiveGuard, ShareLinkGuard) | Gatekeeper |
| 3-7 | JwtMiddleware conversion: userRepository → IdentityClient | Gatekeeper |
| 3-8 | InternalController conversion: repository → IdentityClient | Gatekeeper |

### W4 — Cleanup & Verification
| # | Task | Agent |
|------|------|-------|
| 4-1 | Remove Gateway identity_db TypeORM connection + delete Entity files | Architect |
| 4-2 | Fix Gateway tests (convert identity-related mocks) | Conductor |
| 4-3 | Write Identity service tests | Conductor |
| 4-4 | Update K8s manifests (Identity env, NetworkPolicy) | Architect |
| 4-5 | CI verification + integration tests | Conductor |

## Identity API Endpoint Design

### User API (`/api/users`)
```
POST   /api/users/upsert          — OAuth upsert (email + provider)
GET    /api/users/:id              — Lookup by ID
GET    /api/users/by-email/:email  — Lookup by email
PATCH  /api/users/:id              — Profile update (name, avatar_url)
DELETE /api/users/:id              — Soft delete
PATCH  /api/users/:id/github       — GitHub link/unlink
GET    /api/users/:id/github-status — GitHub link status
GET    /api/users/:id/github-token  — GitHub token (encrypted)
GET    /api/users/by-slug/:slug    — Public profile lookup
PATCH  /api/users/:id/profile-settings — Profile settings (slug, is_public)
```

### Study API (`/api/studies`)
```
POST   /api/studies                — Create study (+auto-register member)
GET    /api/studies/:id            — Study detail
GET    /api/studies/by-user/:userId — User's joined studies list
PUT    /api/studies/:id            — Update study
DELETE /api/studies/:id            — Delete study

POST   /api/studies/:id/members           — Add member
GET    /api/studies/:id/members/:userId    — Get member
DELETE /api/studies/:id/members/:userId    — Remove member
PATCH  /api/studies/:id/members/:userId/role     — Change role
PATCH  /api/studies/:id/members/:userId/nickname — Update nickname
GET    /api/studies/:id/members            — Get all members

POST   /api/studies/:id/invites           — Create invite
GET    /api/invites/by-code/:code         — Lookup by code
PATCH  /api/invites/:id/consume           — Consume invite
```

### Notification API (`/api/notifications`)
```
POST   /api/notifications                 — Create notification
GET    /api/notifications/by-user/:userId — User notification list
GET    /api/notifications/by-user/:userId/unread-count — Unread count
PATCH  /api/notifications/:id/read        — Mark as read
PATCH  /api/notifications/by-user/:userId/read-all — Mark all as read
DELETE /api/notifications/old             — 30-day cleanup
```

### ShareLink API (`/api/share-links`)
```
POST   /api/share-links                   — Create share link
GET    /api/share-links/by-user/:userId   — User's link list
PATCH  /api/share-links/:id/deactivate    — Deactivate
GET    /api/share-links/by-token/:token   — Token validation
```

## Environment Variables
Identity service: keep existing DATABASE_* variables
Gateway addition: `IDENTITY_SERVICE_URL=http://identity-service:3000`

## Carried Over Items (excluded from this sprint)
- L-14: Security headers Traefik migration
- L-15: Rate limit monitoring
- Other services → Identity direct call conversion (remove Gateway proxy)
