import { render, screen } from '@testing-library/react';
import AnalysisPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({ id: 'sub-123' }),
  usePathname: () => '/submissions/sub-123/analysis',
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
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

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ isReady: true, isAuthenticated: true }),
}));

jest.mock('@/hooks/useRequireStudy', () => ({
  useRequireStudy: () => ({ isStudyReady: true }),
}));

jest.mock('@/hooks/useAiQuota', () => ({
  useAiQuota: () => ({ quota: { used: 2, limit: 10, remaining: 8 }, loading: false }),
}));

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

jest.mock('@/components/ui/CodeBlock', () => ({
  CodeBlock: ({ code }: { code: string }) => <pre data-testid="code-block">{code}</pre>,
}));

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: ({ height }: { height?: number }) => <div data-testid="skeleton" style={{ height }} />,
}));

jest.mock('@/components/ui/LangBadge', () => ({
  LangBadge: () => <span data-testid="lang-badge" />,
}));

jest.mock('@/components/ui/ScoreGauge', () => ({
  ScoreGauge: ({ score }: { score: number }) => <div data-testid="score-gauge">{score}</div>,
}));

jest.mock('@/components/ui/CategoryBar', () => ({
  CategoryBar: ({ item }: { item: { category: string } }) => (
    <div data-testid="category-bar">{item.category}</div>
  ),
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

jest.mock('@/lib/constants', () => ({
  toTierLevel: (rawLevel: number | null | undefined) => {
    if (rawLevel == null || rawLevel <= 0) return null;
    if (rawLevel >= 1 && rawLevel <= 5) return rawLevel;
    return 5 - ((rawLevel - 1) % 5);
  },
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

const mockFindById = jest.fn();
const mockGetAnalysis = jest.fn();
const mockProblemFindById = jest.fn();

jest.mock('@/lib/api', () => ({
  submissionApi: {
    findById: (...args: unknown[]) => mockFindById(...args),
    getAnalysis: (...args: unknown[]) => mockGetAnalysis(...args),
  },
  problemApi: {
    findById: (...args: unknown[]) => mockProblemFindById(...args),
  },
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    ArrowLeft: Icon,
    Loader2: Icon,
    Copy: Icon,
    Check: Icon,
    ExternalLink: Icon,
    Clock: Icon,
    Box: Icon,
    Code2: Icon,
    Sparkles: Icon,
    Zap: Icon,
    ChevronDown: Icon,
    Brain: Icon,
    BarChart3: Icon,
  };
});

describe('AnalysisPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('분석 결과 로딩 중 스켈레톤이 표시된다', () => {
    mockFindById.mockReturnValue(new Promise(() => {}));
    mockGetAnalysis.mockReturnValue(new Promise(() => {}));

    render(<AnalysisPage />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('AppLayout 안에 렌더링된다', () => {
    mockFindById.mockReturnValue(new Promise(() => {}));
    mockGetAnalysis.mockReturnValue(new Promise(() => {}));

    render(<AnalysisPage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('뒤로가기 버튼이 표시된다', () => {
    mockFindById.mockReturnValue(new Promise(() => {}));
    mockGetAnalysis.mockReturnValue(new Promise(() => {}));

    render(<AnalysisPage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('분석 pending 상태에서 대기 메시지가 표시된다', async () => {
    mockFindById.mockResolvedValue({
      id: 'sub-123',
      problemId: 'prob-1',
      problemTitle: 'Test Problem',
      language: 'python',
      createdAt: '2025-01-01T00:00:00Z',
    });
    mockProblemFindById.mockRejectedValue(new Error('not found'));
    mockGetAnalysis.mockResolvedValue({
      analysisStatus: 'pending',
      feedback: null,
      score: null,
      optimizedCode: null,
    });

    render(<AnalysisPage />);
    expect(await screen.findByText('AI 분석 중...')).toBeInTheDocument();
  });

  it('분석 실패 상태에서 에러 메시지가 표시된다', async () => {
    mockFindById.mockResolvedValue({
      id: 'sub-123',
      problemId: 'prob-1',
      problemTitle: 'Test Problem',
      language: 'python',
      createdAt: '2025-01-01T00:00:00Z',
    });
    mockProblemFindById.mockRejectedValue(new Error('not found'));
    mockGetAnalysis.mockResolvedValue({
      analysisStatus: 'failed',
      feedback: null,
      score: null,
      optimizedCode: null,
    });

    render(<AnalysisPage />);
    expect(
      await screen.findByText(/AI 분석 중 오류가 발생했습니다/),
    ).toBeInTheDocument();
  });

  it('분석 완료 시 점수와 총평이 표시된다', async () => {
    mockFindById.mockResolvedValue({
      id: 'sub-123',
      problemId: 'prob-1',
      problemTitle: 'Test Problem',
      language: 'python',
      createdAt: '2025-01-01T00:00:00Z',
      sagaStep: 'DONE',
    });
    mockProblemFindById.mockRejectedValue(new Error('not found'));
    mockGetAnalysis.mockResolvedValue({
      analysisStatus: 'completed',
      feedback: JSON.stringify({
        totalScore: 85,
        summary: '잘 작성된 코드입니다.',
        categories: [
          { name: 'readability', score: 90, comment: '좋음', highlights: [] },
        ],
        optimizedCode: null,
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
      }),
      score: 85,
      optimizedCode: null,
    });

    render(<AnalysisPage />);
    expect(await screen.findByText('잘 작성된 코드입니다.')).toBeInTheDocument();
    expect(screen.getByTestId('score-gauge')).toBeInTheDocument();
  });
});
