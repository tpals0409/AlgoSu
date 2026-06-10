/**
 * @file 문제 수정 — 난이도/상태 섹션 컴포넌트
 * @domain problem
 * @layer component
 * @related edit/page.tsx, problem-form-utils
 */

'use client';

import type React from 'react';
import { useTranslations } from 'next-intl';
import {
  labelClass,
  selectClass,
} from '@/lib/problem-form-utils';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  PROBLEM_STATUSES,
  PROBLEM_STATUS_LABELS,
} from '@/lib/constants';

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

export interface StatusDifficultySectionProps {
  readonly form: EditFormState;
  readonly onChange: (
    field: keyof EditFormState,
  ) => React.ChangeEventHandler<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >;
  readonly disabled?: boolean;
  /** BOJ / 프로그래머스 검색 결과가 이미 적용된 경우 난이도 select를 잠금 */
  readonly searchApplied?: boolean;
}

// ─── COMPONENT ───────────────────────────

/**
 * 문제 난이도 + 진행 상태 선택 영역
 * @domain problem
 */
export function StatusDifficultySection({
  form,
  onChange,
  disabled = false,
  searchApplied = false,
}: StatusDifficultySectionProps) {
  const t = useTranslations('problems');

  return (
    <>
      <div className="flex flex-col">
        <label htmlFor="edit-difficulty" className={labelClass}>
          {t('form.difficultyLabel')}
        </label>
        <select
          id="edit-difficulty"
          value={form.difficulty}
          onChange={onChange('difficulty')}
          disabled={disabled || searchApplied}
          className={selectClass}
        >
          <option value="">{t('form.difficultyNone')}</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABELS[d]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col">
        <label htmlFor="edit-status" className={labelClass}>
          {t('edit.statusLabel')}
        </label>
        <select
          id="edit-status"
          value={form.status}
          onChange={onChange('status')}
          disabled={disabled}
          className={selectClass}
        >
          {PROBLEM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROBLEM_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
