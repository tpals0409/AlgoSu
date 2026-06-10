/**
 * @file 인바운드 신원 헤더 sanitize 미들웨어 — x-user-id / x-demo-user 무조건 제거
 * @domain common
 * @layer middleware
 * @related jwt.middleware.ts, app.module.ts
 *
 * 신뢰 경계 강제:
 *   `x-user-id` 와 `x-demo-user` 는 오직 `JwtMiddleware`가 토큰 검증 성공 후
 *   주입할 수 있는 헤더다. 외부에서 들어온 동명 헤더는 신원 위조(권한 우회) 위험이
 *   있으므로 어떤 라우트에 가기도 전에 무조건 제거한다.
 *
 *   - JwtMiddleware도 동일 헤더를 `delete`했지만, 그 미들웨어는 공개 경로에서 실행되지 않으므로
 *     공개 경로(api/events, api/public/*, sse/*)에서 헤더가 그대로 통과할 위험이 있었다.
 *   - 본 미들웨어는 모든 라우트에서 (JwtMiddleware보다 먼저) 실행되므로 공개 경로도 동일 보호를 받는다.
 *   - `RateLimitMiddleware`는 이후에 `x-user-id` 가 비어 있으면 IP 기반 카운트로 동작하므로
 *     공개 경로의 rate limit 신원은 항상 IP 기반이라는 불변식을 회복한다.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/** 외부에서 절대 신뢰하지 않는 인바운드 신원 헤더 목록. */
const UNTRUSTED_IDENTITY_HEADERS = ['x-user-id', 'x-demo-user'] as const;

@Injectable()
export class HeaderSanitizerMiddleware implements NestMiddleware {
  /**
   * 인바운드 요청에서 신원 위조 가능 헤더를 제거한다.
   * 모든 라우트에 부착되며 RequestIdMiddleware 보다 먼저 실행되어야 한다.
   */
  use(req: Request, _res: Response, next: NextFunction): void {
    for (const header of UNTRUSTED_IDENTITY_HEADERS) {
      delete req.headers[header];
    }
    next();
  }
}
