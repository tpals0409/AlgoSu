/**
 * @file       theme-toggle.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/app/layout.tsx, src/components/theme-provider.tsx
 *
 * 헤더에 배치되는 3-way 테마 토글 버튼 (system → light → dark → system).
 *
 * Sprint 73-6은 light↔dark 2-way만 지원해서, 사용자가 한 번이라도 토글을
 * 누르면 localStorage에 선택이 고정되어 OS 테마 변화를 더 이상 추적하지
 * 못했다. Sprint 74-3에서는 순환에 `system` 단계를 추가해 OS 추적 모드로
 * 복귀할 수 있는 경로를 복원한다.
 *
 * - `theme` (사용자 선택)을 기준으로 아이콘/라벨을 결정. SSR 시에는 값이
 *   undefined이므로 mounted 가드를 통해 placeholder만 출력하여 hydration
 *   mismatch를 방지한다.
 * - 아이콘은 lucide-react의 Monitor/Sun/Moon 3종이며, lucide-react는 이미
 *   Sprint 73-6에서 번들에 포함되어 의존성 추가는 없다.
 * - focus-visible ring은 Sprint 72의 전역 base layer(globals.css)가 자동
 *   적용한다.
 */
'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

type ThemeMode = 'system' | 'light' | 'dark';

/** system → light → dark → system 순환. */
const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

const MODE_LABEL: Record<ThemeMode, string> = {
  system: '시스템 추적',
  light: '라이트 모드',
  dark: '다크 모드',
};

export function ThemeToggle() {
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
  const label = `현재: ${MODE_LABEL[current]}, 클릭하면 ${MODE_LABEL[next]}로 전환`;

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
