/**
 * @file BugReportForm 단위 테스트
 * @domain feedback
 * @layer component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BugReportForm } from '../BugReportForm';

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
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { toast: mockToast } = require('sonner');

describe('BugReportForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ publicId: 'fb-bug-1' });
  });

  it('기본 렌더링 — 버그 설명 텍스트영역 + 스크린샷 영역 + 제출 버튼', () => {
    render(<BugReportForm />);
    expect(screen.getByLabelText('버그 설명')).toBeInTheDocument();
    expect(screen.getByText(/이미지 첨부/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '버그 리포트 보내기' })).toBeInTheDocument();
  });

  it('내용 미입력 시 유효성 에러를 표시한다', async () => {
    render(<BugReportForm />);

    fireEvent.click(screen.getByRole('button', { name: '버그 리포트 보내기' }));

    await waitFor(() => {
      expect(screen.getByText('5자 이상 입력해주세요.')).toBeInTheDocument();
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('제출 성공 시 category=BUG + browserInfo 포함 API 호출', async () => {
    render(<BugReportForm />);

    fireEvent.change(screen.getByLabelText('버그 설명'), {
      target: { value: '제출 버튼 클릭 시 페이지가 멈춥니다.' },
    });

    fireEvent.click(screen.getByRole('button', { name: '버그 리포트 보내기' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.category).toBe('BUG');
    expect(callArg.content).toBe('제출 버튼 클릭 시 페이지가 멈춥니다.');
    expect(callArg.pageUrl).toBeDefined();
    expect(callArg.browserInfo).toBeDefined();

    expect(mockToast.success).toHaveBeenCalledWith('버그 리포트를 보내주셔서 감사합니다!');
  });

  it('API 실패 시 에러 toast를 표시한다', async () => {
    mockCreate.mockRejectedValue(new Error('server error'));

    render(<BugReportForm />);

    fireEvent.change(screen.getByLabelText('버그 설명'), {
      target: { value: '버그 리포트 실패 테스트 입니다.' },
    });

    fireEvent.click(screen.getByRole('button', { name: '버그 리포트 보내기' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        '버그 리포트 전송에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
    });
  });

  it('onSuccess 콜백을 호출한다', async () => {
    const onSuccess = jest.fn();
    render(<BugReportForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText('버그 설명'), {
      target: { value: '버그가 발생해서 리포트를 보냅니다.' },
    });

    fireEvent.click(screen.getByRole('button', { name: '버그 리포트 보내기' }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('스크린샷 파일 선택 버튼이 존재한다', () => {
    render(<BugReportForm />);
    expect(screen.getByLabelText('스크린샷 파일 선택')).toBeInTheDocument();
  });

  it('2000자 초과 시 유효성 에러', async () => {
    render(<BugReportForm />);

    const longText = 'x'.repeat(2001);
    fireEvent.change(screen.getByLabelText('버그 설명'), {
      target: { value: longText },
    });

    fireEvent.click(screen.getByRole('button', { name: '버그 리포트 보내기' }));

    await waitFor(() => {
      expect(screen.getByText('2000자 이내로 입력해주세요.')).toBeInTheDocument();
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });
});
