/**
 * @file       markdown.ts
 * @domain     blog / adr
 * @layer      lib
 * @related    mdx.ts (blog renderMdx), mermaid.tsx (Mermaid 컴포넌트)
 *
 * ADR 전용 markdown 렌더러.
 * ADR 본문은 임의 마크다운(JSX 미사용)이므로 format:'md' 로 컴파일한다.
 * mermaid 코드 펜스는 일반 코드 블록으로 렌더링된다.
 */
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';

import { type Locale } from '@/lib/i18n';
import { mdxComponents } from '@/components/mdx-components';
import { rehypeAdrLinkRewrite } from './rehype-adr-link-rewrite';

/**
 * ADR 마크다운을 렌더링한다.
 * format:'md' 로 컴파일하여 JSX/expression 파싱을 건너뛴다.
 *
 * @param source - ADR 본문 마크다운 (frontmatter 제거 후)
 * @returns React 컴포넌트 트리
 */
export async function renderAdrMdx(
  source: string,
  locale: Locale = 'ko',
) {
  const { content } = await compileMDX({
    source,
    components: mdxComponents,
    options: {
      mdxOptions: {
        format: 'md',
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          [rehypeAdrLinkRewrite, { locale }],
          rehypeHighlight,
        ],
      },
    },
  });

  return content;
}
