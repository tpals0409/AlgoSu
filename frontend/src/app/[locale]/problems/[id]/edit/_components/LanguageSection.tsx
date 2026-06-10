/**
 * @file 문제 수정 — 허용 언어 토글 섹션 컴포넌트
 * @domain problem
 * @layer component
 * @related edit/page.tsx, useLanguageToggle
 */

'use client';

import { useTranslations } from 'next-intl';
import { LANGUAGES } from '@/lib/constants';
import { labelClass } from '@/lib/problem-form-utils';

// ─── TYPES ───────────────────────────────

export interface LanguageSectionProps {
  readonly allowedLanguages: string[];
  readonly onToggle: (lang: string) => void;
  readonly disabled?: boolean;
}

// ─── COMPONENT ───────────────────────────

/**
 * 허용 언어 토글 버튼 목록
 * @domain problem
 */
export function LanguageSection({
  allowedLanguages,
  onToggle,
  disabled = false,
}: LanguageSectionProps) {
  const t = useTranslations('problems');

  return (
    <div className="flex flex-col">
      <span className={labelClass}>{t('form.allowedLanguages')}</span>
      <div className="flex flex-wrap gap-1.5">
        {LANGUAGES.map((lang) => {
          const selected = allowedLanguages.includes(lang.value);
          return (
            <button
              key={lang.value}
              type="button"
              onClick={() => onToggle(lang.value)}
              disabled={disabled}
              aria-pressed={selected}
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-badge border transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? 'bg-primary-soft text-primary border-primary/30'
                  : 'bg-transparent text-text-3 border-border line-through'
              }`}
            >
              {selected && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {lang.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
