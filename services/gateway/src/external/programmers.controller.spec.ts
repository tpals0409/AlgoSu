/**
 * @file programmers.controller.spec.ts — ProgrammersController 단위 테스트
 * @domain problem
 * @layer controller
 *
 * ProgrammersService 를 mock 으로 대체하여 컨트롤러의 유효성 검증·라우팅만 검증한다.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProgrammersController } from './programmers.controller';
import { ProgrammersService } from './programmers.service';

describe('ProgrammersController', () => {
  let controller: ProgrammersController;
  let programmersService: {
    fetchProblem: jest.Mock;
    searchProblem: jest.Mock;
  };

  const mockProblemInfo = {
    problemId: 42840,
    title: '모의고사',
    level: 1,
    difficulty: 'BRONZE' as const,
    tags: ['완전탐색'],
    sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/42840',
  };

  const mockSearchResult = {
    count: 1,
    items: [
      {
        problemId: 42840,
        title: '모의고사',
        level: 1,
        difficulty: 'BRONZE' as const,
        sourceUrl: 'https://school.programmers.co.kr/learn/courses/30/lessons/42840',
        tags: ['완전탐색'],
      },
    ],
  };

  beforeEach(() => {
    programmersService = {
      fetchProblem: jest.fn().mockReturnValue(mockProblemInfo),
      searchProblem: jest.fn().mockReturnValue({ count: 0, items: [] }),
    };

    controller = new ProgrammersController(
      programmersService as unknown as ProgrammersService,
    );
  });

  // ── getProblem ──────────────────────────────────────────────────────────────

  describe('getProblem', () => {
    it('유효한 문제 번호 — 서비스 호출 후 결과 반환', () => {
      const result = controller.getProblem('42840');

      expect(programmersService.fetchProblem).toHaveBeenCalledWith(42840);
      expect(result).toEqual(mockProblemInfo);
    });

    it('문제 번호 1 — 최소값 정상 처리', () => {
      controller.getProblem('1');
      expect(programmersService.fetchProblem).toHaveBeenCalledWith(1);
    });

    it('문제 번호 999999 — 최대값 정상 처리', () => {
      controller.getProblem('999999');
      expect(programmersService.fetchProblem).toHaveBeenCalledWith(999999);
    });

    it('0 이하 → BadRequestException', () => {
      expect(() => controller.getProblem('0')).toThrow(BadRequestException);
      expect(() => controller.getProblem('-1')).toThrow(BadRequestException);
    });

    it('1000000 이상 → BadRequestException', () => {
      expect(() => controller.getProblem('1000000')).toThrow(BadRequestException);
    });

    it('소수점 숫자 → BadRequestException', () => {
      expect(() => controller.getProblem('42.5')).toThrow(BadRequestException);
    });

    it('문자열 → BadRequestException', () => {
      expect(() => controller.getProblem('abc')).toThrow(BadRequestException);
      expect(() => controller.getProblem('')).toThrow(BadRequestException);
    });

    it('에러 메시지 검증', () => {
      expect(() => controller.getProblem('abc')).toThrow(
        '문제 번호는 1~999999 사이의 정수여야 합니다.',
      );
    });

    it('서비스에서 NotFoundException — 그대로 전파', () => {
      programmersService.fetchProblem.mockImplementation(() => {
        throw new NotFoundException('프로그래머스 99999번 문제를 찾을 수 없습니다.');
      });
      expect(() => controller.getProblem('99999')).toThrow(NotFoundException);
    });
  });

  // ── searchProblem ───────────────────────────────────────────────────────────

  describe('searchProblem', () => {
    beforeEach(() => {
      programmersService.searchProblem.mockReturnValue(mockSearchResult);
    });

    it('유효한 query — 서비스 호출 후 결과 반환 (기본 page=1)', () => {
      const result = controller.searchProblem('모의고사');
      expect(programmersService.searchProblem).toHaveBeenCalledWith('모의고사', 1);
      expect(result).toEqual(mockSearchResult);
    });

    it('query + page 지정 — 올바르게 전달', () => {
      controller.searchProblem('정렬', '3');
      expect(programmersService.searchProblem).toHaveBeenCalledWith('정렬', 3);
    });

    it('query 앞뒤 공백 트림 처리', () => {
      controller.searchProblem('  모의고사  ');
      expect(programmersService.searchProblem).toHaveBeenCalledWith('모의고사', 1);
    });

    it('query 누락 → BadRequestException', () => {
      expect(() => controller.searchProblem(undefined)).toThrow(BadRequestException);
    });

    it('빈 query → BadRequestException', () => {
      expect(() => controller.searchProblem('')).toThrow(BadRequestException);
      expect(() => controller.searchProblem('   ')).toThrow(BadRequestException);
    });

    it('query 100자 초과 → BadRequestException', () => {
      const longQuery = 'a'.repeat(101);
      expect(() => controller.searchProblem(longQuery)).toThrow(BadRequestException);
    });

    it('page 비정수/범위 초과 → BadRequestException', () => {
      expect(() => controller.searchProblem('x', '0')).toThrow(BadRequestException);
      expect(() => controller.searchProblem('x', '101')).toThrow(BadRequestException);
      expect(() => controller.searchProblem('x', '1.5')).toThrow(BadRequestException);
      expect(() => controller.searchProblem('x', 'abc')).toThrow(BadRequestException);
    });

    it('page 빈 문자열 — 기본값 1로 처리', () => {
      controller.searchProblem('정렬', '');
      expect(programmersService.searchProblem).toHaveBeenCalledWith('정렬', 1);
    });

    it('에러 메시지: 검색어 길이 초과', () => {
      expect(() => controller.searchProblem('a'.repeat(101))).toThrow(
        '검색어는 1~100자 사이여야 합니다.',
      );
    });

    it('에러 메시지: page 범위 초과', () => {
      expect(() => controller.searchProblem('x', '0')).toThrow(
        'page는 1~100 사이의 정수여야 합니다.',
      );
    });
  });
});
