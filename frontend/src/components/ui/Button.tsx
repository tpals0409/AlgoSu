import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Button — AlgoSu UI Design System
 *
 * 목업 스펙:
 *  공통: display inline-flex; align-items center; gap 6px;
 *        border-radius 6px; font-weight 600; letter-spacing 0.2px;
 *        cursor pointer; transition all 0.15s;
 *
 *  primary:   bg --color-main; color white; hover: 밝아지거나 채도 증가
 *  ghost:     bg transparent; border 1px solid border-color; color text2; hover bg bg2
 *  secondary: bg bg2; color text; hover bg bg3
 *
 *  size md: padding 8px 16px; font-size 12px;
 *  size sm: padding 5px 10px; font-size 11px;
 *  size lg: padding 10px 20px; font-size 13px;
 */

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5',
    'whitespace-nowrap rounded-btn font-semibold tracking-[0.2px]',
    'cursor-pointer transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-primary-500 text-white border-none',
          'hover:bg-primary-400',
          'active:scale-[0.98]',
        ],
        ghost: [
          'bg-transparent border border-border text-text2',
          'hover:bg-bg2 hover:text-foreground',
          'active:scale-[0.98]',
        ],
        secondary: [
          'bg-bg2 text-text1 border-none',
          'hover:bg-bg3',
          'active:scale-[0.98]',
        ],
        danger: [
          'bg-destructive text-destructive-foreground border-none',
          'hover:bg-destructive/90',
          'active:scale-[0.98]',
        ],
        outline: [
          'border border-primary-500 text-primary-500 bg-transparent',
          'hover:bg-primary-500 hover:text-white',
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

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  readonly asChild?: boolean;
}

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
