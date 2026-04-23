'use client';
// Sprint 62 — 피드백 관리 대시보드 (상세모달/카테고리필터/검색/isAdmin)
import { useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  MessageSquare,
  Bug,
  Lightbulb,
  Palette,
  Filter,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { adminApi, type AdminFeedback } from '@/lib/api';

// ── 상수 ──

const STATUSES = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;
type StatusFilter = (typeof STATUSES)[number];

const CATEGORIES = ['ALL', 'GENERAL', 'BUG', 'FEATURE', 'UX'] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

const STATUS_LABEL: Record<string, string> = {
  OPEN: '열림',
  IN_PROGRESS: '진행 중',
  RESOLVED: '해결됨',
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-bg-alt text-text-2',
  IN_PROGRESS: 'bg-primary-soft text-primary',
  RESOLVED: 'bg-success/10 text-success',
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

/** 상태 전이 규칙 — 백엔드 ALLOWED_TRANSITIONS과 동기화 (3상태 자유 전이) */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['OPEN', 'IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['IN_PROGRESS', 'OPEN', 'RESOLVED'],
  RESOLVED: ['RESOLVED', 'OPEN', 'IN_PROGRESS'],
};

const PAGE_SIZE = 20;

// ── 페이지 ──

export default function AdminFeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<AdminFeedback[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<AdminFeedback | null>(null);

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.feedbacks(
        page,
        PAGE_SIZE,
        categoryFilter !== 'ALL' ? categoryFilter : undefined,
        searchQuery || undefined,
        statusFilter !== 'ALL' ? statusFilter : undefined,
      );
      setFeedbacks(res.items);
      setTotal(res.total);
      if (res.counts) setCounts(res.counts);
    } catch {
      toast.error('피드백 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    void fetchFeedbacks();
  }, [fetchFeedbacks]);

  // 필터 변경 시 페이지 리셋
  useEffect(() => {
    setPage(1);
  }, [statusFilter, categoryFilter, searchQuery]);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  // 통계 (서버 제공 전체 기준 counts — status: OPEN/..., cat:BUG/...)
  const totalCount =
    (counts['OPEN'] ?? 0) + (counts['IN_PROGRESS'] ?? 0) +
    (counts['RESOLVED'] ?? 0);
  const openCount = counts['OPEN'] ?? 0;
  const bugCount = counts['cat:BUG'] ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-[var(--text)]">
          피드백 관리
        </h1>
        <p className="mt-1 text-[13px] text-[var(--text-3)]">
          사용자 피드백을 확인하고 상태를 관리합니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="전체" value={totalCount} />
        <StatCard label="미해결" value={openCount} accent="var(--warning)" />
        <StatCard label="버그" value={bugCount} accent="var(--error)" />
      </div>

      {/* 검색 */}
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-btn border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5">
          <Search className="h-4 w-4 shrink-0 text-[var(--text-3)]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="내용 검색..."
            className="flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-text-3"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearchQuery('');
              }}
              className="text-text-3 hover:text-text-2"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="rounded-btn bg-primary-soft px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/20"
        >
          검색
        </button>
      </form>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-4">
        {/* 상태 필터 */}
        <div className="flex items-center gap-2">
          <Filter
            className="h-4 w-4 shrink-0 text-[var(--text-3)]"
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

        {/* 카테고리 필터 */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[var(--text-3)]">
            카테고리:
          </span>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoryFilter(c)}
              className={cn(
                'rounded-btn px-2.5 py-1 text-[11px] font-medium transition-colors',
                categoryFilter === c
                  ? c === 'ALL'
                    ? 'bg-primary-soft text-primary'
                    : CATEGORY_STYLE[c]
                  : 'text-text-3 hover:bg-bg-alt hover:text-text-2',
              )}
            >
              {c === 'ALL' ? '전체' : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-hidden rounded-card border border-[var(--border)] bg-[var(--bg-card)]">
        {/* 헤더 행 */}
        <div className="grid grid-cols-[1fr_120px_100px_100px_140px] gap-4 border-b border-[var(--border)] px-4 py-3 text-[12px] font-semibold text-[var(--text-3)]">
          <span>내용</span>
          <span>작성자</span>
          <span>카테고리</span>
          <span>상태</span>
          <span>등록일</span>
        </div>

        {loading && (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--text-3)]">
            불러오는 중...
          </div>
        )}

        {!loading && feedbacks.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--text-3)]">
            피드백이 없습니다.
          </div>
        )}

        {!loading &&
          feedbacks.map((fb) => (
            <div
              key={fb.publicId}
              className="grid cursor-pointer grid-cols-[1fr_120px_100px_100px_140px] gap-4 border-b border-[var(--border)] px-4 py-3 transition-colors hover:bg-bg-alt"
              onClick={() => {
                adminApi.feedbackDetail(fb.publicId)
                  .then((detail) => setSelectedFeedback(detail))
                  .catch(() => setSelectedFeedback(fb));
              }}
            >
              {/* 내용 */}
              <div className="min-w-0">
                <p
                  className="truncate text-[13px] font-medium text-[var(--text)]"
                  title={fb.content}
                >
                  {fb.content}
                </p>
                {fb.pageUrl && (
                  <p
                    className="mt-0.5 truncate text-[11px] text-[var(--text-3)]"
                    title={fb.pageUrl}
                  >
                    {fb.pageUrl}
                  </p>
                )}
              </div>

              {/* 작성자 */}
              <div className="flex flex-col justify-center min-w-0">
                <p
                  className="truncate text-[12px] font-medium text-[var(--text)]"
                  title={fb.userEmail ?? undefined}
                >
                  {fb.userName ?? fb.userEmail ?? '-'}
                </p>
                {fb.studyName && (
                  <p
                    className="truncate text-[10px] text-[var(--text-3)]"
                    title={fb.studyName}
                  >
                    {fb.studyName}
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
              <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                <select
                  value={fb.status}
                  onChange={(e) =>
                    handleStatusChange(fb.publicId, e.target.value)
                  }
                  className={cn(
                    'cursor-pointer rounded-btn border-none bg-transparent px-2 py-0.5 text-[11px] font-medium outline-none',
                    STATUS_STYLE[fb.status] ?? STATUS_STYLE.OPEN,
                  )}
                >
                  {(ALLOWED_TRANSITIONS[fb.status] ?? [fb.status]).map((st) => (
                    <option key={st} value={st}>
                      {STATUS_LABEL[st]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 등록일 */}
              <div className="flex items-center">
                <span className="text-[12px] text-[var(--text-3)]">
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
          <span className="text-[12px] font-medium text-[var(--text-2)]">
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

      {/* 상세 모달 */}
      {selectedFeedback && (
        <FeedbackDetailModal
          feedback={selectedFeedback}
          onClose={() => setSelectedFeedback(null)}
          onStatusChange={(publicId, status) => {
            void handleStatusChange(publicId, status);
            setSelectedFeedback(null);
          }}
        />
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
    <div className="rounded-card border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
      <p className="text-[11px] font-medium text-[var(--text-3)]">
        {label}
      </p>
      {/* accent: props 동적 값, Tailwind 전환 불가 */}
      <p
        className="mt-1 text-[22px] font-bold tracking-tight"
        style={{ color: accent ?? 'var(--text)' }}
      >
        {value}
      </p>
    </div>
  );
}

// ── 상세 모달 컴포넌트 ──

function FeedbackDetailModal({
  feedback,
  onClose,
  onStatusChange,
}: {
  feedback: AdminFeedback;
  onClose: () => void;
  onStatusChange: (publicId: string, status: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-card border border-[var(--border)] bg-[var(--bg-card)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-btn px-2 py-0.5 text-[11px] font-medium',
                CATEGORY_STYLE[feedback.category] ?? CATEGORY_STYLE.GENERAL,
              )}
            >
              {CATEGORY_ICON[feedback.category] ?? CATEGORY_ICON.GENERAL}
              {CATEGORY_LABEL[feedback.category] ?? feedback.category}
            </span>
            <span
              className={cn(
                'rounded-btn px-2 py-0.5 text-[11px] font-medium',
                STATUS_STYLE[feedback.status] ?? STATUS_STYLE.OPEN,
              )}
            >
              {STATUS_LABEL[feedback.status] ?? feedback.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn p-1 text-text-3 transition-colors hover:bg-bg-alt hover:text-text-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 작성자/스터디 */}
        <div className="mt-3 flex items-center gap-4 text-[12px] text-[var(--text-2)]">
          <span>{feedback.userName ?? feedback.userEmail ?? '알 수 없음'}</span>
          {feedback.studyName && (
            <span className="rounded-btn bg-bg-alt px-2 py-0.5 text-[11px] text-[var(--text-3)]">
              {feedback.studyName}
            </span>
          )}
        </div>

        {/* 내용 */}
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-[11px] font-medium text-[var(--text-3)]">
              내용
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text)]">
              {feedback.content}
            </p>
          </div>

          {feedback.pageUrl && (
            <div>
              <p className="text-[11px] font-medium text-[var(--text-3)]">
                페이지 URL
              </p>
              <p className="mt-1 text-[12px] break-all text-[var(--text-2)]">
                {feedback.pageUrl}
              </p>
            </div>
          )}

          {feedback.browserInfo && (
            <div>
              <p className="text-[11px] font-medium text-[var(--text-3)]">
                브라우저 정보
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-2)]">
                {feedback.browserInfo}
              </p>
            </div>
          )}

          {feedback.screenshot && (
            <div>
              <p className="text-[11px] font-medium text-[var(--text-3)]">
                스크린샷
              </p>
              <img
                src={feedback.screenshot}
                alt="피드백 스크린샷"
                className="mt-1 max-h-[300px] rounded-card border border-[var(--border)] object-contain"
              />
            </div>
          )}

          <div className="flex items-center gap-4 text-[12px] text-[var(--text-3)]">
            <span>
              등록일:{' '}
              {new Date(feedback.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {feedback.resolvedAt && (
              <span>
                해결일:{' '}
                {new Date(feedback.resolvedAt).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>

        {/* 상태 변경 버튼 */}
        <div className="mt-4 flex items-center gap-2 border-t border-[var(--border)] pt-4">
          <span className="text-[11px] font-medium text-[var(--text-3)]">
            상태 변경:
          </span>
          {(ALLOWED_TRANSITIONS[feedback.status] ?? [])
            .filter((s) => s !== feedback.status)
            .map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => onStatusChange(feedback.publicId, st)}
                className={cn(
                  'rounded-btn px-3 py-1 text-[11px] font-medium transition-colors',
                  STATUS_STYLE[st] ?? STATUS_STYLE.OPEN,
                )}
              >
                {STATUS_LABEL[st]}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
