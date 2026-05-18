---
sprint: 111
title: "Guest Mode Implementation (Sample Result Preview)"
period: "2026-04-21"
status: complete
start_commit: 2247c4c
end_commit: 7c45842
---

# Sprint 111 — Guest Mode Implementation (Sample Result Preview)

## Background

There was no entry point for unauthenticated users to experience AlgoSu's core value (AI code analysis) without OAuth registration. The `/login` page only offered 3 OAuth providers + demo account login (full feature tour), causing high drop-off from potential users who wanted to "just see the results briefly without signing up."

Sprint 111 introduced a lightweight guest mode showing only 3 pre-seeded sample analysis results **without session or authentication**. It is a completely independent module separated from the existing `GuestContext` (share-link based), with zero backend changes.

Wave structure: W1 (Herald frontend implementation) → W2 (Gatekeeper security review) → W3 (Scribe ADR + memory update).

## Goals

| Item | Content | Status |
|------|---------|--------|
| Middleware PUBLIC_PATHS extension | `/guest` unauthenticated access allowed | ✅ Complete (W1) |
| Static fixture data | `GuestSample[]` 3 items (JS/Python/SQL) | ✅ Complete (W1) |
| Guest index page | `/guest` — card grid + CTA | ✅ Complete (W1) |
| Guest detail page | `/guest/preview/[slug]` — ScoreGauge + feedback | ✅ Complete (W1) |
| GuestNav component | glassmorphism nav (logo + sign-up CTA + theme toggle) | ✅ Complete (W1) |
| Login page entry link | "Browse as guest" text link | ✅ Complete (W1) |
| Security review | Auth bypass / XSS / Open Redirect / route regression | ✅ 0 blocking (W2) |

---

## Decisions

### D1. Stateless Identification — No JWT/cookie, localStorage Flag Not Introduced

**Background**: Plan mentioned `localStorage: algosu:guest-mode=true` flag as an option, but Herald did not implement it.

**Options**:
1. Introduce localStorage flag (as planned)
2. Fully stateless — guest allowed by URL access alone, no flag

**Decision**: Option 2. localStorage flag not introduced.

**Rationale**: Gatekeeper review (A-2) confirmed this is security-superior as "state manipulation vector removed." Accessing `/guest` URL directly is recognized as guest — no additional state management needed. Guest-to-member conversion tracking (event logging) is a follow-up sprint task.

### D2. 3 Static Fixtures — Ensuring Difficulty/Language/Subject Diversity

**Background**: The number and type of guest samples needed to be decided.

**Options**:
1. Single sample (simplest)
2. 3 samples — Bronze/Gold/Silver, JavaScript/Python/SQL combination
3. 5+ samples

**Decision**: Option 2. 3 fixtures.

| Slug | Problem | Difficulty | Language | Score |
|------|---------|-----------|---------|-------|
| `two-sum` | LeetCode #1 Two Sum | BRONZE | JavaScript | 92 |
| `lru-cache` | LeetCode #146 LRU Cache | GOLD | Python | 88 |
| `sql-window` | Programmers Department Salary Ranking | SILVER | SQL | 85 |

**Rationale**: Covering Bronze/Silver/Gold 3 levels and JavaScript/Python/SQL 3 languages shows AlgoSu's core learning paths at once. SQL also exposes the SQL learning path added in Sprints 108–109.

### D3. Guest Route — AppLayout Not Used, Independent GuestNav

**Background**: In App Router, the guest route needed to bypass AppLayout (Sidebar, SessionProvider, etc.) which requires authentication.

**Options**:
1. Conditionally skip authentication in existing AppLayout
2. Independent layout + GuestNav for `/guest` group

**Decision**: Option 2. Separate layout for `/app/guest/` route group, new `GuestNav.tsx`.

**Rationale**: AppLayout includes auth-dependent components like `SessionProvider`, `useSession`, `Sidebar`. Conditional skip could cause side effects on existing auth flow — independent layout is safer from a separation of concerns perspective. Zero new Palette tokens added by reusing `glass-nav` token and existing `Logo`, `next-themes`.

### D4. No Real-time AI Calls — Static Fixtures Only

**Background**: Some reviews discussed providing real-time AI analysis via rate-limited API.

**Options**:
1. Rate-limited real-time AI calls (IP-based limiting)
2. Human-written static fixtures only (0 LLM calls)

**Decision**: Option 2. Static fixtures only.

**Rationale**: Triple burden of cost/security/latency. Guest mode's purpose is to preview the "form" of AI analysis results, not to provide actual analysis. Static fixtures can provide more polished exemplary answers than actual AI analysis results, with zero server resource consumption.

---

## Security Review Results (Gatekeeper W2)

0 blocking issues. All PASS.

| Item | Result |
|------|--------|
| Middleware route guard boundary conditions | /guestXYZ, /guest-admin blocking confirmed |
| Protected route regression | /dashboard → /login?redirect=... normal |
| API call absence | 0 fetch/authApi/token references |
| XSS vector | No dangerouslySetInnerHTML, Prism auto-escaping |
| Open Redirect | sanitizeRedirect() logic unchanged |
| Existing GuestContext separation | No import cross-references |
| slug Path Traversal | GUEST_SAMPLES.find() → notFound(), no filesystem access |
| Bundle size | /guest First Load 184 kB (under 200 KB threshold passed) |

**Recommendations (INFO — non-blocking):**
- A-1: `sql: 'sql'` not registered in CodeBlock LANG_MAP → text fallback (1-line addition recommended follow-up)
- A-2: robots.txt / noindex policy unresolved (decide in follow-up SEO sprint)
- A-3: sourceUrl hardcoding safe. Allowlist required when switching to dynamic sourcing

---

## Wave Execution Log

| Wave | Agent | Task | Commit |
|------|-------|------|--------|
| W1 | Herald | Middleware patch + fixture data + routes + GuestNav + login link (9 files) | `7c45842` |
| W2 | Gatekeeper | Security review (no code changes) | — |
| W3 | Scribe | Sprint 111 ADR + sprint-window/MEMORY.md update | — |

---

## Outputs and Changed Files

| File | Action | Wave | Description |
|------|--------|------|-------------|
| `frontend/src/middleware.ts` | Modified | W1 | '/guest' added to PUBLIC_PATHS (1 line) |
| `frontend/src/data/guest-samples/index.ts` | New | W1 | GuestSample type + GUEST_SAMPLES array |
| `frontend/src/data/guest-samples/samples/two-sum.ts` | New | W1 | Two Sum sample (BRONZE/JavaScript, score 92) |
| `frontend/src/data/guest-samples/samples/lru-cache.ts` | New | W1 | LRU Cache sample (GOLD/Python, score 88) |
| `frontend/src/data/guest-samples/samples/sql-window.ts` | New | W1 | Department Salary Ranking sample (SILVER/SQL, score 85) |
| `frontend/src/components/guest/GuestNav.tsx` | New | W1 | Guest-exclusive glassmorphism nav |
| `frontend/src/app/guest/page.tsx` | New | W1 | Guest index — hero + sample card grid |
| `frontend/src/app/guest/preview/[slug]/page.tsx` | New | W1 | Guest detail — ScoreGauge + CodeBlock + feedback + bottom banner |
| `frontend/src/app/(auth)/login/page.tsx` | Modified | W1 | "Browse as guest" text-text-3 link added |

**Change statistics**: 9 files changed, 892 insertions(+), 1 deletion(−)

**Commit list** (1 item):
- `7c45842` — feat(frontend): guest mode implementation — static fixture based sample analysis preview

---

## Lessons Learned

### 1. Security Benefits of Stateless Design

The plan included localStorage flag as an option, but Herald not implementing it was evaluated as "state manipulation vector removed" — superior in security — by Gatekeeper review. Fully stateless approach of identifying guests solely by URL-based route access is optimal for read-only preview like guest mode.

### 2. Design Clarity from Zero-Backend Constraint

The explicit constraint "0 backend code changes" kept the design simple. Naturally blocked consideration of real-time AI calls and allowed focus on the correct direction of static fixtures.

### 3. Existing Component Reuse — Zero New Palette Tokens

Complete reuse of existing components (ScoreGauge, CodeBlock, DifficultyBadge, parseFeedback()) and tokens (`glass-nav`, `text-text-3`, etc.) enabled implementation completion in a single wave without Palette consultation. Effect of explicitly specifying "no new tokens/Palette components" constraint in the sprint planning stage.

### 4. CodeBlock SQL Fallback — Unregistered Languages Must Be Pre-checked

The sql-window sample's `language: 'sql'` was not in CodeBlock's LANG_MAP, so text fallback was applied. This could have been prevented by pre-checking CodeBlock's supported language list when deciding fixture languages. Future new language sample additions must check LANG_MAP registration first.

---

## Carried Over

| Item | Content | Priority |
|------|---------|---------|
| CodeBlock SQL support | Add `sql: 'sql'` to LANG_MAP (1 line) | LOW |
| robots.txt / noindex policy | Decide guest page indexing | LOW |
| Guest conversion tracking | /guest → sign-up event logging | LOW |

---

## Related Documents

- `docs/adr/sprints/sprint-110.md` — preceding sprint (complete carry-over processing)
- `frontend/src/middleware.ts` — PUBLIC_PATHS guest patch
- `frontend/src/data/guest-samples/` — GuestSample type + 3 fixtures
- `frontend/src/app/guest/` — guest route group
- `frontend/src/components/guest/GuestNav.tsx` — guest-exclusive nav
