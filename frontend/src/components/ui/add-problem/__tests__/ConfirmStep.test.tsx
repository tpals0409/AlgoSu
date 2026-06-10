/**
 * @file ConfirmStep unit tests — preview, deadline validation, derived weekNumber, submit/back
 * @domain problem
 * @layer test
 * @related ConfirmStep, AddProblemModal, problem-search.utils
 */
import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';

// lucide icons → cheap svgs
jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    ArrowLeft: Icon,
    Plus: Icon,
    Loader2: Icon,
    ExternalLink: Icon,
    AlertCircle: Icon,
  };
});

// Keep utils-level imports satisfied
jest.mock('@/lib/api', () => ({
  isProgrammersSqlProblem: jest.requireActual('@/lib/api/external').isProgrammersSqlProblem,
}));

// Calendar mock — single "Pick future date" button so we never hit the real day-picker.
jest.mock('../../calendar', () => ({
  Calendar: ({
    onSelect,
  }: {
    selected?: Date;
    onSelect?: (date: Date | undefined) => void;
  }) => (
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
        Pick future date
      </button>
      <button
        type="button"
        data-testid="calendar-pick-past"
        onClick={() => {
          const past = new Date();
          past.setDate(past.getDate() - 5);
          onSelect?.(past);
        }}
      >
        Pick past date
      </button>
      <button
        type="button"
        data-testid="calendar-clear"
        onClick={() => onSelect?.(undefined)}
      >
        Clear
      </button>
    </div>
  ),
}));

import { ConfirmStep } from '../ConfirmStep';
import type { SolvedProblem } from '../problem-search.utils';

const baseProblem: SolvedProblem = {
  problemId: 1000,
  titleKo: 'A+B',
  level: 1,
  tags: [],
  acceptedUserCount: 0,
};

const sqlProblem: SolvedProblem = {
  problemId: 59034,
  titleKo: 'SELECT ALL',
  level: 1,
  tags: ['select'],
  acceptedUserCount: 0,
  difficulty: 'BRONZE',
  sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/59034',
  category: 'sql',
};

describe('ConfirmStep — problem preview', () => {
  it('renders the problem title, tier badge, and external link', () => {
    renderWithI18n(
      <ConfirmStep
        problem={baseProblem}
        platform="BOJ"
        onBack={jest.fn()}
        onAdd={jest.fn()}
      />,
    );

    expect(screen.getByText('A+B')).toBeTruthy();
    expect(screen.getByText(/#1000/)).toBeTruthy();
    // BOJ external link fallback
    const links = screen.getAllByRole('link');
    expect(
      links.some((l) => l.getAttribute('href') === 'https://www.acmicpc.net/problem/1000'),
    ).toBe(true);
  });

  it('renders the SQL badge only when the problem is a Programmers SQL one', () => {
    renderWithI18n(
      <ConfirmStep
        problem={sqlProblem}
        platform="PROGRAMMERS"
        onBack={jest.fn()}
        onAdd={jest.fn()}
      />,
    );
    expect(screen.getByText('SQL')).toBeTruthy();
  });

  it('does NOT render the SQL badge for an algorithm Programmers problem', () => {
    renderWithI18n(
      <ConfirmStep
        problem={{ ...baseProblem, category: 'algorithm' }}
        platform="PROGRAMMERS"
        onBack={jest.fn()}
        onAdd={jest.fn()}
      />,
    );
    expect(screen.queryByText('SQL')).toBeNull();
  });

  it('prefers problem.sourceUrl over the platform fallback', () => {
    const explicit = {
      ...baseProblem,
      sourceUrl: 'https://example.com/explicit',
    };
    renderWithI18n(
      <ConfirmStep
        problem={explicit}
        platform="BOJ"
        onBack={jest.fn()}
        onAdd={jest.fn()}
      />,
    );
    const links = screen.getAllByRole('link');
    expect(
      links.some((l) => l.getAttribute('href') === 'https://example.com/explicit'),
    ).toBe(true);
  });
});

describe('ConfirmStep — deadline validation', () => {
  it('flags "deadlineRequired" when submitting without selecting a date', () => {
    const onAdd = jest.fn();
    renderWithI18n(
      <ConfirmStep
        problem={baseProblem}
        platform="BOJ"
        onBack={jest.fn()}
        onAdd={onAdd}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /문제 추가/ }));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('flags "deadlinePast" when a past date is selected and blocks submit', () => {
    const onAdd = jest.fn();
    renderWithI18n(
      <ConfirmStep
        problem={baseProblem}
        platform="BOJ"
        onBack={jest.fn()}
        onAdd={onAdd}
      />,
    );

    fireEvent.click(screen.getByTestId('calendar-pick-past'));
    fireEvent.click(screen.getByRole('button', { name: /문제 추가/ }));

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('submits weekNumber + ISO deadline when a future date is picked', () => {
    const onAdd = jest.fn();
    renderWithI18n(
      <ConfirmStep
        problem={baseProblem}
        platform="BOJ"
        onBack={jest.fn()}
        onAdd={onAdd}
      />,
    );

    fireEvent.click(screen.getByTestId('calendar-pick-future'));
    fireEvent.click(screen.getByRole('button', { name: /문제 추가/ }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const [weekNumber, deadline] = onAdd.mock.calls[0];
    expect(typeof weekNumber).toBe('string');
    expect(weekNumber.length).toBeGreaterThan(0);
    expect(typeof deadline).toBe('string');
    // ISO string ends with .000Z (we set seconds to 59, ms to 0)
    expect(deadline).toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('clears the deadline preview when the picker emits undefined', () => {
    renderWithI18n(
      <ConfirmStep
        problem={baseProblem}
        platform="BOJ"
        onBack={jest.fn()}
        onAdd={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('calendar-pick-future'));
    expect(screen.getByTestId('add-problem-modal-selected-date')).toBeTruthy();

    fireEvent.click(screen.getByTestId('calendar-clear'));
    expect(screen.queryByTestId('add-problem-modal-selected-date')).toBeNull();
  });
});

describe('ConfirmStep — derived state + footer', () => {
  it('shows the calculated week label once a date is selected', () => {
    renderWithI18n(
      <ConfirmStep
        problem={baseProblem}
        platform="BOJ"
        onBack={jest.fn()}
        onAdd={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('calendar-pick-future'));
    expect(screen.getByTestId('add-problem-modal-calculated-week')).toBeTruthy();
  });

  it('fires onBack from the back button and the footer "back" button', () => {
    const onBack = jest.fn();
    renderWithI18n(
      <ConfirmStep
        problem={baseProblem}
        platform="BOJ"
        onBack={onBack}
        onAdd={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('검색으로 돌아가기'));
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('disables footer buttons + swaps the label while submitting', () => {
    renderWithI18n(
      <ConfirmStep
        problem={baseProblem}
        platform="BOJ"
        onBack={jest.fn()}
        onAdd={jest.fn()}
        isAdding
      />,
    );

    const adding = screen.getByText('추가 중...');
    expect(adding).toBeTruthy();
    const buttons = screen
      .getAllByRole('button')
      // narrow to footer buttons (Btn renders disabled attr when isAdding=true)
      .filter((b) => b.hasAttribute('disabled'));
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the addError banner when one is provided', () => {
    renderWithI18n(
      <ConfirmStep
        problem={baseProblem}
        platform="BOJ"
        onBack={jest.fn()}
        onAdd={jest.fn()}
        addError="something broke"
      />,
    );
    expect(screen.getByText('something broke')).toBeTruthy();
  });
});
