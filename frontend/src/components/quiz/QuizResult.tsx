/**
 * @file 결과 화면 — 점수·정답률·최고 기록 + 다시하기
 * @domain quiz
 * @layer component
 * @related ScoreGauge, QuizStart, src/lib/quiz/storage.ts
 */

'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { ScoreGauge } from '@/components/ui/ScoreGauge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface QuizResultProps {
  /** 맞힌 문항 수 */
  readonly correct: number;
  /** 전체 문항 수 */
  readonly total: number;
  /** 정답률 (0~100) */
  readonly scorePercent: number;
  /** 분야별 기존 최고 점수 (없으면 null) */
  readonly bestScore: number | null;
  /** 이번 판이 최고 기록을 갱신했는지 여부 */
  readonly isNewBest: boolean;
  /** 다시하기 (idle 복귀) 핸들러 */
  readonly onRetry: () => void;
}

/**
 * 점수 게이지와 정답률·최고 기록을 표시하고 다시하기 버튼을 제공한다.
 */
export function QuizResult({
  correct,
  total,
  scorePercent,
  bestScore,
  isNewBest,
  onRetry,
}: QuizResultProps): ReactElement {
  const t = useTranslations('quiz');

  return (
    <Card className="flex flex-col items-center gap-5 p-6 text-center">
      <h1 className="text-xl font-bold text-text">{t('result.title')}</h1>

      <ScoreGauge score={scorePercent} label={t('result.accuracy')} />

      <p className="text-sm text-text-2">{t('result.correctCount', { correct, total })}</p>

      {isNewBest ? (
        <Badge variant="success">{t('result.newBest')}</Badge>
      ) : (
        bestScore !== null && (
          <p className="text-xs text-text-3">
            {t('result.best')}: {t('result.bestScore', { score: bestScore })}
          </p>
        )
      )}

      <Button variant="primary" size="lg" className="w-full" onClick={onRetry}>
        {t('result.retry')}
      </Button>
    </Card>
  );
}
