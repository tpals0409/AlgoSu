import { render, screen } from '@testing-library/react';
import { ScoreGauge } from '../ScoreGauge';

jest.mock('@/hooks/useAnimVal', () => ({
  useAnimVal: (score: number) => [{ current: null }, score],
}));

describe('ScoreGauge', () => {
  it('점수를 렌더링한다', () => {
    render(<ScoreGauge score={85} />);
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('80 이상이면 "우수" 라벨을 표시한다', () => {
    render(<ScoreGauge score={80} />);
    expect(screen.getByText('우수')).toBeInTheDocument();
  });

  it('50~79이면 "보통" 라벨을 표시한다', () => {
    render(<ScoreGauge score={65} />);
    expect(screen.getByText('보통')).toBeInTheDocument();
  });

  it('50 미만이면 "개선 필요" 라벨을 표시한다', () => {
    render(<ScoreGauge score={30} />);
    expect(screen.getByText('개선 필요')).toBeInTheDocument();
  });

  it('SVG 요소를 렌더링한다', () => {
    const { container } = render(<ScoreGauge score={70} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('커스텀 size를 적용한다', () => {
    const { container } = render(<ScoreGauge score={50} size={200} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '200');
    expect(svg).toHaveAttribute('height', '200');
  });

  it('커스텀 className을 적용한다', () => {
    const { container } = render(<ScoreGauge score={50} className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});

// ═══════════════════════════════════════════════════
// ScoreGauge — aria 접근성 속성
// ═══════════════════════════════════════════════════
describe('ScoreGauge accessibility', () => {
  it('has role="progressbar"', () => {
    render(<ScoreGauge score={75} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('has aria-valuenow matching the score', () => {
    render(<ScoreGauge score={85} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '85');
  });

  it('has aria-valuemin=0 and aria-valuemax=100', () => {
    render(<ScoreGauge score={60} />);
    const gauge = screen.getByRole('progressbar');
    expect(gauge).toHaveAttribute('aria-valuemin', '0');
    expect(gauge).toHaveAttribute('aria-valuemax', '100');
  });

  it('has aria-label with score and grade label', () => {
    render(<ScoreGauge score={90} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', '점수 90점 — 우수');
  });

  it('has aria-label "보통" for mid-range score', () => {
    render(<ScoreGauge score={65} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', '점수 65점 — 보통');
  });

  it('has aria-label "개선 필요" for low score', () => {
    render(<ScoreGauge score={30} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', '점수 30점 — 개선 필요');
  });

  it('hides SVG from assistive technology with aria-hidden', () => {
    const { container } = render(<ScoreGauge score={70} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
