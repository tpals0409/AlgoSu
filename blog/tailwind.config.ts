/**
 * @file       tailwind.config.ts
 * @domain     blog
 * @layer      design-system
 * @related    src/app/globals.css, src/components/blog/*
 *
 * 디자인 토큰은 globals.css의 CSS variable에서 정의하고,
 * 여기서는 Tailwind colors 매핑만 담당합니다.
 */
import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // 표면/보더/텍스트
        surface: 'var(--surface)',
        'surface-muted': 'var(--surface-muted)',
        'surface-elevated': 'var(--surface-elevated)',
        'diagram-bg': 'var(--diagram-bg)',
        'diagram-grid': 'var(--diagram-grid)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-subtle': 'var(--text-subtle)',

        // 브랜드 (기존 brand-50/500/700/900 호환 유지)
        brand: {
          DEFAULT: 'var(--brand)',
          strong: 'var(--brand-strong)',
          soft: 'var(--brand-soft)',
          50: '#eef2ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        },

        // Callout 4종
        'callout-info': {
          bg: 'var(--callout-info-bg)',
          border: 'var(--callout-info-border)',
          fg: 'var(--callout-info-fg)',
        },
        'callout-warn': {
          bg: 'var(--callout-warn-bg)',
          border: 'var(--callout-warn-border)',
          fg: 'var(--callout-warn-fg)',
        },
        'callout-success': {
          bg: 'var(--callout-success-bg)',
          border: 'var(--callout-success-border)',
          fg: 'var(--callout-success-fg)',
        },
        'callout-danger': {
          bg: 'var(--callout-danger-bg)',
          border: 'var(--callout-danger-border)',
          fg: 'var(--callout-danger-fg)',
        },

        // Accent 6색 (Pipeline/ServiceGrid 등에서 stage별 색 구분)
        accent: {
          1: 'var(--accent-1)',
          2: 'var(--accent-2)',
          3: 'var(--accent-3)',
          4: 'var(--accent-4)',
          5: 'var(--accent-5)',
          6: 'var(--accent-6)',
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
