/**
 * @file 스터디룸 통계 카드 컴포넌트
 * @domain study
 * @layer component
 * @related page.tsx
 */

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

export interface StatCardProps {
  readonly icon: ReactNode;
  readonly iconBg: string;
  readonly iconColor: string;
  readonly value: number;
  readonly label: string;
}

export function StatCard({ icon, iconBg, iconColor, value, label }: StatCardProps): ReactNode {
  return (
    <Card className="flex items-center gap-3 px-4 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: iconBg, color: iconColor }}>{icon}</div>
      <div>
        <p className="text-xl font-bold text-text">{value}</p>
        <p className="text-[11px] text-text-3">{label}</p>
      </div>
    </Card>
  );
}
