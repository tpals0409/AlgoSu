---
sprint: 125
title: "Sprint 124 이월 9항목 마감 — i18n 완결 + OAuth 에러 정규화 + Oracle 인프라"
period: "2026-04-24"
status: in-progress
start_commit: 7f753a8
end_commit: TBD (Wave D 완료 후 최종 squash merge)
---

# Sprint 125 — Sprint 124 이월 9항목 마감

## 배경

Sprint 124에서 이월된 9개 품질/기술부채 항목을 마감하여 i18n 시스템 + Oracle 인프라 성숙도를
완결 수준으로 끌어올리는 것이 목표. PM 원칙: **이월 0** — 각 Wave Critic Medium은 해당 Wave 내
follow-up으로 흡수, Low는 즉시 처리 또는 유지 근거 기록 후 종결.

### Sprint 124 이월 9항목 마감 현황

| # | 항목 | Wave | 상태 |
|---|------|------|------|
| 1 | useRouter 전역 locale-aware 교체 (15+ 파일) | A | ✅ |
| 2 | studies/[id]/room 하위 컴포넌트 텍스트 번역 | B-1 | ✅ |
| 3 | problems/create/edit 자체 i18n 잔여 | B-3 | ✅ |
| 4 | ADR-025 Gateway OAuth 에러 정규화 구현 | C | ✅ |
| 5 | 테스트 3건 ko-KR 하드코딩 정리 | A | ✅ |
| 6 | analytics 네임스페이스 기술부채 | B-2 | ✅ |
| 7 | admin-guard defaultLocale 하드코딩 제거 | A | ✅ (탐색 결과 이미 해소) |
| 8 | Oracle 인프라: short-task inbox Write permission 조사 | D | 🔲 |
| 9 | Critic API 529 재시도 정책 | D | 🔲 |

---

## Wave A — 기계적 품질 개선 (PR #142, squash `f6c0391`)

담당: palette (i18n), scribe (기록)

### A1 — useRouter 전역 locale-aware 교체

- 21 소스 파일 + 13 테스트 파일 = **34파일** `next/navigation useRouter` → `@/i18n/navigation useRouter` 전환
- 대상 디렉토리: `app/[locale]` 전체, `contexts/`, `components/`
- 이미 `@/i18n/navigation`을 쓰던 파일 누락 없이 전수 교체

### A2 — 테스트 3건 ko-KR 하드코딩 정리

- `NotificationBell.test.tsx`: `'알림'` 리터럴 → `t('notifications.title')` 모킹
- `ReplyItem.test.tsx`: `'답글'` 리터럴 → `t('reviews.reply')` 모킹
- `CommentThread.test.tsx`: `'댓글'` 리터럴 → `t('reviews.comment')` 모킹

### A3 — Sprint 123 Critic Low 흡수

- `FeedbackForm` / `FeedbackWidget` `useMemo` 의존성 배열 최적화
- `reviews.commentThread.replies` ICU 메시지 EN 복수형 (`{count, plural, =0{No replies} one{# reply} other{# replies}}`)

### A4 — Critic Medium follow-up 흡수

- `next/link` → `@/i18n/navigation Link` 전환 8파일
- `reviews.json` `=0` plural dead code 제거 ko/en
- `CommentThread` 테스트 정규식 6곳 정밀화 (`/n개의 댓글/` → `/\d+개의 댓글/`)

### A5 — admin-guard 탐색

- `admin-guard defaultLocale 하드코딩` grep 결과: `routing.defaultLocale` 이미 참조 중 → 변경 불필요, 항목 종결

**Critic 결과**: ✅ 머지 가능

---

## Wave B — i18n 번역 보강 (PR #143, squash `83313ee`)

담당: palette (번역), scribe (기록)

### B1 — studies/[id]/room 번역

- `AnalysisView.tsx` 5줄 한글 리터럴 번역
- 네임스페이스: `studies` (Sprint 124에서 신설, 재사용)

### B2 — analytics 네임스페이스 이관

- `dashboard.analyticsSection.*` → `analytics.*` 네임스페이스 독립 분리
- 영향 파일: `analytics/page.tsx`, `analytics/components/*`
- 기존 `dashboard` 네임스페이스 잔여 키 정리

### B3 — problems/create·edit 자체 i18n

- `problems/create/page.tsx` + `problems/[id]/edit/page.tsx` 자체 번역 52키
- 커밋: `4961053` (B3 본체) + `dfaf7c2` (fix: TypeScript strict 오류 교정)

### B4 — OnboardingStepper 번역 (Wave A Critic Low 편입)

- `OnboardingStepper.tsx` 한글 리터럴 3개 → `common.onboarding.*` 키

### B5 — Wave B Critic Medium+Low 흡수

- analytics `'미분류'` 카테고리 → `t('analytics.uncategorized')`
- problems 아이콘 `aria-label` → `t('problems.filter.ariaLabel')`

**신규 번역 키**: 153개 (ko 76 + en 77)
**Critic 결과**: ✅ 2회 모두 머지 가능

### Sprint 126 기술부채 등록 (Wave B에서 발견)

- `difficultyData` 배열 `useMemo` 추출 (analytics/page.tsx 인라인 상수 — pre-existing)
- unclassified 차트 비대칭: ko `'미분류'` vs en `'Unclassified'` 데이터 레이어 불일치 (pre-existing)

---

## Wave C — Gateway OAuth 에러 코드 정규화 (ADR-025 구현)

담당: gatekeeper (C1), palette (C2), scribe (C3)

브랜치: `feat/sprint-125-wave-c-oauth-normalization`

### C1 — Gateway 백엔드 enum + Exception 7종 (commit `0d13282`)

- `services/gateway/src/auth/oauth/exceptions/` 신규 디렉토리
  - `oauth-callback.exception.ts` — `OAuthCallbackErrorCode` type + 기반 클래스 + 7 Exception 클래스
  - `index.ts` — 배럴 익스포트
- `oauth.service.ts`: `validateAndConsumeState()` → `OAuthInvalidStateException`, 토큰 교환 → `OAuthTokenExchangeException`, 프로필 조회 → `OAuthProfileFetchException`, 계정 충돌 → `OAuthAccountConflictException`
- `oauth.controller.ts` catch 블록: `instanceof OAuthCallbackException` 분기 → `e.code` redirect (한글 `encodeURIComponent` 방식 폐지)
- `oauth.controller.spec.ts`: Exception 7종 분기별 redirect URL 검증 테스트 추가
- `oauth.service.spec.ts`: 각 throw 지점 Exception 클래스 검증 테스트 추가

### C2 — 프론트엔드 ALLOWED_ERRORS 확장 + i18n 6키 (commit `98a1621`)

- `callback/page.tsx` `ALLOWED_ERRORS` 7종 완성 (기존 4종 → `token_exchange`, `profile_fetch`, `account_conflict` 추가)
- `ERROR_KEY_MAP` 동일 3개 `callback.error.*` 키 매핑 추가
- `messages/ko/auth.json` `callback.error.*` 3키 추가
- `messages/en/auth.json` `callback.error.*` 3키 추가

### C3 — ADR-025 Accepted 승격 + sprint-125.md 초안 (본 커밋)

- `docs/adr/ADR-025-gateway-oauth-error-normalization.md`: 상태 `proposed` → `accepted`, 구현 결과 섹션 추가
- `docs/adr/sprints/sprint-125.md`: 본 파일 신규 생성

---

## Wave D — Oracle 인프라 (herald + sensei) — 🔲 예정

### D1 — Critic API 529 재시도 로직 (herald)

- `~/.claude/oracle/bin/oracle-auto-critic.sh` 수정
- 529 응답 시 지수 백오프 재시도 (최대 3회)
- 재시도 소진 시 Oracle에 `status: partial` 리포트 + 수동 호출 안내

### D2 — short-task inbox Write permission 조사 리포트 (sensei)

- 독립 실행 모드에서 `~/.claude/oracle/inbox/` Write 권한 차단 원인 분석
- `--add-dir` 옵션 효과 검증 (Sprint 124 G-1에서 추가)
- 리포트를 sprint-125.md에 보완 예정

---

## 성과 요약

| 지표 | 수치 |
|------|------|
| 총 커밋 (Wave A~C) | ~50+ |
| 신규 번역 키 (Wave A~B) | ~200+ (ko+en) |
| 네임스페이스 도달 (Sprint 125 기준) | 18개 (Wave B 확정) |
| OAuth 에러 코드 정규화 | 7종 enum 완성 |
| Sprint 124 이월 9항목 마감 | 7/9 ✅ (Wave D 2항목 예정) |

---

## 기술부채 및 Sprint 126 등록 목록

| 항목 | 출처 | 우선순위 |
|------|------|---------|
| `errors.authFailed` / `errors.serviceFailed` 미참조 레거시 키 검토 | ADR-025 후속 | Low |
| `difficultyData` useMemo 추출 | Wave B Critic Low | Low |
| unclassified 차트 ko/en 비대칭 데이터 레이어 정렬 | Wave B Critic Low | Low |
| Wave D: Critic 529 재시도 (완료 후 삭제) | Sprint 125 D1 | Medium |
| Wave D: inbox Write permission 조사 (완료 후 삭제) | Sprint 125 D2 | Medium |
