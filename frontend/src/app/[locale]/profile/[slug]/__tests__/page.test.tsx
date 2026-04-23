/**
 * @file 퍼블릭 프로필 페이지 테스트 — 데이터 렌더링, 404 처리, 스터디 링크
 * @domain share
 * @layer test
 */
import { render, screen, waitFor } from '@testing-library/react';
import PublicProfilePage from '../page';
import type { PublicProfile } from '@/lib/api';

/* ── mocks ── */

const mockSlug = { slug: 'test-user' };

jest.mock('next/navigation', () => ({
  useParams: () => mockSlug,
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce(
        (str, [k, v]) => str.replace(`{${k}}`, String(v)),
        key,
      );
    }
    return key;
  },
}));

jest.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} />
  ),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: (key: string) => `/avatars/${key}.svg`,
  getAvatarPresetKey: (url: string | null) => url ?? 'default',
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    User: Icon,
    BookOpen: Icon,
    Code2: Icon,
    Brain: Icon,
    ExternalLink: Icon,
    AlertCircle: Icon,
  };
});

const mockGetPublicProfile = jest.fn<Promise<PublicProfile>, [string]>();

jest.mock('@/lib/api', () => ({
  publicApi: {
    getPublicProfile: (...args: unknown[]) => mockGetPublicProfile(...(args as [string])),
  },
}));

/* ── helpers ── */

const MOCK_PROFILE: PublicProfile = {
  name: 'Test User',
  avatarUrl: 'preset:default',
  studies: [
    {
      studyName: 'Algorithm Study',
      memberCount: 5,
      shareLink: '/shared/abc123',
      totalSubmissions: 42,
      averageAiScore: 85,
    },
    {
      studyName: 'Data Structure Study',
      memberCount: 3,
      shareLink: null,
      totalSubmissions: 10,
      averageAiScore: null,
    },
  ],
  totalSubmissions: 52,
  averageAiScore: 83,
};

beforeEach(() => {
  mockGetPublicProfile.mockReset();
  mockSlug.slug = 'test-user';
});

/* ── tests ── */

describe('PublicProfilePage', () => {
  describe('프로필 데이터 렌더링', () => {
    it('프로필 이름이 표시된다', async () => {
      mockGetPublicProfile.mockResolvedValue(MOCK_PROFILE);

      render(<PublicProfilePage />);
      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });
    });

    it('총 제출 수가 표시된다', async () => {
      mockGetPublicProfile.mockResolvedValue(MOCK_PROFILE);

      render(<PublicProfilePage />);
      await waitFor(() => {
        expect(screen.getByText('52')).toBeInTheDocument();
        expect(screen.getByText('profile.public.totalSubmissions')).toBeInTheDocument();
      });
    });

    it('AI 평균 점수가 표시된다', async () => {
      mockGetPublicProfile.mockResolvedValue(MOCK_PROFILE);

      render(<PublicProfilePage />);
      await waitFor(() => {
        expect(screen.getByText('83')).toBeInTheDocument();
        expect(screen.getByText('profile.public.aiAverage')).toBeInTheDocument();
      });
    });

    it('참여 스터디 목록이 렌더링된다', async () => {
      mockGetPublicProfile.mockResolvedValue(MOCK_PROFILE);

      render(<PublicProfilePage />);
      await waitFor(() => {
        expect(screen.getByText('Algorithm Study')).toBeInTheDocument();
        expect(screen.getByText('Data Structure Study')).toBeInTheDocument();
      });
    });

    it('스터디별 제출 수와 AI 점수가 표시된다', async () => {
      mockGetPublicProfile.mockResolvedValue(MOCK_PROFILE);

      render(<PublicProfilePage />);
      await waitFor(() => {
        expect(screen.getAllByText('profile.public.studies.submissionCount').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('profile.public.studies.aiScore').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('이름이 null이면 "이름 없음"을 표시한다', async () => {
      mockGetPublicProfile.mockResolvedValue({ ...MOCK_PROFILE, name: null });

      render(<PublicProfilePage />);
      await waitFor(() => {
        expect(screen.getByText('profile.public.noName')).toBeInTheDocument();
      });
    });

    it('참여 스터디가 없으면 안내 메시지를 표시한다', async () => {
      mockGetPublicProfile.mockResolvedValue({ ...MOCK_PROFILE, studies: [] });

      render(<PublicProfilePage />);
      await waitFor(() => {
        expect(screen.getByText('profile.public.studies.empty')).toBeInTheDocument();
      });
    });
  });

  describe('404 처리', () => {
    it('API 호출 실패 시 "프로필을 찾을 수 없습니다" 표시', async () => {
      mockGetPublicProfile.mockRejectedValue(new Error('Not Found'));

      render(<PublicProfilePage />);
      await waitFor(() => {
        expect(screen.getByText('profile.public.notFound')).toBeInTheDocument();
      });
    });
  });

  describe('공유 링크 버튼', () => {
    it('shareLink가 있는 스터디는 "스터디룸 보기" 링크를 렌더링한다', async () => {
      mockGetPublicProfile.mockResolvedValue(MOCK_PROFILE);

      render(<PublicProfilePage />);
      await waitFor(() => {
        const link = screen.getByText('profile.public.studies.viewStudyRoom');
        expect(link).toBeInTheDocument();
        expect(link.closest('a')).toHaveAttribute('href', '/shared/abc123');
      });
    });

    it('shareLink가 null인 스터디는 링크를 표시하지 않는다', async () => {
      mockGetPublicProfile.mockResolvedValue({
        ...MOCK_PROFILE,
        studies: [MOCK_PROFILE.studies[1]], // Data Structure Study (shareLink: null)
      });

      render(<PublicProfilePage />);
      await waitFor(() => {
        expect(screen.getByText('Data Structure Study')).toBeInTheDocument();
      });

      expect(screen.queryByText('profile.public.studies.viewStudyRoom')).not.toBeInTheDocument();
    });
  });

  describe('로딩 상태', () => {
    it('로딩 중에는 스피너가 표시된다', () => {
      mockGetPublicProfile.mockReturnValue(new Promise(() => {})); // never resolves

      render(<PublicProfilePage />);
      // spinner is rendered via animate-spin class
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('slug 기반 API 호출', () => {
    it('slug 파라미터로 publicApi를 호출한다', async () => {
      mockGetPublicProfile.mockResolvedValue(MOCK_PROFILE);

      render(<PublicProfilePage />);
      await waitFor(() => {
        expect(mockGetPublicProfile).toHaveBeenCalledWith('test-user');
      });
    });
  });
});
