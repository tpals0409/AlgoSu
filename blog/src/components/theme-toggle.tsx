/**
 * @file       theme-toggle.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/app/layout.tsx, src/components/theme-provider.tsx, src/lib/i18n.ts
 *
 * 헤더에 배치되는 3-way 테마 토글 버튼 (system -> light -> dark -> system).
 * locale prop을 통해 aria-label 문자열을 ko/en 이중 언어로 지원한다.
 */
'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';

type ThemeMode = 'system' | 'light' | 'dark';

/** system -> light -> dark -> system 순환. */
const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

/** ThemeMode를 i18n DictKey에 매핑한다. */
const MODE_KEY: Record<ThemeMode, 'themeSystem' | 'themeLight' | 'themeDark'> = {
  system: 'themeSystem',
  light: 'themeLight',
  dark: 'themeDark',
};

interface ThemeToggleProps {
  locale?: Locale;
}

/** 3-way 테마 토글 버튼을 렌더링한다. */
export function ThemeToggle({ locale = 'ko' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // hydration 가드: mount 전에는 동일 크기의 placeholder만 출력.
  if (!mounted) {
    return (
      <span
        aria-hidden
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border"
      />
    );
  }

  const current: ThemeMode = theme === 'light' || theme === 'dark' ? theme : 'system';
  const next = NEXT_MODE[current];

  const currentLabel = t(locale, MODE_KEY[current]);
  const nextLabel = t(locale, MODE_KEY[next]);
  const prefix = t(locale, 'themeTogglePrefix');
  const suffix = t(locale, 'themeToggleSuffix');
  const action = t(locale, 'themeToggleAction');
  const label = `${prefix} ${currentLabel}${suffix} ${nextLabel}${action}`;

  const Icon = current === 'system' ? Monitor : current === 'dark' ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted hover:text-brand"
    >
      <Icon size={16} strokeWidth={2} />
    </button>
  );
}
