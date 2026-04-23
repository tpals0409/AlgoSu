import { render, screen, fireEvent } from '@testing-library/react';
import SubmitErrorPage from '../error';

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('SubmitErrorPage', () => {
  const mockReset = jest.fn();
  const mockError = new Error('테스트 오류');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('오류 제목이 렌더링된다', () => {
    render(<SubmitErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText('코드 제출 오류')).toBeInTheDocument();
  });

  it('오류 설명 메시지가 렌더링된다', () => {
    render(<SubmitErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText('코드 제출 페이지를 불러올 수 없습니다.')).toBeInTheDocument();
  });

  it('다시 시도 버튼이 렌더링된다', () => {
    render(<SubmitErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('다시 시도 버튼 클릭 시 reset이 호출된다', () => {
    render(<SubmitErrorPage error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('문제 목록으로 링크가 렌더링된다', () => {
    render(<SubmitErrorPage error={mockError} reset={mockReset} />);
    const link = screen.getByRole('link', { name: '문제 목록으로' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/problems');
  });
});
