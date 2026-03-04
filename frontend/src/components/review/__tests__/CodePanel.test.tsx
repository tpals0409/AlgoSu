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

  it('Space 키로 라인을 선택할 수 있다', () => {
    const onLineClick = jest.fn();
    render(<CodePanel {...defaultProps} onLineClick={onLineClick} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Line 2' }), {
      key: ' ',
    });
    expect(onLineClick).toHaveBeenCalledWith(2);
  });

  it('warning 하이라이트가 라인에 적용된다', () => {
    const highlights: CodeHighlight[] = [
      { startLine: 2, endLine: 2, type: 'warning', message: '경고 발생' },
    ];
    render(<CodePanel {...defaultProps} highlights={highlights} />);
    const line2 = screen.getByRole('button', { name: 'Line 2' });
    expect(line2.className).toContain('bg-warning-soft');
    expect(line2.className).toContain('border-l-warning');
  });

  it('success 하이라이트가 라인에 적용된다', () => {
    const highlights: CodeHighlight[] = [
      { startLine: 3, endLine: 3, type: 'success', message: '잘 작성됨' },
    ];
    render(<CodePanel {...defaultProps} highlights={highlights} />);
    const line3 = screen.getByRole('button', { name: 'Line 3' });
    expect(line3.className).toContain('bg-success-soft');
    expect(line3.className).toContain('border-l-success');
  });

  it('commentLines에 있지만 selectedLine이 아닌 라인은 border-l-primary를 가진다', () => {
    render(<CodePanel {...defaultProps} commentLines={[1]} selectedLine={2} />);
    const line1 = screen.getByRole('button', { name: 'Line 1' });
    expect(line1.className).toContain('border-l-primary');
    // isSelected=false이므로 bg-primary-soft는 hover 시에만 적용 (hover:bg-primary-soft)
    // 클래스 자체는 존재하지만 선택 상태의 solid bg가 아님을 확인
    expect(line1.className).not.toContain('border-l-transparent');
  });

  it('하이라이트도 댓글도 없는 라인은 border-l-transparent를 가진다', () => {
    render(<CodePanel {...defaultProps} />);
    const line1 = screen.getByRole('button', { name: 'Line 1' });
    expect(line1.className).toContain('border-l-transparent');
  });

  it('selectedLine이 있으면 해당 라인으로 스크롤한다', () => {
    render(<CodePanel {...defaultProps} selectedLine={2} />);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('onLineClick이 없어도 라인 클릭이 오류를 발생시키지 않는다', () => {
    render(<CodePanel {...defaultProps} />);
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Line 1' }))).not.toThrow();
  });

  it('다른 키는 onLineClick을 호출하지 않는다', () => {
    const onLineClick = jest.fn();
    render(<CodePanel {...defaultProps} onLineClick={onLineClick} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Line 1' }), { key: 'Tab' });
    expect(onLineClick).not.toHaveBeenCalled();
  });

  it('selectedLine이 null이면 스크롤하지 않는다', () => {
    const scrollMock = jest.fn();
    Element.prototype.scrollIntoView = scrollMock;
    render(<CodePanel {...defaultProps} selectedLine={null} />);
    expect(scrollMock).not.toHaveBeenCalled();
  });

  it('selectedLine이 undefined이면 스크롤하지 않는다', () => {
    const scrollMock = jest.fn();
    Element.prototype.scrollIntoView = scrollMock;
    render(<CodePanel {...defaultProps} selectedLine={undefined} />);
    expect(scrollMock).not.toHaveBeenCalled();
  });

  it('존재하지 않는 selectedLine으로도 에러가 발생하지 않는다', () => {
    // 코드에 없는 라인 번호 (el이 null이 되는 경우)
    render(<CodePanel {...defaultProps} selectedLine={999} />);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('onLineClick 없이 keyDown Enter를 눌러도 에러가 발생하지 않는다', () => {
    render(<CodePanel {...defaultProps} />);
    expect(() =>
      fireEvent.keyDown(screen.getByRole('button', { name: 'Line 1' }), { key: 'Enter' })
    ).not.toThrow();
  });

  it('onLineClick 없이 keyDown Space를 눌러도 에러가 발생하지 않는다', () => {
    render(<CodePanel {...defaultProps} />);
    expect(() =>
      fireEvent.keyDown(screen.getByRole('button', { name: 'Line 1' }), { key: ' ' })
    ).not.toThrow();
  });
});
