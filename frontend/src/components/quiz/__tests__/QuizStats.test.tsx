/**
 * @file QuizStats 컴포넌트 테스트 — 분야별 최고 점수 요약 막대
 * @domain quiz
 * @layer component
 * @related QuizStats, src/lib/quiz/stats.ts
 */
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { QuizCategory } from '@/data/quiz';
import { QuizStats } from '../QuizStats';

describe('QuizStats', () => {
  it('renders nothing when there are no records', () => {
    const { container } = renderWithI18n(<QuizStats stats={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a labeled section with the title when records exist', () => {
    renderWithI18n(
      <QuizStats stats={[{ category: QuizCategory.DATA_STRUCTURE, bestPercent: 80 }]} />,
    );
    expect(screen.getByRole('region', { name: '내 기록' })).toBeInTheDocument();
    expect(screen.getByText('내 기록')).toBeInTheDocument();
  });

  it('renders a category label and its best percent', () => {
    renderWithI18n(
      <QuizStats stats={[{ category: QuizCategory.ALGORITHM, bestPercent: 95 }]} />,
    );
    expect(screen.getByText('알고리즘')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('exposes each bar as a progressbar with the score as aria-valuenow', () => {
    renderWithI18n(
      <QuizStats stats={[{ category: QuizCategory.NETWORK, bestPercent: 70 }]} />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '70');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('renders one bar per category stat', () => {
    renderWithI18n(
      <QuizStats
        stats={[
          { category: QuizCategory.ALGORITHM, bestPercent: 95 },
          { category: QuizCategory.OS, bestPercent: 40 },
        ]}
      />,
    );
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('hides the decorative category icon from the accessible name', () => {
    renderWithI18n(
      <QuizStats stats={[{ category: QuizCategory.DATABASE, bestPercent: 55 }]} />,
    );
    const icon = screen.getByText('데이터베이스').querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
