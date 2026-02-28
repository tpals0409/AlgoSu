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
        'relative overflow-hidden rounded-md bg-muted',
        'before:absolute before:inset-0',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        'before:animate-skeleton-shimmer before:bg-[length:200%_100%]',
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
    <div className="rounded-lg border border-border bg-card p-6 shadow-light">
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

export { Skeleton, SkeletonCard, SkeletonTable };
