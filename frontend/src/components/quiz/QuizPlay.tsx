/**
 * @file 진행 컨테이너 — 진행률 + 문항/피드백 전환
 * @domain quiz
 * @layer component
 * @related QuizQuestion, QuizFeedback, quiz/page.tsx
 */

'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/progress';
import { QuizQuestion } from '@/components/quiz/QuizQuestion';
import { QuizFeedback } from '@/components/quiz/QuizFeedback';
import type { QuizQuestion as QuizQuestionType } from '@/data/quiz';

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

  return (
    <Card className="space-y-5 p-6">
      <div className="space-y-2">
        <p className="text-right text-xs font-medium text-text-3">
          {t('play.progress', { current: index, total })}
        </p>
        <Progress value={percent} />
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
