/**
 * @file Settings 페이지 테스트 — slug 유효성 검증, 예약어 차단, 공개 토글, 저장
 * @domain share
 * @layer test
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import SettingsPage from '../page';
import { swrFetcher } from '@/lib/swr';
import type { ProfileSettings } from '@/lib/api';

/* ── SWR fetcher 모킹 ── */

jest.mock('@/lib/swr', () => ({
  ...jest.requireActual('@/lib/swr'),
  swrFetcher: jest.fn(),
}));

const mockedSwrFetcher = jest.mocked(swrFetcher);

/* ── mocks ── */

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/settings',
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { email: 'test@example.com', avatarPreset: 'default' },
    logout: jest.fn(),
    githubConnected: false,
    updateGitHubStatus: jest.fn(),
    updateAvatar: jest.fn(),
  }),
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({
    currentStudyId: 'study-1',
    studies: [{ id: 'study-1', name: 'Test Study' }],
    setCurrentStudy: jest.fn(),
    studiesLoaded: true,
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

jest.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Settings: Icon,
    Globe: Icon,
    Link: Icon,
    Check: Icon,
    AlertCircle: Icon,
  };
});

const mockGetProfile = jest.fn<Promise<ProfileSettings>, []>();
const mockUpdateProfile = jest.fn<Promise<ProfileSettings>, [{ profileSlug?: string; isProfilePublic?: boolean }]>();

jest.mock('@/lib/api', () => ({
  settingsApi: {
    getProfile: (...args: unknown[]) => mockGetProfile(...(args as [])),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...(args as [{ profileSlug?: string; isProfilePublic?: boolean }])),
  },
}));

/* ── helpers ── */

const DEFAULT_SETTINGS: ProfileSettings = {
  profileSlug: null,
  isProfilePublic: false,
};

/**
 * SWR 테스트 wrapper — 격리된 캐시, mockedSwrFetcher 주입
 * mockGetProfile에 위임하여 기존 테스트 패턴 유지
 */
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig
    value={{
      provider: () => new Map(),
      dedupingInterval: 0,
      fetcher: mockedSwrFetcher,
      shouldRetryOnError: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }}
  >
    {children}
  </SWRConfig>
);

/** 설정 로드 완료까지 대기 (로딩 스피너가 사라지고 폼이 렌더링될 때까지) */
async function waitForLoaded() {
  await waitFor(() => {
    expect(screen.getByText('settings.form.publicProfile.title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('settings.form.slug.placeholder')).toBeInTheDocument();
  });
}

beforeEach(() => {
  mockGetProfile.mockReset();
  mockGetProfile.mockResolvedValue(DEFAULT_SETTINGS);
  mockUpdateProfile.mockReset();
  mockUpdateProfile.mockResolvedValue({ profileSlug: 'my-slug', isProfilePublic: true });
  // SWR fetcher: settings key를 mockGetProfile에 위임
  mockedSwrFetcher.mockReset();
  mockedSwrFetcher.mockImplementation((key: string | readonly [string, ...unknown[]]) => {
    const path = Array.isArray(key) ? key[0] : key;
    if (path === '/api/users/me/settings') return mockGetProfile();
    return Promise.resolve(null);
  });
});

/* ── tests ── */

describe('SettingsPage', () => {
  describe('초기 렌더링', () => {
    it('설정 페이지 제목이 표시된다', async () => {
      render(<SettingsPage />, { wrapper });
      await waitFor(() => {
        expect(screen.getByText('settings.heading')).toBeInTheDocument();
      });
    });

    it('퍼블릭 프로필 섹션이 표시된다', async () => {
      render(<SettingsPage />, { wrapper });
      await waitFor(() => {
        expect(screen.getByText('settings.form.publicProfile.title')).toBeInTheDocument();
      });
    });

    it('설정을 로드한다', async () => {
      render(<SettingsPage />, { wrapper });
      await waitFor(() => {
        expect(mockGetProfile).toHaveBeenCalled();
      });
    });

    it('기존 slug 값이 입력 필드에 표시된다', async () => {
      mockGetProfile.mockResolvedValue({ profileSlug: 'existing-slug', isProfilePublic: false });

      render(<SettingsPage />, { wrapper });
      await waitFor(() => {
        expect(screen.getByDisplayValue('existing-slug')).toBeInTheDocument();
      });
    });
  });

  describe('slug 유효성 검증', () => {
    it('유효한 slug는 에러를 표시하지 않는다', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />, { wrapper });
      await waitForLoaded();

      const input = screen.getByPlaceholderText('settings.form.slug.placeholder');
      await user.clear(input);
      await user.type(input, 'valid-slug');

      expect(screen.queryByText('settings.validation.slug.pattern')).not.toBeInTheDocument();
    });

    it('하이픈으로 시작하는 slug는 에러를 표시한다', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />, { wrapper });
      await waitForLoaded();

      const input = screen.getByPlaceholderText('settings.form.slug.placeholder');
      await user.clear(input);
      // 하이픈으로 시작 — SLUG_REGEX 불만족
      await user.type(input, '-invalid');

      await waitFor(() => {
        expect(screen.getByText('settings.validation.slug.pattern')).toBeInTheDocument();
      });
    });

    it('2자 이하의 slug는 에러를 표시한다', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />, { wrapper });
      await waitForLoaded();

      const input = screen.getByPlaceholderText('settings.form.slug.placeholder');
      await user.clear(input);
      await user.type(input, 'ab');

      await waitFor(() => {
        expect(screen.getByText('settings.validation.slug.pattern')).toBeInTheDocument();
      });
    });
  });

  describe('예약어 차단', () => {
    it.each(['admin', 'api', 'login', 'settings', 'profile'])(
      '예약어 "%s"는 에러를 표시한다',
      async (reserved) => {
        const user = userEvent.setup();
        render(<SettingsPage />, { wrapper });
        await waitForLoaded();

        const input = screen.getByPlaceholderText('settings.form.slug.placeholder');
        await user.clear(input);
        await user.type(input, reserved);

        await waitFor(() => {
          expect(screen.getByText('settings.validation.slug.reserved')).toBeInTheDocument();
        });
      },
    );
  });

  describe('공개 토글', () => {
    it('토글 스위치가 렌더링된다', async () => {
      render(<SettingsPage />, { wrapper });
      await waitForLoaded();

      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('토글 클릭 시 상태가 변경된다', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />, { wrapper });
      await waitForLoaded();

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'false');

      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('slug 없이 공개 시도', () => {
    it('slug 없이 공개하려 하면 경고를 표시한다', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />, { wrapper });
      await waitForLoaded();

      // 공개 토글 활성화
      await user.click(screen.getByRole('switch'));

      // slug 비어있는 상태로 저장 시도
      await user.click(screen.getByRole('button', { name: 'settings.form.save' }));

      await waitFor(() => {
        expect(screen.getByText('settings.validation.slug.requiredForPublic')).toBeInTheDocument();
      });

      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });
  });

  describe('저장', () => {
    it('유효한 slug로 저장 성공 시 메시지를 표시한다', async () => {
      const user = userEvent.setup();
      mockUpdateProfile.mockResolvedValue({ profileSlug: 'my-slug', isProfilePublic: true });

      render(<SettingsPage />, { wrapper });
      await waitForLoaded();

      const input = screen.getByPlaceholderText('settings.form.slug.placeholder');
      await user.clear(input);
      await user.type(input, 'my-slug');
      await user.click(screen.getByRole('switch'));
      await user.click(screen.getByRole('button', { name: 'settings.form.save' }));

      await waitFor(() => {
        expect(screen.getByText('settings.validation.save.success')).toBeInTheDocument();
      });

      expect(mockUpdateProfile).toHaveBeenCalledWith({
        profileSlug: 'my-slug',
        isProfilePublic: true,
      });
    });

    it('저장 실패 시 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup();
      mockUpdateProfile.mockRejectedValue(new Error('이미 사용 중인 slug입니다.'));

      render(<SettingsPage />, { wrapper });
      await waitForLoaded();

      const input = screen.getByPlaceholderText('settings.form.slug.placeholder');
      await user.clear(input);
      await user.type(input, 'taken-slug');
      await user.click(screen.getByRole('button', { name: 'settings.form.save' }));

      await waitFor(() => {
        expect(screen.getByText('이미 사용 중인 slug입니다.')).toBeInTheDocument();
      });
    });

    it('저장 중에는 버튼이 "저장 중..."으로 표시된다', async () => {
      const user = userEvent.setup();
      mockUpdateProfile.mockReturnValue(new Promise(() => {})); // never resolves

      render(<SettingsPage />, { wrapper });
      await waitForLoaded();

      const input = screen.getByPlaceholderText('settings.form.slug.placeholder');
      await user.clear(input);
      await user.type(input, 'my-slug');
      await user.click(screen.getByRole('button', { name: 'settings.form.save' }));

      expect(screen.getByText('settings.form.saving')).toBeInTheDocument();
    });

    it('slug 에러가 있으면 저장 버튼이 비활성화된다', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />, { wrapper });
      await waitForLoaded();

      const input = screen.getByPlaceholderText('settings.form.slug.placeholder');
      await user.clear(input);
      await user.type(input, 'admin'); // reserved

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'settings.form.save' })).toBeDisabled();
      });
    });
  });

  describe('프로필 링크 표시', () => {
    it('저장된 slug + 공개 상태면 프로필 링크를 표시한다', async () => {
      mockGetProfile.mockResolvedValue({ profileSlug: 'my-profile', isProfilePublic: true });

      render(<SettingsPage />, { wrapper });
      await waitFor(() => {
        expect(screen.getByText('settings.form.profileLink')).toBeInTheDocument();
      });

      expect(screen.getByText('algosu.com/profile/my-profile')).toBeInTheDocument();
    });

    it('비공개 상태면 프로필 링크를 표시하지 않는다', async () => {
      mockGetProfile.mockResolvedValue({ profileSlug: 'my-profile', isProfilePublic: false });

      render(<SettingsPage />, { wrapper });
      await waitForLoaded();

      expect(screen.queryByText('settings.form.profileLink')).not.toBeInTheDocument();
    });
  });
});
