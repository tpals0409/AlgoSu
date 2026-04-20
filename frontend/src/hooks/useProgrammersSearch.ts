/**
 * @file 프로그래머스 문제 검색 커스텀 훅
 * @domain problem
 * @layer hook
 * @related programmersApi, ProblemCreatePage, ProblemEditPage
 */

'use client';

import { useState, useCallback, type KeyboardEvent } from 'react';
import { programmersApi, type ProgrammersProblemInfo } from '@/lib/api';
import type { ProblemFormState } from '@/lib/problem-form-utils';

// ─── TYPES ────────────────────────────────

export interface UseProgrammersSearchReturn {
  programmersQuery: string;
  setProgrammersQuery: (query: string) => void;
  programmersSearching: boolean;
  programmersError: string | null;
  setProgrammersError: (error: string | null) => void;
  programmersResult: ProgrammersProblemInfo | null;
  programmersApplied: boolean;
  handleProgrammersSearch: () => Promise<void>;
  handleProgrammersKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  handleProgrammersReset: () => void;
}

// ─── HOOK ─────────────────────────────────

/**
 * 프로그래머스 문제 검색 상태 및 핸들러 캡슐화
 * @domain problem
 */
export function useProgrammersSearch(
  setForm: React.Dispatch<React.SetStateAction<ProblemFormState>>,
  setFieldErrors: React.Dispatch<React.SetStateAction<{ title?: string; weekNumber?: string; deadline?: string }>>,
): UseProgrammersSearchReturn {
  const [programmersQuery, setProgrammersQuery] = useState('');
  const [programmersSearching, setProgrammersSearching] = useState(false);
  const [programmersError, setProgrammersError] = useState<string | null>(null);
  const [programmersResult, setProgrammersResult] = useState<ProgrammersProblemInfo | null>(null);
  const [programmersApplied, setProgrammersApplied] = useState(false);

  const handleProgrammersSearch = useCallback(async (): Promise<void> => {
    const id = Number(programmersQuery.trim());
    if (!Number.isInteger(id) || id < 1) {
      setProgrammersError('유효한 문제 번호를 입력해주세요.');
      return;
    }
    setProgrammersSearching(true);
    setProgrammersError(null);
    setProgrammersResult(null);
    setProgrammersApplied(false);
    try {
      const info = await programmersApi.search(id);
      setProgrammersResult(info);
      setForm((prev) => ({
        ...prev,
        title: info.title,
        difficulty: info.difficulty ?? '',
        sourceUrl: info.sourceUrl,
        sourcePlatform: 'PROGRAMMERS',
      }));
      setFieldErrors((prev) => ({ ...prev, title: undefined }));
      setProgrammersApplied(true);
    } catch (err: unknown) {
      setProgrammersError(err instanceof Error ? err.message : '검색에 실패했습니다.');
    } finally {
      setProgrammersSearching(false);
    }
  }, [programmersQuery, setForm, setFieldErrors]);

  const handleProgrammersKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void handleProgrammersSearch();
      }
    },
    [handleProgrammersSearch],
  );

  const handleProgrammersReset = useCallback((): void => {
    setProgrammersQuery('');
    setProgrammersResult(null);
    setProgrammersError(null);
    setProgrammersApplied(false);
    setForm((prev) => ({
      ...prev,
      title: '',
      difficulty: '',
      sourceUrl: '',
    }));
  }, [setForm]);

  return {
    programmersQuery,
    setProgrammersQuery,
    programmersSearching,
    programmersError,
    setProgrammersError,
    programmersResult,
    programmersApplied,
    handleProgrammersSearch,
    handleProgrammersKeyDown,
    handleProgrammersReset,
  };
}
