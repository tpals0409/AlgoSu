/**
 * @file 빈 상태 안내 컴포넌트 (아이콘 + 메시지 + 액션)
 * @domain common
 * @layer component
 * @related Button, Card
 */
import * as React from 'react';
import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly icon?: LucideIcon;
  readonly title: string;
  readonly description?: string;
  readonly action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  };
  readonly size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: { wrapper: 'py-8 gap-3', icon: 'h-8 w-8', iconWrapper: 'p-3', title: 'text-sm font-medium', description: 'text-xs' },
  md: { wrapper: 'py-16 gap-4', icon: 'h-10 w-10', iconWrapper: 'p-4', title: 'text-base font-semibold', description: 'text-sm' },
  lg: { wrapper: 'py-24 gap-5', icon: 'h-12 w-12', iconWrapper: 'p-5', title: 'text-lg font-semibold', description: 'text-base' },
} as const;

function EmptyState({ className, icon: Icon = Inbox, title, description, action, size = 'md', ...props }: EmptyStateProps): React.ReactElement {
  const sizes = SIZE_CLASSES[size];
  return (
    <div role="status" className={cn('flex flex-col items-center justify-center text-center', sizes.wrapper, className)} {...props}>
      <div className={cn('rounded-full bg-muted-soft', sizes.iconWrapper)} aria-hidden>
        <Icon className={cn(sizes.icon, 'text-text-3')} strokeWidth={1.5} aria-hidden />
      </div>
      <div className="space-y-1.5">
        <p className={cn(sizes.title, 'text-text')}>{title}</p>
        {description && (
          <p className={cn(sizes.description, 'max-w-sm text-text-3')}>{description}</p>
        )}
      </div>
      {action && (
        <Button variant={action.variant ?? 'primary'} size="md" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export { EmptyState };
