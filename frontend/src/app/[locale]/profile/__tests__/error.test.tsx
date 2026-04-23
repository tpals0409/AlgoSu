import { render, screen, fireEvent } from '@testing-library/react';
import ProfileErrorPage from '../error';

jest.mock('next/link', () => {
  const MockLink = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('ProfileErrorPage', () => {
  const mockReset = jest.fn();
  const mockError = new Error('테스트 오류');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('오류 제목이 렌더링된다', () => {
    render(<ProfileErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText('프로필 오류')).toBeInTheDocument();
  });

  it('오류 설명 메시지가 렌더링된다', () => {
    render(<ProfileErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText('프로필 정보를 불러올 수 없습니다.')).toBeInTheDocument();
  });

  it('다시 시도 버튼이 렌더링된다', () => {
    render(<ProfileErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('다시 시도 버튼 클릭 시 reset이 호출된다', () => {
    render(<ProfileErrorPage error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('홈으로 돌아가기 링크가 렌더링된다', () => {
    render(<ProfileErrorPage error={mockError} reset={mockReset} />);
    const link = screen.getByRole('link', { name: '홈으로 돌아가기' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });
});
