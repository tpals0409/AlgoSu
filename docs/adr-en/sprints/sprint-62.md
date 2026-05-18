---
sprint: 62
title: "Admin Page & Feedback Logic Review"
date: "2026-04-08"
status: completed
agents: [Gatekeeper, Librarian]
related_adrs: []
---

# Sprint 62: Admin Page & Feedback Logic Review

## Decisions
### D1: Move feedback status filter to server-side
- **Context**: The existing Admin feedback page processed status filters on the client side, but this conflicted with server-side pagination (20 items/page), causing feedbacks in the given status on other pages to be missed.
- **Choice**: Add `status` query parameter to Identity `findAll`, propagate through the full pipeline (Identity→Gateway→Frontend)
- **Alternatives**: Load all data at once on the client — inefficient as data grows
- **Code Paths**: `services/identity/src/feedback/feedback.service.ts`, `services/gateway/src/feedback/feedback.controller.ts`, `frontend/src/app/admin/feedbacks/page.tsx`

### D2: Include full-dataset counts in server response
- **Context**: Admin dashboard stats (total/unresolved/bug) were aggregated based on the current 20-item page, resulting in inaccurate numbers
- **Choice**: Add `counts` field to `findAll` response — always return full stats by status (`OPEN`, `IN_PROGRESS`, ...) and by category (`cat:BUG`, `cat:GENERAL`, ...)
- **Alternatives**: Separate stats API — unnecessary additional call cost at current scale
- **Code Paths**: `services/identity/src/feedback/feedback.service.ts`, `frontend/src/app/admin/feedbacks/page.tsx`

### D3: Bug report screenshot JPEG→WebP conversion
- **Context**: Screenshots stored as Base64 Data URL in DB TEXT column, so minimizing size is important
- **Choice**: `canvas.toDataURL('image/webp', 0.65)` — 25-35% size reduction vs JPEG, equal or better quality
- **Alternatives**: Keep JPEG and just lower quality — WebP is always smaller at the same quality
- **Code Paths**: `frontend/src/components/feedback/BugReportForm.tsx`

## Patterns
### P1: Server-side filter + counts in unified response
- **Where**: `services/identity/src/feedback/feedback.service.ts` `findAll()`
- **When to Reuse**: When needing to show filtering stats on a dashboard with a paginated API. Including counts in the list API response avoids additional calls.

## Gotchas
### G1: Client filter + server pagination combination is always incomplete
- **Symptom**: Status filter applied only within the current page's 20 items, missing feedbacks in that status on other pages
- **Root Cause**: Server returns 20 items regardless of status, client filters within those
- **Fix**: Filters must be applied at the server query level (WHERE clause)

## Metrics
- Commits: 8, Files changed: 17
