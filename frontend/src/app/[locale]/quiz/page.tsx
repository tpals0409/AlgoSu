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
import { aggregateCategoryBests, type QuizCategoryStat } from '@/lib/quiz/stats';
import { useAuth } from '@/contexts/AuthContext';

/** 게임 진행 단계. */
type Phase = 'idle' | 'playing' | 'result';

/** 한 판의 진행 상태 스냅샷. */
interface Session {
  readonly category: QuizCategory | 'ALL';
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
  const [stats, setStats] = useState<readonly QuizCategoryStat[]>([]);

  /** 로그인 전환 시 localStorage → 서버 1회 merge-up 완료 플래그 (세션 1회). */
  const mergedUpRef = useRef(false);
  /**
   * 인증 사용자의 merge-up 완료 플래그 — 통계 조회 게이트.
   * 인증 사용자의 통계 GET이 merge-up POST와 병렬 실행돼 stale 데이터를 표시·캐시하는
   * 것을 막는다(Critic Sprint 224 P2/R2). **게스트는 이 값을 보지 않으므로**
   * (통계 effect 가드가 `isAuthenticated &&`로만 적용) 게스트→로그인 전환 시에도
   * 이 값은 계속 false라 전환 직후 조기 GET이 발생하지 않는다(스냅샷 안전).
   */
  const [mergeUpDone, setMergeUpDone] = useState(false);

  /**
   * 로그인 상태 확정 후 1회 merge-up을 실행하고 인증 통계 게이트를 연다.
   * localStorage v2 key의 게스트 best 전체를 API 저장소에 업로드한다.
   * 서버 upsert는 higher-only이므로 멱등, best-effort(실패 무시).
   * 게스트(미인증)는 merge-up·게이트 모두 불필요하므로 즉시 종료한다.
   */
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (mergedUpRef.current) return;
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
      } finally {
        // 성공/실패 무관하게 게이트 release — 마지막 saveResult가 API 캐시를
        // 무효화한 뒤이므로 이후 통계 GET은 병합된 최신 서버 상태를 읽는다.
        setMergeUpDone(true);
      }
    })();
  }, [isAuthenticated, isLoading, localStore, apiStore]);

  /**
   * 시작 화면(idle) 진입 시 분야별 최고 점수를 조회해 "내 기록" 요약을 갱신한다.
   * 인증 사용자는 merge-up 완료(mergeUpDone) 후에만 조회해 stale 표시를 피하고,
   * 게스트는 게이트 없이 즉시 조회한다(`isAuthenticated &&`로만 게이트 적용 →
   * 전환 시 mergeUpDone이 계속 false라 조기 GET 없음).
   * 저장소(로그인=API/게스트=local)·단계 변화에 반응하며, 비동기 결과는
   * 언마운트/단계 전환 후 setState를 막도록 cancelled 가드로 보호한다.
   */
  useEffect(() => {
    if (phase !== 'idle') return undefined;
    if (isAuthenticated && !mergeUpDone) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const allBest = await store.getAllBest();
        if (!cancelled) setStats(aggregateCategoryBests(allBest));
      } catch {
        // best-effort — 기록 요약 실패는 시작 화면을 막지 않는다
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, store, isAuthenticated, mergeUpDone]);

  const start = (
    category: QuizCategory | 'ALL',
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
        {phase === 'idle' && <QuizStart onStart={start} stats={stats} />}

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
