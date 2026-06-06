/**
 * @file QuizStart 컴포넌트 테스트 — 선택·시작·빈 상태
 * @domain quiz
 * @layer component
 * @related QuizStart
 */
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { QuizCategory } from '@/data/quiz';
import { QuizStart } from '../QuizStart';

jest.mock('@/data/quiz', () => {
  const actual = jest.requireActual('@/data/quiz');
  return {
    ...actual,
    QUIZ_CATEGORIES: [
      actual.QuizCategory.DATA_STRUCTURE,
      actual.QuizCategory.ALGORITHM,
      actual.QuizCategory.NETWORK,
    ],
  };
});

describe('QuizStart', () => {
  it('renders category options and title', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    expect(screen.getByText('CS 퀴즈 미니게임')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '자료구조' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '알고리즘' })).toBeInTheDocument();
  });

  it('starts with the default category, count, and difficulty', () => {
    const onStart = jest.fn();
    renderWithI18n(<QuizStart onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    expect(onStart).toHaveBeenCalledWith(QuizCategory.DATA_STRUCTURE, 5, 'ALL');
  });

  it('reflects the selected category, count, and difficulty', () => {
    const onStart = jest.fn();
    renderWithI18n(<QuizStart onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: '알고리즘' }));
    fireEvent.click(screen.getByRole('button', { name: '10' }));
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    expect(onStart).toHaveBeenCalledWith(QuizCategory.ALGORITHM, 10, 'ALL');
  });

  it('shows both count options when the filtered pool is large enough', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '전체' }));
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument();
  });

  it('hides the 10 option when the filtered pool is below 10', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    // 알고리즘 + 어려움 = 9문항 (< 10) → [5]만 노출
    fireEvent.click(screen.getByRole('button', { name: '알고리즘' }));
    fireEvent.click(screen.getByRole('button', { name: '어려움' }));
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '10' })).not.toBeInTheDocument();
  });

  it('clamps the selected count to the available pool when difficulty narrows it', () => {
    const onStart = jest.fn();
    renderWithI18n(<QuizStart onStart={onStart} />);
    // 10 선택 후 풀이 작은 난이도로 좁히면 onStart count는 가용 이하로 클램프
    fireEvent.click(screen.getByRole('button', { name: '알고리즘' }));
    fireEvent.click(screen.getByRole('button', { name: '10' }));
    fireEvent.click(screen.getByRole('button', { name: '어려움' }));
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    expect(onStart).toHaveBeenCalledWith(QuizCategory.ALGORITHM, 5, 'HARD');
  });

  it('offers the whole pool as a single option when fewer than 5 questions exist', () => {
    const onStart = jest.fn();
    renderWithI18n(<QuizStart onStart={onStart} />);
    // 네트워크 + 어려움 = 4문항 (< 5) → 단일 옵션 [4]
    fireEvent.click(screen.getByRole('button', { name: '네트워크' }));
    fireEvent.click(screen.getByRole('button', { name: '어려움' }));
    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    expect(onStart).toHaveBeenCalledWith(QuizCategory.NETWORK, 4, 'HARD');
  });

  it('renders difficulty options with ALL selected by default', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    expect(screen.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '쉬움' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '보통' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '어려움' })).toBeInTheDocument();
  });

  it('marks the active category with aria-pressed', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    expect(screen.getByRole('button', { name: '자료구조' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '알고리즘' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders a category icon that is hidden from the accessible name', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    // 아이콘이 있어도 accessible name은 라벨 텍스트만 유지되어야 한다 (aria-hidden).
    const button = screen.getByRole('button', { name: '자료구조' });
    const icon = button.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies the category accent color to the active category pill', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    const active = screen.getByRole('button', { name: '자료구조' });
    expect(active).toHaveStyle({ color: 'var(--quiz-cat-data-structure-color)' });
  });
});
