/**
 * @file Hero 섹션 CTA 버튼
 * @domain common
 * @layer component
 * @related Button, AuthContext
 */

'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Landing Hero CTA 버튼 그룹
 * @domain common
 */
export function HeroButtons(): ReactNode {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex justify-center gap-3">
        <Button asChild size="lg" variant="primary" className="shadow-glow">
          <Link href="/login" className="flex items-center gap-2">
            무료로 시작하기 <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href="#features">핵심 기능</Link>
        </Button>
      </div>
    </div>
  );
}
