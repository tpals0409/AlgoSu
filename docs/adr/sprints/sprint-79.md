---
sprint: 79
title: "코드 위생 & 프로세스 정비"
date: "2026-04-10"
status: completed
agents: [Oracle, Gatekeeper, Scribe, Palette, Herald]
related_adrs: []
---

# Sprint 79: 코드 위생 & 프로세스 정비

## Decisions
### D1: next-mdx-remote 6.0.0 마이그레이션 — 코드 변경 없이 버전 범프만
- **Context**: CWE-94 CVSS 8.8 취약점이 next-mdx-remote 4.x-5.x에 존재. 블로그는 빌드 타임 정적 export라 실질 exploitable 아니나 의존성 위생 차원.
- **Choice**: 5.0.0 → 6.0.0 직접 업그레이드. compileMDX + next-mdx-remote/rsc API 호환 확인 후 코드 변경 없이 버전 범프만 수행.
- **Alternatives**: 없음 (6.0.0이 유일한 수정 버전)
- **Code Paths**: `blog/package.json`, `blog/src/lib/mdx.ts` (변경 없음, 호환 확인)

### D2: cookie.util 로깅 통합 — CookieService 클래스 대신 logger 콜백 패턴 채택
- **Context**: cookie.util.ts는 DI 없는 유틸 함수라 StructuredLoggerService 주입 불가. process.stdout.write 직접 출력 중.
- **Choice**: setTokenCookie 시그니처에 optional logger 콜백 파라미터 추가. 호출부에서 this.logger 전달, 미전달 시 기존 동작 유지 (하위 호환).
- **Alternatives**: CookieService NestJS Injectable 클래스 전환 — YAGNI, 함수 1개짜리 util을 서비스로 승격할 근거 부족하여 기각.
- **Code Paths**: `services/gateway/src/auth/cookie.util.ts`, `services/gateway/src/auth/oauth/oauth.controller.ts`, `services/gateway/src/auth/token-refresh.interceptor.ts`

### D3: ESLint inline style 룰 — forbid-dom-props + forbid-component-props 이중 적용
- **Context**: Sprint 72 G1 교훈 — 토큰 시스템(Tailwind) 우회 inline style 방지. 기존 43개 파일에 위반 존재.
- **Choice**: warn 레벨로 두 룰 모두 적용. DOM 요소는 forbid-dom-props, 커스텀 컴포넌트는 forbid-component-props. 기존 위반은 점진적 제거.
- **Alternatives**: error 레벨 — 기존 43개 파일 일괄 수정 필요, 이번 스프린트 범위 초과하여 기각.
- **Code Paths**: `frontend/.eslintrc.json`

## Patterns
### P1: Optional Logger 콜백 패턴 (DI 없는 util용)
- **Where**: `services/gateway/src/auth/cookie.util.ts`
- **When to Reuse**: NestJS DI 밖에 있는 유틸 함수에서 구조화 로깅이 필요할 때. 시그니처에 `logger?: { warn: (msg, ctx?) => void }` 추가, 호출부에서 this.logger 전달.

### P2: next lint 사용 (ESLint v9 flat config 회피)
- **Where**: `frontend/.eslintrc.json`
- **When to Reuse**: Next.js 프로젝트에서 ESLint 9.x가 설치되어 있어도 `.eslintrc.json` + `next lint`로 실행하면 정상 동작. `npx eslint`는 flat config 요구하여 실패.

## Gotchas
### G1: react/forbid-component-props는 DOM 요소에 미적용
- **Symptom**: forbid-component-props 룰 추가 후 `npx next lint` 실행 시 0건 경고. 대부분의 inline style이 `<div>`, `<span>` 등 DOM 요소에 사용되고 있었음.
- **Root Cause**: forbid-component-props는 커스텀 React 컴포넌트(`<Button>`, `<Card>`)에만 적용. DOM 요소는 forbid-dom-props가 필요.
- **Fix**: forbid-dom-props + forbid-component-props 두 룰 모두 추가하여 양쪽 커버.

### G2: ESLint v9 flat config 전환
- **Symptom**: `npx eslint src/` 실행 시 `eslint.config.(js|mjs|cjs) file not found` 에러.
- **Root Cause**: ESLint 9.x는 `.eslintrc.json` 미지원, flat config만 인식.
- **Fix**: Next.js의 `npx next lint`로 실행 (내부적으로 .eslintrc.json 호환 처리).

## Metrics
- Commits: 4건, Files changed: 10개 (+353/-61)
