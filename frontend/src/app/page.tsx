import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { BookOpen, GitBranch, Zap } from 'lucide-react';

const FEATURES = [
  {
    icon: BookOpen,
    title: '다양한 알고리즘 문제',
    description: '난이도별로 분류된 알고리즘 문제를 풀고 실력을 키우세요.',
  },
  {
    icon: GitBranch,
    title: 'GitHub 자동 동기화',
    description: '제출한 코드가 자동으로 GitHub 저장소에 동기화됩니다.',
  },
  {
    icon: Zap,
    title: 'AI 코드 분석',
    description: 'AI가 제출 코드를 분석하고 개선 방향을 제안합니다.',
  },
] as const;

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

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" variant="primary">
              <Link href="/problems">문제 목록 보기</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/register">무료로 시작하기</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 기능 소개 섹션 */}
      <section className="py-12">
        <h2 className="mb-8 text-center text-2xl font-semibold text-foreground">
          AlgoSu 주요 기능
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title}>
                <CardContent className="pt-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="py-12 text-center">
        <div className="mx-auto max-w-md space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">지금 바로 시작하세요</h2>
          <p className="text-muted-foreground">
            AlgoSu 스터디에 참여하고 실력을 향상시키세요.
          </p>
          <Button asChild size="lg" variant="primary">
            <Link href="/register">회원가입</Link>
          </Button>
        </div>
      </section>
    </AppLayout>
  );
}
