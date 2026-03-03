/**
 * @file 댓글 작성 폼 (라인 댓글 / 전체 댓글)
 * @domain review
 * @layer component
 * @related CommentThread, reviewApi
 */

'use client';

import { useState, type ReactElement, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ─── TYPES ────────────────────────────────

interface CommentFormProps {
  readonly lineNumber?: number | null;
  readonly onSubmit: (content: string) => Promise<void>;
  readonly disabled?: boolean;
}

// ─── RENDER ───────────────────────────────

/**
 * 댓글 작성 폼 -- 라인 선택 시 "Line N에 대한 댓글", 미선택 시 "전체 댓글"
 * @domain review
 */
export function CommentForm({
  lineNumber,
  onSubmit,
  disabled = false,
}: CommentFormProps): ReactElement {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setContent('');
    } finally {
      setSubmitting(false);
    }
  };

  const placeholder = lineNumber
    ? `Line ${lineNumber}에 대한 댓글...`
    : '전체 댓글을 남겨보세요...';

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || submitting}
        rows={1}
        aria-label={placeholder}
        className="flex-1 resize-none rounded-badge border border-border bg-input-bg px-3 py-2 font-body text-xs text-text outline-none transition-colors placeholder:text-text-3 focus:border-primary"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void handleSubmit(e);
          }
        }}
      />
      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={!content.trim() || submitting}
        aria-label="댓글 등록"
      >
        <Send className="h-3 w-3" />
        등록
      </Button>
    </form>
  );
}
