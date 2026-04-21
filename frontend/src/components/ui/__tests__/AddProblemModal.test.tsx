/**
 * @file AddProblemModal 플랫폼 토글 + SQL 자동 태깅 테스트
 * @domain problem
 * @layer component
 * @related AddProblemModal, solvedacApi, programmersApi, CreateProblemData
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ── lucide-react 아이콘 경량 mock ──────────────────
jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Search: Icon,
    X: Icon,
    ArrowLeft: Icon,
    Plus: Icon,
    Loader2: Icon,
    ExternalLink: Icon,
    AlertCircle: Icon,
  };
});

// ── API mock ───────────────────────────────────────
const mockSearchByQuerySolvedac = jest.fn();
const mockSearchByQueryProgrammers = jest.fn();
jest.mock('@/lib/api', () => ({
  solvedacApi: { searchByQuery: (...args: unknown[]) => mockSearchByQuerySolvedac(...args) },
  programmersApi: { searchByQuery: (...args: unknown[]) => mockSearchByQueryProgrammers(...args) },
  problemApi: { create: jest.fn() },
  studyApi: { notifyProblemCreated: jest.fn() },
}));

// ── StudyContext mock ──────────────────────────────
jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({ currentStudyId: 'test-study' }),
}));

import { problemApi } from '@/lib/api';
import { AddProblemModal } from '../AddProblemModal';

describe('AddProblemModal — 플랫폼 토글', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('모달이 열리면 기본 플랫폼이 PROGRAMMERS 토글이 활성화되어 있다', () => {
    render(<AddProblemModal open={true} onClose={jest.fn()} />);

    const tabs = screen.getAllByRole('tab');
    const programmersTab = tabs.find((t) => t.textContent === '프로그래머스');
    const bojTab = tabs.find((t) => t.textContent === '백준');

    expect(programmersTab).toBeTruthy();
    expect(bojTab).toBeTruthy();
    expect(programmersTab!.getAttribute('aria-selected')).toBe('true');
    expect(bojTab!.getAttribute('aria-selected')).toBe('false');
  });

  it('플랫폼 토글 전환 시 보조 문구가 변경된다', () => {
    render(<AddProblemModal open={true} onClose={jest.fn()} />);

    // 초기 상태: PROGRAMMERS — '프로그래머스' 보조 문구
    expect(screen.getByText('프로그래머스 문제를 검색합니다.')).toBeTruthy();

    // BOJ 탭 클릭
    const bojTab = screen.getAllByRole('tab').find((t) => t.textContent === '백준')!;
    fireEvent.click(bojTab);

    // BOJ — 'solved.ac' 보조 문구
    expect(screen.getByText('solved.ac 기반으로 검색됩니다.')).toBeTruthy();

    // 다시 PROGRAMMERS 탭 클릭
    const programmersTab = screen.getAllByRole('tab').find((t) => t.textContent === '프로그래머스')!;
    fireEvent.click(programmersTab);

    expect(screen.getByText('프로그래머스 문제를 검색합니다.')).toBeTruthy();
  });

  it('searchFn이 올바른 플랫폼의 API를 호출한다', async () => {
    jest.useFakeTimers();

    // 검색 결과 빈 배열 반환
    mockSearchByQueryProgrammers.mockResolvedValue({ items: [] });
    mockSearchByQuerySolvedac.mockResolvedValue({ items: [] });

    render(<AddProblemModal open={true} onClose={jest.fn()} />);

    // PROGRAMMERS 상태에서 검색 입력
    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…');
    fireEvent.change(input, { target: { value: '폰켓몬' } });

    // 디바운스 400ms 경과
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(mockSearchByQueryProgrammers).toHaveBeenCalledWith('폰켓몬', 1);
    expect(mockSearchByQuerySolvedac).not.toHaveBeenCalled();

    // BOJ 탭으로 전환 후 검색
    const bojTab = screen.getAllByRole('tab').find((t) => t.textContent === '백준')!;
    fireEvent.click(bojTab);

    const bojInput = screen.getByPlaceholderText('문제 번호 또는 제목으로 검색…');
    fireEvent.change(bojInput, { target: { value: '1000' } });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(mockSearchByQuerySolvedac).toHaveBeenCalledWith('1000', 1);
  });
});

// ── SQL 자동 태깅 + 배지 ─────────────────────────────────────────────────────

/** SQL 카테고리 검색 결과 픽스처 */
const SQL_ITEM = {
  problemId: 59034,
  title: '모든 레코드 조회하기',
  level: 1,
  difficulty: 'BRONZE' as const,
  sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/59034',
  tags: [],
  category: 'sql' as const,
};

/** algorithm 카테고리 검색 결과 픽스처 */
const ALGO_ITEM = {
  problemId: 42576,
  title: '완주하지 못한 선수',
  level: 1,
  difficulty: 'BRONZE' as const,
  sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/42576',
  tags: ['해시'],
  category: 'algorithm' as const,
};

describe('AddProblemModal — SQL 배지', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('SQL 카테고리 검색 결과에 SQL 배지가 렌더링된다', async () => {
    mockSearchByQueryProgrammers.mockResolvedValue({
      items: [SQL_ITEM],
    });

    render(<AddProblemModal open={true} onClose={jest.fn()} />);

    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…');
    fireEvent.change(input, { target: { value: 'SQL' } });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    const badges = screen.getAllByText('SQL');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('algorithm 카테고리 검색 결과에는 SQL 배지가 없다', async () => {
    mockSearchByQueryProgrammers.mockResolvedValue({
      items: [ALGO_ITEM],
    });

    render(<AddProblemModal open={true} onClose={jest.fn()} />);

    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…');
    fireEvent.change(input, { target: { value: '완주' } });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(screen.getByText('완주하지 못한 선수')).toBeTruthy();
    expect(screen.queryByText('SQL')).toBeNull();
  });
});

/**
 * 주차·마감일 선택 후 "문제 추가" 클릭 헬퍼.
 * 마감일 검증(과거 날짜 거부)을 우회하기 위해 마지막 옵션을 선택한다.
 */
async function selectWeekAndSubmit() {
  const selects = screen.getAllByRole('combobox');
  const weekSelect = selects[0];
  const weekOpts = weekSelect.querySelectorAll('option:not([disabled])');
  const lastWeek = weekOpts[weekOpts.length - 1];
  fireEvent.change(weekSelect, {
    target: { value: lastWeek?.getAttribute('value') ?? '' },
  });

  const deadlineSelect = selects[1];
  const dlOpts = deadlineSelect.querySelectorAll('option:not([disabled])');
  const lastDl = dlOpts[dlOpts.length - 1];
  fireEvent.change(deadlineSelect, {
    target: { value: lastDl?.getAttribute('value') ?? '' },
  });

  fireEvent.click(screen.getByRole('button', { name: /문제 추가/ }));

  await act(async () => {
    jest.advanceTimersByTime(100);
  });
}

describe('AddProblemModal — SQL 자동 태깅 로직', () => {
  const mockCreate = problemApi.create as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    /* 월 초로 고정 — 마감일이 과거가 되지 않도록 */
    jest.setSystemTime(new Date('2026-04-01T09:00:00'));
    mockCreate.mockResolvedValue({
      id: 'created-1',
      title: SQL_ITEM.title,
      difficulty: 'BRONZE',
      level: 1,
      weekNumber: '4월1주차',
      deadline: '2026-04-05T14:59:59.000Z',
      tags: ['SQL'],
      sourceUrl: SQL_ITEM.sourceUrl,
      sourcePlatform: 'PROGRAMMERS',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('SQL 카테고리 문제 선택 시 allowedLanguages=["sql"] 및 tags에 SQL 포함', async () => {
    mockSearchByQueryProgrammers.mockResolvedValue({
      items: [SQL_ITEM],
    });

    render(<AddProblemModal open={true} onClose={jest.fn()} />);

    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…');
    fireEvent.change(input, { target: { value: 'SQL' } });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    fireEvent.click(screen.getByText('모든 레코드 조회하기'));

    await selectWeekAndSubmit();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.allowedLanguages).toEqual(['sql']);
    expect(createArg.tags).toContain('SQL');
  });

  it('algorithm 카테고리 문제 선택 시 allowedLanguages 미설정', async () => {
    mockSearchByQueryProgrammers.mockResolvedValue({
      items: [ALGO_ITEM],
    });
    mockCreate.mockResolvedValue({
      id: 'created-2',
      title: ALGO_ITEM.title,
      difficulty: 'BRONZE',
      level: 1,
      weekNumber: '4월1주차',
      deadline: '2026-04-05T14:59:59.000Z',
      tags: ['해시'],
      sourceUrl: ALGO_ITEM.sourceUrl,
      sourcePlatform: 'PROGRAMMERS',
    });

    render(<AddProblemModal open={true} onClose={jest.fn()} />);

    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…');
    fireEvent.change(input, { target: { value: '완주' } });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    fireEvent.click(screen.getByText('완주하지 못한 선수'));

    await selectWeekAndSubmit();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.allowedLanguages).toBeUndefined();
    expect(createArg.tags).not.toContain('SQL');
  });
});
