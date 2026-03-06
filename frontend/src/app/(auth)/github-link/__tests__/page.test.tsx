import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GitHubLinkPage from '../page';

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) => (
    <div data-testid="alert" onClick={onClose}>{children}</div>
  ),
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <span data-testid="loading-spinner" />,
  InlineSpinner: () => <span data-testid="inline-spinner" />,
}));

const mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

const mockLinkGitHub = jest.fn();
jest.mock('@/lib/api', () => ({
  authApi: {
    linkGitHub: (...args: unknown[]) => mockLinkGitHub(...args),
  },
}));

describe('GitHubLinkPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GitHub 계정 연동 제목이 렌더링된다', () => {
    render(<GitHubLinkPage />);
    expect(screen.getByText('GitHub 계정 연동')).toBeInTheDocument();
  });

  it('연동 설명 텍스트가 표시된다', () => {
    render(<GitHubLinkPage />);
    expect(screen.getByText(/AlgoSu의 코드 제출 기능을 사용하려면/)).toBeInTheDocument();
  });

  it('연동 버튼이 표시된다', () => {
    render(<GitHubLinkPage />);
    expect(screen.getByText('GitHub 계정 연동하기')).toBeInTheDocument();
  });

  it('기능 안내 항목들이 표시된다', () => {
    render(<GitHubLinkPage />);
    expect(screen.getByText(/GitHub 레포지토리에 자동으로 Push/)).toBeInTheDocument();
    expect(screen.getByText(/AI 분석 결과를 받을 수 있습니다/)).toBeInTheDocument();
    expect(screen.getByText(/문제 조회만 가능합니다/)).toBeInTheDocument();
  });

  it('연동 버튼 클릭 시 API가 호출된다', async () => {
    mockLinkGitHub.mockResolvedValue({ url: 'https://github.com/login/oauth' });

    render(<GitHubLinkPage />);
    fireEvent.click(screen.getByText('GitHub 계정 연동하기'));

    await waitFor(() => {
      expect(mockLinkGitHub).toHaveBeenCalled();
    });
  });

  it('API 오류 시 에러 메시지가 표시된다', async () => {
    mockLinkGitHub.mockRejectedValue(new Error('fail'));

    render(<GitHubLinkPage />);
    fireEvent.click(screen.getByText('GitHub 계정 연동하기'));

    await waitFor(() => {
      expect(screen.getByText(/GitHub 연동 서비스에 오류가 발생했습니다/)).toBeInTheDocument();
    });
  });

  it('해제 안내 문구가 표시된다', () => {
    render(<GitHubLinkPage />);
    expect(screen.getByText(/연동은 언제든지 설정에서 해제/)).toBeInTheDocument();
  });
});
