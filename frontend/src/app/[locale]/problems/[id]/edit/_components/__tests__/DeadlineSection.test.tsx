/**
 * @file DeadlineSection 컴포넌트 단위 테스트
 * @domain problem
 * @layer test
 * @related DeadlineSection, Calendar
 */

import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { DeadlineSection } from '../DeadlineSection';

jest.mock('@/components/ui/calendar', () => ({
  Calendar: ({
    selected,
    onSelect,
  }: {
    selected?: Date;
    onSelect?: (date: Date | undefined) => void;
  }) => (
    <div data-testid="calendar-mock">
      <button
        type="button"
        data-testid="calendar-pick-2026-04-15"
        onClick={() => onSelect?.(new Date(2026, 3, 15))}
      >
        Pick 2026-04-15
      </button>
      {selected && (
        <span data-testid="calendar-selected">{selected.toISOString()}</span>
      )}
    </div>
  ),
}));

jest.mock('@/lib/problem-form-utils', () => ({
  labelClass: 'label-class',
}));

jest.mock('@/lib/utils', () => ({
  getCurrentWeekLabel: () => '4월3주차',
}));

const defaultForm = {
  title: '',
  description: '',
  difficulty: '',
  deadline: '',
  allowedLanguages: [],
  sourceUrl: '',
  sourcePlatform: 'BOJ',
  category: 'ALGORITHM',
  status: 'ACTIVE',
};

describe('DeadlineSection', () => {
  const onDateSelect = jest.fn();
  const onChange = jest.fn(() => jest.fn());
  const defaultProps = {
    form: defaultForm,
    onChange,
    fieldErrors: {},
    onDateSelect,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('캘린더가 렌더링된다', () => {
    renderWithI18n(<DeadlineSection {...defaultProps} />);
    expect(screen.getByTestId('calendar-mock')).toBeInTheDocument();
  });

  it('날짜 선택 시 onDateSelect가 호출된다', () => {
    renderWithI18n(<DeadlineSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId('calendar-pick-2026-04-15'));
    expect(onDateSelect).toHaveBeenCalledWith(expect.stringContaining('2026'));
  });

  it('deadline이 설정되면 주차 정보가 표시된다', () => {
    renderWithI18n(
      <DeadlineSection
        {...defaultProps}
        form={{ ...defaultForm, deadline: '2026-04-15T23:59:59.000Z' }}
      />,
    );
    expect(screen.getByTestId('edit-calculated-week')).toBeInTheDocument();
  });

  it('선택된 날짜 텍스트가 표시된다', () => {
    renderWithI18n(
      <DeadlineSection
        {...defaultProps}
        form={{ ...defaultForm, deadline: '2026-04-15T23:59:59.000Z' }}
      />,
    );
    expect(screen.getByTestId('edit-selected-date')).toBeInTheDocument();
  });

  it('fieldErrors.deadline 원시 번역 키가 번역된 메시지로 렌더링된다', () => {
    renderWithI18n(
      <DeadlineSection
        {...defaultProps}
        fieldErrors={{ deadline: 'validation.problem.deadlineRequired' }}
      />,
    );
    // 번역된 메시지가 표시되어야 한다
    expect(
      screen.getByText('마감일을 선택해주세요.'),
    ).toBeInTheDocument();
    // 원시 번역 키가 그대로 노출되면 UX regression — 반드시 FAIL
    expect(
      screen.queryByText('validation.problem.deadlineRequired'),
    ).not.toBeInTheDocument();
  });
});
