/**
 * @file CS 퀴즈 미니게임 페이지 — idle→playing→result 상태머신
 * @domain quiz
 * @layer page
 * @related QuizStart, QuizPlay, QuizResult, src/lib/quiz/grade.ts, src/lib/quiz/storage.ts
 */

'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { QuizStart } from '@/components/quiz/QuizStart';
import { QuizPlay } from '@/components/quiz/QuizPlay';
import { QuizResult } from '@/components/quiz/QuizResult';
import {
  getRandomQuestions,
  type QuizCategory,
  type QuizDifficulty,
  type QuizQuestion,
} from '@/data/quiz';
import { gradeAnswer } from '@/lib/quiz/grade';
import {
  createLocalStorageQuizStore,
  type QuizRecordStore,
} from '@/lib/quiz/storage';

/** 게임 진행 단계. */
type Phase = 'idle' | 'playing' | 'result';

/** 한 판의 진행 상태 스냅샷. */
interface Session {
  readonly category: QuizCategory;
  readonly difficulty: QuizDifficulty | 'ALL';
  readonly questions: readonly QuizQuestion[];
  readonly index: number;
  readonly correct: number;
  readonly answered: boolean;
  readonly answer: string;
  readonly isCorrect: boolean;
}

/**
 * 퀴즈 게임 페이지. idle(시작)→playing(문항 풀이)→result(결과) 상태를 관리하며
 * 완료 시 localStorage 저장소에 최고 기록을 저장한다.
 */
export default function QuizPage(): ReactNode {
  const store: QuizRecordStore = useMemo(() => createLocalStorageQuizStore(), []);
  const [phase, setPhase] = useState<Phase>('idle');
  const [session, setSession] = useState<Session | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const start = (
    category: QuizCategory,
    count: number,
    difficulty: QuizDifficulty | 'ALL',
  ): void => {
    const questions = getRandomQuestions(category, count, difficulty);
    setSession({
      category,
      difficulty,
      questions,
      index: 0,
      correct: 0,
      answered: false,
      answer: '',
      isCorrect: false,
    });
    setPhase('playing');
  };

  const submit = (raw: string): void => {
    if (!session) return;
    const isCorrect = gradeAnswer(raw, session.questions[session.index].acceptedAnswers);
    setSession({
      ...session,
      answered: true,
      answer: raw,
      isCorrect,
      correct: session.correct + (isCorrect ? 1 : 0),
    });
  };

  const finish = (current: Session): void => {
    const total = current.questions.length;
    const scorePercent = total > 0 ? Math.round((current.correct / total) * 100) : 0;
    const prevBest = store.getBest(current.category)?.scorePercent ?? null;
    store.saveResult({
      category: current.category,
      total,
      correct: current.correct,
      scorePercent,
      playedAt: new Date().toISOString(),
    });
    setBestScore(prevBest);
    setIsNewBest(prevBest === null || scorePercent > prevBest);
    setPhase('result');
  };

  const next = (): void => {
    if (!session) return;
    if (session.index + 1 >= session.questions.length) {
      finish(session);
      return;
    }
    setSession({
      ...session,
      index: session.index + 1,
      answered: false,
      answer: '',
      isCorrect: false,
    });
  };

  const retry = (): void => {
    setSession(null);
    setBestScore(null);
    setIsNewBest(false);
    setPhase('idle');
  };

  const total = session?.questions.length ?? 0;
  const scorePercent =
    session && total > 0 ? Math.round((session.correct / total) * 100) : 0;

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-xl">
        {phase === 'idle' && <QuizStart onStart={start} />}

        {phase === 'playing' && session && (
          <QuizPlay
            question={session.questions[session.index]}
            index={session.index + 1}
            total={total}
            answered={session.answered}
            answer={session.answer}
            isCorrect={session.isCorrect}
            onSubmit={submit}
            onNext={next}
          />
        )}

        {phase === 'result' && session && (
          <QuizResult
            correct={session.correct}
            total={total}
            scorePercent={scorePercent}
            bestScore={bestScore}
            isNewBest={isNewBest}
            onRetry={retry}
          />
        )}
      </div>
    </AppLayout>
  );
}
