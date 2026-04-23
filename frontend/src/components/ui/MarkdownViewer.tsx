/**
 * MarkdownViewer — styled markdown renderer based on react-markdown
 * @file MarkdownViewer.tsx
 * @domain ui
 * @layer component
 */
'use client';

import { createContext, useContext, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

/** List type Context for ul/ol differentiation */
const ListTypeCtx = createContext<'ul' | 'ol'>('ul');

function UlWrapper({ children }: { readonly children?: ReactNode }) {
  return (
    <ListTypeCtx.Provider value="ul">
      <ul className="mb-3 space-y-1.5 pl-0 list-none">{children}</ul>
    </ListTypeCtx.Provider>
  );
}

function OlWrapper({ children }: { readonly children?: ReactNode }) {
  return (
    <ListTypeCtx.Provider value="ol">
      <ol className="mb-3 space-y-1.5 pl-6 list-decimal marker:font-semibold" style={{ color: 'var(--text-2)' }}>
        {children}
      </ol>
    </ListTypeCtx.Provider>
  );
}

function LiItem({ children }: { readonly children?: ReactNode }) {
  const listType = useContext(ListTypeCtx);

  if (listType === 'ol') {
    return (
      <li className="text-[13px] leading-relaxed pl-1" style={{ color: 'var(--text-2)' }}>
        {children}
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2 text-[13px]" style={{ color: 'var(--text-2)' }}>
      <span
        className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: 'var(--accent)' }}
      />
      <span className="flex-1 leading-relaxed">{children}</span>
    </li>
  );
}

const components: Components = {
  h1: ({ children }) => (
    <h1
      className="mb-4 mt-0 border-b pb-3 text-[18px] font-bold"
      style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className="mb-3 mt-6 flex items-center gap-2 text-[14px] font-semibold first:mt-0"
      style={{ color: 'var(--primary)' }}
    >
      <span
        className="inline-block h-3.5 w-1 rounded-full shrink-0"
        style={{ background: 'var(--primary)' }}
      />
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className="mb-2 mt-4 text-[13px] font-semibold"
      style={{ color: 'var(--text)' }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p
      className="mb-2 text-[13px] leading-relaxed"
      style={{ color: 'var(--text-2)' }}
    >
      {children}
    </p>
  ),
  ul: UlWrapper as Components['ul'],
  ol: OlWrapper as Components['ol'],
  li: LiItem as Components['li'],
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: 'var(--text)' }}>
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic" style={{ color: 'var(--text-2)' }}>
      {children}
    </em>
  ),
  code: ({ children, className }) => {
    if (!className) {
      return (
        <code
          className="rounded px-1.5 py-0.5 font-mono text-[12px]"
          style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
        >
          {children}
        </code>
      );
    }
    return (
      <code className="font-mono text-[12px]" style={{ color: 'var(--text)' }}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre
      className="mb-3 overflow-x-auto rounded-card px-4 py-3 font-mono text-[12px] leading-relaxed"
      style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text)' }}
    >
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="mb-3 rounded-r-card border-l-[3px] pl-4 py-2 text-[13px] italic"
      style={{
        borderColor: 'var(--primary)',
        background: 'var(--primary-soft)',
        color: 'var(--text-2)',
      }}
    >
      {children}
    </blockquote>
  ),
  hr: () => (
    <hr className="my-5" style={{ borderColor: 'var(--border)' }} />
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 transition-opacity hover:opacity-70"
      style={{ color: 'var(--primary)' }}
    >
      {children}
    </a>
  ),
};

export function MarkdownViewer({ content, className = '' }: MarkdownViewerProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      <ReactMarkdown components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
