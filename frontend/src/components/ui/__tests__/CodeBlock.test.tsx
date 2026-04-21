/**
 * @file CodeBlock 컴포넌트 단위 테스트
 * @domain ui
 * @layer component
 * @related CodePanel, analysis/page
 *
 * Sprint 106 [A-1]: branches 커버리지 상향 목표
 * 주요 분기: 테마(dark/light), 언어맵 hit/miss, highlightLines 있음/없음, isHL true/false
 */

import React from 'react';
import { render } from '@testing-library/react';
import { CodeBlock } from '../CodeBlock';

// ── next-themes mock ──────────────────────────────────

const mockResolvedTheme = { value: 'light' };

jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: mockResolvedTheme.value }),
}));

// ── react-syntax-highlighter mock ─────────────────────
// lineProps 콜백을 캡처하여 분기를 테스트한다

type CapturedLineProps = ((lineNumber: number) => { style: React.CSSProperties }) | undefined;

const capturedProps: { lineProps: CapturedLineProps; language?: string; style?: unknown } = {
  lineProps: undefined,
  language: undefined,
  style: undefined,
};

jest.mock('react-syntax-highlighter', () => ({
  Prism: (props: {
    children: React.ReactNode;
    language: string;
    style: unknown;
    lineProps?: (lineNumber: number) => { style: React.CSSProperties };
  }) => {
    capturedProps.lineProps = props.lineProps;
    capturedProps.language = props.language;
    capturedProps.style = props.style;
    return <div data-testid="syntax-hl" data-lang={props.language}>{props.children}</div>;
  },
}));

jest.mock('react-syntax-highlighter/dist/cjs/styles/prism', () => ({
  oneLight: { 'mock': 'light' },
  oneDark: { 'mock': 'dark' },
}));

// ═══════════════════════════════════════════════════
// 1. 테마 분기
// ═══════════════════════════════════════════════════

describe('CodeBlock — 테마 분기', () => {
  beforeEach(() => {
    capturedProps.lineProps = undefined;
    capturedProps.language = undefined;
    capturedProps.style = undefined;
  });

  it('light 테마에서 oneLight 스타일을 사용한다', () => {
    mockResolvedTheme.value = 'light';
    render(<CodeBlock code="print('hello')" language="python" />);
    expect(capturedProps.style).toEqual({ 'mock': 'light' });
  });

  it('dark 테마에서 oneDark 스타일을 사용한다', () => {
    mockResolvedTheme.value = 'dark';
    render(<CodeBlock code="print('hello')" language="python" />);
    expect(capturedProps.style).toEqual({ 'mock': 'dark' });
  });
});

// ═══════════════════════════════════════════════════
// 2. 언어 맵 분기
// ═══════════════════════════════════════════════════

describe('CodeBlock — 언어 맵 분기', () => {
  beforeEach(() => {
    mockResolvedTheme.value = 'light';
    capturedProps.language = undefined;
  });

  it.each([
    ['python', 'python'],
    ['java', 'java'],
    ['cpp', 'cpp'],
    ['c', 'c'],
    ['javascript', 'javascript'],
    ['typescript', 'typescript'],
    ['go', 'go'],
    ['rust', 'rust'],
    ['kotlin', 'kotlin'],
    ['swift', 'swift'],
    ['ruby', 'ruby'],
    ['csharp', 'csharp'],
  ])('언어 "%s"는 "%s"로 매핑된다', (input, expected) => {
    render(<CodeBlock code="code" language={input} />);
    expect(capturedProps.language).toBe(expected);
  });

  it('알 수 없는 언어는 "text"로 폴백된다', () => {
    render(<CodeBlock code="code" language="brainfuck" />);
    expect(capturedProps.language).toBe('text');
  });

  it('대문자 언어명도 소문자로 변환하여 매핑한다', () => {
    render(<CodeBlock code="code" language="Python" />);
    expect(capturedProps.language).toBe('python');
  });
});

// ═══════════════════════════════════════════════════
// 3. highlightLines 없는 경우
// ═══════════════════════════════════════════════════

describe('CodeBlock — highlightLines 없음', () => {
  beforeEach(() => {
    mockResolvedTheme.value = 'light';
    capturedProps.lineProps = undefined;
  });

  it('highlightLines 미전달 시 lineProps 콜백이 존재한다', () => {
    render(<CodeBlock code="x = 1" language="python" />);
    expect(capturedProps.lineProps).toBeDefined();
  });

  it('highlightLines 없으면 모든 라인이 하이라이트되지 않는다', () => {
    render(<CodeBlock code="x = 1" language="python" />);
    const style = capturedProps.lineProps!(1).style;
    expect(style.backgroundColor).toBeUndefined();
    expect(style.borderLeft).toBe('3px solid transparent');
    expect(style.paddingLeft).toBe('7px');
  });
});

// ═══════════════════════════════════════════════════
// 4. highlightLines 있는 경우 — isHL true/false 분기
// ═══════════════════════════════════════════════════

describe('CodeBlock — highlightLines 있음', () => {
  beforeEach(() => {
    mockResolvedTheme.value = 'light';
    capturedProps.lineProps = undefined;
  });

  it('hightlightLines에 포함된 라인은 하이라이트된다 (success 기본값)', () => {
    const highlightLines = new Set([2, 4]);
    render(
      <CodeBlock
        code={'line1\nline2\nline3\nline4'}
        language="python"
        highlightLines={highlightLines}
      />,
    );
    const style = capturedProps.lineProps!(2).style;
    expect(style.backgroundColor).toBe('var(--hl-success-bg)');
    expect(style.borderLeft).toBe('3px solid var(--hl-success-border)');
    expect(style.paddingLeft).toBe('4px');
  });

  it('hightlightLines에 포함되지 않은 라인은 하이라이트되지 않는다', () => {
    const highlightLines = new Set([2]);
    render(
      <CodeBlock
        code={'line1\nline2'}
        language="python"
        highlightLines={highlightLines}
      />,
    );
    const style = capturedProps.lineProps!(1).style;
    expect(style.backgroundColor).toBeUndefined();
    expect(style.borderLeft).toBe('3px solid transparent');
    expect(style.paddingLeft).toBe('7px');
  });

  it('highlightColor="warning" 적용 시 warning CSS 변수를 사용한다', () => {
    const highlightLines = new Set([1]);
    render(
      <CodeBlock
        code="code"
        language="python"
        highlightLines={highlightLines}
        highlightColor="warning"
      />,
    );
    const style = capturedProps.lineProps!(1).style;
    expect(style.backgroundColor).toBe('var(--hl-warning-bg)');
    expect(style.borderLeft).toBe('3px solid var(--hl-warning-border)');
  });

  it('highlightColor="error" 적용 시 error CSS 변수를 사용한다', () => {
    const highlightLines = new Set([1]);
    render(
      <CodeBlock
        code="code"
        language="python"
        highlightLines={highlightLines}
        highlightColor="error"
      />,
    );
    const style = capturedProps.lineProps!(1).style;
    expect(style.backgroundColor).toBe('var(--hl-error-bg)');
    expect(style.borderLeft).toBe('3px solid var(--hl-error-border)');
  });
});

// ═══════════════════════════════════════════════════
// 5. 렌더링 기본 동작
// ═══════════════════════════════════════════════════

describe('CodeBlock — 기본 렌더링', () => {
  beforeEach(() => {
    mockResolvedTheme.value = 'light';
  });

  it('코드 내용을 렌더링한다', () => {
    const { getByTestId } = render(<CodeBlock code="const x = 1;" language="typescript" />);
    expect(getByTestId('syntax-hl')).toBeInTheDocument();
  });

  it('빈 코드도 렌더링 에러 없이 처리한다', () => {
    expect(() =>
      render(<CodeBlock code="" language="python" />),
    ).not.toThrow();
  });
});
