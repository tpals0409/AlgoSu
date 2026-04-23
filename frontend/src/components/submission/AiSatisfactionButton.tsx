/**
 * @file AI analysis satisfaction rating button
 * @domain submission
 * @layer component
 * @related submissionApi, analysis/page
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';
import { submissionApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { eventTracker } from '@/lib/event-tracker';

interface AiSatisfactionButtonProps {
  submissionId: string;
}

export function AiSatisfactionButton({ submissionId }: AiSatisfactionButtonProps) {
  const t = useTranslations('submissions');
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ up: number; down: number } | null>(null);

  useEffect(() => {
    submissionApi
      .getSatisfaction(submissionId)
      .then((res) => {
        if (res?.rating === 1 || res?.rating === -1) setRating(res.rating);
      })
      .catch(() => {
        /* silent — ignore when no rating exists */
      });
    submissionApi
      .getSatisfactionStats(submissionId)
      .then(setStats)
      .catch(() => {
        /* silent */
      });
  }, [submissionId]);

  const handleRate = useCallback(
    async (value: 1 | -1) => {
      setLoading(true);
      try {
        await submissionApi.rateSatisfaction(submissionId, { rating: value });
        setRating(value);
        eventTracker?.track('satisfaction:rate', { meta: { rating: value } });
        // refresh stats
        submissionApi.getSatisfactionStats(submissionId).then(setStats).catch(() => {});
        toast(t('aiSatisfaction.thankYou'));
      } catch {
        toast.error(t('aiSatisfaction.saveFailed'));
      } finally {
        setLoading(false);
      }
    },
    [submissionId, t],
  );

  return (
    <div
      className="flex items-center gap-3 mt-4 pt-4"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <span className="text-[13px] text-text-3">{t('aiSatisfaction.question')}</span>
      <button
        type="button"
        onClick={() => handleRate(1)}
        className={cn(
          'flex items-center gap-1 rounded-btn px-3 py-1.5 text-[12px] font-medium transition-colors',
          rating === 1
            ? 'bg-success/10 text-success'
            : 'text-text-3 hover:bg-bg-alt hover:text-text-2',
        )}
        disabled={loading}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        {t('aiSatisfaction.like')}
        {stats && stats.up > 0 && (
          <span className="ml-0.5 text-[11px] opacity-70">{stats.up}</span>
        )}
      </button>
      <button
        type="button"
        onClick={() => handleRate(-1)}
        className={cn(
          'flex items-center gap-1 rounded-btn px-3 py-1.5 text-[12px] font-medium transition-colors',
          rating === -1
            ? 'bg-error/10 text-error'
            : 'text-text-3 hover:bg-bg-alt hover:text-text-2',
        )}
        disabled={loading}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
        {t('aiSatisfaction.dislike')}
        {stats && stats.down > 0 && (
          <span className="ml-0.5 text-[11px] opacity-70">{stats.down}</span>
        )}
      </button>
    </div>
  );
}
