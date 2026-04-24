/**
 * @file 피드백 폼 (일반/기능요청/UX 개선)
 * @domain feedback
 * @layer component
 * @related FeedbackWidget, feedbackSchema
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { feedbackSchema, type FeedbackFormData, type FeedbackCategory } from '@/lib/schemas/feedback';
import { feedbackApi } from '@/lib/api';
import { useStudy } from '@/contexts/StudyContext';
import { eventTracker } from '@/lib/event-tracker';

interface FeedbackFormProps {
  readonly onSuccess?: () => void;
}

export function FeedbackForm({ onSuccess }: FeedbackFormProps) {
  const t = useTranslations('feedback');
  const tErrors = useTranslations('errors');
  const { currentStudyId } = useStudy();
  const [submitting, setSubmitting] = useState(false);

  const categoryOptions: { value: FeedbackCategory; label: string }[] = [
    { value: 'GENERAL', label: t('feedbackForm.categoryGeneral') },
    { value: 'FEATURE', label: t('feedbackForm.categoryFeature') },
    { value: 'UX', label: t('feedbackForm.categoryUx') },
  ];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      category: 'GENERAL',
      content: '',
    },
  });

  const selectedCategory = watch('category');

  const onSubmit = async (data: FeedbackFormData) => {
    setSubmitting(true);
    try {
      await feedbackApi.create({
        ...data,
        studyId: currentStudyId ?? undefined,
        pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      });
      eventTracker?.track('feedback:submit', { meta: { category: data.category } });
      toast.success(t('feedbackForm.submitSuccess'));
      reset();
      onSuccess?.();
    } catch {
      toast.error(t('feedbackForm.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Category selector */}
      <div>
        <label
          className="mb-1.5 block text-[12px] font-medium"
          style={{ color: 'var(--text-2)' }}
        >
          {t('feedbackForm.categoryLabel')}
        </label>
        <div className="flex gap-2">
          {categoryOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue('category', opt.value)}
              className="rounded-btn px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                background:
                  selectedCategory === opt.value
                    ? 'var(--primary)'
                    : 'var(--bg-alt)',
                color:
                  selectedCategory === opt.value ? 'white' : 'var(--text-2)',
                border: '1px solid',
                borderColor:
                  selectedCategory === opt.value
                    ? 'var(--primary)'
                    : 'var(--border)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input type="hidden" {...register('category')} />
      </div>

      {/* Content textarea */}
      <div>
        <label
          htmlFor="feedback-content"
          className="mb-1.5 block text-[12px] font-medium"
          style={{ color: 'var(--text-2)' }}
        >
          {t('feedbackForm.contentLabel')}
        </label>
        <textarea
          id="feedback-content"
          {...register('content')}
          rows={5}
          placeholder={t('feedbackForm.contentPlaceholder')}
          className="w-full resize-none rounded-card border px-3 py-2 text-[13px] outline-none transition-colors focus:ring-2"
          style={{
            background: 'var(--bg)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ['--tw-ring-color' as any]: 'var(--primary)',
          }}
        />
        {errors.content?.message && (
          <p className="mt-1 text-[11px]" style={{ color: 'var(--error)' }}>
            {tErrors(errors.content.message)}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-btn px-4 py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
        style={{ background: 'var(--primary)' }}
      >
        <Send className="h-3.5 w-3.5" aria-hidden />
        {submitting ? t('feedbackForm.submitting') : t('feedbackForm.submit')}
      </button>
    </form>
  );
}
