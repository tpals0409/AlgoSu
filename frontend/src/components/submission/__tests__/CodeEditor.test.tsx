import { render, screen, fireEvent } from '@testing-library/react';
import { CodeEditor } from '../CodeEditor';

jest.mock('next/dynamic', () => {
  return () => {
    const MockEditor = (props: { value?: string; language?: string; onChange?: (v: string) => void }) => (
      <div data-testid="monaco-editor" data-language={props.language}>
        {props.value}
      </div>
    );
    MockEditor.displayName = 'MockMonacoEditor';
    return MockEditor;
  };
});

jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}));

jest.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert">{children}</div>
  ),
}));

jest.mock('@/components/ui/LoadingSpinner', () => ({
  InlineSpinner: () => <span data-testid="spinner" />,
}));

jest.mock('lucide-react', () => ({
  Check: () => <span data-testid="icon-check" />,
  Send: () => <span data-testid="icon-send" />,
  RotateCcw: () => <span data-testid="icon-reset" />,
  Minus: () => <span data-testid="icon-minus" />,
  Plus: () => <span data-testid="icon-plus" />,
  Maximize2: () => <span data-testid="icon-maximize" />,
  Minimize2: () => <span data-testid="icon-minimize" />,
}));

const defaultProps = {
  code: 'print("hello world")',
  language: 'python',
  onCodeChange: jest.fn(),
  onLanguageChange: jest.fn(),
  onSubmit: jest.fn().mockResolvedValue(undefined),
  isSubmitting: false,
};

describe('CodeEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('언어 선택 셀렉트를 렌더링한다', () => {
    render(<CodeEditor {...defaultProps} />);
    const select = screen.getByLabelText('프로그래밍 언어');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('python');
  });

  it('언어 변경 시 onLanguageChange를 호출한다', () => {
    render(<CodeEditor {...defaultProps} />);
    const select = screen.getByLabelText('프로그래밍 언어');
    fireEvent.change(select, { target: { value: 'java' } });
    expect(defaultProps.onLanguageChange).toHaveBeenCalledWith('java');
  });

  it('제출 버튼을 렌더링한다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getAllByText(/제출/).length).toBeGreaterThan(0);
  });

  it('isSubmitting 시 제출 버튼이 비활성화된다', () => {
    render(<CodeEditor {...defaultProps} isSubmitting={true} />);
    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find(btn => btn.textContent?.includes('제출'));
    expect(submitBtn).toBeDisabled();
  });

  it('초기화 버튼을 렌더링한다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByLabelText('템플릿으로 초기화')).toBeInTheDocument();
  });

  it('초기화 버튼 클릭 시 onCodeChange를 호출한다', () => {
    render(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('템플릿으로 초기화'));
    expect(defaultProps.onCodeChange).toHaveBeenCalled();
  });

  it('커서 위치를 표시한다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByText('1:1')).toBeInTheDocument();
  });

  it('코드 길이를 표시한다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByText(`${defaultProps.code.length}`)).toBeInTheDocument();
  });

  it('autoSaveStatus가 saving일 때 스피너를 보여준다', () => {
    render(<CodeEditor {...defaultProps} autoSaveStatus="saving" />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('autoSaveStatus가 saved일 때 체크 아이콘을 보여준다', () => {
    render(<CodeEditor {...defaultProps} autoSaveStatus="saved" />);
    expect(screen.getByTestId('icon-check')).toBeInTheDocument();
  });

  it('풀스크린 토글 버튼을 렌더링한다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByLabelText('풀스크린')).toBeInTheDocument();
  });

  it('isSubmitting 시 언어 선택이 비활성화된다', () => {
    render(<CodeEditor {...defaultProps} isSubmitting={true} />);
    const select = screen.getByLabelText('프로그래밍 언어');
    expect(select).toBeDisabled();
  });
});
