/**
 * @file 스터디 설정 페이지 regression 가드 테스트
 * @domain study
 * @layer test
 * @related settings/page.tsx
 *
 * Sprint 242 Critic M-1 regression guard:
 * 섹션에서 에러 발생 후 성공 시 에러 Alert가 사라지는지 검증 (handleSuccess에서 setError(null) 호출 보장).
 */

import React, { Suspense } from 'react';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import StudySettingsPage from '../page';

// ─── 섹션 컴포넌트 모킹 (onSuccess/onError 콜백 노출용 버튼 제공) ───

jest.mock('../_components/InfoSection', () => ({
  InfoSection: ({
    onSuccess,
    onError,
  }: {
    onSuccess: (msg: string) => void;
    onError: (msg: string) => void;
  }) => (
    <div data-testid="info-section">
      <button data-testid="info-trigger-error" onClick={() => onError('정보 저장 오류')}>
        trigger error
      </button>
      <button data-testid="info-trigger-success" onClick={() => onSuccess('정보가 저장되었습니다.')}>
        trigger success
      </button>
    </div>
  ),
}));

jest.mock('../_components/AvatarSection', () => ({
  AvatarSection: () => <div data-testid="avatar-section" />,
}));

jest.mock('../_components/RulesSection', () => ({
  RulesSection: () => <div data-testid="rules-section" />,
}));

jest.mock('../_components/MembersSection', () => ({
  MembersSection: () => <div data-testid="members-section" />,
}));

jest.mock('../_components/InviteCodeSection', () => ({
  InviteCodeSection: () => <div data-testid="invite-code-section" />,
}));

jest.mock('../_components/DeleteSection', () => ({
  DeleteSection: () => <div data-testid="delete-section" />,
}));

// ─── 공통 모킹 ───────────────────────────

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/studies/study-1/settings',
  Link: () => null,
  redirect: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/studies/study-1/settings',
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'user-1', email: 'admin@example.com', avatarPreset: 'default' },
    logout: jest.fn(),
  }),
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({
    currentStudyId: 'study-1',
    currentStudyName: 'Test Study',
    studies: [{ id: 'study-1', name: 'Test Study' }],
    setCurrentStudy: jest.fn(),
    studiesLoaded: true,
    removeStudy: jest.fn(),
  }),
}));

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ isReady: true, isAuthenticated: true }),
}));

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({
    children,
    variant,
    onClose,
  }: {
    children: React.ReactNode;
    variant?: string;
    onClose?: () => void;
  }) => (
    <div data-testid={`alert-${variant ?? 'default'}`} role="alert">
      {children}
      {onClose && <button onClick={onClose}>close</button>}
    </div>
  ),
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

jest.mock('lucide-react', () => ({
  ArrowLeft: () => <svg data-testid="arrow-left" />,
}));

const mockStudy = {
  id: 'study-1',
  name: 'Test Study',
  description: '테스트 스터디',
  groundRules: '',
  role: 'ADMIN' as const,
};

const mockMembers = [{ id: 'user-1', name: 'Admin', role: 'ADMIN' as const }];

jest.mock('@/lib/api', () => ({
  studyApi: {
    getById: jest.fn(),
    getMembers: jest.fn(),
  },
}));

// ─── TESTS ───────────────────────────────

describe('StudySettingsPage — M-1 regression (error cleared on success)', () => {
  let studyApi: { getById: jest.Mock; getMembers: jest.Mock };

  const renderPage = async (): Promise<void> => {
    const paramsPromise = Promise.resolve({ id: 'study-1' });
    await act(async () => {
      renderWithI18n(
        <Suspense fallback={<div>loading</div>}>
          <StudySettingsPage params={paramsPromise} />
        </Suspense>,
      );
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    studyApi = require('@/lib/api').studyApi;
    studyApi.getById.mockResolvedValue(mockStudy);
    studyApi.getMembers.mockResolvedValue(mockMembers);
  });

  it('[M-1] 섹션 에러 후 성공 시 에러 Alert가 사라진다', async () => {
    await renderPage();

    // 페이지 로드 완료 대기 (studyApi.getById 해소 후 study 섹션 렌더링)
    await waitFor(() => {
      expect(screen.getByTestId('info-section')).toBeInTheDocument();
    });

    // 에러 발생
    await act(async () => {
      fireEvent.click(screen.getByTestId('info-trigger-error'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('alert-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('alert-error')).toHaveTextContent('정보 저장 오류');

    // 성공 발생 → 에러 Alert 사라져야 한다 (handleSuccess: setError(null) 선행)
    await act(async () => {
      fireEvent.click(screen.getByTestId('info-trigger-success'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('alert-error')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('alert-success')).toHaveTextContent('정보가 저장되었습니다.');
  });

  it('[M-1] 성공 후 에러 발생 시 에러 Alert가 표시된다', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('info-section')).toBeInTheDocument();
    });

    // 성공 먼저
    await act(async () => {
      fireEvent.click(screen.getByTestId('info-trigger-success'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('alert-success')).toBeInTheDocument();
    });

    // 이후 에러 발생 → 에러 Alert 표시
    await act(async () => {
      fireEvent.click(screen.getByTestId('info-trigger-error'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('alert-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('alert-error')).toHaveTextContent('정보 저장 오류');
  });
});
