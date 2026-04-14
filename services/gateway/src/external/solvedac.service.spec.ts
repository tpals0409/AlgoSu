/**
 * @file SolvedacService 단위 테스트
 * @domain problem
 * @layer service
 *
 * wget subprocess (child_process.execFile + util.promisify) 를 모킹한다.
 * Cloudflare TLS JA3 차단으로 fetch 대신 wget 을 사용하므로 테스트도 그에 맞춰 재작성.
 */
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';

// --- wget subprocess 모킹 ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockWget = jest.fn<Promise<{ stdout: string; stderr: string }>, any[]>();

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('node:util', () => ({
  promisify:
    () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (...args: any[]) =>
      mockWget(...args),
}));

// mock 선언 이후에 import 해야 promisify mock 이 적용된다
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SolvedacService } = require('./solvedac.service');
type SolvedacServiceType = InstanceType<typeof SolvedacService>;

/** wget 실패 시뮬레이션 헬퍼 — stderr 에 HTTP status 가 포함된 에러를 throw */
function wgetHttpError(status: number, extra = '') {
  const err = new Error(
    `Command failed: wget... server returned error: HTTP/1.1 ${status} ${extra}`,
  ) as Error & { stderr: string; code: number };
  err.stderr = `server returned error: HTTP/1.1 ${status} ${extra}\n`;
  err.code = 8;
  return err;
}

describe('SolvedacService', () => {
  let service: SolvedacServiceType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWget.mockReset();
    const mockLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      mockWget.mockResolvedValue({
        stdout: JSON.stringify(mockApiResponse),
        stderr: '',
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
      expect(mockWget).toHaveBeenCalledWith(
        'wget',
        expect.arrayContaining([
          '-q',
          '-O',
          '-',
          expect.stringMatching(/^--timeout=/),
          expect.stringContaining(`problemId=${PROBLEM_ID}`),
        ]),
        expect.objectContaining({ timeout: expect.any(Number) }),
      );
    });

    it('stdout Buffer 형태도 처리', async () => {
      mockWget.mockResolvedValue({
        stdout: Buffer.from(JSON.stringify(mockApiResponse)) as unknown as string,
        stderr: '',
      });

      const result = await service.fetchProblem(PROBLEM_ID);
      expect(result.title).toBe('A+B');
    });

    it.each([
      [8, 'SILVER'],
      [13, 'GOLD'],
      [18, 'PLATINUM'],
      [23, 'DIAMOND'],
      [28, 'RUBY'],
    ])('레벨 %i → %s', async (level, expected) => {
      mockWget.mockResolvedValue({
        stdout: JSON.stringify({ ...mockApiResponse, level }),
        stderr: '',
      });

      const result = await service.fetchProblem(PROBLEM_ID);
      expect(result.difficulty).toBe(expected);
    });

    it('레벨 0 → difficulty null', async () => {
      mockWget.mockResolvedValue({
        stdout: JSON.stringify({ ...mockApiResponse, level: 0 }),
        stderr: '',
      });

      const result = await service.fetchProblem(PROBLEM_ID);
      expect(result.difficulty).toBeNull();
    });

    it('404 응답 → NotFoundException', async () => {
      mockWget.mockRejectedValue(wgetHttpError(404, 'Not Found'));

      await expect(service.fetchProblem(99999)).rejects.toThrow(NotFoundException);
    });

    it('5xx 응답 → ServiceUnavailableException', async () => {
      mockWget.mockRejectedValue(wgetHttpError(500, 'Internal Server Error'));

      await expect(service.fetchProblem(PROBLEM_ID)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('네트워크 에러(stderr 없음) → ServiceUnavailableException', async () => {
      mockWget.mockRejectedValue(new Error('ETIMEDOUT'));

      await expect(service.fetchProblem(PROBLEM_ID)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('비-Error 객체 throw → ServiceUnavailableException', async () => {
      mockWget.mockRejectedValue('string-error');

      await expect(service.fetchProblem(PROBLEM_ID)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('stderr Buffer 형태 — HTTP status 파싱', async () => {
      const err = new Error('cmd failed') as Error & { stderr: Buffer };
      err.stderr = Buffer.from('server returned error: HTTP/1.1 404 Not Found\n');
      mockWget.mockRejectedValue(err);

      await expect(service.fetchProblem(PROBLEM_ID)).rejects.toThrow(NotFoundException);
    });

    it('JSON 파싱 실패 → ServiceUnavailableException', async () => {
      mockWget.mockResolvedValue({
        stdout: '<html>not json</html>',
        stderr: '',
      });

      await expect(service.fetchProblem(PROBLEM_ID)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('한국어 태그 없으면 영어 태그 사용', async () => {
      mockWget.mockResolvedValue({
        stdout: JSON.stringify({
          ...mockApiResponse,
          tags: [{ displayNames: [{ language: 'en', name: 'greedy' }] }],
        }),
        stderr: '',
      });

      const result = await service.fetchProblem(PROBLEM_ID);
      expect(result.tags).toEqual(['greedy']);
    });

    it('displayNames 비어있는 태그 — filter 제외', async () => {
      mockWget.mockResolvedValue({
        stdout: JSON.stringify({
          ...mockApiResponse,
          tags: [
            { displayNames: [] },
            { displayNames: [{ language: 'ko', name: '수학' }] },
          ],
        }),
        stderr: '',
      });

      const result = await service.fetchProblem(PROBLEM_ID);
      expect(result.tags).toEqual(['수학']);
    });
  });

  describe('searchProblem', () => {
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

    it('정상 응답 변환', async () => {
      mockWget.mockResolvedValue({
        stdout: JSON.stringify({ count: 1, items: [mockApiResponse] }),
        stderr: '',
      });

      const result = await service.searchProblem('A+B', 1);

      expect(result).toEqual({
        count: 1,
        items: [
          {
            problemId: PROBLEM_ID,
            titleKo: 'A+B',
            level: 1,
            difficulty: 'BRONZE',
            sourceUrl: `https://www.acmicpc.net/problem/${PROBLEM_ID}`,
            tags: ['구현', '수학'],
          },
        ],
      });
      expect(mockWget).toHaveBeenCalledWith(
        'wget',
        expect.arrayContaining([
          expect.stringContaining('search/problem?query=A%2BB&page=1'),
        ]),
        expect.any(Object),
      );
    });

    it('기본 page=1', async () => {
      mockWget.mockResolvedValue({
        stdout: JSON.stringify({ count: 0, items: [] }),
        stderr: '',
      });

      await service.searchProblem('hello');

      expect(mockWget).toHaveBeenCalledWith(
        'wget',
        expect.arrayContaining([expect.stringContaining('page=1')]),
        expect.any(Object),
      );
    });

    it('404 → NotFoundException', async () => {
      mockWget.mockRejectedValue(wgetHttpError(404, 'Not Found'));
      await expect(service.searchProblem('x')).rejects.toThrow(NotFoundException);
    });

    it('5xx → ServiceUnavailableException', async () => {
      mockWget.mockRejectedValue(wgetHttpError(500, 'Internal Server Error'));
      await expect(service.searchProblem('x')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('네트워크 에러 → ServiceUnavailableException', async () => {
      mockWget.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.searchProblem('x')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('비-Error throw → ServiceUnavailableException', async () => {
      mockWget.mockRejectedValue('string-error');
      await expect(service.searchProblem('x')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('JSON 파싱 실패 → ServiceUnavailableException', async () => {
      mockWget.mockResolvedValue({ stdout: 'garbage', stderr: '' });
      await expect(service.searchProblem('x')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
