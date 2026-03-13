/**
 * @file GuestContext 테스트 — Provider 렌더링, 로딩/에러 상태 관리
 * @domain share
 * @layer test
 */
import { render, screen, waitFor } from '@testing-library/react';
import { GuestProvider, useGuest } from '../GuestContext';
import type { SharedStudyData } from '@/lib/api';

/* ── mock ── */

const mockGetSharedStudy = jest.fn<Promise<SharedStudyData>, [string]>();

jest.mock('@/lib/api', () => ({
  publicApi: {
    getSharedStudy: (...args: unknown[]) => mockGetSharedStudy(...(args as [string])),
  },
}));

/* ── helper component ── */

function Consumer() {
  const ctx = useGuest();
  return (
    <div>
      <span data-testid="isGuest">{String(ctx.isGuest)}</span>
      <span data-testid="token">{ctx.token}</span>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="error">{ctx.error ?? 'none'}</span>
      <span data-testid="studyName">{ctx.studyData?.studyName ?? 'null'}</span>
      <span data-testid="createdBy">{ctx.createdByUserId ?? 'null'}</span>
    </div>
  );
}

const MOCK_STUDY: SharedStudyData = {
  studyName: 'Test Study',
  memberCount: 3,
  createdBy: { id: 'creator-1', name: 'Creator', avatarUrl: null },
  members: [
    { userId: 'creator-1', nickname: 'Creator', role: 'OWNER' },
    { userId: 'member-2', nickname: 'Member2', role: 'MEMBER' },
    { userId: 'member-3', nickname: 'Member3', role: 'MEMBER' },
  ],
};

/* ── tests ── */

beforeEach(() => {
  mockGetSharedStudy.mockReset();
});

describe('GuestContext', () => {
  describe('Provider 렌더링', () => {
    it('토큰으로 publicApi.getSharedStudy를 호출한다', async () => {
      mockGetSharedStudy.mockResolvedValue(MOCK_STUDY);

      render(
        <GuestProvider token="test-token-123">
          <Consumer />
        </GuestProvider>,
      );

      await waitFor(() => {
        expect(mockGetSharedStudy).toHaveBeenCalledWith('test-token-123');
      });
    });

    it('성공 시 studyData와 createdByUserId를 제공한다', async () => {
      mockGetSharedStudy.mockResolvedValue(MOCK_STUDY);

      render(
        <GuestProvider token="test-token-123">
          <Consumer />
        </GuestProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('studyName')).toHaveTextContent('Test Study');
      });

      expect(screen.getByTestId('isGuest')).toHaveTextContent('true');
      expect(screen.getByTestId('token')).toHaveTextContent('test-token-123');
      expect(screen.getByTestId('createdBy')).toHaveTextContent('creator-1');
      expect(screen.getByTestId('error')).toHaveTextContent('none');
    });
  });

  describe('로딩 상태 관리', () => {
    it('초기 로딩 상태는 true이다', () => {
      mockGetSharedStudy.mockReturnValue(new Promise(() => {})); // never resolves

      render(
        <GuestProvider token="test-token">
          <Consumer />
        </GuestProvider>,
      );

      expect(screen.getByTestId('loading')).toHaveTextContent('true');
      expect(screen.getByTestId('studyName')).toHaveTextContent('null');
    });

    it('API 호출 완료 후 loading이 false로 변경된다', async () => {
      mockGetSharedStudy.mockResolvedValue(MOCK_STUDY);

      render(
        <GuestProvider token="test-token">
          <Consumer />
        </GuestProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });
  });

  describe('에러 상태 관리', () => {
    it('API 호출 실패 시 에러 메시지를 설정한다', async () => {
      mockGetSharedStudy.mockRejectedValue(new Error('Network error'));

      render(
        <GuestProvider token="invalid-token">
          <Consumer />
        </GuestProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          '공유 링크가 유효하지 않거나 만료되었습니다.',
        );
      });

      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('studyName')).toHaveTextContent('null');
    });

    it('유효하지 않은 토큰 → 에러 처리', async () => {
      mockGetSharedStudy.mockRejectedValue(new Error('404 Not Found'));

      render(
        <GuestProvider token="">
          <Consumer />
        </GuestProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          '공유 링크가 유효하지 않거나 만료되었습니다.',
        );
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });
  });

  describe('useGuest 기본값', () => {
    it('Provider 없이 사용 시 기본값을 반환한다', () => {
      render(<Consumer />);

      expect(screen.getByTestId('isGuest')).toHaveTextContent('false');
      expect(screen.getByTestId('token')).toHaveTextContent('');
      expect(screen.getByTestId('loading')).toHaveTextContent('true');
      expect(screen.getByTestId('error')).toHaveTextContent('none');
      expect(screen.getByTestId('studyName')).toHaveTextContent('null');
    });
  });
});
