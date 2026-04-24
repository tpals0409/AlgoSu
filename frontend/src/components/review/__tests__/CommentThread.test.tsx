import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { CommentThread } from '../CommentThread';
import type { ReviewComment } from '@/lib/api';

// ─── MOCKS ────────────────────────────────────────────────────────────────────

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Pencil: Icon,
    Trash2: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    MessageSquare: Icon,
  };
});

jest.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/components/review/ReplyItem', () => ({
  ReplyItem: ({ reply }: { reply: { publicId: string; content: string } }) => (
    <div data-testid={`reply-${reply.publicId}`}>{reply.content}</div>
  ),
}));

jest.mock('@/components/review/CommentForm', () => ({
  CommentForm: ({ onSubmit }: { onSubmit: (content: string) => Promise<void> }) => (
    <div data-testid="comment-form">
      <button
        type="button"
        onClick={() => onSubmit('test reply')}
        data-testid="reply-submit"
      >
        답글 등록
      </button>
    </div>
  ),
}));

// ─── TIME HELPERS ─────────────────────────────────────────────────────────────

const NOW = new Date('2025-01-15T12:00:00Z').getTime();

beforeAll(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ─── FACTORIES ────────────────────────────────────────────────────────────────

const makeComment = (overrides: Partial<ReviewComment> = {}): ReviewComment => ({
  publicId: 'c-1',
  submissionId: 'sub-1',
  authorId: 'user-abc-1234',
  studyId: 'study-1',
  lineNumber: 10,
  content: '좋은 코드네요',
  createdAt: new Date(NOW - 5 * 60000).toISOString(), // 5분 전
  updatedAt: new Date(NOW - 5 * 60000).toISOString(),
  replies: [],
  ...overrides,
});

const makeReply = (overrides: Partial<NonNullable<ReviewComment['replies']>[0]> = {}) => ({
  publicId: 'r-1',
  commentId: 'c-1',
  authorId: 'user-xyz',
  content: '감사합니다',
  createdAt: new Date(NOW - 2 * 60000).toISOString(),
  updatedAt: new Date(NOW - 2 * 60000).toISOString(),
  ...overrides,
});

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe('CommentThread', () => {
  const defaultProps = {
    currentUserId: 'user-abc-1234',
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onReply: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    defaultProps.onEdit = jest.fn();
    defaultProps.onDelete = jest.fn();
    defaultProps.onReply = jest.fn().mockResolvedValue(undefined);
  });

  // ── 기본 렌더링 ──

  it('댓글 목록을 렌더링한다', () => {
    const comments = [
      makeComment({ publicId: 'c-1', content: '첫번째 댓글' }),
      makeComment({ publicId: 'c-2', content: '두번째 댓글', authorId: 'other-user' }),
    ];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText('첫번째 댓글')).toBeInTheDocument();
    expect(screen.getByText('두번째 댓글')).toBeInTheDocument();
  });

  it('삭제된 댓글은 "삭제된 댓글입니다"로 표시된다', () => {
    const comments = [makeComment({ content: '' })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText('삭제된 댓글입니다')).toBeInTheDocument();
  });

  it('상대 시간을 표시한다 (5분 전)', () => {
    const comments = [makeComment()];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText('5분 전')).toBeInTheDocument();
  });

  it('댓글이 없으면 빈 상태 메시지를 표시한다', () => {
    renderWithI18n(<CommentThread {...defaultProps} comments={[]} />);
    expect(
      screen.getByText('코드 라인을 클릭하면 댓글을 확인하고 남길 수 있어요'),
    ).toBeInTheDocument();
  });

  it('선택된 라인에 댓글이 없으면 라인 안내 메시지를 표시한다', () => {
    renderWithI18n(<CommentThread {...defaultProps} comments={[]} selectedLine={5} />);
    expect(screen.getByText('Line 5에 아직 댓글이 없습니다')).toBeInTheDocument();
  });

  it('본인 댓글에 수정/삭제 버튼이 보인다', () => {
    const comments = [makeComment()];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByRole('button', { name: '댓글 수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '댓글 삭제' })).toBeInTheDocument();
  });

  it('다른 사용자의 댓글에 수정/삭제 버튼이 없다', () => {
    const comments = [makeComment({ authorId: 'other-user' })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.queryByRole('button', { name: '댓글 수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '댓글 삭제' })).not.toBeInTheDocument();
  });

  it('삭제 버튼 클릭 시 onDelete가 호출된다', () => {
    const comments = [makeComment()];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByRole('button', { name: '댓글 삭제' }));
    expect(defaultProps.onDelete).toHaveBeenCalledWith('c-1');
  });

  it('selectedLine 필터링이 동작한다', () => {
    const comments = [
      makeComment({ publicId: 'c-1', lineNumber: 10, content: '라인10 댓글' }),
      makeComment({ publicId: 'c-2', lineNumber: 20, content: '라인20 댓글' }),
    ];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} selectedLine={10} />);
    expect(screen.getByText('라인10 댓글')).toBeInTheDocument();
    expect(screen.queryByText('라인20 댓글')).not.toBeInTheDocument();
  });

  // ── formatRelativeTime 분기 (lines 46-50) ──

  it('방금 전 (1분 미만) 상대 시간을 "방금"으로 표시한다', () => {
    const comments = [
      makeComment({ createdAt: new Date(NOW - 30000).toISOString() }), // 30초 전
    ];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText('방금')).toBeInTheDocument();
  });

  it('1시간 이상 상대 시간을 시간 단위로 표시한다', () => {
    const comments = [
      makeComment({ createdAt: new Date(NOW - 2 * 3600000).toISOString() }), // 2시간 전
    ];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText('2시간 전')).toBeInTheDocument();
  });

  it('24시간 이상 상대 시간을 일 단위로 표시한다', () => {
    const comments = [
      makeComment({ createdAt: new Date(NOW - 3 * 86400000).toISOString() }), // 3일 전
    ];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText('3일 전')).toBeInTheDocument();
  });

  it('7일 이상일 때 날짜 형식으로 표시한다', () => {
    const pastDate = new Date(NOW - 10 * 86400000); // 10일 전
    const comments = [
      makeComment({ createdAt: pastDate.toISOString() }),
    ];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    // Should display localized date string (not relative time)
    // renderWithI18n provides 'ko' locale; review-time.ts calls toLocaleDateString(locale, opts)
    const expectedDate = pastDate.toLocaleDateString('ko', { month: 'short', day: 'numeric' });
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });

  // ── 수정 폼 (lines 136-173) ──

  it('수정 버튼 클릭 시 편집 모드로 전환된다', () => {
    const comments = [makeComment({ content: '원본 댓글' })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByRole('button', { name: '댓글 수정' }));
    // textarea with aria-label 댓글 수정 appears
    expect(screen.getByRole('textbox', { name: '댓글 수정' })).toBeInTheDocument();
    // 원본 댓글 텍스트는 textarea 안에 있음
    expect(screen.getByDisplayValue('원본 댓글')).toBeInTheDocument();
  });

  it('편집 모드에서 저장 버튼 클릭 시 onEdit이 호출된다', () => {
    const comments = [makeComment({ content: '원본 댓글' })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByRole('button', { name: '댓글 수정' }));
    const textarea = screen.getByRole('textbox', { name: '댓글 수정' });
    fireEvent.change(textarea, { target: { value: '수정된 댓글' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(defaultProps.onEdit).toHaveBeenCalledWith('c-1', '수정된 댓글');
  });

  it('편집 모드에서 내용 미변경 시 onEdit이 호출되지 않는다', () => {
    const comments = [makeComment({ content: '원본 댓글' })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByRole('button', { name: '댓글 수정' }));
    // 내용 변경 없이 저장 클릭
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(defaultProps.onEdit).not.toHaveBeenCalled();
  });

  it('편집 모드에서 빈 내용으로 저장 시 onEdit이 호출되지 않는다', () => {
    const comments = [makeComment({ content: '원본 댓글' })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByRole('button', { name: '댓글 수정' }));
    const textarea = screen.getByRole('textbox', { name: '댓글 수정' });
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(defaultProps.onEdit).not.toHaveBeenCalled();
  });

  it('저장 후 편집 모드가 종료된다', () => {
    const comments = [makeComment({ content: '원본 댓글' })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByRole('button', { name: '댓글 수정' }));
    const textarea = screen.getByRole('textbox', { name: '댓글 수정' });
    fireEvent.change(textarea, { target: { value: '수정된 댓글' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(screen.queryByRole('textbox', { name: '댓글 수정' })).not.toBeInTheDocument();
  });

  it('취소 버튼 클릭 시 편집 모드가 종료되고 내용이 복원된다', () => {
    const comments = [makeComment({ content: '원본 댓글' })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByRole('button', { name: '댓글 수정' }));
    const textarea = screen.getByRole('textbox', { name: '댓글 수정' });
    fireEvent.change(textarea, { target: { value: '임시 수정' } });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    // 편집 모드 종료
    expect(screen.queryByRole('textbox', { name: '댓글 수정' })).not.toBeInTheDocument();
    // 원본 내용이 보인다
    expect(screen.getByText('원본 댓글')).toBeInTheDocument();
  });

  it('편집 중에는 수정/삭제 버튼이 숨겨진다', () => {
    const comments = [makeComment({ content: '원본 댓글' })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByRole('button', { name: '댓글 수정' }));
    // 편집 중에는 수정/삭제 버튼이 없어야 함
    expect(screen.queryByRole('button', { name: '댓글 수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '댓글 삭제' })).not.toBeInTheDocument();
  });

  // ── 대댓글 토글 (lines 194-225) ──

  it('대댓글이 있으면 답글 버튼이 표시된다', () => {
    const reply = makeReply();
    const comments = [makeComment({ replies: [reply] })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText(/답글 1/)).toBeInTheDocument();
  });

  it('대댓글이 없으면 답글 버튼이 표시되지 않는다', () => {
    const comments = [makeComment({ replies: [] })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.queryByText(/답글/)).not.toBeInTheDocument();
  });

  it('답글 버튼 클릭 시 대댓글 목록이 표시된다', () => {
    const reply = makeReply({ publicId: 'r-1', content: '답글 내용' });
    const comments = [makeComment({ replies: [reply] })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByText(/답글 1/));
    expect(screen.getByTestId('reply-r-1')).toBeInTheDocument();
  });

  it('답글 목록이 열릴 때 CommentForm이 표시된다', () => {
    const reply = makeReply();
    const comments = [makeComment({ replies: [reply] })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByText(/답글 1/));
    expect(screen.getByTestId('comment-form')).toBeInTheDocument();
  });

  it('답글 재클릭 시 대댓글 목록이 닫힌다', () => {
    const reply = makeReply({ publicId: 'r-1' });
    const comments = [makeComment({ replies: [reply] })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    const toggleBtn = screen.getByText(/답글 1/);
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('reply-r-1')).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId('reply-r-1')).not.toBeInTheDocument();
  });

  it('답글 CommentForm에서 onReply를 호출한다', async () => {
    const reply = makeReply();
    const comments = [makeComment({ publicId: 'c-1', replies: [reply] })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByText(/답글 1/));
    fireEvent.click(screen.getByTestId('reply-submit'));
    await waitFor(() => {
      expect(defaultProps.onReply).toHaveBeenCalledWith('c-1', 'test reply');
    });
  });

  it('여러 대댓글이 있을 때 모두 표시된다', () => {
    const replies = [
      makeReply({ publicId: 'r-1', content: '첫 답글' }),
      makeReply({ publicId: 'r-2', content: '두번째 답글' }),
    ];
    const comments = [makeComment({ replies })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByText(/답글 2/));
    expect(screen.getByTestId('reply-r-1')).toBeInTheDocument();
    expect(screen.getByTestId('reply-r-2')).toBeInTheDocument();
  });

  // ── lineNumber 표시 ──

  it('lineNumber가 있는 댓글에 라인 정보가 표시된다', () => {
    const comments = [makeComment({ lineNumber: 42 })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText('L42')).toBeInTheDocument();
  });

  it('selectedLine이 있을 때 "Line N" 헤더가 표시된다', () => {
    const comments = [makeComment({ lineNumber: 10 })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} selectedLine={10} />);
    expect(screen.getByText('Line 10')).toBeInTheDocument();
  });

  // ── 본인 여부 배지 ──

  it('본인 댓글에 "나" 배지가 표시된다', () => {
    const comments = [makeComment({ authorId: 'user-abc-1234' })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText('나')).toBeInTheDocument();
  });

  it('다른 사용자 댓글에 "나" 배지가 없다', () => {
    const comments = [makeComment({ authorId: 'other-user' })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.queryByText('나')).not.toBeInTheDocument();
  });

  it('replies가 undefined인 댓글도 렌더링된다', () => {
    const comments = [makeComment({ replies: undefined })];
    renderWithI18n(<CommentThread {...defaultProps} comments={comments} />);
    // replies가 undefined이어도 오류 없이 렌더링
    expect(screen.getByText('좋은 코드네요')).toBeInTheDocument();
    // 답글 버튼이 없어야 한다
    expect(screen.queryByText(/답글/)).not.toBeInTheDocument();
  });
});
