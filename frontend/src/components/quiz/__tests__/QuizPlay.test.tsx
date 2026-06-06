/**
 * @file QuizPlay 컨테이너 테스트 — 진행률·문항/피드백 전환
 * @domain quiz
 * @layer component
 * @related QuizPlay
 */
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { QuizCategory, type QuizQuestion } from '@/data/quiz';
import { QuizPlay } from '../QuizPlay';

const QUESTION: QuizQuestion = {
  id: 'ds-01',
  category: QuizCategory.DATA_STRUCTURE,
  prompt: { ko: '진행 질문', en: 'progress prompt' },
  acceptedAnswers: ['스택'],
  explanation: { ko: '스택 해설입니다', en: 'explanation' },
  difficulty: 'EASY',
};

function baseProps() {
  return {
    question: QUESTION,
    index: 1,
    total: 3,
    answer: '',
    isCorrect: false,
    onSubmit: jest.fn(),
    onNext: jest.fn(),
  };
}

describe('QuizPlay', () => {
  it('renders progress and the question form when not answered', () => {
    renderWithI18n(<QuizPlay {...baseProps()} answered={false} />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('진행 질문')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '제출' })).toBeInTheDocument();
  });

  it('renders feedback when answered', () => {
    renderWithI18n(
      <QuizPlay {...baseProps()} answered answer="스택" isCorrect />,
    );
    expect(screen.getByText('정답입니다!')).toBeInTheDocument();
    expect(screen.getByText('스택 해설입니다')).toBeInTheDocument();
  });

  it('shows finish label on the last question feedback', () => {
    renderWithI18n(
      <QuizPlay {...baseProps()} index={3} total={3} answered answer="스택" isCorrect />,
    );
    expect(screen.getByRole('button', { name: '결과 보기' })).toBeInTheDocument();
  });

  it('renders the category chip for the current question', () => {
    renderWithI18n(<QuizPlay {...baseProps()} answered={false} />);
    // DATA_STRUCTURE 분야 칩이 진행 헤더에 라벨로 표시된다.
    expect(screen.getByText('자료구조')).toBeInTheDocument();
  });

  // a11y 회귀(Sprint 222): 진행률 바가 접근 가능 이름과 진행 상태 텍스트를 노출한다.
  it('exposes an accessible name and value text on the progress bar', () => {
    renderWithI18n(<QuizPlay {...baseProps()} index={1} total={3} answered={false} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-label', '퀴즈 진행률');
    expect(progressbar).toHaveAttribute('aria-valuetext', '1 / 3');
  });
});
