/**
 * @file Button component (v2 design system)
 * @domain common
 * @layer component
 * @related Card, Input
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ─── VARIANTS ────────────────────────────────

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5',
    'whitespace-nowrap rounded-btn font-semibold tracking-[0.2px]',
    'cursor-pointer transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-primary text-white border-none',
          'hover:brightness-110',
          'active:scale-[0.98]',
        ],
        ghost: [
          'bg-transparent border border-border text-text-2',
          'hover:bg-bg-alt hover:text-text',
          'active:scale-[0.98]',
        ],
        secondary: [
          'bg-bg-alt text-text border-none',
          'hover:bg-border',
          'active:scale-[0.98]',
        ],
        danger: [
          'bg-error text-white border-none',
          'hover:brightness-110',
          'active:scale-[0.98]',
        ],
        outline: [
          'border border-primary text-primary bg-transparent',
          'hover:bg-primary hover:text-white',
          'active:scale-[0.98]',
        ],
        link: [
          'text-primary underline-offset-4 bg-transparent border-none',
          'hover:underline',
          'h-auto px-0 py-0',
        ],
      },
      size: {
        sm: 'px-[10px] py-[5px] text-[11px] [&_svg]:size-3.5',
        md: 'px-4 py-2 text-xs [&_svg]:size-4',
        lg: 'px-5 py-[10px] text-[13px] [&_svg]:size-5',
        icon: 'h-9 w-9 [&_svg]:size-4',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

// ─── TYPES ───────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  readonly asChild?: boolean;
}

// ─── RENDER ──────────────────────────────────

/**
 * Button component (primary/ghost/secondary/danger/outline/link)
 * @domain common
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
