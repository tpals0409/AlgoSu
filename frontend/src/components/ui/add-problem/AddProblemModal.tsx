/**
 * @file Add Problem modal — orchestrates SearchStep ↔ ConfirmStep
 * @domain problem
 * @layer component
 * @related SearchStep, ConfirmStep, problem-search.utils, problemApi, studyApi
 *
 * Refactored from a single 800-line component (Sprint 242 Q-1 FE).
 * This file now owns only the step machine + create-submission lifecycle;
 * search UI lives in {@link SearchStep}, confirm UI in {@link ConfirmStep},
 * and pure logic in `problem-search.utils.ts`.
 */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type Difficulty } from '../AlgosuUI';
import { problemApi, studyApi } from '@/lib/api';
import { useStudy } from '@/contexts/StudyContext';
import { SearchStep } from './SearchStep';
import { ConfirmStep } from './ConfirmStep';
import {
  buildCreatePayload,
  searchSolvedAC,
  searchProgrammers,
  type NewProblemData,
  type Platform,
  type SolvedProblem,
} from './problem-search.utils';

export type { NewProblemData, SolvedProblem, Platform } from './problem-search.utils';

type Step = 'search' | 'confirm';

interface AddProblemModalProps {
  open: boolean;
  onClose: () => void;
  onAdd?: (problem: NewProblemData) => void;
}

/**
 * Modal that adds a problem to the active study.
 *
 * Step machine: `search` → `confirm` → (on submit) callback + close.
 * Platform selection is owned here so it survives the search/confirm
 * transition; per-step UI state lives inside the child components.
 */
export function AddProblemModal({ open, onClose, onAdd: onAddCallback }: AddProblemModalProps) {
  const t = useTranslations('problems');
  const [step, setStep] = useState<Step>('search');
  const [selected, setSelected] = useState<SolvedProblem | null>(null);
  const [platform, setPlatform] = useState<Platform>('PROGRAMMERS');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const { currentStudyId } = useStudy();

  /** Reset the modal back to its initial state and close */
  function handleClose() {
    setStep('search');
    setSelected(null);
    setAddError(null);
    onClose();
  }

  function handleSelect(p: SolvedProblem) {
    setSelected(p);
    setStep('confirm');
  }

  /**
   * Submit the create request, fire the parent callback, and close.
   *
   * `studyApi.notifyProblemCreated` is fire-and-forget — its failure
   * never blocks the success path (mirrors the pre-refactor behavior).
   */
  async function handleAdd(weekNumber: string, deadline: string) {
    if (!selected || isAdding) return;

    setIsAdding(true);
    setAddError(null);

    try {
      const data = buildCreatePayload({ problem: selected, platform, weekNumber, deadline });
      const created = await problemApi.create(data);

      if (currentStudyId) {
        void studyApi
          .notifyProblemCreated(currentStudyId, {
            problemId: created.id,
            problemTitle: created.title,
            weekNumber,
          })
          .catch(() => {});
      }

      onAddCallback?.({
        id: created.id,
        title: created.title,
        difficulty: created.difficulty as Difficulty,
        level: created.level ?? data.level,
        weekNumber: created.weekNumber,
        status: 'ACTIVE' as const,
        deadline: created.deadline,
        tags: created.tags ?? data.tags,
        sourceUrl: created.sourceUrl ?? data.sourceUrl ?? '',
        sourcePlatform: created.sourcePlatform ?? platform,
        description: created.description ?? '',
      });
      handleClose();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : t('addModal.error.addFailed'));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && handleClose()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}
        />

        {/* Panel */}
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-card outline-none overflow-hidden"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between border-b px-5 py-4"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2.5">
              {/* Platform icon */}
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md text-[9px] font-black"
                style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}
              >
                {platform === 'PROGRAMMERS' ? 'PG' : 'BOJ'}
              </div>
              <div>
                <Dialog.Title
                  className="text-[14px] font-semibold"
                  style={{ color: 'var(--text)' }}
                >
                  {step === 'search'
                    ? (platform === 'BOJ'
                        ? t('addModal.header.searchTitleBoj')
                        : t('addModal.header.searchTitleProgrammers'))
                    : t('addModal.header.confirmTitle')}
                </Dialog.Title>
                <Dialog.Description className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                  {step === 'search'
                    ? t('addModal.header.searchDescription')
                    : t('addModal.header.confirmDescription')}
                </Dialog.Description>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {(['search', 'confirm'] as Step[]).map((s) => (
                  <div
                    key={s}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: step === s ? '20px' : '6px',
                      background: step === s ? 'var(--primary)' : 'var(--border)',
                    }}
                  />
                ))}
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-btn transition-opacity hover:opacity-70"
                  style={{ background: 'var(--bg-alt)', color: 'var(--text-3)' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          {step === 'search' && (
            <SearchStep
              onSelect={handleSelect}
              platform={platform}
              searchFn={platform === 'BOJ' ? searchSolvedAC : searchProgrammers}
              onPlatformChange={(p) => { setPlatform(p); }}
            />
          )}
          {step === 'confirm' && selected && (
            <ConfirmStep
              problem={selected}
              platform={platform}
              onBack={() => setStep('search')}
              onAdd={(w, d) => void handleAdd(w, d)}
              isAdding={isAdding}
              addError={addError}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
