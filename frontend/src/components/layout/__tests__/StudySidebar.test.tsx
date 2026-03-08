import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudySidebar } from '../StudySidebar';

const mockPush = jest.fn();
const mockSetCurrentStudy = jest.fn();
const mockUseStudy = jest.fn();

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    LayoutDashboard: Icon,
    BookOpen: Icon,
    FileText: Icon,
    Users: Icon,
    Settings: Icon,
    ChevronDown: Icon,
    PanelLeftClose: Icon,
    PanelLeft: Icon,
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/studies/study-1',
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: (...args: unknown[]) => mockUseStudy(...args),
}));

// Mock matchMedia for desktop (not collapsed)
beforeEach(() => {
  mockPush.mockClear();
  mockSetCurrentStudy.mockClear();
  mockUseStudy.mockReturnValue({
    currentStudyId: 'study-1',
    currentStudyName: 'Test Study',
    currentStudyRole: 'ADMIN',
    studies: [
      { id: 'study-1', name: 'Test Study' },
      { id: 'study-2', name: 'Other Study' },
    ],
    setCurrentStudy: mockSetCurrentStudy,
  });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
});

describe('StudySidebar', () => {
  it('renders navigation with study links', () => {
    render(<StudySidebar />);
    expect(screen.getByRole('navigation', { name: '스터디 내비게이션' })).toBeInTheDocument();
    expect(screen.getByText('개요')).toBeInTheDocument();
    expect(screen.getByText('문제')).toBeInTheDocument();
    expect(screen.getByText('제출')).toBeInTheDocument();
    expect(screen.getByText('멤버')).toBeInTheDocument();
  });

  it('shows settings link for ADMIN role', () => {
    render(<StudySidebar />);
    expect(screen.getByText('설정')).toBeInTheDocument();
  });

  it('displays current study name in dropdown button', () => {
    render(<StudySidebar />);
    expect(screen.getByText('Test Study')).toBeInTheDocument();
  });

  it('opens study dropdown and allows switching', async () => {
    const user = userEvent.setup();
    render(<StudySidebar />);

    await user.click(screen.getByRole('button', { name: '스터디 전환' }));
    expect(screen.getByRole('listbox', { name: '스터디 목록' })).toBeInTheDocument();

    const listbox = screen.getByRole('listbox', { name: '스터디 목록' });
    const options = listbox.querySelectorAll('[role="option"]');
    // Click the second option (Other Study)
    await user.click(options[1]);
    expect(mockSetCurrentStudy).toHaveBeenCalledWith('study-2');
    expect(mockPush).toHaveBeenCalledWith('/studies/study-2');
  });

  it('can collapse and expand the sidebar', async () => {
    const user = userEvent.setup();
    render(<StudySidebar />);

    // Collapse
    await user.click(screen.getByRole('button', { name: '사이드바 접기' }));
    expect(screen.getByRole('button', { name: '사이드바 확장' })).toBeInTheDocument();
    expect(screen.queryByText('개요')).not.toBeInTheDocument();

    // Expand
    await user.click(screen.getByRole('button', { name: '사이드바 확장' }));
    expect(screen.getByText('개요')).toBeInTheDocument();
  });

  it('hides settings link for MEMBER role', () => {
    mockUseStudy.mockReturnValue({
      currentStudyId: 'study-1',
      currentStudyName: 'Test Study',
      currentStudyRole: 'MEMBER',
      studies: [{ id: 'study-1', name: 'Test Study' }],
      setCurrentStudy: jest.fn(),
    });
    render(<StudySidebar />);
    expect(screen.queryByText('설정')).not.toBeInTheDocument();
    expect(screen.getByText('개요')).toBeInTheDocument();
  });

  it('renders nothing when currentStudyId is null', () => {
    mockUseStudy.mockReturnValue({
      currentStudyId: null,
      currentStudyName: null,
      currentStudyRole: null,
      studies: [],
      setCurrentStudy: jest.fn(),
    });
    const { container } = render(<StudySidebar />);
    expect(container.innerHTML).toBe('');
  });

  it('currentStudyName이 null이면 "스터디" 텍스트를 표시한다', () => {
    mockUseStudy.mockReturnValue({
      currentStudyId: 'study-1',
      currentStudyName: null,
      currentStudyRole: 'ADMIN',
      studies: [{ id: 'study-1', name: 'Test Study' }],
      setCurrentStudy: mockSetCurrentStudy,
    });
    render(<StudySidebar />);
    // currentStudyName ?? '스터디' 분기: null일 때 '스터디' 표시
    expect(screen.getByRole('button', { name: '스터디 전환' })).toHaveTextContent('스터디');
  });
});
