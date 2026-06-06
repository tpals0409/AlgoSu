/**
 * @file QuizResult 컴포넌트 테스트 — 점수·정답률·최고기록·다시하기
 * @domain quiz
 * @layer component
 * @related QuizResult
 */
import { screen, fireEvent, waitFor } from '@testing-library/react';
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

  // a11y 회귀(Sprint 222, Critic P2): 전용 sr-only 라이브 영역(role="status")이 빈 채로
  // 먼저 마운트된 뒤 effect로 신기록 공지 문장을 주입한다 ("존재 후 변경" 정석 패턴).
  it('injects the new-best announcement into the sr-only live region after mount', async () => {
    renderWithI18n(<QuizResult {...baseProps()} isNewBest scorePercent={80} />);
    const liveRegion = screen.getByRole('status');
    await waitFor(() =>
      expect(liveRegion).toHaveTextContent('퀴즈 완료, 정답률 80퍼센트, 최고 기록을 갱신했습니다.'),
    );
  });

  // a11y 회귀(Sprint 222, Critic P2): 신기록이 아닐 때도 라이브 영역에 완료 공지를 주입한다.
  it('injects the done announcement into the live region when not a new best', async () => {
    renderWithI18n(<QuizResult {...baseProps()} isNewBest={false} scorePercent={80} />);
    const liveRegion = screen.getByRole('status');
    await waitFor(() =>
      expect(liveRegion).toHaveTextContent('퀴즈 완료, 정답률 80퍼센트입니다.'),
    );
  });
});
