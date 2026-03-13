/**
 * @file 보안 헤더 미들웨어 — 응답에 표준 보안 헤더 5종 추가
 * @domain common
 * @layer middleware
 * @related request-id.middleware.ts, app.module.ts
 *
 * 설정 헤더:
 * - X-Content-Type-Options: nosniff — MIME 스니핑 방지
 * - X-Frame-Options: DENY — 클릭재킹 방지
 * - X-XSS-Protection: 0 — 최신 브라우저 자체 XSS 필터 사용 권장 (OWASP)
 * - Referrer-Policy: strict-origin-when-cross-origin — 리퍼러 누출 최소화
 * - Permissions-Policy: camera=(), microphone=(), geolocation=() — 불필요 API 차단
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    next();
  }
}
