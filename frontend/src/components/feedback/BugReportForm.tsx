/**
 * @file 버그 리포트 폼 (스크린샷 첨부 지원)
 * @domain feedback
 * @layer component
 * @related FeedbackWidget, feedbackSchema
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Bug, ImagePlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { feedbackSchema, type FeedbackFormData } from '@/lib/schemas/feedback';
import { feedbackApi } from '@/lib/api';
import { useStudy } from '@/contexts/StudyContext';
import { eventTracker } from '@/lib/event-tracker';

// ── Image resize utility ──

/** resizeImage 에러 코드 */
const IMAGE_ERROR = {
  CANVAS_CONTEXT: 'CANVAS_CONTEXT_FAILED',
  TOO_LARGE: 'IMAGE_TOO_LARGE',
  UNREADABLE: 'IMAGE_UNREADABLE',
} as const;

/**
 * 이미지를 최대 너비로 리사이즈하여 data URL을 반환한다.
 * 에러 발생 시 에러 코드 문자열을 throw한다.
 */
async function resizeImage(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error(IMAGE_ERROR.CANVAS_CONTEXT));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/webp', 0.65);
      URL.revokeObjectURL(img.src);
      if (dataUrl.length > 700_000) {
        reject(new Error(IMAGE_ERROR.TOO_LARGE));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error(IMAGE_ERROR.UNREADABLE));
    };
    img.src = URL.createObjectURL(file);
  });
}

interface BugReportFormProps {
  readonly onSuccess?: () => void;
}

export function BugReportForm({ onSuccess }: BugReportFormProps) {
  const t = useTranslations('feedback');
  const tErrors = useTranslations('errors');
  const { currentStudyId } = useStudy();
  const [submitting, setSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      category: 'BUG',
      content: '',
    },
  });

  /** 이미지 에러 코드를 번역된 메시지로 변환 */
  const getImageErrorMessage = useCallback(
    (code: string): string => {
      switch (code) {
        case IMAGE_ERROR.CANVAS_CONTEXT:
          return t('bugReport.errors.canvasContext');
        case IMAGE_ERROR.TOO_LARGE:
          return t('bugReport.errors.imageTooLarge');
        case IMAGE_ERROR.UNREADABLE:
          return t('bugReport.errors.imageUnreadable');
        default:
          return t('bugReport.errors.imageProcessFailed');
      }
    },
    [t],
  );

  const handleImageFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error(t('bugReport.errors.imageOnly'));
        return;
      }
      try {
        const dataUrl = await resizeImage(file);
        setScreenshot(dataUrl);
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        toast.error(getImageErrorMessage(code));
      }
    },
    [t, getImageErrorMessage],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleImageFile(file);
            break;
          }
        }
      }
    },
    [handleImageFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImageFile(file);
      // Reset input so same file can be re-selected
      e.target.value = '';
    },
    [handleImageFile],
  );

  const removeScreenshot = useCallback(() => {
    setScreenshot(null);
  }, []);

  const onSubmit = async (data: FeedbackFormData) => {
    setSubmitting(true);
    try {
      await feedbackApi.create({
        ...data,
        category: 'BUG',
        studyId: currentStudyId ?? undefined,
        pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        screenshot: screenshot ?? undefined,
      });
      eventTracker?.track('bug_report:submit', {
        meta: { hasScreenshot: !!screenshot },
      });
      toast.success(t('bugReport.submitSuccess'));
      reset();
      setScreenshot(null);
      onSuccess?.();
    } catch {
      toast.error(t('bugReport.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" onPaste={handlePaste}>
      {/* Hidden category */}
      <input type="hidden" {...register('category')} value="BUG" />

      {/* Content textarea */}
      <div>
        <label
          htmlFor="bug-content"
          className="mb-1.5 block text-[12px] font-medium"
          style={{ color: 'var(--text-2)' }}
        >
          {t('bugReport.descriptionLabel')}
        </label>
        <textarea
          id="bug-content"
          {...register('content')}
          rows={4}
          placeholder={t('bugReport.descriptionPlaceholder')}
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

      {/* Screenshot */}
      <div>
        <label
          className="mb-1.5 block text-[12px] font-medium"
          style={{ color: 'var(--text-2)' }}
        >
          {t('bugReport.screenshotLabel')}
        </label>

        {screenshot ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshot}
              alt={t('bugReport.screenshotPreviewAlt')}
              className="max-h-[200px] cursor-pointer rounded-card border object-contain transition-opacity hover:opacity-80"
              style={{ borderColor: 'var(--border)' }}
              onClick={() => setPreviewOpen(true)}
              title={t('bugReport.screenshotClickToView')}
            />
            <button
              type="button"
              onClick={removeScreenshot}
              className="absolute -right-2 -top-2 rounded-full p-0.5"
              style={{ background: 'var(--error)', color: 'white' }}
              aria-label={t('bugReport.removeScreenshot')}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-card border border-dashed px-4 py-3 text-[12px] transition-colors hover:bg-bg-alt"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-3)',
            }}
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
            {t('bugReport.attachImage')}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          aria-label={t('bugReport.selectFile')}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-btn px-4 py-2 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
        style={{ background: 'var(--error)' }}
      >
        <Bug className="h-3.5 w-3.5" aria-hidden />
        {submitting ? t('bugReport.submitting') : t('bugReport.submit')}
      </button>

      {/* Screenshot fullscreen modal */}
      {previewOpen && screenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="relative mx-4 max-h-[80vh] max-w-[90vw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshot}
              alt={t('bugReport.screenshotFullAlt')}
              className="max-h-[80vh] rounded-card object-contain"
            />
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute -right-2 -top-2 rounded-full p-1"
              style={{ background: 'var(--error)', color: 'white' }}
              aria-label={t('bugReport.close')}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
