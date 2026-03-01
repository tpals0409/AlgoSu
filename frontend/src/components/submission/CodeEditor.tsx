'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { LANGUAGES } from '@/lib/constants';

interface CodeEditorProps {
  code: string;
  language: string;
  onCodeChange: (code: string) => void;
  onLanguageChange: (lang: string) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  autoSaveStatus?: 'saving' | 'saved' | 'idle';
  deadline?: string | null;
}

export function CodeEditor({
  code,
  language,
  onCodeChange,
  onLanguageChange,
  onSubmit,
  isSubmitting,
  autoSaveStatus = 'idle',
  deadline,
}: CodeEditorProps): ReactNode {
  const [error, setError] = useState<string | null>(null);
  const [deadlineWarning, setDeadlineWarning] = useState<'imminent' | 'approaching' | null>(null);

  // 마감 임박 경고 타이머
  useEffect(() => {
    if (!deadline) return;

    const check = () => {
      const remaining = new Date(deadline).getTime() - Date.now();
      if (remaining <= 0) {
        setDeadlineWarning(null);
      } else if (remaining <= 60_000) {
        setDeadlineWarning('imminent');
      } else if (remaining <= 300_000) {
        setDeadlineWarning('approaching');
      } else {
        setDeadlineWarning(null);
      }
    };

    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, [deadline]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    setError(null);

    if (code.length < 10) {
      setError('코드는 최소 10자 이상이어야 합니다.');
      return;
    }

    if (code.length > 102400) {
      setError('코드는 100KB를 초과할 수 없습니다.');
      return;
    }

    // 마감 시간 검증 (클라이언트 사전 체크)
    if (deadline) {
      const deadlineDate = new Date(deadline);
      if (deadlineDate < new Date()) {
        setError('마감 시간이 지났습니다.');
        return;
      }
    }

    try {
      await onSubmit();
    } catch (err: unknown) {
      setError((err as Error).message ?? '제출 중 오류가 발생했습니다.');
    }
  }, [code, deadline, onSubmit]);

  return (
    <div className="space-y-4">
      {/* 언어 선택 */}
      <div className="flex items-center gap-4">
        <label htmlFor="language" className="text-sm font-medium text-foreground">
          언어
        </label>
        <select
          id="language"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="rounded-m border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-main disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>

        {/* Auto-save 상태 */}
        {autoSaveStatus === 'saving' && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <InlineSpinner />
            저장 중...
          </span>
        )}
        {autoSaveStatus === 'saved' && (
          <span className="ml-auto text-xs text-success">저장됨</span>
        )}
      </div>

      {/* 마감 시간 */}
      {deadline && (
        <div className="text-sm text-warning">
          마감: {new Date(deadline).toLocaleString('ko-KR')}
        </div>
      )}

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

      {/* 코드 에디터 */}
      <textarea
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        placeholder="코드를 입력하세요... (최소 10자)"
        className="h-96 w-full rounded-m border border-border bg-background p-4 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-main disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isSubmitting}
        spellCheck={false}
      />

      {/* 에러 메시지 */}
      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 제출 버튼 */}
      <div className="flex items-center justify-end gap-3">
        {!isSubmitting && code.length < 10 && code.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {10 - code.length}자 더 입력해주세요
          </span>
        )}
        <Button
          variant="primary"
          size="md"
          onClick={handleSubmit}
          disabled={isSubmitting || code.length < 10}
        >
          {isSubmitting ? (
            <>
              <InlineSpinner />
              제출 중...
            </>
          ) : (
            '제출하기'
          )}
        </Button>
      </div>
    </div>
  );
}
