/**
 * @file Tailwind CSS v2 디자인 시스템 설정
 * @domain common
 * @layer config
 *
 * 47개 컬러 토큰을 CSS 변수로 매핑.
 * 듀얼 테마(light/dark)는 globals.css :root/.dark에서 정의.
 */

import type { Config } from 'tailwindcss';
import animatePlugin from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── 배경/서피스 ── */
        bg: {
          DEFAULT: 'var(--bg)',
          alt: 'var(--bg-alt)',
          card: 'var(--bg-card)',
        },
        border: {
          DEFAULT: 'var(--border)',
          hover: 'var(--border-hover)',
        },

        /* ── 텍스트 ── */
        text: {
          DEFAULT: 'var(--text)',
          2: 'var(--text2)',
          3: 'var(--text3)',
        },

        /* ── 브랜드 ── */
        primary: {
          DEFAULT: 'var(--primary)',
          light: 'var(--primary-light)',
          soft: 'var(--primary-soft)',
          soft2: 'var(--primary-soft2)',
        },
        accent: 'var(--accent)',

        /* ── 상태 ── */
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
        },
        error: {
          DEFAULT: 'var(--error)',
          soft: 'var(--error-soft)',
        },
        info: {
          DEFAULT: 'var(--info)',
          soft: 'var(--info-soft)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          soft: 'var(--muted-soft)',
        },

        /* ── 특수 배경 ── */
        'nav-bg': 'var(--nav-bg)',
        'code-bg': 'var(--code-bg)',
        'input-bg': 'var(--input-bg)',

        /* ── 난이도 (solved.ac 6티어) ── */
        diff: {
          'bronze':          'var(--diff-bronze-color)',
          'bronze-bg':       'var(--diff-bronze-bg)',
          'bronze-border':   'var(--diff-bronze-border)',
          'silver':          'var(--diff-silver-color)',
          'silver-bg':       'var(--diff-silver-bg)',
          'silver-border':   'var(--diff-silver-border)',
          'gold':            'var(--diff-gold-color)',
          'gold-bg':         'var(--diff-gold-bg)',
          'gold-border':     'var(--diff-gold-border)',
          'platinum':        'var(--diff-platinum-color)',
          'platinum-bg':     'var(--diff-platinum-bg)',
          'platinum-border': 'var(--diff-platinum-border)',
          'diamond':         'var(--diff-diamond-color)',
          'diamond-bg':      'var(--diff-diamond-bg)',
          'diamond-border':  'var(--diff-diamond-border)',
          'ruby':            'var(--diff-ruby-color)',
          'ruby-bg':         'var(--diff-ruby-bg)',
          'ruby-border':     'var(--diff-ruby-border)',
        },
      },

      fontFamily: {
        heading: ['var(--font-sora)', 'Sora', 'sans-serif'],
        body:    ['var(--font-noto)', 'Noto Sans KR', 'sans-serif'],
        sans:    ['var(--font-sora)', 'var(--font-noto)', 'sans-serif'],
        mono:    ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
      },

      borderRadius: {
        sm:      'var(--radius-s)',
        md:      'var(--radius-m)',
        lg:      'var(--radius-l)',
        full:    '9999px',
        DEFAULT: 'var(--radius-m)',
        card:    '14px',
        btn:     '10px',
        badge:   '6px',
      },

      boxShadow: {
        DEFAULT:      'var(--shadow)',
        card:         'var(--shadow)',
        'card-hover': 'var(--shadow-hover)',
        hover:        'var(--shadow-hover)',
        modal:        'var(--shadow-hover)',
        toast:        'var(--shadow-toast)',
        glow:         'var(--shadow-glow)',
      },

      keyframes: {
        'skeleton-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-out-right': {
          from: { opacity: '1', transform: 'translateX(0)' },
          to: { opacity: '0', transform: 'translateX(24px)' },
        },
        shrink: {
          from: { width: '100%' },
          to: { width: '0%' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        shake: {
          '0%, 100%':      { transform: 'translateX(0)' },
          '10%, 50%, 90%': { transform: 'translateX(-4px)' },
          '30%, 70%':      { transform: 'translateX(4px)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'skeleton-shimmer': 'skeleton-shimmer 1.6s linear infinite',
        'fade-in':          'fade-in 0.5s cubic-bezier(0.16,1,0.3,1)',
        'fade-in-right':    'fade-in-right 0.3s cubic-bezier(0.16,1,0.3,1)',
        'fade-out-right':   'fade-out-right 0.3s cubic-bezier(0.16,1,0.3,1)',
        shrink:             'shrink var(--toast-duration, 5000ms) linear forwards',
        'pulse-dot':        'pulse-dot 1.5s infinite',
        shake:              'shake 0.5s ease-in-out',
        'spin-slow':        'spin-slow 1.2s linear infinite',
      },

      transitionTimingFunction: {
        bounce: 'cubic-bezier(0.16,1,0.3,1)',
      },

      maxWidth: {
        container: '1120px',
        'container-wide': '1200px',
      },
    },
  },
  plugins: [animatePlugin],
};

export default config;
