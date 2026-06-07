/**
 * @file 시작 화면 "내 기록" — 분야별 최고 점수 요약 막대
 * @domain quiz
 * @layer component
 * @related QuizStart, src/lib/quiz/stats.ts, src/data/quiz/category-meta.ts
 *
 * Sprint 224: 분야별 최고 점수를 분야 accent 색 막대로 표시한다.
 * 기록이 없으면 렌더하지 않는다(부모가 빈 영역을 노출하지 않도록 null 반환).
 */

'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { getQuizCategoryMeta } from '@/data/quiz';
import type { QuizCategoryStat } from '@/lib/quiz/stats';

interface QuizStatsProps {
  /** 분야별 최고 점수 요약 (점수 내림차순, 빈 배열이면 미렌더) */
  readonly stats: readonly QuizCategoryStat[];
}

/**
 * 분야별 최고 점수를 accent 색 막대로 요약 표시한다.
 * 각 막대는 progressbar 시맨틱을 가지며, 분야 아이콘은 장식이라 aria-hidden 처리한다.
 *
 * @param stats 분야별 최고 점수 (비어 있으면 null 반환)
 */
export function QuizStats({ stats }: QuizStatsProps): ReactElement | null {
  const t = useTranslations('quiz');

  if (stats.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 border-t border-border pt-5" aria-label={t('stats.title')}>
      <h2 className="text-xs font-medium text-text-2">{t('stats.title')}</h2>
      <ul className="space-y-2.5">
        {stats.map(({ category, bestPercent }) => {
          const meta = getQuizCategoryMeta(category);
          const Icon = meta.icon;
          return (
            <li key={category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 text-text-2">
                  <span className="inline-flex" style={{ color: meta.colorVar }}>
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  {t(`categories.${category}`)}
                </span>
                <span className="font-mono font-semibold" style={{ color: meta.colorVar }}>
                  {bestPercent}%
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-bg-alt"
                role="progressbar"
                aria-valuenow={bestPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('stats.scoreAria', {
                  category: t(`categories.${category}`),
                  score: bestPercent,
                })}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-bounce"
                  style={{ width: `${bestPercent}%`, backgroundColor: meta.colorVar }}
                  aria-hidden
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
