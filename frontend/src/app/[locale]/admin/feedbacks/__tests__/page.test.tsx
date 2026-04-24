/**
 * @file admin/feedbacks 페이지 SWR 모킹 테스트 — 목록/상세/상태변경/에러
 * @domain admin
 * @layer test
 * @related AdminFeedbacksPage, useFeedbacks, useFeedbackDetail, adminApi
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import AdminFeedbacksPage from '../page';
import type { AdminFeedback } from '@/lib/api';

/* ── SWR fetcher 모킹 ── */

jest.mock('@/lib/swr', () => ({
  ...jest.requireActual('@/lib/swr'),
  swrFetcher: jest.fn(),
}));

const mockFetcher = jest.fn();

/* ── next-intl 모킹 ── */

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        key,
      );
    }
    return key;
  },
  useLocale: () => 'ko',
}));

/* ── sonner 모킹 ── */

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

/* ── lucide-react 경량 모킹 ── */

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    MessageSquare: Icon,
    Bug: Icon,
    Lightbulb: Icon,
    Palette: Icon,
    Filter: Icon,
    Search: Icon,
    X: Icon,
  };
});

/* ── adminApi 모킹 ── */

const mockUpdateFeedbackStatus = jest.fn();

jest.mock('@/lib/api', () => ({
  adminApi: {
    updateFeedbackStatus: (...args: unknown[]) =>
      mockUpdateFeedbackStatus(...args),
  },
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

/* ── 테스트 데이터 ── */

const makeFeedback = (overrides: Partial<AdminFeedback> = {}): AdminFeedback => ({
  publicId: 'fb-1',
  userId: 'user-1',
  userName: 'Alice',
  userEmail: 'alice@example.com',
  studyId: 'study-1',
  studyName: 'Study A',
  category: 'BUG',
  content: 'Button does not work',
  pageUrl: '/problems/1',
  browserInfo: 'Chrome 120',
  screenshot: null,
  status: 'OPEN',
  createdAt: '2026-04-20T00:00:00Z',
  resolvedAt: null,
  ...overrides,
});

const fb1 = makeFeedback();
const fb2 = makeFeedback({
  publicId: 'fb-2',
  userName: 'Bob',
  userEmail: 'bob@example.com',
  category: 'FEATURE',
  content: 'Add dark mode toggle',
  status: 'IN_PROGRESS',
  createdAt: '2026-04-21T00:00:00Z',
});

const mockListResponse: {
  items: AdminFeedback[];
  total: number;
  counts: Record<string, number>;
} = {
  items: [fb1, fb2],
  total: 2,
  counts: { OPEN: 1, IN_PROGRESS: 1, RESOLVED: 0, 'cat:BUG': 1, 'cat:FEATURE': 1 },
};

/* ── SWR wrapper ── */

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig
    value={{
      provider: () => new Map(),
      dedupingInterval: 0,
      fetcher: mockFetcher,
      shouldRetryOnError: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }}
  >
    {children}
  </SWRConfig>
);

/* ── helpers ── */

/**
 * fetcher를 경로 기반으로 라우팅:
 * - /api/feedbacks?... → 목록 응답
 * - /api/feedbacks/{id}/detail → 상세 응답
 */
function setupFetcher(
  listData = mockListResponse,
  detailData: AdminFeedback | null = null,
) {
  mockFetcher.mockImplementation((key: string) => {
    if (key.includes('/detail')) {
      if (detailData) return Promise.resolve(detailData);
      // detail 요청 시 목록의 해당 항목을 fallback
      const id = key.split('/').at(-2);
      const found = listData.items.find((f) => f.publicId === id);
      return found ? Promise.resolve(found) : Promise.reject(new Error('Not found'));
    }
    return Promise.resolve(listData);
  });
}

/** 목록 로드 완료 대기 — 로딩 텍스트가 사라지고 데이터 렌더링될 때까지 */
async function waitForListLoaded() {
  await waitFor(() => {
    expect(screen.queryByText('feedbacks.loading')).not.toBeInTheDocument();
  });
}

/* ── 테스트 ── */

describe('AdminFeedbacksPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFetcher();
    mockUpdateFeedbackStatus.mockResolvedValue({ ...fb1, status: 'RESOLVED' });
  });

  describe('기본 렌더', () => {
    it('헤딩과 설명이 표시된다', async () => {
      render(<AdminFeedbacksPage />, { wrapper });

      expect(screen.getByText('feedbacks.heading')).toBeInTheDocument();
      expect(screen.getByText('feedbacks.description')).toBeInTheDocument();
    });

    it('SWR로 로드된 피드백 목록이 테이블에 표시된다', async () => {
      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      expect(screen.getByText('Button does not work')).toBeInTheDocument();
      expect(screen.getByText('Add dark mode toggle')).toBeInTheDocument();
    });

    it('통계 카드에 counts 데이터가 반영된다', async () => {
      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      // 통계 카드 영역 (grid grid-cols-3)
      const statsGrid = screen.getByText('feedbacks.stats.total').closest('.grid') as HTMLElement;
      // totalCount = OPEN(1) + IN_PROGRESS(1) + RESOLVED(0) = 2
      expect(within(statsGrid).getByText('2')).toBeInTheDocument();
      // openCount = 1, bugCount = 1 — 두 카드 모두 1
      const ones = within(statsGrid).getAllByText('1');
      expect(ones).toHaveLength(2);
    });

    it('테이블 헤더가 표시된다', async () => {
      render(<AdminFeedbacksPage />, { wrapper });

      expect(screen.getByText('feedbacks.table.content')).toBeInTheDocument();
      expect(screen.getByText('feedbacks.table.author')).toBeInTheDocument();
      expect(screen.getByText('feedbacks.table.category')).toBeInTheDocument();
      expect(screen.getByText('feedbacks.table.status')).toBeInTheDocument();
      expect(screen.getByText('feedbacks.table.createdAt')).toBeInTheDocument();
    });

    it('목록이 비어 있으면 빈 상태 메시지를 표시한다', async () => {
      setupFetcher({ items: [], total: 0, counts: {} });

      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      expect(screen.getByText('feedbacks.empty')).toBeInTheDocument();
    });

    it('작성자 이름과 스터디 이름이 표시된다', async () => {
      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('로딩 중에는 로딩 메시지를 표시한다', () => {
      mockFetcher.mockReturnValue(new Promise(() => {})); // never resolves

      render(<AdminFeedbacksPage />, { wrapper });

      expect(screen.getByText('feedbacks.loading')).toBeInTheDocument();
    });
  });

  describe('상세 모달', () => {
    it('목록 항목 클릭 시 상세 모달이 열린다', async () => {
      const user = userEvent.setup();
      setupFetcher(mockListResponse, fb1);

      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      // 첫 번째 항목 클릭
      await user.click(screen.getByText('Button does not work'));

      await waitFor(() => {
        expect(screen.getByText('feedbacks.modal.contentLabel')).toBeInTheDocument();
      });

      // 모달 내 content 표시 확인
      expect(screen.getByText('feedbacks.modal.pageUrlLabel')).toBeInTheDocument();
    });

    it('상세 모달에서 작성자 정보가 표시된다', async () => {
      const user = userEvent.setup();
      setupFetcher(mockListResponse, fb1);

      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      await user.click(screen.getByText('Button does not work'));

      await waitFor(() => {
        expect(screen.getByText('feedbacks.modal.contentLabel')).toBeInTheDocument();
      });

      // 모달 오버레이 안에서 작성자 확인
      const modal = screen.getByText('feedbacks.modal.contentLabel').closest('.fixed');
      expect(modal).toBeInTheDocument();
    });

    it('모달 바깥 클릭 시 모달이 닫힌다', async () => {
      const user = userEvent.setup();
      setupFetcher(mockListResponse, fb1);

      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      await user.click(screen.getByText('Button does not work'));

      await waitFor(() => {
        expect(screen.getByText('feedbacks.modal.contentLabel')).toBeInTheDocument();
      });

      // 오버레이(backdrop) 클릭으로 모달 닫기
      const overlay = screen.getByText('feedbacks.modal.contentLabel')
        .closest('.fixed') as HTMLElement;
      await user.click(overlay);

      await waitFor(() => {
        expect(screen.queryByText('feedbacks.modal.contentLabel')).not.toBeInTheDocument();
      });
    });

    it('browserInfo가 있으면 모달에 표시된다', async () => {
      const user = userEvent.setup();
      setupFetcher(mockListResponse, fb1);

      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      await user.click(screen.getByText('Button does not work'));

      await waitFor(() => {
        expect(screen.getByText('feedbacks.modal.browserInfoLabel')).toBeInTheDocument();
      });

      expect(screen.getByText('Chrome 120')).toBeInTheDocument();
    });
  });

  describe('상태 변경', () => {
    it('드롭다운으로 상태 변경 시 adminApi.updateFeedbackStatus가 호출된다', async () => {
      const user = userEvent.setup();
      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      // fb1(OPEN)의 select를 찾아 RESOLVED로 변경
      const selects = screen.getAllByRole('combobox');
      // 첫 번째 select는 fb1(OPEN)
      await user.selectOptions(selects[0], 'RESOLVED');

      await waitFor(() => {
        expect(mockUpdateFeedbackStatus).toHaveBeenCalledWith('fb-1', 'RESOLVED');
      });
    });

    it('상태 변경 성공 시 success 토스트가 표시된다', async () => {
      const { toast } = jest.requireMock('sonner') as {
        toast: { success: jest.Mock; error: jest.Mock };
      };
      const user = userEvent.setup();
      mockUpdateFeedbackStatus.mockResolvedValue({ ...fb1, status: 'RESOLVED' });

      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'IN_PROGRESS');

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });
    });

    it('상태 변경 실패 시 error 토스트가 표시된다', async () => {
      const { toast } = jest.requireMock('sonner') as {
        toast: { success: jest.Mock; error: jest.Mock };
      };
      const user = userEvent.setup();
      mockUpdateFeedbackStatus.mockRejectedValue(new Error('PATCH failed'));

      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[0], 'RESOLVED');

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('feedbacks.toast.statusChangeFailed');
      });
    });

    it('모달 내 상태 변경 버튼 클릭 시 handleStatusChange가 호출되고 모달이 닫힌다', async () => {
      const user = userEvent.setup();
      setupFetcher(mockListResponse, fb1);
      mockUpdateFeedbackStatus.mockResolvedValue({ ...fb1, status: 'IN_PROGRESS' });

      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      // 모달 열기
      await user.click(screen.getByText('Button does not work'));

      await waitFor(() => {
        expect(screen.getByText('feedbacks.modal.statusChangeLabel')).toBeInTheDocument();
      });

      // 모달 내부의 상태 변경 버튼 — OPEN인 fb1은 IN_PROGRESS, RESOLVED 전이 가능
      const modal = screen.getByText('feedbacks.modal.statusChangeLabel').closest('.fixed') as HTMLElement;
      const transitionBtn = within(modal).getByText('feedbacks.status.IN_PROGRESS');
      await user.click(transitionBtn);

      await waitFor(() => {
        expect(mockUpdateFeedbackStatus).toHaveBeenCalledWith('fb-1', 'IN_PROGRESS');
      });

      // 모달 닫힘 확인
      await waitFor(() => {
        expect(screen.queryByText('feedbacks.modal.statusChangeLabel')).not.toBeInTheDocument();
      });
    });
  });

  describe('에러 핸들링', () => {
    it('목록 로드 실패 시 에러 토스트가 표시된다', async () => {
      const { toast } = jest.requireMock('sonner') as {
        toast: { success: jest.Mock; error: jest.Mock };
      };
      mockFetcher.mockRejectedValue(new Error('Network error'));

      render(<AdminFeedbacksPage />, { wrapper });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('feedbacks.toast.loadFailed');
      });
    });

    it('목록 로드 실패 시 빈 테이블이 표시된다', async () => {
      mockFetcher.mockRejectedValue(new Error('Network error'));

      render(<AdminFeedbacksPage />, { wrapper });

      await waitFor(() => {
        expect(screen.queryByText('feedbacks.loading')).not.toBeInTheDocument();
      });

      expect(screen.getByText('feedbacks.empty')).toBeInTheDocument();
    });
  });

  describe('필터 및 검색', () => {
    it('상태 필터 버튼 클릭 시 SWR 키가 변경되어 재요청된다', async () => {
      const user = userEvent.setup();
      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      mockFetcher.mockClear();

      // OPEN 필터 버튼 클릭 (select option이 아닌 button만 선택)
      const openButtons = screen.getAllByText('feedbacks.status.OPEN');
      const filterBtn = openButtons.find((el) => el.tagName === 'BUTTON') as HTMLElement;
      await user.click(filterBtn);

      await waitFor(() => {
        // fetcher가 status=OPEN 파라미터로 재호출
        expect(mockFetcher).toHaveBeenCalledWith(
          expect.stringContaining('status=OPEN'),
        );
      });
    });

    it('카테고리 필터 클릭 시 해당 카테고리로 재요청된다', async () => {
      const user = userEvent.setup();
      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      mockFetcher.mockClear();

      // BUG 카테고리 필터 버튼 클릭 (테이블 내 badge span이 아닌 button만 선택)
      const bugElements = screen.getAllByText('feedbacks.category.BUG');
      const catBtn = bugElements.find((el) => el.tagName === 'BUTTON') as HTMLElement;
      await user.click(catBtn);

      await waitFor(() => {
        expect(mockFetcher).toHaveBeenCalledWith(
          expect.stringContaining('category=BUG'),
        );
      });
    });

    it('검색 폼 제출 시 검색 쿼리가 요청에 포함된다', async () => {
      const user = userEvent.setup();
      render(<AdminFeedbacksPage />, { wrapper });
      await waitForListLoaded();

      mockFetcher.mockClear();

      const searchInput = screen.getByPlaceholderText('feedbacks.search.placeholder');
      await user.type(searchInput, 'dark mode');
      await user.click(screen.getByText('feedbacks.search.button'));

      await waitFor(() => {
        expect(mockFetcher).toHaveBeenCalledWith(
          expect.stringContaining('search=dark+mode'),
        );
      });
    });
  });
});
