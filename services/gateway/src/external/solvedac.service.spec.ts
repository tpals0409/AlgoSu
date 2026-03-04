import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { SolvedacService } from './solvedac.service';

// --- global fetch 모킹 ---
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SolvedacService', () => {
  let service: SolvedacService;

  beforeEach(() => {
    jest.clearAllMocks();
    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    service = new SolvedacService(mockLogger as any);
  });

  describe('fetchProblem', () => {
    const PROBLEM_ID = 1000;

    const mockApiResponse = {
      problemId: PROBLEM_ID,
      titleKo: 'A+B',
      level: 1,
      tags: [
        {
          displayNames: [
            { language: 'ko', name: '구현' },
            { language: 'en', name: 'implementation' },
          ],
        },
        {
          displayNames: [
            { language: 'ko', name: '수학' },
            { language: 'en', name: 'math' },
          ],
        },
      ],
    };

    it('정상 응답 — 문제 정보 변환 반환', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      });

      const result = await service.fetchProblem(PROBLEM_ID);

      expect(result).toEqual({
        problemId: PROBLEM_ID,
        title: 'A+B',
        difficulty: 'BRONZE',
        level: 1,
        sourceUrl: `https://www.acmicpc.net/problem/${PROBLEM_ID}`,
        tags: ['구현', '수학'],
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`problemId=${PROBLEM_ID}`),
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        }),
      );
    });

    it('레벨별 난이도 매핑 — SILVER(6~10)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ...mockApiResponse, level: 8 }),
      });

      const result = await service.fetchProblem(PROBLEM_ID);
      expect(result.difficulty).toBe('SILVER');
    });

    it('레벨별 난이도 매핑 — GOLD(11~15)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ...mockApiResponse, level: 13 }),
      });

      const result = await service.fetchProblem(PROBLEM_ID);
      expect(result.difficulty).toBe('GOLD');
    });

    it('레벨별 난이도 매핑 — PLATINUM(16~20)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ...mockApiResponse, level: 18 }),
      });

      const result = await service.fetchProblem(PROBLEM_ID);
      expect(result.difficulty).toBe('PLATINUM');
    });

    it('레벨별 난이도 매핑 — DIAMOND(21+)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ...mockApiResponse, level: 25 }),
      });

      const result = await service.fetchProblem(PROBLEM_ID);
      expect(result.difficulty).toBe('DIAMOND');
    });

    it('레벨 0 → difficulty null', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ...mockApiResponse, level: 0 }),
      });

      const result = await service.fetchProblem(PROBLEM_ID);
      expect(result.difficulty).toBeNull();
    });

    it('404 응답 → NotFoundException', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(service.fetchProblem(99999)).rejects.toThrow(NotFoundException);
    });

    it('5xx 응답 → ServiceUnavailableException', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(service.fetchProblem(PROBLEM_ID)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('네트워크 에러 → ServiceUnavailableException', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.fetchProblem(PROBLEM_ID)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('한국어 태그 없으면 영어 태그 사용', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ...mockApiResponse,
          tags: [
            {
              displayNames: [
                { language: 'en', name: 'greedy' },
              ],
            },
          ],
        }),
      });

      const result = await service.fetchProblem(PROBLEM_ID);
      expect(result.tags).toEqual(['greedy']);
    });
  });
});
