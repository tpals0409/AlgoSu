---
sprint: 79
title: "Code Hygiene & Process Improvement"
date: "2026-04-10"
status: completed
agents: [Oracle, Gatekeeper, Scribe, Palette, Herald]
related_adrs: []
---

# Sprint 79: Code Hygiene & Process Improvement

## Decisions

### D1: next-mdx-remote 6.0.0 Migration — Version Bump Only, No Code Changes
- **Context**: CWE-94 CVSS 8.8 vulnerability exists in next-mdx-remote 4.x-5.x. Blog is a build-time static export so not practically exploitable, but addressing it for dependency hygiene.
- **Choice**: Direct upgrade from 5.0.0 → 6.0.0. Confirmed compileMDX + next-mdx-remote/rsc API compatibility, then performed version bump only with no code changes.
- **Alternatives**: None (6.0.0 is the only patched version)
- **Code Paths**: `blog/package.json`, `blog/src/lib/mdx.ts` (no changes, compatibility confirmed)

### D2: cookie.util Logging Integration — Logger Callback Pattern Instead of CookieService Class
- **Context**: cookie.util.ts is a utility function without DI, making StructuredLoggerService injection impossible. Currently directly writing to process.stdout.write.
- **Choice**: Add optional logger callback parameter to setTokenCookie signature. Caller passes this.logger; when not passed, existing behavior is maintained (backward compatible).
- **Alternatives**: Convert to CookieService NestJS Injectable class — YAGNI, insufficient grounds to promote a single-function util to a service, rejected.
- **Code Paths**: `services/gateway/src/auth/cookie.util.ts`, `services/gateway/src/auth/oauth/oauth.controller.ts`, `services/gateway/src/auth/token-refresh.interceptor.ts`

### D3: ESLint Inline Style Rules — forbid-dom-props + forbid-component-props Dual Application
- **Context**: Sprint 72 G1 lesson — preventing inline style bypassing the token system (Tailwind). Violations exist in 43 existing files.
- **Choice**: Apply both rules at warn level. DOM elements use forbid-dom-props, custom components use forbid-component-props. Existing violations are removed incrementally.
- **Alternatives**: Error level — requires bulk modification of 43 existing files, exceeds this sprint's scope, rejected.
- **Code Paths**: `frontend/.eslintrc.json`

## Patterns

### P1: Optional Logger Callback Pattern (For DI-less Utils)
- **Where**: `services/gateway/src/auth/cookie.util.ts`
- **When to Reuse**: When structured logging is needed in utility functions outside NestJS DI. Add `logger?: { warn: (msg, ctx?) => void }` to signature, pass this.logger from the call site.

### P2: Use next lint (Avoiding ESLint v9 Flat Config)
- **Where**: `frontend/.eslintrc.json`
- **When to Reuse**: In Next.js projects, even with ESLint 9.x installed, running with `.eslintrc.json` + `next lint` works normally. `npx eslint` fails by requiring flat config.

## Gotchas

### G1: react/forbid-component-props Does Not Apply to DOM Elements
- **Symptom**: After adding forbid-component-props rule, `npx next lint` showed 0 warnings. Most inline styles were being used on DOM elements like `<div>`, `<span>`.
- **Root Cause**: forbid-component-props applies only to custom React components (`<Button>`, `<Card>`). DOM elements require forbid-dom-props.
- **Fix**: Added both forbid-dom-props + forbid-component-props rules to cover both sides.

### G2: ESLint v9 Flat Config Transition
- **Symptom**: Running `npx eslint src/` gives `eslint.config.(js|mjs|cjs) file not found` error.
- **Root Cause**: ESLint 9.x does not support `.eslintrc.json`, only recognizes flat config.
- **Fix**: Run with Next.js's `npx next lint` (internally handles .eslintrc.json compatibility).

## Metrics
- Commits: 4, Files changed: 10 (+353/-61)
