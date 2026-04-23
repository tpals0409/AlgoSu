/**
 * @file Syntax highlighted code block
 * @domain ui
 * @layer component
 * @related CodePanel, analysis/page
 *
 * Based on react-syntax-highlighter (Prism).
 * Automatic light/dark theme switching.
 */

'use client';

import { useTheme } from 'next-themes';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneLight,
  oneDark,
} from 'react-syntax-highlighter/dist/cjs/styles/prism';
import type { ReactElement } from 'react';

// ─── LANGUAGE MAP ────────────────────────

const LANG_MAP: Record<string, string> = {
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  javascript: 'javascript',
  typescript: 'typescript',
  go: 'go',
  rust: 'rust',
  kotlin: 'kotlin',
  swift: 'swift',
  ruby: 'ruby',
  csharp: 'csharp',
  sql: 'sql',
};

// ─── PROPS ───────────────────────────────

interface CodeBlockProps {
  readonly code: string;
  readonly language: string;
  readonly highlightLines?: Set<number>;
  readonly highlightColor?: 'success' | 'warning' | 'error';
}

// ─── HIGHLIGHT COLORS (CSS variable references) ────────────────────

const HL_BG: Record<string, string> = {
  success: 'var(--hl-success-bg)',
  warning: 'var(--hl-warning-bg)',
  error: 'var(--hl-error-bg)',
};

const HL_BORDER: Record<string, string> = {
  success: 'var(--hl-success-border)',
  warning: 'var(--hl-warning-border)',
  error: 'var(--hl-error-border)',
};

// ─── RENDER ──────────────────────────────

export function CodeBlock({
  code,
  language,
  highlightLines,
  highlightColor = 'success',
}: CodeBlockProps): ReactElement {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const style = isDark ? oneDark : oneLight;
  const prismLang = LANG_MAP[language.toLowerCase()] ?? 'text';

  return (
    <SyntaxHighlighter
      language={prismLang}
      style={style}
      showLineNumbers
      wrapLines
      lineNumberStyle={{
        minWidth: '40px',
        paddingRight: '12px',
        textAlign: 'right',
        opacity: 0.4,
        fontSize: '12px',
        userSelect: 'none',
      }}
      lineProps={(lineNumber: number) => {
        const isHL = highlightLines?.has(lineNumber);
        return {
          style: {
            display: 'block',
            backgroundColor: isHL ? HL_BG[highlightColor] : undefined,
            borderLeft: isHL ? `3px solid ${HL_BORDER[highlightColor]}` : '3px solid transparent',
            paddingLeft: isHL ? '4px' : '7px',
          },
        };
      }}
      customStyle={{
        margin: 0,
        padding: '14px 0',
        fontSize: '13px',
        lineHeight: '22px',
        borderRadius: 0,
        background: 'var(--code-block-bg)',
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
}
