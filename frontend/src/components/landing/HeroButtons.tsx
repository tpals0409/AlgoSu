/**
 * @file Hero 섹션 CTA 버튼
 * @domain common
 * @layer component
 * @related Button, AuthContext
 */

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

/**
 * Landing Hero CTA 버튼 그룹
 * @domain common
 */
export function HeroButtons(): ReactNode {
  return (
    <div className="flex justify-center gap-3">
      <Button asChild size="lg" variant="primary" className="shadow-[0_4px_20px_rgba(124,106,174,0.35)]">
        <Link href="/login">무료로 시작하기</Link>
      </Button>
      <Button asChild size="lg" variant="ghost">
        <Link href="#features">둘러보기</Link>
      </Button>
    </div>
  );
}
