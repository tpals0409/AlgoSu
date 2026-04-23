/**
 * @file 대댓글 아이템 컴포넌트
 * @domain review
 * @layer component
 * @related CommentThread, ReviewReply
 */

'use client';

import { type ReactElement } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  createTimeTranslator,
  formatReviewRelativeTime,
} from '@/lib/utils/review-time';
import type { ReviewReply } from '@/lib/api';

// ─── TYPES ────────────────────────────────

interface ReplyItemProps {
  readonly reply: ReviewReply;
  readonly currentUserId: string;
  readonly nicknameMap?: Record<string, string>;
}

// ─── RENDER ───────────────────────────────

/**
 * 대댓글 아이템 -- 작성자 + 내용 + 시간
 * @domain review
 */
export function ReplyItem({ reply, currentUserId, nicknameMap = {} }: ReplyItemProps): ReactElement {
  const t = useTranslations('reviews');
  const locale = useLocale();
  const tTime = createTimeTranslator(t);

  const isAuthor = reply.authorId === currentUserId;
  const authorName = nicknameMap[reply.authorId] ?? reply.authorId.slice(0, 8);

  return (
    <div className="flex gap-2 py-2">
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-badge text-[9px] font-semibold',
          isAuthor
            ? 'gradient-brand text-white'
            : 'bg-bg-alt text-text-2',
        )}
      >
        {authorName.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-text">
            {authorName}
          </span>
          {isAuthor && (
            <span className="rounded-badge bg-primary-soft px-1.5 py-0.5 text-[9px] font-medium text-primary">
              {t('replyItem.me')}
            </span>
          )}
          <span className="text-[10px] text-text-3">
            {formatReviewRelativeTime(reply.createdAt, tTime, locale)}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-text-2">
          {reply.content}
        </p>
      </div>
    </div>
  );
}
