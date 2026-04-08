/**
 * @file FeedbackForm 단위 테스트
 * @domain feedback
 * @layer component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FeedbackForm } from '../FeedbackForm';

// ── Mocks ──

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return new Proxy(
    {},
    { get: (_target, prop) => (prop === '__esModule' ? true : Icon) },
  );
});

const mockCreate = jest.fn();

jest.mock('@/lib/api', () => ({
  feedbackApi: {
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { toast: mockToast } = require('sonner');

describe('FeedbackForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ publicId: 'fb-1' });
  });

  it('기본 렌더링 — 카테고리 버튼 3개 + 내용 텍스트영역 + 제출 버튼', () => {
    render(<FeedbackForm />);
    expect(screen.getByText('일반')).toBeInTheDocument();
    expect(screen.getByText('기능 요청')).toBeInTheDocument();
    expect(screen.getByText('UX 개선')).toBeInTheDocument();
    expect(screen.getByLabelText('내용')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '피드백 보내기' })).toBeInTheDocument();
  });

  it('카테고리를 FEATURE로 전환하면 해당 카테고리로 API 호출', async () => {
    render(<FeedbackForm />);

    // 기능 요청 카테고리 선택
    fireEvent.click(screen.getByText('기능 요청'));

    // 내용 입력
    fireEvent.change(screen.getByLabelText('내용'), {
      target: { value: '검색 기능이 있었으면 좋겠습니다.' },
    });

    fireEvent.click(screen.getByRole('button', { name: '피드백 보내기' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.category).toBe('FEATURE');
    expect(callArg.content).toBe('검색 기능이 있었으면 좋겠습니다.');
  });

  it('카테고리를 UX로 전환하면 해당 카테고리로 API 호출', async () => {
    render(<FeedbackForm />);

    fireEvent.click(screen.getByText('UX 개선'));

    fireEvent.change(screen.getByLabelText('내용'), {
      target: { value: '버튼 크기가 너무 작아서 클릭하기 어렵습니다.' },
    });

    fireEvent.click(screen.getByRole('button', { name: '피드백 보내기' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.category).toBe('UX');
  });

  it('API 실패 시 에러 toast를 표시한다', async () => {
    mockCreate.mockRejectedValue(new Error('server error'));

    render(<FeedbackForm />);

    fireEvent.change(screen.getByLabelText('내용'), {
      target: { value: '테스트 피드백 내용입니다.' },
    });

    fireEvent.click(screen.getByRole('button', { name: '피드백 보내기' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        '피드백 전송에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
    });
  });

  it('onSuccess 콜백을 호출한다', async () => {
    const onSuccess = jest.fn();
    render(<FeedbackForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText('내용'), {
      target: { value: '좋은 서비스입니다! 잘 사용하고 있습니다.' },
    });

    fireEvent.click(screen.getByRole('button', { name: '피드백 보내기' }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('2000자 초과 시 유효성 에러', async () => {
    render(<FeedbackForm />);

    const longText = 'x'.repeat(2001);
    fireEvent.change(screen.getByLabelText('내용'), {
      target: { value: longText },
    });

    fireEvent.click(screen.getByRole('button', { name: '피드백 보내기' }));

    await waitFor(() => {
      expect(screen.getByText('2000자 이내로 입력해주세요.')).toBeInTheDocument();
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });
});
