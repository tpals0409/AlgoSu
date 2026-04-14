/**
 * @file       decision-bridge.tsx
 * @domain     blog
 * @layer      ui
 * @related    src/components/mdx-components.tsx
 *
 * 두 시점(결정 → 효과)을 시각적으로 연결하는 "시간의 다리".
 * SVG path stroke-dasharray 애니메이션으로 "그려지는" 효과를 표현.
 * 모바일: 세로 배치 (상→하), sm 이상: 가로 배치 (좌→우).
 *
 * MDX 호환을 위해 flat props 사용 (객체 리터럴은 MDX 파서 이슈).
 */

interface DecisionBridgeProps {
  fromSprint: number;
  fromLabel: string;
  toSprint: number;
  toLabel: string;
  insight: string;
  accent?: 1 | 2 | 3 | 4 | 5 | 6;
}

const ACCENT_GRADIENT: Record<number, { from: string; to: string }> = {
  1: { from: '#6366f1', to: '#818cf8' },
  2: { from: '#06b6d4', to: '#22d3ee' },
  3: { from: '#10b981', to: '#34d399' },
  4: { from: '#f59e0b', to: '#fbbf24' },
  5: { from: '#ec4899', to: '#f472b6' },
  6: { from: '#8b5cf6', to: '#a78bfa' },
};

const ACCENT_TEXT: Record<number, string> = {
  1: 'text-accent-1',
  2: 'text-accent-2',
  3: 'text-accent-3',
  4: 'text-accent-4',
  5: 'text-accent-5',
  6: 'text-accent-6',
};

export function DecisionBridge({
  fromSprint,
  fromLabel,
  toSprint,
  toLabel,
  insight,
  accent = 1,
}: DecisionBridgeProps) {
  const gradientId = `bridge-grad-${fromSprint}-${toSprint}`;
  const colors = ACCENT_GRADIENT[accent];

  return (
    <div className="my-6 not-prose">
      <div className="rounded-xl border border-border bg-diagram-bg p-4 shadow-sm sm:p-6">
        {/* 가로 레이아웃 (sm+) */}
        <div className="hidden sm:block">
          <div className="flex items-center gap-0">
            {/* FROM 노드 */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <span className={`text-3xl font-black ${ACCENT_TEXT[accent]}`}>
                S{fromSprint}
              </span>
              <span className="max-w-[140px] text-center text-xs leading-snug text-text-muted">
                {fromLabel}
              </span>
            </div>

            {/* 연결 브릿지 SVG */}
            <div className="relative mx-2 flex-1">
              <svg
                viewBox="0 0 200 40"
                className="h-10 w-full"
                preserveAspectRatio="none"
                aria-hidden
              >
                <defs>
                  <linearGradient id={gradientId}>
                    <stop offset="0%" stopColor={colors.from} />
                    <stop offset="100%" stopColor={colors.to} />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 20 C 50 5, 150 5, 200 20"
                  fill="none"
                  stroke={`url(#${gradientId})`}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="400"
                  strokeDashoffset="400"
                  className="animate-draw-bridge"
                />
                {/* 화살촉 */}
                <polygon
                  points="194,16 200,20 194,24"
                  fill={colors.to}
                  className="animate-draw-bridge"
                />
              </svg>
              {/* 인사이트 라벨 */}
              <div className="absolute inset-x-0 top-full mt-1 text-center">
                <span className="inline-block rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted">
                  {insight}
                </span>
              </div>
            </div>

            {/* TO 노드 */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <span className={`text-3xl font-black ${ACCENT_TEXT[accent]}`}>
                S{toSprint}
              </span>
              <span className="max-w-[140px] text-center text-xs leading-snug text-text-muted">
                {toLabel}
              </span>
            </div>
          </div>
        </div>

        {/* 세로 레이아웃 (모바일) */}
        <div className="flex flex-col items-center gap-2 sm:hidden">
          {/* FROM 노드 */}
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-black ${ACCENT_TEXT[accent]}`}>
              S{fromSprint}
            </span>
            <span className="text-xs leading-snug text-text-muted">
              {fromLabel}
            </span>
          </div>

          {/* 세로 브릿지 SVG */}
          <div className="relative h-16 w-10">
            <svg
              viewBox="0 0 40 60"
              className="h-full w-full"
              aria-hidden
            >
              <defs>
                <linearGradient
                  id={`${gradientId}-v`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={colors.from} />
                  <stop offset="100%" stopColor={colors.to} />
                </linearGradient>
              </defs>
              <path
                d="M 20 0 C 10 15, 30 45, 20 60"
                fill="none"
                stroke={`url(#${gradientId}-v)`}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="200"
                strokeDashoffset="200"
                className="animate-draw-bridge"
              />
              <polygon
                points="16,54 20,60 24,54"
                fill={colors.to}
                className="animate-draw-bridge"
              />
            </svg>
          </div>

          {/* 인사이트 */}
          <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted">
            {insight}
          </span>

          {/* TO 노드 */}
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-black ${ACCENT_TEXT[accent]}`}>
              S{toSprint}
            </span>
            <span className="text-xs leading-snug text-text-muted">
              {toLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
