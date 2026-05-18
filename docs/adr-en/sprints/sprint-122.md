---
sprint: 122
title: "Global Internationalization Completion — LanguageSwitcher UX Path + Full Page Translation + SEO Support"
period: "2026-04-23"
status: completed
start_commit: a98b84c
end_commit: 37c8eb2
---

# Sprint 122 — i18n UX Path Completion and Full Page Translation

## Background

Sprint 121 built the `next-intl`-based i18n architecture and completed Landing/Auth demo 2-page translations. However, the following UX defects were confirmed post-merge and transferred to Sprint 122 as top priority work.

**Transfer reasons (discovered after Sprint 121 close)**:
- `LanguageSwitcher` was only integrated into `AppLayout` (post-login screens), making **unauthenticated users (landing/Auth screen visitors) unable to switch language via UI**
- Directly entering `/en/*` URL renders landing in English, but other pages (dashboard, problems, etc.) remain untranslated
- **Hardcoded Korean strings remain** in `app/[locale]/layout.tsx` (skip-nav), `not-found.tsx`, `*/error.tsx` (21 files), `components/ad/AdBanner.tsx`, etc.

Sprint 122 goal: On the i18n foundation built by Sprint 121, transition to an actually globally-serviceable state via **unauthenticated UX path completion** + **full major page translation** + **SEO hreflang support**.

---

## Key Decisions (D1~D3)

### D1. LanguageSwitcher Placement Strategy

**Problem**: In Sprint 121, `LanguageSwitcher` was placed in `AppLayout`'s sidebar/topbar. The landing page (`LandingContent.tsx`) and auth layout (`app/[locale]/(auth)/layout.tsx`) have no toggle button, so unauthenticated users cannot switch language via UI.

**Selected**:

| Placement | Implementation | Rationale |
|-----------|----------------|-----------|
| LandingContent Nav | Insert in `LandingContent.tsx` header right area, between theme toggle and login button | Landing visitors (unauthenticated) can select language immediately |
| AuthShell Client wrapper | Create new `AuthShell` (Client Component) in `app/[locale]/(auth)/layout.tsx`, insert as glass-nav header component | Applied across all Auth layout at once for login/callback/register etc. |

**generateMetadata placement**: Auth layout's `generateMetadata` **stays in Server Component `layout.tsx`**. `AuthShell` is separated as Client Component handling only interaction (LanguageSwitcher). Clearly separating Server/Client boundary maintains metadata SEO benefit.

**Comparison**:

| Approach | Advantage | Disadvantage |
|----------|-----------|--------------|
| Convert all of layout.tsx to Client | Simple implementation | Cannot use generateMetadata, SEO loss |
| New AuthShell Client wrapper (selected) | Maintains Server/Client boundary, keeps generateMetadata | One additional component layer |
| Per-page individual insertion | Fine-grained control | Duplicate code, need to modify all 21 Auth sub-pages |

**Trade-off**: Separating `AuthShell` as Client Component enables using client hooks like `useSearchParams`, `usePathname` in the Auth layout tree. However, `getTranslations()` server function cannot be called directly inside `AuthShell` — translations must use `useTranslations()` hook.

---

### D2. Namespace Domain Grouping

**Problem**: The 4 namespaces (common/landing/auth/difficulty) confirmed in Sprint 121 cannot accommodate translations for major pages like dashboard, problems, submissions, reviews. Namespace structure needs expansion for Sprint 122's full translation scope.

**Selected — keep existing 4 + create 6 new**:

| Namespace | Status | Content |
|-----------|--------|---------|
| `common` | Existing (extended) | Buttons/labels/loading + `nav.*` key extension (menu names, breadcrumbs, accessibility labels) |
| `landing` | Existing unchanged | Hero, feature intro, CTA |
| `auth` | Existing unchanged | Login, OAuth errors, register |
| `difficulty` | Existing unchanged | Difficulty labels and tooltips |
| `dashboard` | **New** | Dashboard statistics widgets, recent submissions, analytics integration |
| `problems` | **New** | Problem list, detail, tags, difficulty filter UI |
| `submissions` | **New** | Submission list, detail, status labels, result messages |
| `reviews` | **New** | Peer review list, review form, evaluation items |
| `account` | **New** | Profile page + settings page integrated (`profile.*`, `settings.*` sub-keys) |
| `errors` | **New** | Common error page strings (not-found, 403/404/500, skip-nav) |

**`common.nav.*` extension detail**:
```
common.nav.dashboard   → "대시보드" / "Dashboard"
common.nav.problems    → "문제" / "Problems"
common.nav.submissions → "제출" / "Submissions"
common.nav.reviews     → "리뷰" / "Reviews"
common.nav.profile     → "프로필" / "Profile"
common.nav.settings    → "설정" / "Settings"
common.nav.admin       → "관리자" / "Admin"
common.nav.skipToMain  → "본문으로 건너뛰기" / "Skip to main content"
```

**`errors.json` + `LocalizedErrorPage` wrapper strategy**:

Korean hardcoded strings are scattered across 21 `*/error.tsx` files and `not-found.tsx`. Instead of modifying each file individually, create a **`LocalizedErrorPage` common wrapper component** and batch-replace all error.tsx files to import it.

```
components/error/LocalizedErrorPage.tsx  ← Client Component
  - uses useTranslations('errors')
  - props: errorCode (404|403|500|...), retry?: boolean
  - 21 error.tsx files replaced with <LocalizedErrorPage errorCode={...} />
```

**`errors.json` key structure**:
```json
{
  "notFound": { "title": "...", "description": "...", "back": "..." },
  "forbidden": { "title": "...", "description": "..." },
  "serverError": { "title": "...", "description": "...", "retry": "..." },
  "generic": { "title": "...", "description": "...", "home": "..." }
}
```

**Rationale**: Modifying 21 error.tsx files individually creates excessive changed files and makes consistency hard to maintain. Centralized error UI management via single `LocalizedErrorPage` wrapper means only one file needs modification for future error message changes (OCP). Configured as Client Component to use `useTranslations` hook.

**Trade-off**: `account` namespace integrating `profile` and `settings` may result in larger file sizes. If both pages expand independently in the future, split `account.profile.*`/`account.settings.*` sub-keys into separate files.

---

### D3. SEO Strategy — hreflang + metadataBase + sitemap

**Problem**: `sitemap.xml` hreflang tags, `robots.txt`, and `metadataBase` configuration are incomplete as Sprint 121 carry-overs. As English pages are added, SEO support is needed for search engines to correctly index locale-specific URLs.

**Selected**:

#### 1) `metadataBase` — `NEXT_PUBLIC_BASE_URL` environment variable

Manage base URL for all metadata via environment variable:
```typescript
// app/[locale]/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algosu.kr'),
};
```

**Rationale**: Remove hardcoded domain strings and separate URLs per staging/production environment via environment variables.

#### 2) `buildLocaleAlternates` helper — `src/lib/i18n/metadata.ts`

Create a new helper function that generates locale-specific `alternates.languages` objects for reuse in each page's `generateMetadata`:

```typescript
// src/lib/i18n/metadata.ts
/**
 * @file src/lib/i18n/metadata.ts
 * @domain i18n
 * @layer lib
 * @related src/i18n/routing.ts, app/[locale]/layout.tsx
 */

/**
 * Generates hreflang alternates object per locale.
 * @param locale - current locale ('ko' | 'en')
 * @param path - path (e.g., '/problems', '/dashboard')
 * @returns Next.js Metadata alternates.languages format
 */
export function buildLocaleAlternates(
  locale: string,
  path: string,
): Record<string, string> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algosu.kr';
  return {
    ko: `${base}${path}`,
    en: `${base}/en${path}`,
    'x-default': `${base}${path}`,
  };
}
```

**Usage example**:
```typescript
// app/[locale]/problems/page.tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'problems' });
  return {
    title: t('meta.title'),
    alternates: {
      languages: buildLocaleAlternates(locale, '/problems'),
    },
  };
}
```

#### 3) `app/sitemap.ts` — alternates.languages hreflang

Auto-generate locale-specific URL pairs in Next.js App Router's `sitemap.ts`:

```typescript
// app/sitemap.ts (conceptual)
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algosu.kr';
  const paths = ['/problems', '/dashboard', '/submissions', '/reviews'];
  return paths.map((path) => ({
    url: `${base}${path}`,
    alternates: {
      languages: {
        ko: `${base}${path}`,
        en: `${base}/en${path}`,
      },
    },
  }));
}
```

#### 4) New `app/robots.ts`

Dynamically generate `robots.txt` specifying allowed/disallowed search engine crawling paths:

```typescript
// app/robots.ts
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://algosu.kr';
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/'] },
    sitemap: `${base}/sitemap.xml`,
  };
}
```

**Comparison**:

| Approach | Advantage | Disadvantage |
|----------|-----------|--------------|
| Static `public/sitemap.xml` | Simple | Manual update needed when pages are added |
| `app/sitemap.ts` dynamic generation (selected) | Auto-reflects when pages added | Requires build-time execution |
| External sitemap generator | Fully automated | Additional tool dependency |

**Trade-off**: Dynamic page URLs (problem detail, submission detail, etc.) require DB queries, so Sprint 122 scope only includes static paths. Dynamic path hreflang is handled via `generateSitemaps` extension in Sprint 123.

---

## Scope Decisions

### Sprint 122 Scope — Page Level + P0 Processing

| Category | Included | Reason |
|----------|----------|--------|
| LanguageSwitcher UX path improvement | ✅ | P0 UX defect for unauthenticated users |
| Hardcoded Korean cleanup (layout, not-found, 21 error.tsx, AdBanner) | ✅ | Korean remaining in English mode is P0 visual bug |
| Major 6-page translations (dashboard/problems/submissions/reviews/profile/settings) | ✅ | Sprint 122 core goal |
| SEO support (metadataBase, buildLocaleAlternates, sitemap.ts, robots.ts) | ✅ | Sprint 121 carry-over |
| register 3-page translations | ✅ (Critic seed processing) | Auth path completeness |
| **Component-level 53 individual translations** | ❌ → Sprint 123 carry-over | Too broad, apply progressively after page-level completion |
| AuthContext locale-aware transition | ✅ (Critic seed) | `window.location.href` → `useRouter` |
| CI translation key parity check | ✅ (Critic seed) | Auto-detect ko/en key mismatches |
| Dynamic translation key type safety | ⬜ → decide after review | next-intl type plugin effort unknown |
| renderWithI18n test migration | ⬜ → Sprint 123 | Prioritize existing test stability |
| Backend OAuth error code internationalization | ❌ → Sprint 123+ | Separate backend strategy needed |

### Component 53 Sprint 123 Carry-Over Rationale

Korean hardcoding within components identified during Sprint 121 Phase B `app/[locale]/*` reorganization spans 53 files. Batch-processing in Sprint 122 would:
- Excessive changed files → reduced PR review quality
- No verification baseline for component pre-processing before page-level translations are complete

**Principle**: Apply sequentially, starting from components whose page-level translations (+ namespaces) are complete. Proceed alongside `renderWithI18n` test migration in Sprint 123.

---

## Phase Plan (A~H)

| Phase | Agent | Content | Dependencies |
|-------|-------|---------|--------------|
| **A** | Scribe | Write and confirm ADR D1~D3 (this document) | — |
| **B** | Architect | Initialize 6 new namespace JSON files (ko/en) + `common.nav.*` extension | Phase A |
| **C** | Palette | LanguageSwitcher UX path — LandingContent Nav insertion + new AuthShell | Phase A |
| **D** | Palette | Batch hardcoded Korean cleanup — new `LocalizedErrorPage` wrapper + replace 21 error.tsx + skip-nav/not-found/AdBanner | Phase B |
| **E** | Palette | Major page translation — dashboard/problems/submissions/reviews | Phase B |
| **F** | Palette | Account page translations — profile/settings/register 3 pages | Phase B |
| **G** | Architect | SEO support — `src/lib/i18n/metadata.ts` helper + `sitemap.ts` + `robots.ts` + `generateMetadata` alternates for each page | Phase E/F |
| **H** | Gatekeeper | Critic carry-over seed processing — AuthContext locale-aware transition + CI key parity check + Sprint 120 carry-over P1 3 items | Phase C |

---

## Phase Execution Results

| Phase | Content | Result |
|-------|---------|--------|
| A | Design decisions (D1~D3) ADR confirmed + Scout full scan (96 app files, 53 components, initial i18n application 8% → page-level 100% achieved) | ✅ |
| B | LanguageSwitcher UX path complete — LandingContent Nav header right insertion + new `AuthShell` Client Component | ✅ |
| C | P0 hardcoded batch processing — skip-nav, `errors.json` 12 page keys, `LocalizedErrorPage` wrapper batch-replacing 21 `error.tsx`, `not-found` 3 Server Component conversions, `AdBanner` translations | ✅ |
| D Wave 1 | dashboard + analytics translations (D-0/D-1/D-2, `dashboard.json` ~80 keys) | ✅ |
| D Wave 2 | problems domain translations (D-3a/b/c/d, `problems.json` ~80 keys, 4 pages) | ✅ |
| D Wave 3 | submissions domain translations (D-4a/b/c/d, `submissions.json`, 3 pages) | ✅ |
| D Wave 4 | reviews translations (D-5a/b, `reviews.json`, 1 page) | ✅ |
| D Wave 5 | account translations (D-6a/b/c, `account.json`, profile + profile/[slug] + settings) | ✅ |
| E | SEO — `buildLocaleAlternates` helper, `metadataBase`, `sitemap.ts` hreflang, `robots.ts` | ✅ |
| H-1 | ADR finalization + memory update | ✅ |

**Cumulative namespaces 10**: `common`, `landing`, `auth`, `difficulty`, `errors`, `dashboard`, `problems`, `submissions`, `reviews`, `account`
**Wave D total commits**: 14 commits
**Final commit**: `37c8eb2` (Phase E)

---

## Critic Review History

| Round | Review ID | Target | Key Findings | Resolution |
|-------|-----------|--------|--------------|------------|
| 1st | 145430 | Phase B+C 8 commits | P2 1 item — not-found provider missing | Immediately resolved via fix-palette commit |
| 2nd | 145430-66123 | fix 3 commits | Medium 2 + Low 1 | All judged as pre-existing or non-blocking, no additional action needed |
| Wave 1~5 individual | — | Wave D 14 commits | auto-critic triggered | Individual results to be separately confirmed (not aggregated) |

---

## Verification

| Item | Result |
|------|--------|
| `tsc --noEmit` | ✅ PASS |
| ESLint | ✅ PASS |
| jest | ✅ PASS |
| Critic Critical/High | 0 items |

---

## Sprint 123 Carry-Over Seeds

List of items intentionally excluded from Sprint 122 scope and transferred to Sprint 123.

### Component Translations (53 files)

In priority order:
- `AppLayout` / `TopNav` / `StudySidebar` / `NotificationBell`
- `Dashboard*` / `Analytics*` widget components
- `Feedback*` / `Review*` / `Submission*`
- `ShareLinkManager` and other shared components

### Untranslated Pages

| Page | Reason |
|------|--------|
| `admin/problems/[id]/edit`, `admin/problems/create` | admin domain separate processing |
| `admin/feedbacks` | admin domain separate processing |
| `problems/[id]/status` (study statistics) | Separate translation key design needed |
| `studies/page`, `studies/[id]/page`, `studies/[id]/room` | Entire studies domain separate Wave |
| `guest/page`, `shared/[token]/page` | Public shared paths |
| `privacy/terms` | Translate after legal review |

### i18n Quality Improvements

| Item | Source |
|------|--------|
| `renderWithI18n` test migration full application | Critic Low-2 (Sprint 121) |
| next-intl type plugin introduction (dynamic translation key type safety) | Critic recommendation |
| Zod schema validation message i18n — `errorMap` pattern introduction review | New seed |
| `lib/date.ts` relative time `useFormatter` migration | New seed |
| `hooks/useSubmissionSSE` dynamic translation caller-level migration | New seed |
| `studies/[id]/room/utils.ts` Korean in pure TS utilities | New seed |
| `lib/api/client.ts` HTTP error message internationalization | New seed |

### Security and Backend

| Item | Source |
|------|--------|
| Sprint 120 carry-over Frontend P1 3 items (p1-023/024/025) | Sprint 120 unprocessed |
| P1 security 49 items | Sprint 118/119 batches |
| Backend OAuth error structuring (Sprint 121 M-E2 root fix) | Separate ADR needed |

### Critic-Identified Anti-patterns

| Item | Content |
|------|---------|
| Remove `code: '404'` translation key | Anti-pattern using numeric key as string — replace with semantic keys like `notFound` |

---

## Related Documents

- Previous sprint: [sprint-121.md](./sprint-121.md)
- Next sprint: [sprint-123.md](./sprint-123.md)
- Current sprint window: `memory/sprint-window.md`
- Design tokens: `CLAUDE.md` § Design Tokens (UI v2)
- Annotation dictionary: `docs/conventions/annotation-dictionary.md`
- next-intl official docs: https://next-intl-docs.vercel.app/
- Next.js Metadata API: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
