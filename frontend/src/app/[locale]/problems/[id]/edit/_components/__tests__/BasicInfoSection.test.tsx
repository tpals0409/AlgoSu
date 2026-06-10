/**
 * @file BasicInfoSection 컴포넌트 단위 테스트
 * @domain problem
 * @layer test
 * @related BasicInfoSection
 */

import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { BasicInfoSection } from '../BasicInfoSection';

jest.mock('@/components/ui/Input', () => ({
  Input: ({
    label,
    value,
    onChange,
    error,
    disabled,
  }: {
    label?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    error?: string;
    disabled?: boolean;
  }) => (
    <div>
      {label && <label htmlFor={`input-${label}`}>{label}</label>}
      <input
        id={`input-${label}`}
        value={value}
        onChange={onChange}
        disabled={disabled}
        data-testid={`input-${label}`}
      />
      {error && <span data-testid="input-error">{error}</span>}
    </div>
  ),
}));

jest.mock('@/lib/problem-form-utils', () => ({
  labelClass: 'label-class',
  selectClass: 'select-class',
  textareaClass: 'textarea-class',
  validateProblemForm: () => ({}),
}));

jest.mock('@/lib/constants', () => ({
  PROBLEM_CATEGORIES: ['ALGORITHM', 'SQL'],
}));

const defaultForm = {
  title: 'Two Sum',
  description: 'Find two numbers that add up to target',
  difficulty: 'GOLD',
  deadline: '',
  allowedLanguages: ['python'],
  sourceUrl: 'https://boj.kr/1',
  sourcePlatform: 'BOJ',
  category: 'ALGORITHM',
  status: 'ACTIVE',
};

describe('BasicInfoSection', () => {
  const onChange = jest.fn(() => jest.fn());
  const defaultProps = {
    form: defaultForm,
    onChange,
    fieldErrors: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('제목 입력 필드가 렌더링된다', () => {
    renderWithI18n(<BasicInfoSection {...defaultProps} />);
    expect(screen.getByDisplayValue('Two Sum')).toBeInTheDocument();
  });

  it('설명 textarea가 렌더링된다', () => {
    renderWithI18n(<BasicInfoSection {...defaultProps} />);
    expect(
      screen.getByDisplayValue('Find two numbers that add up to target'),
    ).toBeInTheDocument();
  });

  it('카테고리 select가 초기값으로 렌더링된다', () => {
    renderWithI18n(<BasicInfoSection {...defaultProps} />);
    // 카테고리 레이블로 select 찾기
    const categorySelect = screen.getByLabelText(/카테고리/) as HTMLSelectElement;
    expect(categorySelect).toBeInTheDocument();
    expect(categorySelect.value).toBe('ALGORITHM');
  });

  it('설명 변경 시 onChange가 호출된다', () => {
    // onChange를 항상 같은 핸들러를 반환하도록 설정
    const mockHandler = jest.fn();
    onChange.mockReturnValue(mockHandler);
    renderWithI18n(<BasicInfoSection {...defaultProps} />);

    const textarea = screen.getByDisplayValue('Find two numbers that add up to target');
    fireEvent.change(textarea, { target: { value: '새 설명' } });
    expect(mockHandler).toHaveBeenCalled();
  });
});
