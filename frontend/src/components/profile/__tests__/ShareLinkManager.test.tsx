import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/i18n';
import { ShareLinkManager } from '../ShareLinkManager';
import { ApiError, type ShareLinkData } from '@/lib/api';

/* ── mocks ── */

const mockStudyContext = {
  currentStudyId: 'study-1' as string | null,
  studies: [
    { id: 'study-1', name: 'Algorithm A' },
    { id: 'study-2', name: 'Algorithm B' },
  ],
  currentStudyName: 'Algorithm A',
  setCurrentStudy: jest.fn(),
};

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => mockStudyContext,
}));

const mockList = jest.fn<Promise<ShareLinkData[]>, [string]>();
const mockCreate = jest.fn<Promise<ShareLinkData>, [string, { expiresAt?: string } | undefined]>();
const mockDeactivate = jest.fn<Promise<{ message: string }>, [string, string]>();

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    shareLinkApi: {
      list: (...args: unknown[]) => mockList(...(args as [string])),
      create: (...args: unknown[]) => mockCreate(...(args as [string, { expiresAt?: string } | undefined])),
      deactivate: (...args: unknown[]) => mockDeactivate(...(args as [string, string])),
    },
  };
});

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { Link2: Icon, Copy: Icon, Trash2: Icon, Plus: Icon, Check: Icon };
});

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" {...props}>{children}</div>
  ),
}));

/* ── helpers ── */

const makeLink = (overrides: Partial<ShareLinkData> = {}): ShareLinkData => ({
  id: 'link-1',
  token: 'abcdefghijklmnopqrstuvwxyz',
  study_id: 'study-1',
  created_by: 'user-1',
  expires_at: null,
  is_active: true,
  created_at: '2026-03-01T00:00:00.000Z',
  ...overrides,
});

let confirmSpy: jest.SpyInstance;

/** Create userEvent with fake timers and spy on clipboard.writeText */
function setupUser() {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  // userEvent.setup() installs its own clipboard on navigator,
  // so we must spy AFTER setup
  const clipboardSpy = jest.spyOn(navigator.clipboard, 'writeText');
  return { user, clipboardSpy };
}

beforeEach(() => {
  jest.useFakeTimers({ legacyFakeTimers: false });
  jest.setSystemTime(new Date('2026-03-10T12:00:00.000Z'));
  mockStudyContext.currentStudyId = 'study-1';
  mockList.mockReset();
  mockList.mockResolvedValue([]);
  mockCreate.mockReset();
  mockCreate.mockResolvedValue(makeLink());
  mockDeactivate.mockReset();
  mockDeactivate.mockResolvedValue({ message: 'ok' });
  confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  jest.useRealTimers();
  confirmSpy.mockRestore();
});

/* ── tests ── */

describe('ShareLinkManager', () => {
  describe('initial rendering', () => {
    it('shows loading then empty list message', async () => {
      renderWithI18n(<ShareLinkManager />);
      expect(screen.getByText('로딩 중...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('공유 링크가 없습니다.')).toBeInTheDocument();
      });
      expect(mockList).toHaveBeenCalledWith('study-1');
    });

    it('renders study dropdown with studies', async () => {
      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(mockList).toHaveBeenCalled());

      const select = screen.getByLabelText('스터디');
      expect(select).toBeInTheDocument();
      expect(screen.getByText('Algorithm A')).toBeInTheDocument();
      expect(screen.getByText('Algorithm B')).toBeInTheDocument();
    });

    it('renders expires dropdown options', async () => {
      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(mockList).toHaveBeenCalled());

      expect(screen.getByLabelText('만료')).toBeInTheDocument();
      expect(screen.getByText('무기한')).toBeInTheDocument();
      expect(screen.getByText('7일')).toBeInTheDocument();
      expect(screen.getByText('30일')).toBeInTheDocument();
      expect(screen.getByText('90일')).toBeInTheDocument();
    });
  });

  describe('no study selected', () => {
    it('shows guidance message and does not call API', async () => {
      mockStudyContext.currentStudyId = null;

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => {
        expect(screen.getByText('스터디를 선택해주세요.')).toBeInTheDocument();
      });
    });

    it('disables create button when no study selected', async () => {
      mockStudyContext.currentStudyId = null;

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => {
        expect(screen.getByText('스터디를 선택해주세요.')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /링크 생성/ })).toBeDisabled();
    });
  });

  describe('link list', () => {
    it('renders link items with expiry info', async () => {
      mockList.mockResolvedValue([
        makeLink({ id: 'link-1', token: 'token111111111111' }),
        makeLink({ id: 'link-2', token: 'token222222222222', expires_at: '2026-12-31T00:00:00.000Z' }),
      ]);

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => {
        expect(screen.getByText(/token111111/)).toBeInTheDocument();
      });
      expect(screen.getByText(/token222222/)).toBeInTheDocument();
      expect(screen.getAllByText(/무기한/).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/만료:/)).toBeInTheDocument();
    });

    it('does not show deactivate button for expired links', async () => {
      mockList.mockResolvedValue([
        makeLink({ id: 'link-expired', token: 'expiredtoken1234', expires_at: '2020-01-01T00:00:00.000Z' }),
      ]);

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => {
        expect(screen.getByText(/expiredtoken/)).toBeInTheDocument();
      });

      expect(screen.getByText('만료됨', { exact: false })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: '링크 복사' })).toHaveLength(1);
      expect(screen.queryByRole('button', { name: '링크 비활성화' })).not.toBeInTheDocument();
    });

    it('shows deactivate button for active links', async () => {
      mockList.mockResolvedValue([makeLink()]);

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '링크 비활성화' })).toBeInTheDocument();
      });
    });

    it('shows empty list and error message on API error', async () => {
      mockList.mockRejectedValue(new Error('network error'));

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => {
        expect(screen.getByText('공유 링크가 없습니다.')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent('오류가 발생했습니다. 다시 시도해주세요.');
      });
    });

    it('shows network error message on TypeError', async () => {
      mockList.mockRejectedValue(new TypeError('Failed to fetch'));

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('네트워크 연결을 확인해주세요.');
      });
    });

    it('shows permission error on 403 ApiError', async () => {
      mockList.mockRejectedValue(new ApiError('Forbidden', 403));

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('권한이 없습니다.');
      });
    });
  });

  describe('link creation', () => {
    it('creates link with no expiry and copies to clipboard', async () => {
      const { user, clipboardSpy } = setupUser();
      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(mockList).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: /링크 생성/ }));

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith('study-1', { expiresAt: undefined });
        expect(clipboardSpy).toHaveBeenCalledWith(
          expect.stringContaining('/shared/abcdefghijklmnopqrstuvwxyz'),
        );
        expect(screen.getByText('링크가 생성되어 클립보드에 복사되었습니다.')).toBeInTheDocument();
      });
    });

    it('creates link with expiry when option is set', async () => {
      const { user } = setupUser();
      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(mockList).toHaveBeenCalled());

      await user.selectOptions(screen.getByLabelText('만료'), '7');
      await user.click(screen.getByRole('button', { name: /링크 생성/ }));

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith('study-1', {
          expiresAt: expect.stringContaining('T'),
        });
      });
    });

    it('prepends newly created link to list', async () => {
      const { user } = setupUser();
      mockList.mockResolvedValue([makeLink({ id: 'old', token: 'oldtoken12345678x' })]);
      mockCreate.mockResolvedValue(makeLink({ id: 'new', token: 'newtoken12345678x' }));

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(screen.getByText(/oldtoken1234/)).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /링크 생성/ }));

      await waitFor(() => {
        expect(screen.getByText(/newtoken1234/)).toBeInTheDocument();
      });
      expect(screen.getByText(/oldtoken1234/)).toBeInTheDocument();
    });

    it('shows error message on create failure', async () => {
      const { user } = setupUser();
      mockCreate.mockRejectedValue(new Error('fail'));

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(mockList).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: /링크 생성/ }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('오류가 발생했습니다. 다시 시도해주세요.');
      });
    });

    it('shows network error on create TypeError', async () => {
      const { user } = setupUser();
      mockCreate.mockRejectedValue(new TypeError('Failed to fetch'));

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(mockList).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: /링크 생성/ }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('네트워크 연결을 확인해주세요.');
      });
    });

    it('shows permission error on create 401 ApiError', async () => {
      const { user } = setupUser();
      mockCreate.mockRejectedValue(new ApiError('Unauthorized', 401));

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(mockList).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: /링크 생성/ }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('권한이 없습니다.');
      });
    });

    it('shows creating state on button while creating', async () => {
      let resolveCreate!: (v: ShareLinkData) => void;
      mockCreate.mockReturnValue(
        new Promise<ShareLinkData>((res) => { resolveCreate = res; }),
      );

      const { user } = setupUser();
      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(mockList).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: /링크 생성/ }));

      expect(screen.getByText(/생성 중.../)).toBeInTheDocument();

      await act(async () => {
        resolveCreate(makeLink());
      });

      await waitFor(() => {
        expect(screen.queryByText(/생성 중.../)).not.toBeInTheDocument();
      });
    });

    it('does nothing when selectedStudyId is empty', async () => {
      const { user } = setupUser();
      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(mockList).toHaveBeenCalled());

      await user.selectOptions(screen.getByLabelText('스터디'), '');
      await waitFor(() => expect(screen.getByText('스터디를 선택해주세요.')).toBeInTheDocument());

      mockCreate.mockClear();
      expect(screen.getByRole('button', { name: /링크 생성/ })).toBeDisabled();
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('link copy', () => {
    it('copies URL to clipboard on copy button click', async () => {
      const { user, clipboardSpy } = setupUser();
      mockList.mockResolvedValue([makeLink({ token: 'copytoken123456789' })]);

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(screen.getByText(/copytoken123/)).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: '링크 복사' }));

      await waitFor(() => {
        expect(clipboardSpy).toHaveBeenCalledWith(
          expect.stringContaining('/shared/copytoken123456789'),
        );
      });
    });

    it('resets copied state after 2 seconds', async () => {
      const { user } = setupUser();
      mockList.mockResolvedValue([makeLink()]);

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(screen.getByRole('button', { name: '링크 복사' })).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: '링크 복사' }));

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(screen.getByRole('button', { name: '링크 복사' })).toBeInTheDocument();
    });
  });

  describe('link deactivation', () => {
    it('deactivates link and removes from list after confirm', async () => {
      const { user } = setupUser();
      mockList.mockResolvedValue([makeLink({ id: 'link-del', token: 'deltoken12345678x' })]);

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(screen.getByText(/deltoken1234/)).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: '링크 비활성화' }));

      expect(confirmSpy).toHaveBeenCalledWith('이 공유 링크를 비활성화하시겠습니까?');
      await waitFor(() => {
        expect(mockDeactivate).toHaveBeenCalledWith('study-1', 'link-del');
        expect(screen.queryByText(/deltoken1234/)).not.toBeInTheDocument();
      });
      expect(screen.getByText('링크가 비활성화되었습니다.')).toBeInTheDocument();
    });

    it('does not call API when confirm is cancelled', async () => {
      confirmSpy.mockReturnValue(false);
      const { user } = setupUser();
      mockList.mockResolvedValue([makeLink()]);

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(screen.getByRole('button', { name: '링크 비활성화' })).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: '링크 비활성화' }));

      expect(mockDeactivate).not.toHaveBeenCalled();
    });

    it('shows error message on deactivation failure', async () => {
      const { user } = setupUser();
      mockDeactivate.mockRejectedValue(new Error('fail'));
      mockList.mockResolvedValue([makeLink()]);

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(screen.getByRole('button', { name: '링크 비활성화' })).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: '링크 비활성화' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('오류가 발생했습니다. 다시 시도해주세요.');
      });
    });

    it('shows permission error on deactivation 403 ApiError', async () => {
      const { user } = setupUser();
      mockDeactivate.mockRejectedValue(new ApiError('Forbidden', 403));
      mockList.mockResolvedValue([makeLink()]);

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(screen.getByRole('button', { name: '링크 비활성화' })).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: '링크 비활성화' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('권한이 없습니다.');
      });
    });

    it('does nothing when selectedStudyId is empty', async () => {
      const { user } = setupUser();
      mockList.mockResolvedValue([makeLink()]);

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(screen.getByRole('button', { name: '링크 비활성화' })).toBeInTheDocument());

      await user.selectOptions(screen.getByLabelText('스터디'), '');
      await waitFor(() => expect(screen.getByText('스터디를 선택해주세요.')).toBeInTheDocument());

      expect(screen.queryByRole('button', { name: '링크 비활성화' })).not.toBeInTheDocument();
      expect(mockDeactivate).not.toHaveBeenCalled();
    });
  });

  describe('study change', () => {
    it('reloads links when study changes', async () => {
      const { user } = setupUser();
      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(mockList).toHaveBeenCalledWith('study-1'));

      mockList.mockClear();
      mockList.mockResolvedValue([makeLink({ token: 'study2token12345x' })]);

      await user.selectOptions(screen.getByLabelText('스터디'), 'study-2');

      await waitFor(() => {
        expect(mockList).toHaveBeenCalledWith('study-2');
      });
    });

    it('shows guidance when study is deselected', async () => {
      const { user } = setupUser();
      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(mockList).toHaveBeenCalled());

      mockList.mockClear();
      await user.selectOptions(screen.getByLabelText('스터디'), '');

      await waitFor(() => {
        expect(screen.getByText('스터디를 선택해주세요.')).toBeInTheDocument();
      });
    });
  });

  describe('message styling', () => {
    it('success message uses success color', async () => {
      const { user } = setupUser();
      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(mockList).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: /링크 생성/ }));

      await waitFor(() => {
        const msg = screen.getByText('링크가 생성되어 클립보드에 복사되었습니다.');
        expect(msg).toHaveStyle({ color: 'var(--success)' });
      });
    });

    it('failure message uses danger color', async () => {
      const { user } = setupUser();
      mockCreate.mockRejectedValue(new Error('fail'));

      renderWithI18n(<ShareLinkManager />);
      await waitFor(() => expect(mockList).toHaveBeenCalled());

      await user.click(screen.getByRole('button', { name: /링크 생성/ }));

      await waitFor(() => {
        const msg = screen.getByRole('alert');
        expect(msg).toHaveStyle({ color: 'var(--error)' });
      });
    });
  });
});
