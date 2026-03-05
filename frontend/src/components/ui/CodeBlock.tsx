/**
 * @file Syntax Highlighted 코드 블록
 * @domain ui
 * @layer component
 * @related CodePanel, analysis/page
 *
 * react-syntax-highlighter (Prism) 기반.
 * 라이트/다크 테마 자동 전환.
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
};

// ─── PROPS ───────────────────────────────

interface CodeBlockProps {
  readonly code: string;
  readonly language: string;
  readonly highlightLines?: Set<number>;
  readonly highlightColor?: 'success' | 'warning' | 'error';
}

// ─── HIGHLIGHT COLORS ────────────────────

const HL_BG: Record<string, Record<string, string>> = {
  light: {
    success: 'rgba(34, 197, 94, 0.12)',
    warning: 'rgba(234, 179, 8, 0.12)',
    error: 'rgba(239, 68, 68, 0.12)',
  },
  dark: {
    success: 'rgba(34, 197, 94, 0.15)',
    warning: 'rgba(234, 179, 8, 0.15)',
    error: 'rgba(239, 68, 68, 0.15)',
  },
};

const HL_BORDER: Record<string, string> = {
  success: 'rgb(34, 197, 94)',
  warning: 'rgb(234, 179, 8)',
  error: 'rgb(239, 68, 68)',
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
        const themeKey = isDark ? 'dark' : 'light';
        return {
          style: {
            display: 'block',
            backgroundColor: isHL ? HL_BG[themeKey][highlightColor] : undefined,
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
        background: isDark ? '#14141A' : '#F7F5F2',
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
}
