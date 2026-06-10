/**
 * @file StatusDifficultySection 컴포넌트 단위 테스트
 * @domain problem
 * @layer test
 * @related StatusDifficultySection
 */

import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { StatusDifficultySection } from '../StatusDifficultySection';

jest.mock('@/lib/problem-form-utils', () => ({
  labelClass: 'label-class',
  selectClass: 'select-class',
}));

jest.mock('@/lib/constants', () => ({
  DIFFICULTIES: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'],
  DIFFICULTY_LABELS: {
    BRONZE: '브론즈',
    SILVER: '실버',
    GOLD: '골드',
    PLATINUM: '플래티넘',
    DIAMOND: '다이아',
  },
  PROBLEM_STATUSES: ['DRAFT', 'ACTIVE', 'CLOSED'],
  PROBLEM_STATUS_LABELS: { DRAFT: '초안', ACTIVE: '활성', CLOSED: '종료' },
}));

const defaultForm = {
  title: 'Two Sum',
  description: '',
  difficulty: 'GOLD',
  deadline: '',
  allowedLanguages: ['python'],
  sourceUrl: '',
  sourcePlatform: 'BOJ',
  category: 'ALGORITHM',
  status: 'ACTIVE',
};

describe('StatusDifficultySection', () => {
  const onChange = jest.fn(() => jest.fn());
  const defaultProps = {
    form: defaultForm,
    onChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('난이도 select가 주어진 값으로 렌더링된다', () => {
    renderWithI18n(<StatusDifficultySection {...defaultProps} />);
    const diffSelect = screen.getByLabelText(/난이도/) as HTMLSelectElement;
    expect(diffSelect).toBeInTheDocument();
    expect(diffSelect.value).toBe('GOLD');
  });

  it('상태 select가 주어진 값으로 렌더링된다', () => {
    renderWithI18n(<StatusDifficultySection {...defaultProps} />);
    const statusSelect = screen.getByLabelText(/상태/) as HTMLSelectElement;
    expect(statusSelect).toBeInTheDocument();
    expect(statusSelect.value).toBe('ACTIVE');
  });

  it('searchApplied=true이면 난이도 select가 비활성화된다', () => {
    renderWithI18n(<StatusDifficultySection {...defaultProps} searchApplied />);
    const diffSelect = screen.getByLabelText(/난이도/) as HTMLSelectElement;
    expect(diffSelect).toBeDisabled();
  });

  it('disabled=true이면 상태 select가 비활성화된다', () => {
    renderWithI18n(<StatusDifficultySection {...defaultProps} disabled />);
    const statusSelect = screen.getByLabelText(/상태/) as HTMLSelectElement;
    expect(statusSelect).toBeDisabled();
  });
});
