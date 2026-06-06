/**
 * @file 결과 화면 — 점수·정답률·최고 기록 + 다시하기
 * @domain quiz
 * @layer component
 * @related ScoreGauge, QuizStart, src/lib/quiz/storage.ts
 */

'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Trophy } from 'lucide-react';
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

/** 신기록 시 게이지 래퍼에 적용하는 펄스 글로우 (1회성 아님 — 은은한 무한 반복). */
const NEW_BEST_GLOW: CSSProperties = {
  animation: 'glow-pulse 2.6s ease-in-out infinite',
  borderRadius: '9999px',
};

/**
 * 점수 게이지와 정답률·최고 기록을 표시하고 다시하기 버튼을 제공한다.
 * 최고 기록 갱신 시 게이지에 글로우 펄스와 트로피 배지로 축하 연출을 더한다.
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
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  // 라이브 영역은 "빈 채로 먼저 마운트 → 이후 텍스트 변경"되어야 스크린리더가
  // 안정적으로 공지한다. 초기값을 빈 문자열로 두고 mount 다음 틱에 공지를 주입한다.
  const [announce, setAnnounce] = useState('');

  // 결과 단계 진입 시(fresh mount) 다시하기 버튼으로 포커스를 옮겨 키보드 사용자가
  // Tab으로 액션을 다시 탐색하지 않도록 한다. ref+effect로 lint(no-autofocus)를 회피한다.
  useEffect(() => {
    /* istanbul ignore next -- ref always attached when mount effect runs */
    retryButtonRef.current?.focus();
  }, []);

  // 빈 라이브 영역 마운트 후 공지 문장을 주입 → "존재 후 변경" 정석 패턴 충족.
  useEffect(() => {
    setAnnounce(
      isNewBest
        ? t('result.announceNewBest', { score: scorePercent })
        : t('result.announceDone', { score: scorePercent }),
    );
  }, [isNewBest, scorePercent, t]);

  return (
    <Card className="animate-fade-in flex flex-col items-center gap-5 p-6 text-center">
      {/*
       * 전용 sr-only 라이브 영역: 항상 DOM에 존재하며 announce가 빈 문자열로 먼저
       * 마운트된 뒤 effect로 채워져 결과 전환을 스크린리더에 polite하게 공지한다.
       * 시각 요소(아래)는 순수 표시용으로 분리해 라이브 영역 중복 공지를 피한다.
       */}
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>

      <h1 className="text-xl font-bold text-text">{t('result.title')}</h1>

      <div style={isNewBest ? NEW_BEST_GLOW : undefined}>
        <ScoreGauge score={scorePercent} label={t('result.accuracy')} />
      </div>

      <p className="text-sm text-text-2">{t('result.correctCount', { correct, total })}</p>

      {isNewBest ? (
        <Badge variant="success" className="gap-1.5 px-3 py-1 text-xs">
          <Trophy className="size-4" aria-hidden />
          {t('result.newBest')}
        </Badge>
      ) : (
        bestScore !== null && (
          <p className="text-xs text-text-3">
            {t('result.best')}: {t('result.bestScore', { score: bestScore })}
          </p>
        )
      )}

      <Button ref={retryButtonRef} variant="primary" size="lg" className="w-full" onClick={onRetry}>
        {t('result.retry')}
      </Button>
    </Card>
  );
}
