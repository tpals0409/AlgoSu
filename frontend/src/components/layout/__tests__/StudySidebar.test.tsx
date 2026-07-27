import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/i18n';
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
    Menu: Icon,
    X: Icon,
  };
});

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/studies/study-1',
  Link: () => null,
  redirect: jest.fn(),
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
  window.localStorage.clear();
  // jsdom은 PointerEvent 미구현 → MouseEvent 기반 최소 폴리필(clientX 전달용)
  if (typeof window.PointerEvent === 'undefined') {
    // @ts-expect-error jsdom 테스트 전용 최소 폴리필
    window.PointerEvent = class PointerEvent extends MouseEvent {};
  }
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

// navContent is rendered in both mobile and desktop asides,
// so many elements appear twice. Use getAllBy and check at least one.

describe('StudySidebar', () => {
  it('renders navigation with study links', () => {
    renderWithI18n(<StudySidebar />);
    const navs = screen.getAllByRole('navigation', { name: /내비게이션/ });
    expect(navs.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('개요').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('문제').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('제출').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('멤버').length).toBeGreaterThanOrEqual(1);
  });

  it('shows settings link for ADMIN role', () => {
    renderWithI18n(<StudySidebar />);
    expect(screen.getAllByText('설정').length).toBeGreaterThanOrEqual(1);
  });

  it('displays current study name in dropdown button', () => {
    renderWithI18n(<StudySidebar />);
    expect(screen.getAllByText('Test Study').length).toBeGreaterThanOrEqual(1);
  });

  it('opens study dropdown and allows switching', async () => {
    const user = userEvent.setup();
    renderWithI18n(<StudySidebar />);

    const toggleButtons = screen.getAllByRole('button', { name: /스터디 전환/ });
    await user.click(toggleButtons[0]);
    const listbox = screen.getAllByRole('listbox', { name: /스터디 목록/ })[0];
    expect(listbox).toBeInTheDocument();

    const options = listbox.querySelectorAll('[role="option"]');
    // Click the second option (Other Study)
    await user.click(options[1]);
    expect(mockSetCurrentStudy).toHaveBeenCalledWith('study-2');
    expect(mockPush).toHaveBeenCalledWith('/studies/study-2');
  });

  it('can collapse and expand the sidebar', async () => {
    const user = userEvent.setup();
    renderWithI18n(<StudySidebar />);

    // Collapse (use first match — desktop sidebar)
    const collapseButtons = screen.getAllByRole('button', { name: /사이드바 접기/ });
    await user.click(collapseButtons[0]);
    expect(screen.getAllByRole('button', { name: /사이드바 확장/ }).length).toBeGreaterThanOrEqual(1);

    // Expand
    const expandButtons = screen.getAllByRole('button', { name: /사이드바 확장/ });
    await user.click(expandButtons[0]);
    expect(screen.getAllByText('개요').length).toBeGreaterThanOrEqual(1);
  });

  it('hides settings link for MEMBER role', () => {
    mockUseStudy.mockReturnValue({
      currentStudyId: 'study-1',
      currentStudyName: 'Test Study',
      currentStudyRole: 'MEMBER',
      studies: [{ id: 'study-1', name: 'Test Study' }],
      setCurrentStudy: jest.fn(),
    });
    renderWithI18n(<StudySidebar />);
    expect(screen.queryByText('설정')).not.toBeInTheDocument();
    expect(screen.getAllByText('개요').length).toBeGreaterThanOrEqual(1);
  });

  it('renders nothing when currentStudyId is null', () => {
    mockUseStudy.mockReturnValue({
      currentStudyId: null,
      currentStudyName: null,
      currentStudyRole: null,
      studies: [],
      setCurrentStudy: jest.fn(),
    });
    const { container } = renderWithI18n(<StudySidebar />);
    expect(container.innerHTML).toBe('');
  });

  it('리사이즈 핸들이 렌더되고 기본 폭은 220px (#12)', () => {
    renderWithI18n(<StudySidebar />);
    const handle = screen.getByRole('separator', { name: /크기 조절/ });
    const aside = handle.closest('aside');
    expect(aside).not.toBeNull();
    expect(aside).toHaveStyle({ width: '220px' });
  });

  it('저장된 폭을 localStorage에서 복원한다 (#12)', () => {
    window.localStorage.setItem('algosu:studySidebarWidth', '300');
    renderWithI18n(<StudySidebar />);
    const aside = screen.getByRole('separator', { name: /크기 조절/ }).closest('aside');
    expect(aside).toHaveStyle({ width: '300px' });
  });

  it('드래그로 폭을 조절하고 저장한다 — 범위 초과 시 클램프 (#12)', () => {
    renderWithI18n(<StudySidebar />);
    const handle = screen.getByRole('separator', { name: /크기 조절/ });

    fireEvent.pointerDown(handle);
    fireEvent.pointerMove(window, { clientX: 300 });
    const aside = handle.closest('aside');
    expect(aside).toHaveStyle({ width: '300px' });

    // 최대치(400) 초과 → 클램프
    fireEvent.pointerMove(window, { clientX: 1000 });
    expect(aside).toHaveStyle({ width: '400px' });

    fireEvent.pointerUp(window);
    expect(window.localStorage.getItem('algosu:studySidebarWidth')).toBe('400');
  });

  it('shows fallback text when currentStudyName is null', () => {
    mockUseStudy.mockReturnValue({
      currentStudyId: 'study-1',
      currentStudyName: null,
      currentStudyRole: 'ADMIN',
      studies: [{ id: 'study-1', name: 'Test Study' }],
      setCurrentStudy: mockSetCurrentStudy,
    });
    renderWithI18n(<StudySidebar />);
    const toggleButtons = screen.getAllByRole('button', { name: /스터디 전환/ });
    // currentStudyName ?? t('studySidebar.studyFallback') branch: null shows fallback
    expect(toggleButtons[0]).toHaveTextContent(/스터디/);
  });
});
