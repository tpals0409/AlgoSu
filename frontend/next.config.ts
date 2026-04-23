/**
 * @file Next.js 설정 — CSP, rewrites, standalone 빌드, i18n
 * @domain common
 * @layer config
 * @related src/i18n/request.ts, src/i18n/routing.ts
 */

import type { NextConfig } from 'next';
import withBundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const createNextIntlPlugin = require('next-intl/plugin');

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
const minioUrl = process.env.NEXT_PUBLIC_MINIO_URL ?? '';

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
      {
        source: '/sse/:path*',
        destination: `${apiBaseUrl}/sse/:path*`,
      },
      {
        source: '/auth/:path*',
        destination: `${apiBaseUrl}/auth/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // unsafe-eval: Monaco Editor(@monaco-editor/react)가 내부적으로
              // new Function()을 사용하여 구문 강조·언어 기능을 구현하므로 필수.
              // unsafe-inline: Next.js App Router가 런타임에 <script>/<style> 태그를
              // 인라인 삽입하며, 정적 headers()에서는 nonce를 동적 생성할 수 없어 필수.
              // Next.js가 nonce 기반 CSP를 middleware에서 지원하면 전환 검토.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://pagead2.googlesyndication.com https://www.googletagservices.com https://adservice.google.com https://tpc.googlesyndication.com blob:",
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
              `img-src 'self' blob: data: ${minioUrl} https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com`.trim(),
              "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com",
              `connect-src 'self' ${apiBaseUrl} https://cdn.jsdelivr.net https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net`.trim(),
              "worker-src 'self' blob:",
              "frame-src https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

/** next-intl 플러그인 — i18n/request.ts를 진입점으로 사용 */
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withSentryConfig(withAnalyzer(withNextIntl(nextConfig)), {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
