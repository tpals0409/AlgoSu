---
sprint: 121
title: "Global Service Preparation — i18n Foundation + Demo 2-Page Translation"
period: "2026-04-23"
status: completed
start_commit: 216edfa
end_commit: 466d658
---

# Sprint 121 — i18n Architecture Design and Foundation

## Background

The AlgoSu platform currently operates in Korean only. As part of the global user acquisition strategy, this sprint establishes an i18n foundation for adding English (en) as an additional supported language, designed for easy future language expansion.

i18n support in the Next.js 15 App Router environment requires complex architectural decisions around library selection, URL routing strategy, translation resource structure, and locale detection order. Sprint 121 Phase A confirms these four key decisions (D1~D4) as an ADR, then implements them sequentially in Phase B~F.

## Goals

| Phase | Content | Status |
|-------|---------|--------|
| A | Write i18n architecture ADR (finalize D1~D4) | ✅ Complete |
| B | next-intl installation + Next.js App Router integration (middleware, i18n.ts, routing config) | ✅ Complete |
| C | Create messages/{locale}/{namespace}.json structure + initialize common translations | ✅ Complete |
| D | Demo page 1 — Apply translations to Landing page | ✅ Complete |
| E | Demo page 2 — Apply translations to Auth (login) page | ✅ Complete |
| F | Language switcher UI + Critic fixes + ADR finalization | ✅ Complete |

## Key Decisions (D1~D4)

### D1. i18n Library — next-intl Selected

**Selected**: `next-intl` (v3.x)

**Comparison**:

| Item | next-intl | next-i18next |
|------|-----------|--------------|
| Official App Router support | ✅ Native | ⚠️ Pages Router-centered, App Router unofficial |
| Server Component translations | ✅ Direct call from RSC | ❌ Client-side only |
| Middleware locale detection | ✅ Built-in (`createMiddleware`) | ⚠️ Separate config needed |
| Type safety | ✅ `useTranslations` type inference | ⚠️ Partial |
| Bundle size (gzip) | ~11 KB | ~15 KB |
| Last release | Active (2024~) | Maintenance mode |

**Rationale**: `next-i18next` is not officially supported in Next.js 15 App Router + React Server Components environments. `next-intl` provides the same API for both RSC (`getTranslations()`) and client components (`useTranslations()`), ensuring pattern consistency. Also, built-in middleware and `createNavigation()` directly integrate with App Router routing, providing type-safe `Link` and `redirect` without additional wrappers.

**Trade-off**: next-intl's middleware needs to chain with the existing auth middleware (`middleware.ts`). A matcher pattern separation or `withAuth(withI18n(...))` wrapping strategy is needed (specified in Phase B).

---

### D2. URL Routing Strategy — `/en/*` prefix, default `ko` prefix omitted

**Selected**:
- English: explicit `/en` prefix — `/en/dashboard`, `/en/problems`, etc.
- Korean (default): no prefix — `/dashboard`, `/problems`, etc.

**Comparison**:

| Strategy | Example | Advantage | Disadvantage |
|----------|---------|-----------|--------------|
| Default locale prefix omitted | `/dashboard` (ko), `/en/dashboard` | Existing URLs preserved, minimal SEO impact | Locale unclear from URL alone |
| All locales prefixed | `/ko/dashboard`, `/en/dashboard` | Clear locale indication | All existing links/bookmarks broken |
| Cookie-based (no prefix) | `/dashboard` (ko/en decided by cookie) | No URL change | SEO hreflang impossible, crawler locale identification impossible |

**Rationale**: AlgoSu already serves Korean URLs like `/dashboard`, `/problems`. The "prefix omitted" approach preserves existing user bookmarks and links without breaking them, maintaining existing SEO without Google Search Console re-registration. English users get clear language separation via `/en/*`, making hreflang tag application easy.

**Trade-off**: Implementable via next-intl's `localePrefix: 'as-needed'` option, but middleware's `defaultLocale` handling logic must be clear. Root `/` access redirects internally to ko or en based on detection order (D4).

---

### D3. Translation Resource Structure — `messages/{locale}/{namespace}.json`

**Selected**:
```
frontend/messages/
  ko/
    common.json        # Common UI strings (buttons, labels, error messages)
    landing.json       # Landing page specific
    auth.json          # Auth page specific (login, OAuth errors)
    difficulty.json    # Difficulty labels (Bronze/Silver/Gold/Platinum/Diamond)
  en/
    common.json
    landing.json
    auth.json
    difficulty.json
```

**Comparison**:

| Structure | Example | Advantage | Disadvantage |
|-----------|---------|-----------|--------------|
| Single file per locale | `ko.json` | Simple | File bloat, no lazy load |
| Namespace separated | `messages/ko/landing.json` | Per-page lazy load, separation of concerns | Extra directory depth |
| Domain separated | `locales/ko/auth.json` | Clear domain context | Differs from next-intl default path |

**Confirmed namespaces (4)**:

| Namespace | Content |
|-----------|---------|
| `common` | Buttons (save/cancel/confirm), loading, common error messages, Nav menu names, Footer |
| `landing` | Hero section, feature introduction, CTA buttons |
| `auth` | Login title/description, GitHub OAuth button, error messages, redirect guidance |
| `difficulty` | Bronze/Silver/Gold/Platinum/Diamond labels + tooltip descriptions |

**Rationale**: next-intl supports namespace-level loading via `getTranslations({ namespace: 'landing' })`. Per-page bundle separation minimizes initial load size, and new page translations can be extended independently by just adding namespaces. Starting with 4 namespaces, then sequentially adding `dashboard`, `problems`, `submissions`, etc.

**Trade-off**: Translation file management cost increases as namespaces grow. This directory structure is compatible with standard formats for future i18n management tools (Lokalise, Crowdin, etc.).

---

### D4. Default Locale and Detection Order

**Selected**:
- **Default locale**: `ko` (Korean)
- **Fallback**: `ko` (show Korean string on missing translation key)
- **Detection order**: URL prefix → cookie (`NEXT_LOCALE`) → `Accept-Language` header

**Detection logic detail**:

```
1. URL has /en prefix  → locale: en
2. No URL prefix       →
   a. Cookie NEXT_LOCALE=en → locale: en
   b. No cookie           →
      i.  Accept-Language: en-* → locale: en
      ii. Other or missing  → locale: ko (default)
```

**Rationale**:
- **URL first priority**: Always respect locale of bookmarks/shared links. Consistent with SEO hreflang.
- **Cookie 2nd priority**: Remember locale selected by language switcher. Maintains user settings even on URLs without prefix.
- **Accept-Language 3rd priority**: Auto-detect based on browser settings for first-time new users. But only activates when URL and cookie are absent.
- **Default ko**: Since the majority of existing users are Korean, providing Korean on detection failure is safe.

**Fallback strategy**: In next-intl's `messages` option, keys without translations in `en` locale do not automatically fall back to `ko` — missing keys are detected as build-time warnings and displayed as key strings at runtime. CI adds next-intl key missing checks to guarantee translation completeness (Phase F or Sprint 122).

---

## Phase B~F Implementation Plan Overview

### Phase B — next-intl Installation and App Router Integration

- `npm install next-intl` (frontend package — project uses npm)
- `frontend/i18n.ts` — `routing` object config (`locales: ['ko', 'en']`, `defaultLocale: 'ko'`, `localePrefix: 'as-needed'`)
- `frontend/middleware.ts` — chain existing auth middleware with next-intl `createMiddleware`
- `frontend/app/[locale]/` — rearrange layout to App Router locale segment structure
- `next.config.ts` — apply `withNextIntl` wrapper

### Phase C — Translation Resource Initialization

- Create 4 `messages/ko/*.json` files (common, landing, auth, difficulty)
- Create 4 `messages/en/*.json` files (same keys, English translations)
- TypeScript type auto-generation config (`global.d.ts` or next-intl type plugin)

### Phase D — Landing Page Translation Application (Demo 1)

- Use `getTranslations('landing')` in `app/[locale]/(marketing)/landing/page.tsx` server component
- Complete `messages/{locale}/landing.json` key mapping
- Apply locale-based branching to metadata (`metadata`)

### Phase E — Auth Page Translation Application (Demo 2)

- Use `useTranslations('auth')` in `app/[locale]/(auth)/login/page.tsx` client component
- Translate OAuth error messages (`auth.json` `errors.*` keys)
- Translate error guidance in `app/[locale]/(auth)/callback/page.tsx`

### Phase F — Language Switcher UI + Critic Fixes + ADR Finalization

**Execution results** (Palette — 4 commits):

| Commit | Content |
|--------|---------|
| `6379fb5` | fix(frontend): remove callback OAuth error Korean fallback [M-E2] |
| `b1c3590` | fix(frontend): callback Suspense fallback accessibility improvement [L-E1] |
| `588f968` | feat(frontend): LanguageSwitcher component + TopNav integration |
| (this commit) | docs(adr): Sprint 121 ADR finalization |

**Changed files**:

| File | Action | Description |
|------|--------|-------------|
| `components/layout/LanguageSwitcher.tsx` | New | ko/en locale switch button (radiogroup, Glassmorphism) |
| `components/layout/__tests__/LanguageSwitcher.test.tsx` | New | 10 unit tests |
| `components/layout/TopNav.tsx` | Modified | LanguageSwitcher inserted (left of theme toggle) |
| `components/layout/__tests__/TopNav.test.tsx` | Modified | LanguageSwitcher mock added |
| `app/[locale]/(auth)/callback/page.tsx` | Modified | M-E2 Korean fallback removed + L-E1 Suspense aria-label |
| `messages/{ko,en}/auth.json` | Modified | errors.accountConflict key added |
| `messages/{ko,en}/common.json` | Modified | loading.verifying + language.* keys added |

**Critic M-E1 verification result**: `expired.*`, `demo.*`, `guest.*` keys are all in use in `login/page.tsx` — not unused, no removal needed.

**Verification**:
- `tsc --noEmit` passed
- `next lint` no warnings/errors
- `next build` successful
- Jest 122 suites / 1308 tests all passing (including LanguageSwitcher 10)

### Phase F Emergency Fix — Critic 6th Review M-F1/M-F2 (Palette)

**Finding**: Critic 6th review judged Sprint 121 core goal not achieved. TopNav.tsx is not actually imported/used in app rendering, and the user-visible layout is AppLayout.tsx. LanguageSwitcher was only integrated into TopNav, making it invisible to users.

**Execution results** (Palette — 2 commits):

| Commit | Content |
|--------|---------|
| `f864cf5` | feat(frontend): LanguageSwitcher AppLayout integration [M-F1] |
| `466d658` | fix(frontend): LanguageSwitcher query parameter preservation [M-F2] |

**Changed files**:

| File | Action | Description |
|------|--------|-------------|
| `components/layout/AppLayout.tsx` | Modified | LanguageSwitcher inserted at sidebar bottom (below theme toggle) + no-study topbar |
| `components/layout/__tests__/AppLayout.test.tsx` | Modified | LanguageSwitcher mock + 1 rendering test added |
| `components/layout/LanguageSwitcher.tsx` | Modified | useSearchParams added for query parameter preservation, @related AppLayout added |
| `components/layout/__tests__/LanguageSwitcher.test.tsx` | Modified | next/navigation mock + 3 query parameter preservation tests added |

**Verification**:
- `tsc --noEmit` passed
- `next lint` no warnings/errors
- `next build` successful
- Jest 122 suites / 1312 tests all passing (+4: AppLayout 1 + LanguageSwitcher 3)

### Post-Close UX Defect Found (Confirmed Sprint 122 transfer)

**Symptom**: Post-merge user report — "Toggle button doesn't work, Korean on English site".

**Diagnosis**:
- `LanguageSwitcher` is only integrated into `AppLayout` (visible only in post-login screens).
- **Landing page (`LandingContent.tsx`) and auth layout (`app/[locale]/(auth)/layout.tsx`) do not render the toggle button** — pre-login users cannot switch locale via UI.
- Direct URL entry (`/en/`) renders English landing normally, but other untranslated pages (dashboard, problems, etc. — outside Sprint 121 scope) remain in Korean.
- **Hardcoded Korean strings remain** in `app/[locale]/layout.tsx` (skip-nav), `app/[locale]/not-found.tsx`, `app/[locale]/*/error.tsx` (12+ files), `components/ad/AdBanner.tsx`, etc.

**Judgment**: Sprint 121 scope (foundation + demo 2 pages = landing/auth) technically met. However, for user UX completion, transferred as Sprint 122 top priority Phase.

**Sprint 122 Top Priority Work (English completion — see `sprint-window.md [2]`)**:
1. LanguageSwitcher UX path completion (LandingContent Nav + Auth layout)
2. Batch cleanup of hardcoded Korean strings (layout skip-nav, not-found, error.tsx 12+, AdBanner)
3. Translation expansion for key pages (dashboard/problems/submissions/reviews/profile/settings)

---

## Carried Over (Planned for Sprint 122+)

### Backend Response Message Internationalization

Backend (NestJS/FastAPI) error messages and response body internationalization is excluded from this sprint scope.

**Hold rationale**: The approach chosen is frontend translating via keys without directly exposing backend responses to users. Server response internationalization based on `Accept-Language` headers requires a separate strategy (e.g., NestJS `i18n` module), to be reviewed in Sprint 122.

### sitemap.xml / robots.txt Locale Support

sitemap.xml generation with `hreflang` tags and `robots.txt` updates will proceed once actual URL structure is finalized after Phase D~E translation application.

**Planned content**:
```xml
<url>
  <loc>https://algosu.kr/problems</loc>
  <xhtml:link rel="alternate" hreflang="ko" href="https://algosu.kr/problems"/>
  <xhtml:link rel="alternate" hreflang="en" href="https://algosu.kr/en/problems"/>
</url>
```

### Remaining Page Translation Application (Sprint 122+)

This sprint is limited to Landing + Auth demo 2 pages. Subsequent pages in priority order:

| Priority | Page/Component | Namespace Addition |
|----------|---------------|--------------------|
| 1 | Dashboard | `dashboard.json` |
| 2 | Problems list/detail | `problems.json` |
| 3 | Submissions | `submissions.json` |
| 4 | Nav, Footer common component enhancement | `common.json` extension |
| 5 | Admin panel | `admin.json` |

### Frontend P1 Security 3 Items (p1-023~025, Deferred to Sprint 122)

P1 3 items found in Sprint 120 frontend re-audit are independent of i18n work, to be processed in Sprint 122.

| Finding | File | Content |
|---------|------|---------|
| p1-023 | middleware.ts | /shared path missing from PUBLIC_PATHS |
| p1-024 | admin/layout.tsx | admin auth CSR-only |
| p1-025 | callback/page.tsx | OAuth error fragment displayed directly |

### Sprint 122 Carry-Over Seeds (Phase F derived)

| Item | Source | Description |
|------|--------|-------------|
| Dynamic translation key type safety | Critic Low-2 | Type inference limits for dynamic keys like `t(\`login.provider.${providerId}\`)` — review next-intl type plugin or custom type map |
| CI translation key parity check | Critic M-C2 | Add CI step to auto-detect ko/en JSON key structure mismatches |
| AuthContext locale-aware transition | Phase F finding | `AuthContext.tsx`'s `window.location.href` call doesn't account for locale prefix — needs `useRouter` migration |
| Backend OAuth error code internationalization | M-E2 root fix | Backend returns structured error codes (`account_conflict`, etc.) — current frontend whitelist-based temporary workaround |
| register page translations | Out of scope | Apply i18n to 3 register pages: `register/`, `register/github`, `register/profile` |
| renderWithI18n test migration expansion | Critic Low-2 | Gradually migrate existing `render()` direct call tests to `renderWithI18n()` |

---

## Related Documents

- ADR previous sprint: [sprint-120.md](./sprint-120.md)
- i18n library: [next-intl official docs](https://next-intl-docs.vercel.app/)
- Design tokens: `CLAUDE.md` § Design Tokens (UI v2)
- Language switcher UI: Palette agent guide compliant (`components/layout/` placement)
