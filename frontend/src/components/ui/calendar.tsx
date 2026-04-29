/**
 * @file Calendar 래퍼 — react-day-picker v9 호환 + ko locale 기본값
 * @domain common
 * @layer component
 * @related react-day-picker, AddProblemModal, problems/create, problems/[id]/edit
 */
'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';

import { cn } from '@/lib/utils';
import { buttonVariants } from './Button';

/**
 * react-day-picker v9 캘린더 — AlgoSu 디자인 토큰 적용 + 한국어 로케일 기본값.
 *
 * v9는 v8 대비 className 키가 대거 변경되어 새 스키마로 매핑함:
 * - caption → month_caption
 * - nav_button_previous/next → button_previous/next
 * - table → month_grid, head_row → weekdays, head_cell → weekday
 * - row → week, cell → day, day → day_button
 *
 * `locale` prop 기본값은 한국어. 다른 언어로 사용 시 props.locale로 override.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale = ko,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={locale}
      className={cn('relative p-3 mx-auto w-fit', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-2',
        month: 'flex flex-col gap-4',
        month_caption: 'flex justify-center pt-1 relative items-center w-full',
        caption_label: 'text-sm font-medium text-text',
        nav: 'flex items-center gap-1 absolute inset-x-3 top-3 justify-between z-10 pointer-events-none [&>button]:pointer-events-auto',
        button_previous: cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'h-7 w-7 p-0 opacity-60 hover:opacity-100',
        ),
        button_next: cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'h-7 w-7 p-0 opacity-60 hover:opacity-100',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'grid grid-cols-7',
        weekday: 'h-8 text-[11px] font-normal text-text-3 text-center leading-8',
        weeks: 'flex flex-col gap-1 mt-1',
        week: 'grid grid-cols-7',
        day: 'relative h-9 w-9 p-0 text-center text-[13px] flex items-center justify-center',
        day_button: cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'h-8 w-8 p-0 font-normal rounded-md',
          'data-[selected-single=true]:bg-primary data-[selected-single=true]:text-bg-card data-[selected-single=true]:font-semibold data-[selected-single=true]:hover:bg-primary',
          'data-[range-start=true]:bg-primary data-[range-start=true]:text-bg-card',
          'data-[range-end=true]:bg-primary data-[range-end=true]:text-bg-card',
          'data-[range-middle=true]:bg-primary-soft data-[range-middle=true]:text-text',
        ),
        selected: '',
        today: 'font-semibold text-primary underline underline-offset-4 decoration-primary/40',
        outside: 'text-text-3/50',
        disabled: 'text-text-3 opacity-40 cursor-not-allowed',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevClassName, ...chevProps }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('h-4 w-4', chevClassName)} {...chevProps} />
          ) : (
            <ChevronRight className={cn('h-4 w-4', chevClassName)} {...chevProps} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
