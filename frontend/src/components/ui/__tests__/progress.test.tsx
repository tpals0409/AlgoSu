/**
 * @file Progress 래퍼 단위 테스트 — value→Root 전달 및 aria-valuenow 노출
 * @domain ui
 * @layer component
 * @related Progress
 */
import { render, screen } from '@testing-library/react';
import { Progress } from '../progress';

describe('Progress', () => {
  // 핵심 회귀(Sprint 223): value를 Root에 전달해야 Radix가 progressbar의 numeric value를 노출한다.
  it('exposes role=progressbar with aria-valuenow when value is provided', () => {
    render(<Progress value={33} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '33');
    // Radix 기본 min/max도 함께 노출된다.
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  // indeterminate(value 미지정/null)에서는 aria-valuenow를 노출하지 않고 크래시도 없다.
  it('omits aria-valuenow when value is undefined (indeterminate)', () => {
    render(<Progress />);
    const bar = screen.getByRole('progressbar');
    expect(bar).not.toHaveAttribute('aria-valuenow');
  });

  it('omits aria-valuenow when value is null (indeterminate)', () => {
    render(<Progress value={null} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).not.toHaveAttribute('aria-valuenow');
  });

  // 사용자 aria-* props는 Radix 계산값 뒤에 spread되어 override 가능하다(QuizPlay의 접근 이름/진행 텍스트).
  it('lets caller aria-label and aria-valuetext override Radix defaults', () => {
    render(
      <Progress value={50} aria-label="퀴즈 진행률" aria-valuetext="1 / 3" />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', '퀴즈 진행률');
    // Radix 기본 aria-valuetext("50%") 대신 사용자 값이 노출된다.
    expect(bar).toHaveAttribute('aria-valuetext', '1 / 3');
    // 사용자가 valuetext를 덮어써도 numeric value는 그대로 노출된다.
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });
});
