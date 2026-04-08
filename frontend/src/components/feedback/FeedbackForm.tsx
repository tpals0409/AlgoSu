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
import { feedbackSchema, type FeedbackFormData, type FeedbackCategory } from '@/lib/schemas/feedback';
import { feedbackApi } from '@/lib/api';

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: 'GENERAL', label: '일반' },
  { value: 'FEATURE', label: '기능 요청' },
  { value: 'UX', label: 'UX 개선' },
];

interface FeedbackFormProps {
  readonly onSuccess?: () => void;
}

export function FeedbackForm({ onSuccess }: FeedbackFormProps) {
  const [submitting, setSubmitting] = useState(false);

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
        pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      });
      toast.success('피드백을 보내주셔서 감사합니다!');
      reset();
      onSuccess?.();
    } catch {
      toast.error('피드백 전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
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
          카테고리
        </label>
        <div className="flex gap-2">
          {CATEGORY_OPTIONS.map((opt) => (
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
          내용
        </label>
        <textarea
          id="feedback-content"
          {...register('content')}
          rows={5}
          placeholder="의견을 자유롭게 작성해주세요..."
          className="w-full resize-none rounded-card border px-3 py-2 text-[13px] outline-none transition-colors focus:ring-2"
          style={{
            background: 'var(--bg)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ['--tw-ring-color' as any]: 'var(--primary)',
          }}
        />
        {errors.content && (
          <p className="mt-1 text-[11px]" style={{ color: 'var(--error)' }}>
            {errors.content.message}
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
        {submitting ? '전송 중...' : '피드백 보내기'}
      </button>
    </form>
  );
}
