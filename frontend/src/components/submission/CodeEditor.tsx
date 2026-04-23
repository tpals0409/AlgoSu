/**
 * @file Monaco-based code editor component
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
import { useTranslations, useLocale } from 'next-intl';
import type { BeforeMount, OnMount } from '@monaco-editor/react';
import { Send, RotateCcw, Minus, Plus, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { LANGUAGES } from '@/lib/constants';

// ─── SSR-safe dynamic import (bundle optimization) ──

/** Loading fallback for Monaco editor (uses i18n provider) */
function EditorLoadingFallback(): ReactNode {
  const t = useTranslations('submissions');
  return (
    <div className="flex h-[520px] w-full items-center justify-center rounded-md border border-border bg-bg-card">
      <span className="text-sm text-text-2">{t('editor.loading')}</span>
    </div>
  );
}

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <EditorLoadingFallback />,
});

// ─── Monaco language ID mapping ────────────────

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
  /** Sprint 108: use Monaco built-in SQL mode */
  sql: 'sql',
};

// ─── Custom themes (design system v2 integration) ──

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
  /** Monaco editor height (default "520px") */
  editorHeight?: string;
  isLate?: boolean;
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
  isLate,
}: CodeEditorProps): ReactNode {
  const { resolvedTheme } = useTheme();
  const t = useTranslations('submissions');
  const locale = useLocale();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(13);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [fullscreen, setFullscreen] = useState(false);
  const [deadlineWarning, setDeadlineWarning] = useState<
    'imminent' | 'approaching' | null
  >(null);

  // ─── Submit confirm dialog state ─────────────────
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);

  // ─── Escape to close modal/fullscreen ──────────
  useEffect(() => {
    if (!fullscreen && !showSubmitConfirm && !pendingLanguage) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.defaultPrevented) return;
      // Close modal first if open
      if (showSubmitConfirm) { setShowSubmitConfirm(false); return; }
      if (pendingLanguage) { setPendingLanguage(null); return; }
      setFullscreen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen, showSubmitConfirm, pendingLanguage]);

  // ─── Deadline warning timer ────────────
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

  // ─── Apply font size ─────────────────
  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize });
  }, [fontSize]);

  // ─── Fullscreen minimap + layout ──
  useEffect(() => {
    editorRef.current?.updateOptions({ minimap: { enabled: fullscreen } });
    editorRef.current?.layout();
  }, [fullscreen]);

  // ─── Language change (confirm if code exists) ─
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

  // ─── Reset (blank state) ────────────────
  const handleReset = useCallback(() => {
    onCodeChange('');
    editorRef.current?.focus();
  }, [onCodeChange]);

  // ─── Monaco callbacks ─────────────────────
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    defineThemes(monaco);
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      onCodeChange(value ?? '');
    },
    [onCodeChange],
  );

  // ─── Submit handler (with confirm dialog) ─────
  const handleSubmit = useCallback(async (): Promise<void> => {
    setError(null);
    if (code.length < 10) {
      setError(t('editor.error.tooShort'));
      return;
    }
    if (code.length > 102_400) {
      setError(t('editor.error.tooLarge'));
      return;
    }
    setShowSubmitConfirm(true);
  }, [code, t]);

  const confirmSubmit = useCallback(async (): Promise<void> => {
    setShowSubmitConfirm(false);
    try {
      await onSubmit();
    } catch (err: unknown) {
      setError((err as Error).message ?? t('editor.error.submitFailed'));
    }
  }, [onSubmit, t]);

  // ─── Ctrl+Enter shortcut + cursor position ───
  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Ctrl+Enter / Cmd+Enter → Submit
    editor.addAction({
      id: 'algosu-submit',
      label: t('editor.shortcut.submit'),
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      ],
      run: () => { void submitRef.current(); },
    });

    // Cursor position tracking
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monacoTheme = resolvedTheme === 'dark' ? 'algosu-dark' : 'algosu-light';

  return (
    <div className={fullscreen ? 'fixed inset-0 z-[100] flex flex-col bg-bg-card' : 'space-y-3'}>
      {/* Deadline imminent warning */}
      {deadlineWarning === 'imminent' && (
        <Alert variant="error">
          {t('editor.deadline.imminent')}
        </Alert>
      )}
      {deadlineWarning === 'approaching' && (
        <Alert variant="warning">
          {t('editor.deadline.approaching')}
        </Alert>
      )}

      {/* Submit confirm modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setShowSubmitConfirm(false)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">{isLate ? t('editor.submitConfirm.lateTitle') : t('editor.submitConfirm.title')}</p>
            <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>{isLate ? t('editor.submitConfirm.lateDescription') : t('editor.submitConfirm.description')}</p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt"
                style={{ color: 'var(--text-2)' }}
              >
                {t('editor.submitConfirm.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void confirmSubmit()}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity"
                style={{ backgroundColor: isLate ? 'var(--warning)' : 'var(--primary)' }}
              >
                {isLate ? t('editor.submitConfirm.lateSubmit') : t('editor.submitConfirm.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Language change confirm modal */}
      {pendingLanguage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setPendingLanguage(null)} />
          <div className="relative rounded-xl border border-border bg-bg-card p-5 shadow-lg w-[340px] space-y-4">
            <p className="text-[14px] font-semibold text-text">{t('editor.langChange.title')}</p>
            <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>{t('editor.langChange.description')}</p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingLanguage(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors hover:bg-bg-alt"
                style={{ color: 'var(--text-2)' }}
              >
                {t('editor.langChange.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmLanguageChange}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-opacity"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {t('editor.langChange.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor card */}
      <div className={fullscreen
        ? 'flex flex-1 flex-col overflow-hidden'
        : 'overflow-hidden rounded-card border border-border bg-bg-card shadow'
      }>
        {/* ── Editor header ── */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language selector */}
            <label htmlFor="language" className="sr-only">{t('editor.label.language')}</label>
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

            {/* Font size controls — desktop only */}
            <div className="hidden sm:flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.max(10, s - 1))}
                className="flex items-center justify-center w-5 h-5 rounded text-text-3 transition-colors hover:text-text hover:bg-bg-alt disabled:opacity-40"
                aria-label={t('editor.label.fontDecrease')}
                disabled={fontSize <= 10}
              >
                <Minus className="h-2.5 w-2.5" aria-hidden />
              </button>
              <span className="text-[10px] text-text-3 tabular-nums w-5 text-center">{fontSize}</span>
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.min(20, s + 1))}
                className="flex items-center justify-center w-5 h-5 rounded text-text-3 transition-colors hover:text-text hover:bg-bg-alt disabled:opacity-40"
                aria-label={t('editor.label.fontIncrease')}
                disabled={fontSize >= 20}
              >
                <Plus className="h-2.5 w-2.5" aria-hidden />
              </button>
            </div>

            {/* Reset */}
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting}
              className="flex items-center gap-1 text-[11px] text-text-3 transition-colors hover:text-text disabled:opacity-40"
              aria-label={t('editor.label.reset')}
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              <span className="hidden sm:inline">{t('editor.label.resetShort')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Deadline display — desktop only */}
            {deadline && (
              <span className="hidden sm:inline text-[11px] text-text-3">
                {t('editor.deadline.label')}: {new Date(deadline).toLocaleString(locale)}
              </span>
            )}
            {/* Fullscreen toggle */}
            <button
              type="button"
              onClick={() => setFullscreen((f) => !f)}
              className="flex items-center justify-center w-6 h-6 rounded text-text-3 transition-colors hover:text-text hover:bg-bg-alt"
              title={fullscreen ? t('editor.fullscreen.exitTitle') : t('editor.fullscreen.enter')}
              aria-label={fullscreen ? t('editor.fullscreen.exit') : t('editor.fullscreen.enter')}
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

        {/* ── Editor footer (submit bar) ── */}
        <div className="flex items-center justify-between border-t border-border px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3 font-mono text-[10px] sm:text-[11px] text-text-3">
            <span>
              {cursorPos.line}:{cursorPos.col}
            </span>
            <span>
              {code.length}<span className="hidden sm:inline">{t('editor.footer.charUnit')}</span>
              {!isSubmitting && code.length > 0 && code.length < 10 && (
                <span className="ml-1 text-warning">({t('editor.footer.charsNeeded', { count: 10 - code.length })})</span>
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
                  <span className="hidden sm:inline">{t('editor.footer.submitting')}</span>
                  <span className="sm:hidden">{t('editor.footer.submittingShort')}</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden sm:inline">{isLate ? t('editor.footer.lateSubmit') : t('editor.footer.submit')}</span>
                  <span className="sm:hidden">{isLate ? t('editor.footer.lateSubmitShort') : t('editor.footer.submitShort')}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </div>
  );
}
