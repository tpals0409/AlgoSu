/**
 * @file PUBLIC_ROUTES — Gateway JWT 검증 제외 경로의 SSOT
 * @domain common
 * @layer config
 * @related app.module.ts, jwt.middleware.ts, public.decorator.ts, public-routes.spec.ts
 *
 * 배경 (ADR-030 S-1):
 *   JWT 미들웨어 `exclude(...)`에 사용되던 와일드카드 패턴(`auth/oauth/(.*)`,
 *   `internal/(.*)`, `api/public/(.*)`)을 실제 컨트롤러 라우트로 전수 열거하여
 *   공개 표면을 축소한다. 컨트롤러에는 `@Public()` 데코레이터가 부착되어 있으며
 *   `public-routes.spec.ts`가 양방향 일치를 강제한다.
 *
 *   이 목록을 수정할 때는 반드시 (1) 대응 컨트롤러/핸들러의 @Public() 부착 여부와
 *   (2) `public-routes.spec.ts`의 스냅샷을 함께 검증한다.
 */

import { RequestMethod } from '@nestjs/common';
import type { RouteInfo } from '@nestjs/common/interfaces';

/**
 * JWT 미들웨어 제외 경로 목록.
 *
 * - 와일드카드(`(.*)`/`*`) 절대 금지 — 컨트롤러에 실제 매핑된 라우트만 등록한다.
 * - HTTP method도 컨트롤러와 정확히 일치해야 한다 (전 method가 필요한 경우만 `RequestMethod.ALL`).
 * - 공개 표면이 늘어나면 `public.decorator.ts`의 `@Public()` 부착도 같이 갱신한다.
 */
export const PUBLIC_ROUTES: ReadonlyArray<RouteInfo> = [
  // ── 인프라 ─────────────────────────────────────────────
  { path: 'health', method: RequestMethod.GET },
  { path: 'health/ready', method: RequestMethod.GET },
  { path: 'metrics', method: RequestMethod.GET },

  // ── OAuth (Identity) — 시작/콜백/리프레시/로그아웃/데모 ─
  // `auth/oauth/(.*)` 와일드카드 → 다음 2개 GET으로 전수 열거
  { path: 'auth/oauth/:provider', method: RequestMethod.GET },
  { path: 'auth/oauth/:provider/callback', method: RequestMethod.GET },
  { path: 'auth/github/link/callback', method: RequestMethod.GET },
  { path: 'auth/demo', method: RequestMethod.POST },
  { path: 'auth/refresh', method: RequestMethod.POST },
  { path: 'auth/logout', method: RequestMethod.POST },
  // FE 로그인 전/후 무관 조회 — Sprint 71-1R
  { path: 'auth/session-policy', method: RequestMethod.GET },

  // ── Internal API — InternalKeyGuard가 실보호 ──────────
  // `internal/(.*)` 와일드카드 → 실 4개 GET으로 전수 열거
  { path: 'internal/users/:user_id/github-status', method: RequestMethod.GET },
  { path: 'internal/users/:user_id/github-encrypted-token', method: RequestMethod.GET },
  { path: 'internal/studies/:study_id/members/:user_id', method: RequestMethod.GET },
  { path: 'internal/studies/:studyId', method: RequestMethod.GET },

  // ── SSE — 자체 쿠키 JWT 검증(SseController#verifyToken) ─
  { path: 'sse/submissions/:id', method: RequestMethod.GET },
  { path: 'sse/notifications', method: RequestMethod.GET },

  // ── 공유 링크 — ShareLinkGuard가 토큰 검증 ────────────
  // `api/public/(.*)` 와일드카드 → 공유/프로필 5개 GET으로 전수 열거
  { path: 'api/public/shared/:token', method: RequestMethod.GET },
  { path: 'api/public/shared/:token/problems', method: RequestMethod.GET },
  { path: 'api/public/shared/:token/submissions', method: RequestMethod.GET },
  { path: 'api/public/shared/:token/analysis/:submissionId', method: RequestMethod.GET },
  { path: 'api/public/profile/:slug', method: RequestMethod.GET },

  // ── 이벤트 로깅 — 비인증 수신 (S-2: DTO 검증 + 50건 캡)
  { path: 'api/events', method: RequestMethod.POST },
];
