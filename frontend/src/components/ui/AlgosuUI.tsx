/**
 * AlgoSu unified UI components
 * Button, Difficulty types & config
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
// ── Types & constants (extracted from v3.0 mock data) ────────────────────────

export type Difficulty = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'RUBY';

export const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; bg: string }> = {
  BRONZE:   { label: 'Bronze',   color: 'var(--diff-bronze-color)',   bg: 'var(--diff-bronze-bg)' },
  SILVER:   { label: 'Silver',   color: 'var(--diff-silver-color)',   bg: 'var(--diff-silver-bg)' },
  GOLD:     { label: 'Gold',     color: 'var(--diff-gold-color)',     bg: 'var(--diff-gold-bg)' },
  PLATINUM: { label: 'Platinum', color: 'var(--diff-platinum-color)', bg: 'var(--diff-platinum-bg)' },
  DIAMOND:  { label: 'Diamond',  color: 'var(--diff-diamond-color)',  bg: 'var(--diff-diamond-bg)' },
  RUBY:     { label: 'Ruby',     color: 'var(--diff-ruby-color)',     bg: 'var(--diff-ruby-bg)' },
};

// ── Button ──────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'outline';
type BtnSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  children: ReactNode;
}

const btnBase = 'inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 shrink-0';

const btnVariants: Record<BtnVariant, string> = {
  primary: 'text-white hover:brightness-110 active:brightness-95',
  ghost:   'hover:bg-bg-alt active:bg-bg-alt',
  danger:  'text-white hover:brightness-110 active:brightness-95',
  outline: 'border hover:bg-bg-alt',
};

const btnSizes: Record<BtnSize, string> = {
  sm: 'h-8 px-3 text-[12px] rounded-btn',
  md: 'h-9 px-4 text-[13px] rounded-btn',
  lg: 'h-10 px-5 text-sm rounded-btn',
};

export function Btn({ variant = 'ghost', size = 'md', className, style, children, ...props }: ButtonProps) {
  const colorStyle: React.CSSProperties =
    variant === 'primary' ? { background: 'var(--primary)', ...style } :
    variant === 'danger'  ? { background: 'var(--error)', ...style } :
    variant === 'outline' ? { borderColor: 'var(--border)', color: 'var(--text-2)', ...style } :
    { color: 'var(--text-2)', ...style };

  return (
    <button
      type="button"
      className={cn(btnBase, btnVariants[variant], btnSizes[size], className)}
      style={colorStyle}
      {...props}
    >
      {children}
    </button>
  );
}
