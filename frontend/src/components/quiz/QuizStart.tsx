/**
 * @file 퀴즈 시작 화면 — 분야·문항 수 선택
 * @domain quiz
 * @layer component
 * @related QuizPlay, QuizResult, src/data/quiz/index.ts
 */

'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Brain } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import {
  getQuestionsByFilter,
  QUIZ_CATEGORIES,
  QUIZ_DIFFICULTIES,
  type QuizCategory,
  type QuizDifficulty,
} from '@/data/quiz';

/** 선택 가능한 문항 수 옵션. */
const COUNT_OPTIONS = [5, 10] as const;

/**
 * 가용 풀 크기에 맞는 문항 수 옵션을 산출한다.
 * 풀이 가장 작은 고정 옵션(5)보다 작으면 가용 전체를 단일 옵션으로 제시한다.
 *
 * @param available 현재 (분야, 난이도) 조합의 가용 문항 수
 * @returns 선택 가능한 문항 수 옵션 (오름차순, 최소 1개)
 */
function resolveCountOptions(available: number): number[] {
  const withinPool = COUNT_OPTIONS.filter((option) => option <= available);
  return withinPool.length > 0 ? withinPool : [Math.max(0, available)];
}

interface QuizStartProps {
  /** 사용자가 분야·문항 수·난이도를 확정하고 시작할 때 호출 */
  readonly onStart: (
    category: QuizCategory,
    count: number,
    difficulty: QuizDifficulty | 'ALL',
  ) => void;
}

/**
 * 퀴즈 시작 화면.
 * 출제 가능한 카테고리가 없으면 EmptyState를, 있으면 선택 UI를 렌더한다.
 */
export function QuizStart({ onStart }: QuizStartProps): ReactElement {
  const t = useTranslations('quiz');
  const [category, setCategory] = useState<QuizCategory>(QUIZ_CATEGORIES[0]);
  const [count, setCount] = useState<number>(COUNT_OPTIONS[0]);
  const [difficulty, setDifficulty] = useState<QuizDifficulty | 'ALL'>('ALL');

  // 가용 풀에 따라 문항 수 옵션을 동적 산출하고, 선택값을 유효 범위로 클램프(파생값).
  const available = getQuestionsByFilter(category, difficulty).length;
  const effectiveCounts = resolveCountOptions(available);
  const selectedCount = effectiveCounts.includes(count)
    ? count
    : Math.max(...effectiveCounts);

  if (QUIZ_CATEGORIES.length === 0) {
    return (
      <EmptyState icon={Brain} title={t('start.empty')} description={t('start.emptyDesc')} />
    );
  }

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-text">{t('start.title')}</h1>
        <p className="text-sm text-text-3">{t('start.subtitle')}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-text-2">{t('start.categoryLabel')}</legend>
        <div className="flex flex-wrap gap-2">
          {QUIZ_CATEGORIES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={category === option}
              onClick={() => setCategory(option)}
              className={cn(
                'rounded-badge border px-3 py-1.5 text-xs font-medium transition-colors',
                category === option
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border text-text-3 hover:bg-bg-alt hover:text-text',
              )}
            >
              {t(`categories.${option}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-text-2">{t('start.difficultyLabel')}</legend>
        <div className="flex flex-wrap gap-2">
          {QUIZ_DIFFICULTIES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={difficulty === option}
              onClick={() => setDifficulty(option)}
              className={cn(
                'rounded-badge border px-3 py-1.5 text-xs font-medium transition-colors',
                difficulty === option
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border text-text-3 hover:bg-bg-alt hover:text-text',
              )}
            >
              {t(`difficulties.${option}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-text-2">{t('start.countLabel')}</legend>
        <div className="flex flex-wrap gap-2">
          {effectiveCounts.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={selectedCount === option}
              onClick={() => setCount(option)}
              className={cn(
                'rounded-badge border px-3 py-1.5 text-xs font-medium transition-colors',
                selectedCount === option
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border text-text-3 hover:bg-bg-alt hover:text-text',
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </fieldset>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={selectedCount < 1}
        onClick={() => onStart(category, selectedCount, difficulty)}
      >
        {t('start.startButton')}
      </Button>
    </Card>
  );
}
