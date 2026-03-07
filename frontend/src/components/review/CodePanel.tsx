/**
 * @file 코드 뷰어 + AI 하이라이트 + 라인 댓글 인디케이터
 * @domain review
 * @layer component
 * @related CommentThread, CategoryBar
 *
 * 줄번호 클릭 시 해당 라인 댓글 폼 열기.
 * AI 분석 카테고리별 색상으로 라인 범위 하이라이트.
 */

'use client';

import { useRef, useEffect, useMemo, type ReactElement } from 'react';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── TYPES ────────────────────────────────

export interface CodeHighlight {
  startLine: number;
  endLine: number;
  type: 'success' | 'warning' | 'error';
  message: string;
}

interface CodePanelProps {
  readonly code: string;
  readonly language: string;
  readonly highlights?: CodeHighlight[];
  readonly commentLines?: number[];
  readonly onLineClick?: (lineNumber: number) => void;
  readonly selectedLine?: number | null;
}

// ─── CONSTANTS ────────────────────────────

const HL_BG: Record<string, string> = {
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  error: 'bg-error-soft',
};

const HL_BORDER: Record<string, string> = {
  success: 'border-l-success',
  warning: 'border-l-warning',
  error: 'border-l-error',
};

// ─── RENDER ───────────────────────────────

/**
 * 코드 뷰어 패널 — 줄번호 + AI 하이라이트 + 댓글 인디케이터
 * @domain review
 */
export function CodePanel({
  code,
  language,
  highlights = [],
  commentLines = [],
  onLineClick,
  selectedLine,
}: CodePanelProps): ReactElement {
  const codeRef = useRef<HTMLDivElement>(null);
  const lines = code.split('\n');

  // 하이라이트 맵 메모이제이션 — O(lines) 탐색을 O(1) 룩업으로 최적화
  const highlightMap = useMemo(() => {
    const map = new Map<number, CodeHighlight>();
    for (const h of highlights) {
      for (let line = h.startLine; line <= h.endLine; line++) {
        map.set(line, h);
      }
    }
    return map;
  }, [highlights]);

  // 선택된 라인으로 자동 스크롤
  useEffect(() => {
    if (selectedLine === null || selectedLine === undefined) return;
    const el = /* istanbul ignore next -- ref always attached when effect runs */ codeRef.current?.querySelector(
      `[data-line="${selectedLine}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedLine]);

  return (
    <div className="overflow-hidden rounded-card border border-border bg-bg-card shadow-card">
      {/* 파일 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="font-mono text-xs font-medium text-text-2">
          solution.{language.toLowerCase()}
        </span>
        <span className="text-[10px] text-text-3">
          {lines.length}줄
        </span>
      </div>

      {/* 코드 영역 */}
      <div ref={codeRef} className="overflow-auto bg-code-bg">
        {lines.map((line, idx) => {
          const lineNum = idx + 1;
          const isSelected = selectedLine === lineNum;
          const hl = highlightMap.get(lineNum);
          const hasComment = commentLines.includes(lineNum);

          return (
            <div
              key={lineNum}
              data-line={lineNum}
              onClick={() => onLineClick?.(lineNum)}
              role="button"
              tabIndex={-1}
              aria-label={`Line ${lineNum}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onLineClick?.(lineNum);
                }
              }}
              className={cn(
                'flex cursor-pointer border-l-[3px] transition-colors duration-100',
                isSelected
                  ? 'border-l-primary bg-primary-soft'
                  : hl
                    ? cn(HL_BG[hl.type], HL_BORDER[hl.type])
                    : hasComment
                      ? 'border-l-primary'
                      : 'border-l-transparent',
                !isSelected && !hl && 'hover:bg-primary-soft',
              )}
            >
              {/* 줄번호 */}
              <span
                className={cn(
                  'w-10 min-w-[40px] select-none pr-2 text-right font-mono text-xs leading-[26px]',
                  isSelected
                    ? 'font-semibold text-primary opacity-90'
                    : 'text-text-3 opacity-40',
                )}
              >
                {lineNum}
              </span>

              {/* 코드 라인 */}
              <pre className={cn(
                'flex-1 px-2.5 font-mono text-[13px] leading-[26px]',
                isSelected ? 'text-text' : 'text-text-2',
              )}>
                {line || ' '}
              </pre>

              {/* 댓글 인디케이터 */}
              <div className="flex items-center gap-1 px-2">
                {hasComment && (
                  <MessageSquare
                    className="h-3 w-3 text-primary"
                    aria-label="댓글 있음"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
