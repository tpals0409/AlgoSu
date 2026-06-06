"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from '@/lib/utils';

/**
 * 진행률 표시 바.
 *
 * `value`를 `ProgressPrimitive.Root`에 명시 전달해 Radix가 `role="progressbar"`의
 * `aria-valuenow`/`aria-valuemin`/`aria-valuemax`를 자동 부여하도록 한다(소비처에서 별도
 * 보정 불필요 — Sprint 223). 사용자가 넘긴 `aria-*`(예: `aria-label`, 커스텀 `aria-valuetext`)는
 * 뒤의 `{...props}`로 override 가능하다.
 *
 * @param value 0~100 진행 비율(number). 미지정/null이면 indeterminate(aria-valuenow 미노출).
 */
function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className,
      )}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="bg-primary h-full w-full flex-1 transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
