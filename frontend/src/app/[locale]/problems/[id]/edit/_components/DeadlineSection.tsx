/**
 * @file 문제 수정 — 마감일 선택 섹션 컴포넌트
 * @domain problem
 * @layer component
 * @related edit/page.tsx, Calendar, problem-form-utils
 */

'use client';

import type React from 'react';
import { useTranslations } from 'next-intl';
import { Calendar } from '@/components/ui/calendar';
import { type ProblemFormErrors, labelClass } from '@/lib/problem-form-utils';
import { getCurrentWeekLabel } from '@/lib/utils';

// ─── TYPES ───────────────────────────────

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

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

export interface DeadlineSectionProps {
  readonly form: EditFormState;
  readonly onChange?: (
    field: keyof EditFormState,
  ) => React.ChangeEventHandler<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >;
  readonly fieldErrors: ProblemFormErrors;
  readonly onDateSelect: (iso: string) => void;
  readonly disabled?: boolean;
}

// ─── COMPONENT ───────────────────────────

/**
 * 문제 마감일 달력 선택 + 계산 주차 표시
 * @domain problem
 */
export function DeadlineSection({
  form,
  fieldErrors,
  onDateSelect,
}: DeadlineSectionProps) {
  const t = useTranslations('problems');
  const tErrors = useTranslations('errors');

  const deadlineDate = form.deadline ? new Date(form.deadline) : null;
  const selectedDateText = deadlineDate
    ? t('form.selectedDate', {
        month: deadlineDate.getMonth() + 1,
        day: deadlineDate.getDate(),
        dayName: t(`detail.dayNames.${DAY_KEYS[deadlineDate.getDay()]}`),
      })
    : '';

  return (
    <div className="flex flex-col">
      <label className={labelClass}>
        {t('form.deadlineLabel')}{' '}
        <span className="text-error text-[11px]">{t('form.required')}</span>
      </label>
      <Calendar
        mode="single"
        selected={form.deadline ? new Date(form.deadline) : undefined}
        onSelect={(date) => {
          const iso = date
            ? new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
                23,
                59,
                59,
              ).toISOString()
            : '';
          onDateSelect(iso);
        }}
        className={`rounded-badge border bg-input-bg ${
          fieldErrors.deadline ? 'border-error' : 'border-border'
        }`}
      />
      {selectedDateText && (
        <p
          className="mt-2 text-[12px] font-medium text-primary"
          data-testid="edit-selected-date"
        >
          {selectedDateText}
        </p>
      )}
      {form.deadline && (
        <p
          className="mt-1 text-[11px] text-text-3"
          data-testid="edit-calculated-week"
        >
          {t('form.calculatedWeek', {
            week: getCurrentWeekLabel(new Date(form.deadline)),
          })}
        </p>
      )}
      {fieldErrors.deadline && (
        <p className="mt-1 text-[11px] text-error">
          {tErrors(fieldErrors.deadline)}
        </p>
      )}
    </div>
  );
}
