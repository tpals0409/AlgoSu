/**
 * @file 대시보드 주차별 제출 현황 차트 (dynamic import 대상)
 * @domain dashboard
 * @layer component
 * @related DashboardPage, WeeklyBar
 */

'use client';

import type { ReactNode, KeyboardEvent, CSSProperties } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

// ─── WEEKLY BAR ──────────────────────────

function WeeklyBar({
  label,
  value,
  max,
  mounted,
  delay,
}: {
  readonly label: string;
  readonly value: number;
  readonly max: number;
  readonly mounted: boolean;
  readonly delay: number;
}): ReactNode {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-[56px] text-right font-mono text-xs text-text-2">
        {label}
      </span>
      <div
        className="h-[22px] flex-1 overflow-hidden rounded-badge"
        style={{ background: 'var(--bar-track)' }}
      >
        <div
          className="h-full rounded-badge transition-all duration-700 ease-bounce"
          style={{
            width: mounted ? `${pct}%` : '0%',
            background: 'var(--bar-fill)',
            transitionDelay: `${delay}s`,
          }}
        />
      </div>
      <span className="min-w-[28px] font-mono text-[13px] font-semibold">
        {value}
      </span>
    </div>
  );
}

// ─── TYPES ───────────────────────────────

export interface DashboardWeeklyChartProps {
  readonly filteredByWeek: { week: string; count: number }[];
  readonly weekViewLabel: string;
  readonly problemCountByWeek: Map<string, number>;
  readonly members: { user_id: string }[];
  readonly weekViewUserId: string | null;
  readonly mounted: boolean;
  readonly onCycleView: () => void;
  readonly fadeStyle: CSSProperties;
}

// ─── COMPONENT ───────────────────────────

export default function DashboardWeeklyChart({
  filteredByWeek,
  weekViewLabel,
  problemCountByWeek,
  members,
  weekViewUserId,
  mounted,
  onCycleView,
  fadeStyle,
}: DashboardWeeklyChartProps): ReactNode {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`주차별 제출 현황 — ${weekViewLabel} (클릭하여 전환)`}
      className="group cursor-pointer"
      onClick={onCycleView}
      onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCycleView(); } }}
      style={fadeStyle}
    >
      <CardHeader className="flex flex-row items-center gap-2.5">
        <CardTitle>주차별 제출 현황</CardTitle>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft2 px-2.5 py-1 text-[11px] font-medium text-primary">
          <span
            className="inline-block h-[5px] w-[5px] shrink-0 rounded-full gradient-brand"
            aria-hidden
          />
          {weekViewLabel}
        </span>
        <span className="text-[10px] text-text-3 opacity-0 transition-opacity group-hover:opacity-100">
          클릭하여 전환
        </span>
      </CardHeader>
      <CardContent>
        {filteredByWeek.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-3">
            제출 기록이 없습니다.
          </p>
        ) : (
          <div key={weekViewLabel} className="space-y-2.5 animate-fade-in">
            {filteredByWeek.slice(0, 5).map((w, i) => {
              const pc = problemCountByWeek.get(w.week) ?? 0;
              const total = weekViewUserId === null ? pc * members.length : pc;
              return (
                <WeeklyBar
                  key={w.week}
                  label={w.week}
                  value={w.count}
                  max={total}
                  mounted={mounted}
                  delay={0.3 + i * 0.1}
                />
              );
            })}
            {filteredByWeek.length > 5 && (
              <Link
                href="/analytics"
                onClick={(e) => e.stopPropagation()}
                className="block pt-1 text-center text-[11px] font-medium text-primary transition-colors hover:underline"
              >
                전체 {filteredByWeek.length}주 보기 →
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
