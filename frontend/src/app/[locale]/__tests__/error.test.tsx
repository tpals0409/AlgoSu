import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import ErrorPage from '../error';

jest.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe('ErrorPage (root)', () => {
  const mockReset = jest.fn();
  const mockError = new Error('test error');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('오류 제목이 렌더링된다', () => {
    renderWithI18n(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText('오류 발생')).toBeInTheDocument();
  });

  it('오류 설명 메시지가 렌더링된다', () => {
    renderWithI18n(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText('예기치 않은 오류가 발생했습니다.')).toBeInTheDocument();
  });

  it('다시 시도 버튼이 렌더링된다', () => {
    renderWithI18n(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('다시 시도 버튼 클릭 시 reset이 호출된다', () => {
    renderWithI18n(<ErrorPage error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
