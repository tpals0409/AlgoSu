# Sprint 40 -- UI v3.0 Full Migration Plan

## Oracle Verdict: APPROVED
- Date: 2026-03-07
- Priority: Service Stability > Dev Speed > Feature Completeness
- Scope: Frontend Infrastructure + Component Library + Layout + Design System

---

## 1. Executive Summary

### Current State Analysis

| Category | Current | v3.0 Target | Gap |
|----------|---------|-------------|-----|
| Pages (23) | Already migrated (d417455) | src/imports/ 23 files | **None** -- pages identical |
| Tailwind | v3.4.17 | v4.1.12 | **Major version upgrade** |
| Design Tokens | globals.css (47 tokens) | theme.css (149 tokens) | **Full replacement** |
| shadcn/ui Components | 6 custom (590 lines) | 54 standard (6,512 lines) | **+44 new, 6 update** |
| Custom Components | 17 AlgoSu-specific (2,000 lines) | AlgosuUI.tsx unified (483 lines) | **Consolidation** |
| Layout | TopNav (upper fixed) | Sidebar (left 220px) | **Full restructure** |
| Font | Sora + Noto Sans KR | Pretendard | **Font swap** |
| New Features | - | AddProblemModal, MarkdownViewer, NotificationBell v2 | **New additions** |
| Tests | 105 files, 14,200 lines | - | **Adaptation required** |

### Estimated Effort: ~50-60 hours (Agent parallel execution)

---

## 2. Dependency Graph

```
W1-1 Tailwind v4 Upgrade
  |
  v
W1-2 Design Tokens (theme.css)
  |
  +---> W1-3 Font (Pretendard)
  |
  v
W1-4 shadcn/ui Components (44 new + 6 update)
  |
  v
W1-5 AlgosuUI Unified Component
  |
  +---> W1-6 Custom Components (AddProblemModal, MarkdownViewer, NotificationBell)
  |
  v
W2-1 AppLayout Sidebar
  |
  +---> W2-2~W2-7 Page Re-wiring (all 23 pages)
  |
  v
W3-1~W3-4 Test Adaptation + Build Verification + Deploy
```

---

## 3. Detailed Task Breakdown

### Wave 1 -- Foundation (Design System + Component Library)

#### W1-1: Tailwind v3 -> v4 Upgrade
- **Agent**: Architect
- **Risk**: HIGH
- **Files**:
  - `package.json` -- upgrade tailwindcss ^3.4.17 -> ^4.1.12, add @tailwindcss/postcss, replace tailwindcss-animate -> tw-animate-css ^1.3.8
  - `postcss.config.mjs` -- plugin: tailwindcss -> @tailwindcss/postcss
  - `tailwind.config.ts` -- 180 lines -> ~15 lines (most config moves to CSS)
- **Key Changes**:
  - `@tailwind base/components/utilities` -> `@import 'tailwindcss' source(none)`
  - `darkMode: ['class']` -> `@custom-variant dark (&:is(.dark *))`
  - `content: [...]` -> `@source '../**/*.{js,ts,jsx,tsx}'`
  - `plugins: [animatePlugin]` -> `@import 'tw-animate-css'`
  - theme.extend.colors/borderRadius/keyframes/animation -> `@theme inline { ... }`
- **Acceptance Criteria**:
  - `next build` succeeds
  - No TypeScript errors
  - Light/dark mode toggle works
  - All existing Tailwind classes still render correctly
- **Rollback**: git revert (single commit)

#### W1-2: Design Tokens Replacement
- **Agent**: Palette
- **Depends**: W1-1
- **Risk**: HIGH
- **Files**:
  - `src/app/globals.css` -- full restructure (~240 lines -> ~400 lines)
  - Reference: `/tmp/ui-v3/src/styles/theme.css` (390 lines)
- **Token Migration (47 -> 149)**:
  - Core Brand: --primary, --primary-light, --accent
  - Status: --success, --warning, --error, --info
  - Background layers: --bg, --bg-alt, --bg-card, --code-bg
  - Text hierarchy: --text, --text-2, --text-3
  - Border: --border (rgba-based)
  - Soft tints: --primary-soft, --success-soft, etc. (5 new)
  - Input: --input-bg
  - OAuth brand: --oauth-naver, --oauth-kakao-bg, --oauth-kakao-text
  - Difficulty tiers: 6 colors + 6 backgrounds (12 tokens)
  - Shadows: --shadow-card, --shadow-hover, --shadow-modal, --shadow-glow
  - Gradients: --gradient-brand, --hero-glow, --bar-fill
  - Radius: --radius-card (12px), --radius-btn (8px), --radius-badge (6px), --radius-full
  - Container: --max-container (1140px)
  - **NEW** shadcn/ui compat: --background, --foreground, --card, --popover, --muted, --destructive, --ring, --sidebar-* (20+ tokens)
  - **NEW** Dark mode overrides for ALL tokens
- **Utility Classes** (@layer utilities):
  - .rounded-card, .rounded-btn, .rounded-badge
  - .shadow-card, .shadow-hover, .shadow-modal, .shadow-glow
  - .max-w-container
  - .glass-nav (light + dark)
  - .gradient-brand, .gradient-brand-text
  - .animate-fade-in, .ease-bounce
- **@theme inline Block** (~70 mappings):
  - --color-* namespace for all CSS variables
  - --radius-sm/md/lg/xl
  - --color-sidebar-* (new)
  - --color-chart-1~5 (new)
- **Acceptance Criteria**:
  - Visual comparison: all pages render with correct colors in both themes
  - No hardcoded color values in components (all via tokens)

#### W1-3: Font Transition
- **Agent**: Palette
- **Depends**: W1-2
- **Risk**: LOW
- **Files**:
  - `src/app/layout.tsx` -- replace Sora/NotoSansKR local fonts with Pretendard
  - `src/app/globals.css` -- add font variables: --font-sans (Pretendard), --font-mono (JetBrains Mono)
  - Reference: `/tmp/ui-v3/src/styles/fonts.css`
- **Strategy**:
  - Option A: Google Fonts CDN (`@import url(...)`) -- simpler
  - Option B: next/font/local with self-hosted -- better performance
  - **Decision**: next/font/google (Pretendard available via Google Fonts) with JetBrains Mono local (already exists)
- **Acceptance Criteria**:
  - All text renders in Pretendard
  - Code blocks render in JetBrains Mono
  - No FOUT (Flash of Unstyled Text)

#### W1-4: shadcn/ui Component Library
- **Agent**: Architect
- **Depends**: W1-2
- **Risk**: MEDIUM
- **Source**: `/tmp/ui-v3/src/app/components/ui/` (54 files)
- **Target**: `/root/AlgoSu/frontend/src/components/ui/`
- **Actions**:

  **A) Update existing (6 files)**:
  | File | Current Lines | v3.0 Lines | Action |
  |------|-------------|-----------|--------|
  | alert.tsx | 65 | 66 | Replace (minimal diff) |
  | badge.tsx | 65 | 46 | Replace (v3.0 simpler, AlgoSu-specific variants move to AlgosuUI) |
  | button.tsx | 101 | 58 | Replace (AlgoSu variants move to AlgosuUI Btn) |
  | card.tsx | 93 | 92 | Replace (minimal diff) |
  | input.tsx | 80 | 21 | Replace (AlgoSu-specific moves to AlgosuUI AlgoInput) |
  | skeleton.tsx | 218 | 13 | Replace (AlgoSu skeleton variants kept separately) |

  **B) Add new (44 files)**:
  accordion, alert-dialog, aspect-ratio, avatar, breadcrumb, calendar, carousel,
  chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu,
  form, hover-card, input-otp, label, menubar, navigation-menu, pagination, popover,
  progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar,
  slider, sonner, switch, table, tabs, textarea, toggle-group, toggle, tooltip,
  use-mobile.ts, utils.ts

  **C) Copy utility**:
  - `use-mobile.ts` -- mobile detection hook
  - `utils.ts` -- cn() function (verify compatibility with existing lib/utils.ts)

- **New Dependencies** (package.json):
  - `sonner` ^2.0.3 (toast replacement)
  - `react-markdown` ^10.1.0 (for MarkdownViewer)
  - `@radix-ui/*` additional packages as needed by new components
  - `recharts` ^2.15.2 (for chart component)
  - Verify existing @radix-ui versions compatibility

- **Acceptance Criteria**:
  - All 54 components importable without errors
  - TypeScript strict mode passes
  - No circular dependencies

#### W1-5: AlgosuUI Unified Component
- **Agent**: Palette
- **Depends**: W1-4
- **Risk**: MEDIUM
- **Source**: `/tmp/ui-v3/src/app/components/ui/AlgosuUI.tsx` (484 lines)
- **Target**: `/root/AlgoSu/frontend/src/components/ui/AlgosuUI.tsx` (new file)
- **Components to Port**:
  | Component | Description | Replaces Current |
  |-----------|-------------|-----------------|
  | Btn | 4 variants (primary/ghost/danger/outline) x 3 sizes | Button.tsx (partial) |
  | AlgoBadge | 7 variants + dot option | Badge.tsx (partial) |
  | DiffBadge | Difficulty tier badge (DIFFICULTY_CONFIG) | DiffBadge.tsx |
  | SagaBadge | Saga status (DONE/AI_QUEUED/GITHUB_QUEUED/FAILED/PENDING) | StatusBadge.tsx |
  | ScoreGauge | Circular SVG progress (120px) | ScoreGauge.tsx |
  | PageHeader | Title + subtitle + action layout | (inline in pages) |
  | StatCard | 2 styles (primary gradient, default card) | (inline in dashboard) |
  | AlgoInput | Error/hint support input | Input.tsx (partial) |
  | AlgoTextarea | Error/hint support textarea | (none) |
  | AlgoAlert | 4 variants (error/warning/success/info) | Alert.tsx |
  | LangBadge | Language color map | LangBadge.tsx |
  | TabBar | Tab selection UI | (inline in pages) |
- **Config Dependencies** (from mock.ts):
  - `DIFFICULTY_CONFIG`: Record<Difficulty, { label, color, bg }>
  - `SAGA_CONFIG`: Record<SagaStep, { label, color, bg }>
  - These should be extracted to `lib/constants.ts` (existing file, merge)
- **Acceptance Criteria**:
  - All 12 sub-components render correctly
  - Existing DiffBadge/ScoreGauge/LangBadge usage sites updated

#### W1-6: Custom Components (New Features)
- **Agent**: Palette
- **Depends**: W1-5
- **Risk**: MEDIUM
- **Components**:

  **A) AddProblemModal.tsx** (573 lines) -- NEW
  - Source: `/tmp/ui-v3/src/app/components/ui/AddProblemModal.tsx`
  - Target: `/root/AlgoSu/frontend/src/components/ui/AddProblemModal.tsx`
  - Features: 2-step flow (solved.ac search -> week/deadline confirm)
  - External API: `https://solved.ac/api/v3/search/problem`
  - Adaptation: @radix-ui/react-dialog -> v3.0 dialog component
  - API Integration: connect to `problemApi.create()` on confirm

  **B) MarkdownViewer.tsx** (142 lines) -- NEW
  - Source: `/tmp/ui-v3/src/app/components/ui/MarkdownViewer.tsx`
  - Target: `/root/AlgoSu/frontend/src/components/ui/MarkdownViewer.tsx`
  - Dependency: react-markdown ^10.1.0 (add to package.json)
  - 13 custom component overrides (h1-h3, p, ul, ol, li, code, pre, blockquote, a)

  **C) NotificationBell.tsx** v2 (234 lines) -- REPLACE
  - Source: `/tmp/ui-v3/src/app/components/ui/NotificationBell.tsx`
  - Current: `/root/AlgoSu/frontend/src/components/layout/NotificationBell.tsx` (371 lines)
  - Changes: sidebar/header dual placement, simplified notification types
  - Integration: connect to existing `useNotificationSSE` hook

  **D) ImageWithFallback.tsx** (28 lines) -- NEW
  - Source: `/tmp/ui-v3/src/app/components/figma/ImageWithFallback.tsx`
  - Target: `/root/AlgoSu/frontend/src/components/ui/ImageWithFallback.tsx`
  - Simple: onError fallback to base64 SVG placeholder

- **Acceptance Criteria**:
  - AddProblemModal: solved.ac search returns results, problem creation works
  - MarkdownViewer: renders study ground rules correctly
  - NotificationBell: SSE connection + notification display
  - ImageWithFallback: broken image shows fallback

---

### Wave 2 -- Layout + Page Re-wiring

#### W2-1: AppLayout Sidebar Transformation
- **Agent**: Architect
- **Depends**: W1-5, W1-6
- **Risk**: HIGH (affects all authenticated pages)
- **Source**: `/tmp/ui-v3/src/app/components/layout/AppLayout.tsx` (344 lines)
- **Current**: `/root/AlgoSu/frontend/src/components/layout/AppLayout.tsx` (75 lines) + TopNav.tsx (361 lines) + StudySidebar.tsx (193 lines)
- **Transformation**:

  | Aspect | Current (TopNav) | v3.0 (Sidebar) |
  |--------|-----------------|----------------|
  | Position | Fixed top | Fixed left 220px (desktop), right overlay (mobile) |
  | Navigation | Horizontal menu in header | Vertical nav items in sidebar |
  | Study Selector | StudySidebar dropdown | Sidebar dropdown (integrated) |
  | Theme Toggle | TopNav button | Sidebar bottom |
  | Notifications | TopNav NotificationBell | Sidebar item (dual placement) |
  | User Menu | TopNav avatar dropdown | Sidebar bottom section |
  | Mobile | Hamburger -> dropdown | Hamburger -> right slide overlay |
  | Content Area | Below TopNav (mt-16) | Right of sidebar (ml-[220px]) |

- **NAV_ITEMS** (v3.0):
  ```
  Dashboard   -> /dashboard    (LayoutDashboard icon)
  My Studies  -> /studies       (Users icon)
  Problems    -> /problems      (BookOpen icon)
  Submissions -> /submissions   (FileText icon)
  Study Room  -> /room          (MessagesSquare icon)
  Analytics   -> /analytics     (BarChart3 icon)
  ```

- **Context Integration**:
  - ThemeCtx: keep using next-themes (NOT v3.0's custom ThemeCtx)
  - StudyCtx: connect existing StudyContext (active study dropdown)
  - Auth: connect existing AuthContext (user info, logout)

- **Router Adaptation**:
  - `Link` (react-router) -> `Link` (next/link)
  - `useLocation()` -> `usePathname()`
  - `useNavigate()` -> `useRouter().push()`
  - `<Outlet />` -> `{children}` prop

- **Files to Modify/Create**:
  - REPLACE: `components/layout/AppLayout.tsx` (75 -> ~300 lines)
  - DELETE: `components/layout/TopNav.tsx` (361 lines) -- merged into AppLayout
  - DELETE: `components/layout/StudySidebar.tsx` (193 lines) -- merged into AppLayout
  - UPDATE: `src/app/layout.tsx` -- adjust provider/layout structure
  - UPDATE: All page layouts referencing AppLayout

- **Acceptance Criteria**:
  - Sidebar visible on desktop (>= 1024px)
  - Sidebar hidden on mobile, accessible via hamburger
  - Active nav item highlighted based on current route
  - Study selector works (switch active study)
  - Theme toggle works (light/dark)
  - Session expiry overlay preserved
  - Sonner toast provider active (replacing current Toast)

#### W2-2: Public Pages Re-wiring (Landing, Login, Auth)
- **Agent**: Palette
- **Depends**: W2-1
- **Risk**: LOW (pages already migrated, just component swaps)
- **Pages**: 01-landing, 02-login, 03-callback, 04-github-link, 05-github-link-complete
- **Actions per page**:
  - Replace `Button` imports -> `Btn` from AlgosuUI (where applicable)
  - Replace `Badge` imports -> `AlgoBadge` from AlgosuUI
  - Replace `Alert` imports -> `AlgoAlert` from AlgosuUI
  - Update class names for new token system (if any hardcoded values)
  - Verify OAuth flow still works end-to-end
- **Specific Changes**:
  - Landing: DiffBadge -> AlgosuUI.DiffBadge, Logo stays
  - Login: OAuth buttons use new token colors (--oauth-naver, etc.)
  - Callback/GitHub: minimal changes (redirect logic only)
- **Acceptance Criteria**:
  - All 5 pages render correctly in both themes
  - OAuth login flow works (Google/Naver/Kakao)
  - GitHub linking flow works

#### W2-3: Dashboard Re-wiring
- **Agent**: Palette
- **Depends**: W2-1
- **Risk**: MEDIUM (complex page with dynamic imports)
- **Page**: 06-dashboard
- **Actions**:
  - StatCard -> AlgosuUI.StatCard
  - Button -> Btn
  - Alert -> AlgoAlert
  - Update DashboardWeeklyChart/ThisWeek/TwoColumn for new tokens
  - Verify useAnimVal counter animations with new styles
  - Verify API connections: studyApi.getStats, submissionApi.list, problemApi.findAll
- **Acceptance Criteria**:
  - Dashboard loads with real data
  - Weekly chart renders
  - StatCard animations work
  - Week view cycling works

#### W2-4: Study Pages Re-wiring
- **Agent**: Palette
- **Depends**: W2-1
- **Risk**: HIGH (StudyDetail 1289 lines, most complex page)
- **Pages**: 08-studies, 09-study-create, 10-study-detail, 11-study-room
- **Specific Concerns**:
  - StudyDetail (3-tab): Overview/Members/Settings tabs -> TabBar from AlgosuUI
  - StudyDetail: invite code, member kick, ground rules (MarkdownViewer integration)
  - StudyRoom: problemId query param restoration must be preserved
  - StudyRoom: userId dedup filter must be preserved
  - StudyCreate: react-hook-form + zod validation unchanged
- **Acceptance Criteria**:
  - Study CRUD works
  - Invite code copy works
  - Member management (kick, role change) works
  - Study room problem selection + submission list works
  - Back navigation restores selected problem

#### W2-5: Problem Pages Re-wiring
- **Agent**: Scribe
- **Depends**: W2-1
- **Risk**: MEDIUM
- **Pages**: 12-problems, 13-problem-create, 14-problem-detail, 15-problem-edit, 16-redirect
- **Actions**:
  - Integrate AddProblemModal into problem-create flow (if applicable)
  - DiffBadge/LangBadge -> AlgosuUI versions
  - Problem form utils unchanged
  - BOJ search hook (useBojSearch) unchanged
- **Acceptance Criteria**:
  - Problem CRUD works
  - BOJ search works
  - Difficulty badge colors match v3.0 design

#### W2-6: Submission + Analysis Pages Re-wiring
- **Agent**: Scribe
- **Depends**: W2-1
- **Risk**: MEDIUM
- **Pages**: 17-submit-redirect, 18-submissions, 19-submission-status, 20-analysis
- **Actions**:
  - SagaBadge -> AlgosuUI.SagaBadge
  - SSE status display: useSubmissionSSE hook unchanged
  - Analysis: ScoreGauge -> AlgosuUI.ScoreGauge, CategoryBar stays
  - CodeEditor (Monaco): unchanged (810 lines, complex)
- **Acceptance Criteria**:
  - Code submission works
  - SSE real-time status updates display
  - AI analysis results render (categories, scores, highlights)

#### W2-7: Review + Profile Pages Re-wiring
- **Agent**: Palette
- **Depends**: W2-1
- **Risk**: MEDIUM
- **Pages**: 21-review, 22-profile, 23-study-room-redirect
- **Actions**:
  - Review: parseFeedback() logic MUST be preserved (critical hotfix from 2026-03-07)
  - Review: CodePanel, CommentThread, CommentForm dynamic imports preserved
  - Review: Focus Mode toggle preserved
  - Profile: avatar preset system preserved (getAvatarPresetKey + getAvatarSrc)
- **Acceptance Criteria**:
  - Review 2-panel layout works
  - AI feedback categories display correctly
  - Line comments work
  - Focus mode toggle works
  - Profile avatar display + edit works

---

### Wave 3 -- Quality Assurance + Deployment

#### W3-1: Test Adaptation
- **Agent**: Gatekeeper
- **Depends**: W2-1~W2-7
- **Risk**: HIGH (105 test files, 14,200 lines)
- **Strategy**:
  - **Phase A**: Fix import paths (Button -> Btn, etc.)
  - **Phase B**: Fix component selectors (role, testid, text)
  - **Phase C**: Fix snapshot tests (if any)
  - **Phase D**: Fix layout tests (TopNav -> Sidebar)
- **Key Test Files to Update**:
  | Test File | Lines | Concern |
  |-----------|-------|---------|
  | UIComponents.test.tsx | 729 | All UI component renders |
  | Badges.test.tsx | 400 | Badge variants |
  | TopNav.test.tsx | 553 | **DELETE** (TopNav removed) |
  | NotificationBell.test.tsx | 627 | Update for v2 NotificationBell |
  | CodeEditor.test.tsx | 615 | Unchanged (Monaco) |
  | CommentThread.test.tsx | 375 | Selector updates |
  | Page tests (~60 files) | ~4,200 | Import + render updates |
- **Acceptance Criteria**:
  - All 1,165+ tests pass (or justified skips documented)
  - No decrease in coverage percentage
  - New components have basic render tests

#### W3-2: Build Verification
- **Agent**: Architect
- **Depends**: W3-1
- **Risk**: MEDIUM
- **Checks**:
  - `next build` succeeds (standalone output)
  - TypeScript strict mode: zero errors
  - ESLint: zero errors
  - Bundle size comparison (before/after)
  - CSP headers still valid (Monaco worker, CDN fonts)
  - API rewrites still functional
- **Acceptance Criteria**:
  - Clean build with zero warnings
  - Bundle size delta < 15% increase (new components)

#### W3-3: Cleanup + Dead Code Removal
- **Agent**: Scribe
- **Depends**: W3-2
- **Risk**: LOW
- **Actions**:
  - Remove old TopNav.tsx, StudySidebar.tsx (merged into AppLayout)
  - Remove redundant component files replaced by AlgosuUI
  - Remove old tailwind.config.ts content (if fully migrated)
  - Remove unused CSS classes from globals.css
  - Update import aliases if changed
  - Verify no orphaned files
- **Files to potentially remove**:
  | File | Reason |
  |------|--------|
  | components/layout/TopNav.tsx | Merged into AppLayout sidebar |
  | components/layout/StudySidebar.tsx | Merged into AppLayout sidebar |
  | components/ui/DiffBadge.tsx | Replaced by AlgosuUI.DiffBadge |
  | components/ui/StatusBadge.tsx | Replaced by AlgosuUI.SagaBadge |
  | components/ui/ScoreGauge.tsx | Replaced by AlgosuUI.ScoreGauge |
  | components/ui/LangBadge.tsx | Replaced by AlgosuUI.LangBadge |
  | components/ui/Toast.tsx | Replaced by sonner |
  | components/ui/NotificationToast.tsx | Replaced by sonner |
  | UI/ directory | Old mockups (no longer needed) |

#### W3-4: Local Deploy + PM Review
- **Agent**: Conductor
- **Depends**: W3-3
- **Risk**: LOW
- **Process**:
  1. ArgoCD auto-sync pause
  2. Docker build frontend:local
  3. k3s image import + deployment
  4. PM full page walkthrough (23 pages)
  5. PM sign-off -> git push -> CI/CD
  6. ArgoCD auto-sync resume
- **Checklist**:
  - [ ] Landing page (light + dark)
  - [ ] OAuth login (Google/Naver/Kakao)
  - [ ] Dashboard (stats, charts, week cycling)
  - [ ] Study list + create + detail (3 tabs)
  - [ ] Study room (problem select, submission list, review link)
  - [ ] Problem list + create + edit + delete
  - [ ] Code submission + SSE status
  - [ ] AI analysis (score gauge, categories, highlights)
  - [ ] Code review (2-panel, comments, focus mode)
  - [ ] Profile (avatar, settings)
  - [ ] Analytics (charts)
  - [ ] Sidebar navigation (all links)
  - [ ] Mobile responsive (sidebar overlay)
  - [ ] Theme toggle (light/dark persistence)
  - [ ] Notification bell (SSE)

---

## 4. Agent Assignment Matrix

| Agent | Tasks | Total Files | Estimated Hours |
|-------|-------|-------------|-----------------|
| **Architect** | W1-1, W1-4, W2-1, W3-2 | ~60 files | 14-18h |
| **Palette** | W1-2, W1-3, W1-5, W1-6, W2-2, W2-3, W2-4, W2-7 | ~50 files | 18-22h |
| **Scribe** | W2-5, W2-6, W3-3 | ~25 files | 8-10h |
| **Gatekeeper** | W3-1 | ~105 test files | 10-12h |
| **Conductor** | W3-4 | deploy | 2-3h |

---

## 5. Execution Schedule

### Week 1: Foundation
| Day | Tasks | Parallel | Agent |
|-----|-------|----------|-------|
| D1 | W1-1 Tailwind v4 Upgrade | - | Architect |
| D1 | W1-2 Design Tokens (after W1-1) | Sequential | Palette |
| D2 | W1-3 Font Transition | Parallel | Palette |
| D2 | W1-4 shadcn/ui Components | Parallel | Architect |
| D3 | W1-5 AlgosuUI Unified | After W1-4 | Palette |
| D3 | W1-6 Custom Components | After W1-5 | Palette |
| **Milestone**: All components importable, `next build` passes |

### Week 2: Layout + Pages
| Day | Tasks | Parallel | Agent |
|-----|-------|----------|-------|
| D4 | W2-1 AppLayout Sidebar | - | Architect |
| D5 | W2-2 Public Pages | Parallel | Palette |
| D5 | W2-5 Problem Pages | Parallel | Scribe |
| D6 | W2-3 Dashboard | Parallel | Palette |
| D6 | W2-6 Submission Pages | Parallel | Scribe |
| D7 | W2-4 Study Pages | - | Palette |
| D7 | W2-7 Review + Profile | After W2-4 | Palette |
| **Milestone**: All 23 pages render correctly with new UI |

### Week 3: QA + Deploy
| Day | Tasks | Parallel | Agent |
|-----|-------|----------|-------|
| D8 | W3-1 Test Adaptation | - | Gatekeeper |
| D9 | W3-2 Build Verification | After W3-1 | Architect |
| D9 | W3-3 Cleanup | After W3-2 | Scribe |
| D10 | W3-4 Local Deploy + PM Review | After W3-3 | Conductor |
| **Milestone**: PM sign-off, CI/CD deploy |

---

## 6. Risk Mitigation

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Tailwind v4 breaks existing styles | HIGH | Commit W1-1 separately, visual diff before proceeding |
| R2 | shadcn/ui version conflicts | MEDIUM | Copy v3.0 components as-is, no version mixing |
| R3 | Sidebar layout breaks mobile | MEDIUM | Test responsive at 375px/768px/1024px breakpoints |
| R4 | API connections break after re-wiring | HIGH | No API code changes -- only import paths and component names |
| R5 | Test mass failure | HIGH | Batch fix by category (imports, selectors, snapshots) |
| R6 | Bundle size explosion (+44 components) | MEDIUM | Tree-shaking verification, bundle analyzer check |
| R7 | Dark mode token mismatch | MEDIUM | Side-by-side comparison of all 149 tokens |

---

## 7. Go/No-Go Criteria

### Go (proceed to next wave):
- `next build` succeeds
- TypeScript strict: 0 errors
- Tests: >= 95% pass rate
- Visual: no broken layouts in light AND dark mode

### No-Go (rollback):
- Build failure that can't be resolved in 2 hours
- > 20% test failure rate after adaptation
- Critical API integration break
- PM rejects visual outcome

---

## 8. Files Inventory (Impact Summary)

### New Files (~50)
- 44 shadcn/ui components
- AlgosuUI.tsx
- AddProblemModal.tsx
- MarkdownViewer.tsx
- ImageWithFallback.tsx
- fonts.css (if separated)

### Modified Files (~30)
- globals.css (full rewrite)
- tailwind.config.ts (simplify)
- postcss.config.mjs (plugin change)
- package.json (dependencies)
- layout.tsx (font + provider)
- AppLayout.tsx (sidebar rewrite)
- 23 page.tsx files (component imports)
- constants.ts (add DIFFICULTY_CONFIG, SAGA_CONFIG)

### Deleted Files (~10)
- TopNav.tsx
- StudySidebar.tsx
- DiffBadge.tsx, StatusBadge.tsx, ScoreGauge.tsx, LangBadge.tsx (replaced by AlgosuUI)
- Toast.tsx, NotificationToast.tsx (replaced by sonner)
- UI/ directory (old mockups)

### Test Files Updated (~105)
- Import path fixes
- Component selector updates
- Layout test rewrites

### Total Impact: ~195 files
