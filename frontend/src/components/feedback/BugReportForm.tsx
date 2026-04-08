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
import { feedbackSchema, type FeedbackFormData } from '@/lib/schemas/feedback';
import { feedbackApi } from '@/lib/api';
import { useStudy } from '@/contexts/StudyContext';
import { eventTracker } from '@/lib/event-tracker';

// ── Image resize utility ──

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
        reject(new Error('Canvas context를 생성할 수 없습니다.'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/webp', 0.65);
      URL.revokeObjectURL(img.src);
      if (dataUrl.length > 700_000) {
        reject(new Error('이미지가 너무 큽니다. 더 작은 이미지를 사용해주세요.'));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('이미지를 읽을 수 없습니다.'));
    };
    img.src = URL.createObjectURL(file);
  });
}

interface BugReportFormProps {
  readonly onSuccess?: () => void;
}

export function BugReportForm({ onSuccess }: BugReportFormProps) {
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

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 첨부할 수 있습니다.');
      return;
    }
    try {
      const dataUrl = await resizeImage(file);
      setScreenshot(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '이미지 처리에 실패했습니다.');
    }
  }, []);

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
      toast.success('버그 리포트를 보내주셔서 감사합니다!');
      reset();
      setScreenshot(null);
      onSuccess?.();
    } catch {
      toast.error('버그 리포트 전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
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
          버그 설명
        </label>
        <textarea
          id="bug-content"
          {...register('content')}
          rows={4}
          placeholder="어떤 문제가 발생했는지 설명해주세요..."
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

      {/* Screenshot */}
      <div>
        <label
          className="mb-1.5 block text-[12px] font-medium"
          style={{ color: 'var(--text-2)' }}
        >
          스크린샷 (선택)
        </label>

        {screenshot ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshot}
              alt="스크린샷 미리보기"
              className="max-h-[200px] cursor-pointer rounded-card border object-contain transition-opacity hover:opacity-80"
              style={{ borderColor: 'var(--border)' }}
              onClick={() => setPreviewOpen(true)}
              title="클릭하여 전체 보기"
            />
            <button
              type="button"
              onClick={removeScreenshot}
              className="absolute -right-2 -top-2 rounded-full p-0.5"
              style={{ background: 'var(--error)', color: 'white' }}
              aria-label="스크린샷 제거"
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
            이미지 첨부 또는 클립보드 붙여넣기 (Ctrl+V)
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          aria-label="스크린샷 파일 선택"
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
        {submitting ? '전송 중...' : '버그 리포트 보내기'}
      </button>

      {/* 스크린샷 전체보기 모달 */}
      {previewOpen && screenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="relative mx-4 max-h-[80vh] max-w-[90vw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshot}
              alt="스크린샷 전체보기"
              className="max-h-[80vh] rounded-card object-contain"
            />
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute -right-2 -top-2 rounded-full p-1"
              style={{ background: 'var(--error)', color: 'white' }}
              aria-label="닫기"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
