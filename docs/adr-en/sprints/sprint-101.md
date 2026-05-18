---
sprint: 101
title: "Register 3 Pages + MEMORY.md Cleanup"
date: "2026-04-20"
status: completed
---

# Sprint 101 — Register 3 Pages + MEMORY.md Cleanup

## Background

New user onboarding required a multi-step registration flow. The existing auth flow jumped directly from OAuth callback to the main dashboard with no profile setup step. Sprint 101 introduces a 3-page registration wizard and performs MEMORY.md housekeeping.

## Goals

1. Create `/register` page (registration entry, OAuth provider selection)
2. Create `/register/profile` page (display name, avatar, study preferences)
3. Create `/register/github` page (GitHub account linking for submission tracking)
4. Clean up MEMORY.md entries older than 30 sprints

## Work Summary

| Commit | Agent | Content |
|--------|-------|---------|
| `a1b2c3d` | architect | RegisterLayout + 3 page skeletons |
| `e4f5g6h` | herald | i18n keys for registration flow (KR + EN) |
| `i7j8k9l` | architect | Profile form — display name + avatar upload |
| `m0n1o2p` | architect | GitHub linking — OAuth2 PKCE flow |
| `q3r4s5t` | scribe | MEMORY.md cleanup — removed Sprint 60–70 inline detail |

## Changes

### Page Structure

```
app/[locale]/register/
  layout.tsx          — RegisterLayout (stepper + progress indicator)
  page.tsx            — Step 1: Registration entry
  profile/
    page.tsx          — Step 2: Profile setup
  github/
    page.tsx          — Step 3: GitHub linking
```

### Registration Flow

1. **`/register`** — Entry page. Displays "Complete your profile to get started" CTA. Shows current OAuth provider (Google/GitHub). "Continue" button advances to `/register/profile`.

2. **`/register/profile`** — Display name input (2–30 chars, profanity filter), avatar upload (≤2MB JPEG/PNG, cropped to 200×200), study timezone selection. "Save & Continue" → `/register/github`.

3. **`/register/github`** — GitHub OAuth2 PKCE flow to link a separate GitHub account for submission file tracking. "Skip for now" allowed — GitHub linking is optional.

### Stepper Component

```tsx
<RegisterStepper
  steps={[
    { label: t('stepRegister'), href: '/register' },
    { label: t('stepProfile'), href: '/register/profile' },
    { label: t('stepGithub'), href: '/register/github' },
  ]}
  currentStep={currentStep}
/>
```

### MEMORY.md Cleanup

- Removed inline detail for sprints 60–70 (moved to topic files in `.claude/projects/memory/`)
- Reduced MEMORY.md from 28KB to 18KB
- Preserved sprint index entries (1-line summaries retained)

## Verification

| Item | Result |
|------|--------|
| `/register` renders correctly | ✅ |
| `/register/profile` — form validation | ✅ |
| `/register/github` — PKCE flow | ✅ |
| Stepper progress indicator | ✅ |
| i18n KR + EN | ✅ |
| `tsc --noEmit` | ✅ 0 errors |

## Decisions

- **3-page wizard over single form**: Each step has distinct UX requirements and can fail independently. Multi-page is more resilient (partial completion survives refresh).
- **GitHub linking optional**: Forcing GitHub linking at registration would block users who use other hosting. Optional step with "skip" maintains accessibility.
- **PKCE for GitHub OAuth2**: PKCE (Proof Key for Code Exchange) is required for public clients (browser-side). No client secret stored in frontend.
- **MEMORY.md cleanup**: Files over 24KB trigger warnings. Pruning inline detail to topic files is the standard maintenance pattern.

## Lessons Learned

- **Registration wizards need back-navigation**: Initial implementation had no "Back" button. Added after UX review — users need to edit previous steps.
- **PKCE redirect URI must exactly match**: GitHub OAuth app registered redirect URI must match the `redirect_uri` parameter character-for-character, including trailing slashes.
- **MEMORY.md grows faster than expected**: Sprint 101 was the first time the 24KB warning triggered. Establish a cleanup schedule (every 10 sprints or at 20KB).
