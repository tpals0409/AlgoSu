/**
 * @file SQL 카테고리 자동 언어 선택 회귀 차단 테스트
 * @domain problem, submission
 * @layer test
 * @related page.tsx, CodeEditor, Problem.category
 *
 * Sprint 151 Wave 3: problem.category === 'SQL' 시 에디터 언어 자동 'sql' 선택
 * + ref guard로 mount 당 1회만 적용 (사용자 수동 변경 우선)
 */

import { render, screen, act } from '@testing-library/react';
import { Suspense } from 'react';
import ProblemDetailPage from '../page';

// ─── MOCKS (기존 page.test.tsx 패턴 준수) ───────────────

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/problems/test-id',
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/problems/test-id',
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      'detail.backToList': '문제 목록',
      'detail.error': '문제를 불러오는 데 실패했습니다.',
      'detail.notFound': '문제를 찾을 수 없습니다.',
      'detail.deleteProblem': '문제 삭제',
      'detail.status.inProgress': '진행 중',
      'detail.status.lateSubmission': '지각 제출',
      'detail.status.finished': '종료',
      'detail.deadline.title': '마감 정보',
      'detail.deadline.date': '마감일',
      'detail.deadline.week': '주차',
      'detail.deadline.platform': '플랫폼',
      'detail.submissions.title': '제출 현황',
      'detail.submissions.empty': '아직 제출 데이터가 없습니다.',
      'detail.submissions.late': '지각',
      'submit.enterCode': '코드를 입력해주세요.',
      'submit.success': '제출되었습니다',
      'submit.lateWarning.title': '지각 제출',
      'submit.closed.title': '제출 마감',
      'submit.github.title': 'GitHub 미연동',
      'submit.github.link': 'GitHub 연동하기',
      'detail.viewOnPlatform': '{platform}에서 보기',
    };
    if (params) {
      const tpl = map[key] ?? key;
      return Object.entries(params).reduce(
        (s, [k, v]) => s.replace(`{${k}}`, String(v)),
        tpl,
      );
    }
    return map[key] ?? key;
  },
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
    githubConnected: true,
  }),
}));

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({
    currentStudyId: 'study-1',
    currentStudyName: 'Test Study',
    currentStudyRole: 'MEMBER',
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

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/components/layout/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

jest.mock('@/components/ui/DifficultyBadge', () => ({
  DifficultyBadge: () => <span data-testid="difficulty-badge" />,
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert">{children}</div>
  ),
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/Skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

jest.mock('@/components/ad/AdBanner', () => ({
  AdBanner: () => <div data-testid="ad-banner" />,
}));

jest.mock('@/lib/constants/adSlots', () => ({
  AD_SLOTS: { PROBLEM_DETAIL: 'test-slot' },
}));

/**
 * CodeEditor mock — language prop을 data-language 속성으로 노출하여 테스트 검증 가능.
 * onLanguageChange 콜백도 button으로 노출하여 사용자 수동 변경 시나리오 테스트.
 */
jest.mock('@/components/submission/CodeEditor', () => ({
  CodeEditor: ({ language, onLanguageChange }: { language: string; onLanguageChange: (lang: string) => void }) => (
    <div data-testid="code-editor" data-language={language}>
      <button
        data-testid="change-lang-btn"
        type="button"
        onClick={() => onLanguageChange('python')}
      >
        change to python
      </button>
    </div>
  ),
}));

jest.mock('@/lib/avatars', () => ({
  getAvatarSrc: () => '/avatar.png',
}));

jest.mock('@/lib/constants', () => ({
  DIFFICULTY_LABELS: {
    BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold',
    PLATINUM: 'Platinum', DIAMOND: 'Diamond',
  },
  DIFF_DOT_STYLE: {},
  DIFF_BADGE_STYLE: {},
  SAGA_STEP_CONFIG: {
    DB_SAVED: { label: '저장됨', variant: 'muted' },
    GITHUB_QUEUED: { label: 'GitHub 대기', variant: 'info' },
    AI_QUEUED: { label: 'AI 분석 대기', variant: 'warning' },
    DONE: { label: '완료', variant: 'success' },
    FAILED: { label: '실패', variant: 'error' },
  },
  toTierLevel: (rawLevel: number | null | undefined) => {
    if (rawLevel == null || rawLevel <= 0) return null;
    return 5 - ((rawLevel - 1) % 5);
  },
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { ArrowLeft: Icon, Pencil: Icon, Trash2: Icon, ExternalLink: Icon };
});

// ─── API MOCK (시나리오별 재정의) ────────────────────────

const mockFindById = jest.fn();

jest.mock('@/lib/api', () => ({
  problemApi: { findById: (...args: unknown[]) => mockFindById(...args), delete: jest.fn() },
  submissionApi: {
    create: jest.fn(),
    list: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  },
}));

// ─── HELPERS ─────────────────────────────────

/** 기본 Problem fixture (ALGORITHM) */
const baseProblem = {
  id: 'test-id',
  title: 'Two Sum',
  description: '두 수의 합',
  difficulty: 'GOLD' as const,
  weekNumber: '3월1주차',
  status: 'ACTIVE' as const,
  tags: ['배열'],
  allowedLanguages: ['python', 'sql'],
  deadline: null,
  sourceUrl: null,
};

/** 페이지 렌더 헬퍼 — act로 비동기 effect flush */
async function renderPage(): Promise<void> {
  const paramsPromise = Promise.resolve({ id: 'test-id' });
  await act(async () => {
    render(
      <Suspense fallback={<div>loading</div>}>
        <ProblemDetailPage params={paramsPromise} />
      </Suspense>,
    );
  });
}

// ─── TESTS ───────────────────────────────────

describe('SQL 카테고리 자동 언어 선택 (Sprint 151)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('SQL category → 에디터 언어 "sql" 자동 적용', async () => {
    mockFindById.mockResolvedValue({ ...baseProblem, category: 'SQL' });
    await renderPage();

    const editor = await screen.findByTestId('code-editor');
    expect(editor).toHaveAttribute('data-language', 'sql');
  });

  it('ALGORITHM category → 에디터 언어 "python" 유지', async () => {
    mockFindById.mockResolvedValue({ ...baseProblem, category: 'ALGORITHM' });
    await renderPage();

    const editor = await screen.findByTestId('code-editor');
    expect(editor).toHaveAttribute('data-language', 'python');
  });

  it('category undefined (레거시) → 에디터 언어 "python" 유지', async () => {
    mockFindById.mockResolvedValue({ ...baseProblem });
    await renderPage();

    const editor = await screen.findByTestId('code-editor');
    expect(editor).toHaveAttribute('data-language', 'python');
  });

  it('SQL 자동 선택 후 사용자 "python" 변경 → ref guard로 재강제 안 됨', async () => {
    mockFindById.mockResolvedValue({ ...baseProblem, category: 'SQL' });
    await renderPage();

    // 1. SQL 자동 선택 확인
    const editor = await screen.findByTestId('code-editor');
    expect(editor).toHaveAttribute('data-language', 'sql');

    // 2. 사용자가 python으로 수동 변경
    const changeLangBtn = screen.getByTestId('change-lang-btn');
    await act(async () => {
      changeLangBtn.click();
    });

    // 3. 변경 후 python이어야 함 (ref guard가 재강제 방지)
    expect(screen.getByTestId('code-editor')).toHaveAttribute('data-language', 'python');
  });
});
