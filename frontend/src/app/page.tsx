import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { HeroButtons } from '@/components/landing/HeroButtons';
import { FeatureCards } from '@/components/landing/FeatureCards';

const DIFFICULTY_EXAMPLES = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const;

export default function HomePage(): ReactNode {
  return (
    <AppLayout>
      {/* 히어로 섹션 */}
      <section className="py-16 text-center">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex justify-center gap-2">
            {DIFFICULTY_EXAMPLES.map((d) => (
              <DifficultyBadge key={d} difficulty={d} />
            ))}
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            알고리즘 스터디를{' '}
            <span className="text-primary">더 스마트하게</span>
          </h1>

          <p className="text-lg text-muted-foreground">
            문제 풀이부터 GitHub 동기화, AI 분석까지 — AlgoSu와 함께하세요.
          </p>

          <HeroButtons />
        </div>
      </section>

      {/* 기능 소개 섹션 */}
      <FeatureCards />
    </AppLayout>
  );
}
