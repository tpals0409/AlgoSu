'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { MessageSquare, Bug, Lightbulb, Palette, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { adminApi, type AdminFeedback } from '@/lib/api';

// ── 상수 ──

const STATUSES = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
type StatusFilter = (typeof STATUSES)[number];

const STATUS_LABEL: Record<string, string> = {
  OPEN: '열림',
  IN_PROGRESS: '진행 중',
  RESOLVED: '해결됨',
  CLOSED: '닫힘',
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-bg-alt text-text-2',
  IN_PROGRESS: 'bg-primary-soft text-primary',
  RESOLVED: 'bg-success/10 text-success',
  CLOSED: 'text-text-3 bg-bg-alt/60',
};

const CATEGORY_LABEL: Record<string, string> = {
  GENERAL: '일반',
  BUG: '버그',
  FEATURE: '기능 요청',
  UX: 'UX',
};

const CATEGORY_ICON: Record<string, ReactNode> = {
  GENERAL: <MessageSquare className="h-3 w-3" aria-hidden />,
  BUG: <Bug className="h-3 w-3" aria-hidden />,
  FEATURE: <Lightbulb className="h-3 w-3" aria-hidden />,
  UX: <Palette className="h-3 w-3" aria-hidden />,
};

const CATEGORY_STYLE: Record<string, string> = {
  GENERAL: 'bg-bg-alt text-text-2',
  BUG: 'bg-error/10 text-error',
  FEATURE: 'bg-primary-soft text-primary',
  UX: 'bg-warning/10 text-warning',
};

const STATUS_TRANSITIONS: string[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const PAGE_SIZE = 20;

// ── 페이지 ──

export default function AdminFeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<AdminFeedback[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [loading, setLoading] = useState(true);

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.feedbacks(page, PAGE_SIZE);
      setFeedbacks(res.items);
      setTotal(res.total);
    } catch {
      toast.error('피드백 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetchFeedbacks();
  }, [fetchFeedbacks]);

  const handleStatusChange = async (publicId: string, newStatus: string) => {
    try {
      const updated = await adminApi.updateFeedbackStatus(publicId, newStatus);
      setFeedbacks((prev) =>
        prev.map((f) => (f.publicId === publicId ? updated : f)),
      );
      toast.success(`상태가 ${STATUS_LABEL[newStatus] ?? newStatus}(으)로 변경되었습니다.`);
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  // 필터 적용
  const filtered =
    statusFilter === 'ALL'
      ? feedbacks
      : feedbacks.filter((f) => f.status === statusFilter);

  // 통계
  const openCount = feedbacks.filter((f) => f.status === 'OPEN').length;
  const bugCount = feedbacks.filter((f) => f.category === 'BUG').length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* 헤더 */}
      <div>
        <h1
          className="text-[20px] font-bold tracking-tight"
          style={{ color: 'var(--text)' }}
        >
          피드백 관리
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: 'var(--text-3)' }}>
          사용자 피드백을 확인하고 상태를 관리합니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="전체" value={total} />
        <StatCard label="미해결" value={openCount} accent="var(--warning)" />
        <StatCard label="버그" value={bugCount} accent="var(--error)" />
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2">
        <Filter
          className="h-4 w-4 shrink-0"
          style={{ color: 'var(--text-3)' }}
          aria-hidden
        />
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-btn px-3 py-1.5 text-[12px] font-medium transition-colors',
              statusFilter === s
                ? 'bg-primary-soft text-primary'
                : 'text-text-3 hover:bg-bg-alt hover:text-text-2',
            )}
          >
            {s === 'ALL' ? '전체' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div
        className="overflow-hidden rounded-card border"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border)',
        }}
      >
        {/* 헤더 행 */}
        <div
          className="grid grid-cols-[1fr_100px_100px_140px] gap-4 px-4 py-3 text-[12px] font-semibold"
          style={{
            color: 'var(--text-3)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span>내용</span>
          <span>카테고리</span>
          <span>상태</span>
          <span>등록일</span>
        </div>

        {loading && (
          <div
            className="px-4 py-8 text-center text-[13px]"
            style={{ color: 'var(--text-3)' }}
          >
            불러오는 중...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div
            className="px-4 py-8 text-center text-[13px]"
            style={{ color: 'var(--text-3)' }}
          >
            피드백이 없습니다.
          </div>
        )}

        {!loading &&
          filtered.map((fb) => (
            <div
              key={fb.publicId}
              className="grid grid-cols-[1fr_100px_100px_140px] gap-4 px-4 py-3 transition-colors hover:bg-bg-alt"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {/* 내용 */}
              <div className="min-w-0">
                <p
                  className="truncate text-[13px] font-medium"
                  style={{ color: 'var(--text)' }}
                  title={fb.content}
                >
                  {fb.content}
                </p>
                {fb.pageUrl && (
                  <p
                    className="mt-0.5 truncate text-[11px]"
                    style={{ color: 'var(--text-3)' }}
                    title={fb.pageUrl}
                  >
                    {fb.pageUrl}
                  </p>
                )}
              </div>

              {/* 카테고리 */}
              <div className="flex items-center">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-btn px-2 py-0.5 text-[11px] font-medium',
                    CATEGORY_STYLE[fb.category] ?? CATEGORY_STYLE.GENERAL,
                  )}
                >
                  {CATEGORY_ICON[fb.category] ?? CATEGORY_ICON.GENERAL}
                  {CATEGORY_LABEL[fb.category] ?? fb.category}
                </span>
              </div>

              {/* 상태 드롭다운 */}
              <div className="flex items-center">
                <select
                  value={fb.status}
                  onChange={(e) =>
                    handleStatusChange(fb.publicId, e.target.value)
                  }
                  className={cn(
                    'cursor-pointer rounded-btn border-none px-2 py-0.5 text-[11px] font-medium outline-none',
                    STATUS_STYLE[fb.status] ?? STATUS_STYLE.OPEN,
                  )}
                  style={{ background: 'transparent' }}
                >
                  {STATUS_TRANSITIONS.map((st) => (
                    <option key={st} value={st}>
                      {STATUS_LABEL[st]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 등록일 */}
              <div className="flex items-center">
                <span
                  className="text-[12px]"
                  style={{ color: 'var(--text-3)' }}
                >
                  {new Date(fb.createdAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-btn px-3 py-1.5 text-[12px] font-medium text-text-3 transition-colors hover:bg-bg-alt disabled:opacity-40"
          >
            이전
          </button>
          <span
            className="text-[12px] font-medium"
            style={{ color: 'var(--text-2)' }}
          >
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-btn px-3 py-1.5 text-[12px] font-medium text-text-3 transition-colors hover:bg-bg-alt disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

// ── 통계 카드 컴포넌트 ──

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div
      className="rounded-card border px-4 py-3"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      <p className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
        {label}
      </p>
      <p
        className="mt-1 text-[22px] font-bold tracking-tight"
        style={{ color: accent ?? 'var(--text)' }}
      >
        {value}
      </p>
    </div>
  );
}
