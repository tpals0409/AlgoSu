/**
 * @file QuizResult 컴포넌트 테스트 — 점수·정답률·최고기록·다시하기
 * @domain quiz
 * @layer component
 * @related QuizResult
 */
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { QuizResult } from '../QuizResult';

jest.mock('@/hooks/useAnimVal', () => ({
  useAnimVal: (value: number) => [{ current: null }, value],
}));

function baseProps() {
  return {
    correct: 8,
    total: 10,
    scorePercent: 80,
    bestScore: null as number | null,
    isNewBest: false,
    onRetry: jest.fn(),
  };
}

describe('QuizResult', () => {
  it('renders the title and correct count', () => {
    renderWithI18n(<QuizResult {...baseProps()} />);
    expect(screen.getByText('퀴즈 완료')).toBeInTheDocument();
    expect(screen.getByText('8 / 10 문제 정답')).toBeInTheDocument();
  });

  it('shows the new-best badge when isNewBest is true', () => {
    renderWithI18n(<QuizResult {...baseProps()} isNewBest />);
    expect(screen.getByText('최고 기록 갱신!')).toBeInTheDocument();
  });

  it('shows the existing best score when not a new best', () => {
    renderWithI18n(<QuizResult {...baseProps()} bestScore={90} isNewBest={false} />);
    expect(screen.getByText(/90%/)).toBeInTheDocument();
  });

  it('shows no best line when there is no prior best and not a new best', () => {
    renderWithI18n(<QuizResult {...baseProps()} bestScore={null} isNewBest={false} />);
    expect(screen.queryByText('최고 기록 갱신!')).not.toBeInTheDocument();
    expect(screen.queryByText(/최고 기록:/)).not.toBeInTheDocument();
  });

  it('calls onRetry when the retry button is clicked', () => {
    const onRetry = jest.fn();
    renderWithI18n(<QuizResult {...baseProps()} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: '다시하기' }));
    expect(onRetry).toHaveBeenCalled();
  });

  // a11y 회귀(Sprint 222): 결과 단계 진입 시 다시하기 버튼으로 포커스를 옮긴다.
  it('focuses the retry button on mount', () => {
    renderWithI18n(<QuizResult {...baseProps()} />);
    expect(screen.getByRole('button', { name: '다시하기' })).toHaveFocus();
  });

  // a11y 회귀(Sprint 222): 신기록 갱신 문구가 polite 라이브 영역(role="status") 안에
  // 포함돼 결과 전환 시 스크린리더에 공지되도록 한다.
  it('announces the new-best message inside the live region', () => {
    renderWithI18n(<QuizResult {...baseProps()} isNewBest />);
    const liveRegion = screen.getByRole('status');
    expect(within(liveRegion).getByText('최고 기록 갱신!')).toBeInTheDocument();
  });
});
