/**
 * @file 스켈레톤 로딩 UI (B4 통일)
 * @domain common
 * @layer component
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly variant?: 'text' | 'circle' | 'rect';
  readonly width?: string | number;
  readonly height?: string | number;
  readonly lines?: number;
}

function SkeletonBlock({ className, style }: { className?: string; style?: React.CSSProperties }): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-md bg-bg-alt',
        'before:absolute before:inset-0',
        'before:bg-gradient-to-r before:from-transparent before:via-black/[0.06] before:to-transparent',
        'dark:before:via-white/15',
        'before:bg-[length:200%_100%] skeleton-shimmer',
        'motion-reduce:before:animate-none',
        className,
      )}
      style={style}
    />
  );
}

function Skeleton({ className, variant = 'rect', width, height, lines = 1, style, ...props }: SkeletonProps): React.ReactElement {
  const baseStyle: React.CSSProperties = {
    width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
    ...style,
  };

  if (variant === 'circle') {
    return (
      <div className={cn('inline-block', className)} {...props}>
        <SkeletonBlock className="rounded-full" style={baseStyle} />
      </div>
    );
  }

  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('flex flex-col gap-2', className)} aria-busy="true" aria-label="콘텐츠 로딩 중" {...props}>
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonBlock key={i} className="h-4" style={i === lines - 1 ? { width: '75%' } : undefined} />
        ))}
      </div>
    );
  }

  return (
    <SkeletonBlock
      className={cn(variant === 'text' ? 'h-4 w-full' : 'h-10 w-full', className)}
      style={baseStyle}
      aria-busy
      aria-label="콘텐츠 로딩 중"
      {...(props as React.HTMLAttributes<HTMLDivElement>)}
    />
  );
}

function SkeletonCard(): React.ReactElement {
  return (
    <div className="rounded-card border border-border bg-bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center gap-3">
        <Skeleton variant="circle" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" height={16} />
          <Skeleton variant="text" width="40%" height={12} />
        </div>
      </div>
      <Skeleton variant="text" lines={3} />
    </div>
  );
}

function SkeletonTable({ rows = 5 }: { readonly rows?: number }): React.ReactElement {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="테이블 로딩 중">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton width={40} height={20} />
          <Skeleton className="flex-1" height={20} />
          <Skeleton width={80} height={20} />
          <Skeleton width={60} height={20} />
        </div>
      ))}
    </div>
  );
}

/** 대시보드 페이지 스켈레톤: 상단 4 stat 카드 + 2열 리스트 */
function SkeletonDashboard(): React.ReactElement {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="대시보드 로딩 중">
      <Skeleton variant="text" width="30%" height={28} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-card border border-border bg-bg-card p-5">
            <div className="flex items-center gap-3">
              <Skeleton variant="rect" width={36} height={36} className="rounded-md" />
              <div className="space-y-2">
                <Skeleton width={60} height={28} />
                <Skeleton width={48} height={12} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-bg-card p-6 shadow-card">
          <Skeleton width="40%" height={20} className="mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton width={56} height={14} />
                <Skeleton className="flex-1" height={22} />
                <Skeleton width={28} height={14} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-card border border-border bg-bg-card p-6 shadow-card">
          <Skeleton width="40%" height={20} className="mb-4" />
          <Skeleton variant="text" lines={5} />
        </div>
      </div>
    </div>
  );
}

/** 테이블 페이지 스켈레톤: 헤더 + 필터 바 + 테이블 행 */
function SkeletonListPage({ rows = 8 }: { readonly rows?: number }): React.ReactElement {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="목록 로딩 중">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" width="25%" height={28} />
        <Skeleton width={100} height={36} className="rounded-md" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="flex-1" height={36} />
        <Skeleton width={100} height={36} />
        <Skeleton width={100} height={36} />
      </div>
      <SkeletonTable rows={rows} />
    </div>
  );
}

/** 프로필 페이지 스켈레톤 */
function SkeletonProfile(): React.ReactElement {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="프로필 로딩 중">
      <Skeleton variant="text" width="20%" height={28} />
      <div className="rounded-card border border-border bg-bg-card p-6 shadow-card">
        <div className="flex items-center gap-4">
          <Skeleton variant="circle" width={64} height={64} />
          <div className="space-y-2">
            <Skeleton width={120} height={20} />
            <Skeleton width={180} height={14} />
          </div>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

/** 2-패널 리뷰 페이지 스켈레톤 */
function SkeletonReview(): React.ReactElement {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="리뷰 로딩 중">
      <div className="flex items-center gap-3">
        <Skeleton width={32} height={32} className="rounded-md" />
        <Skeleton width="40%" height={24} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2" style={{ minHeight: '60vh' }}>
        <div className="rounded-card border border-border bg-bg-card p-4">
          <Skeleton className="h-full min-h-[400px] w-full" />
        </div>
        <div className="space-y-4">
          <div className="rounded-card border border-border bg-bg-card p-4">
            <div className="flex items-center gap-4 mb-4">
              <Skeleton variant="circle" width={56} height={56} />
              <Skeleton width="30%" height={16} />
            </div>
            <Skeleton variant="text" lines={3} />
          </div>
          <div className="rounded-card border border-border bg-bg-card p-4">
            <Skeleton width="30%" height={16} className="mb-3" />
            <Skeleton variant="text" lines={4} />
          </div>
        </div>
      </div>
    </div>
  );
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonTable,
  SkeletonDashboard,
  SkeletonListPage,
  SkeletonProfile,
  SkeletonReview,
};
