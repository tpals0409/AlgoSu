/**
 * @file 문제 수정 — 기본 정보 섹션 컴포넌트 (제목/설명/카테고리)
 * @domain problem
 * @layer component
 * @related edit/page.tsx, problem-form-utils
 */

'use client';

import type React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import {
  type ProblemFormErrors,
  labelClass,
  selectClass,
  textareaClass,
} from '@/lib/problem-form-utils';
import { PROBLEM_CATEGORIES } from '@/lib/constants';

// ─── TYPES ───────────────────────────────

interface EditFormState {
  title: string;
  description: string;
  difficulty: string;
  deadline: string;
  allowedLanguages: string[];
  sourceUrl: string;
  sourcePlatform: string;
  category: string;
  status: string;
}

export interface BasicInfoSectionProps {
  readonly form: EditFormState;
  readonly onChange: (
    field: keyof EditFormState,
  ) => React.ChangeEventHandler<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >;
  readonly fieldErrors: ProblemFormErrors;
  readonly disabled?: boolean;
  /** 플랫폼 검색 결과 적용 시 제목 필드 잠금 (category는 잠금 안 함) */
  readonly searchApplied?: boolean;
}

// ─── COMPONENT ───────────────────────────

/**
 * 문제 제목, 설명, 카테고리 입력 영역
 * @domain problem
 */
export function BasicInfoSection({
  form,
  onChange,
  fieldErrors,
  disabled = false,
  searchApplied = false,
}: BasicInfoSectionProps) {
  const t = useTranslations('problems');
  const tErrors = useTranslations('errors');

  return (
    <>
      <Input
        label={t('edit.titleLabel')}
        value={form.title}
        onChange={onChange('title')}
        error={fieldErrors.title ? tErrors(fieldErrors.title) : undefined}
        disabled={disabled || searchApplied}
      />

      <div className="flex flex-col">
        <label htmlFor="edit-description" className={labelClass}>
          {t('form.descriptionLabel')}
        </label>
        <textarea
          id="edit-description"
          value={form.description}
          onChange={onChange('description')}
          disabled={disabled}
          rows={4}
          className={textareaClass}
        />
      </div>

      <div className="flex flex-col">
        <label htmlFor="edit-category" className={labelClass}>
          {t('form.categoryLabel')}
        </label>
        <select
          id="edit-category"
          value={form.category}
          onChange={onChange('category')}
          disabled={disabled}
          className={selectClass}
        >
          {PROBLEM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`form.category.${c}`)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
