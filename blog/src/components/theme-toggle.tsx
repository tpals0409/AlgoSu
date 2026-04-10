/**
 * @file       theme-toggle.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/app/layout.tsx, src/components/theme-provider.tsx
 *
 * 헤더에 배치되는 라이트/다크 토글 버튼.
 * next-themes 표준 패턴의 mounted 가드로 hydration mismatch를 방지합니다
 * (SSR 시 시스템 테마를 모르기 때문에 초기 렌더에서는 placeholder 출력).
 * 아이콘은 lucide-react의 Sun/Moon, focus-visible ring은
 * Sprint 72의 전역 base layer(globals.css)가 자동 적용합니다.
 */
'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
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

  const isDark = resolvedTheme === 'dark';
  const nextLabel = isDark ? '라이트 모드로 전환' : '다크 모드로 전환';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={nextLabel}
      title={nextLabel}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-text-muted hover:text-brand"
    >
      {isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
    </button>
  );
}
