/**
 * AlgoSu unified UI components
 * Button, Badge, DiffBadge, StatusBadge, EmptyState, ScoreGauge, PageHeader, StatCard
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { toTierLevel } from '@/lib/constants';
// ── Types & constants (extracted from v3.0 mock data) ────────────────────────

export type Difficulty = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'RUBY';
export type SagaStep = 'DONE' | 'AI_QUEUED' | 'GITHUB_QUEUED' | 'FAILED' | 'PENDING';

export const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; bg: string }> = {
  BRONZE:   { label: 'Bronze',   color: 'var(--diff-bronze-color)',   bg: 'var(--diff-bronze-bg)' },
  SILVER:   { label: 'Silver',   color: 'var(--diff-silver-color)',   bg: 'var(--diff-silver-bg)' },
  GOLD:     { label: 'Gold',     color: 'var(--diff-gold-color)',     bg: 'var(--diff-gold-bg)' },
  PLATINUM: { label: 'Platinum', color: 'var(--diff-platinum-color)', bg: 'var(--diff-platinum-bg)' },
  DIAMOND:  { label: 'Diamond',  color: 'var(--diff-diamond-color)',  bg: 'var(--diff-diamond-bg)' },
  RUBY:     { label: 'Ruby',     color: 'var(--diff-ruby-color)',     bg: 'var(--diff-ruby-bg)' },
};

export const SAGA_CONFIG: Record<SagaStep, { label: string; color: string; bg: string }> = {
  DONE:          { label: '분석 완료', color: 'var(--success)', bg: 'var(--success-soft)' },
  AI_QUEUED:     { label: '분석 중',   color: 'var(--warning)', bg: 'var(--warning-soft)' },
  GITHUB_QUEUED: { label: 'GitHub 동기화', color: 'var(--info)', bg: 'var(--info-soft)' },
  FAILED:        { label: '실패',      color: 'var(--error)',   bg: 'var(--error-soft)' },
  PENDING:       { label: '대기 중',   color: 'var(--text-3)',  bg: 'var(--bg-alt)' },
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

// ── Badge ───────────────────────────────────────────────────────────────────

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'muted' | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  dot?: boolean;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const badgeColors: Record<BadgeVariant, { color: string; bg: string }> = {
  primary: { color: 'var(--primary)',  bg: 'var(--primary-soft)' },
  success: { color: 'var(--success)',  bg: 'var(--success-soft)' },
  warning: { color: 'var(--warning)',  bg: 'var(--warning-soft)' },
  error:   { color: 'var(--error)',    bg: 'var(--error-soft)' },
  info:    { color: 'var(--info)',     bg: 'var(--info-soft)' },
  muted:   { color: 'var(--text-3)',   bg: 'var(--bg-alt)' },
  default: { color: 'var(--text-2)',   bg: 'var(--bg-alt)' },
};

export function AlgoBadge({ variant = 'default', dot, children, className, style }: BadgeProps) {
  const { color, bg } = badgeColors[variant];
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', className)}
      style={{ color, background: bg, ...style }}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />}
      {children}
    </span>
  );
}

// ── DiffBadge ───────────────────────────────────────────────────────────────

export function DiffBadge({ difficulty, level }: { difficulty: Difficulty; level?: number | null }) {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const lv = level ?? null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />
      {cfg.label}{toTierLevel(lv) !== null ? ` ${toTierLevel(lv)}` : ''}
    </span>
  );
}

// ── SagaBadge ───────────────────────────────────────────────────────────────

export function SagaBadge({ step }: { step: SagaStep }) {
  const cfg = SAGA_CONFIG[step];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {step === 'DONE' && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />}
      {cfg.label}
    </span>
  );
}

// ── StatusBadge ─────────────────────────────────────────────────────────────

export function ProblemStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = { ACTIVE: 'success', CLOSED: 'muted', DRAFT: 'warning' };
  const labels: Record<string, string> = { ACTIVE: '진행 중', CLOSED: '종료', DRAFT: '초안' };
  return <AlgoBadge variant={map[status] ?? 'muted'} dot={status === 'ACTIVE'}>{labels[status] ?? status}</AlgoBadge>;
}

// ── EmptyState ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--primary-soft)' }}>
        <Icon className="h-5 w-5" style={{ color: 'var(--primary)' }} aria-hidden />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</p>
      {description && <p className="mt-1 text-[12px]" style={{ color: 'var(--text-3)' }}>{description}</p>}
      {action && (
        <Btn variant="primary" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Btn>
      )}
    </div>
  );
}

// ── ScoreGauge ───────────────────────────────────────────────────────────────

export function ScoreGauge({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = size * 0.072;
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * score) / 100;
  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--error)';

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-alt)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-bold leading-none" style={{ fontSize: size * 0.24, color }}>{score}</span>
        <span className="mt-0.5 font-mono" style={{ fontSize: size * 0.1, color: 'var(--text-3)' }}>/ 100</span>
      </div>
    </div>
  );
}

// ── PageHeader ──────────────────────────────────────────────────────────────

export function PageHeader({
  title, subtitle, action, back
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        {back}
        <div>
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs" style={{ color: 'var(--text-3)' }}>{subtitle}</p>}
        </div>
      </div>
      {action && (
        <div className="flex items-center gap-2 sm:shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}

// ── StatCard ────────────────────────────────────────────────────────────────

export function StatCard({
  icon: Icon, label, value, color = 'var(--text)', onClick, hideValue, primary,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: string;
  onClick?: () => void;
  hideValue?: boolean;
  primary?: boolean;
}) {
  const El = onClick ? 'button' : 'div';

  if (primary) {
    return (
      <El
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={cn(
          'rounded-card border p-5 flex items-center gap-3 w-full',
          onClick && 'cursor-pointer transition-all hover:-translate-y-0.5 active:scale-[0.98]',
        )}
        style={{
          background: 'var(--gradient-brand)',
          borderColor: 'transparent',
          boxShadow: '0 6px 24px color-mix(in srgb, var(--primary) 35%, transparent)',
        } as React.CSSProperties}
      >
        {/* 아이콘 */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--on-primary-soft)' }}
        >
          <Icon className="h-5 w-5" style={{ color: 'var(--on-primary)' }} aria-hidden />
        </div>

        {/* 텍스트 */}
        <div className="flex-1 text-left">
          <p className="text-[15px] font-bold leading-tight" style={{ color: 'var(--on-primary)' }}>{label}</p>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--on-primary-muted)' }}>입장하기</p>
        </div>

        {/* 화살표 */}
        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--on-primary-icon)' }} aria-hidden />
      </El>
    );
  }

  return (
    <El
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-card border p-5 flex items-center gap-3',
        onClick && 'cursor-pointer transition-all hover:shadow-hover hover:-translate-y-0.5',
      )}
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' } as React.CSSProperties}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ background: 'var(--bg-alt)' }}>
        <Icon className="h-4 w-4" style={{ color: 'var(--primary)' }} aria-hidden />
      </div>
      <div>
        {hideValue ? (
          <p className="text-[15px] font-bold leading-snug" style={{ color }}>{label}</p>
        ) : (
          <>
            <p className="font-mono text-[26px] font-bold leading-none tracking-tight" style={{ color }}>{value}</p>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-3)' }}>{label}</p>
          </>
        )}
      </div>
    </El>
  );
}

// ── Card wrappers ────────────────────────────────────────────────────────────

export function ACard({ children, className, style, onClick }: { children: ReactNode; className?: string; style?: React.CSSProperties; onClick?: React.MouseEventHandler<HTMLDivElement> }) {
  return (
    <div
      className={cn('rounded-card border', className)}
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)', ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

export function CardDivider() {
  return <div className="border-t" style={{ borderColor: 'var(--border)' }} />;
}

// ── Input ────────────────────────────────────────────────────────────────────

export function AlgoInput({
  label, error, hint, className, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>{label}</label>}
      <input
        className={cn(
          'h-9 w-full rounded-btn border px-3 text-[13px] outline-none transition-[border-color] duration-150 placeholder:text-text-3',
          'focus:border-primary',
          error && 'border-error',
          className,
        )}
        style={{ background: 'var(--input-bg)', borderColor: error ? 'var(--error)' : 'var(--border)', color: 'var(--text)' }}
        {...props}
      />
      {error && <p className="text-[11px]" style={{ color: 'var(--error)' }}>{error}</p>}
      {hint && !error && <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{hint}</p>}
    </div>
  );
}

// ── Textarea ─────────────────────────────────────────────────────────────────

export function AlgoTextarea({
  label, error, className, ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>{label}</label>}
      <textarea
        rows={4}
        className={cn(
          'w-full rounded-btn border px-3 py-2 text-[13px] outline-none transition-[border-color] duration-150 resize-none placeholder:text-text-3 focus:border-primary',
          error && 'border-error',
          className,
        )}
        style={{ background: 'var(--input-bg)', borderColor: error ? 'var(--error)' : 'var(--border)', color: 'var(--text)' }}
        {...props}
      />
      {error && <p className="text-[11px]" style={{ color: 'var(--error)' }}>{error}</p>}
    </div>
  );
}

// ── Alert ────────────────────────────────────────────────────────────────────

type AlertVariant = 'error' | 'warning' | 'success' | 'info';
const alertColors: Record<AlertVariant, { border: string; bg: string; text: string }> = {
  error:   { border: 'var(--error)',   bg: 'var(--error-soft)',   text: 'var(--error)' },
  warning: { border: 'var(--warning)', bg: 'var(--warning-soft)', text: 'var(--warning)' },
  success: { border: 'var(--success)', bg: 'var(--success-soft)', text: 'var(--success)' },
  info:    { border: 'var(--info)',    bg: 'var(--info-soft)',    text: 'var(--info)' },
};

export function AlgoAlert({
  variant = 'info', title, children, onClose,
}: {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const c = alertColors[variant];
  return (
    <div
      className="flex items-start gap-3 rounded-card border px-4 py-3"
      style={{ background: c.bg, borderColor: `${c.border}30` }}
    >
      <div className="flex-1 text-[12px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
        {title && <p className="mb-0.5 font-semibold" style={{ color: c.text }}>{title}</p>}
        {children}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity" style={{ color: c.text }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn('animate-pulse rounded-card', className)}
      style={{ background: 'var(--bg-alt)', ...style }}
    />
  );
}

// ── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 16 : size === 'lg' ? 40 : 24;
  return (
    <svg
      width={s} height={s} viewBox="0 0 24 24" fill="none"
      className="animate-spin" style={{ color: 'var(--primary)' }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── LangBadge ────────────────────────────────────────────────────────────────

const LANG_COLORS: Record<string, { color: string; bg: string }> = {
  python: { color: 'var(--lang-python-color)', bg: 'var(--lang-python-bg)' },
  java:   { color: 'var(--lang-java-color)',   bg: 'var(--lang-java-bg)' },
  cpp:    { color: 'var(--lang-cpp-color)',     bg: 'var(--lang-cpp-bg)' },
  c:      { color: 'var(--lang-c-color)',       bg: 'var(--lang-c-bg)' },
  js:     { color: 'var(--lang-js-color)',      bg: 'var(--lang-js-bg)' },
  ts:     { color: 'var(--lang-ts-color)',      bg: 'var(--lang-ts-bg)' },
  kotlin: { color: 'var(--lang-kotlin-color)',  bg: 'var(--lang-kotlin-bg)' },
  go:     { color: 'var(--lang-go-color)',      bg: 'var(--lang-go-bg)' },
  rust:   { color: 'var(--lang-rust-color)',    bg: 'var(--lang-rust-bg)' },
};

export function LangBadge({ language }: { language: string }) {
  const lang = language.toLowerCase();
  const cfg = LANG_COLORS[lang] ?? { color: 'var(--text-3)', bg: 'var(--bg-alt)' };
  return (
    <span
      className="inline-flex items-center rounded-badge px-2 py-0.5 text-[10px] font-semibold font-mono uppercase"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {language}
    </span>
  );
}

// ── TabBar ────────────────────────────────────────────────────────────────────

export function TabBar({
  tabs, active, onChange,
}: {
  tabs: { key: string; label: string; icon?: React.ElementType }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div
      className="flex gap-1 rounded-card border p-1"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-btn py-1.5 text-[13px] font-medium transition-all duration-150',
              active === tab.key
                ? 'bg-primary text-white'
                : 'text-text-3 hover:text-text hover:bg-bg-alt',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}