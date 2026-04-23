/**
 * @file AiSatisfactionButton unit tests
 * @domain submission
 * @layer component
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/i18n';
import { AiSatisfactionButton } from '../AiSatisfactionButton';

/* ---------- mocks ---------- */
const mockGetSatisfaction = jest.fn();
const mockRateSatisfaction = jest.fn();
const mockGetSatisfactionStats = jest.fn();

jest.mock('@/lib/api', () => ({
  submissionApi: {
    getSatisfaction: (...args: unknown[]) => mockGetSatisfaction(...args),
    rateSatisfaction: (...args: unknown[]) => mockRateSatisfaction(...args),
    getSatisfactionStats: (...args: unknown[]) => mockGetSatisfactionStats(...args),
  },
}));

jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), {
    error: jest.fn(),
  }),
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { ThumbsUp: Icon, ThumbsDown: Icon };
});

import { toast } from 'sonner';

const SUBMISSION_ID = 'sub-001';

beforeEach(() => {
  mockGetSatisfaction.mockReset();
  mockRateSatisfaction.mockReset();
  mockGetSatisfactionStats.mockReset();
  (toast as unknown as jest.Mock).mockClear();
  (toast.error as jest.Mock).mockClear();
  mockGetSatisfaction.mockResolvedValue(null);
  mockRateSatisfaction.mockResolvedValue({ ok: true });
  mockGetSatisfactionStats.mockResolvedValue({ up: 0, down: 0 });
});

describe('AiSatisfactionButton', () => {
  it('초기 렌더링 — "AI 분석이 도움이 되었나요?" 텍스트를 표시한다', async () => {
    renderWithI18n(<AiSatisfactionButton submissionId={SUBMISSION_ID} />);
    expect(screen.getByText('AI 분석이 도움이 되었나요?')).toBeInTheDocument();
    // getSatisfaction settle 대기
    await waitFor(() =>
      expect(mockGetSatisfaction).toHaveBeenCalledWith(SUBMISSION_ID),
    );
  });

  it('mount 시 getSatisfaction API를 호출한다', async () => {
    renderWithI18n(<AiSatisfactionButton submissionId={SUBMISSION_ID} />);
    await waitFor(() =>
      expect(mockGetSatisfaction).toHaveBeenCalledTimes(1),
    );
    expect(mockGetSatisfaction).toHaveBeenCalledWith(SUBMISSION_ID);
  });

  it('좋아요 클릭 → rateSatisfaction(submissionId, { rating: 1 }) 호출', async () => {
    const user = userEvent.setup();
    renderWithI18n(<AiSatisfactionButton submissionId={SUBMISSION_ID} />);
    await waitFor(() => expect(mockGetSatisfaction).toHaveBeenCalled());

    await user.click(screen.getByText('좋아요'));

    await waitFor(() =>
      expect(mockRateSatisfaction).toHaveBeenCalledWith(SUBMISSION_ID, {
        rating: 1,
      }),
    );
    expect(toast).toHaveBeenCalledWith('의견 감사합니다!');
  });

  it('아쉬워요 클릭 → rateSatisfaction(submissionId, { rating: -1 }) 호출', async () => {
    const user = userEvent.setup();
    renderWithI18n(<AiSatisfactionButton submissionId={SUBMISSION_ID} />);
    await waitFor(() => expect(mockGetSatisfaction).toHaveBeenCalled());

    await user.click(screen.getByText('아쉬워요'));

    await waitFor(() =>
      expect(mockRateSatisfaction).toHaveBeenCalledWith(SUBMISSION_ID, {
        rating: -1,
      }),
    );
    expect(toast).toHaveBeenCalledWith('의견 감사합니다!');
  });

  it('기존 평가가 있을 때 active 상태 스타일이 적용된다', async () => {
    mockGetSatisfaction.mockResolvedValue({ rating: 1 });
    renderWithI18n(<AiSatisfactionButton submissionId={SUBMISSION_ID} />);

    await waitFor(() => {
      const likeBtn = screen.getByText('좋아요').closest('button')!;
      expect(likeBtn.className).toContain('text-success');
    });
  });

  it('API 에러 시 에러가 발생하지 않는다 (사용자 경험 보호)', async () => {
    mockRateSatisfaction.mockRejectedValue(new Error('server error'));
    const user = userEvent.setup();
    renderWithI18n(<AiSatisfactionButton submissionId={SUBMISSION_ID} />);
    await waitFor(() => expect(mockGetSatisfaction).toHaveBeenCalled());

    await user.click(screen.getByText('좋아요'));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('평가 저장에 실패했습니다.'),
    );
    // 컴포넌트가 에러 없이 정상 렌더링 상태 유지
    expect(screen.getByText('AI 분석이 도움이 되었나요?')).toBeInTheDocument();
  });

  it('getSatisfaction 실패 시에도 에러 없이 렌더링된다', async () => {
    mockGetSatisfaction.mockRejectedValue(new Error('not found'));
    renderWithI18n(<AiSatisfactionButton submissionId={SUBMISSION_ID} />);

    await waitFor(() => expect(mockGetSatisfaction).toHaveBeenCalled());
    // 에러 없이 정상 렌더링
    expect(screen.getByText('AI 분석이 도움이 되었나요?')).toBeInTheDocument();
  });
});
