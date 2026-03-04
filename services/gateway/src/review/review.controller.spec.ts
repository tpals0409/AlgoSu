import { HttpException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReviewProxyController } from './review.controller';

// --- global fetch 모킹 ---
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ReviewProxyController', () => {
  let controller: ReviewProxyController;

  const SUBMISSION_URL = 'http://submission:3000';
  const INTERNAL_KEY = 'test-internal-key';
  const PUBLIC_ID = '550e8400-e29b-41d4-a716-446655440000';

  function createMockReq(overrides: Record<string, unknown> = {}) {
    return {
      headers: {
        'x-user-id': 'user-id-1',
        'x-study-id': 'study-id-1',
      },
      query: {},
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    const configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'SUBMISSION_SERVICE_URL') return SUBMISSION_URL;
        if (key === 'INTERNAL_KEY_SUBMISSION') return INTERNAL_KEY;
        return undefined;
      }),
    };

    controller = new ReviewProxyController(
      configService as unknown as ConfigService,
    );
  });

  // ─── COMMENTS ──────────────────────────────

  describe('createComment', () => {
    it('POST /review/comments 프록시 — 201 응답', async () => {
      const body = { content: '좋은 풀이입니다', submissionId: 'sub-1' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: 'comment-1', ...body }),
      });

      const result = await controller.createComment(createMockReq() as never, body);

      expect(mockFetch).toHaveBeenCalledWith(
        `${SUBMISSION_URL}/review/comments`,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result).toEqual(expect.objectContaining({ id: 'comment-1' }));
    });
  });

  describe('findComments', () => {
    it('GET /review/comments?submissionId=... 프록시', async () => {
      const req = createMockReq({
        query: { submissionId: 'sub-1', studyId: 'study-1' },
      });
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

      await controller.findComments(req as never);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('submissionId=sub-1'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('updateComment', () => {
    it('PATCH /review/comments/:id 프록시', async () => {
      const body = { content: '수정된 댓글' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: PUBLIC_ID, ...body }),
      });

      const result = await controller.updateComment(
        PUBLIC_ID,
        createMockReq() as never,
        body,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        `${SUBMISSION_URL}/review/comments/${PUBLIC_ID}`,
        expect.objectContaining({ method: 'PATCH' }),
      );
      expect(result).toEqual(expect.objectContaining({ content: '수정된 댓글' }));
    });
  });

  describe('deleteComment', () => {
    it('DELETE /review/comments/:id 프록시 — 204 응답', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      });

      const result = await controller.deleteComment(PUBLIC_ID, createMockReq() as never);

      expect(mockFetch).toHaveBeenCalledWith(
        `${SUBMISSION_URL}/review/comments/${PUBLIC_ID}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(result).toBeUndefined();
    });
  });

  // ─── REPLIES ───────────────────────────────

  describe('createReply', () => {
    it('POST /review/replies 프록시', async () => {
      const body = { content: '대댓글', commentPublicId: 'comment-1' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: 'reply-1', ...body }),
      });

      const result = await controller.createReply(createMockReq() as never, body);

      expect(mockFetch).toHaveBeenCalledWith(
        `${SUBMISSION_URL}/review/replies`,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result).toEqual(expect.objectContaining({ id: 'reply-1' }));
    });
  });

  describe('findReplies', () => {
    it('GET /review/replies?commentPublicId=... 프록시', async () => {
      const req = createMockReq({ query: { commentPublicId: 'comment-1' } });
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

      await controller.findReplies(req as never);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('commentPublicId=comment-1'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('updateReply', () => {
    it('PATCH /review/replies/:publicId 프록시', async () => {
      const body = { content: '수정된 답글' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: PUBLIC_ID, ...body }),
      });

      await controller.updateReply(PUBLIC_ID, createMockReq() as never, body);

      expect(mockFetch).toHaveBeenCalledWith(
        `${SUBMISSION_URL}/review/replies/${PUBLIC_ID}`,
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('deleteReply', () => {
    it('DELETE /review/replies/:publicId 프록시 — 204 응답', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      });

      await controller.deleteReply(PUBLIC_ID, createMockReq() as never);

      expect(mockFetch).toHaveBeenCalledWith(
        `${SUBMISSION_URL}/review/replies/${PUBLIC_ID}`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  // ─── 에러 핸들링 ──────────────────────────

  describe('프록시 에러 핸들링', () => {
    it('Submission Service 4xx 에러 → HttpException 전파', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: '잘못된 요청', statusCode: 400 }),
      });

      await expect(
        controller.createComment(createMockReq() as never, {}),
      ).rejects.toThrow(HttpException);
    });

    it('네트워크 에러 → InternalServerErrorException', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        controller.createComment(createMockReq() as never, {}),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
