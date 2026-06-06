/**
 * @file 진행 컨테이너 — 분야 칩 + 진행률 + 문항/피드백 전환
 * @domain quiz
 * @layer component
 * @related QuizQuestion, QuizFeedback, quiz/page.tsx, src/data/quiz/category-meta.ts
 */

'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/progress';
import { QuizQuestion } from '@/components/quiz/QuizQuestion';
import { QuizFeedback } from '@/components/quiz/QuizFeedback';
import { getQuizCategoryMeta, type QuizQuestion as QuizQuestionType } from '@/data/quiz';

interface QuizPlayProps {
  /** 현재 문항 */
  readonly question: QuizQuestionType;
  /** 현재 문항 순번 (1-based) */
  readonly index: number;
  /** 전체 문항 수 */
  readonly total: number;
  /** 채점 후 피드백 단계 여부 */
  readonly answered: boolean;
  /** 사용자 입력 답안 (피드백 단계에서 표시) */
  readonly answer: string;
  /** 정답 여부 (피드백 단계에서 표시) */
  readonly isCorrect: boolean;
  /** 답안 제출 핸들러 */
  readonly onSubmit: (answer: string) => void;
  /** 다음 문항/결과 진행 핸들러 */
  readonly onNext: () => void;
}

/**
 * 진행률 바와 현재 단계(문항 입력 또는 채점 피드백)를 렌더하는 컨테이너.
 * 헤더에 현재 분야 칩(아이콘+accent 색)을 표시한다.
 */
export function QuizPlay({
  question,
  index,
  total,
  answered,
  answer,
  isCorrect,
  onSubmit,
  onNext,
}: QuizPlayProps): ReactElement {
  const t = useTranslations('quiz');
  const percent = Math.round((index / total) * 100);
  const meta = getQuizCategoryMeta(question.category);
  const CategoryIcon = meta.icon;

  return (
    <Card className="animate-fade-in space-y-5 p-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-badge px-2.5 py-1 text-[11px] font-medium"
            style={{ color: meta.colorVar, backgroundColor: meta.bgVar }}
          >
            <CategoryIcon className="size-3.5" aria-hidden />
            {t(`categories.${question.category}`)}
          </span>
          <p className="text-xs font-medium text-text-3">
            {t('play.progress', { current: index, total })}
          </p>
        </div>
        <Progress
          value={percent}
          aria-label={t('play.progressAria')}
          aria-valuetext={t('play.progress', { current: index, total })}
        />
      </div>

      {answered ? (
        <QuizFeedback
          question={question}
          answer={answer}
          isCorrect={isCorrect}
          isLast={index === total}
          onNext={onNext}
        />
      ) : (
        <QuizQuestion key={question.id} question={question} onSubmit={onSubmit} />
      )}
    </Card>
  );
}
