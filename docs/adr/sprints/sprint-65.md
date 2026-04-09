---
sprint: 65
title: "로그인/로그아웃/세션 기능 검토 및 개선"
date: "2026-04-09"
status: completed
agents: [Oracle, Scout, Gatekeeper]
related_adrs: []
---

# Sprint 65: 로그인/로그아웃/세션 기능 검토 및 개선

## Decisions
### D1: DEV_MOCK 바이패스에 NODE_ENV 가드 추가
- **Context**: `NEXT_PUBLIC_DEV_MOCK=true` 설정 시 Edge Middleware가 모든 인증을 우회. `NEXT_PUBLIC_*` 변수는 빌드 타임에 결정되므로 프로덕션 빌드에서 실수로 활성화 시 전체 라우트 보호 무력화 위험
- **Choice**: `process.env.NODE_ENV !== 'production'` 조건 추가하여 프로덕션 빌드에서는 DEV_MOCK 무시
- **Alternatives**: `DEV_MOCK` 환경변수를 `NEXT_PUBLIC_` 접두사 없는 서버 전용으로 변경 — Edge Middleware가 서버 사이드이므로 가능하나, 기존 AuthContext의 DEV_MOCK 분기와 일관성 유지 위해 현재 방식 유지
- **Code Paths**: `frontend/src/middleware.ts`

### D2: 401 세션 만료 리다이렉트를 `?expired=true`로 통합
- **Context**: API 401 응답 시 `?error=session_expired`로 리다이렉트 → 일반 에러 메시지 표시. heartbeat 타임아웃은 `?expired=true` → 세션 만료 모달 표시. 두 흐름이 불일치
- **Choice**: `fetchApi`의 401 리다이렉트를 `?expired=true`로 변경하여 모든 세션 만료가 동일한 모달 UI로 표시되도록 통합
- **Alternatives**: 별도 Toast 컴포넌트 추가 — 과도한 구현, 이미 로그인 페이지에 세션 만료 모달이 존재
- **Code Paths**: `frontend/src/lib/api.ts`

### D3: localStorage 토큰 함수 대량 제거 (httpOnly Cookie SSoT)
- **Context**: httpOnly Cookie 전환 완료 후에도 `setToken`, `getToken`, `isTokenExpired` 등 11개 localStorage 토큰 함수가 잔존. 프로덕션 코드에서 미사용 (테스트에서만 참조)
- **Choice**: 미사용 함수 11개 제거, `removeToken`/`removeRefreshToken`은 레거시 정리용으로 유지
- **Alternatives**: 전체 제거 (removeToken 포함) — 기존 사용자 localStorage에 레거시 토큰이 남아있을 수 있어 logout 시 정리 필요
- **Code Paths**: `frontend/src/lib/auth.ts`, `frontend/src/lib/__tests__/auth.test.ts`, `frontend/src/lib/__tests__/auth-ssr.test.ts`

## Patterns
### P1: 보호 라우트 isReady 가드 패턴
- **Where**: `frontend/src/app/problems/create/page.tsx`, `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/analytics/page.tsx`
- **When to Reuse**: `useRequireAuth()` 사용 페이지에서 인증 로딩 중 빈 화면 방지가 필요할 때. `const { isReady } = useRequireAuth();` + `if (!isReady) return <LoadingSpinner />;` 패턴 적용

## Gotchas
### G1: NEXT_PUBLIC_ 환경변수는 프로덕션 빌드에서도 번들링됨
- **Symptom**: DEV_MOCK 플래그가 빌드 시 포함되어 NODE_ENV 체크 없이는 프로덕션에서도 활성화 가능
- **Root Cause**: Next.js의 `NEXT_PUBLIC_*` 변수는 빌드 타임에 인라인되므로 런타임 환경변수가 아님
- **Fix**: 보안 관련 바이패스에는 반드시 `NODE_ENV` 이중 체크 필수

## Metrics
- Commits: 1건, Files changed: 7개 (+42/-440)
