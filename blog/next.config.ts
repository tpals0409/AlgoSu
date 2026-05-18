import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // ADR md(`../docs/adr/**/*.md`)는 build-time에 fs.readFile로 읽어 정적 HTML로 export.
  // `outputFileTracingIncludes`는 `output: 'export'`와 결합 시 `out/` 생성을 silently skip
  // (Sprint 157 P10 hotfix). 정적 export는 런타임 파일 access가 없어 trace include 불필요.
};

export default nextConfig;
