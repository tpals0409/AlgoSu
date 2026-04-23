/**
 * @file AddProblemModal platform toggle + SQL auto-tagging tests
 * @domain problem
 * @layer component
 * @related AddProblemModal, solvedacApi, programmersApi, CreateProblemData
 */
import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';

// ── lucide-react icon lightweight mock ──────────────────
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

describe('AddProblemModal — platform toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('opens with PROGRAMMERS tab active by default', () => {
    renderWithI18n(<AddProblemModal open={true} onClose={jest.fn()} />);

    const tabs = screen.getAllByRole('tab');
    const programmersTab = tabs.find((t) => t.textContent === '프로그래머스');
    const bojTab = tabs.find((t) => t.textContent === '백준');

    expect(programmersTab).toBeTruthy();
    expect(bojTab).toBeTruthy();
    expect(programmersTab!.getAttribute('aria-selected')).toBe('true');
    expect(bojTab!.getAttribute('aria-selected')).toBe('false');
  });

  it('changes helper text when platform toggle is switched', () => {
    renderWithI18n(<AddProblemModal open={true} onClose={jest.fn()} />);

    // Initial state: PROGRAMMERS helper text
    expect(screen.getByText('프로그래머스 문제를 검색합니다.')).toBeTruthy();

    // Click BOJ tab
    const bojTab = screen.getAllByRole('tab').find((t) => t.textContent === '백준')!;
    fireEvent.click(bojTab);

    // BOJ helper text
    expect(screen.getByText('solved.ac 기반으로 검색됩니다.')).toBeTruthy();

    // Click PROGRAMMERS tab again
    const programmersTab = screen.getAllByRole('tab').find((t) => t.textContent === '프로그래머스')!;
    fireEvent.click(programmersTab);

    expect(screen.getByText('프로그래머스 문제를 검색합니다.')).toBeTruthy();
  });

  it('calls the correct platform API for search', async () => {
    jest.useFakeTimers();

    // Return empty results
    mockSearchByQueryProgrammers.mockResolvedValue({ items: [] });
    mockSearchByQuerySolvedac.mockResolvedValue({ items: [] });

    renderWithI18n(<AddProblemModal open={true} onClose={jest.fn()} />);

    // Search in PROGRAMMERS mode
    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…');
    fireEvent.change(input, { target: { value: 'test' } });

    // Debounce 400ms
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(mockSearchByQueryProgrammers).toHaveBeenCalledWith('test', 1);
    expect(mockSearchByQuerySolvedac).not.toHaveBeenCalled();

    // Switch to BOJ tab and search
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

// ── SQL auto-tagging + badge ─────────────────────────────────────────────────────

/** SQL category search result fixture */
const SQL_ITEM = {
  problemId: 59034,
  title: 'SELECT ALL',
  level: 1,
  difficulty: 'BRONZE' as const,
  sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/59034',
  tags: [],
  category: 'sql' as const,
};

/** Algorithm category search result fixture */
const ALGO_ITEM = {
  problemId: 42576,
  title: 'Incomplete Runner',
  level: 1,
  difficulty: 'BRONZE' as const,
  sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/42576',
  tags: ['hash'],
  category: 'algorithm' as const,
};

describe('AddProblemModal — SQL badge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders SQL badge for SQL category results', async () => {
    mockSearchByQueryProgrammers.mockResolvedValue({
      items: [SQL_ITEM],
    });

    renderWithI18n(<AddProblemModal open={true} onClose={jest.fn()} />);

    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…');
    fireEvent.change(input, { target: { value: 'SQL' } });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    const badges = screen.getAllByText('SQL');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render SQL badge for algorithm category results', async () => {
    mockSearchByQueryProgrammers.mockResolvedValue({
      items: [ALGO_ITEM],
    });

    renderWithI18n(<AddProblemModal open={true} onClose={jest.fn()} />);

    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…');
    fireEvent.change(input, { target: { value: 'runner' } });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(screen.getByText('Incomplete Runner')).toBeTruthy();
    expect(screen.queryByText('SQL')).toBeNull();
  });
});

/**
 * Select week + deadline then click "Add Problem" helper.
 * Picks last options to avoid past-date validation rejection.
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

describe('AddProblemModal — SQL auto-tagging logic', () => {
  const mockCreate = problemApi.create as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    /* Pin to start of month so deadlines are not in the past */
    jest.setSystemTime(new Date('2026-04-01T09:00:00'));
    mockCreate.mockResolvedValue({
      id: 'created-1',
      title: SQL_ITEM.title,
      difficulty: 'BRONZE',
      level: 1,
      weekNumber: '4月1周次',
      deadline: '2026-04-05T14:59:59.000Z',
      tags: ['SQL'],
      sourceUrl: SQL_ITEM.sourceUrl,
      sourcePlatform: 'PROGRAMMERS',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('includes allowedLanguages=["sql"] and SQL tag for SQL category problems', async () => {
    mockSearchByQueryProgrammers.mockResolvedValue({
      items: [SQL_ITEM],
    });

    renderWithI18n(<AddProblemModal open={true} onClose={jest.fn()} />);

    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…');
    fireEvent.change(input, { target: { value: 'SQL' } });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    fireEvent.click(screen.getByText('SELECT ALL'));

    await selectWeekAndSubmit();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.allowedLanguages).toEqual(['sql']);
    expect(createArg.tags).toContain('SQL');
  });

  it('does not include allowedLanguages for algorithm category problems', async () => {
    mockSearchByQueryProgrammers.mockResolvedValue({
      items: [ALGO_ITEM],
    });
    mockCreate.mockResolvedValue({
      id: 'created-2',
      title: ALGO_ITEM.title,
      difficulty: 'BRONZE',
      level: 1,
      weekNumber: '4月1周次',
      deadline: '2026-04-05T14:59:59.000Z',
      tags: ['hash'],
      sourceUrl: ALGO_ITEM.sourceUrl,
      sourcePlatform: 'PROGRAMMERS',
    });

    renderWithI18n(<AddProblemModal open={true} onClose={jest.fn()} />);

    const input = screen.getByPlaceholderText('프로그래머스 문제 검색…');
    fireEvent.change(input, { target: { value: 'runner' } });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    fireEvent.click(screen.getByText('Incomplete Runner'));

    await selectWeekAndSubmit();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.allowedLanguages).toBeUndefined();
    expect(createArg.tags).not.toContain('SQL');
  });
});
