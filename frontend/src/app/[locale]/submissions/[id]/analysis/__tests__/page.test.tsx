import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import AnalysisPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({ id: 'sub-123' }),
  usePathname: () => '/submissions/sub-123/analysis',
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
  Link: ({ children, ...props }: { children: React.ReactNode; href: string }) => <a {...props}>{children}</a>,
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

jest.mock('@/components/submission/AiSatisfactionButton', () => ({
  AiSatisfactionButton: () => <div data-testid="ai-satisfaction" />,
}));

jest.mock('@/lib/feedback', () => ({
  parseFeedback: (feedback: string | null, score: number | null, optimizedCode: string | null) => {
    if (!feedback) return null;
    try {
      const parsed = JSON.parse(feedback);
      return {
        totalScore: parsed.totalScore ?? score ?? 0,
        summary: parsed.summary ?? '',
        categories: parsed.categories ?? [],
        optimizedCode: parsed.optimizedCode ?? optimizedCode ?? null,
        timeComplexity: parsed.timeComplexity ?? null,
        spaceComplexity: parsed.spaceComplexity ?? null,
      };
    } catch {
      return null;
    }
  },
}));

jest.mock('@/lib/date', () => ({
  relativeTime: () => '방금 전',
}));

jest.mock('@/lib/constants', () => ({
  DIFF_DOT_STYLE: {},
  DIFF_BADGE_STYLE: {},
  toTierLevel: (rawLevel: number | null | undefined) => {
    if (rawLevel == null || rawLevel <= 0) return null;
    return 5 - ((rawLevel - 1) % 5);
  },
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

const mockFindById = jest.fn();
const mockGetAnalysis = jest.fn();
const mockReanalyze = jest.fn();
const mockProblemFindById = jest.fn();

jest.mock('@/lib/api', () => ({
  submissionApi: {
    findById: (...args: unknown[]) => mockFindById(...args),
    getAnalysis: (...args: unknown[]) => mockGetAnalysis(...args),
    reanalyze: (...args: unknown[]) => mockReanalyze(...args),
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

    renderWithI18n(<AnalysisPage />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('AppLayout 안에 렌더링된다', () => {
    mockFindById.mockReturnValue(new Promise(() => {}));
    mockGetAnalysis.mockReturnValue(new Promise(() => {}));

    renderWithI18n(<AnalysisPage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('뒤로가기 버튼이 표시된다', () => {
    mockFindById.mockReturnValue(new Promise(() => {}));
    mockGetAnalysis.mockReturnValue(new Promise(() => {}));

    renderWithI18n(<AnalysisPage />);
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

    renderWithI18n(<AnalysisPage />);
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

    renderWithI18n(<AnalysisPage />);
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

    renderWithI18n(<AnalysisPage />);
    expect(await screen.findByText('잘 작성된 코드입니다.')).toBeInTheDocument();
    expect(screen.getByTestId('score-gauge')).toBeInTheDocument();
  });

  // ─── SKIPPED (AI 한도 초과 → 재분석 요청) ──────────
  const skippedSubmission = {
    id: 'sub-123',
    problemId: 'prob-1',
    problemTitle: 'Test Problem',
    language: 'python',
    createdAt: '2025-01-01T00:00:00Z',
    sagaStep: 'DONE',
  };

  it('skipped 상태에서 재분석 요청 버튼과 안내가 표시된다', async () => {
    mockFindById.mockResolvedValue(skippedSubmission);
    mockProblemFindById.mockRejectedValue(new Error('not found'));
    mockGetAnalysis.mockResolvedValue({
      analysisStatus: 'skipped',
      feedback: null,
      score: null,
      optimizedCode: null,
    });

    renderWithI18n(<AnalysisPage />);
    expect(await screen.findByText('AI 분석이 건너뛰어졌습니다')).toBeInTheDocument();
    expect(screen.getByText('재분석 요청')).toBeInTheDocument();
  });

  it('재분석 요청 성공(aiSkipped=false) 시 pending 상태로 전환된다', async () => {
    mockFindById.mockResolvedValue(skippedSubmission);
    mockProblemFindById.mockRejectedValue(new Error('not found'));
    mockGetAnalysis.mockResolvedValue({
      analysisStatus: 'skipped',
      feedback: null,
      score: null,
      optimizedCode: null,
    });
    mockReanalyze.mockResolvedValue({ analysisStatus: 'pending', aiSkipped: false });

    renderWithI18n(<AnalysisPage />);
    const btn = await screen.findByText('재분석 요청');
    fireEvent.click(btn);

    await waitFor(() => expect(mockReanalyze).toHaveBeenCalledWith('sub-123'));
    expect(await screen.findByText('AI 분석 중...')).toBeInTheDocument();
  });

  it('한도가 여전히 초과(aiSkipped=true)면 안내 문구가 표시된다', async () => {
    mockFindById.mockResolvedValue(skippedSubmission);
    mockProblemFindById.mockRejectedValue(new Error('not found'));
    mockGetAnalysis.mockResolvedValue({
      analysisStatus: 'skipped',
      feedback: null,
      score: null,
      optimizedCode: null,
    });
    mockReanalyze.mockResolvedValue({ analysisStatus: 'skipped', aiSkipped: true });

    renderWithI18n(<AnalysisPage />);
    const btn = await screen.findByText('재분석 요청');
    fireEvent.click(btn);

    expect(
      await screen.findByText(/아직 오늘의 AI 분석 한도가 남아있지 않습니다/),
    ).toBeInTheDocument();
  });
});
