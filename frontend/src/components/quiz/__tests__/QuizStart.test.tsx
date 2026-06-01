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
  return { ...actual, QUIZ_CATEGORIES: [actual.QuizCategory.DATA_STRUCTURE, actual.QuizCategory.ALGORITHM] };
});

describe('QuizStart', () => {
  it('renders category options and title', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    expect(screen.getByText('CS 퀴즈 미니게임')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '자료구조' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '알고리즘' })).toBeInTheDocument();
  });

  it('starts with the default category and count', () => {
    const onStart = jest.fn();
    renderWithI18n(<QuizStart onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    expect(onStart).toHaveBeenCalledWith(QuizCategory.DATA_STRUCTURE, 5);
  });

  it('reflects the selected category and count', () => {
    const onStart = jest.fn();
    renderWithI18n(<QuizStart onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: '알고리즘' }));
    fireEvent.click(screen.getByRole('button', { name: '10' }));
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
    expect(onStart).toHaveBeenCalledWith(QuizCategory.ALGORITHM, 10);
  });

  it('marks the active category with aria-pressed', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    expect(screen.getByRole('button', { name: '자료구조' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '알고리즘' })).toHaveAttribute('aria-pressed', 'false');
  });
});
