import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { CodeEditor } from '../CodeEditor';

// Alert mock captures onClose for testing error dismissal
let mockAlertOnClose: (() => void) | undefined;

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
  Alert: ({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) => {
    mockAlertOnClose = onClose;
    return <div data-testid="alert">{children}</div>;
  },
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
    mockAlertOnClose = undefined;
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

  // ── 제출 핸들러 에러 케이스 ──

  it('코드 길이가 5자이면 하단에 글자 수를 표시한다', () => {
    const props = { ...defaultProps, code: 'short' };
    render(<CodeEditor {...props} />);
    // 코드 길이 표시 (5자)
    expect(screen.getByText('5')).toBeInTheDocument();
    // 제출 버튼 disabled
    const allBtns = screen.getAllByRole('button');
    const submitBtns = allBtns.filter(b => b.textContent?.includes('제출'));
    expect(submitBtns.some(b => b.hasAttribute('disabled'))).toBe(true);
  });

  it('코드 길이가 10자 미만일 때 남은 글자 수 경고를 표시한다', () => {
    const shortCode = 'abc'; // 3자
    render(<CodeEditor {...defaultProps} code={shortCode} />);
    expect(screen.getByText(/7/)).toBeInTheDocument(); // 10-3=7자 더 필요
  });

  it('코드 길이가 10자 미만이면 제출 버튼이 비활성화된다', () => {
    render(<CodeEditor {...defaultProps} code="short" />);
    const buttons = screen.getAllByRole('button');
    const submitBtns = buttons.filter(b => b.textContent?.includes('제출'));
    expect(submitBtns.some(b => b.hasAttribute('disabled'))).toBe(true);
  });

  it('코드가 10자 이상이면 제출을 시도한다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<CodeEditor {...defaultProps} onSubmit={onSubmit} />);
    const buttons = screen.getAllByRole('button');
    const submitBtns = buttons.filter(b => !b.hasAttribute('disabled') && b.textContent?.includes('제출'));
    if (submitBtns.length > 0) {
      await act(async () => {
        fireEvent.click(submitBtns[0]);
      });
      expect(onSubmit).toHaveBeenCalled();
    }
  });

  it('onSubmit이 실패하면 에러 메시지를 표시한다', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('서버 오류'));
    render(<CodeEditor {...defaultProps} onSubmit={onSubmit} />);
    await act(async () => {
      const buttons = screen.getAllByRole('button');
      const submitBtns = buttons.filter(b => !b.hasAttribute('disabled') && b.textContent?.includes('제출'));
      if (submitBtns.length > 0) {
        fireEvent.click(submitBtns[0]);
      }
    });
    await waitFor(() => {
      expect(screen.getByTestId('alert')).toBeInTheDocument();
    });
  });

  it('에러 Alert의 onClose 콜백이 에러를 지운다', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('오류'));
    render(<CodeEditor {...defaultProps} onSubmit={onSubmit} />);
    await act(async () => {
      const buttons = screen.getAllByRole('button');
      const submitBtns = buttons.filter(b => !b.hasAttribute('disabled') && b.textContent?.includes('제출'));
      if (submitBtns.length > 0) {
        fireEvent.click(submitBtns[0]);
      }
    });
    await waitFor(() => {
      expect(screen.getByTestId('alert')).toBeInTheDocument();
    });
    // onClose를 호출하면 에러가 지워진다
    if (mockAlertOnClose) {
      act(() => mockAlertOnClose!());
      await waitFor(() => {
        expect(screen.queryByTestId('alert')).not.toBeInTheDocument();
      });
    }
  });

  it('마감 시간이 지났으면 제출 시 에러를 표시한다', async () => {
    const pastDeadline = new Date(Date.now() - 10000).toISOString();
    render(<CodeEditor {...defaultProps} deadline={pastDeadline} />);
    await act(async () => {
      const buttons = screen.getAllByRole('button');
      const submitBtns = buttons.filter(b => !b.hasAttribute('disabled') && b.textContent?.includes('제출'));
      if (submitBtns.length > 0) {
        fireEvent.click(submitBtns[0]);
      }
    });
    await waitFor(() => {
      expect(screen.getByTestId('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('마감 시간이 지났습니다.')).toBeInTheDocument();
  });

  // ── 마감 임박 경고 타이머 ──

  it('deadline이 없으면 마감 경고를 표시하지 않는다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.queryByText(/마감까지/)).not.toBeInTheDocument();
  });

  it('deadline이 1분 미만이면 imminent 경고를 표시한다', () => {
    const imminentDeadline = new Date(Date.now() + 30000).toISOString(); // 30초 뒤
    render(<CodeEditor {...defaultProps} deadline={imminentDeadline} />);
    expect(screen.getByText('마감까지 1분 미만 남았습니다. 지금 바로 제출하세요!')).toBeInTheDocument();
  });

  it('deadline이 5분 미만이면 approaching 경고를 표시한다', () => {
    const approachingDeadline = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2분 뒤
    render(<CodeEditor {...defaultProps} deadline={approachingDeadline} />);
    expect(screen.getByText('마감까지 5분 이내입니다. 제출을 서두르세요.')).toBeInTheDocument();
  });

  it('deadline이 5분 이상이면 경고를 표시하지 않는다', () => {
    const farDeadline = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10분 뒤
    render(<CodeEditor {...defaultProps} deadline={farDeadline} />);
    expect(screen.queryByText(/마감까지/)).not.toBeInTheDocument();
  });

  it('deadline이 지나면 경고를 표시하지 않는다', () => {
    const pastDeadline = new Date(Date.now() - 1000).toISOString();
    render(<CodeEditor {...defaultProps} deadline={pastDeadline} />);
    expect(screen.queryByText(/마감까지/)).not.toBeInTheDocument();
  });

  it('deadline이 있으면 마감 시간 텍스트를 표시한다', () => {
    const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    render(<CodeEditor {...defaultProps} deadline={deadline} />);
    expect(screen.getByText(/마감:/)).toBeInTheDocument();
  });

  // ── 풀스크린 ──

  it('풀스크린 버튼 클릭 시 풀스크린 해제 버튼으로 전환된다', () => {
    render(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('풀스크린'));
    expect(screen.getByLabelText('풀스크린 해제')).toBeInTheDocument();
  });

  it('풀스크린 해제 버튼 클릭 시 풀스크린 버튼으로 전환된다', () => {
    render(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('풀스크린'));
    fireEvent.click(screen.getByLabelText('풀스크린 해제'));
    expect(screen.getByLabelText('풀스크린')).toBeInTheDocument();
  });

  it('풀스크린 상태에서 Escape 키로 풀스크린을 해제한다', () => {
    render(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('풀스크린'));
    expect(screen.getByLabelText('풀스크린 해제')).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.getByLabelText('풀스크린')).toBeInTheDocument();
  });

  it('풀스크린 상태에서 defaultPrevented Escape는 무시된다', () => {
    render(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('풀스크린'));
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      Object.defineProperty(event, 'defaultPrevented', { value: true });
      window.dispatchEvent(event);
    });
    // defaultPrevented이면 풀스크린이 유지되어야 함
    expect(screen.getByLabelText('풀스크린 해제')).toBeInTheDocument();
  });

  it('풀스크린 상태에서 suggest-widget이 있으면 Escape를 무시한다', () => {
    render(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('풀스크린'));
    // suggest widget 시뮬레이션
    const widget = document.createElement('div');
    widget.className = 'editor-widget suggest-widget visible';
    document.body.appendChild(widget);
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    // suggest-widget이 있으면 풀스크린이 유지되어야 함
    expect(screen.getByLabelText('풀스크린 해제')).toBeInTheDocument();
    document.body.removeChild(widget);
  });

  it('풀스크린 아닐 때는 Escape 키 이벤트 리스너가 없다 (no-op)', () => {
    render(<CodeEditor {...defaultProps} />);
    // fullscreen=false 상태에서 Escape 눌러도 아무 변화 없음
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.getByLabelText('풀스크린')).toBeInTheDocument();
  });

  it('풀스크린 상태에서 다른 키는 무시된다', () => {
    render(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('풀스크린'));
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });
    expect(screen.getByLabelText('풀스크린 해제')).toBeInTheDocument();
  });

  // ── 초기 템플릿 삽입 ──

  it('빈 코드로 마운트 시 BOJ 템플릿을 삽입한다', () => {
    const onCodeChange = jest.fn();
    render(<CodeEditor {...defaultProps} code="" onCodeChange={onCodeChange} />);
    expect(onCodeChange).toHaveBeenCalledWith(expect.stringContaining('sys.stdin'));
  });

  it('코드가 있으면 템플릿을 삽입하지 않는다', () => {
    const onCodeChange = jest.fn();
    render(<CodeEditor {...defaultProps} code="my custom code here" onCodeChange={onCodeChange} />);
    expect(onCodeChange).not.toHaveBeenCalled();
  });

  it('언어에 해당하는 템플릿이 없으면 템플릿을 삽입하지 않는다', () => {
    const onCodeChange = jest.fn();
    render(<CodeEditor {...defaultProps} code="" language="unknown_lang" onCodeChange={onCodeChange} />);
    expect(onCodeChange).not.toHaveBeenCalled();
  });

  // ── 언어 변경 (템플릿 코드 교체) ──

  it('현재 코드가 템플릿이면 언어 변경 시 새 템플릿으로 교체한다', () => {
    const pythonTemplate = 'import sys\ninput = sys.stdin.readline\n\n';
    const onCodeChange = jest.fn();
    render(<CodeEditor {...defaultProps} code={pythonTemplate} onCodeChange={onCodeChange} />);
    const select = screen.getByLabelText('프로그래밍 언어');
    fireEvent.change(select, { target: { value: 'java' } });
    expect(onCodeChange).toHaveBeenCalledWith(expect.stringContaining('BufferedReader'));
  });

  it('현재 코드가 비어있으면 언어 변경 시 새 템플릿으로 교체한다', () => {
    const onCodeChange = jest.fn();
    render(<CodeEditor {...defaultProps} code="" onCodeChange={onCodeChange} language="python" />);
    onCodeChange.mockClear(); // 초기 템플릿 삽입 호출 초기화
    const select = screen.getByLabelText('프로그래밍 언어');
    fireEvent.change(select, { target: { value: 'java' } });
    expect(onCodeChange).toHaveBeenCalled();
  });

  it('커스텀 코드가 있으면 언어 변경 시 코드를 교체하지 않는다', () => {
    const onCodeChange = jest.fn();
    render(<CodeEditor {...defaultProps} code="my custom solution" onCodeChange={onCodeChange} />);
    const select = screen.getByLabelText('프로그래밍 언어');
    fireEvent.change(select, { target: { value: 'java' } });
    expect(onCodeChange).not.toHaveBeenCalled();
  });

  // ── 자동완성 토글 ──

  it('자동완성 체크박스를 렌더링한다', () => {
    render(<CodeEditor {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('자동완성 체크박스를 해제할 수 있다', () => {
    render(<CodeEditor {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  // ── 폰트 크기 ──

  it('폰트 축소 버튼을 렌더링한다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByLabelText('폰트 축소')).toBeInTheDocument();
  });

  it('폰트 확대 버튼을 렌더링한다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByLabelText('폰트 확대')).toBeInTheDocument();
  });

  it('폰트 확대 버튼 클릭 시 폰트 크기가 증가한다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByText('13')).toBeInTheDocument(); // 기본 폰트 크기
    fireEvent.click(screen.getByLabelText('폰트 확대'));
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('폰트 축소 버튼 클릭 시 폰트 크기가 감소한다', () => {
    render(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('폰트 축소'));
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('폰트 크기 최소(10)에서 축소 버튼이 비활성화된다', () => {
    render(<CodeEditor {...defaultProps} />);
    // 10까지 축소 (13 -> 10은 3번)
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByLabelText('폰트 축소'));
    }
    expect(screen.getByLabelText('폰트 축소')).toBeDisabled();
  });

  it('폰트 크기 최대(20)에서 확대 버튼이 비활성화된다', () => {
    render(<CodeEditor {...defaultProps} />);
    // 20까지 확대 (13 -> 20은 7번)
    for (let i = 0; i < 7; i++) {
      fireEvent.click(screen.getByLabelText('폰트 확대'));
    }
    expect(screen.getByLabelText('폰트 확대')).toBeDisabled();
  });

  // ── language가 MONACO_LANG_MAP에 없는 경우 (plaintext fallback) ──

  it('알 수 없는 언어는 plaintext로 fallback된다', () => {
    render(<CodeEditor {...defaultProps} language="unknown_lang" />);
    // Monaco 모킹이 있으므로 단순히 에러 없이 렌더링되면 OK
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  // ── BOJ_TEMPLATES에 없는 언어의 초기화 ──

  it('BOJ_TEMPLATES에 없는 언어에서 초기화 버튼 클릭 시 빈 문자열로 교체한다', () => {
    const onCodeChange = jest.fn();
    render(<CodeEditor {...defaultProps} language="unknown_lang" code="some code" onCodeChange={onCodeChange} />);
    fireEvent.click(screen.getByLabelText('템플릿으로 초기화'));
    expect(onCodeChange).toHaveBeenCalledWith('');
  });
});
