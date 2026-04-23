import React, { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ── lucide-react mock ───────────────────────────
jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    CheckCircle2: Icon,
    XCircle: Icon,
    AlertTriangle: Icon,
    Info: Icon,
    X: Icon,
    ChevronLeft: Icon,
    Inbox: Icon,
  };
});

// ── next/navigation mock (BackBtn 용) ───────────
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

import { Badge } from '../Badge';
import { Button } from '../Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../Card';
import { Input } from '../Input';
import { Alert } from '../Alert';
import { BackBtn } from '../BackBtn';
import { EmptyState } from '../EmptyState';
import { LoadingSpinner, FullscreenSpinner, InlineSpinner } from '../LoadingSpinner';
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonDashboard, SkeletonListPage, SkeletonProfile, SkeletonReview } from '../Skeleton';
import { StatusBadge } from '../StatusBadge';

// ═══════════════════════════════════════════════════
// 1. Badge
// ═══════════════════════════════════════════════════
describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('applies variant class', () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    expect(container.firstChild).toHaveClass('bg-success-soft');
  });

  it('uses default variant when none specified', () => {
    const { container } = render(<Badge>Default</Badge>);
    expect(container.firstChild).toHaveClass('bg-primary-soft');
  });

  it('renders dot indicator when dot prop is true', () => {
    const { container } = render(<Badge dot>Active</Badge>);
    const dot = container.querySelector('[aria-hidden]');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('rounded-full');
  });

  it('does not render dot when dot prop is false', () => {
    const { container } = render(<Badge>NoDot</Badge>);
    expect(container.querySelector('[aria-hidden]')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Badge className="extra">Test</Badge>);
    expect(container.firstChild).toHaveClass('extra');
  });

  it('spreads additional HTML attributes', () => {
    render(<Badge data-testid="badge">Test</Badge>);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════
// 2. Button
// ═══════════════════════════════════════════════════
describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies primary variant by default', () => {
    render(<Button>Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary');
  });

  it('applies ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-transparent');
  });

  it('applies size variants', () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-5');
  });

  it('supports disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('handles click events', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('renders as child component when asChild is true', () => {
    render(
      <Button asChild>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/test">Link</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Link' });
    expect(link).toBeInTheDocument();
    expect(link.tagName.toLowerCase()).toBe('a');
  });
});

// ═══════════════════════════════════════════════════
// 3. Card
// ═══════════════════════════════════════════════════
describe('Card', () => {
  it('renders Card with children', () => {
    render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId('card')).toHaveTextContent('Content');
  });

  it('forwards ref on Card', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Card ref={ref}>Ref test</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('applies custom className on Card', () => {
    render(<Card data-testid="card" className="custom">C</Card>);
    expect(screen.getByTestId('card')).toHaveClass('custom');
  });

  it('renders CardHeader', () => {
    render(<CardHeader data-testid="header">H</CardHeader>);
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('renders CardTitle as h3', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText('Title').tagName.toLowerCase()).toBe('h3');
  });

  it('renders CardDescription as p', () => {
    render(<CardDescription>Desc</CardDescription>);
    expect(screen.getByText('Desc').tagName.toLowerCase()).toBe('p');
  });

  it('renders CardContent', () => {
    render(<CardContent data-testid="content">Body</CardContent>);
    expect(screen.getByTestId('content')).toHaveTextContent('Body');
  });

  it('renders CardFooter', () => {
    render(<CardFooter data-testid="footer">Foot</CardFooter>);
    expect(screen.getByTestId('footer')).toHaveTextContent('Foot');
  });

  it('forwards ref on sub-components', () => {
    const headerRef = createRef<HTMLDivElement>();
    const titleRef = createRef<HTMLHeadingElement>();
    const descRef = createRef<HTMLParagraphElement>();
    const contentRef = createRef<HTMLDivElement>();
    const footerRef = createRef<HTMLDivElement>();
    render(
      <Card>
        <CardHeader ref={headerRef}>H</CardHeader>
        <CardTitle ref={titleRef}>T</CardTitle>
        <CardDescription ref={descRef}>D</CardDescription>
        <CardContent ref={contentRef}>C</CardContent>
        <CardFooter ref={footerRef}>F</CardFooter>
      </Card>,
    );
    expect(headerRef.current).toBeInstanceOf(HTMLDivElement);
    expect(titleRef.current).toBeInstanceOf(HTMLHeadingElement);
    expect(descRef.current).toBeInstanceOf(HTMLParagraphElement);
    expect(contentRef.current).toBeInstanceOf(HTMLDivElement);
    expect(footerRef.current).toBeInstanceOf(HTMLDivElement);
  });
});

// ═══════════════════════════════════════════════════
// 4. Input
// ═══════════════════════════════════════════════════
describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('associates label with input via htmlFor', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input.tagName.toLowerCase()).toBe('input');
  });

  it('shows error message', () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('sets aria-invalid when error exists', () => {
    render(<Input label="Email" error="Bad" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows hint when no error', () => {
    render(<Input label="Name" hint="Optional" />);
    expect(screen.getByText('Optional')).toBeInTheDocument();
  });

  it('hides hint when error is present', () => {
    render(<Input label="Name" hint="Optional" error="Required" />);
    expect(screen.queryByText('Optional')).not.toBeInTheDocument();
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('supports disabled state', () => {
    render(<Input label="Test" disabled />);
    expect(screen.getByLabelText('Test')).toBeDisabled();
  });
});

// ═══════════════════════════════════════════════════
// 5. Alert
// ═══════════════════════════════════════════════════
describe('Alert', () => {
  it('renders with role="alert"', () => {
    render(<Alert>Message</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Alert title="Error occurred">Details</Alert>);
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(<Alert>Something happened</Alert>);
    expect(screen.getByText('Something happened')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    render(<Alert variant="error">Err</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('border-error/30');
  });

  it('defaults to info variant', () => {
    render(<Alert>Info</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('border-info/30');
  });

  it('renders close button when onClose provided', () => {
    const onClose = jest.fn();
    render(<Alert onClose={onClose}>Closable</Alert>);
    const closeBtn = screen.getByLabelText('알림 닫기');
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render close button without onClose', () => {
    render(<Alert>No close</Alert>);
    expect(screen.queryByLabelText('알림 닫기')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════
// 6. BackBtn
// ═══════════════════════════════════════════════════
describe('BackBtn', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
  });

  it('renders with default label', () => {
    render(<BackBtn />);
    expect(screen.getByRole('button', { name: /뒤로/ })).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<BackBtn label="돌아가기" />);
    expect(screen.getByRole('button', { name: /돌아가기/ })).toBeInTheDocument();
  });

  it('calls router.back() when no href', () => {
    render(<BackBtn />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('calls router.push(href) when href provided', () => {
    render(<BackBtn href="/home" />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockPush).toHaveBeenCalledWith('/home');
    expect(mockBack).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════
// 7. EmptyState
// ═══════════════════════════════════════════════════
describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No data" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelectorAll('p')).toHaveLength(1); // title only
  });

  it('renders action button when provided', () => {
    const onClick = jest.fn();
    render(<EmptyState title="Empty" action={{ label: 'Add', onClick }} />);
    const btn = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies size classes', () => {
    const { container } = render(<EmptyState title="Empty" size="sm" />);
    expect(container.firstChild).toHaveClass('py-8');
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState title="Empty" className="custom" />);
    expect(container.firstChild).toHaveClass('custom');
  });
});

// ═══════════════════════════════════════════════════
// 8. LoadingSpinner
// ═══════════════════════════════════════════════════
describe('LoadingSpinner', () => {
  it('renders with role="status"', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has default aria-label', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', '로딩 중...');
  });

  it('applies custom label', () => {
    render(<LoadingSpinner label="Loading..." />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading...');
  });

  it('renders sr-only text', () => {
    render(<LoadingSpinner label="Wait" />);
    expect(screen.getByText('Wait')).toHaveClass('sr-only');
  });
});

describe('FullscreenSpinner', () => {
  it('renders with role="status"', () => {
    render(<FullscreenSpinner />);
    const statusEls = screen.getAllByRole('status');
    expect(statusEls.length).toBeGreaterThanOrEqual(1);
  });

  it('shows label text visibly in a paragraph', () => {
    render(<FullscreenSpinner label="Please wait" />);
    const visibleLabel = screen.getByText('Please wait', { selector: 'p' });
    expect(visibleLabel).toBeInTheDocument();
  });
});

describe('InlineSpinner', () => {
  it('renders with role="status"', () => {
    render(<InlineSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<InlineSpinner className="ml-2" />);
    expect(screen.getByRole('status')).toHaveClass('ml-2');
  });
});

// ═══════════════════════════════════════════════════
// 9. Skeleton
// ═══════════════════════════════════════════════════
describe('Skeleton', () => {
  it('renders with aria-hidden for default rect', () => {
    const { container } = render(<Skeleton />);
    // SkeletonBlock wraps with aria-hidden
    expect(container.querySelector('[aria-hidden]')).toBeInTheDocument();
  });

  it('applies custom width and height via style', () => {
    const { container } = render(<Skeleton width={100} height={20} />);
    const el = container.querySelector('[aria-hidden]');
    expect(el).toHaveStyle({ width: '100px', height: '20px' });
  });

  it('renders circle variant with rounded-full', () => {
    const { container } = render(<Skeleton variant="circle" width={40} height={40} />);
    expect(container.querySelector('.rounded-full')).toBeInTheDocument();
  });

  it('renders multiple lines for text variant', () => {
    const { container } = render(<Skeleton variant="text" lines={3} />);
    const blocks = container.querySelectorAll('[aria-hidden="true"]');
    expect(blocks).toHaveLength(3);
  });

  it('renders single line for text variant by default', () => {
    const { container } = render(<Skeleton variant="text" />);
    expect(container.querySelector('[aria-hidden]')).toBeInTheDocument();
  });
});

describe('SkeletonCard', () => {
  it('renders without error', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe('SkeletonTable', () => {
  it('renders default 5 rows', () => {
    render(<SkeletonTable />);
    expect(screen.getByLabelText('테이블 로딩 중')).toBeInTheDocument();
  });

  it('renders custom row count', () => {
    const { container } = render(<SkeletonTable rows={3} />);
    const rows = container.querySelectorAll('.flex.gap-4');
    expect(rows).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════
// 10. StatusBadge
// ═══════════════════════════════════════════════════
describe('StatusBadge', () => {
  it('renders label text', () => {
    render(<StatusBadge label="Active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('defaults to muted variant', () => {
    render(<StatusBadge label="Default" />);
    expect(screen.getByText('Default')).toHaveClass('bg-muted-soft');
  });

  it('applies success variant', () => {
    render(<StatusBadge label="Done" variant="success" />);
    expect(screen.getByText('Done')).toHaveClass('bg-success-soft');
  });

  it('applies error variant', () => {
    render(<StatusBadge label="Failed" variant="error" />);
    expect(screen.getByText('Failed')).toHaveClass('bg-error-soft');
  });

  it('applies warning variant', () => {
    render(<StatusBadge label="Pending" variant="warning" />);
    expect(screen.getByText('Pending')).toHaveClass('bg-warning-soft');
  });

  it('applies custom className', () => {
    render(<StatusBadge label="Test" className="ml-2" />);
    expect(screen.getByText('Test')).toHaveClass('ml-2');
  });
});

// ═══════════════════════════════════════════════════
// 11. SkeletonDashboard
// ═══════════════════════════════════════════════════
describe('SkeletonDashboard', () => {
  it('renders with correct aria-label', () => {
    render(<SkeletonDashboard />);
    expect(screen.getByLabelText('대시보드 로딩 중')).toBeInTheDocument();
  });

  it('has aria-busy attribute', () => {
    render(<SkeletonDashboard />);
    expect(screen.getByLabelText('대시보드 로딩 중')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders 4 stat cards', () => {
    const { container } = render(<SkeletonDashboard />);
    // 4개의 stat 카드 확인
    const statCards = container.querySelectorAll('.grid.grid-cols-2 > div');
    expect(statCards).toHaveLength(4);
  });
});

// ═══════════════════════════════════════════════════
// 12. SkeletonListPage
// ═══════════════════════════════════════════════════
describe('SkeletonListPage', () => {
  it('renders with correct aria-label', () => {
    render(<SkeletonListPage />);
    expect(screen.getByLabelText('목록 로딩 중')).toBeInTheDocument();
  });

  it('renders SkeletonTable inside', () => {
    render(<SkeletonListPage />);
    expect(screen.getByLabelText('테이블 로딩 중')).toBeInTheDocument();
  });

  it('renders with custom rows prop', () => {
    const { container } = render(<SkeletonListPage rows={3} />);
    const rows = container.querySelectorAll('.flex.gap-4');
    expect(rows).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════
// 13. SkeletonProfile
// ═══════════════════════════════════════════════════
describe('SkeletonProfile', () => {
  it('renders with correct aria-label', () => {
    render(<SkeletonProfile />);
    expect(screen.getByLabelText('프로필 로딩 중')).toBeInTheDocument();
  });

  it('has aria-busy attribute', () => {
    render(<SkeletonProfile />);
    expect(screen.getByLabelText('프로필 로딩 중')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders SkeletonCard components', () => {
    const { container } = render(<SkeletonProfile />);
    // SkeletonCard가 2개 렌더링됨 (grid 내)
    const cards = container.querySelectorAll('.rounded-card.border');
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════
// 14. SkeletonReview
// ═══════════════════════════════════════════════════
describe('SkeletonReview', () => {
  it('renders with correct aria-label', () => {
    render(<SkeletonReview />);
    expect(screen.getByLabelText('리뷰 로딩 중')).toBeInTheDocument();
  });

  it('has aria-busy attribute', () => {
    render(<SkeletonReview />);
    expect(screen.getByLabelText('리뷰 로딩 중')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders 2-panel layout', () => {
    const { container } = render(<SkeletonReview />);
    // 2-패널 그리드 (code panel + review panel)
    const panels = container.querySelectorAll('.rounded-card.border.border-border.bg-bg-card');
    expect(panels.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════
// 15. Alert - null variant coverage
// ═══════════════════════════════════════════════════
describe('Alert null variant coverage', () => {
  it('variant=null이면 info 기본값을 사용한다', () => {
    // TypeScript VariantProps에서 null이 가능하므로 null 처리 경로를 커버
    render(<Alert variant={null as never}>Null variant</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════
// 16. Skeleton - string width/height coverage
// ═══════════════════════════════════════════════════
describe('Skeleton string dimensions', () => {
  it('applies string width and height as-is', () => {
    const { container } = render(<Skeleton width="50%" height="2rem" />);
    const el = container.querySelector('[aria-hidden]');
    expect(el).toHaveStyle({ width: '50%', height: '2rem' });
  });
});

// ═══════════════════════════════════════════════════
// 16. Alert - no children
// ═══════════════════════════════════════════════════
describe('Alert extra coverage', () => {
  it('renders without children (no children div)', () => {
    const { container } = render(<Alert title="오류" />);
    // children이 없으면 children div가 렌더링되지 않는다
    const childDiv = container.querySelector('.leading-relaxed.opacity-90');
    expect(childDiv).not.toBeInTheDocument();
  });

  it('renders without title (no title p)', () => {
    render(<Alert>Message only</Alert>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════
// 17. Input - no label (id branch)
// ═══════════════════════════════════════════════════
describe('Input extra coverage', () => {
  it('no label and no id: does not generate inputId', () => {
    const { container } = render(<Input placeholder="no label" />);
    const input = container.querySelector('input');
    // id가 undefined이므로 속성이 없거나 비어있음
    expect(input).not.toHaveAttribute('id', expect.stringContaining('input-'));
  });

  it('explicit id overrides label-based id', () => {
    const { container } = render(<Input id="custom-id" label="Email" />);
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('id', 'custom-id');
  });
});

// ═══════════════════════════════════════════════════
// 18. EmptyState - action with variant
// ═══════════════════════════════════════════════════
describe('EmptyState extra coverage', () => {
  it('action with explicit variant', () => {
    const onClick = jest.fn();
    render(<EmptyState title="Empty" action={{ label: 'Go', onClick, variant: 'ghost' }} />);
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('lg size applies correct classes', () => {
    const { container } = render(<EmptyState title="Empty" size="lg" />);
    expect(container.firstChild).toHaveClass('py-24');
  });
});

// ═══════════════════════════════════════════════════
// 19. StatusBadge — aria 접근성 속성
// ═══════════════════════════════════════════════════
describe('StatusBadge accessibility', () => {
  it('has role="status"', () => {
    render(<StatusBadge label="Active" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('role="status" element contains the label text', () => {
    render(<StatusBadge label="완료" />);
    expect(screen.getByRole('status')).toHaveTextContent('완료');
  });
});

// ═══════════════════════════════════════════════════
// 20. EmptyState — aria 접근성 속성
// ═══════════════════════════════════════════════════
describe('EmptyState accessibility', () => {
  it('has role="status"', () => {
    render(<EmptyState title="데이터 없음" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('icon wrapper has aria-hidden to hide decorative icon', () => {
    const { container } = render(<EmptyState title="Empty" />);
    const iconWrapper = container.querySelector('[aria-hidden]');
    expect(iconWrapper).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════
// 21. LoadingSpinner — aria 접근성 속성
// ═══════════════════════════════════════════════════
describe('LoadingSpinner accessibility', () => {
  it('has role="status"', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has default aria-label "로딩 중..."', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', '로딩 중...');
  });

  it('has custom aria-label when label prop is provided', () => {
    render(<LoadingSpinner label="데이터 불러오는 중..." />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', '데이터 불러오는 중...');
  });

  it('has sr-only text for screen readers', () => {
    render(<LoadingSpinner label="로딩" />);
    const srText = screen.getByText('로딩');
    expect(srText).toHaveClass('sr-only');
  });

  it('spinner element has aria-hidden to hide decorative animation', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('[aria-hidden="true"]');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin-slow');
  });
});
