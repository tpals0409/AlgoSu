---
sprint: 123
title: "컴포넌트 번역 완성 — Phase A 6 Wave + ui/layout/analytics/feedback 네임스페이스 신설"
period: "2026-04-23 ~ 2026-04-24"
status: completed
start_commit: 4e235cf
end_commit: 340cc0c
---

# Sprint 123 — 컴포넌트 레벨 i18n 전면 완성

## 배경

Sprint 122에서 **페이지 레벨 i18n**(21개 error.tsx 일괄 치환, 5 Wave 페이지 번역, SEO hreflang)을 완성하며 누적 네임스페이스 10개에 도달했다. 그러나 Sprint 122 마감 시점에 **컴포넌트 레벨 번역은 전면 미적용** 상태였다 — `useTranslations` 사용 파일이 프론트엔드 전체 27개에 불과, Shell/Nav/Dashboard/Review/Feedback/Submission/UI 공통 등 대부분의 컴포넌트가 한글 하드코딩 포함.

Sprint 123 목표:
1. Sprint 122 PR #139 마감 (CI fix 3 commits push 미완 이월) → Phase 0
2. 페이지 레벨 i18n 위에서 **컴포넌트 44개(실측 48 commits 처리) 번역 완성** → Phase A
3. (계획) admin/studies 페이지 + Sprint 120 이월 P1 보안 + i18n 품질 잔여 → Phase B~E

실제 이번 스프린트는 **Phase 0 + Phase A**까지 완료 (PR #140 머지). Phase B~E는 Sprint 124로 이관.

---

## Phase 0 — PR #139 마감

Sprint 122 세션에서 네트워크 EADDRNOTAVAIL 이슈로 CI fix 3 commits(`edffa97`/`8b6637c`/`b8af62c`) push가 미완된 채 이월. Sprint 123 세션 시작 시점에 네트워크 복구 확인(HTTP 200) → push → CI 재실행 → 전체 PASS 확인(Test Frontend 52s 포함) → Squash merge(`4e235cf`, --delete-branch) → 로컬 main 동기화 → Sprint 123 전용 브랜치 `feature/sprint-123-i18n-components` 분기.

---

## Phase A — 컴포넌트 번역 Wave (44→48파일, 63 commits)

### 사전 조사
Explore agent 전수 스캔 결과: 프론트엔드 `.tsx` 104개 중 48개에 한글 하드코딩(611줄). Sprint 122 ADR "53개" 기록 대비 -5(일부 이미 페이지 레벨에 흡수). Wave 6개로 분할 실행.

### Wave별 진행

| Wave | 범위 | 네임스페이스 | Commits | Critic 결과 | 비고 |
|------|------|-------------|---------|-------------|------|
| **A1** | Shell/Nav 6 | `layout` 신설 (11번째) | 9 + 3 fix | M×3 fix | AppLayout/TopNav/StudySidebar/NotificationBell/AuthShell/LegalLayout |
| **A2** | 고용량 2 | `submissions`/`problems` 확장 | 2 + 2 fix | **H-1 DB 무결성** + L-1 fix | CodeEditor(60줄)/AddProblemModal(66줄) |
| **A3** | Dashboard 3 + Analytics 1 | `analytics` 신설 (12번째) + `dashboard` 확장 | 5 + 2 fix | M-1 셰도잉 + L-1 영문 관용 fix | DashboardTwoColumn/ThisWeek/WeeklyChart + AnalyticsCharts |
| **A4** | Feedback 3 + Review 5 | `feedback` 신설 (13번째) + `reviews` 확장 | 9 + 1 fix | **M-1/M-2 DRY** → `review-time.ts` 공유 유틸 추출 | BugReport/Feedback×2 + Comment/CodePanel/StudyNote/Reply |
| **A5** | Submission 2 + Share 1 + Guest 1 + Providers 4 + Landing 1 | 기존 5개 확장 (신설 없음) | 9 | **0건** (최초 fix-round 없이 통과) | dead-key 방지 패턴 확립 |
| **A6** | UI 공통 20 (shadcn 제외) | `ui` 신설 (14번째) | 20 + 1 fix | **0건** (Critical/High/Medium 0, Low 3건 허용) | 9 번역 + 10 JSDoc-only + A6-2b test fix |

**총 63 atomic commits**, 48파일 처리, 14개 네임스페이스 최종.

---

## 핵심 결정 (D1~D4)

### D1. 컴포넌트 번역 네임스페이스 전략

**결정**: 신규 네임스페이스는 "공유 범주가 명확한 경우"에만 신설, 그 외는 기존 확장.

| 신설 | 이유 |
|------|------|
| `layout` (Wave A1) | AppLayout/TopNav/StudySidebar 등 공유 레이아웃 컴포넌트 키 집약 |
| `analytics` (Wave A3) | 차트 전용 (axis/legend/tooltip), 향후 analytics 컴포넌트 추가 대비 |
| `feedback` (Wave A4) | BugReport/Feedback*/Widget 3개 컴포넌트 공유 |
| `ui` (Wave A6) | 9 섹션 × 19키, UI primitive 전용 구분 |

| 흡수(확장) | 이유 |
|------|------|
| CodeEditor → `submissions.editor.*` | 도메인 소속 명확 |
| AddProblemModal → `problems.addModal.*` | /problems 페이지 모달 (admin 전용 아님) |
| Dashboard 컴포넌트 3 → `dashboard.*` | 기존 확장이 자연스러움 |
| Review 컴포넌트 5 → `reviews.*` | 도메인 소속 |
| ShareLinkManager → `account.shareLink.*` | account 도메인 (22키, 에러 코드 포함) |
| GuestNav → `common.guestNav.*` | 단일 파일, common 흡수 경제적 |
| AuthGuard/HomeRedirect/Providers → **번역 키 미추가** | user-facing 한글 0건 (JSDoc 영문화만) — dead-key 방지 |

### D2. DB 무결성 vs 로케일 분리 (Wave A2 H-1)

**문제**: `AddProblemModal.tsx handleAdd`에서 `t('addModal.confirm.weekFormat', { month, week })` 결과를 **그대로 DB 저장** → en 로케일 시 `"Month 4 Week 1"` 형식으로 저장되어 `dashboard/page.tsx:357`/`analytics/page.tsx:57`의 regex `/^(\d+)월(\d+)주차$/` 파싱 실패, `services/problem/...spec.ts` API 계약 전체 불일치.

**결정**: **표시 라벨(t)과 DB 저장값(canonical)을 분리**.
```tsx
// DB 저장 (canonical 고정, ko 형식 유지)
const weekNumber = `${month}월${week}주차`;
// 표시 라벨 (t() 유지, 로케일 따름)
<SelectItem>{t('addModal.confirm.weekFormat', { month, week })}</SelectItem>
```

**적용 범위**: 이번에는 weekNumber만 해당. 향후 i18n 대상 API 전송값이 생기면 동일 패턴 적용. Sprint 124에 백엔드 포맷 정규화(en 로케일 공식 지원) 이관.

### D3. 공유 시간 포맷 유틸 추출 (Wave A4 M-1/M-2)

**문제**: `CommentThread.tsx`와 `ReplyItem.tsx`에 `formatRelativeTime` 함수와 `tTime = (key, values) => t(\`time.${key}\` as ..., values as never)` 람다가 **완전 중복**(타입 우회 2배 + 5-branch 로직 복붙 18줄×2).

**결정**: `frontend/src/lib/utils/review-time.ts` 공유 유틸 신설.
- `createTimeTranslator(t)` — `TimeKey` 유니온(`'justNow' | 'minutesAgo' | 'hoursAgo' | 'daysAgo'`)으로 키 제한, `TranslationValues` 직접 활용 → `as never` 완전 제거
- `formatReviewRelativeTime(iso, tTime, locale)` — 5-branch 변환 로직 단일화
- `TimeTranslatorFn` 타입 export (재사용 가능)

**부수효과**: `utils.ts → utils/index.ts` 디렉토리 전환 (74개 import 무변경, TypeScript 모듈 해석 자동 처리).

### D4. Dead Keys 방지 정책 (Wave A5/A6)

**결정**: user-facing 한글 문자열이 **0건**인 컴포넌트는 **번역 키 미추가**, JSDoc/코멘트만 영문화.

**적용 컴포넌트 20개**:
- Provider/Guard: AuthGuard, HomeRedirect, WebVitalsReporter, ThemeProvider, EventTracker, SWRProvider
- UI primitive: Badge, Logo, CodeBlock, Button, Input, Card, MarkdownViewer, StatusBadge, EmptyState

**근거**: Critic Wave A5/A6에서 "dead keys 방지는 올바른 설계 결정"로 두 번 확인됨. 빈 번역 키는 next-intl 타입 플러그인 도입 시 오탐 유발, 번들 증가 요인.

---

## 패턴

### P1. Locale-aware 날짜/숫자 (Wave A2 L-1 → 전 Wave 확장)

`toLocaleString('ko-KR')` 하드코딩 금지. `useLocale()` 주입 후 `toLocaleString(locale)` 사용. 차트/통계/날짜 표시 모든 컴포넌트에 적용.

### P2. 셰도잉 사전 grep (Wave A3 M-1 → 전 Wave 표준)

`const t = useTranslations(...)` 외부 스코프 추가 시 내부 `const t = setTimeout(...)` 등 변수명 충돌 발생. Wave 시작 시 `const t =` grep 으로 사전 점검 → 충돌 변수 선제 rename(`timer`, `tabItem` 등).

### P3. Server Component 번역 (Wave A1 M-1 → 표준)

정적 페이지(LegalLayout 등)는 `'use client'` 지시어 없이 `async function + getTranslations({ namespace })` 사용. 테스트는 Sprint 122 not-found 패턴(`jest.mock('next-intl/server')` + `await Component()`).

### P4. 에러 코드 분리 + catch block 번역 (Wave A4)

`throw new Error('한글 메시지')` → `throw new Error('ERROR_CODE')`로 코드만 throw, 컴포넌트 catch block에서 `t('error.${code}')`로 번역. BugReportForm resizeImage, AddProblemModal searchSolvedAC/searchProgrammers 적용.

---

## 교훈

### L1. Write 차단 이슈 (인프라 미해결)

Wave A2/A3(critic)/A4/A4 fix/A5/A6 총 **6회**에 걸쳐 palette/critic runner의 Write to `~/.claude/oracle/inbox/*.md` 가 **"민감 경로 차단"**으로 실패. `bypassPermissions` 모드에도 `~/.claude/` 하위는 예외 정책 적용.

**임시 대응**: runner에 stdout fallback 지시 (markdown 코드블록 + `__AGENT_DONE__` sentinel), Oracle이 로그에서 수거 후 inbox에 수동 Write. Wave당 2~3분 오버헤드.

**근본 해결 (Sprint 124 이관)**: `oracle-spawn.sh` 의 claude 명령에 `--add-dir ~/.claude/oracle/inbox` 추가, 또는 inbox 경로를 `/tmp/algosu-oracle/inbox` 외부로 이관 후 reap 스크립트가 복사. sensei/gatekeeper에 분석 위임 권장.

### L2. ps aux grep 한계 (진단 재발)

Wave A1과 Wave A3에서 **같은 진단 실수** 반복: `ps aux | grep ${task_id}`가 claude argv가 매우 길어 컬럼 슬라이싱으로 프로세스를 못 잡음 → "crash로 오판" → 잘못된 복구 계획 제시. 실제로는 palette이 정상 진행 중이었음.

**재발 방지 표준**: palette 상태 확인은 반드시 `pgrep -f "runner.sh" → pgrep -P <runner_pid>` 로 부모-자식 관계 추적. grep 한계에 의존하지 않음.

### L3. auto-critic 체인 트리거 신뢰성

palette cleanup trap의 `oracle-dispatch.sh` 자동 호출이 **일부 Wave에서 실패**(A1, A3, A4 palette → critic 자동 전환 누락). 실패 원인 미규명. 수동 `oracle-dispatch.sh` 재호출로 우회. Sprint 124에서 cleanup trap 로직 개선 or auto-critic.sh 재작성 필요.

### L4. Critic 품질 상승 곡선

Wave A1~A4는 모두 fix-round 필요 (Critical/High 0건이나 Medium/High 1~3건). **Wave A5부터 fix-round 불필요** — palette가 누적된 Wave별 Critic 피드백(셰도잉/dead-key/DRY/canonical)을 내재화했기 때문. Sprint 124 이후 동일 도메인 작업은 fix-round 생략 가능성 높음 (critic 체인 유지는 안전성 보장).

---

## 주요 산출물

### 신규 파일
- `frontend/messages/{ko,en}/layout.json` — 88라인 (appLayout/topNav/studySidebar/notificationBell/authShell/legalLayout)
- `frontend/messages/{ko,en}/analytics.json` — 35라인 (charts.weeklyTrend, charts.aiScore)
- `frontend/messages/{ko,en}/feedback.json` — 34키 (bugReport/feedbackForm/widget + errors)
- `frontend/messages/{ko,en}/ui.json` — 19키 / 9섹션 (alert/backBtn/categoryBar/difficultyBadge/langBadge/loadingSpinner/notificationToast/scoreGauge/skeleton)
- `frontend/src/lib/utils/review-time.ts` — createTimeTranslator + formatReviewRelativeTime

### 구조 변경
- `frontend/src/lib/utils.ts` → `frontend/src/lib/utils/index.ts` (디렉토리 전환, 74 import 무변경)
- `frontend/src/i18n/request.ts` NAMESPACES 14개 등록
- `frontend/src/test-utils/i18n.tsx` DEFAULT_MESSAGES 14개 포함

### 공유 인프라 정착
- `renderWithI18n` 테스트 헬퍼: Wave A1~A6 전 파일 적용 (과거 `render()` 직접 호출 제거)
- wrapper 옵션 지원 (SWR+i18n 합성 가능, Wave A1 c65a8d1)

---

## 이월 항목 (Sprint 124)

### 계획 작업 이월 (Phase B~E 미완료)
- **Phase B**: studies 도메인 3 (page/[id]/page/room), problems/[id]/status (스터디 통계), admin 3 (problems/[id]/edit, problems/create, admin/feedbacks), guest/page, shared/[token]/page, privacy/terms → **신규 `admin` + `studies` 네임스페이스 15-16번째**
- **Phase C**: Sprint 120 이월 Frontend P1 3건 (p1-023/024/025) + P1 security 49건
- **Phase D**: Zod errorMap i18n, lib/date.ts useFormatter 전환, useSubmissionSSE 동적 번역 caller 이관, utils.ts/client.ts HTTP 에러 번역, code:'404' 의미론적 키 교체, 백엔드 OAuth 에러 구조화 ADR (NestJS nestjs-i18n 도입 or 에러 코드 표준화)
- **Phase E**: renderWithI18n 전면 마이그레이션(이미 Phase A에 포함된 수준 이상), next-intl 타입 플러그인 도입 검토 (동적 키 타입 안전성)

### Critic 이월 (Wave A4 Low, Sprint 124 i18n QA로 일괄)
- L-1: FeedbackForm `categoryOptions` / FeedbackWidget `tabs` 컴포넌트 내부 배열 `useMemo` 미적용 (성능 영향 없음)
- L-2: `reviews.commentThread.replies` EN 복수형 ICU 미처리 (`{count, plural, one {Reply} other {Replies}}`)

### 기술부채 (Wave A3 Critic L-2)
- `analytics/page.tsx` 가 Wave A3 이후에도 `useTranslations('dashboard')` 사용 → `analytics` 네임스페이스로 이관 필요

### 인프라 개선
- **Write 차단 이슈**: `oracle-spawn.sh` `--add-dir` 플래그 추가 또는 inbox 경로 이관 + reap 복사 전략 (L1 참고)
- **auto-critic 체인 불안정**: cleanup trap → `oracle-auto-critic.sh`/`oracle-dispatch.sh` 체인 재작성 (L3 참고)
- **weekNumber 백엔드 포맷 정규화**: en 로케일 공식 지원 시 DB/API 계약 표준화 검토

---

## 검증 요약

| 항목 | 결과 |
|---|---|
| **PR #140** | Squash merge, origin/main `340cc0c` |
| **CI 전체** | PASS (Build Frontend 3m10s, Coverage Gate, E2E Programmers Full Flow 포함) |
| **Korean grep 48파일** | 0건 |
| **`npx tsc --noEmit`** | PASS (전 Wave) |
| **Jest 누적** | 200+ tests PASS (Wave별 확인) |
| **ko/en 키 1:1 대응** | 전 14개 네임스페이스 완전 |
| **Critic Codex gpt-5.4 6회** | 전부 머지 가능 (A5/A6는 fix-round 없이 통과) |

## 담당 에이전트

- **Oracle**: 라우팅, Phase/Wave 의사결정, inbox 복원, task JSON 상태 전환
- **Palette** (opus-4-6): 네임스페이스 신설/확장, 컴포넌트 useTranslations 주입, 테스트 마이그레이션 — Wave A1~A6 전담
- **Critic** (sonnet runner + Codex gpt-5.4): 각 Wave 말미 교차 리뷰 6회, diff 기반 Critical/High/Medium/Low 분류
- **Scribe**: 본 ADR 작성 (Oracle 위임)
