/**
 * @file QuizQuestion 컴포넌트 테스트 — 제출·빈입력·Enter·로케일
 * @domain quiz
 * @layer component
 * @related QuizQuestion
 */
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { QuizCategory, type QuizQuestion as QuizQuestionType } from '@/data/quiz';
import { QuizQuestion } from '../QuizQuestion';

const QUESTION: QuizQuestionType = {
  id: 'ds-01',
  category: QuizCategory.DATA_STRUCTURE,
  prompt: { ko: '한국어 질문', en: 'English prompt' },
  acceptedAnswers: ['스택'],
  explanation: { ko: '해설', en: 'explanation' },
  difficulty: 'EASY',
};

describe('QuizQuestion', () => {
  it('renders the Korean prompt for ko locale', () => {
    renderWithI18n(<QuizQuestion question={QUESTION} onSubmit={jest.fn()} />, { locale: 'ko' });
    expect(screen.getByText('한국어 질문')).toBeInTheDocument();
  });

  it('renders the English prompt for en locale', () => {
    renderWithI18n(<QuizQuestion question={QUESTION} onSubmit={jest.fn()} />, { locale: 'en' });
    expect(screen.getByText('English prompt')).toBeInTheDocument();
  });

  it('submits the typed answer on button click', () => {
    const onSubmit = jest.fn();
    renderWithI18n(<QuizQuestion question={QUESTION} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('답안'), { target: { value: '스택' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(onSubmit).toHaveBeenCalledWith('스택');
  });

  it('submits on Enter key (form submit)', () => {
    const onSubmit = jest.fn();
    const { container } = renderWithI18n(
      <QuizQuestion question={QUESTION} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByLabelText('답안'), { target: { value: 'queue' } });
    fireEvent.submit(container.querySelector('form')!);
    expect(onSubmit).toHaveBeenCalledWith('queue');
  });

  it('does not submit an empty (whitespace) answer', () => {
    const onSubmit = jest.fn();
    renderWithI18n(<QuizQuestion question={QUESTION} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('답안'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: '제출' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
