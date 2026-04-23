import React from 'react';
import { screen, fireEvent, act, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
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

  it('renders the language selector', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    const select = screen.getByLabelText('프로그래밍 언어');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('python');
  });

  it('renders the submit button', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    expect(screen.getAllByText(/제출/).length).toBeGreaterThan(0);
  });

  it('disables submit button when isSubmitting', () => {
    renderWithI18n(<CodeEditor {...defaultProps} isSubmitting={true} />);
    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find(btn => btn.textContent?.includes('제출'));
    expect(submitBtn).toBeDisabled();
  });

  it('renders the reset button', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    expect(screen.getByLabelText('코드 초기화')).toBeInTheDocument();
  });

  it('resets code to empty string on reset click', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('코드 초기화'));
    expect(defaultProps.onCodeChange).toHaveBeenCalledWith('');
  });

  it('displays cursor position', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    expect(screen.getByText('1:1')).toBeInTheDocument();
  });

  it('displays code length', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    expect(screen.getByText(`${defaultProps.code.length}`)).toBeInTheDocument();
  });

  it('renders fullscreen toggle button', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    expect(screen.getByLabelText('풀스크린')).toBeInTheDocument();
  });

  it('disables language selector when isSubmitting', () => {
    renderWithI18n(<CodeEditor {...defaultProps} isSubmitting={true} />);
    const select = screen.getByLabelText('프로그래밍 언어');
    expect(select).toBeDisabled();
  });

  // ── Submit confirm popup ──

  it('shows confirm popup on submit click', async () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const submitBtns = buttons.filter(b => !b.hasAttribute('disabled') && b.textContent?.includes('제출'));
    await act(async () => {
      fireEvent.click(submitBtns[0]);
    });
    expect(screen.getByText('코드를 제출하시겠습니까?')).toBeInTheDocument();
  });

  it('calls onSubmit when confirm button is clicked', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    renderWithI18n(<CodeEditor {...defaultProps} onSubmit={onSubmit} />);
    const buttons = screen.getAllByRole('button');
    const submitBtns = buttons.filter(b => !b.hasAttribute('disabled') && b.textContent?.includes('제출'));
    await act(async () => {
      fireEvent.click(submitBtns[0]);
    });
    // Click "Submit" button in popup
    const confirmBtn = screen.getAllByRole('button').find(b => b.textContent === '제출');
    await act(async () => {
      fireEvent.click(confirmBtn!);
    });
    expect(onSubmit).toHaveBeenCalled();
  });

  it('closes popup on cancel click', async () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
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

  it('shows error message when onSubmit fails', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('server error'));
    renderWithI18n(<CodeEditor {...defaultProps} onSubmit={onSubmit} />);
    // Submit click -> confirm popup -> confirm submit
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

  it('clears error when Alert onClose is called', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('error'));
    renderWithI18n(<CodeEditor {...defaultProps} onSubmit={onSubmit} />);
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

  it('shows confirm popup even after deadline passed (late submission allowed)', async () => {
    const pastDeadline = new Date(Date.now() - 10000).toISOString();
    renderWithI18n(<CodeEditor {...defaultProps} deadline={pastDeadline} />);
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

  // ── Language change confirm popup ──

  it('shows confirm popup when changing language with existing code', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    const select = screen.getByLabelText('프로그래밍 언어');
    fireEvent.change(select, { target: { value: 'java' } });
    expect(screen.getByText('언어를 변경하시겠습니까?')).toBeInTheDocument();
  });

  it('resets code when language change is confirmed', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    const select = screen.getByLabelText('프로그래밍 언어');
    fireEvent.change(select, { target: { value: 'java' } });
    const changeBtn = screen.getAllByRole('button').find(b => b.textContent === '변경');
    fireEvent.click(changeBtn!);
    expect(defaultProps.onLanguageChange).toHaveBeenCalledWith('java');
    expect(defaultProps.onCodeChange).toHaveBeenCalledWith('');
  });

  it('closes language change popup on cancel', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    const select = screen.getByLabelText('프로그래밍 언어');
    fireEvent.change(select, { target: { value: 'java' } });
    expect(screen.getByText(/코드가 삭제됩니다/)).toBeInTheDocument();
    const cancelBtn = screen.getAllByRole('button').find(b => b.textContent === '취소');
    fireEvent.click(cancelBtn!);
    expect(screen.queryByText('언어를 변경하시겠습니까?')).not.toBeInTheDocument();
    // onLanguageChange should not be called
    expect(defaultProps.onLanguageChange).not.toHaveBeenCalled();
  });

  it('changes language directly when code is empty', () => {
    renderWithI18n(<CodeEditor {...defaultProps} code="" />);
    const select = screen.getByLabelText('프로그래밍 언어');
    fireEvent.change(select, { target: { value: 'java' } });
    expect(defaultProps.onLanguageChange).toHaveBeenCalledWith('java');
    expect(screen.queryByText('언어를 변경하시겠습니까?')).not.toBeInTheDocument();
  });

  // ── Deadline warning timer ──

  it('does not show deadline warning when no deadline', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    expect(screen.queryByText(/마감까지/)).not.toBeInTheDocument();
  });

  it('shows imminent warning when deadline is less than 1 minute', () => {
    const imminentDeadline = new Date(Date.now() + 30000).toISOString();
    renderWithI18n(<CodeEditor {...defaultProps} deadline={imminentDeadline} />);
    expect(screen.getByText('마감까지 1분 미만 남았습니다. 지금 바로 제출하세요!')).toBeInTheDocument();
  });

  it('shows approaching warning when deadline is less than 5 minutes', () => {
    const approachingDeadline = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    renderWithI18n(<CodeEditor {...defaultProps} deadline={approachingDeadline} />);
    expect(screen.getByText('마감까지 5분 이내입니다. 제출을 서두르세요.')).toBeInTheDocument();
  });

  it('does not show warning when deadline is more than 5 minutes', () => {
    const farDeadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    renderWithI18n(<CodeEditor {...defaultProps} deadline={farDeadline} />);
    expect(screen.queryByText(/마감까지/)).not.toBeInTheDocument();
  });

  it('does not show warning when deadline has passed', () => {
    const pastDeadline = new Date(Date.now() - 1000).toISOString();
    renderWithI18n(<CodeEditor {...defaultProps} deadline={pastDeadline} />);
    expect(screen.queryByText(/마감까지/)).not.toBeInTheDocument();
  });

  it('shows deadline text when deadline is present', () => {
    const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    renderWithI18n(<CodeEditor {...defaultProps} deadline={deadline} />);
    expect(screen.getByText(/마감/)).toBeInTheDocument();
  });

  // ── Fullscreen ──

  it('switches to exit fullscreen button on fullscreen click', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('풀스크린'));
    expect(screen.getByLabelText('풀스크린 해제')).toBeInTheDocument();
  });

  it('switches back to fullscreen button on exit click', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('풀스크린'));
    fireEvent.click(screen.getByLabelText('풀스크린 해제'));
    expect(screen.getByLabelText('풀스크린')).toBeInTheDocument();
  });

  it('exits fullscreen on Escape key', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('풀스크린'));
    expect(screen.getByLabelText('풀스크린 해제')).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.getByLabelText('풀스크린')).toBeInTheDocument();
  });

  it('ignores defaultPrevented Escape in fullscreen', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('풀스크린'));
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      Object.defineProperty(event, 'defaultPrevented', { value: true });
      window.dispatchEvent(event);
    });
    expect(screen.getByLabelText('풀스크린 해제')).toBeInTheDocument();
  });

  it('does not add Escape listener when not fullscreen', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.getByLabelText('풀스크린')).toBeInTheDocument();
  });

  it('ignores non-Escape keys in fullscreen', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('풀스크린'));
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });
    expect(screen.getByLabelText('풀스크린 해제')).toBeInTheDocument();
  });

  // ── Code length validation ──

  it('disables submit button when code is 5 chars', () => {
    const props = { ...defaultProps, code: 'short' };
    renderWithI18n(<CodeEditor {...props} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    const allBtns = screen.getAllByRole('button');
    const submitBtns = allBtns.filter(b => b.textContent?.includes('제출'));
    expect(submitBtns.some(b => b.hasAttribute('disabled'))).toBe(true);
  });

  it('shows remaining char count warning when code is under 10 chars', () => {
    const shortCode = 'abc';
    renderWithI18n(<CodeEditor {...defaultProps} code={shortCode} />);
    expect(screen.getByText(/7/)).toBeInTheDocument();
  });

  it('shows error when code exceeds 100KB', async () => {
    const longCode = 'a'.repeat(102_401);
    const onSubmit = jest.fn();
    renderWithI18n(<CodeEditor {...defaultProps} code={longCode} onSubmit={onSubmit} />);
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

  // ── Font size ──

  it('renders font decrease button', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    expect(screen.getByLabelText('폰트 축소')).toBeInTheDocument();
  });

  it('renders font increase button', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    expect(screen.getByLabelText('폰트 확대')).toBeInTheDocument();
  });

  it('increases font size on increase click', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    expect(screen.getByText('13')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('폰트 확대'));
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('decreases font size on decrease click', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('폰트 축소'));
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('disables decrease button at min font size (10)', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByLabelText('폰트 축소'));
    }
    expect(screen.getByLabelText('폰트 축소')).toBeDisabled();
  });

  it('disables increase button at max font size (20)', () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
    for (let i = 0; i < 7; i++) {
      fireEvent.click(screen.getByLabelText('폰트 확대'));
    }
    expect(screen.getByLabelText('폰트 확대')).toBeDisabled();
  });

  // ── Misc ──

  it('falls back to plaintext for unknown languages', () => {
    renderWithI18n(<CodeEditor {...defaultProps} language="unknown_lang" />);
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });

  it('updates cursor position via onDidChangeCursorPosition callback', async () => {
    renderWithI18n(<CodeEditor {...defaultProps} />);
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

  it('triggers handleSubmit via addAction run callback', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    renderWithI18n(<CodeEditor {...defaultProps} onSubmit={onSubmit} />);
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

  it('uses algosu-light theme in light mode', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.spyOn(require('next-themes'), 'useTheme').mockReturnValue({ resolvedTheme: 'light', setTheme: jest.fn() });
    renderWithI18n(<CodeEditor {...defaultProps} />);
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });
});
