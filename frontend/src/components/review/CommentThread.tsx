/**
 * @file 댓글 스레드 (시간순 댓글 목록 + 대댓글)
 * @domain review
 * @layer component
 * @related CommentForm, ReplyItem, reviewApi
 *
 * soft-delete된 댓글은 "삭제된 댓글입니다" 표시.
 * 본인 댓글: 수정/삭제 버튼. 대댓글 펼치기/접기.
 * @guard submission-owner IDOR 방어: authorId === currentUserId
 */

'use client';

import { useState, type ReactElement } from 'react';
import {
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReviewComment } from '@/lib/api';
import { ReplyItem } from '@/components/review/ReplyItem';
import { CommentForm } from '@/components/review/CommentForm';

// ─── TYPES ────────────────────────────────

interface CommentThreadProps {
  readonly comments: ReviewComment[];
  readonly currentUserId: string;
  readonly onEdit: (publicId: string, content: string) => void;
  readonly onDelete: (publicId: string) => void;
  readonly onReply: (commentId: number, content: string) => Promise<void>;
  readonly selectedLine?: number | null;
}

// ─── HELPERS ──────────────────────────────

/** ISO 날짜를 상대 시간으로 변환 */
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

// ─── SINGLE COMMENT ──────────────────────

interface CommentItemProps {
  readonly comment: ReviewComment;
  readonly currentUserId: string;
  readonly onEdit: (publicId: string, content: string) => void;
  readonly onDelete: (publicId: string) => void;
  readonly onReply: (commentId: number, content: string) => Promise<void>;
}

function CommentItem({
  comment,
  currentUserId,
  onEdit,
  onDelete,
  onReply,
}: CommentItemProps): ReactElement {
  const [showReplies, setShowReplies] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const isAuthor = comment.authorId === currentUserId;
  const replies = comment.replies ?? [];
  const isDeleted = comment.content === '';

  const handleEdit = (): void => {
    if (editContent.trim() && editContent !== comment.content) {
      onEdit(comment.publicId, editContent.trim());
    }
    setEditing(false);
  };

  if (isDeleted) {
    return (
      <div className="border-b border-border px-1 py-3">
        <p className="text-xs italic text-text-3">삭제된 댓글입니다</p>
      </div>
    );
  }

  return (
    <div className="border-b border-border px-1 py-3">
      <div className="flex gap-2">
        {/* 아바타 */}
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-badge text-[10px] font-semibold',
            isAuthor
              ? 'gradient-brand text-white'
              : 'bg-bg-alt text-text-2',
          )}
        >
          {comment.authorId.slice(0, 2).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          {/* 헤더 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-text">
              {comment.authorId.slice(0, 8)}
            </span>
            {isAuthor && (
              <span className="rounded-badge bg-primary-soft px-1.5 py-0.5 text-[9px] font-medium text-primary">
                나
              </span>
            )}
            {comment.lineNumber && (
              <span className="font-mono text-[10px] text-primary">
                L{comment.lineNumber}
              </span>
            )}
            <span className="text-[10px] text-text-3">
              {formatRelativeTime(comment.createdAt)}
            </span>
          </div>

          {/* 내용 또는 수정 폼 */}
          {editing ? (
            <div className="mt-1.5">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full resize-none rounded-badge border border-border bg-input-bg px-2 py-1.5 text-xs text-text outline-none focus:border-primary"
                rows={2}
                aria-label="댓글 수정"
              />
              <div className="mt-1 flex gap-1.5">
                <button
                  type="button"
                  onClick={handleEdit}
                  className="rounded-badge bg-primary px-2.5 py-1 text-[10px] font-semibold text-white transition-all hover:brightness-110"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditContent(comment.content);
                  }}
                  className="rounded-badge border border-border px-2.5 py-1 text-[10px] text-text-3 transition-colors hover:bg-bg-alt hover:text-text"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-text-2">
              {comment.content}
            </p>
          )}

          {/* 액션 버튼 */}
          <div className="mt-1.5 flex items-center gap-2">
            {isAuthor && !editing && (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-0.5 text-[10px] text-text-3 transition-colors hover:text-primary"
                  aria-label="댓글 수정"
                >
                  <Pencil className="h-2.5 w-2.5" />
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(comment.publicId)}
                  className="flex items-center gap-0.5 text-[10px] text-text-3 transition-colors hover:text-error"
                  aria-label="댓글 삭제"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                  삭제
                </button>
              </>
            )}
            {replies.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReplies((v) => !v)}
                className="flex items-center gap-0.5 text-[10px] text-text-3 transition-colors hover:text-text"
              >
                {showReplies ? (
                  <ChevronUp className="h-2.5 w-2.5" />
                ) : (
                  <ChevronDown className="h-2.5 w-2.5" />
                )}
                답글 {replies.length}
              </button>
            )}
          </div>

          {/* 대댓글 목록 */}
          {showReplies && replies.length > 0 && (
            <div className="mt-2 border-l-2 border-border pl-3">
              {replies.map((r) => (
                <ReplyItem
                  key={r.publicId}
                  reply={r}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          )}

          {/* 대댓글 작성 폼 (답글 펼쳤을 때) */}
          {showReplies && (
            <div className="mt-2 pl-3">
              <CommentForm
                onSubmit={async (content) => {
                  await onReply(comment.id, content);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RENDER ───────────────────────────────

/**
 * 댓글 스레드 -- 전체 댓글 목록 + 선택된 라인 필터
 * @domain review
 */
export function CommentThread({
  comments,
  currentUserId,
  onEdit,
  onDelete,
  onReply,
  selectedLine,
}: CommentThreadProps): ReactElement {
  // 선택된 라인이 있으면 해당 라인 댓글만, 없으면 전체
  const filtered = selectedLine
    ? comments.filter((c) => c.lineNumber === selectedLine)
    : comments;

  if (filtered.length === 0) {
    return (
      <div className="py-8 text-center">
        <MessageSquare className="mx-auto mb-2 h-6 w-6 text-text-3 opacity-40" />
        <p className="text-xs text-text-3">
          {selectedLine
            ? `Line ${selectedLine}에 아직 댓글이 없습니다`
            : '코드 라인을 클릭하면 댓글을 확인하고 남길 수 있어요'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {selectedLine && (
        <div className="mb-2 font-mono text-[11px] text-text-3">
          Line {selectedLine}
        </div>
      )}
      {filtered.map((comment) => (
        <CommentItem
          key={comment.publicId}
          comment={comment}
          currentUserId={currentUserId}
          onEdit={onEdit}
          onDelete={onDelete}
          onReply={onReply}
        />
      ))}
    </div>
  );
}
