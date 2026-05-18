import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname 대체 (ESM 호환). monorepo lockfile 충돌 시 workspace root 추론 위험.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // workspace root을 blog/로 고정 (Sprint 157 hotfix #2).
  // 미설정 시 monorepo 환경에서 repo root으로 추론되어 `out/`이 repo root에 생성됨.
  // CI에서 `working-directory: blog`로 실행되는 link integrity step이 `out/adr` not found 에러.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
