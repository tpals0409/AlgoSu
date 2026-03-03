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
import { Check, Send, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';
import { LANGUAGES } from '@/lib/constants';

// ─── SSR-safe dynamic import (번들 최적화) ──

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] w-full items-center justify-center rounded-md border border-border bg-bg-card">
      <span className="text-sm text-text-2">에디터 로딩 중...</span>
    </div>
  ),
});

// ─── BOJ 언어별 템플릿 ─────────────────

const BOJ_TEMPLATES: Record<string, string> = {
  python: [
    'import sys',
    'input = sys.stdin.readline',
    '',
    '',
  ].join('\n'),

  javascript: [
    "const readline = require('readline');",
    'const rl = readline.createInterface({',
    '  input: process.stdin,',
    '  output: process.stdout,',
    '});',
    '',
    'const lines = [];',
    "rl.on('line', (line) => lines.push(line));",
    "rl.on('close', () => {",
    '  ',
    '});',
  ].join('\n'),

  typescript: [
    "const readline = require('readline');",
    'const rl = readline.createInterface({',
    '  input: process.stdin,',
    '  output: process.stdout,',
    '});',
    '',
    'const lines: string[] = [];',
    "rl.on('line', (line: string) => lines.push(line));",
    "rl.on('close', () => {",
    '  ',
    '});',
  ].join('\n'),

  java: [
    'import java.io.*;',
    'import java.util.*;',
    '',
    'public class Main {',
    '    public static void main(String[] args) throws IOException {',
    '        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));',
    '        ',
    '    }',
    '}',
  ].join('\n'),

  cpp: [
    '#include <iostream>',
    '#include <vector>',
    '#include <algorithm>',
    'using namespace std;',
    '',
    'int main() {',
    '    ios::sync_with_stdio(false);',
    '    cin.tie(nullptr);',
    '    ',
    '    return 0;',
    '}',
  ].join('\n'),

  c: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    ',
    '    return 0;',
    '}',
  ].join('\n'),

  go: [
    'package main',
    '',
    'import (',
    '\t"bufio"',
    '\t"fmt"',
    '\t"os"',
    ')',
    '',
    'func main() {',
    '\treader := bufio.NewReader(os.Stdin)',
    '\t_ = reader',
    '\tfmt.Println()',
    '}',
  ].join('\n'),

  kotlin: [
    'import java.io.BufferedReader',
    'import java.io.InputStreamReader',
    '',
    'fun main() {',
    '    val br = BufferedReader(InputStreamReader(System.`in`))',
    '    ',
    '}',
  ].join('\n'),

  rust: [
    'use std::io::{self, BufRead};',
    '',
    'fn main() {',
    '    let stdin = io::stdin();',
    '    for line in stdin.lock().lines() {',
    '        let line = line.unwrap();',
    '        ',
    '    }',
    '}',
  ].join('\n'),
};

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

// ─── 언어별 자동완성 키워드 ────────────────

type MonacoInstance = Parameters<BeforeMount>[0];

const LANG_COMPLETIONS: Record<string, { keywords: string[]; builtins: string[]; snippets: { label: string; insert: string; doc: string }[] }> = {
  python: {
    keywords: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'return', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'yield', 'lambda', 'pass', 'global', 'nonlocal', 'assert', 'del', 'in', 'not', 'and', 'or', 'is', 'True', 'False', 'None'],
    builtins: ['print', 'input', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed', 'list', 'dict', 'set', 'tuple', 'int', 'float', 'str', 'bool', 'abs', 'max', 'min', 'sum', 'any', 'all', 'isinstance', 'type', 'open', 'super', 'property', 'staticmethod', 'classmethod'],
    snippets: [
      { label: 'sys.stdin', insert: 'import sys\ninput = sys.stdin.readline', doc: 'Fast input (BOJ)' },
      { label: 'defaultdict', insert: 'from collections import defaultdict', doc: 'Import defaultdict' },
      { label: 'deque', insert: 'from collections import deque', doc: 'Import deque' },
      { label: 'heapq', insert: 'import heapq', doc: 'Import heapq' },
      { label: 'bisect', insert: 'import bisect', doc: 'Import bisect' },
    ],
  },
  java: {
    keywords: ['public', 'private', 'protected', 'static', 'final', 'abstract', 'class', 'interface', 'extends', 'implements', 'new', 'this', 'super', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'void', 'int', 'long', 'double', 'float', 'char', 'boolean', 'String', 'null', 'true', 'false'],
    builtins: ['System.out.println', 'System.out.print', 'Integer.parseInt', 'Long.parseLong', 'Math.max', 'Math.min', 'Math.abs', 'Arrays.sort', 'Arrays.fill', 'Collections.sort', 'Collections.reverse', 'StringBuilder', 'BufferedReader', 'InputStreamReader', 'StringTokenizer', 'ArrayList', 'HashMap', 'HashSet', 'LinkedList', 'PriorityQueue', 'TreeMap', 'TreeSet', 'Stack', 'Queue'],
    snippets: [
      { label: 'BufferedReader', insert: 'BufferedReader br = new BufferedReader(new InputStreamReader(System.in));', doc: 'Fast input (BOJ)' },
      { label: 'StringTokenizer', insert: 'StringTokenizer st = new StringTokenizer(br.readLine());', doc: 'Token parser' },
    ],
  },
  cpp: {
    keywords: ['int', 'long', 'double', 'float', 'char', 'bool', 'void', 'string', 'auto', 'const', 'static', 'struct', 'class', 'public', 'private', 'protected', 'virtual', 'override', 'template', 'typename', 'namespace', 'using', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'throw', 'new', 'delete', 'nullptr', 'true', 'false', 'include', 'define', 'typedef', 'sizeof'],
    builtins: ['cout', 'cin', 'endl', 'vector', 'map', 'unordered_map', 'set', 'unordered_set', 'queue', 'priority_queue', 'stack', 'deque', 'pair', 'tuple', 'sort', 'reverse', 'lower_bound', 'upper_bound', 'min', 'max', 'abs', 'swap', 'fill', 'accumulate', 'push_back', 'pop_back', 'emplace_back', 'begin', 'end', 'size', 'empty', 'front', 'back'],
    snippets: [
      { label: 'fast_io', insert: 'ios::sync_with_stdio(false);\ncin.tie(nullptr);', doc: 'Fast I/O (BOJ)' },
      { label: '#include bits', insert: '#include <bits/stdc++.h>', doc: 'All-in-one header' },
    ],
  },
  javascript: {
    keywords: ['const', 'let', 'var', 'function', 'class', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'typeof', 'instanceof', 'import', 'export', 'default', 'async', 'await', 'yield', 'of', 'in', 'true', 'false', 'null', 'undefined'],
    builtins: ['console.log', 'parseInt', 'parseFloat', 'Math.max', 'Math.min', 'Math.abs', 'Math.floor', 'Math.ceil', 'Array.from', 'Array.isArray', 'Object.keys', 'Object.values', 'Object.entries', 'JSON.parse', 'JSON.stringify', 'Map', 'Set', 'Promise', 'setTimeout'],
    snippets: [
      { label: 'readline', insert: "const readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin, output: process.stdout });", doc: 'Node.js input (BOJ)' },
    ],
  },
  go: {
    keywords: ['package', 'import', 'func', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'select', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'break', 'continue', 'return', 'defer', 'fallthrough', 'nil', 'true', 'false', 'int', 'int64', 'float64', 'string', 'bool', 'byte', 'rune', 'error'],
    builtins: ['fmt.Println', 'fmt.Printf', 'fmt.Scanf', 'fmt.Sprintf', 'len', 'cap', 'append', 'make', 'new', 'copy', 'delete', 'close', 'panic', 'recover', 'sort.Ints', 'sort.Strings', 'strconv.Atoi', 'strconv.Itoa', 'strings.Split', 'strings.Join', 'bufio.NewReader', 'bufio.NewScanner'],
    snippets: [],
  },
  kotlin: {
    keywords: ['fun', 'val', 'var', 'class', 'object', 'interface', 'if', 'else', 'when', 'for', 'while', 'do', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'import', 'package', 'is', 'as', 'in', 'null', 'true', 'false', 'this', 'super', 'data', 'sealed', 'companion', 'override', 'abstract', 'open', 'private', 'public', 'internal', 'protected', 'lateinit', 'lazy'],
    builtins: ['println', 'readLine', 'readln', 'toInt', 'toLong', 'toDouble', 'split', 'map', 'filter', 'sorted', 'reversed', 'forEach', 'joinToString', 'maxOrNull', 'minOrNull', 'sumOf', 'groupBy', 'associate', 'arrayOf', 'listOf', 'mutableListOf', 'mapOf', 'mutableMapOf', 'setOf', 'mutableSetOf', 'BufferedReader', 'InputStreamReader', 'StringTokenizer'],
    snippets: [],
  },
  rust: {
    keywords: ['fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'impl', 'trait', 'type', 'use', 'mod', 'pub', 'crate', 'self', 'super', 'if', 'else', 'for', 'while', 'loop', 'match', 'break', 'continue', 'return', 'as', 'in', 'ref', 'move', 'async', 'await', 'unsafe', 'where', 'true', 'false', 'i32', 'i64', 'u32', 'u64', 'usize', 'f64', 'String', 'Vec', 'Option', 'Result', 'Some', 'None', 'Ok', 'Err'],
    builtins: ['println!', 'print!', 'format!', 'vec!', 'unwrap', 'expect', 'parse', 'push', 'pop', 'len', 'iter', 'map', 'filter', 'collect', 'sort', 'sort_by', 'reverse', 'contains', 'insert', 'remove', 'split_whitespace', 'trim', 'lines', 'read_line', 'stdin', 'HashMap', 'HashSet', 'BTreeMap', 'BTreeSet', 'VecDeque', 'BinaryHeap'],
    snippets: [],
  },
  c: {
    keywords: ['int', 'long', 'double', 'float', 'char', 'void', 'unsigned', 'signed', 'const', 'static', 'struct', 'union', 'enum', 'typedef', 'sizeof', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'NULL', 'include', 'define'],
    builtins: ['printf', 'scanf', 'puts', 'gets', 'getchar', 'putchar', 'malloc', 'calloc', 'realloc', 'free', 'memset', 'memcpy', 'strlen', 'strcmp', 'strcpy', 'strcat', 'atoi', 'atol', 'strtol', 'qsort', 'bsearch', 'abs', 'EXIT_SUCCESS', 'EXIT_FAILURE'],
    snippets: [],
  },
};

function registerCompletionProviders(monaco: MonacoInstance): void {
  const CompletionItemKind = monaco.languages.CompletionItemKind;
  const CompletionItemInsertTextRule = monaco.languages.CompletionItemInsertTextRule;

  for (const [langKey, data] of Object.entries(LANG_COMPLETIONS)) {
    const monacoLang = MONACO_LANG_MAP[langKey];
    if (!monacoLang) continue;

    monaco.languages.registerCompletionItemProvider(monacoLang, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provideCompletionItems(model: any, position: any) {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions = [
          ...data.keywords.map((kw) => ({
            label: kw,
            kind: CompletionItemKind.Keyword,
            insertText: kw,
            range,
          })),
          ...data.builtins.map((fn) => ({
            label: fn,
            kind: CompletionItemKind.Function,
            insertText: fn,
            range,
          })),
          ...data.snippets.map((s) => ({
            label: s.label,
            kind: CompletionItemKind.Snippet,
            insertText: s.insert,
            insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: s.doc,
            range,
          })),
        ];

        return { suggestions };
      },
    });
  }
}

// ─── 커스텀 테마 (디자인 시스템 v2 연동) ──

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
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autocomplete, setAutocomplete] = useState(true);
  const [deadlineWarning, setDeadlineWarning] = useState<
    'imminent' | 'approaching' | null
  >(null);

  // ─── 초기 템플릿 삽입 (드래프트 없이 빈 코드로 마운트 시) ─
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    if (!code.trim() && BOJ_TEMPLATES[language]) {
      onCodeChange(BOJ_TEMPLATES[language]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ─── 자동완성 토글 반영 ───────────────
  useEffect(() => {
    editorRef.current?.updateOptions({
      quickSuggestions: autocomplete,
      suggestOnTriggerCharacters: autocomplete,
      wordBasedSuggestions: autocomplete ? 'currentDocument' : 'off',
    });
  }, [autocomplete]);

  // ─── 언어 변경 (템플릿 코드면 자동 교체) ─
  const handleLanguageChange = useCallback(
    (newLang: string) => {
      onLanguageChange(newLang);
      const trimmed = code.trim();
      const isTemplateCode =
        !trimmed ||
        Object.values(BOJ_TEMPLATES).some((t) => t.trim() === trimmed);
      if (isTemplateCode && BOJ_TEMPLATES[newLang]) {
        onCodeChange(BOJ_TEMPLATES[newLang]);
      }
    },
    [code, onCodeChange, onLanguageChange],
  );

  // ─── 초기화 (현재 언어 템플릿으로 되돌리기) ─
  const handleReset = useCallback(() => {
    const template = BOJ_TEMPLATES[language] ?? '';
    onCodeChange(template);
    editorRef.current?.focus();
  }, [language, onCodeChange]);

  // ─── Monaco 콜백 ─────────────────────
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    defineThemes(monaco);
    registerCompletionProviders(monaco);
  }, []);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      onCodeChange(value ?? '');
    },
    [onCodeChange],
  );

  // ─── 제출 핸들러 ─────────────────────
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
    try {
      await onSubmit();
    } catch (err: unknown) {
      setError((err as Error).message ?? '제출 중 오류가 발생했습니다.');
    }
  }, [code, deadline, onSubmit]);

  const monacoTheme = resolvedTheme === 'dark' ? 'algosu-dark' : 'algosu-light';

  return (
    <div className="space-y-3">
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

      {/* 에디터 카드 (목업 레이아웃: header → editor → footer) */}
      <div className="overflow-hidden rounded-card border border-border bg-bg-card shadow">
        {/* ── 에디터 헤더 ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
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

            {/* 자동저장 상태 */}
            {autoSaveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-[11px] text-text-3">
                <InlineSpinner />
                저장 중...
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-[11px] text-success">
                <Check className="h-3 w-3" aria-hidden />
                저장됨
              </span>
            )}

            {/* 자동완성 토글 */}
            <label className="flex items-center gap-1.5 text-[11px] text-text-3 select-none">
              <input
                type="checkbox"
                checked={autocomplete}
                onChange={(e) => setAutocomplete(e.target.checked)}
                className="rounded border-border accent-primary"
              />
              자동완성
            </label>

            {/* 초기화 */}
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting}
              className="flex items-center gap-1 text-[11px] text-text-3 transition-colors hover:text-text disabled:opacity-40"
              title="템플릿으로 초기화"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              초기화
            </button>
          </div>

          {/* 마감 시간 (우측) */}
          {deadline && (
            <span className="text-[11px] text-text-3">
              마감: {new Date(deadline).toLocaleString('ko-KR')}
            </span>
          )}
        </div>

        {/* ── Monaco Editor ── */}
        <MonacoEditor
          height="360px"
          language={MONACO_LANG_MAP[language] ?? 'plaintext'}
          value={code}
          theme={monacoTheme}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={handleChange}
          options={{
            fontSize: 13,
            fontFamily:
              "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            lineHeight: 22,
            padding: { top: 14, bottom: 14 },
            quickSuggestions: autocomplete,
            suggestOnTriggerCharacters: autocomplete,
            wordBasedSuggestions: autocomplete ? 'currentDocument' : 'off',
            readOnly: isSubmitting,
          }}
        />

        {/* ── 에디터 푸터 (제출 바) ── */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <span className="font-mono text-[11px] text-text-3">
            {code.length}자
            {!isSubmitting && code.length > 0 && code.length < 10 && (
              <span className="ml-2 text-warning">({10 - code.length}자 더 필요)</span>
            )}
          </span>
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
              <>
                <Send className="h-3.5 w-3.5" aria-hidden />
                제출하기
              </>
            )}
          </Button>
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
