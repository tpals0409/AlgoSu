import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommentForm } from '../CommentForm';

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { Send: Icon };
});

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

describe('CommentForm', () => {
  const defaultProps = {
    onSubmit: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('라인 미선택 시 전체 댓글 placeholder를 표시한다', () => {
    render(<CommentForm {...defaultProps} />);
    expect(
      screen.getByPlaceholderText('전체 댓글을 남겨보세요...'),
    ).toBeInTheDocument();
  });

  it('lineNumber가 있으면 라인 댓글 placeholder를 표시한다', () => {
    render(<CommentForm {...defaultProps} lineNumber={5} />);
    expect(
      screen.getByPlaceholderText('Line 5에 대한 댓글...'),
    ).toBeInTheDocument();
  });

  it('내용 입력 후 등록 버튼으로 제출할 수 있다', async () => {
    render(<CommentForm {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '좋은 코드' } });
    fireEvent.click(screen.getByLabelText('댓글 등록'));
    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith('좋은 코드');
    });
  });

  it('Enter 키로 제출할 수 있다', async () => {
    render(<CommentForm {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '댓글 내용' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith('댓글 내용');
    });
  });

  it('빈 내용은 제출되지 않는다', async () => {
    render(<CommentForm {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('disabled 상태에서 textarea가 비활성화된다', () => {
    render(<CommentForm {...defaultProps} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('제출 후 textarea가 초기화된다', async () => {
    render(<CommentForm {...defaultProps} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '테스트' } });
    fireEvent.click(screen.getByLabelText('댓글 등록'));
    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  it('Shift+Enter는 제출하지 않는다', async () => {
    render(<CommentForm {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '줄바꿈 테스트' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    // Shift+Enter는 제출하지 않음
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it('제출 중에는 textarea와 버튼이 비활성화된다', async () => {
    let resolveSubmit: () => void;
    const pendingOnSubmit = jest.fn().mockReturnValue(
      new Promise<void>((resolve) => { resolveSubmit = resolve; })
    );

    render(<CommentForm onSubmit={pendingOnSubmit} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '제출 중 테스트' } });
    fireEvent.click(screen.getByLabelText('댓글 등록'));

    await waitFor(() => {
      expect(textarea).toBeDisabled();
    });

    resolveSubmit!();
  });
});
