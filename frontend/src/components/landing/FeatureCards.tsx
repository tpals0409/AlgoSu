'use client';

import type { ReactNode } from 'react';
import { useState, useCallback } from 'react';
import { BookOpen, GitBranch, Zap, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';

/* ------------------------------------------------------------------ */
/*  Feature 데이터                                                      */
/* ------------------------------------------------------------------ */

interface Feature {
  id: string;
  icon: typeof BookOpen;
  title: string;
  description: string;
  detail: string;
  extra: () => ReactNode;
}

/** 난이도 뱃지 미리보기 */
function DifficultyExtra(): ReactNode {
  const levels = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'] as const;
  return (
    <div className="flex flex-wrap gap-1.5">
      {levels.map((d) => (
        <DifficultyBadge key={d} difficulty={d} />
      ))}
    </div>
  );
}

/** GitHub 커밋 미리보기 */
function GitHubExtra(): ReactNode {
  return (
    <div className="space-y-1.5 font-mono text-[11px] text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-success" />
        <span>feat: solve #1024 두 수의 합</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-success" />
        <span>feat: solve #2048 이진 탐색</span>
      </div>
    </div>
  );
}

/** AI 분석 점수 미리보기 */
function AIExtra(): ReactNode {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/15 text-sm font-bold text-primary-500">
        92
      </div>
      <div className="space-y-0.5 text-[11px]">
        <p className="font-medium text-foreground">코드 품질 점수</p>
        <p className="text-muted-foreground">가독성 · 효율성 · 정확성 종합 평가</p>
      </div>
    </div>
  );
}

const FEATURES: Feature[] = [
  {
    id: 'problems',
    icon: BookOpen,
    title: '다양한 알고리즘 문제',
    description: '난이도별로 분류된 알고리즘 문제를 풀고 실력을 키우세요.',
    detail:
      '브론즈부터 다이아몬드까지 5단계 난이도로 체계적으로 분류된 문제를 제공합니다. 스터디 그룹별 주차 문제 할당과 진행률 추적으로 함께 성장하세요.',
    extra: DifficultyExtra,
  },
  {
    id: 'github',
    icon: GitBranch,
    title: 'GitHub 자동 동기화',
    description: '제출한 코드가 자동으로 GitHub 저장소에 동기화됩니다.',
    detail:
      '문제를 제출하면 자동으로 GitHub 커밋이 생성됩니다. 잔디밭을 채우면서 알고리즘 풀이 이력을 깔끔하게 관리하세요.',
    extra: GitHubExtra,
  },
  {
    id: 'ai',
    icon: Zap,
    title: 'AI 코드 분석',
    description: 'AI가 제출 코드를 분석하고 개선 방향을 제안합니다.',
    detail:
      '제출 즉시 AI가 코드의 가독성, 시간·공간 복잡도, 엣지케이스 커버리지를 분석합니다. 구체적인 개선 제안으로 한 단계 더 성장할 수 있습니다.',
    extra: AIExtra,
  },
];

/* ------------------------------------------------------------------ */
/*  FeatureCards 컴포넌트                                                */
/* ------------------------------------------------------------------ */

export function FeatureCards(): ReactNode {
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleKeyDown = useCallback(
    (id: string, e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle(id);
      }
    },
    [toggle],
  );

  return (
    <section className="py-12">
      <h2 className="mb-8 text-center text-2xl font-semibold text-foreground">
        AlgoSu 주요 기능
      </h2>

      <div className="grid gap-6 sm:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          const Extra = feature.extra;
          const isOpen = openSet.has(feature.id);

          return (
            <Card
              key={feature.id}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={() => toggle(feature.id)}
              onKeyDown={(e) => handleKeyDown(feature.id, e)}
              className={cn(
                'cursor-pointer transition-all duration-200',
                'hover:shadow-medium',
                isOpen && 'border-primary shadow-medium',
              )}
            >
              <CardContent className="pt-6 text-center">
                {/* 아이콘 */}
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>

                {/* 제목 */}
                <h3 className="mb-2 font-semibold text-foreground">
                  {feature.title}
                </h3>

                {/* 요약 */}
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>

                {/* 토글 인디케이터 */}
                <ChevronDown
                  className={cn(
                    'mx-auto mt-3 h-4 w-4 text-muted-foreground transition-transform duration-200',
                    isOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
              </CardContent>

              {/* 디테일 패널 — max-height 트랜지션 */}
              <div
                className={cn(
                  'overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out',
                  isOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0',
                )}
              >
                <div className="mx-4 mb-4 rounded-lg bg-muted p-4 text-left">
                  <p className="mb-3 text-sm leading-relaxed text-foreground">
                    {feature.detail}
                  </p>
                  <Extra />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
