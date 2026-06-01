/**
 * @file quiz/page.tsx 통합 테스트 — idle→playing→result 전체 플로우
 * @domain quiz
 * @layer page
 * @related quiz/page.tsx
 */
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { QuizCategory, type QuizQuestion } from '@/data/quiz';
import QuizPage from '../page';

jest.mock('@/components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

jest.mock('@/hooks/useAnimVal', () => ({
  useAnimVal: (value: number) => [{ current: null }, value],
}));

const MOCK_QUESTIONS: QuizQuestion[] = [
  {
    id: 'ds-01',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: { ko: 'LIFO 자료구조는?', en: 'Which is LIFO?' },
    acceptedAnswers: ['스택', 'stack'],
    explanation: { ko: '스택입니다.', en: 'It is a stack.' },
    difficulty: 'EASY',
  },
  {
    id: 'ds-02',
    category: QuizCategory.DATA_STRUCTURE,
    prompt: { ko: 'FIFO 자료구조는?', en: 'Which is FIFO?' },
    acceptedAnswers: ['큐', 'queue'],
    explanation: { ko: '큐입니다.', en: 'It is a queue.' },
    difficulty: 'EASY',
  },
];

jest.mock('@/data/quiz', () => {
  const actual = jest.requireActual('@/data/quiz');
  return {
    ...actual,
    QUIZ_CATEGORIES: [actual.QuizCategory.DATA_STRUCTURE],
    getRandomQuestions: jest.fn(() => MOCK_QUESTIONS),
  };
});

function answerCurrent(text: string): void {
  const input = screen.getByLabelText('답안');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: '제출' }));
}

describe('QuizPage flow', () => {
  beforeEach(() => window.localStorage.clear());

  function startGame(): void {
    renderWithI18n(<QuizPage />);
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));
  }

  it('renders the start screen initially', () => {
    renderWithI18n(<QuizPage />);
    expect(screen.getByText('CS 퀴즈 미니게임')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument();
  });

  it('shows the first question after starting', () => {
    startGame();
    expect(screen.getByText('LIFO 자료구조는?')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('grades a correct answer and shows the explanation', () => {
    startGame();
    answerCurrent('스택');
    expect(screen.getByText('정답입니다!')).toBeInTheDocument();
    expect(screen.getByText('스택입니다.')).toBeInTheDocument();
  });

  it('grades a wrong answer as incorrect', () => {
    startGame();
    answerCurrent('배열');
    expect(screen.getByText('오답입니다')).toBeInTheDocument();
  });

  it('completes the full flow and shows the result with a perfect score', () => {
    startGame();
    answerCurrent('스택');
    fireEvent.click(screen.getByRole('button', { name: '다음 문항' }));
    answerCurrent('큐');
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));
    expect(screen.getByText('퀴즈 완료')).toBeInTheDocument();
    expect(screen.getByText('2 / 2 문제 정답')).toBeInTheDocument();
    expect(screen.getByText('최고 기록 갱신!')).toBeInTheDocument();
  });

  it('returns to the start screen when retry is clicked', () => {
    startGame();
    answerCurrent('스택');
    fireEvent.click(screen.getByRole('button', { name: '다음 문항' }));
    answerCurrent('큐');
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '다시하기' }));
    expect(screen.getByText('CS 퀴즈 미니게임')).toBeInTheDocument();
  });
});
