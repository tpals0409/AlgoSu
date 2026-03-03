/**
 * @file BOJ(백준) 문제 검색 커스텀 훅
 * @domain problem
 * @layer hook
 * @related solvedacApi, ProblemCreatePage, ProblemEditPage
 */

'use client';

import { useState, useCallback, type KeyboardEvent } from 'react';
import { solvedacApi, type SolvedacProblemInfo } from '@/lib/api';
import type { ProblemFormState } from '@/lib/problem-form-utils';

// ─── TYPES ────────────────────────────────

export interface UseBojSearchReturn {
  bojQuery: string;
  setBojQuery: (query: string) => void;
  bojSearching: boolean;
  bojError: string | null;
  setBojError: (error: string | null) => void;
  bojResult: SolvedacProblemInfo | null;
  bojApplied: boolean;
  handleBojSearch: () => Promise<void>;
  handleBojKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  handleBojReset: () => void;
}

// ─── HOOK ─────────────────────────────────

/**
 * BOJ 문제 검색 상태 및 핸들러 캡슐화
 * @domain problem
 */
export function useBojSearch(
  setForm: React.Dispatch<React.SetStateAction<ProblemFormState>>,
  setFieldErrors: React.Dispatch<React.SetStateAction<{ title?: string; weekNumber?: string; deadline?: string }>>,
): UseBojSearchReturn {
  const [bojQuery, setBojQuery] = useState('');
  const [bojSearching, setBojSearching] = useState(false);
  const [bojError, setBojError] = useState<string | null>(null);
  const [bojResult, setBojResult] = useState<SolvedacProblemInfo | null>(null);
  const [bojApplied, setBojApplied] = useState(false);

  const handleBojSearch = useCallback(async (): Promise<void> => {
    const id = Number(bojQuery.trim());
    if (!Number.isInteger(id) || id < 1) {
      setBojError('유효한 문제 번호를 입력해주세요.');
      return;
    }
    setBojSearching(true);
    setBojError(null);
    setBojResult(null);
    setBojApplied(false);
    try {
      const info = await solvedacApi.search(id);
      setBojResult(info);
      setForm((prev) => ({
        ...prev,
        title: info.title,
        difficulty: info.difficulty ?? '',
        sourceUrl: info.sourceUrl,
        sourcePlatform: 'BOJ',
      }));
      setFieldErrors((prev) => ({ ...prev, title: undefined }));
      setBojApplied(true);
    } catch (err: unknown) {
      setBojError(err instanceof Error ? err.message : '검색에 실패했습니다.');
    } finally {
      setBojSearching(false);
    }
  }, [bojQuery, setForm, setFieldErrors]);

  const handleBojKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleBojSearch();
      }
    },
    [handleBojSearch],
  );

  const handleBojReset = useCallback((): void => {
    setBojQuery('');
    setBojResult(null);
    setBojError(null);
    setBojApplied(false);
    setForm((prev) => ({
      ...prev,
      title: '',
      difficulty: '',
      sourceUrl: '',
    }));
  }, [setForm]);

  return {
    bojQuery,
    setBojQuery,
    bojSearching,
    bojError,
    setBojError,
    bojResult,
    bojApplied,
    handleBojSearch,
    handleBojKeyDown,
    handleBojReset,
  };
}
