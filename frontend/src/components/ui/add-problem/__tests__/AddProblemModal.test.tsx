/**
 * @file AddProblemModal orchestrator integration tests — onAdd callback mapping, create failure
 * @domain problem
 * @layer test
 * @related AddProblemModal, problemApi, studyApi
 *
 * Companion to `components/ui/__tests__/AddProblemModal.test.tsx`. That file
 * pre-dates the Sprint 242 Q-1 FE split and exercises the platform toggle +
 * SQL auto-tagging surface. This file targets the lines that were not yet
 * covered there: the `onAddCallback` payload mapping (lines 95-108) and the
 * `create` failure path that surfaces `addError` to the user.
 */
import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Search: Icon, X: Icon, ArrowLeft: Icon, Plus: Icon, Loader2: Icon,
    ExternalLink: Icon, AlertCircle: Icon, RefreshCw: Icon, Sparkles: Icon,
  };
});

const mockSearchByQueryProgrammers = jest.fn();
const mockCreate = jest.fn();
const mockNotify = jest.fn();
jest.mock('@/lib/api', () => ({
  solvedacApi: { searchByQuery: jest.fn() },
  programmersApi: { searchByQuery: (...args: unknown[]) => mockSearchByQueryProgrammers(...args) },
  problemApi: {
    create: (...args: unknown[]) => mockCreate(...args),
    // Recommendation prefetch resolves [] so the section stays inert here.
    getRecommendations: jest.fn().mockResolvedValue([]),
  },
  studyApi: { notifyProblemCreated: (...args: unknown[]) => mockNotify(...args) },
  isProgrammersSqlProblem: jest.requireActual('@/lib/api/external').isProgrammersSqlProblem,
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({ currentStudyId: 'test-study' }),
}));

jest.mock('../../calendar', () => ({
  Calendar: ({ onSelect }: { selected?: Date; onSelect?: (date: Date | undefined) => void }) => (
    <div data-testid="calendar-mock">
      <button
        type="button"
        data-testid="calendar-pick-future"
        onClick={() => {
          const future = new Date();
          future.setDate(future.getDate() + 30);
          onSelect?.(future);
        }}
      >
        Pick future
      </button>
    </div>
  ),
}));

import { AddProblemModal } from '../AddProblemModal';

const ALGO_ITEM = {
  problemId: 42576,
  title: 'Algo Problem',
  level: 2,
  difficulty: 'SILVER' as const,
  sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/42576',
  tags: ['hash'],
  category: 'algorithm' as const,
};

async function pickProblemAndSubmit() {
  // SearchStep: type → debounce → pick
  fireEvent.change(
    screen.getByPlaceholderText('프로그래머스 문제 검색…'),
    { target: { value: 'algo' } },
  );
  await act(async () => { jest.advanceTimersByTime(400); });
  fireEvent.click(screen.getByText('Algo Problem'));

  // ConfirmStep: pick future date → submit
  fireEvent.click(screen.getByTestId('calendar-pick-future'));
  fireEvent.click(screen.getByRole('button', { name: /문제 추가/ }));
  await act(async () => { jest.advanceTimersByTime(50); });
}

describe('AddProblemModal — onAdd callback payload mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-10T09:00:00Z'));
    mockSearchByQueryProgrammers.mockResolvedValue({ items: [ALGO_ITEM] });
    mockNotify.mockResolvedValue(undefined);
  });
  afterEach(() => jest.useRealTimers());

  it('invokes onAdd with server values + sensible fallbacks', async () => {
    mockCreate.mockResolvedValue({
      id: 'srv-1',
      title: 'Algo Problem (server)',
      difficulty: 'SILVER',
      level: 3,                  // server overrides client level
      weekNumber: '6月3周次',
      deadline: '2026-06-20T14:59:59.000Z',
      // tags / sourceUrl / sourcePlatform / description omitted → fallback path
    });
    const onAdd = jest.fn();
    const onClose = jest.fn();

    renderWithI18n(<AddProblemModal open onClose={onClose} onAdd={onAdd} />);
    await pickProblemAndSubmit();

    expect(onAdd).toHaveBeenCalledTimes(1);
    const payload = onAdd.mock.calls[0][0];
    expect(payload).toEqual({
      id: 'srv-1',
      title: 'Algo Problem (server)',
      difficulty: 'SILVER',
      level: 3,
      weekNumber: '6月3周次',
      status: 'ACTIVE',
      deadline: '2026-06-20T14:59:59.000Z',
      tags: ['hash'],                                                // fallback from data
      sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/42576',
      sourcePlatform: 'PROGRAMMERS',                                 // fallback
      description: '',                                               // fallback
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to client level when the server omits it', async () => {
    mockCreate.mockResolvedValue({
      id: 'srv-2',
      title: 'Algo Problem',
      difficulty: 'SILVER',
      weekNumber: '6月3周次',
      deadline: '2026-06-20T14:59:59.000Z',
      // level absent → fallback to data.level
    });
    const onAdd = jest.fn();

    renderWithI18n(<AddProblemModal open onClose={jest.fn()} onAdd={onAdd} />);
    await pickProblemAndSubmit();

    expect(onAdd.mock.calls[0][0].level).toBe(2); // client value preserved
  });

  it('still fires notifyProblemCreated as fire-and-forget', async () => {
    mockCreate.mockResolvedValue({
      id: 'srv-3',
      title: 'Algo Problem',
      difficulty: 'SILVER',
      level: 2,
      weekNumber: '6月3周次',
      deadline: '2026-06-20T14:59:59.000Z',
    });
    renderWithI18n(<AddProblemModal open onClose={jest.fn()} />);
    await pickProblemAndSubmit();
    expect(mockNotify).toHaveBeenCalledWith('test-study', {
      problemId: 'srv-3',
      problemTitle: 'Algo Problem',
      weekNumber: expect.any(String),
    });
  });
});

describe('AddProblemModal — failure surface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-10T09:00:00Z'));
    mockSearchByQueryProgrammers.mockResolvedValue({ items: [ALGO_ITEM] });
  });
  afterEach(() => jest.useRealTimers());

  it('surfaces Error.message via the addError banner when create rejects', async () => {
    mockCreate.mockRejectedValue(new Error('server boom'));
    const onAdd = jest.fn();
    const onClose = jest.fn();

    renderWithI18n(<AddProblemModal open onClose={onClose} onAdd={onAdd} />);
    await pickProblemAndSubmit();
    // Allow the rejected promise to settle.
    await act(async () => { jest.advanceTimersByTime(0); });

    expect(screen.getByText('server boom')).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('falls back to the i18n addFailed message when the error is not an Error instance', async () => {
    mockCreate.mockRejectedValue('not-an-error');

    renderWithI18n(<AddProblemModal open onClose={jest.fn()} />);
    await pickProblemAndSubmit();
    await act(async () => { jest.advanceTimersByTime(0); });

    expect(screen.getByText('문제 추가에 실패했습니다.')).toBeTruthy();
  });
});

describe('AddProblemModal — submit gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-10T09:00:00Z'));
    mockSearchByQueryProgrammers.mockResolvedValue({ items: [ALGO_ITEM] });
  });
  afterEach(() => jest.useRealTimers());

  it('does not double-submit when create is in flight (isAdding guard)', async () => {
    let resolveCreate!: (v: unknown) => void;
    mockCreate.mockImplementation(
      () => new Promise((res) => { resolveCreate = res; }),
    );

    renderWithI18n(<AddProblemModal open onClose={jest.fn()} />);
    await pickProblemAndSubmit();

    // Click the submit button a second time while the first call is pending.
    fireEvent.click(screen.getByRole('button', { name: /추가 중/ }));
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Settle the in-flight promise so afterEach doesn't dangle.
    resolveCreate({
      id: 's', title: 'Algo Problem', difficulty: 'SILVER', level: 2,
      weekNumber: '6月3周次', deadline: '2026-06-20T14:59:59.000Z',
    });
    await act(async () => { jest.advanceTimersByTime(0); });
  });
});
