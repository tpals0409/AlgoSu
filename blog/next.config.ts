import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    '/adr': ['../docs/adr/**/*.md'],
  },
};

export default nextConfig;
