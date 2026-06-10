/**
 * @file AvatarSection 컴포넌트 단위 테스트
 * @domain study
 * @layer test
 * @related AvatarSection, studyApi
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { AvatarSection } from '../AvatarSection';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} />
  ),
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarPresetKey: (url: string | null | undefined) =>
    url?.startsWith('preset:') ? url.slice(7) : 'study-default',
  getAvatarSrc: (key: string) => `/avatars/${key}.svg`,
  toAvatarUrl: (key: string) => `preset:${key}`,
  STUDY_AVATAR_PRESETS: [
    { key: 'study-default', label: '기본' },
    { key: 'study-code', label: '코드' },
    { key: 'study-review', label: '리뷰' },
  ],
}));

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

const mockStudy = {
  id: 'study-1',
  name: 'Test Study',
  description: 'desc',
  role: 'ADMIN' as const,
  avatar_url: 'preset:study-default',
};

describe('AvatarSection', () => {
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

  it('아바타 프리셋 그리드가 렌더링된다', () => {
    renderWithI18n(<AvatarSection {...defaultProps} />);
    expect(screen.getByAltText('기본')).toBeInTheDocument();
    expect(screen.getByAltText('코드')).toBeInTheDocument();
    expect(screen.getByAltText('리뷰')).toBeInTheDocument();
  });

  it('프리셋 버튼 클릭 시 선택 상태가 변경된다', () => {
    renderWithI18n(<AvatarSection {...defaultProps} />);
    const codeBtn = screen.getByAltText('코드').closest('button');
    expect(codeBtn).not.toBeNull();
    fireEvent.click(codeBtn!);
    // 선택 후 border-primary 클래스가 적용된 버튼이 존재해야 함
    expect(codeBtn).toHaveClass('border-primary');
  });

  it('저장 버튼 클릭 시 studyApi.update가 호출된다', async () => {
    mockUpdate.mockResolvedValue({ ...mockStudy, avatar_url: 'preset:study-code' });
    renderWithI18n(<AvatarSection {...defaultProps} />);

    // 코드 프리셋 선택
    const codeBtn = screen.getByAltText('코드').closest('button')!;
    fireEvent.click(codeBtn);

    // 저장 버튼 클릭
    const saveBtn = screen.getByRole('button', { name: /저장/ });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('study-1', {
        avatarUrl: 'preset:study-code',
      });
    });
    expect(defaultProps.onSuccess).toHaveBeenCalled();
  });

  it('저장 실패 시 onError가 호출된다', async () => {
    mockUpdate.mockRejectedValue(new Error('저장 실패'));
    renderWithI18n(<AvatarSection {...defaultProps} />);

    const saveBtn = screen.getByRole('button', { name: /저장/ });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalledWith('저장 실패');
    });
  });
});
