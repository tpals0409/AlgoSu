/**
 * @file DeleteSection 컴포넌트 단위 테스트
 * @domain study
 * @layer test
 * @related DeleteSection, studyApi
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { DeleteSection } from '../DeleteSection';
import type { StudyMember } from '@/lib/api';

const mockDelete = jest.fn();
jest.mock('@/lib/api', () => ({
  studyApi: {
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, className }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} disabled={disabled} className={className}>{children}</button>
  ),
}));

const singleAdminMember: StudyMember = {
  id: 'mem-1',
  study_id: 'study-1',
  user_id: 'user-1',
  role: 'ADMIN',
  joined_at: '2024-01-01',
  nickname: '관리자',
};

const multiAdminMembers: StudyMember[] = [
  { ...singleAdminMember },
  {
    id: 'mem-2',
    study_id: 'study-1',
    user_id: 'user-2',
    role: 'ADMIN',
    joined_at: '2024-01-02',
    nickname: '관리자2',
  },
];

describe('DeleteSection', () => {
  const defaultProps = {
    studyId: 'study-1',
    members: [singleAdminMember],
    onDelete: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('관리자 1명일 때 삭제 버튼이 표시된다', () => {
    renderWithI18n(<DeleteSection {...defaultProps} />);
    expect(screen.getByRole('button', { name: /스터디 삭제/ })).toBeInTheDocument();
  });

  it('관리자 2명 이상일 때 삭제 버튼이 없다', () => {
    renderWithI18n(<DeleteSection {...defaultProps} members={multiAdminMembers} />);
    expect(screen.queryByRole('button', { name: /스터디 삭제/ })).not.toBeInTheDocument();
  });

  it('삭제 버튼 클릭 시 확인 모달이 표시된다', () => {
    renderWithI18n(<DeleteSection {...defaultProps} />);
    const deleteBtn = screen.getByRole('button', { name: /스터디 삭제/ });
    fireEvent.click(deleteBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('확인 모달에서 확인 클릭 시 studyApi.delete가 호출된다', async () => {
    mockDelete.mockResolvedValue({});
    renderWithI18n(<DeleteSection {...defaultProps} />);

    // 위험 구역 "스터디 삭제" 버튼 클릭
    const deleteBtns = screen.getAllByRole('button', { name: /삭제/ });
    fireEvent.click(deleteBtns[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // 모달 내 "삭제" 버튼 클릭 (두 번째 삭제 버튼)
    const confirmBtns = screen.getAllByRole('button', { name: /삭제/ });
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('study-1');
    });
    expect(defaultProps.onDelete).toHaveBeenCalled();
  });

  it('확인 모달에서 취소 클릭 시 모달이 닫힌다', () => {
    renderWithI18n(<DeleteSection {...defaultProps} />);
    const deleteBtns = screen.getAllByRole('button', { name: /삭제/ });
    fireEvent.click(deleteBtns[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /취소/ });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
