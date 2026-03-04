import { render, screen, fireEvent } from '@testing-library/react';
import { DiffBadge } from '../DiffBadge';
import { DifficultyBadge } from '../DifficultyBadge';
import { LangBadge } from '../LangBadge';
import { ScoreBadge } from '../ScoreBadge';
import { StatusIndicator } from '../StatusIndicator';
import type { StatusType } from '../StatusIndicator';
import { CategoryBar, type CategoryItem } from '../CategoryBar';

/* ------------------------------------------------------------------ */
/*  CategoryBar uses useAnimVal (IntersectionObserver + rAF)          */
/* ------------------------------------------------------------------ */
jest.mock('@/hooks/useAnimVal', () => ({
  useAnimVal: (target: number) => {
    const ref = { current: null };
    return [ref, target];
  },
}));

/* ================================================================== */
/*  DiffBadge                                                         */
/* ================================================================== */
describe('DiffBadge', () => {
  it('renders tier label in Korean', () => {
    render(<DiffBadge tier="gold" />);
    expect(screen.getByText('골드')).toBeInTheDocument();
  });

  it('renders tier + level when level provided', () => {
    render(<DiffBadge tier="silver" level={3} />);
    expect(screen.getByText('실버 3')).toBeInTheDocument();
  });

  it('renders only tier label when level is null', () => {
    render(<DiffBadge tier="platinum" level={null} />);
    expect(screen.getByText('플래티넘')).toBeInTheDocument();
  });

  it('renders unrated tier', () => {
    render(<DiffBadge tier="unrated" />);
    expect(screen.getByText('Unrated')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<DiffBadge tier="bronze" className="custom" />);
    expect(container.firstChild).toHaveClass('custom');
  });
});

/* ================================================================== */
/*  DifficultyBadge                                                   */
/* ================================================================== */
describe('DifficultyBadge', () => {
  it('renders difficulty label', () => {
    render(<DifficultyBadge difficulty="GOLD" />);
    expect(screen.getByText(/골드/)).toBeInTheDocument();
  });

  it('has aria-label with difficulty name', () => {
    render(<DifficultyBadge difficulty="DIAMOND" />);
    expect(screen.getByLabelText(/난이도: 다이아/)).toBeInTheDocument();
  });

  it('shows dot by default', () => {
    const { container } = render(<DifficultyBadge difficulty="SILVER" />);
    const dot = container.querySelector('[aria-hidden]');
    expect(dot).toBeInTheDocument();
  });

  it('hides dot when showDot=false', () => {
    const { container } = render(<DifficultyBadge difficulty="SILVER" showDot={false} />);
    const dot = container.querySelector('[aria-hidden]');
    expect(dot).not.toBeInTheDocument();
  });

  it('hides label when showLabel=false', () => {
    render(<DifficultyBadge difficulty="BRONZE" showLabel={false} />);
    expect(screen.queryByText(/브론즈/)).not.toBeInTheDocument();
  });

  it('renders tier number from level', () => {
    // level=1 -> tier 5, level=2 -> tier 4, etc.
    render(<DifficultyBadge difficulty="GOLD" level={1} />);
    expect(screen.getByText(/골드 5/)).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<DifficultyBadge difficulty="PLATINUM" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});

/* ================================================================== */
/*  LangBadge                                                         */
/* ================================================================== */
describe('LangBadge', () => {
  it('renders language text', () => {
    render(<LangBadge language="Python" />);
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('renders different languages', () => {
    render(<LangBadge language="C++" />);
    expect(screen.getByText('C++')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<LangBadge language="Java" className="mono" />);
    expect(container.firstChild).toHaveClass('mono');
  });
});

/* ================================================================== */
/*  ScoreBadge                                                        */
/* ================================================================== */
describe('ScoreBadge', () => {
  it('renders score with 점 suffix', () => {
    render(<ScoreBadge score={85} />);
    expect(screen.getByText('85점')).toBeInTheDocument();
  });

  it('applies success style for score >= 90', () => {
    const { container } = render(<ScoreBadge score={95} />);
    expect(container.firstChild).toHaveClass('bg-success-soft');
  });

  it('applies warning style for score >= 70 and < 90', () => {
    const { container } = render(<ScoreBadge score={75} />);
    expect(container.firstChild).toHaveClass('bg-warning-soft');
  });

  it('applies error style for score < 70', () => {
    const { container } = render(<ScoreBadge score={50} />);
    expect(container.firstChild).toHaveClass('bg-error-soft');
  });

  it('applies custom className', () => {
    const { container } = render(<ScoreBadge score={100} className="big" />);
    expect(container.firstChild).toHaveClass('big');
  });
});

/* ================================================================== */
/*  StatusIndicator                                                   */
/* ================================================================== */
describe('StatusIndicator', () => {
  const statuses: StatusType[] = ['pending', 'running', 'success', 'failed', 'syncing'];

  it.each(statuses)('renders "%s" status with correct aria-label', (status) => {
    render(<StatusIndicator status={status} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', expect.stringContaining('상태:'));
  });

  it('shows Korean label by default', () => {
    render(<StatusIndicator status="success" />);
    expect(screen.getByText('완료')).toBeInTheDocument();
  });

  it('hides label when showLabel=false', () => {
    render(<StatusIndicator status="failed" showLabel={false} />);
    expect(screen.queryByText('실패')).not.toBeInTheDocument();
  });

  it('uses customLabel when provided', () => {
    render(<StatusIndicator status="pending" customLabel="커스텀" />);
    expect(screen.getByText('커스텀')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', '상태: 커스텀');
  });

  it('applies custom className', () => {
    const { container } = render(<StatusIndicator status="running" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });

  it('renders dot element', () => {
    const { container } = render(<StatusIndicator status="syncing" />);
    const dot = container.querySelector('[aria-hidden]');
    expect(dot).toBeInTheDocument();
  });

  it('size=null일 때 기본 md 사이즈를 사용한다', () => {
    // TypeScript VariantProps 타입에서 null이 가능하므로 null 처리 경로를 커버
    const { container } = render(<StatusIndicator status="pending" size={null as never} />);
    const dot = container.querySelector('[aria-hidden]');
    expect(dot).toHaveClass('h-2');
    expect(dot).toHaveClass('w-2');
  });

  it('sm 사이즈는 작은 도트를 렌더링한다', () => {
    const { container } = render(<StatusIndicator status="success" size="sm" />);
    const dot = container.querySelector('[aria-hidden]');
    expect(dot).toHaveClass('h-1.5');
    expect(dot).toHaveClass('w-1.5');
  });

  it('lg 사이즈는 큰 도트를 렌더링한다', () => {
    const { container } = render(<StatusIndicator status="success" size="lg" />);
    const dot = container.querySelector('[aria-hidden]');
    expect(dot).toHaveClass('h-2.5');
    expect(dot).toHaveClass('w-2.5');
  });
});

/* ================================================================== */
/*  CategoryBar                                                       */
/* ================================================================== */
describe('CategoryBar', () => {
  const baseItem: CategoryItem = {
    category: '코드 품질',
    score: 85,
    grade: 'A',
    color: 'success',
    comment: '잘 작성된 코드입니다',
  };

  it('renders category name', () => {
    render(<CategoryBar item={baseItem} />);
    expect(screen.getByText('코드 품질')).toBeInTheDocument();
  });

  it('renders grade badge', () => {
    render(<CategoryBar item={baseItem} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders comment text', () => {
    render(<CategoryBar item={baseItem} />);
    expect(screen.getByText('잘 작성된 코드입니다')).toBeInTheDocument();
  });

  it('renders animated score value', () => {
    render(<CategoryBar item={baseItem} />);
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<CategoryBar item={baseItem} onClick={handleClick} />);
    fireEvent.click(screen.getByText('코드 품질'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies selected styling', () => {
    const { container } = render(<CategoryBar item={baseItem} selected />);
    expect(container.firstChild).toHaveClass('border-l-primary');
  });

  it('renders warning color variant', () => {
    const warningItem: CategoryItem = { ...baseItem, color: 'warning', grade: 'B', score: 72 };
    render(<CategoryBar item={warningItem} />);
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders error color variant', () => {
    const errorItem: CategoryItem = { ...baseItem, color: 'error', grade: 'C', score: 45 };
    render(<CategoryBar item={errorItem} />);
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<CategoryBar item={baseItem} className="custom-bar" />);
    expect(container.firstChild).toHaveClass('custom-bar');
  });
});

/* ================================================================== */
/*  DiffBadge — aria 접근성 속성                                       */
/* ================================================================== */
describe('DiffBadge accessibility', () => {
  it('has aria-label with tier name in Korean', () => {
    render(<DiffBadge tier="gold" />);
    expect(screen.getByLabelText('난이도 골드')).toBeInTheDocument();
  });

  it('has aria-label with tier and level', () => {
    render(<DiffBadge tier="silver" level={3} />);
    expect(screen.getByLabelText('난이도 실버 3')).toBeInTheDocument();
  });

  it('has aria-label without level when level is null', () => {
    render(<DiffBadge tier="platinum" level={null} />);
    expect(screen.getByLabelText('난이도 플래티넘')).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  LangBadge — aria 접근성 속성                                       */
/* ================================================================== */
describe('LangBadge accessibility', () => {
  it('has aria-label with language name', () => {
    render(<LangBadge language="Python" />);
    expect(screen.getByLabelText('프로그래밍 언어 Python')).toBeInTheDocument();
  });

  it('has aria-label for C++', () => {
    render(<LangBadge language="C++" />);
    expect(screen.getByLabelText('프로그래밍 언어 C++')).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  ScoreBadge — aria 접근성 속성                                      */
/* ================================================================== */
describe('ScoreBadge accessibility', () => {
  it('has aria-label with score', () => {
    render(<ScoreBadge score={85} />);
    expect(screen.getByLabelText('AI 점수 85점')).toBeInTheDocument();
  });

  it('has aria-label for perfect score', () => {
    render(<ScoreBadge score={100} />);
    expect(screen.getByLabelText('AI 점수 100점')).toBeInTheDocument();
  });

  it('has aria-label for low score', () => {
    render(<ScoreBadge score={45} />);
    expect(screen.getByLabelText('AI 점수 45점')).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  CategoryBar — aria 접근성 속성                                     */
/* ================================================================== */
describe('CategoryBar accessibility', () => {
  const item: CategoryItem = {
    category: '코드 품질',
    score: 85,
    grade: 'A',
    color: 'success',
    comment: '잘 작성된 코드입니다',
  };

  it('has role="button"', () => {
    render(<CategoryBar item={item} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('has aria-pressed=false when not selected', () => {
    render(<CategoryBar item={item} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('has aria-pressed=true when selected', () => {
    render(<CategoryBar item={item} selected />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('has aria-label with category, grade, and score', () => {
    render(<CategoryBar item={item} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', '코드 품질 A 85점');
  });

  it('has tabIndex=0 for keyboard accessibility', () => {
    render(<CategoryBar item={item} />);
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '0');
  });

  it('triggers onClick on Enter key press', () => {
    const handleClick = jest.fn();
    render(<CategoryBar item={item} onClick={handleClick} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('triggers onClick on Space key press', () => {
    const handleClick = jest.fn();
    render(<CategoryBar item={item} onClick={handleClick} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onClick on other key press', () => {
    const handleClick = jest.fn();
    render(<CategoryBar item={item} onClick={handleClick} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Tab' });
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('contains inner progressbar with aria-valuenow', () => {
    render(<CategoryBar item={item} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '85');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });
});
