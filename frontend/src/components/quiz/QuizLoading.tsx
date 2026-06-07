/**
 * @file 퀴즈 문항 로딩 화면 — 분야 청크 동적 import 진행률 표시
 * @domain quiz
 * @layer component
 * @related QuizStart, src/app/[locale]/quiz/page.tsx, src/components/ui/progress.tsx, src/components/ui/Skeleton.tsx
 *
 * Sprint 229: 'ALL' 모드는 10개 분야 청크를 병렬 로드하므로 체감 대기가 길 수 있다.
 * getRandomQuestions의 onProgress 콜백이 전달한 (loaded/total)을 진행률 바로 시각화하고,
 * aria-live 영역으로 진행을 낭독한다. 데이터 본문은 기존 SkeletonCard로 자리표시한다.
 */

'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Progress } from '@/components/ui/progress';
import { SkeletonCard } from '@/components/ui/Skeleton';

interface QuizLoadingProps {
  /** 로드 완료된 분야 청크 수 */
  readonly loaded: number;
  /** 로드해야 할 전체 분야 청크 수 (단일 분야=1, 'ALL'=전 분야 수) */
  readonly total: number;
}

/**
 * 문항 청크 로딩 진행 화면. 진행률 바와 스켈레톤을 함께 표시한다.
 * total이 0이면 0%로 표시하며(초기 스냅샷·가드) 크래시하지 않는다.
 *
 * @param loaded 로드 완료된 분야 청크 수
 * @param total 전체 분야 청크 수
 */
export function QuizLoading({ loaded, total }: QuizLoadingProps): ReactElement {
  const t = useTranslations('quiz');
  const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2" aria-live="polite">
        <p className="text-sm font-medium text-text-2">{t('loading.title')}</p>
        <Progress
          value={percent}
          aria-label={t('loading.progressAria')}
          aria-valuetext={t('loading.progress', { loaded, total })}
        />
      </div>
      <SkeletonCard />
    </div>
  );
}
