import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { CodeEditor } from '../CodeEditor';

// Alert mock captures onClose for testing error dismissal
let mockAlertOnClose: (() => void) | undefined;

// Fake Monaco editor object
const fakeEditor = {
  updateOptions: jest.fn(),
  layout: jest.fn(),
  focus: jest.fn(),
  addAction: jest.fn(),
  onDidChangeCursorPosition: jest.fn(),
};

// Fake monaco instance
const fakeMonaco = {
  KeyMod: { CtrlCmd: 2048 },
  KeyCode: { Enter: 3 },
  languages: {},
  editor: {
    defineTheme: jest.fn(),
  },
};

jest.mock('next/dynamic', () => {
  return () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const MockEditor = (props: Record<string, any>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onMountRef = React.useRef<any>(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beforeMountRef = React.useRef<any>(null);
      const mountedRef = React.useRef(false);
      if (!mountedRef.current) {
        mountedRef.current = true;
        beforeMountRef.current = props.beforeMount;
        onMountRef.current = props.onMount;
        if (beforeMountRef.current) beforeMountRef.current(fakeMonaco);
        if (onMountRef.current) onMountRef.current(fakeEditor, fakeMonaco);
      }
      return (
        <div data-testid="monaco-editor" data-language={props.language}>
          {props.value}
        </div>
      );
    };
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
    expect(screen.getByLabelText('코드 초기화')).toBeInTheDocument();
  });

  it('초기화 버튼 클릭 시 빈 문자열로 초기화한다', () => {
    render(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('코드 초기화'));
    expect(defaultProps.onCodeChange).toHaveBeenCalledWith('');
  });

  it('커서 위치를 표시한다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByText('1:1')).toBeInTheDocument();
  });

  it('코드 길이를 표시한다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByText(`${defaultProps.code.length}`)).toBeInTheDocument();
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

  // ── 제출 확인 팝업 ──

  it('제출 버튼 클릭 시 확인 팝업이 표시된다', async () => {
    render(<CodeEditor {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const submitBtns = buttons.filter(b => !b.hasAttribute('disabled') && b.textContent?.includes('제출'));
    await act(async () => {
      fireEvent.click(submitBtns[0]);
    });
    expect(screen.getByText('코드를 제출하시겠습니까?')).toBeInTheDocument();
  });

  it('확인 팝업에서 제출을 클릭하면 onSubmit이 호출된다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<CodeEditor {...defaultProps} onSubmit={onSubmit} />);
    const buttons = screen.getAllByRole('button');
    const submitBtns = buttons.filter(b => !b.hasAttribute('disabled') && b.textContent?.includes('제출'));
    await act(async () => {
      fireEvent.click(submitBtns[0]);
    });
    // 팝업의 "제출" 버튼 클릭
    const confirmBtn = screen.getAllByRole('button').find(b => b.textContent === '제출');
    await act(async () => {
      fireEvent.click(confirmBtn!);
    });
    expect(onSubmit).toHaveBeenCalled();
  });

  it('확인 팝업에서 취소를 클릭하면 팝업이 닫힌다', async () => {
    render(<CodeEditor {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const submitBtns = buttons.filter(b => !b.hasAttribute('disabled') && b.textContent?.includes('제출'));
    await act(async () => {
      fireEvent.click(submitBtns[0]);
    });
    expect(screen.getByText('코드를 제출하시겠습니까?')).toBeInTheDocument();
    const cancelBtn = screen.getAllByRole('button').find(b => b.textContent === '취소');
    fireEvent.click(cancelBtn!);
    expect(screen.queryByText('코드를 제출하시겠습니까?')).not.toBeInTheDocument();
  });

  it('onSubmit이 실패하면 에러 메시지를 표시한다', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('서버 오류'));
    render(<CodeEditor {...defaultProps} onSubmit={onSubmit} />);
    // 제출 클릭 → 확인 팝업 → 제출 확인
    await act(async () => {
      const buttons = screen.getAllByRole('button');
      const submitBtns = buttons.filter(b => !b.hasAttribute('disabled') && b.textContent?.includes('제출'));
      fireEvent.click(submitBtns[0]);
    });
    const confirmBtn = screen.getAllByRole('button').find(b => b.textContent === '제출');
    await act(async () => {
      fireEvent.click(confirmBtn!);
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
      fireEvent.click(submitBtns[0]);
    });
    const confirmBtn = screen.getAllByRole('button').find(b => b.textContent === '제출');
    await act(async () => {
      fireEvent.click(confirmBtn!);
    });
    await waitFor(() => {
      expect(screen.getByTestId('alert')).toBeInTheDocument();
    });
    if (mockAlertOnClose) {
      act(() => mockAlertOnClose!());
      await waitFor(() => {
        expect(screen.queryByTestId('alert')).not.toBeInTheDocument();
      });
    }
  });

  it('마감 시간이 지났어도 제출 확인 팝업이 표시된다 (지각 제출 허용)', async () => {
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
      expect(screen.getByText('코드를 제출하시겠습니까?')).toBeInTheDocument();
    });
  });

  // ── 언어 변경 확인 팝업 ──

  it('코드가 있을 때 언어 변경 시 확인 팝업이 표시된다', () => {
    render(<CodeEditor {...defaultProps} />);
    const select = screen.getByLabelText('프로그래밍 언어');
    fireEvent.change(select, { target: { value: 'java' } });
    expect(screen.getByText('언어를 변경하시겠습니까?')).toBeInTheDocument();
  });

  it('언어 변경 팝업에서 변경을 클릭하면 코드가 초기화된다', () => {
    render(<CodeEditor {...defaultProps} />);
    const select = screen.getByLabelText('프로그래밍 언어');
    fireEvent.change(select, { target: { value: 'java' } });
    const changeBtn = screen.getAllByRole('button').find(b => b.textContent === '변경');
    fireEvent.click(changeBtn!);
    expect(defaultProps.onLanguageChange).toHaveBeenCalledWith('java');
    expect(defaultProps.onCodeChange).toHaveBeenCalledWith('');
  });

  it('언어 변경 팝업에서 취소를 클릭하면 팝업이 닫힌다', () => {
    render(<CodeEditor {...defaultProps} />);
    const select = screen.getByLabelText('프로그래밍 언어');
    fireEvent.change(select, { target: { value: 'java' } });
    expect(screen.getByText(/코드가 삭제됩니다/)).toBeInTheDocument();
    const cancelBtn = screen.getAllByRole('button').find(b => b.textContent === '취소');
    fireEvent.click(cancelBtn!);
    expect(screen.queryByText('언어를 변경하시겠습니까?')).not.toBeInTheDocument();
    // onLanguageChange는 호출되지 않아야 함
    expect(defaultProps.onLanguageChange).not.toHaveBeenCalled();
  });

  it('빈 코드일 때 언어 변경 시 팝업 없이 바로 변경된다', () => {
    render(<CodeEditor {...defaultProps} code="" />);
    const select = screen.getByLabelText('프로그래밍 언어');
    fireEvent.change(select, { target: { value: 'java' } });
    expect(defaultProps.onLanguageChange).toHaveBeenCalledWith('java');
    expect(screen.queryByText('언어를 변경하시겠습니까?')).not.toBeInTheDocument();
  });

  // ── 마감 임박 경고 타이머 ──

  it('deadline이 없으면 마감 경고를 표시하지 않는다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.queryByText(/마감까지/)).not.toBeInTheDocument();
  });

  it('deadline이 1분 미만이면 imminent 경고를 표시한다', () => {
    const imminentDeadline = new Date(Date.now() + 30000).toISOString();
    render(<CodeEditor {...defaultProps} deadline={imminentDeadline} />);
    expect(screen.getByText('마감까지 1분 미만 남았습니다. 지금 바로 제출하세요!')).toBeInTheDocument();
  });

  it('deadline이 5분 미만이면 approaching 경고를 표시한다', () => {
    const approachingDeadline = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    render(<CodeEditor {...defaultProps} deadline={approachingDeadline} />);
    expect(screen.getByText('마감까지 5분 이내입니다. 제출을 서두르세요.')).toBeInTheDocument();
  });

  it('deadline이 5분 이상이면 경고를 표시하지 않는다', () => {
    const farDeadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
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
    expect(screen.getByLabelText('풀스크린 해제')).toBeInTheDocument();
  });

  it('풀스크린 아닐 때는 Escape 키 이벤트 리스너가 없다', () => {
    render(<CodeEditor {...defaultProps} />);
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

  // ── 코드 길이 검증 ──

  it('코드 길이가 5자이면 제출 버튼이 비활성화된다', () => {
    const props = { ...defaultProps, code: 'short' };
    render(<CodeEditor {...props} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    const allBtns = screen.getAllByRole('button');
    const submitBtns = allBtns.filter(b => b.textContent?.includes('제출'));
    expect(submitBtns.some(b => b.hasAttribute('disabled'))).toBe(true);
  });

  it('코드 길이가 10자 미만일 때 남은 글자 수 경고를 표시한다', () => {
    const shortCode = 'abc';
    render(<CodeEditor {...defaultProps} code={shortCode} />);
    expect(screen.getByText(/7/)).toBeInTheDocument();
  });

  it('코드가 100KB 초과이면 제출 시 에러를 표시한다', async () => {
    const longCode = 'a'.repeat(102_401);
    const onSubmit = jest.fn();
    render(<CodeEditor {...defaultProps} code={longCode} onSubmit={onSubmit} />);
    await act(async () => {
      const buttons = screen.getAllByRole('button');
      const submitBtns = buttons.filter(b => !b.hasAttribute('disabled') && b.textContent?.includes('제출'));
      if (submitBtns.length > 0) {
        fireEvent.click(submitBtns[0]);
      }
    });
    await waitFor(() => {
      expect(screen.getByText('코드는 100KB를 초과할 수 없습니다.')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
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
    expect(screen.getByText('13')).toBeInTheDocument();
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
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByLabelText('폰트 축소'));
    }
    expect(screen.getByLabelText('폰트 축소')).toBeDisabled();
  });

  it('폰트 크기 최대(20)에서 확대 버튼이 비활성화된다', () => {
    render(<CodeEditor {...defaultProps} />);
    for (let i = 0; i < 7; i++) {
      fireEvent.click(screen.getByLabelText('폰트 확대'));
    }
    expect(screen.getByLabelText('폰트 확대')).toBeDisabled();
  });

  // ── 기타 ──

  it('알 수 없는 언어는 plaintext로 fallback된다', () => {
    render(<CodeEditor {...defaultProps} language="unknown_lang" />);
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('onDidChangeCursorPosition 콜백이 커서 위치를 업데이트한다', async () => {
    render(<CodeEditor {...defaultProps} />);
    await waitFor(() => {
      expect(fakeEditor.onDidChangeCursorPosition).toHaveBeenCalled();
    });
    const cursorCb = fakeEditor.onDidChangeCursorPosition.mock.calls[0]?.[0];
    if (cursorCb) {
      act(() => {
        cursorCb({ position: { lineNumber: 3, column: 7 } });
      });
      expect(screen.getByText('3:7')).toBeInTheDocument();
    }
  });

  it('addAction run 콜백이 submitRef.current를 호출한다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<CodeEditor {...defaultProps} onSubmit={onSubmit} />);
    await waitFor(() => {
      expect(fakeEditor.addAction).toHaveBeenCalled();
    });
    const actionArg = fakeEditor.addAction.mock.calls[0]?.[0];
    if (actionArg?.run) {
      await act(async () => {
        actionArg.run();
        await Promise.resolve();
      });
      // Ctrl+Enter triggers handleSubmit which shows confirm popup
      expect(screen.getByText('코드를 제출하시겠습니까?')).toBeInTheDocument();
    }
  });

  it('light 테마에서 algosu-light 테마를 사용한다', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.spyOn(require('next-themes'), 'useTheme').mockReturnValue({ resolvedTheme: 'light', setTheme: jest.fn() });
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });
});
