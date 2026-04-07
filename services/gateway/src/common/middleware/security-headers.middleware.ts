/**
 * @file 보안 헤더 미들웨어 — Traefik Middleware로 이관 완료 (L-14)
 * @domain common
 * @layer middleware
 * @related request-id.middleware.ts, app.module.ts
 *
 * [이관 완료] 아래 헤더는 Traefik security-headers Middleware에서 전역 적용:
 * - Content-Security-Policy (CSP) — 신규
 * - Strict-Transport-Security (HSTS) — 신규
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection: 0
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: camera=(), microphone=(), geolocation=()
 *
 * 이 미들웨어는 Traefik을 경유하지 않는 내부 직접 호출(k8s ClusterIP)에 대한
 * 방어 계층으로 유지합니다. Traefik 헤더와 중복 시 Traefik 값이 우선합니다.
 *
 * @see infra/k3s/ingress.yaml — Traefik security-headers Middleware
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    // 내부 직접 호출 방어 계층 — Traefik 경유 시 Traefik 헤더가 우선
    // CSP — Traefik security-headers Middleware와 동일 값
    if (!res.hasHeader('Content-Security-Policy')) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.algo-su.com; frame-ancestors 'none'",
      );
    }
    // HSTS — stsSeconds: 31536000, stsIncludeSubdomains: true
    if (!res.hasHeader('Strict-Transport-Security')) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
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
