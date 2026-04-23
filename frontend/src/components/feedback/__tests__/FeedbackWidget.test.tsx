import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { FeedbackWidget } from '../FeedbackWidget';

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

jest.mock('@/contexts/StudyContext', () => ({
  useStudy: () => ({ currentStudyId: null }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { toast: mockToast } = require('sonner');

// Sheet (Radix Dialog) 은 Portal 렌더링이 jsdom 에서 동작하므로 그대로 사용
// react-hook-form + zod 도 실제 로직 사용

// ── Helpers ──

function openSheet() {
  fireEvent.click(screen.getByLabelText('피드백 보내기'));
}

// ── Tests ──

describe('FeedbackWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // 1. 플로팅 버튼 렌더링
  it('플로팅 버튼이 렌더링된다', () => {
    renderWithI18n(<FeedbackWidget />);
    expect(screen.getByLabelText('피드백 보내기')).toBeInTheDocument();
  });

  // 2. 버튼 클릭 시 Sheet 열림
  it('버튼 클릭 시 Sheet 이 열리고 제목이 표시된다', async () => {
    renderWithI18n(<FeedbackWidget />);
    openSheet();

    await waitFor(() => {
      expect(screen.getByText('의견 보내기')).toBeInTheDocument();
    });
    expect(screen.getByText('AlgoSu를 개선하는 데 도움을 주세요.')).toBeInTheDocument();
  });

  // 3. 탭 전환 (피드백 -> 버그 리포트)
  it('탭을 전환하면 버그 리포트 폼이 표시된다', async () => {
    renderWithI18n(<FeedbackWidget />);
    openSheet();

    await waitFor(() => {
      expect(screen.getByText('피드백')).toBeInTheDocument();
    });

    // 기본 탭: 피드백 — 피드백 보내기 버튼 존재
    expect(screen.getByRole('button', { name: '피드백 보내기' })).toBeInTheDocument();

    // 버그 리포트 탭 클릭
    fireEvent.click(screen.getByText('버그 리포트'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '버그 리포트 보내기' })).toBeInTheDocument();
    });
  });

  // 4. FeedbackForm: 내용 미입력 시 유효성 에러
  it('FeedbackForm: 내용 미입력 시 유효성 에러를 표시한다', async () => {
    renderWithI18n(<FeedbackWidget />);
    openSheet();

    await waitFor(() => {
      expect(screen.getByText('피드백 보내기')).toBeInTheDocument();
    });

    // 내용 입력 없이 제출
    fireEvent.click(screen.getByRole('button', { name: '피드백 보내기' }));

    await waitFor(() => {
      expect(screen.getByText('5자 이상 입력해주세요.')).toBeInTheDocument();
    });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  // 5. FeedbackForm: 제출 성공 시 API 호출 + toast
  it('FeedbackForm: 제출 성공 시 feedbackApi.create 호출 + 성공 toast', async () => {
    mockCreate.mockResolvedValue({ publicId: 'fb-1' });

    renderWithI18n(<FeedbackWidget />);
    openSheet();

    await waitFor(() => {
      expect(screen.getByLabelText('내용')).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText('내용');
    fireEvent.change(textarea, { target: { value: '좋은 서비스입니다! 감사합니다.' } });

    fireEvent.click(screen.getByRole('button', { name: '피드백 보내기' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.category).toBe('GENERAL');
    expect(callArg.content).toBe('좋은 서비스입니다! 감사합니다.');
    expect(callArg.pageUrl).toBeDefined();

    expect(mockToast.success).toHaveBeenCalledWith('피드백을 보내주셔서 감사합니다!');
  });

  // 6. BugReportForm: 제출 성공 시 category='BUG' + API 호출
  it('BugReportForm: 제출 성공 시 category=BUG 로 API 호출', async () => {
    mockCreate.mockResolvedValue({ publicId: 'fb-2' });

    renderWithI18n(<FeedbackWidget />);
    openSheet();

    await waitFor(() => {
      expect(screen.getByText('버그 리포트')).toBeInTheDocument();
    });

    // 버그 리포트 탭 전환
    fireEvent.click(screen.getByText('버그 리포트'));

    await waitFor(() => {
      expect(screen.getByLabelText('버그 설명')).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText('버그 설명');
    fireEvent.change(textarea, { target: { value: '페이지 로딩 시 에러가 발생합니다.' } });

    fireEvent.click(screen.getByRole('button', { name: '버그 리포트 보내기' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.category).toBe('BUG');
    expect(callArg.content).toBe('페이지 로딩 시 에러가 발생합니다.');
    expect(callArg.pageUrl).toBeDefined();

    expect(mockToast.success).toHaveBeenCalledWith('버그 리포트를 보내주셔서 감사합니다!');
  });
});
