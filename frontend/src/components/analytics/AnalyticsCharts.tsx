/**
 * @file 통계 차트 영역 - StatCards + 주차별 추이 + 알고리즘 유형 (dynamic import 대상)
 * @domain analytics
 * @layer component
 * @related AnalyticsPage, Card, Badge
 */

'use client';

import { type ReactNode } from 'react';
import {
  BarChart3,
  FileText,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

// ─── StatCard ────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  valueClassName,
}: {
  readonly icon: typeof BarChart3;
  readonly label: string;
  readonly value: string | number;
  readonly loading: boolean;
  readonly valueClassName?: string;
}): ReactNode {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <div className="flex w-9 h-9 items-center justify-center rounded-md bg-bg-alt">
          <Icon className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <div>
          {loading ? (
            <Skeleton height={20} width={60} />
          ) : (
            <p className={cn('text-lg font-bold text-text', valueClassName)}>{value}</p>
          )}
          <p className="font-mono text-[10px] text-text-3">{label}</p>
        </div>
      </div>
    </Card>
  );
}

// ─── WeeklyBar ───────────────────────────

function WeeklyBar({
  data,
  total,
  isCurrent,
}: {
  readonly data: { week: string; count: number };
  readonly total: number;
  readonly isCurrent?: boolean;
}): ReactNode {
  const pct = total > 0 ? Math.min(Math.round((data.count / total) * 100), 100) : 0;
  const isComplete = total > 0 && data.count >= total;

  return (
    <div className={cn(
      'flex items-center gap-2',
      isCurrent && 'bg-primary/[0.05] rounded-sm px-1.5 py-0.5 -mx-1.5',
    )}>
      <span
        className={cn(
          'w-16 text-right font-mono text-[10px] truncate',
          isCurrent ? 'text-primary font-medium' : 'text-text-3',
        )}
        title={data.week}
      >
        {data.week}
      </span>
      <div className="flex-1 h-5 bg-bg-alt rounded-sm overflow-hidden">
        <div
          className="h-full rounded-sm gradient-brand transition-all duration-300"
          style={{ width: `${pct}%` }}
          title={`${data.week}: ${data.count}/${total} (${pct}%)`}
        />
      </div>
      <span className={cn(
        'w-10 text-right font-mono text-[11px] shrink-0',
        isComplete ? 'text-success font-medium' : isCurrent ? 'text-primary font-medium' : data.count === 0 ? 'text-text-3' : 'text-text',
      )}>
        {data.count}/{total}
      </span>
      <span className="w-7 shrink-0 font-mono text-[10px] font-medium text-success">
        {isComplete ? '완주' : ''}
      </span>
    </div>
  );
}

// ─── TYPES ───────────────────────────────

interface TagRow {
  tag: string;
  count: number;
  max: number;
}

export interface AnalyticsChartsProps {
  readonly myStatsCount: number;
  readonly myStatsDoneCount: number;
  readonly myCompletionPct: number;
  readonly myWeekCount: number;
  readonly myWeeklyData: { week: string; count: number }[];
  readonly problemCountByWeek: Map<string, number>;
  readonly currentWeekLabel: string;
  readonly tagDistribution: TagRow[];
}

// ─── COMPONENT ───────────────────────────

export default function AnalyticsCharts({
  myStatsCount,
  myStatsDoneCount,
  myCompletionPct,
  myWeekCount,
  myWeeklyData,
  problemCountByWeek,
  currentWeekLabel,
  tagDistribution,
}: AnalyticsChartsProps): ReactNode {
  return (
    <>
      {/* Section A: 나의 성과 요약 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="region" aria-label="나의 성과 요약">
        <StatCard
          icon={FileText}
          label="내 제출"
          value={myStatsCount}
          loading={false}
        />
        <StatCard
          icon={CheckCircle2}
          label="AI 분석 완료"
          value={myStatsDoneCount}
          loading={false}
        />
        <StatCard
          icon={BarChart3}
          label="내 완료율"
          value={`${myCompletionPct}%`}
          loading={false}
          valueClassName={myCompletionPct >= 75 ? 'text-success' : myCompletionPct < 50 ? 'text-warning' : undefined}
        />
        <StatCard
          icon={Calendar}
          label="참여 주차"
          value={`${myWeekCount}주`}
          loading={false}
        />
      </div>

      {/* Section B: 나의 주차별 풀이 추이 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" aria-hidden />
            나의 주차별 풀이 추이
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myWeeklyData.length > 0 ? (
            <div className="space-y-2">
              {myWeeklyData.map((w) => {
                const total = problemCountByWeek.get(w.week) ?? 0;
                return (
                  <WeeklyBar
                    key={w.week}
                    data={w}
                    total={total}
                    isCurrent={w.week === currentWeekLabel}
                  />
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-text-3">
              아직 풀이 기록이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section C: 내가 푼 알고리즘 유형 */}
      {tagDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" aria-hidden />
              내가 푼 알고리즘 유형
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tagDistribution.map((row) => {
                const ratio = row.max > 0 ? row.count / row.max : 0;
                const isTop = ratio >= 0.7;
                const isMid = ratio >= 0.4 && ratio < 0.7;

                return (
                  <div
                    key={row.tag}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border font-mono transition-colors cursor-default',
                      isTop
                        ? 'gradient-brand border-primary/30 px-3.5 py-2 text-white'
                        : isMid
                          ? 'bg-bg-alt border-primary/15 px-3 py-1.5'
                          : 'bg-bg-alt border-border px-2.5 py-1.5',
                      !isTop && 'hover:border-primary/30 hover:bg-bg-alt',
                    )}
                    title={`${row.tag}: ${row.count}문제`}
                  >
                    <span className={cn(
                      'text-[11px]',
                      isTop ? 'text-white font-medium' : 'text-text',
                    )}>
                      {row.tag}
                    </span>
                    <span className={cn(
                      'text-[11px] font-bold',
                      isTop ? 'text-white/80' : isMid ? 'text-primary' : 'text-text-3',
                    )}>
                      {row.count}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 font-mono text-[10px] text-text-3">
              총 {tagDistribution.reduce((s, r) => s + r.count, 0)}문제
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
