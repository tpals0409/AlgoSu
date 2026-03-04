import { render, screen } from '@testing-library/react';
import StudyCreatePage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/studies/create',
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
    currentStudyId: null,
    studies: [],
    setCurrentStudy: jest.fn(),
    setStudies: jest.fn(),
    studiesLoaded: true,
  }),
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
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/Input', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');
  return {
    Input: forwardRef<HTMLInputElement, { label?: string; error?: string }>(
      function MockInput({ label, error, ...props }, ref) {
        return (
          <div>
            {label && <label>{label}</label>}
            <input ref={ref} {...props} />
            {error && <span>{error}</span>}
          </div>
        );
      },
    ),
  };
});

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
}));

jest.mock('@/components/ui/BackBtn', () => ({
  BackBtn: ({ label }: { label: string }) => <a data-testid="back-btn">{label}</a>,
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  InlineSpinner: () => <span data-testid="inline-spinner" />,
}));

jest.mock('@/lib/api', () => ({
  studyApi: {
    create: jest.fn(),
  },
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

describe('StudyCreatePage', () => {
  it('스터디 생성 페이지가 렌더링된다', () => {
    render(<StudyCreatePage />);
    expect(screen.getByText('새 스터디 만들기')).toBeInTheDocument();
  });

  it('AppLayout 안에 렌더링된다', () => {
    render(<StudyCreatePage />);
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('스터디 이름 입력 필드가 표시된다', () => {
    render(<StudyCreatePage />);
    expect(screen.getByText('스터디 이름')).toBeInTheDocument();
  });

  it('닉네임 입력 필드가 표시된다', () => {
    render(<StudyCreatePage />);
    expect(screen.getByText('닉네임')).toBeInTheDocument();
  });

  it('뒤로가기 버튼이 표시된다', () => {
    render(<StudyCreatePage />);
    expect(screen.getByTestId('back-btn')).toBeInTheDocument();
  });

  it('취소 및 생성 버튼이 표시된다', () => {
    render(<StudyCreatePage />);
    expect(screen.getByText('취소')).toBeInTheDocument();
    expect(screen.getByText('스터디 만들기')).toBeInTheDocument();
  });
});
