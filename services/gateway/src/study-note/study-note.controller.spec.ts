import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StudyNoteProxyController } from './study-note.controller';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('StudyNoteProxyController', () => {
  let controller: StudyNoteProxyController;

  const SUBMISSION_URL = 'http://submission:3000';
  const INTERNAL_KEY = 'test-internal-key';
  const USER_ID = 'user-id-1';
  const STUDY_ID = 'study-id-1';
  const PROBLEM_ID = '550e8400-e29b-41d4-a716-446655440000';

  function createMockReq(overrides: Record<string, unknown> = {}) {
    return {
      headers: {
        'x-user-id': USER_ID,
        'x-study-id': STUDY_ID,
        'x-request-id': 'req-1',
      },
      ...overrides,
    } as never;
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

    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    controller = new StudyNoteProxyController(
      configService as unknown as ConfigService,
      mockLogger as any,
    );
  });

  describe('upsert', () => {
    it('PUT /study-notes 프록시 — 정상 응답', async () => {
      const body = { problemId: PROBLEM_ID, content: '메모 내용' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'note-1', ...body }),
      });

      const result = await controller.upsert(createMockReq(), body);

      expect(mockFetch).toHaveBeenCalledWith(
        `${SUBMISSION_URL}/study-notes`,
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(result).toEqual(expect.objectContaining({ id: 'note-1' }));
    });

    it('PUT /study-notes 프록시 — 204 응답시 undefined', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 204 });

      const result = await controller.upsert(createMockReq(), {});

      expect(result).toBeUndefined();
    });
  });

  describe('find', () => {
    it('GET /study-notes?problemId=... 프록시', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ content: '메모' }),
      });

      const result = await controller.find(PROBLEM_ID, createMockReq());

      expect(mockFetch).toHaveBeenCalledWith(
        `${SUBMISSION_URL}/study-notes?problemId=${PROBLEM_ID}`,
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result).toEqual({ content: '메모' });
    });
  });

  describe('프록시 에러 핸들링', () => {
    it('upstream 4xx 에러 → HttpException 전파', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found', statusCode: 404 }),
      });

      await expect(controller.upsert(createMockReq(), {})).rejects.toThrow(HttpException);
    });

    it('네트워크 에러 → 502 Bad Gateway', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      try {
        await controller.upsert(createMockReq(), {});
        fail('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      }
    });
  });
});
