/**
 * @file InfoSection 컴포넌트 단위 테스트
 * @domain study
 * @layer test
 * @related InfoSection, studyApi
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { InfoSection } from '../InfoSection';

const mockUpdate = jest.fn();
jest.mock('@/lib/api', () => ({
  studyApi: {
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

jest.mock('@/components/ui/Input', () => ({
  Input: ({ value, onChange, placeholder }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input value={value} onChange={onChange} placeholder={placeholder} />
  ),
}));

const mockStudy = {
  id: 'study-1',
  name: '테스트 스터디',
  description: '스터디 설명',
  role: 'ADMIN' as const,
};

describe('InfoSection', () => {
  const defaultProps = {
    studyId: 'study-1',
    study: mockStudy,
    onStudyUpdate: jest.fn(),
    onSuccess: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('초기값으로 이름과 설명이 렌더링된다', () => {
    renderWithI18n(<InfoSection {...defaultProps} />);
    const nameInput = screen.getByDisplayValue('테스트 스터디');
    expect(nameInput).toBeInTheDocument();
    const descInput = screen.getByDisplayValue('스터디 설명');
    expect(descInput).toBeInTheDocument();
  });

  it('이름 입력 시 값이 변경된다', () => {
    renderWithI18n(<InfoSection {...defaultProps} />);
    const nameInput = screen.getByDisplayValue('테스트 스터디');
    fireEvent.change(nameInput, { target: { value: '새 스터디 이름' } });
    expect(screen.getByDisplayValue('새 스터디 이름')).toBeInTheDocument();
  });

  it('저장 버튼 클릭 시 확인 모달이 표시된다', () => {
    renderWithI18n(<InfoSection {...defaultProps} />);
    const saveBtn = screen.getByRole('button', { name: /저장/ });
    fireEvent.click(saveBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('확인 모달에서 확인 클릭 시 studyApi.update가 호출된다', async () => {
    mockUpdate.mockResolvedValue({ ...mockStudy });
    renderWithI18n(<InfoSection {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /저장/ }));
    // 저장 확인 모달의 두 번째 저장 버튼 (modal confirm)
    const confirmBtns = screen.getAllByRole('button', { name: /저장/ });
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('study-1', {
        name: '테스트 스터디',
        description: '스터디 설명',
      });
    });
  });

  it('확인 모달에서 취소 클릭 시 모달이 닫힌다', () => {
    renderWithI18n(<InfoSection {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /저장/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const cancelBtns = screen.getAllByRole('button', { name: /취소/ });
    fireEvent.click(cancelBtns[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
