/**
 * @file 노드 그래프 로고 (시안 B 확정)
 * @domain common
 * @layer component
 *
 * 4 노드 + 엣지 + 대각선, gradient fill SVG.
 * size, primary, accent props로 크기/색상 제어.
 */

import type { ReactElement } from 'react';

interface LogoProps {
  readonly size?: number;
  readonly primary?: string;
  readonly accent?: string;
  readonly className?: string;
}

export function Logo({
  size = 28,
  primary = 'var(--primary)',
  accent = 'var(--accent)',
  className,
}: LogoProps): ReactElement {
  const gradientId = `logo-grad-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-label="AlgoSu"
    >
      <rect width="40" height="40" rx="8" fill={`url(#${gradientId})`} />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="40" y2="40">
          <stop stopColor={primary} />
          <stop offset="1" stopColor={accent} />
        </linearGradient>
      </defs>
      <line x1="14" y1="14" x2="26" y2="14" stroke="#fff" strokeWidth="1.5" opacity=".4" />
      <line x1="14" y1="14" x2="14" y2="26" stroke="#fff" strokeWidth="1.5" opacity=".4" />
      <line x1="14" y1="26" x2="26" y2="26" stroke="#fff" strokeWidth="1.5" opacity=".4" />
      <line x1="26" y1="14" x2="26" y2="26" stroke="#fff" strokeWidth="1.5" opacity=".4" />
      <line x1="14" y1="14" x2="26" y2="26" stroke="#fff" strokeWidth="1.5" opacity=".3" />
      <circle cx="14" cy="14" r="3.5" fill="#fff" />
      <circle cx="26" cy="14" r="3" fill="#fff" opacity=".7" />
      <circle cx="14" cy="26" r="3" fill="#fff" opacity=".7" />
      <circle cx="26" cy="26" r="3.5" fill="#fff" />
    </svg>
  );
}
