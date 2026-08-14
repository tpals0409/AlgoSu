/**
 * @file       toc.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/post-page.tsx, src/lib/mdx.ts
 *
 * 글 상세 우측 sticky 목차(TOC) — 본문 markdown 원문에서 H2/H3를 파싱해
 * 앵커 리스트를 렌더한다. slug는 github-slugger로 산출하며, 이는 본문 렌더에
 * 적용된 rehype-slug와 동일 엔진이라 heading id와 정확히 일치한다.
 * 스크롤 스파이(현재 섹션 하이라이트)는 IntersectionObserver로 구현하되,
 * 정적 export(output: export) 환경에서 안전하도록 client component로 격리한다.
 */
'use client';

import { useEffect, useState } from 'react';
import GithubSlugger from 'github-slugger';

/** TOC 항목 — heading depth(2=H2, 3=H3)와 표시 텍스트, 앵커 slug. */
interface TocItem {
  depth: 2 | 3;
  text: string;
  slug: string;
}

interface TocProps {
  /** 글 본문 markdown 원문(frontmatter 제거된 content). */
  content: string;
  /** 목차 접근성 라벨(locale별 문자열). */
  label: string;
}

/**
 * markdown 원문에서 코드펜스 밖의 H2/H3만 추출한다.
 * ```로 열리고 닫히는 펜스 내부 라인은 heading으로 오판하지 않도록 스킵한다.
 */
function parseHeadings(content: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  let inFence = false;

  for (const line of content.split('\n')) {
    const fence = line.trimStart().match(/^(```|~~~)/);
    if (fence) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!heading) continue;

    const depth = heading[1].length as 2 | 3;
    // 인라인 마크다운(강조·코드·링크) 기호를 제거해 표시 텍스트를 정제한다.
    const text = heading[2]
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .trim();

    // rehype-slug는 렌더된 텍스트 콘텐츠(마크다운 기호 제거 후)로 id를 만든다.
    // 따라서 정제된 text로 slug를 산출해야 인라인 링크/코드 heading에서도 앵커가 일치한다.
    items.push({ depth, text, slug: slugger.slug(text) });
  }

  return items;
}

/** 우측 sticky 목차를 렌더한다. heading 2개 미만이면 빈 레일 방지로 null 반환. */
export function Toc({ content, label }: TocProps) {
  const items = parseHeadings(content);
  const [activeSlug, setActiveSlug] = useState<string>('');

  useEffect(() => {
    if (items.length < 2) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveSlug(visible[0].target.id);
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );

    const targets = items
      .map((item) => document.getElementById(item.slug))
      .filter((el): el is HTMLElement => el !== null);
    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  return (
    <nav
      aria-label={label}
      className="sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-y-auto text-sm lg:block"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-text-subtle">
        {label}
      </p>
      <ul className="space-y-2 border-l border-border">
        {items.map((item) => {
          const isActive = item.slug === activeSlug;
          return (
            <li
              key={item.slug}
              className={item.depth === 3 ? 'pl-7' : 'pl-4'}
            >
              <a
                href={`#${item.slug}`}
                aria-current={isActive ? 'location' : undefined}
                className={
                  isActive
                    ? '-ml-px block border-l-2 border-brand pl-3 font-medium text-brand transition-colors'
                    : '-ml-px block border-l-2 border-transparent pl-3 text-text-muted transition-colors hover:text-brand'
                }
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
