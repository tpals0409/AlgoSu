---
sprint: 124
title: "Sprint 123 이월 마감 — i18n 컴포넌트 완성 + Sprint 118 P1 보안 3건 + Oracle 인프라 안정화 + 설계 ADR 2건"
period: "2026-04-24"
status: completed
start_commit: 340cc0c
end_commit: 0bf8091
---

# Sprint 124 — Sprint 123 이월 마감

## 배경

Sprint 123에서 Phase A(컴포넌트 번역 48파일 × 6 Wave)만 완료하고 Phase B~E가 이월됐다. Sprint 124는 이월 4 Phase(admin/studies 페이지 번역, Sprint 120 P1 보안, i18n 품질 잔여, 테스트 인프라)를 마감하면서 Oracle 디스패치 파이프라인의 안정성 결함(Write 차단, auto-critic 체인 불안정, stale task 루프)을 구조적으로 해결하는 것이 목표.

---

## Phase 0 — Housekeeping

1. 브랜치 리네이밍: `feature/sprint-123-phase-b-admin` → `feature/sprint-124-carryover`
2. Sprint 123 ADR 커밋 (`5500b06`) — 216줄 untracked 상태였음
3. audit-queue JSON 경로 현행화: p1-024/p1-025의 file 필드를 `[locale]` 경로로 업데이트 (Sprint 121 i18n 리팩터 반영)

---

## Phase G — Oracle 인프라 개선 (~/.claude/oracle/, git 밖)

Sprint 123에서 6회 재발한 Write 차단 + 3회 불안정한 auto-critic 체인 해결.

| # | 변경 | 파일 |
|---|------|------|
| G-1 | `claude -p` 호출에 `--add-dir ${INBOX_DIR}` 추가 | `bin/oracle-spawn.sh` |
| G-3a | cleanup trap에 `cd "${project_dir}"` 보장 + 단계별 로그 리다이렉트 (`-critic.log`, `-reap.log`, `-dispatch.log`) | `bin/oracle-spawn.sh` |
| G-3b | git 명령에 `-C "$project_dir"` 명시로 디렉토리 무관 안정성 | `bin/oracle-auto-critic.sh` |
| G-4a | `is_agent_alive()` 함수 신규 (`pgrep -P pane_pid -f claude`) | `bin/_lib.sh` |
| G-4b | oracle-status.sh 활성 에이전트 라인에 `●` (alive) / `○` (dead) 표시 통합 | `bin/oracle-status.sh` |
| G-5 | [추가 보완] `is_task_stale()` — age > `ORACLE_STALE_HOURS`(기본 2h) + lock 없음 → cancelled 자동 마킹 | `bin/oracle-dispatch.sh` |

---

## Phase B — i18n 컴포넌트 완성 (3 Wave, 18 commits)

### B1 (5 commits, base 5500b06)

- studies 네임스페이스 신설 (15번째)
- `studies/page` (61) + `studies/[id]/page` (55) + `studies/[id]/room/page` (19) + `studies/[id]/settings/page` (111)
- 신규 번역 키 154개 (ko/en)
- Critic: 머지 가능 (L1 void useRouter, L2 테스트 한글 — B2에서 교정/Sprint 125 이관)

### B2 (7 commits, base 5500b06)

- admin / sharing / legal 네임스페이스 신설 (16~18번째)
- guest는 `common.guest.*` 하위로 (독립 네임스페이스 지양)
- `admin/feedbacks` (65) + `shared/[token]` (93) + `privacy` (54) + `terms` (51) + `guest` (16) 번역
- privacy/terms는 async Server Component로 전환 (SSR SEO 최적화 부수 효과)
- B1 Critic Low(void useRouter) 교정 포함
- 신규 번역 키 151개
- Critic: ⚠️ 조건부 → B2-fix로 해소

### B2-fix (6 commits, base f6c7735)

- 프로덕션 `toLocaleDateString`/`toLocaleTimeString('ko-KR')` 하드코딩 10곳 `useLocale()` 전환
  - Critic 지적 5곳(admin/feedbacks 3, shared/[token] 2) + Oracle 전역 grep 추가 5곳(studies/room AnalysisView/SubmissionView, submissions/analysis, submissions/status, analytics)
- `shared/[token]` AI 카테고리 safe lookup 폴백 (`t.has` 기반)
- Critic: ✅ 머지 가능

---

## Phase C — Sprint 120 P1 보안 3건 (2 Wave, 6 commits)

### architect 자문 (task-20260424-103725-44440)

- p1-024 해결 방안 4 옵션 비교 (Middleware / Server Component / CSR 유지 / Hybrid 쿠키 mirror)
- 핵심 발견: JWT는 이미 httpOnly Cookie 저장 (Sprint 120 전환 완료) — 과제 전제 교정
- 권고: Option B (Server Component) — JWT_SECRET frontend 미노출 + Sealed Secret 무변경 + middleware.ts 100% 호환

### C 본디스패치 (5 commits)

- **C-1 (p1-023)**: middleware `PUBLIC_PATHS`에 `/shared`, `/privacy`, `/terms` 추가
- **C-2a (infra)**: `GATEWAY_INTERNAL_URL` env 추가 (비민감)
- **C-2b**: `admin-guard.ts` 신규 — `requireAdmin(locale)` Server 유틸, `cookies()` + Gateway `/auth/profile` fetch + fail-secure redirect
- **C-2c (p1-024)**: `admin/layout.tsx` `'use client'` 제거 → async Server Component 전환 → 비admin 번들 노출 차단
- **C-3 (p1-025)**: OAuth callback `ALLOWED_ERRORS` enum + 12 번역 키 신규

### C-fix (1 commit)

- Critic 지적 P2: `ALLOWED_ERRORS`가 Gateway 실제 emit 코드(`access_denied`/`missing_params`/`auth_failed`)와 불일치 (Oracle 자문 메시지 오류가 원인)
- `Gateway oauth.controller.ts:97-144` 실측 후 재동기화
- 제거 4키, 추가 3키

---

## Phase D — i18n 품질 + ADR 문서화 (4 작업, 6 commits)

### 병렬 디스패치

- palette D1+D2 (tier3, 7m) + scribe ADR (tier2, 1m) 동시 spawn, pane 분리
- Phase G-4 `is_agent_alive` 인디케이터 병렬 정상 작동 확인

### palette D1 (1 commit)

- Zod schemas 4개(study/submission/problem/feedback) `errorMap` i18n 통합
- `errors.validation.*` 섹션 12키 신설
- Form 사용처 5개 `tErrors()` 적용 + `problem-form-utils` + `schemas.test.ts`

### palette D2a (1 commit)

- `lib/date.ts` `relativeTime(dateStr, locale='ko')` 파라미터 추가
- `RELATIVE_LABELS` 맵: ko + en 지원
- 호출처 2곳 `useLocale()` 전달

### palette D2b (1 commit)

- `hour12: true` 제거 (`shared/[token]`:540, `submissions/analysis`:298)

### scribe ADR 2건

- **ADR-024** `admin-server-guard.md` (accepted) — Option B 선택 근거 + 4 옵션 비교 테이블
- **ADR-025** `gateway-oauth-error-normalization.md` (proposed) — invalid_state 데드코드 해결 제안, Sprint 125+ 구현

### D-hotfix (1 commit)

- Critic P2 지적: `problems/[id]/edit/page.tsx`가 `validateProblemForm` i18n 키를 raw로 노출
- 5줄 변경(import 1 + 선언 1 + L540/591/623 `tErrors` 래핑)
- Critic 재검증 시 API 529 Overloaded → Oracle 스팟 승인 (create/page.tsx 패턴 일치 확인)

---

## Critic 체인 요약 (7회)

| 대상 | 결과 | 비고 |
|------|------|------|
| B1 | ✅ 머지 가능 (Medium 1, Low 2) | useRouter 전역은 Sprint 125 이관 |
| B2 | ⚠️ 조건부 → B2-fix로 해소 | P2 3건(ko-KR 하드코딩) |
| B2-fix | ✅ 머지 가능 | M-1/L-1 Phase D 이관 |
| C | ⚠️ 조건부 → C-fix로 해소 | P2 1건(ALLOWED_ERRORS 불일치) |
| C-fix | ✅ 머지 가능 | Medium 1건(invalid_state 데드코드) → ADR-025 |
| D | ⚠️ 조건부 → D-hotfix로 해소 | P2 1건(edit 페이지 tErrors 누락) |
| D-hotfix | API 529 → Oracle 스팟 ✅ | 외부 인프라 문제, 패턴 일치 검증 |

---

## Sprint 118 감사 25건 전수 마감

- Sprint 118 총 파인딩 25건 (P0 17 + P1 8)
- Sprint 119 (13건) + Sprint 120 (4건) + Sprint 124 Phase C (3건) + 기존 false_positive (2건) + 기타 처리
- Sprint 124 종료 시점: completed 23 + false_positive 2 = **25건 100% 클로징**

---

## 교훈 (Sprint 125+ 이관)

### Oracle 파이프라인 후속 조사

- **short-task inbox Write permission 이슈** (C-fix + D-hotfix + D-hotfix Critic): `--add-dir` + `bypassPermissions` 설정에도 에이전트 자가 로그에 "결과 파일 쓰기에 대한 권한이 필요합니다" 메시지 출력. 긴 작업(7m+)에서는 정상. `claude -p` 런타임 특정 상황 조사 필요.
- **Critic API 529 Overloaded** (D-hotfix): Anthropic 서버 과부하 발생 시 Critic 자동 체인 재시도 로직 없음. 실패 시 수동 스팟 옵션 명시적 플로우화 검토.

### Sprint 125 로드맵 편입

- useRouter 전역 locale-aware 교체 (15+ 파일)
- `studies/[id]/room` 하위 컴포넌트 텍스트 번역 (AnalysisView/SubmissionView/WeekSection)
- `problems/create/page.tsx`, `problems/[id]/edit/page.tsx` 자체 i18n 미적용 한글 리터럴 잔존
- ADR-025 Gateway OAuth 에러 코드 정규화 구현
- 테스트 3건 ko-KR 하드코딩 정리 (NotificationBell/ReplyItem/CommentThread test)
- analytics 네임스페이스 기술부채 (dashboard → analytics)
- admin-guard `defaultLocale` 하드코딩 제거 (`routing.defaultLocale` 참조)
- FeedbackForm/FeedbackWidget useMemo (Sprint 123 Critic Wave A4 Low 이월)
- `reviews.commentThread.replies` EN 복수형 ICU (Sprint 123 Critic Low 이월)

### false positive 기록 (Sprint 124 조사 결과)

- B2-fix M-2 (submissions/analysis 카테고리 폴백): `CATEGORY_KEYS` 매핑 기반 폴백이 이미 적용되어 있었음 (line 498)

---

## 네임스페이스 최종 상태: 18개 (기존 14 + 신규 4)

account / analytics / auth / common / dashboard / difficulty / errors / feedback / landing / layout / problems / reviews / submissions / ui / **studies / admin / sharing / legal**

---

## 커밋 해시 전수 (31건, 시간 순)

| Phase | 커밋 해시 |
|-------|-----------|
| Phase 0 | `5500b06` |
| Phase B1 | `a5c691a` / `68fa7fe` / `4bb4015` / `51b7567` / `daab8df` |
| Phase B2 | `728b1ba` / `18e55ed` / `d512219` / `96179b6` / `3455fbf` / `353e741` / `f6c7735` |
| Phase B2-fix | `436fcdc` / `2e4f354` / `74ed237` / `b99e35f` / `a6b1033` / `492f344` |
| Phase C | `16d5952` / `6122469` / `3b955d9` / `1ef4ced` / `36a4247` |
| Phase C-fix | `caea563` |
| Phase D ADR | `5d7ba06` / `4b92a8c` |
| Phase D palette | `47c1a77` / `d06de25` / `708d5e9` |
| Phase D-hotfix | `0bf8091` |
