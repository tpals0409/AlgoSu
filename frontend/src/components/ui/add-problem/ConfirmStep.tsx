/**
 * @file AddProblemModal Step 2 — deadline picker + preview + submit
 * @domain problem
 * @layer component
 * @related AddProblemModal, SearchStep, problem-search.utils, calendar
 *
 * Extracted from AddProblemModal.tsx (Sprint 242 Q-1 FE).
 * Validation rules and derived state preserved verbatim so the existing
 * integration tests (date pick → submit) continue to pass.
 */
import { useState } from 'react';
import { ArrowLeft, Plus, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Btn, DIFFICULTY_CONFIG } from '../AlgosuUI';
import { Calendar } from '../calendar';
import { PROGRAMMERS_LEVEL_LABELS } from '@/lib/constants';
import { getCurrentWeekLabel } from '@/lib/utils';
import {
  toOurDiff,
  isSqlProblem,
  resolveSourceUrl,
  resolveTierLabel,
  type Platform,
  type SolvedProblem,
} from './problem-search.utils';

/** Localized day-name keys, indexed by `Date#getDay()` */
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** Small field label — local to ConfirmStep (only consumer) */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>
      {children}
    </label>
  );
}

export interface ConfirmStepProps {
  problem: SolvedProblem;
  platform: Platform;
  onBack: () => void;
  onAdd: (weekNumber: string, deadline: string) => void;
  isAdding?: boolean;
  addError?: string | null;
}

/**
 * Step 2 of the Add Problem flow: confirm the selected problem and pick a
 * deadline. `weekNumber` is derived from `deadline` (backend regex expects
 * `N월M주차` — see Sprint 139), so the user never sees a week field.
 */
export function ConfirmStep({
  problem,
  platform,
  onBack,
  onAdd,
  isAdding,
  addError,
}: ConfirmStepProps) {
  const t = useTranslations('problems');
  const tErrors = useTranslations('errors');
  const [deadline, setDeadline] = useState('');
  const [errors, setErrors] = useState<{ deadline?: string }>({});

  const resolvedDiff = problem.difficulty ?? toOurDiff(problem.level).difficulty;
  const cfg = DIFFICULTY_CONFIG[resolvedDiff];
  const tierLabel = resolveTierLabel(platform, problem.level, PROGRAMMERS_LEVEL_LABELS);
  const tags = problem.tags.slice(0, 5);

  /** Derived `N월M주차` label for the dashboard regex */
  const weekNumber = deadline ? getCurrentWeekLabel(new Date(deadline)) : '';

  const deadlineDate = deadline ? new Date(deadline) : null;
  const selectedDateText = deadlineDate
    ? t('addModal.confirm.selectedDate', {
        month: deadlineDate.getMonth() + 1,
        day: deadlineDate.getDate(),
        dayName: t(`detail.dayNames.${DAY_KEYS[deadlineDate.getDay()]}`),
      })
    : '';

  /**
   * Validate the deadline:
   *  - required (deadlineRequired)
   *  - must not be in the past (deadlinePast)
   *
   * @returns true when the form is submittable
   */
  function validate(): boolean {
    const e: typeof errors = {};
    if (!deadline) {
      e.deadline = t('addModal.validation.deadlineRequired');
    } else if (new Date(deadline) < new Date()) {
      e.deadline = t('addModal.validation.deadlinePast');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleAdd() {
    if (!validate()) return;
    onAdd(weekNumber, deadline);
  }

  return (
    <div className="flex flex-col">
      {/* Back button row */}
      <div className="px-5 pt-4 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[12px] transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-3)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('addModal.confirm.back')}
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto px-5 pb-5" style={{ maxHeight: 'calc(100dvh - 260px)' }}>
        {/* Problem info card */}
        <div
          className="rounded-card border p-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {platform === 'PROGRAMMERS' ? 'PG' : 'BOJ'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
                {problem.titleKo}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 rounded-badge px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: cfg.bg, color: cfg.color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.color }} />
                  {tierLabel}
                </span>
                {/* SQL badge — confirm step */}
                {platform === 'PROGRAMMERS' && isSqlProblem(problem) && (
                  <span
                    className="rounded-badge px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
                  >
                    SQL
                  </span>
                )}
                <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                  #{problem.problemId}
                </span>
                {tags.map((tg) => (
                  <span
                    key={tg}
                    className="rounded-badge px-1.5 py-0.5 text-[10px]"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-3)' }}
                  >
                    {tg}
                  </span>
                ))}
              </div>
            </div>
            {/* External link */}
            <a
              href={resolveSourceUrl(platform, problem)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 rounded-btn p-1.5 transition-opacity hover:opacity-70"
              style={{ background: 'var(--bg-card)', color: 'var(--text-3)' }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Deadline (Calendar) */}
        <div className="space-y-1.5">
          <FieldLabel>{t('addModal.confirm.deadlineLabel')}</FieldLabel>
          <div
            className="rounded-btn border"
            style={{ borderColor: errors.deadline ? 'var(--error)' : 'var(--border)' }}
          >
            <Calendar
              mode="single"
              selected={deadline ? new Date(deadline) : undefined}
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
                setDeadline(iso);
                setErrors((er) => ({ ...er, deadline: undefined }));
              }}
              data-testid="add-problem-modal-calendar"
            />
          </div>
          {selectedDateText && (
            <p
              className="text-[12px] font-medium"
              style={{ color: 'var(--primary)' }}
              data-testid="add-problem-modal-selected-date"
            >
              {selectedDateText}
            </p>
          )}
          {weekNumber && (
            <p
              className="text-[11px]"
              style={{ color: 'var(--text-3)' }}
              data-testid="add-problem-modal-calculated-week"
            >
              {t('addModal.confirm.calculatedWeek', { week: weekNumber })}
            </p>
          )}
          {errors.deadline && (
            <p className="text-[11px]" style={{ color: 'var(--error)' }}>
              {tErrors(errors.deadline)}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-end gap-2 border-t px-5 py-3.5"
        style={{ borderColor: 'var(--border)' }}
      >
        <Btn variant="outline" size="md" onClick={onBack} disabled={isAdding}>
          {t('addModal.confirm.backButton')}
        </Btn>
        <Btn variant="primary" size="md" onClick={handleAdd} disabled={isAdding}>
          {isAdding ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {isAdding ? t('addModal.confirm.adding') : t('addModal.confirm.addButton')}
        </Btn>
      </div>
      {addError && (
        <div className="px-5 pb-3">
          <p className="text-[11px] font-medium" style={{ color: 'var(--error)' }}>
            <AlertCircle className="inline h-3 w-3 mr-1" />
            {addError}
          </p>
        </div>
      )}
    </div>
  );
}
