/**
 * @file Card component (v2 design system)
 * @domain common
 * @layer component
 * @related Badge, Button
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

// ─── CARD ────────────────────────────────────

/**
 * Card root component (v2 shadow + rounded-card + hover)
 * @domain common
 */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-card border border-border bg-bg-card text-text p-4 shadow-card',
        'transition-all duration-300',
        'hover:shadow-card-hover',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

// ─── CARD HEADER ─────────────────────────────

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5 px-6 pt-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

// ─── CARD TITLE ──────────────────────────────

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'text-base font-semibold leading-tight tracking-tight text-text',
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

// ─── CARD DESCRIPTION ────────────────────────

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-text-2', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

// ─── CARD CONTENT ────────────────────────────

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-6 py-4', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

// ─── CARD FOOTER ─────────────────────────────

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center border-t border-border px-6 pb-6 pt-4',
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
