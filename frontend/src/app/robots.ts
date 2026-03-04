import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/', '/callback'],
    },
    sitemap: `${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://algosu.kr'}/sitemap.xml`,
  };
}
