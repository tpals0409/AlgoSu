/**
 * @file 뒤로가기 버튼 (Button ghost 패턴 통일)
 * @domain common
 * @layer component
 * @related Button
 */

'use client';

import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface BackBtnProps {
  readonly label?: string;
  readonly href?: string;
  readonly className?: string;
}

export function BackBtn({
  label = '뒤로',
  href,
  className,
}: BackBtnProps): ReactElement {
  const router = useRouter();

  const handleClick = (): void => {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={className}
    >
      <ChevronLeft aria-hidden="true" />
      {label}
    </Button>
  );
}
