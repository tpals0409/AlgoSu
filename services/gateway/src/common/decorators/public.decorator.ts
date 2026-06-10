/**
 * @file @Public() 데코레이터 — JWT 인증 제외 경로를 컨트롤러/핸들러 단위로 표식
 * @domain common
 * @layer decorator
 * @related jwt.middleware.ts, public-routes.ts, public-routes.spec.ts
 *
 * 배경 (ADR-030 S-1):
 *   현재 JWT 인증은 NestMiddleware(JwtMiddleware)와 app.module.ts의 `.exclude(...)` 목록으로
 *   관리된다. Glob 패턴(`auth/oauth/(.*)`, `internal/(.*)`, `api/public/(.*)`)이 섞여 있어
 *   "이 핸들러가 공개인지" 컨트롤러 코드만 보고는 확인할 수 없다.
 *
 *   이 데코레이터는 핸들러/컨트롤러에 `IS_PUBLIC_KEY=true` 메타데이터를 부여해 SSOT 역할을 한다.
 *   동시에 `PUBLIC_ROUTES` 상수(`public-routes.ts`)가 NestMiddleware exclude 목록의 SSOT이며,
 *   `public-routes.spec.ts`가 두 SSOT의 일치를 강제한다.
 *
 *   ProxyDispatchMiddleware가 미들웨어 단계에서 요청을 종결하므로 글로벌 가드 전환은 보류한다.
 *   (Sprint 239 S-1: 데코레이터는 향후 글로벌 가드 도입을 위한 기반 + 명세 테스트의 앵커.)
 */

import { SetMetadata } from '@nestjs/common';

/** Reflector 키 — 데코레이터 메타데이터 조회 시 사용 */
export const IS_PUBLIC_KEY = 'algosu:isPublic';

/**
 * 핸들러 또는 컨트롤러를 JWT 인증 제외로 표식.
 *
 * 컨트롤러에 부착하면 그 컨트롤러의 모든 핸들러가 공개.
 * 핸들러에 부착하면 그 핸들러만 공개.
 * `PUBLIC_ROUTES` 상수와 1:1로 대응되어야 하며 정합성은 명세 테스트에서 강제된다.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
