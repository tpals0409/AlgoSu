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
import { Check, Send, RotateCcw, Minus, Plus, Maximize2, Minimize2 } from 'lucide-react';
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

// ─── BOJ 전용 스니펫 (Monaco 내장 자동완성과 충돌 방지) ──

type MonacoInstance = Parameters<BeforeMount>[0];

// builtins/keywords 전부 제거 — Monaco 내장 자동완성이 변수명·키워드를 처리
// BOJ 알고리즘 문제풀이 전용 스니펫만 등록
const BOJ_SNIPPETS: Record<string, { label: string; insert: string; doc: string }[]> = {
  python: [
    // ─ 입출력
    { label: '⚡ sys.stdin (빠른 입력)', insert: 'import sys\ninput = sys.stdin.readline\n', doc: 'BOJ 빠른 입력' },
    { label: '⚡ 여러 줄 입력', insert: 'import sys\ninput = sys.stdin.readline\nn = int(input())\nfor _ in range(n):\n    ', doc: 'N줄 반복 입력' },
    { label: '⚡ 공백 분리 입력', insert: 'a, b = map(int, input().split())\n', doc: '공백으로 분리된 정수 입력' },
    { label: '⚡ 리스트 입력', insert: 'arr = list(map(int, input().split()))\n', doc: '정수 리스트 입력' },
    // ─ collections
    { label: '📦 defaultdict', insert: 'from collections import defaultdict\n', doc: 'Import defaultdict' },
    { label: '📦 Counter', insert: 'from collections import Counter\n', doc: 'Import Counter' },
    { label: '📦 deque', insert: 'from collections import deque\n', doc: 'Import deque' },
    // ─ 알고리즘 라이브러리
    { label: '📦 heapq', insert: 'from heapq import heappush, heappop\n', doc: 'heappush, heappop' },
    { label: '📦 bisect', insert: 'from bisect import bisect_left, bisect_right\n', doc: '이분탐색' },
    { label: '📦 itertools', insert: 'from itertools import permutations, combinations\n', doc: '순열/조합' },
    { label: '📦 lru_cache', insert: 'from functools import lru_cache\n', doc: '메모이제이션 데코레이터' },
    { label: '📦 math', insert: 'import math\n', doc: 'math 모듈' },
    // ─ 알고리즘 템플릿
    { label: '🔍 BFS 템플릿', insert: [
      'from collections import deque',
      '',
      'def bfs(start):',
      '    visited = set([start])',
      '    queue = deque([start])',
      '    while queue:',
      '        node = queue.popleft()',
      '        for next_node in graph[node]:',
      '            if next_node not in visited:',
      '                visited.add(next_node)',
      '                queue.append(next_node)',
      '',
    ].join('\n'), doc: 'BFS 너비우선탐색' },
    { label: '🔍 DFS 템플릿', insert: [
      'def dfs(node, visited):',
      '    visited.add(node)',
      '    for next_node in graph[node]:',
      '        if next_node not in visited:',
      '            dfs(next_node, visited)',
      '',
    ].join('\n'), doc: 'DFS 깊이우선탐색 (재귀)' },
    { label: '🔍 이분탐색', insert: [
      'def binary_search(arr, target):',
      '    lo, hi = 0, len(arr) - 1',
      '    while lo <= hi:',
      '        mid = (lo + hi) // 2',
      '        if arr[mid] == target:',
      '            return mid',
      '        elif arr[mid] < target:',
      '            lo = mid + 1',
      '        else:',
      '            hi = mid - 1',
      '    return -1',
      '',
    ].join('\n'), doc: '이분탐색 (기본)' },
    { label: '🔍 Union-Find', insert: [
      'parent = list(range(n + 1))',
      '',
      'def find(x):',
      '    if parent[x] != x:',
      '        parent[x] = find(parent[x])',
      '    return parent[x]',
      '',
      'def union(a, b):',
      '    a, b = find(a), find(b)',
      '    if a != b:',
      '        parent[b] = a',
      '',
    ].join('\n'), doc: 'Union-Find (경로 압축)' },
    { label: '🔍 다익스트라', insert: [
      'import heapq',
      '',
      'def dijkstra(start):',
      '    dist = [float("inf")] * (n + 1)',
      '    dist[start] = 0',
      '    heap = [(0, start)]',
      '    while heap:',
      '        cost, node = heapq.heappop(heap)',
      '        if cost > dist[node]:',
      '            continue',
      '        for next_node, weight in graph[node]:',
      '            new_cost = cost + weight',
      '            if new_cost < dist[next_node]:',
      '                dist[next_node] = new_cost',
      '                heapq.heappush(heap, (new_cost, next_node))',
      '    return dist',
      '',
    ].join('\n'), doc: '다익스트라 최단경로' },
  ],
  java: [
    { label: '⚡ BufferedReader (빠른 입력)', insert: 'BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n', doc: 'BOJ 빠른 입력' },
    { label: '⚡ StringTokenizer', insert: 'StringTokenizer st = new StringTokenizer(br.readLine());\n', doc: '토큰 파서' },
    { label: '⚡ StringBuilder', insert: 'StringBuilder sb = new StringBuilder();\n', doc: '빠른 문자열 연결' },
    { label: '⚡ N줄 입력 루프', insert: [
      'int n = Integer.parseInt(br.readLine());',
      'for (int i = 0; i < n; i++) {',
      '    StringTokenizer st = new StringTokenizer(br.readLine());',
      '    ',
      '}',
    ].join('\n'), doc: 'N줄 반복 입력' },
    { label: '🔍 BFS 템플릿', insert: [
      'Queue<Integer> queue = new LinkedList<>();',
      'boolean[] visited = new boolean[n + 1];',
      'queue.add(start);',
      'visited[start] = true;',
      'while (!queue.isEmpty()) {',
      '    int node = queue.poll();',
      '    for (int next : graph[node]) {',
      '        if (!visited[next]) {',
      '            visited[next] = true;',
      '            queue.add(next);',
      '        }',
      '    }',
      '}',
    ].join('\n'), doc: 'BFS 너비우선탐색' },
  ],
  cpp: [
    { label: '⚡ fast_io', insert: 'ios::sync_with_stdio(false);\ncin.tie(nullptr);\n', doc: 'BOJ 빠른 I/O' },
    { label: '⚡ bits/stdc++.h', insert: '#include <bits/stdc++.h>\n', doc: '올인원 헤더' },
    { label: '⚡ 매크로 셋', insert: [
      '#define ll long long',
      '#define pii pair<int,int>',
      '#define vi vector<int>',
      '#define all(x) (x).begin(),(x).end()',
      '',
    ].join('\n'), doc: 'CP 매크로 모음' },
    { label: '🔍 BFS 템플릿', insert: [
      'queue<int> q;',
      'vector<bool> visited(n + 1, false);',
      'q.push(start);',
      'visited[start] = true;',
      'while (!q.empty()) {',
      '    int node = q.front(); q.pop();',
      '    for (int next : graph[node]) {',
      '        if (!visited[next]) {',
      '            visited[next] = true;',
      '            q.push(next);',
      '        }',
      '    }',
      '}',
    ].join('\n'), doc: 'BFS 너비우선탐색' },
    { label: '🔍 Union-Find', insert: [
      'int parent[MAX];',
      'int find(int x) { return parent[x] == x ? x : parent[x] = find(parent[x]); }',
      'void unite(int a, int b) { parent[find(a)] = find(b); }',
      '',
    ].join('\n'), doc: 'Union-Find (경로 압축)' },
  ],
  javascript: [
    { label: '⚡ readline (Node.js 입력)', insert: [
      "const readline = require('readline');",
      'const rl = readline.createInterface({ input: process.stdin, output: process.stdout });',
      'const lines = [];',
      "rl.on('line', (line) => lines.push(line));",
      "rl.on('close', () => {",
      '  ',
      '});',
    ].join('\n'), doc: 'Node.js BOJ 입력' },
  ],
  typescript: [
    { label: '⚡ readline (Node.js 입력)', insert: [
      "const readline = require('readline');",
      'const rl = readline.createInterface({ input: process.stdin, output: process.stdout });',
      'const lines: string[] = [];',
      "rl.on('line', (line: string) => lines.push(line));",
      "rl.on('close', () => {",
      '  ',
      '});',
    ].join('\n'), doc: 'Node.js BOJ 입력 (TS)' },
  ],
};

let snippetsRegistered = false;

function registerCompletionProviders(monaco: MonacoInstance): void {
  if (snippetsRegistered) return;
  snippetsRegistered = true;
  const CompletionItemKind = monaco.languages.CompletionItemKind;
  const CompletionItemInsertTextRule = monaco.languages.CompletionItemInsertTextRule;

  for (const [langKey, snippets] of Object.entries(BOJ_SNIPPETS)) {
    const monacoLang = MONACO_LANG_MAP[langKey];
    if (!monacoLang || snippets.length === 0) continue;

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

        return {
          suggestions: snippets.map((s) => ({
            label: s.label,
            kind: CompletionItemKind.Snippet,
            insertText: s.insert,
            insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: s.doc,
            detail: 'AlgoSu BOJ',
            sortText: '!0' + s.label, // 스니펫을 상단에 표시
            range,
          })),
        };
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
  autoSaveStatus = 'idle',
  deadline,
  editorHeight = '520px',
}: CodeEditorProps): ReactNode {
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<MonacoInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autocomplete, setAutocomplete] = useState(true);
  const [fontSize, setFontSize] = useState(13);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [fullscreen, setFullscreen] = useState(false);
  const [deadlineWarning, setDeadlineWarning] = useState<
    'imminent' | 'approaching' | null
  >(null);

  // ─── Escape로 풀스크린 해제 (자동완성 위젯 닫기와 충돌 방지) ──
  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Monaco가 Escape를 먼저 처리(자동완성 닫기 등)하면 건너뜀
      if (e.defaultPrevented) return;
      // 에디터 suggest 위젯이 보이면 Monaco에 양보
      const suggestWidget = document.querySelector('.editor-widget.suggest-widget.visible');
      if (suggestWidget) return;
      setFullscreen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreen]);

  // ─── 초기 템플릿 삽입 (드래프트 없이 빈 코드로 마운트 시) ─
  const [templateApplied, setTemplateApplied] = useState(false);
  useEffect(() => {
    if (templateApplied) return;
    if (!code.trim() && BOJ_TEMPLATES[language]) {
      onCodeChange(BOJ_TEMPLATES[language]);
      setTemplateApplied(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateApplied]);

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

  // ─── 폰트 크기 반영 ─────────────────
  useEffect(() => {
    editorRef.current?.updateOptions({ fontSize });
  }, [fontSize]);

  // ─── 풀스크린 시 minimap + layout 반영 ──
  useEffect(() => {
    editorRef.current?.updateOptions({ minimap: { enabled: fullscreen } });
    // automaticLayout이 켜져 있지만 안전하게 레이아웃 갱신
    editorRef.current?.layout();
  }, [fullscreen]);

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

    // Node.js 기본 타입 선언 (BOJ 템플릿용 — require, process, console)
    const nodeTypes = `
      declare function require(module: string): any;
      declare namespace process {
        const stdin: any;
        const stdout: any;
        const argv: string[];
        const env: Record<string, string | undefined>;
      }
      declare namespace console {
        function log(...args: any[]): void;
        function error(...args: any[]): void;
      }
    `;

    // JS 진단 — 문법 오류만 (의미 오류 무시, Node.js 환경이라 타입 제한적)
    monaco.languages.typescript?.javascriptDefaults?.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });

    // TS 진단 — Node.js 타입 추가 + 완화된 컴파일러 옵션
    monaco.languages.typescript?.typescriptDefaults?.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    monaco.languages.typescript?.typescriptDefaults?.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      allowJs: true,
      strict: false,
      noEmit: true,
    });
    monaco.languages.typescript?.typescriptDefaults?.addExtraLib(nodeTypes, 'node.d.ts');
    monaco.languages.typescript?.javascriptDefaults?.addExtraLib(nodeTypes, 'node.d.ts');
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

  // ─── Ctrl+Enter 단축키 + 커서 위치 ───
  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

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

      {/* 에디터 카드 */}
      <div className={fullscreen
        ? 'flex flex-1 flex-col overflow-hidden'
        : 'overflow-hidden rounded-card border border-border bg-bg-card shadow'
      }>
        {/* ── 에디터 헤더 ── */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 언어 선택 — 항상 표시 */}
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

            {/* 자동저장 상태 — 항상 표시 */}
            {autoSaveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-[11px] text-text-3">
                <InlineSpinner />
                <span className="hidden sm:inline">저장 중...</span>
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-[11px] text-success">
                <Check className="h-3 w-3" aria-hidden />
                <span className="hidden sm:inline">저장됨</span>
              </span>
            )}

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

            {/* 초기화 — 항상 표시 (아이콘만 모바일) */}
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting}
              className="flex items-center gap-1 text-[11px] text-text-3 transition-colors hover:text-text disabled:opacity-40"
              aria-label="템플릿으로 초기화"
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
        <div className={fullscreen ? 'flex-1 min-h-0' : undefined}>
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
