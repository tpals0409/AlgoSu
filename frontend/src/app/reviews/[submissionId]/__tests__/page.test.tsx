import { render, screen } from '@testing-library/react';
import CodeReviewPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({ submissionId: 'sub-123' }),
  usePathname: () => '/reviews/sub-123',
}));

jest.mock('next/dynamic', () => {
  return (loader: () => Promise<{ default: React.ComponentType }>, opts?: { loading?: () => React.ReactNode }) => {
    const MockComponent = (props: Record<string, unknown>) => {
      const name = (loader as unknown as { _name?: string })._name ?? 'DynamicComponent';
      return <div data-testid={`dynamic-${name}`} {...props} />;
    };
    MockComponent.displayName = 'MockDynamic';

    // If there's a loading component, we just return the mock anyway
    if (opts?.loading) {
      void opts.loading;
    }
    return MockComponent;
  };
});

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { email: 'test@example.com', avatarPreset: 'default' },
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
  }),
}));

jest.mock('@/components/ui/LangBadge', () => ({
  LangBadge: () => <span data-testid="lang-badge" />,
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: ({ height }: { height?: number }) => <div data-testid="skeleton" style={{ height }} />,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/review/CodePanel', () => ({
  CodePanel: () => <div data-testid="code-panel" />,
}));

jest.mock('@/components/review/CommentThread', () => ({
  CommentThread: () => <div data-testid="comment-thread" />,
}));

jest.mock('@/components/review/CommentForm', () => ({
  CommentForm: () => <div data-testid="comment-form" />,
}));

jest.mock('@/components/ui/ScoreGauge', () => ({
  ScoreGauge: () => <div data-testid="score-gauge" />,
}));

jest.mock('@/components/ui/CategoryBar', () => ({
  CategoryBar: () => <div data-testid="category-bar" />,
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

const mockFindById = jest.fn();
const mockGetAnalysis = jest.fn();
const mockListComments = jest.fn();

jest.mock('@/lib/api', () => ({
  submissionApi: {
    findById: (...args: unknown[]) => mockFindById(...args),
    getAnalysis: (...args: unknown[]) => mockGetAnalysis(...args),
  },
  reviewApi: {
    listComments: (...args: unknown[]) => mockListComments(...args),
    createComment: jest.fn().mockResolvedValue({}),
    updateComment: jest.fn().mockResolvedValue({}),
    deleteComment: jest.fn().mockResolvedValue({}),
    createReply: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Maximize2: Icon,
    Minimize2: Icon,
    AlertCircle: Icon,
    Code2: Icon,
  };
});

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('CodeReviewPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('로딩 중 스켈레톤이 표시된다', () => {
    mockFindById.mockReturnValue(new Promise(() => {}));
    mockGetAnalysis.mockReturnValue(new Promise(() => {}));
    mockListComments.mockReturnValue(new Promise(() => {}));

    render(<CodeReviewPage />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('데이터 로드 후 코드 리뷰 헤더가 표시된다', async () => {
    mockFindById.mockResolvedValue({
      id: 'sub-123',
      problemTitle: 'Two Sum',
      language: 'python',
      createdAt: '2025-01-01T00:00:00Z',
    });
    mockGetAnalysis.mockResolvedValue({
      analysisStatus: 'completed',
      feedback: JSON.stringify({ categories: [] }),
      score: 80,
      optimizedCode: 'print("hello")',
    });
    mockListComments.mockResolvedValue([]);

    render(<CodeReviewPage />);
    expect(await screen.findByText('Two Sum')).toBeInTheDocument();
  });

  it('에러 발생 시 에러 메시지가 표시된다', async () => {
    mockFindById.mockRejectedValue(new Error('Network Error'));
    mockGetAnalysis.mockRejectedValue(new Error('Network Error'));
    mockListComments.mockRejectedValue(new Error('Network Error'));

    render(<CodeReviewPage />);
    expect(await screen.findByText('데이터를 불러오지 못했습니다.')).toBeInTheDocument();
  });

  it('제출물이 없으면 에러 상태가 표시된다', async () => {
    mockFindById.mockRejectedValue(new Error('Not found'));
    mockGetAnalysis.mockResolvedValue(null);
    mockListComments.mockResolvedValue([]);

    render(<CodeReviewPage />);
    expect(await screen.findByText('데이터를 불러오지 못했습니다.')).toBeInTheDocument();
  });
});
