---
sprint: 112
title: "Sprint 111 Carry-over 3 Items Processing (micro-sprint)"
period: "2026-04-21"
status: complete
start_commit: 7c45842
end_commit: a42716f
---

# Sprint 112 — Sprint 111 Carry-over 3 Items Processing (micro-sprint)

## Background

At Sprint 111 close, Gatekeeper security review found 3 INFO-level recommendations classified as LOW carry-over. Per user request ("finish the carry-over items too"), they are immediately processed as a separate micro-sprint.

All 3 items are very small in change scope (1–3 lines), have no security/architecture impact, and require zero backend changes — chose direct processing to avoid Oracle dispatch overhead.

## Goals

| Item | Content | Status |
|------|---------|--------|
| A-1 CodeBlock SQL support | Add `sql: 'sql'` to LANG_MAP | ✅ Complete |
| A-2 Add /guest to sitemap | priority 0.9, monthly | ✅ Complete |
| A-3 Guest → member conversion tracking | EventTracker reuse (CTA click event) | ✅ Complete |

---

## Decisions

### D1. CodeBlock LANG_MAP Direct Addition (Palette consultation skipped)

**Background**: Sprint 111 W2 Gatekeeper INFO A-1: sql-window sample's `language: 'sql'` was not in LANG_MAP, falling back to 'text' with no syntax highlighting.

**Options**:
- (A) Add after Palette design token impact review
- (B) Herald adds simple data mapping (Palette consultation skipped) ← **selected**

**Selected**: (B) — LANG_MAP is a Prism language identifier mapping, not a design token. No new color/font/style changes. Palette consultation overhead not warranted for 1-line data addition.

**Result**: `frontend/src/components/ui/CodeBlock.tsx` LANG_MAP — `sql: 'sql'` 1 line added. SQL sample syntax highlighting normalized.

---

### D2. robots.txt Not Changed, Only sitemap Updated (guest page indexing allowed)

**Background**: Sprint 111 W2 Gatekeeper INFO A-2: Search engine indexing policy for guest pages was unresolved.

**Options**:
- (A) Apply noindex to `/guest` (treat as internal preview)
- (B) Allow `/guest` indexing + add to sitemap (treat as marketing funnel entry) ← **selected**
- (C) Add explicit allow line for `/guest` to robots.txt

**Selected**: (B) — Guest mode is fundamentally a marketing funnel entry point for member acquisition; search exposure aligns exactly with marketing objectives. Current robots.ts already allows `/` and only disallows `/api/`, `/auth/`, `/callback` — `/guest` is automatically allowed. No robots.ts changes needed. Only adding `/guest` to sitemap strengthens SEO signals.

**Result**: `frontend/src/app/sitemap.ts` — `${baseUrl}/guest` entry added (priority 0.9, changeFrequency monthly). robots.ts unchanged.

---

### D3. EventTracker Infrastructure Reuse — Zero Backend Additions

**Background**: Sprint 111 W2 Gatekeeper INFO A-3: Guest → member conversion funnel tracking was unimplemented. Separate sprint organization was recommended, but reviewing existing EventTracker infrastructure found it could be handled with very lightweight reuse.

**Options**:
- (A) Add new backend event endpoint
- (B) Introduce external analytics tools (GA/PostHog, etc.)
- (C) Reuse existing `eventTracker` (`/api/events` public endpoint) ← **selected**

**Selected**: (C) — `frontend/src/lib/event-tracker.ts` already has a BUFFER 5/FLUSH 30s based client + `/api/events` endpoint (public), and `EventTrackerProvider` auto-tracks PAGE_VIEW for all pages. Guest page visits are already automatically measured by PAGE_VIEW, and funnel analysis is possible by sessionId. Sufficient accuracy enhancement by additionally tracking only CTA click intent.

**Result**:
- `GuestNav.tsx` sign-up button: `eventTracker?.track('guest:cta_signup_click', { meta: { from: 'nav' } })`
- `guest/preview/[slug]/page.tsx` GuestCtaBanner sign-up button: `eventTracker?.track('guest:cta_signup_click', { meta: { from: 'preview_banner' } })`
- Server components (GuestPage index, GuestFooter) have PAGE_VIEW which is sufficient — avoided forcing 'use client' by adding onClick.

---

## Outputs

| File | Change | Description |
|------|--------|-------------|
| `frontend/src/components/ui/CodeBlock.tsx` | +1 | sql added to LANG_MAP |
| `frontend/src/app/sitemap.ts` | +1 | /guest sitemap registration |
| `frontend/src/components/guest/GuestNav.tsx` | +2 | eventTracker import + onClick CTA tracking |
| `frontend/src/app/guest/preview/[slug]/page.tsx` | +2 | eventTracker import + onClick CTA tracking |
| **Total** | **+6 / -0** | 4 files, 1 commit (a42716f) |

## Verification

- `npx tsc --noEmit`: 0 errors
- `npx next lint` (changed files): 0 new warnings (CodeBlock line 78 inline-style warning is pre-existing)
- Build impact: same — /guest chunk size change minimal (eventTracker already included in bundle)

## Lessons Learned

- **Value of micro-sprint**: Sprint 111's 3 LOW carry-overs combined to 6-line change. Immediate follow-up processing is more efficient than organizing a separate sprint. Closed with 1 ADR + 1 commit.
- **Effect of infrastructure rediscovery**: A-3 "guest conversion tracking" was recommended for a separate sprint, but EventTracker + EventTrackerProvider infrastructure was rediscovered and processed with only 2 onClick additions. Zero new backend/external tools introduced.
- **Criteria for avoiding Oracle dispatch**: When change scope is under 5 lines + no security/architecture impact + single domain, direct processing is more efficient than dispatch.

## Carried Over

None — All 3 Sprint 111 INFO items closed.

## Ongoing Follow-up (Always in MEMORY.md)

- SWR/React Query introduction (frontend data fetching standardization)
- Redis statistics cache (dashboard statistics DB direct query → cache migration)
- problem.tags JSON column migration + seed data enrichment
