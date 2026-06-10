/**
 * @file LanguageSection 컴포넌트 단위 테스트
 * @domain problem
 * @layer test
 * @related LanguageSection
 */

import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { LanguageSection } from '../LanguageSection';

jest.mock('@/lib/problem-form-utils', () => ({
  labelClass: 'label-class',
}));

jest.mock('@/lib/constants', () => ({
  LANGUAGES: [
    { label: 'Python', value: 'python' },
    { label: 'JavaScript', value: 'javascript' },
    { label: 'Java', value: 'java' },
  ],
}));

describe('LanguageSection', () => {
  const onToggle = jest.fn();
  const defaultProps = {
    allowedLanguages: ['python', 'javascript'],
    onToggle,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('언어 버튼이 모두 렌더링된다', () => {
    renderWithI18n(<LanguageSection {...defaultProps} />);
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Java')).toBeInTheDocument();
  });

  it('활성화된 언어 버튼은 aria-pressed=true', () => {
    renderWithI18n(<LanguageSection {...defaultProps} />);
    const pythonBtn = screen.getByRole('button', { name: /Python/ });
    expect(pythonBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('비활성화된 언어 버튼은 aria-pressed=false', () => {
    renderWithI18n(<LanguageSection {...defaultProps} />);
    const javaBtn = screen.getByRole('button', { name: /Java$/ });
    expect(javaBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('버튼 클릭 시 onToggle이 해당 언어 값으로 호출된다', () => {
    renderWithI18n(<LanguageSection {...defaultProps} />);
    const jsBtn = screen.getByRole('button', { name: /JavaScript/ });
    fireEvent.click(jsBtn);
    expect(onToggle).toHaveBeenCalledWith('javascript');
  });

  it('disabled=true이면 버튼이 비활성화된다', () => {
    renderWithI18n(<LanguageSection {...defaultProps} disabled />);
    const pythonBtn = screen.getByRole('button', { name: /Python/ });
    expect(pythonBtn).toBeDisabled();
  });
});
