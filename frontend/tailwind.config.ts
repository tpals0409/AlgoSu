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
        /* ── 브랜드 ── */
        main: {
          DEFAULT: 'var(--color-main)',       // #947EB0
          light: 'var(--color-main-light)',    // #B9A9D0
          dark: 'var(--color-main-dark)',      // #6D5A8A
        },
        sub: {
          DEFAULT: 'var(--color-sub)',         // #A3A5C3
          light: 'var(--color-sub-light)',     // #C5C7DC
        },
        accent: 'var(--color-accent)',         // #D4BBFF

        /* ── primary 스케일 (보라 계열) ── */
        'primary-50':  '#F5F2FB',
        'primary-100': '#EBE4F6',
        'primary-200': '#D4BBFF',
        'primary-300': '#B9A9D0',
        'primary-400': '#A38CC0',
        'primary-500': '#947EB0',
        'primary-600': '#7D6A98',
        'primary-700': '#6D5A8A',
        'primary-800': '#4E4068',
        'primary-900': '#302846',

        /* ── error 스케일 ── */
        'error-50':  '#FFF2F1',
        'error-100': '#FFE0DE',
        'error-200': '#FFBBB8',
        'error-300': '#FF8F8A',
        'error-400': '#FF6E68',
        'error-500': '#FF5A50',
        'error-600': '#E04540',
        'error-700': '#C43530',
        'error-800': '#8C2420',
        'error-900': '#5C1512',

        /* ── 배경/서피스 ── */
        bg2: 'var(--bg2)',
        bg3: 'var(--bg3)',
        surface: 'var(--surface)',

        /* ── 텍스트 색상 ── */
        text1: 'var(--text)',
        text2: 'var(--text2)',
        text3: 'var(--text3)',

        /* ── shadcn 시멘틱 ── */
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',

        /* ── 상태 색상 ── */
        success: {
          DEFAULT: 'var(--color-success)',
          foreground: 'var(--color-success-foreground)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          foreground: 'var(--color-warning-foreground)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          foreground: 'var(--color-error-foreground)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          foreground: 'var(--color-info-foreground)',
        },

        /* ── 난이도 (BOJ 스타일) ── */
        difficulty: {
          bronze:   'var(--color-difficulty-bronze)',
          silver:   'var(--color-difficulty-silver)',
          gold:     'var(--color-difficulty-gold)',
          platinum: 'var(--color-difficulty-platinum)',
          diamond:  'var(--color-difficulty-diamond)',
        },
      },

      fontFamily: {
        sans: ['Sora', 'Noto Sans KR', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },

      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '18px',
        full: '9999px',
        DEFAULT: '12px',
        card: '12px',
        btn: '6px',
      },

      boxShadow: {
        light: 'var(--shadow-light)',
        medium: 'var(--shadow-medium)',
        card: 'var(--shadow-light)',
        modal: 'var(--shadow-medium)',
      },

      keyframes: {
        'skeleton-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 50%, 90%': { transform: 'translateX(-4px)' },
          '30%, 70%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        'skeleton-shimmer': 'skeleton-shimmer 1.6s linear infinite',
        'spin-slow': 'spin-slow 1.2s linear infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        shake: 'shake 0.5s ease-in-out',
      },
    },
  },
  plugins: [animatePlugin],
};

export default config;
