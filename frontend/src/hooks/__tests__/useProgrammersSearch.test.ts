/**
 * @file useProgrammersSearch 단위 테스트
 * @domain problem
 * @layer hook
 * @related useProgrammersSearch, useBojSearch.test.ts
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useProgrammersSearch } from '../useProgrammersSearch';
import type { ProblemFormState } from '@/lib/problem-form-utils';

const mockSearch = jest.fn();
jest.mock('@/lib/api', () => ({
  programmersApi: { search: (id: number) => mockSearch(id) },
}));

const defaultForm: ProblemFormState = {
  title: '',
  description: '',
  difficulty: 'EASY',
  deadline: '',
  allowedLanguages: ['python'],
  sourceUrl: '',
  sourcePlatform: '',
};

/** 훅을 테스트 가능한 형태로 감싸는 래퍼 */
function useTestHook() {
  const [form, setForm] = useState(defaultForm);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; deadline?: string }>({});
  const programmers = useProgrammersSearch(setForm, setFieldErrors);
  return { form, fieldErrors, ...programmers };
}

describe('useProgrammersSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('초기 상태가 올바르다', () => {
    const { result } = renderHook(() => useTestHook());

    expect(result.current.programmersQuery).toBe('');
    expect(result.current.programmersSearching).toBe(false);
    expect(result.current.programmersError).toBeNull();
    expect(result.current.programmersResult).toBeNull();
    expect(result.current.programmersApplied).toBe(false);
  });

  it('유효하지 않은 문제 번호 시 에러를 설정한다', async () => {
    const { result } = renderHook(() => useTestHook());

    act(() => {
      result.current.setProgrammersQuery('abc');
    });

    await act(async () => {
      await result.current.handleProgrammersSearch();
    });

    expect(result.current.programmersError).toBe('유효한 문제 번호를 입력해주세요.');
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('빈 문자열 시 에러를 설정한다', async () => {
    const { result } = renderHook(() => useTestHook());

    await act(async () => {
      await result.current.handleProgrammersSearch();
    });

    expect(result.current.programmersError).toBe('유효한 문제 번호를 입력해주세요.');
  });

  it('0 이하의 번호 시 에러를 설정한다', async () => {
    const { result } = renderHook(() => useTestHook());

    act(() => {
      result.current.setProgrammersQuery('0');
    });

    await act(async () => {
      await result.current.handleProgrammersSearch();
    });

    expect(result.current.programmersError).toBe('유효한 문제 번호를 입력해주세요.');
  });

  it('소수점 번호 시 에러를 설정한다', async () => {
    const { result } = renderHook(() => useTestHook());

    act(() => {
      result.current.setProgrammersQuery('1.5');
    });

    await act(async () => {
      await result.current.handleProgrammersSearch();
    });

    expect(result.current.programmersError).toBe('유효한 문제 번호를 입력해주세요.');
  });

  it('검색 성공 시 form을 업데이트한다', async () => {
    const info = {
      problemId: 1845,
      title: '폰켓몬',
      difficulty: 'BRONZE' as const,
      level: 1,
      sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/1845',
      tags: ['hash'],
    };
    mockSearch.mockResolvedValue(info);

    const { result } = renderHook(() => useTestHook());

    act(() => {
      result.current.setProgrammersQuery('1845');
    });

    await act(async () => {
      await result.current.handleProgrammersSearch();
    });

    expect(result.current.programmersResult).toEqual(info);
    expect(result.current.programmersApplied).toBe(true);
    expect(result.current.programmersSearching).toBe(false);
    expect(result.current.form.title).toBe('폰켓몬');
    expect(result.current.form.difficulty).toBe('BRONZE');
    expect(result.current.form.sourceUrl).toBe(
      'https://school.programmers.co.kr/learn/courses/30/lessons/1845',
    );
    expect(result.current.form.sourcePlatform).toBe('PROGRAMMERS');
  });

  it('difficulty가 null이면 빈 문자열로 설정한다', async () => {
    const info = {
      problemId: 1845,
      title: '폰켓몬',
      difficulty: null,
      level: 0,
      sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/1845',
      tags: [],
    };
    mockSearch.mockResolvedValue(info);

    const { result } = renderHook(() => useTestHook());

    act(() => {
      result.current.setProgrammersQuery('1845');
    });

    await act(async () => {
      await result.current.handleProgrammersSearch();
    });

    expect(result.current.form.difficulty).toBe('');
  });

  it('검색 실패 시 에러를 설정한다 (Error 인스턴스)', async () => {
    mockSearch.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useTestHook());

    act(() => {
      result.current.setProgrammersQuery('99999');
    });

    await act(async () => {
      await result.current.handleProgrammersSearch();
    });

    expect(result.current.programmersError).toBe('Not found');
    expect(result.current.programmersSearching).toBe(false);
  });

  it('검색 실패 시 기본 에러 메시지 (비-Error 객체)', async () => {
    mockSearch.mockRejectedValue('string error');

    const { result } = renderHook(() => useTestHook());

    act(() => {
      result.current.setProgrammersQuery('99999');
    });

    await act(async () => {
      await result.current.handleProgrammersSearch();
    });

    expect(result.current.programmersError).toBe('검색에 실패했습니다.');
  });

  it('Enter 키 시 검색을 실행한다', async () => {
    mockSearch.mockResolvedValue({
      problemId: 1845,
      title: '폰켓몬',
      difficulty: 'BRONZE',
      level: 1,
      sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/1845',
      tags: [],
    });

    const { result } = renderHook(() => useTestHook());

    act(() => {
      result.current.setProgrammersQuery('1845');
    });

    const preventDefault = jest.fn();
    await act(async () => {
      result.current.handleProgrammersKeyDown({
        key: 'Enter',
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLInputElement>);
    });

    expect(preventDefault).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.programmersApplied).toBe(true);
    });
  });

  it('Enter 외 키는 무시한다', () => {
    const { result } = renderHook(() => useTestHook());

    const preventDefault = jest.fn();
    act(() => {
      result.current.handleProgrammersKeyDown({
        key: 'Escape',
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLInputElement>);
    });

    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('리셋 시 상태를 초기화한다', async () => {
    mockSearch.mockResolvedValue({
      problemId: 1845,
      title: '폰켓몬',
      difficulty: 'BRONZE',
      level: 1,
      sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/1845',
      tags: [],
    });

    const { result } = renderHook(() => useTestHook());

    act(() => {
      result.current.setProgrammersQuery('1845');
    });

    await act(async () => {
      await result.current.handleProgrammersSearch();
    });

    act(() => {
      result.current.handleProgrammersReset();
    });

    expect(result.current.programmersQuery).toBe('');
    expect(result.current.programmersResult).toBeNull();
    expect(result.current.programmersError).toBeNull();
    expect(result.current.programmersApplied).toBe(false);
    expect(result.current.form.title).toBe('');
    expect(result.current.form.difficulty).toBe('');
    expect(result.current.form.sourceUrl).toBe('');
  });

  it('setProgrammersError로 에러를 직접 설정/해제할 수 있다', () => {
    const { result } = renderHook(() => useTestHook());

    act(() => {
      result.current.setProgrammersError('custom error');
    });
    expect(result.current.programmersError).toBe('custom error');

    act(() => {
      result.current.setProgrammersError(null);
    });
    expect(result.current.programmersError).toBeNull();
  });
});
