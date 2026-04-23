/**
 * @file Submission status 3-step progress component
 * @domain submission
 * @layer component
 * @related useSubmissionSSE, CodeEditor
 */
'use client';

/**
 * H14: Submission status component — design tokens + Lucide icons
 *
 * 3-step status:
 * 1. Submitted | GitHub syncing... | AI analysis pending...
 * 2. Submitted | GitHub synced | AI analyzing...
 * 3. Submitted | GitHub synced | AI analysis complete
 */

import { useTranslations } from 'next-intl';
import { Check, Loader2, Clock, XCircle } from 'lucide-react';

export type StepStatus = 'pending' | 'in_progress' | 'done' | 'failed';

interface StatusStep {
  label: string;
  status: StepStatus;
  detail?: string;
}

interface SubmissionStatusProps {
  steps: StatusStep[];
}

const statusConfig: Record<StepStatus, { icon: typeof Check; colorClass: string }> = {
  pending: { icon: Clock, colorClass: 'text-text-3' },
  in_progress: { icon: Loader2, colorClass: 'text-info' },
  done: { icon: Check, colorClass: 'text-success' },
  failed: { icon: XCircle, colorClass: 'text-error' },
};

export function SubmissionStatus({ steps }: SubmissionStatusProps) {
  const t = useTranslations('submissions');

  return (
    <div className="rounded-md border border-border bg-bg-card p-4 shadow">
      <h3 className="mb-3 text-sm font-semibold text-text">{t('progressStatus.heading')}</h3>
      <div className="flex items-center gap-2">
        {steps.map((step, idx) => {
          const { icon: Icon, colorClass } = statusConfig[step.status];
          return (
            <div key={step.label} className="flex items-center gap-2">
              {idx > 0 && (
                <div className="h-px w-8 bg-border" />
              )}
              <div className={`flex items-center gap-1.5 ${colorClass}`}>
                <Icon
                  size={16}
                  className={step.status === 'in_progress' ? 'animate-spin' : ''}
                  aria-hidden
                />
                <span className="text-sm">{step.label}</span>
              </div>
            </div>
          );
        })}
      </div>
      {steps.some((s) => s.status === 'failed') && (
        <div className="mt-2 text-sm text-error">
          {steps
            .filter((s) => s.status === 'failed')
            .map((s) => s.detail ?? t('progressStatus.failedFallback', { label: s.label }))
            .join(', ')}
        </div>
      )}
    </div>
  );
}
