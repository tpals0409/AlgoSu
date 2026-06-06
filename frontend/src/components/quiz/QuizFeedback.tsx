/**
 * @file 채점 피드백 — 정답/오답 + 해설 + 다음 버튼
 * @domain quiz
 * @layer component
 * @related QuizPlay, src/lib/quiz/grade.ts
 */

'use client';

import { useEffect, useRef, type ReactElement } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { QuizQuestion } from '@/data/quiz';

interface QuizFeedbackProps {
  /** 방금 푼 문항 */
  readonly question: QuizQuestion;
  /** 사용자 입력 답안 */
  readonly answer: string;
  /** 정답 여부 */
  readonly isCorrect: boolean;
  /** 마지막 문항 여부 — 버튼 라벨 분기 */
  readonly isLast: boolean;
  /** 다음 문항/결과로 진행 */
  readonly onNext: () => void;
}

/**
 * 채점 결과 배지·해설·입력 답안을 표시하고 다음 단계로 진행하는 버튼을 제공한다.
 * 정답/오답에 따라 컨테이너 톤(success/error soft + 좌측 accent)을 달리한다.
 */
export function QuizFeedback({
  question,
  answer,
  isCorrect,
  isLast,
  onNext,
}: QuizFeedbackProps): ReactElement {
  const t = useTranslations('quiz');
  const locale = useLocale();
  const explanation = locale === 'en' ? question.explanation.en : question.explanation.ko;
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  // 피드백 단계 진입 시(fresh mount) 주요 액션으로 포커스를 옮겨 키보드 사용자의
  // 흐름 유실을 막는다. native autoFocus 대신 ref+effect로 lint(no-autofocus)를 회피한다.
  useEffect(() => {
    /* istanbul ignore next -- ref always attached when mount effect runs */
    nextButtonRef.current?.focus();
  }, []);

  return (
    <div
      className={cn(
        'animate-fade-in space-y-4 rounded-card border-l-4 p-4',
        isCorrect ? 'border-l-success bg-success-soft' : 'border-l-error bg-error-soft',
      )}
      role="status"
    >
      <div className="flex items-center gap-2">
        {isCorrect ? (
          <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
        ) : (
          <XCircle className="h-5 w-5 text-error" aria-hidden />
        )}
        <Badge variant={isCorrect ? 'success' : 'error'}>
          {isCorrect ? t('feedback.correct') : t('feedback.incorrect')}
        </Badge>
      </div>

      <p className="text-xs text-text-3">{t('feedback.yourAnswer', { answer })}</p>

      <div className="space-y-1 rounded-card border border-border bg-bg-card p-4">
        <p className="text-xs font-medium text-text-2">{t('feedback.explanationLabel')}</p>
        <p className="text-sm leading-relaxed text-text">{explanation}</p>
      </div>

      <Button ref={nextButtonRef} variant="primary" size="md" className="w-full" onClick={onNext}>
        {isLast ? t('play.finish') : t('play.next')}
      </Button>
    </div>
  );
}
