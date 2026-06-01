/**
 * @file QuizFeedback 컴포넌트 테스트 — 정답/오답·해설·버튼 라벨·로케일
 * @domain quiz
 * @layer component
 * @related QuizFeedback
 */
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { QuizCategory, type QuizQuestion } from '@/data/quiz';
import { QuizFeedback } from '../QuizFeedback';

const QUESTION: QuizQuestion = {
  id: 'ds-01',
  category: QuizCategory.DATA_STRUCTURE,
  prompt: { ko: '질문', en: 'prompt' },
  acceptedAnswers: ['스택'],
  explanation: { ko: '스택 해설', en: 'stack explanation' },
  difficulty: 'EASY',
};

describe('QuizFeedback', () => {
  it('shows correct state with explanation', () => {
    renderWithI18n(
      <QuizFeedback question={QUESTION} answer="스택" isCorrect isLast={false} onNext={jest.fn()} />,
    );
    expect(screen.getByText('정답입니다!')).toBeInTheDocument();
    expect(screen.getByText('스택 해설')).toBeInTheDocument();
    expect(screen.getByText('입력한 답: 스택')).toBeInTheDocument();
  });

  it('shows incorrect state', () => {
    renderWithI18n(
      <QuizFeedback question={QUESTION} answer="배열" isCorrect={false} isLast={false} onNext={jest.fn()} />,
    );
    expect(screen.getByText('오답입니다')).toBeInTheDocument();
  });

  it('shows "next" label when not the last question', () => {
    renderWithI18n(
      <QuizFeedback question={QUESTION} answer="스택" isCorrect isLast={false} onNext={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: '다음 문항' })).toBeInTheDocument();
  });

  it('shows "finish" label when it is the last question', () => {
    renderWithI18n(
      <QuizFeedback question={QUESTION} answer="스택" isCorrect isLast onNext={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: '결과 보기' })).toBeInTheDocument();
  });

  it('calls onNext when the button is clicked', () => {
    const onNext = jest.fn();
    renderWithI18n(
      <QuizFeedback question={QUESTION} answer="스택" isCorrect isLast={false} onNext={onNext} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '다음 문항' }));
    expect(onNext).toHaveBeenCalled();
  });

  it('renders the English explanation for en locale', () => {
    renderWithI18n(
      <QuizFeedback question={QUESTION} answer="stack" isCorrect isLast={false} onNext={jest.fn()} />,
      { locale: 'en' },
    );
    expect(screen.getByText('stack explanation')).toBeInTheDocument();
  });
});
