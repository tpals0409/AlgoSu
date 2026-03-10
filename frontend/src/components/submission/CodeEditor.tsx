/**
 * @file Monaco 기반 코드 에디터 컴포넌트
 * @domain submission
 * @layer component
 * @related useAutoSave, SubmissionStatus
 */
'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import type { BeforeMount, OnMount } from '@monaco-editor/react';
import { Send, RotateCcw, Minus, Plus, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { LANGUAGES } from '@/lib/constants';

// ─── SSR-safe dynamic import (번들 최적화) ──

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] w-full items-center justify-center rounded-md border border-border bg-bg-card">
      <span className="text-sm text-text-2">에디터 로딩 중...</span>
    </div>
  ),
});

// ─── Monaco 언어 ID 매핑 ────────────────

const MONACO_LANG_MAP: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  go: 'go',
  rust: 'rust',
  kotlin: 'kotlin',
};

// ─── 커스텀 테마 (디자인 시스템 v2 연동) ──

type MonacoInstance = Parameters<BeforeMount>[0];

function defineThemes(monaco: MonacoInstance): void {
  monaco.editor.defineTheme('algosu-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#1A1A18',
      'editor.lineHighlightBackground': '#F5F3EF',
      'editorLineNumber.foreground': '#A5A5A0',
      'editorLineNumber.activeForeground': '#1A1A18',
      'editorCursor.foreground': '#7C6AAE',
      'editor.selectionBackground': '#7C6AAE30',
      'editor.inactiveSelectionBackground': '#7C6AAE15',
      'editorIndentGuide.background': '#E5E2DC',
    },
  });

  monaco.editor.defineTheme('algosu-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#1C1C22',
      'editor.foreground': '#EDEDEB',
      'editor.lineHighlightBackground': '#2A2A3240',
      'editorLineNumber.foreground': '#6C6C68',
      'editorLineNumber.activeForeground': '#EDEDEB',
      'editorCursor.foreground': '#A08CD6',
      'editor.selectionBackground': '#A08CD640',
      'editor.inactiveSelectionBackground': '#A08CD620',
      'editorIndentGuide.background': '#2A2A32',
    },
  });
}

// ─── COMPONENT ──────────────────────────

interface CodeEditorProps {
  code: string;
  language: string;
  onCodeChange: (code: string) => void;
  onLanguageChange: (lang: string) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  deadline?: string | null;
  /** Monaco 에디터 높이 (기본 "520px") */
  editorHeight?: string;
}

export function CodeEditor({
  code,
  language,
  onCodeChange,
  onLanguageChange,
  onSubmit,
  isSubmitting,
  deadline,
  editorHeight = '520px',
}: CodeEditorProps): ReactNode {
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(13);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [fullscreen, setFullscreen] = useState(false);
  const [deadlineWarning, setDeadlineWarning] = useState<
    'imminent' | 'approaching' | null
  >(null);

  // ─── 확인 팝업 상태 ─────────────────
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);

  // ─── Escape로 풀스크린 해제 ──────────
  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.defaultPrevented) return;
      setFullscreen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  // ─── 마감 임박 경고 타이머 ────────────
  useEffect(() => {
    if (!deadline) return;
    const check = () => {
      const remaining = new Date(deadline).getTime() - Date.now();
      if (remaining <= 0) setDeadlineWarning(null);
      else if (remaining <= 60_000) setDeadlineWarning('imminent');
      else if (remaining <= 300_000) setDeadlineWarning('approaching');
      else setDeadlineWarning(null);
    };
    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, [deadline]);

  // ─── 폰트 크기 반영 ─────────────────
  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize });
  }, [fontSize]);

  // ─── 풀스크린 시 minimap + layout 반영 ──
  useEffect(() => {
    editorRef.current?.updateOptions({ minimap: { enabled: fullscreen } });
    editorRef.current?.layout();
  }, [fullscreen]);

  // ─── 언어 변경 (코드가 있으면 경고 팝업) ─
  const handleLanguageChange = useCallback(
    (newLang: string) => {
      if (code.trim()) {
        setPendingLanguage(newLang);
      } else {
        onLanguageChange(newLang);
      }
    },
    [code, onLanguageChange],
  );

  const confirmLanguageChange = useCallback(() => {
    if (pendingLanguage) {
      onLanguageChange(pendingLanguage);
      onCodeChange('');
      setPendingLanguage(null);
      editorRef.current?.focus();
    }
  }, [pendingLanguage, onLanguageChange, onCodeChange]);

  // ─── 초기화 (백지상태) ────────────────
  const handleReset = useCallback(() => {
    onCodeChange('');
    editorRef.current?.focus();
  }, [onCodeChange]);

  // ─── Monaco 콜백 ─────────────────────
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    defineThemes(monaco);
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      onCodeChange(value ?? '');
    },
    [onCodeChange],
  );

  // ─── 제출 핸들러 (확인 팝업 포함) ─────
  const handleSubmit = useCallback(async (): Promise<void> => {
    setError(null);
    if (code.length < 10) {
      setError('코드는 최소 10자 이상이어야 합니다.');
      return;
    }
    if (code.length > 102_400) {
      setError('코드는 100KB를 초과할 수 없습니다.');
      return;
    }
    if (deadline && new Date(deadline) < new Date()) {
      setError('마감 시간이 지났습니다.');
      return;
    }
    setShowSubmitConfirm(true);
  }, [code, deadline]);

  const confirmSubmit = useCallback(async (): Promise<void> => {
    setShowSubmitConfirm(false);
    try {
      await onSubmit();
    } catch (err: unknown) {
      setError((err as Error).message ?? '제출 중 오류가 발생했습니다.');
    }
  }, [onSubmit]);

  // ─── Ctrl+Enter 단축키 + 커서 위치 ───
  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Ctrl+Enter / Cmd+Enter → 제출
    editor.addAction({
      id: 'algosu-submit',
      label: '코드 제출 (Ctrl+Enter)',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      ],
      run: () => { void submitRef.current(); },
    });

    // 커서 위치 추적
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });
  }, []);

  const monacoTheme = resolvedTheme === 'dark' ? 'algosu-dark' : 'algosu-light';

  return (
    <div className={fullscreen ? 'fixed inset-0 z-[100] flex flex-col bg-bg-card' : 'space-y-3'}>
      {/* 마감 임박 경고 */}
      {deadlineWarning === 'imminent' && (
        <Alert variant="error">
          마감까지 1분 미만 남았습니다. 지금 바로 제출하세요!
        </Alert>
      )}
      {deadlineWarning === 'approaching' && (
        <Alert variant="warning">
          마감까지 5분 이내입니다. 제출을 서두르세요.
        </Alert>
      )}

      {/* 제출 확인 모달 */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSubmitConfirm(false)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">코드를 제출하시겠습니까?</p>
            <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>제출 후에는 수정할 수 없습니다.</p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt"
                style={{ color: 'var(--text-2)' }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void confirmSubmit()}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                제출
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 언어 변경 확인 모달 */}
      {pendingLanguage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPendingLanguage(null)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">언어를 변경하시겠습니까?</p>
            <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>작성 중인 코드가 삭제됩니다.</p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingLanguage(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt"
                style={{ color: 'var(--text-2)' }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmLanguageChange}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                변경
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 에디터 카드 */}
      <div className={fullscreen
        ? 'flex flex-1 flex-col overflow-hidden'
        : 'overflow-hidden rounded-card border border-border bg-bg-card shadow'
      }>
        {/* ── 에디터 헤더 ── */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 언어 선택 */}
            <label htmlFor="language" className="sr-only">프로그래밍 언어</label>
            <select
              id="language"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="h-[30px] rounded-btn border border-border bg-input-bg px-2 pr-6 text-xs text-text outline-none cursor-pointer focus:border-primary appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%2210%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239C9A95%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_6px_center]"
              disabled={isSubmitting}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>

            {/* 폰트 크기 — 데스크톱만 */}
            <div className="hidden sm:flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.max(10, s - 1))}
                className="flex items-center justify-center w-5 h-5 rounded text-text-3 transition-colors hover:text-text hover:bg-bg-alt disabled:opacity-40"
                aria-label="폰트 축소"
                disabled={fontSize <= 10}
              >
                <Minus className="h-2.5 w-2.5" aria-hidden />
              </button>
              <span className="text-[10px] text-text-3 tabular-nums w-5 text-center">{fontSize}</span>
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.min(20, s + 1))}
                className="flex items-center justify-center w-5 h-5 rounded text-text-3 transition-colors hover:text-text hover:bg-bg-alt disabled:opacity-40"
                aria-label="폰트 확대"
                disabled={fontSize >= 20}
              >
                <Plus className="h-2.5 w-2.5" aria-hidden />
              </button>
            </div>

            {/* 초기화 */}
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting}
              className="flex items-center gap-1 text-[11px] text-text-3 transition-colors hover:text-text disabled:opacity-40"
              aria-label="코드 초기화"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              <span className="hidden sm:inline">초기화</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* 마감 시간 — 데스크톱만 */}
            {deadline && (
              <span className="hidden sm:inline text-[11px] text-text-3">
                마감: {new Date(deadline).toLocaleString('ko-KR')}
              </span>
            )}
            {/* 풀스크린 토글 */}
            <button
              type="button"
              onClick={() => setFullscreen((f) => !f)}
              className="flex items-center justify-center w-6 h-6 rounded text-text-3 transition-colors hover:text-text hover:bg-bg-alt"
              title={fullscreen ? '풀스크린 해제 (Esc)' : '풀스크린'}
              aria-label={fullscreen ? '풀스크린 해제' : '풀스크린'}
            >
              {fullscreen
                ? <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                : <Maximize2 className="h-3.5 w-3.5" aria-hidden />
              }
            </button>
          </div>
        </div>

        {/* ── Monaco Editor ── */}
        <div className={fullscreen ? 'flex-1 min-h-0' : 'max-h-[50vh] sm:max-h-none overflow-hidden'}>
          <MonacoEditor
            height={fullscreen ? '100%' : editorHeight}
            language={MONACO_LANG_MAP[language] ?? 'plaintext'}
            value={code}
            theme={monacoTheme}
            beforeMount={handleBeforeMount}
            onMount={handleMount}
            onChange={handleChange}
            options={{
              fontSize,
              fontFamily:
                "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              minimap: { enabled: fullscreen },
              scrollBeyondLastLine: false,
              tabSize: 4,
              insertSpaces: true,
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              lineHeight: 22,
              padding: { top: 14, bottom: 14 },
              quickSuggestions: false,
              suggestOnTriggerCharacters: false,
              wordBasedSuggestions: 'off',
              readOnly: isSubmitting,
            }}
          />
        </div>

        {/* ── 에디터 푸터 (제출 바) ── */}
        <div className="flex items-center justify-between border-t border-border px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3 font-mono text-[10px] sm:text-[11px] text-text-3">
            <span>
              {cursorPos.line}:{cursorPos.col}
            </span>
            <span>
              {code.length}<span className="hidden sm:inline">자</span>
              {!isSubmitting && code.length > 0 && code.length < 10 && (
                <span className="ml-1 text-warning">({10 - code.length}<span className="hidden sm:inline">자 더 필요</span>)</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[10px] text-text-3">Ctrl+Enter</span>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              disabled={isSubmitting || code.length < 10}
            >
              {isSubmitting ? (
                <>
                  <InlineSpinner />
                  <span className="hidden sm:inline">제출 중...</span>
                  <span className="sm:hidden">제출...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden sm:inline">제출하기</span>
                  <span className="sm:hidden">제출</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </div>
  );
}
