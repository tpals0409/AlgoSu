/**
 * @file 허용 언어 토글 커스텀 훅
 * @domain problem
 * @layer hook
 * @related ProblemCreatePage, ProblemEditPage
 */

'use client';

import { useCallback } from 'react';
import type { ProblemFormState } from '@/lib/problem-form-utils';

/**
 * 허용 언어 토글 핸들러
 * @domain problem
 */
export function useLanguageToggle(
  setForm: React.Dispatch<React.SetStateAction<ProblemFormState>>,
): (lang: string) => void {
  return useCallback(
    (lang: string) => {
      setForm((prev) => {
        const isSelected = prev.allowedLanguages.includes(lang);
        if (isSelected && prev.allowedLanguages.length <= 1) return prev;
        return {
          ...prev,
          allowedLanguages: isSelected
            ? prev.allowedLanguages.filter((l) => l !== lang)
            : [...prev.allowedLanguages, lang],
        };
      });
    },
    [setForm],
  );
}
