/**
 * @file CS 퀴즈 미니게임 페이지 — idle→playing→result 상태머신
 * @domain quiz
 * @layer page
 * @related QuizStart, QuizPlay, QuizResult, src/lib/quiz/grade.ts, src/lib/quiz/storage.ts, src/lib/quiz/api-store.ts
 *
 * Sprint 217: 로그인=API 저장소, 게스트=localStorage 저장소로 분기.
 * 로그인 전환 시 1회 merge-up: localStorage 게스트 best를 서버로 업로드 (best-effort).
 */

'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { createApiQuizStore } from '@/lib/quiz/api-store';
import { useAuth } from '@/contexts/AuthContext';

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
 * 퀴즈 게임 페이지. idle(시작)→playing(문항 풀이)→result(결과) 상태를 관리한다.
 * 로그인 사용자는 API 저장소, 게스트는 localStorage 저장소에 최고 기록을 저장한다.
 * 로그인 전환 시 1회 merge-up으로 localStorage 게스트 best를 서버에 동기화한다.
 */
export default function QuizPage(): ReactNode {
  const { isAuthenticated, isLoading } = useAuth();

  const localStore: QuizRecordStore = useMemo(() => createLocalStorageQuizStore(), []);
  const apiStore: QuizRecordStore = useMemo(() => createApiQuizStore(), []);
  const store: QuizRecordStore = isAuthenticated ? apiStore : localStore;

  const [phase, setPhase] = useState<Phase>('idle');
  const [session, setSession] = useState<Session | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  /** 로그인 전환 시 localStorage → 서버 1회 merge-up 완료 플래그 (세션 1회). */
  const mergedUpRef = useRef(false);

  /**
   * 로그인 상태 확정 후 1회 merge-up을 실행한다.
   * localStorage v2 key의 게스트 best 전체를 API 저장소에 업로드한다.
   * 서버 upsert는 higher-only이므로 멱등, best-effort(실패 무시).
   */
  useEffect(() => {
    if (!isAuthenticated || isLoading || mergedUpRef.current) return;
    mergedUpRef.current = true;

    void (async () => {
      try {
        const localBests = await localStore.getAllBest();
        await Promise.allSettled(
          Object.entries(localBests).map(([key, record]) => {
            const sepIdx = key.indexOf('::');
            if (sepIdx === -1) return Promise.resolve();
            const category = key.slice(0, sepIdx);
            const difficulty = key.slice(sepIdx + 2) as QuizDifficulty | 'ALL';
            return apiStore.saveResult({
              category,
              difficulty,
              total: 0,
              correct: 0,
              scorePercent: record.scorePercent,
              playedAt: record.playedAt,
            });
          }),
        );
      } catch {
        // best-effort — merge-up 실패 시 조용히 무시
      }
    })();
  }, [isAuthenticated, isLoading, localStore, apiStore]);

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

  /**
   * 퀴즈를 완료하고 결과 단계로 전환한다.
   * (분야, 난이도) 복합 키로 최고 기록을 조회·갱신 후 result 상태로 이동한다.
   */
  const finish = async (current: Session): Promise<void> => {
    const total = current.questions.length;
    const scorePercent = total > 0 ? Math.round((current.correct / total) * 100) : 0;
    const prevBest = await store.getBest(current.category, current.difficulty);
    await store.saveResult({
      category: current.category,
      difficulty: current.difficulty,
      total,
      correct: current.correct,
      scorePercent,
      playedAt: new Date().toISOString(),
    });
    setBestScore(prevBest?.scorePercent ?? null);
    setIsNewBest(prevBest === null || scorePercent > prevBest.scorePercent);
    setPhase('result');
  };

  const next = (): void => {
    if (!session) return;
    if (session.index + 1 >= session.questions.length) {
      void finish(session);
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
