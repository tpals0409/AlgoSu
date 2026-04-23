import { render, screen, act } from '@testing-library/react';
import { Suspense } from 'react';
import SubmissionStatusPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/submissions/sub-123/status',
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

jest.mock('@/hooks/useSubmissionSSE', () => ({
  useSubmissionSSE: () => ({
    status: 'pending' as const,
    disconnect: jest.fn(),
  }),
  mapSSEToSteps: (status: string) => {
    if (status === 'done') {
      return [
        { label: '코드 제출', status: 'done' },
        { label: 'GitHub Push', status: 'done' },
        { label: 'AI 분석', status: 'done' },
      ];
    }
    return [
      { label: '코드 제출', status: 'done' },
      { label: 'GitHub Push', status: 'in_progress' },
      { label: 'AI 분석', status: 'pending' },
    ];
  },
}));

jest.mock('@/hooks/useAiQuota', () => ({
  useAiQuota: () => ({ quota: { used: 1, limit: 10, remaining: 9 }, loading: false }),
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
  Alert: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div data-testid="alert">{title && <span>{title}</span>}{children}</div>
  ),
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

const mockFindById = jest.fn();

jest.mock('@/lib/api', () => ({
  submissionApi: {
    findById: (...args: unknown[]) => mockFindById(...args),
  },
  authApi: {
    relinkGitHub: jest.fn().mockResolvedValue({ url: 'https://github.com/login' }),
  },
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    CheckCircle2: Icon,
    XCircle: Icon,
    Clock: Icon,
    ChevronLeft: Icon,
    RotateCcw: Icon,
    ArrowRight: Icon,
    Sparkles: Icon,
    LinkIcon: Icon,
  };
});

function renderWithSuspense(ui: React.ReactElement) {
  return render(
    <Suspense fallback={<div>Loading...</div>}>
      {ui}
    </Suspense>,
  );
}

describe('SubmissionStatusPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindById.mockResolvedValue({
      id: 'sub-123',
      problemId: 'prob-1',
      problemTitle: 'Test Problem',
      language: 'python',
      sagaStep: 'GITHUB_PUSH',
      createdAt: '2025-01-01T00:00:00Z',
    });
  });

  it('제출 상태 페이지가 렌더링된다', async () => {
    await act(async () => {
      renderWithSuspense(<SubmissionStatusPage params={Promise.resolve({ id: 'sub-123' })} />);
    });
    expect(await screen.findByText('제출 상태')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', async () => {
    await act(async () => {
      renderWithSuspense(<SubmissionStatusPage params={Promise.resolve({ id: 'sub-123' })} />);
    });
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('뒤로가기 버튼이 표시된다', async () => {
    await act(async () => {
      renderWithSuspense(<SubmissionStatusPage params={Promise.resolve({ id: 'sub-123' })} />);
    });
    expect(screen.getByText('문제로 돌아가기')).toBeInTheDocument();
  });

  it('처리 중 상태 알림이 표시된다', async () => {
    await act(async () => {
      renderWithSuspense(<SubmissionStatusPage params={Promise.resolve({ id: 'sub-123' })} />);
    });
    expect(screen.getByText('처리 중')).toBeInTheDocument();
  });

  it('스텝 목록이 표시된다', async () => {
    await act(async () => {
      renderWithSuspense(<SubmissionStatusPage params={Promise.resolve({ id: 'sub-123' })} />);
    });
    expect(screen.getByText('코드 제출')).toBeInTheDocument();
    expect(screen.getByText('GitHub Push')).toBeInTheDocument();
    expect(screen.getByText('AI 분석')).toBeInTheDocument();
  });

  it('AI 할당량 배지가 표시된다', async () => {
    await act(async () => {
      renderWithSuspense(<SubmissionStatusPage params={Promise.resolve({ id: 'sub-123' })} />);
    });
    expect(screen.getByText('AI 1/10회')).toBeInTheDocument();
  });
});
