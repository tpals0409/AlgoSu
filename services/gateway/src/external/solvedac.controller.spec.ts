import { BadRequestException } from '@nestjs/common';
import { SolvedacController } from './solvedac.controller';
import { SolvedacService } from './solvedac.service';

describe('SolvedacController', () => {
  let controller: SolvedacController;
  let solvedacService: { fetchProblem: jest.Mock };

  const mockProblemInfo = {
    problemId: 1000,
    title: 'A+B',
    difficulty: 'BRONZE' as const,
    level: 1,
    sourceUrl: 'https://www.acmicpc.net/problem/1000',
    tags: ['수학', '구현'],
  };

  beforeEach(() => {
    solvedacService = {
      fetchProblem: jest.fn().mockResolvedValue(mockProblemInfo),
    };

    controller = new SolvedacController(
      solvedacService as unknown as SolvedacService,
    );
  });

  describe('getProblem', () => {
    it('유효한 문제 번호 — 서비스 호출 후 결과 반환', async () => {
      const result = await controller.getProblem('1000');

      expect(solvedacService.fetchProblem).toHaveBeenCalledWith(1000);
      expect(result).toEqual(mockProblemInfo);
    });

    it('문제 번호 1 — 최소값 정상 처리', async () => {
      await controller.getProblem('1');
      expect(solvedacService.fetchProblem).toHaveBeenCalledWith(1);
    });

    it('문제 번호 99999 — 최대값 정상 처리', async () => {
      await controller.getProblem('99999');
      expect(solvedacService.fetchProblem).toHaveBeenCalledWith(99999);
    });

    it('0 이하 → BadRequestException', async () => {
      await expect(controller.getProblem('0')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getProblem('-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('100000 이상 → BadRequestException', async () => {
      await expect(controller.getProblem('100000')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('소수점 숫자 → BadRequestException', async () => {
      await expect(controller.getProblem('3.14')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('문자열 → BadRequestException', async () => {
      await expect(controller.getProblem('abc')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getProblem('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('에러 메시지 검증', async () => {
      await expect(controller.getProblem('abc')).rejects.toThrow(
        '문제 번호는 1~99999 사이의 정수여야 합니다.',
      );
    });
  });
});
