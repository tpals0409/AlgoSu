import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/i18n';
import { ReplyItem } from '../ReplyItem';
import type { ReviewReply } from '@/lib/api';

jest.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

const NOW = new Date('2025-01-15T12:00:00Z').getTime();

beforeAll(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterAll(() => {
  jest.restoreAllMocks();
});

const makeReply = (overrides: Partial<ReviewReply> = {}): ReviewReply => ({
  publicId: 'r-1',
  authorId: 'user-abc-1234',
  content: '답글 내용입니다',
  createdAt: new Date(NOW - 10 * 60000).toISOString(),
  updatedAt: new Date(NOW - 10 * 60000).toISOString(),
  ...overrides,
});

describe('ReplyItem', () => {
  it('답글 내용을 렌더링한다', () => {
    renderWithI18n(<ReplyItem reply={makeReply()} currentUserId="user-abc-1234" />);
    expect(screen.getByText('답글 내용입니다')).toBeInTheDocument();
  });

  it('작성자 ID 앞 8자를 표시한다', () => {
    renderWithI18n(<ReplyItem reply={makeReply()} currentUserId="other" />);
    expect(screen.getByText('user-abc')).toBeInTheDocument();
  });

  it('아바타에 작성자 ID 앞 2자를 대문자로 표시한다', () => {
    renderWithI18n(<ReplyItem reply={makeReply()} currentUserId="other" />);
    expect(screen.getByText('US')).toBeInTheDocument();
  });

  it('본인 댓글이면 "나" 배지를 표시한다', () => {
    renderWithI18n(<ReplyItem reply={makeReply()} currentUserId="user-abc-1234" />);
    expect(screen.getByText('나')).toBeInTheDocument();
  });

  it('다른 사용자의 댓글이면 "나" 배지가 없다', () => {
    renderWithI18n(<ReplyItem reply={makeReply()} currentUserId="other-user" />);
    expect(screen.queryByText('나')).not.toBeInTheDocument();
  });

  it('상대 시간을 표시한다 (10분 전)', () => {
    renderWithI18n(<ReplyItem reply={makeReply()} currentUserId="other" />);
    expect(screen.getByText('10분 전')).toBeInTheDocument();
  });

  it('1시간 이상 경과 시 시간 단위로 표시한다', () => {
    const reply = makeReply({
      createdAt: new Date(NOW - 3 * 3600000).toISOString(),
    });
    renderWithI18n(<ReplyItem reply={reply} currentUserId="other" />);
    expect(screen.getByText('3시간 전')).toBeInTheDocument();
  });

  it('방금 작성된 댓글은 "방금"으로 표시한다', () => {
    const reply = makeReply({
      createdAt: new Date(NOW - 10000).toISOString(),
    });
    renderWithI18n(<ReplyItem reply={reply} currentUserId="other" />);
    expect(screen.getByText('방금')).toBeInTheDocument();
  });

  it('7일 이상 경과 시 날짜 형식으로 표시한다', () => {
    const reply = makeReply({
      createdAt: new Date(NOW - 10 * 24 * 3600000).toISOString(),
    });
    renderWithI18n(<ReplyItem reply={reply} currentUserId="other" />);
    // renderWithI18n provides 'ko' locale; formatReviewRelativeTime calls toLocaleDateString(locale, opts)
    const expectedDate = new Date(NOW - 10 * 24 * 3600000).toLocaleDateString('ko', { month: 'short', day: 'numeric' });
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
  });

  it('6일 경과 시 일 단위로 표시한다', () => {
    const reply = makeReply({
      createdAt: new Date(NOW - 6 * 24 * 3600000).toISOString(),
    });
    renderWithI18n(<ReplyItem reply={reply} currentUserId="other" />);
    expect(screen.getByText('6일 전')).toBeInTheDocument();
  });
});
