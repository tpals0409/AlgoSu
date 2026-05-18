/**
 * @file       markdown.ts
 * @domain     blog / adr
 * @layer      lib
 * @related    mdx.ts (blog renderMdx), mermaid.tsx (Mermaid 컴포넌트)
 *
 * ADR 전용 renderMdx 래퍼.
 * mermaid 코드 펜스를 <Mermaid chart={...} /> JSX로 사전 변환 후
 * 기존 renderMdx 파이프라인에 위임한다.
 */
import { compileMDX } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';

import { mdxComponents } from '@/components/mdx-components';

/** mermaid 코드 펜스 정규식 */
const MERMAID_FENCE_RE = /```mermaid\s*\n([\s\S]*?)```/g;

/**
 * mermaid 코드 펜스를 <Mermaid chart={String.raw`...`} /> JSX로 변환한다.
 * @param source - 원본 마크다운
 */
function transformMermaidFences(source: string): string {
  return source.replace(MERMAID_FENCE_RE, (_match, chart: string) => {
    const escaped = chart.trim().replace(/`/g, '\\`').replace(/\$/g, '\\$');
    return `<Mermaid chart={String.raw\`${escaped}\`} />`;
  });
}

/**
 * ADR 마크다운을 MDX로 렌더링한다.
 * mermaid 코드 펜스를 JSX로 사전 변환한 뒤 compileMDX를 호출한다.
 *
 * @param source - ADR 본문 마크다운 (frontmatter 제거 후)
 * @returns React 컴포넌트 트리
 */
export async function renderAdrMdx(source: string) {
  const transformed = transformMermaidFences(source);

  const { content } = await compileMDX({
    source: transformed,
    components: mdxComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, rehypeHighlight],
      },
    },
  });

  return content;
}
