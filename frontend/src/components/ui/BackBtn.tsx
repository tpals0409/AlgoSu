/**
 * @file Back button (Button ghost pattern unified)
 * @domain common
 * @layer component
 * @related Button
 */

'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface BackBtnProps {
  readonly label?: string;
  readonly href?: string;
  readonly className?: string;
}

export function BackBtn({
  label,
  href,
  className,
}: BackBtnProps): ReactElement {
  const t = useTranslations('ui');
  const resolvedLabel = label ?? t('backBtn.defaultLabel');
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
      {resolvedLabel}
    </Button>
  );
}
