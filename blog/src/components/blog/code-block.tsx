/**
 * @file       code-block.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx, src/app/globals.css
 *
 * 코드 블록 래퍼 — 언어 라벨 + 복사 버튼을 제공하는 Client Component.
 * rehype-highlight가 <code class="hljs language-{lang}"> 형태로 주입한
 * className에서 언어를 추출하고, navigator.clipboard API로 복사 기능 제공.
 */
'use client';

import {
  type ReactElement,
  type ReactNode,
  isValidElement,
  useCallback,
  useState,
} from 'react';

/** 언어 표시명 매핑 (필요 시 확장) */
const LANG_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  jsx: 'JSX',
  bash: 'Bash',
  sh: 'Shell',
  shell: 'Shell',
  yaml: 'YAML',
  yml: 'YAML',
  json: 'JSON',
  python: 'Python',
  py: 'Python',
  sql: 'SQL',
  css: 'CSS',
  html: 'HTML',
  xml: 'XML',
  go: 'Go',
  rust: 'Rust',
  dockerfile: 'Dockerfile',
  plaintext: 'Text',
};

interface CodeBlockProps {
  children: ReactNode;
}

/** <code> 엘리먼트의 className에서 language-{lang}을 추출 */
function extractLanguage(children: ReactNode): string | null {
  if (!isValidElement(children)) return null;
  const el = children as ReactElement<{ className?: string }>;
  const className = el.props?.className ?? '';
  const match = className.match(/language-(\S+)/);
  return match ? match[1] : null;
}

/** <code> 엘리먼트의 텍스트 콘텐츠를 재귀적으로 추출 */
function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (isValidElement(node)) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    return extractText(el.props?.children);
  }
  return '';
}

export function CodeBlock({ children, ...rest }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lang = extractLanguage(children);
  const label = lang ? (LANG_LABELS[lang] ?? lang) : null;

  const handleCopy = useCallback(() => {
    const text = extractText(children);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [children]);

  return (
    <div className="code-block-wrapper group relative">
      {/* 상단 바: 언어 라벨 + 복사 버튼 */}
      {(label || true) && (
        <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-border bg-surface-muted px-4 py-1.5">
          <span className="text-xs font-semibold text-text-subtle">
            {label ?? ''}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="코드 복사"
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-text-muted transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {copied ? (
              <>
                <CheckIcon />
                <span>복사됨</span>
              </>
            ) : (
              <>
                <CopyIcon />
                <span>복사</span>
              </>
            )}
          </button>
        </div>
      )}
      <pre {...rest} className="!mt-0 !rounded-t-none">
        {children}
      </pre>
    </div>
  );
}

/** 복사 아이콘 (Lucide clipboard) */
function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

/** 체크 아이콘 (Lucide check) */
function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
