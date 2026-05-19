/**
 * @file       rehype-adr-link-rewrite.ts
 * @domain     blog / adr
 * @layer      lib
 * @related    markdown.ts, parser.ts
 *
 * ADR 본문의 상대 경로 .md 링크를 정적 export URL로 변환하는 rehype 플러그인.
 * `./sprint-NNN.md` → `${prefix}/adr/sprints/NNN/` 등.
 */
import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';
import type { Locale } from '@/lib/i18n';

interface RehypeAdrLinkRewriteOptions {
  locale?: Locale;
}

/** 상대 경로 .md href를 정적 export URL로 변환한다. */
function rewriteHref(href: string, locale: Locale): string | null {
  const prefix = locale === 'en' ? '/en' : '';

  // ./sprint-NNN.md 또는 ./sprint-NNN → sprint page
  const sprintRel = href.match(
    /^\.\/sprint-(\d+)(?:\.md)?$/,
  );
  if (sprintRel) return `${prefix}/adr/sprints/${sprintRel[1]}/`;

  // sprint-NNN.md (no ./ prefix)
  const sprintBare = href.match(/^sprint-(\d+)\.md$/);
  if (sprintBare) return `${prefix}/adr/sprints/${sprintBare[1]}/`;

  // ./topics/SLUG.md → topic page
  const topicRel = href.match(
    /^\.\/topics\/([^/]+?)(?:\.md)?$/,
  );
  if (topicRel) return `${prefix}/adr/topics/${topicRel[1]}/`;

  // ../adr-en/sprints/sprint-NNN.md → EN sprint page
  const enCross = href.match(
    /^\.\.\/adr-en\/sprints\/sprint-(\d+)(?:\.md)?$/,
  );
  if (enCross) return `/en/adr/sprints/${enCross[1]}/`;

  return null;
}

/**
 * ADR 본문 마크다운의 상대 경로 .md 링크를
 * 정적 export URL로 변환하는 rehype 플러그인.
 */
export function rehypeAdrLinkRewrite(
  options?: RehypeAdrLinkRewriteOptions,
) {
  const locale = options?.locale ?? 'ko';

  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return;

      const href = node.properties?.href;
      if (typeof href !== 'string') return;

      // 외부 링크는 스킵
      if (href.startsWith('http://') || href.startsWith('https://')) return;

      // 앵커 전용 링크(#...) 스킵
      if (href.startsWith('#')) return;

      const rewritten = rewriteHref(href, locale);
      if (rewritten) {
        node.properties = { ...node.properties, href: rewritten };
      }
    });
  };
}
