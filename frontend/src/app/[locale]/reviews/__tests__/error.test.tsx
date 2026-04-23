import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import ReviewsErrorPage from '../error';

jest.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe('ReviewsErrorPage', () => {
  const mockReset = jest.fn();
  const mockError = new Error('test error');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('오류 제목이 렌더링된다', () => {
    renderWithI18n(<ReviewsErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText('리뷰 오류')).toBeInTheDocument();
  });

  it('오류 설명 메시지가 렌더링된다', () => {
    renderWithI18n(<ReviewsErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText('리뷰를 불러올 수 없습니다.')).toBeInTheDocument();
  });

  it('다시 시도 버튼이 렌더링된다', () => {
    renderWithI18n(<ReviewsErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('다시 시도 버튼 클릭 시 reset이 호출된다', () => {
    renderWithI18n(<ReviewsErrorPage error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('홈으로 돌아가기 링크가 렌더링된다', () => {
    renderWithI18n(<ReviewsErrorPage error={mockError} reset={mockReset} />);
    const link = screen.getByRole('link', { name: '홈으로 돌아가기' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });
});
