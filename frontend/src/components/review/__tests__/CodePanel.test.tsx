import { render, screen, fireEvent } from '@testing-library/react';
import { CodePanel, type CodeHighlight } from '../CodePanel';

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return { MessageSquare: Icon };
});

jest.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

const sampleCode = `function add(a, b) {
  return a + b;
}`;

describe('CodePanel', () => {
  const defaultProps = {
    code: sampleCode,
    language: 'JavaScript',
  };

  it('코드 라인들을 렌더링한다', () => {
    render(<CodePanel {...defaultProps} />);
    expect(screen.getByText('function add(a, b) {')).toBeInTheDocument();
    expect(screen.getByText('return a + b;')).toBeInTheDocument();
  });

  it('파일 헤더에 언어와 줄 수를 표시한다', () => {
    render(<CodePanel {...defaultProps} />);
    expect(screen.getByText('solution.javascript')).toBeInTheDocument();
    expect(screen.getByText('3줄')).toBeInTheDocument();
  });

  it('줄번호를 표시한다', () => {
    render(<CodePanel {...defaultProps} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('라인 클릭 시 onLineClick이 호출된다', () => {
    const onLineClick = jest.fn();
    render(<CodePanel {...defaultProps} onLineClick={onLineClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Line 2' }));
    expect(onLineClick).toHaveBeenCalledWith(2);
  });

  it('Enter 키로 라인을 선택할 수 있다', () => {
    const onLineClick = jest.fn();
    render(<CodePanel {...defaultProps} onLineClick={onLineClick} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Line 1' }), {
      key: 'Enter',
    });
    expect(onLineClick).toHaveBeenCalledWith(1);
  });

  it('commentLines에 해당하는 라인에 댓글 인디케이터를 표시한다', () => {
    render(<CodePanel {...defaultProps} commentLines={[2]} />);
    expect(screen.getByLabelText('댓글 있음')).toBeInTheDocument();
  });

  it('하이라이트 정보가 라인에 적용된다', () => {
    const highlights: CodeHighlight[] = [
      { startLine: 1, endLine: 1, type: 'error', message: '에러 발생' },
    ];
    render(<CodePanel {...defaultProps} highlights={highlights} />);
    const line1 = screen.getByRole('button', { name: 'Line 1' });
    expect(line1.className).toContain('bg-error-soft');
  });

  it('selectedLine이 지정되면 해당 라인이 선택 스타일을 가진다', () => {
    render(<CodePanel {...defaultProps} selectedLine={2} />);
    const line2 = screen.getByRole('button', { name: 'Line 2' });
    expect(line2.className).toContain('border-l-primary');
    expect(line2.className).toContain('bg-primary-soft');
  });

  it('빈 라인은 공백 문자로 렌더링된다', () => {
    render(<CodePanel code={'\n'} language="text" />);
    const preElements = document.querySelectorAll('pre');
    expect(preElements[0].textContent).toBe(' ');
  });
});
