/**
 * @file 대댓글 아이템 컴포넌트
 * @domain review
 * @layer component
 * @related CommentThread, ReviewReply
 */

'use client';

import { type ReactElement } from 'react';
import { cn } from '@/lib/utils';
import type { ReviewReply } from '@/lib/api';

// ─── TYPES ────────────────────────────────

interface ReplyItemProps {
  readonly reply: ReviewReply;
  readonly currentUserId: string;
}

// ─── HELPERS ──────────────────────────────

/** ISO 날짜를 한국어 상대 시간으로 변환 */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

// ─── RENDER ───────────────────────────────

/**
 * 대댓글 아이템 -- 작성자 + 내용 + 시간
 * @domain review
 */
export function ReplyItem({ reply, currentUserId }: ReplyItemProps): ReactElement {
  const isAuthor = reply.authorId === currentUserId;

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
        {reply.authorId.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-text">
            {reply.authorId.slice(0, 8)}
          </span>
          {isAuthor && (
            <span className="rounded-badge bg-primary-soft px-1.5 py-0.5 text-[9px] font-medium text-primary">
              나
            </span>
          )}
          <span className="text-[10px] text-text-3">
            {formatRelativeTime(reply.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-text-2">
          {reply.content}
        </p>
      </div>
    </div>
  );
}
