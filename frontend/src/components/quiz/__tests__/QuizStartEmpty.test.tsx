/**
 * @file QuizStart 빈 상태 테스트 — 출제 가능한 카테고리 없음
 * @domain quiz
 * @layer component
 * @related QuizStart
 *
 * QUIZ_CATEGORIES가 비었을 때 EmptyState 분기를 검증하기 위해
 * 별도 파일에서 모듈 레벨로 빈 배열을 모킹한다.
 */
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';

jest.mock('@/data/quiz', () => {
  const actual = jest.requireActual('@/data/quiz');
  return { ...actual, QUIZ_CATEGORIES: [] };
});

// eslint-disable-next-line import/first
import { QuizStart } from '../QuizStart';

describe('QuizStart empty state', () => {
  it('renders empty state when no categories have questions', () => {
    renderWithI18n(<QuizStart onStart={jest.fn()} />);
    expect(screen.getByText('출제 가능한 문항이 없습니다')).toBeInTheDocument();
  });
});
