/**
 * @file QuizLoading 컴포넌트 테스트 — 청크 로딩 진행률 표시
 * @domain quiz
 * @layer component
 * @related QuizLoading, src/components/ui/progress.tsx
 */
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { QuizLoading } from '../QuizLoading';

describe('QuizLoading', () => {
  it('renders the loading title', () => {
    renderWithI18n(<QuizLoading loaded={0} total={10} />);
    expect(screen.getByText('문항 불러오는 중...')).toBeInTheDocument();
  });

  it('exposes a progressbar reflecting loaded/total as a percentage', () => {
    renderWithI18n(<QuizLoading loaded={3} total={10} />);
    const bar = screen.getByRole('progressbar', { name: '문항 로딩 진행률' });
    // 3 / 10 → 30%
    expect(bar).toHaveAttribute('aria-valuenow', '30');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('rounds the percentage to the nearest integer', () => {
    renderWithI18n(<QuizLoading loaded={1} total={3} />);
    // 1 / 3 = 33.33 → 33
    const bar = screen.getByRole('progressbar', { name: '문항 로딩 진행률' });
    expect(bar).toHaveAttribute('aria-valuenow', '33');
  });

  it('shows 100% when all chunks are loaded', () => {
    renderWithI18n(<QuizLoading loaded={10} total={10} />);
    const bar = screen.getByRole('progressbar', { name: '문항 로딩 진행률' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('guards total=0 with 0% and does not crash', () => {
    renderWithI18n(<QuizLoading loaded={0} total={0} />);
    const bar = screen.getByRole('progressbar', { name: '문항 로딩 진행률' });
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('문항 불러오는 중...')).toBeInTheDocument();
  });

  it('exposes a polite live region for progress announcements', () => {
    const { container } = renderWithI18n(<QuizLoading loaded={2} total={10} />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});
