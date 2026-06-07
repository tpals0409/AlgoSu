/**
 * @file 퀴즈 시작 화면 — 분야·난이도·문항 수 선택
 * @domain quiz
 * @layer component
 * @related QuizPlay, QuizResult, src/data/quiz/index.ts, src/data/quiz/category-meta.ts
 */

'use client';

import { useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Brain, Shuffle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PillRadioGroup } from '@/components/quiz/PillRadioGroup';
import { QuizStats } from '@/components/quiz/QuizStats';
import { cn } from '@/lib/utils';
import type { QuizCategoryStat } from '@/lib/quiz/stats';
import {
  getAvailableCount,
  getQuizCategoryMeta,
  prefetchQuestions,
  QUIZ_CATEGORIES,
  QUIZ_DIFFICULTIES,
  type QuizCategory,
  type QuizDifficulty,
} from '@/data/quiz';

/** 선택 가능한 문항 수 옵션. */
const COUNT_OPTIONS = [5, 10] as const;

/** 난이도별 선택(활성) 상태 톤 — semantic 토큰 재사용 (EASY=success/MEDIUM=warning/HARD=error/ALL=primary). */
const DIFFICULTY_TONE: Record<QuizDifficulty | 'ALL', string> = {
  ALL: 'border-primary bg-primary-soft text-primary',
  EASY: 'border-success bg-success-soft text-success',
  MEDIUM: 'border-warning bg-warning-soft text-warning',
  HARD: 'border-error bg-error-soft text-error',
};

/** 비활성 pill 공통 톤. */
const INACTIVE_PILL = 'border-border text-text-3 hover:bg-bg-alt hover:text-text';

/** pill 버튼 공통 형태 클래스. */
const PILL_BASE =
  'inline-flex items-center gap-1.5 rounded-badge border px-3 py-1.5 text-xs font-medium transition-colors';

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

/** 분야 선택 옵션 — 'ALL'(전체) 을 맨 앞에 추가한 목록. */
const CATEGORY_OPTIONS: readonly (QuizCategory | 'ALL')[] = ['ALL', ...QUIZ_CATEGORIES];

interface QuizStartProps {
  /** 사용자가 분야·문항 수·난이도를 확정하고 시작할 때 호출 */
  readonly onStart: (
    category: QuizCategory | 'ALL',
    count: number,
    difficulty: QuizDifficulty | 'ALL',
  ) => void;
  /** 분야별 최고 점수 요약 ("내 기록" 영역, 비어 있으면 미표시) */
  readonly stats?: readonly QuizCategoryStat[];
}

/**
 * 퀴즈 시작 화면.
 * 출제 가능한 카테고리가 없으면 EmptyState를, 있으면 선택 UI를 렌더한다.
 * 분야 pill은 전용 accent 색·아이콘으로, 난이도 pill은 semantic 톤으로 구분한다.
 */
export function QuizStart({ onStart, stats = [] }: QuizStartProps): ReactElement {
  const t = useTranslations('quiz');
  const [category, setCategory] = useState<QuizCategory | 'ALL'>('ALL');
  const [count, setCount] = useState<number>(COUNT_OPTIONS[0]);
  const [difficulty, setDifficulty] = useState<QuizDifficulty | 'ALL'>('ALL');

  // 가용 풀에 따라 문항 수 옵션을 동적 산출하고, 선택값을 유효 범위로 클램프(파생값).
  const available = getAvailableCount(category, difficulty);
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
    <Card className="animate-fade-in space-y-6 p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-card bg-primary-soft text-primary">
          <Brain className="size-5" aria-hidden />
        </span>
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold text-text">{t('start.title')}</h1>
          <p className="text-sm text-text-3">{t('start.subtitle')}</p>
        </div>
      </div>

      <PillRadioGroup
        legend={t('start.categoryLabel')}
        options={CATEGORY_OPTIONS}
        value={category}
        onChange={setCategory}
        getOptionKey={(option) => option}
        getOptionClassName={(option, active) =>
          cn(
            PILL_BASE,
            !active
              ? INACTIVE_PILL
              : option === 'ALL'
                ? 'border-primary bg-primary-soft text-primary'
                : '',
          )
        }
        getOptionStyle={(option, active): CSSProperties | undefined => {
          if (!active || option === 'ALL') return undefined;
          const meta = getQuizCategoryMeta(option);
          return { color: meta.colorVar, backgroundColor: meta.bgVar, borderColor: meta.colorVar };
        }}
        renderOption={(option) => {
          if (option === 'ALL') {
            return (
              <>
                <Shuffle className="size-3.5" aria-hidden />
                {t('categories.ALL')}
              </>
            );
          }
          const Icon = getQuizCategoryMeta(option).icon;
          return (
            <>
              <Icon className="size-3.5" aria-hidden />
              {t(`categories.${option}`)}
            </>
          );
        }}
      />

      <PillRadioGroup
        legend={t('start.difficultyLabel')}
        options={QUIZ_DIFFICULTIES}
        value={difficulty}
        onChange={setDifficulty}
        getOptionKey={(option) => option}
        getOptionClassName={(option, active) =>
          cn(PILL_BASE, active ? DIFFICULTY_TONE[option] : INACTIVE_PILL)
        }
        renderOption={(option) => t(`difficulties.${option}`)}
      />

      <PillRadioGroup
        legend={t('start.countLabel')}
        options={effectiveCounts}
        value={selectedCount}
        onChange={setCount}
        getOptionKey={(option) => String(option)}
        getOptionClassName={(_option, active) =>
          cn(PILL_BASE, active ? 'border-primary bg-primary-soft text-primary' : INACTIVE_PILL)
        }
        renderOption={(option) => option}
      />

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={selectedCount < 1}
        onClick={() => onStart(category, selectedCount, difficulty)}
        onMouseEnter={() => prefetchQuestions(category)}
        onFocus={() => prefetchQuestions(category)}
      >
        {t('start.startButton')}
      </Button>

      <QuizStats stats={stats} />
    </Card>
  );
}
