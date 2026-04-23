import { render, screen, fireEvent } from '@testing-library/react';
import ErrorPage from '../error';

describe('ErrorPage (root)', () => {
  const mockReset = jest.fn();
  const mockError = new Error('테스트 오류');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('오류 제목이 렌더링된다', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText('오류 발생')).toBeInTheDocument();
  });

  it('오류 설명 메시지가 렌더링된다', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText('예기치 않은 오류가 발생했습니다.')).toBeInTheDocument();
  });

  it('다시 시도 버튼이 렌더링된다', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('다시 시도 버튼 클릭 시 reset이 호출된다', () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});
