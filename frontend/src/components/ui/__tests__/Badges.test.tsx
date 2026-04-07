import { render, screen, fireEvent } from '@testing-library/react';
import { DifficultyBadge } from '../DifficultyBadge';
import { LangBadge } from '../LangBadge';
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
/*  DifficultyBadge                                                   */
/* ================================================================== */
describe('DifficultyBadge', () => {
  it('renders difficulty label', () => {
    render(<DifficultyBadge difficulty="GOLD" />);
    expect(screen.getByText(/Gold/)).toBeInTheDocument();
  });

  it('has aria-label with difficulty name', () => {
    render(<DifficultyBadge difficulty="DIAMOND" />);
    expect(screen.getByLabelText(/난이도: Diamond/)).toBeInTheDocument();
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
    expect(screen.queryByText(/Bronze/)).not.toBeInTheDocument();
  });

  it('renders tier number from level', () => {
    // toTierLevel: level 1 → 5(Bronze5), level 11 → 5(Gold5), level 12 → 4(Gold4), level 15 → 1(Gold1)
    render(<DifficultyBadge difficulty="GOLD" level={12} />);
    expect(screen.getByText(/Gold 4/)).toBeInTheDocument();
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

  it('does not throw when Enter is pressed without onClick (onClick?.() optional chaining)', () => {
    render(<CategoryBar item={item} />);
    expect(() => {
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    }).not.toThrow();
  });

  it('does not throw when Space is pressed without onClick (onClick?.() optional chaining)', () => {
    render(<CategoryBar item={item} />);
    expect(() => {
      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    }).not.toThrow();
  });
});
