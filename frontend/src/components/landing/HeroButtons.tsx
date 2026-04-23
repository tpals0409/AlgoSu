/**
 * @file Hero 섹션 CTA 버튼 (번역 적용)
 * @domain common
 * @layer component
 * @related Button, AuthContext, LandingContent
 */

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/**
 * Landing Hero CTA 버튼 그룹
 * @domain common
 */
export function HeroButtons(): ReactNode {
  const t = useTranslations('landing');

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex justify-center gap-3">
        <Button asChild size="lg" variant="primary" className="shadow-glow">
          <Link href="/login" className="flex items-center gap-2">
            {t('cta.primary')} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href="#features">{t('cta.secondary')}</Link>
        </Button>
      </div>
    </div>
  );
}
