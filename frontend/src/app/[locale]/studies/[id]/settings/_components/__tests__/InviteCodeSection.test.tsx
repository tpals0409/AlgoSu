/**
 * @file InviteCodeSection 컴포넌트 단위 테스트
 * @domain study
 * @layer test
 * @related InviteCodeSection, studyApi
 */

import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { InviteCodeSection } from '../InviteCodeSection';

const mockInvite = jest.fn();
jest.mock('@/lib/api', () => ({
  studyApi: {
    invite: (...args: unknown[]) => mockInvite(...args),
  },
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Input', () => ({
  Input: ({ value, readOnly, className }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input data-testid="invite-code-input" value={value} readOnly={readOnly} className={className} onChange={() => {}} />
  ),
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { Copy: Icon, RefreshCw: Icon };
});

describe('InviteCodeSection', () => {
  const defaultProps = {
    studyId: 'study-1',
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // clipboard mock
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      writable: true,
    });
  });

  it('초대 코드 UI가 렌더링된다', () => {
    renderWithI18n(<InviteCodeSection {...defaultProps} />);
    expect(screen.getByTestId('invite-code-input')).toBeInTheDocument();
  });

  it('새로고침 버튼이 렌더링된다', () => {
    renderWithI18n(<InviteCodeSection {...defaultProps} />);
    const refreshBtn = screen.getByLabelText(/새로고침|재생성|refresh/i);
    expect(refreshBtn).toBeInTheDocument();
  });

  it('새로고침 버튼 클릭 시 studyApi.invite가 호출된다', async () => {
    const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
    mockInvite.mockResolvedValue({ code: 'TEST-CODE-123', expires_at: futureDate });

    renderWithI18n(<InviteCodeSection {...defaultProps} />);
    const refreshBtn = screen.getByLabelText(/새로고침|재생성|refresh/i);
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(mockInvite).toHaveBeenCalledWith('study-1');
    });
  });

  it('API 호출 실패 시 onError가 호출된다', async () => {
    mockInvite.mockRejectedValue(new Error('코드 생성 실패'));

    renderWithI18n(<InviteCodeSection {...defaultProps} />);
    const refreshBtn = screen.getByLabelText(/새로고침|재생성|refresh/i);
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(defaultProps.onError).toHaveBeenCalledWith('코드 생성 실패');
    });
  });
});
