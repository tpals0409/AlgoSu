import { render, screen, fireEvent } from '@testing-library/react';
import { CommentThread } from '../CommentThread';
import type { ReviewComment } from '@/lib/api';

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
  CommentForm: () => <div data-testid="comment-form" />,
}));

const NOW = new Date('2025-01-15T12:00:00Z').getTime();

beforeAll(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterAll(() => {
  jest.restoreAllMocks();
});

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

describe('CommentThread', () => {
  const defaultProps = {
    currentUserId: 'user-abc-1234',
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onReply: jest.fn().mockResolvedValue(undefined),
  };

  it('댓글 목록을 렌더링한다', () => {
    const comments = [
      makeComment({ publicId: 'c-1', content: '첫번째 댓글' }),
      makeComment({ publicId: 'c-2', content: '두번째 댓글', authorId: 'other-user' }),
    ];
    render(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText('첫번째 댓글')).toBeInTheDocument();
    expect(screen.getByText('두번째 댓글')).toBeInTheDocument();
  });

  it('삭제된 댓글은 "삭제된 댓글입니다"로 표시된다', () => {
    const comments = [makeComment({ content: '' })];
    render(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText('삭제된 댓글입니다')).toBeInTheDocument();
  });

  it('상대 시간을 표시한다 (5분 전)', () => {
    const comments = [makeComment()];
    render(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByText('5분 전')).toBeInTheDocument();
  });

  it('댓글이 없으면 빈 상태 메시지를 표시한다', () => {
    render(<CommentThread {...defaultProps} comments={[]} />);
    expect(
      screen.getByText('코드 라인을 클릭하면 댓글을 확인하고 남길 수 있어요'),
    ).toBeInTheDocument();
  });

  it('선택된 라인에 댓글이 없으면 라인 안내 메시지를 표시한다', () => {
    render(<CommentThread {...defaultProps} comments={[]} selectedLine={5} />);
    expect(screen.getByText('Line 5에 아직 댓글이 없습니다')).toBeInTheDocument();
  });

  it('본인 댓글에 수정/삭제 버튼이 보인다', () => {
    const comments = [makeComment()];
    render(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.getByRole('button', { name: '댓글 수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '댓글 삭제' })).toBeInTheDocument();
  });

  it('다른 사용자의 댓글에 수정/삭제 버튼이 없다', () => {
    const comments = [makeComment({ authorId: 'other-user' })];
    render(<CommentThread {...defaultProps} comments={comments} />);
    expect(screen.queryByRole('button', { name: '댓글 수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '댓글 삭제' })).not.toBeInTheDocument();
  });

  it('삭제 버튼 클릭 시 onDelete가 호출된다', () => {
    const comments = [makeComment()];
    render(<CommentThread {...defaultProps} comments={comments} />);
    fireEvent.click(screen.getByRole('button', { name: '댓글 삭제' }));
    expect(defaultProps.onDelete).toHaveBeenCalledWith('c-1');
  });

  it('selectedLine 필터링이 동작한다', () => {
    const comments = [
      makeComment({ publicId: 'c-1', lineNumber: 10, content: '라인10 댓글' }),
      makeComment({ publicId: 'c-2', lineNumber: 20, content: '라인20 댓글' }),
    ];
    render(<CommentThread {...defaultProps} comments={comments} selectedLine={10} />);
    expect(screen.getByText('라인10 댓글')).toBeInTheDocument();
    expect(screen.queryByText('라인20 댓글')).not.toBeInTheDocument();
  });
});
