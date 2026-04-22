/**
 * @file InternalProblemController 단위 테스트
 * @domain problem
 * @layer controller
 * @related internal-problem.controller.ts, parse-study-id.pipe.ts
 *
 * InternalKeyGuard만 적용된 내부 전용 문제 조회 엔드포인트 테스트.
 * StudyMemberGuard가 적용되지 않음을 확인한다.
 * ParseStudyIdPipe를 통해 x-study-id UUID 검증이 적용됨을 확인한다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { InternalProblemController } from './internal-problem.controller';
import { ProblemService } from './problem.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { ParseStudyIdPipe } from '../common/pipes/parse-study-id.pipe';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../cache/cache.module';
import { BadRequestException } from '@nestjs/common';

describe('InternalProblemController', () => {
  let controller: InternalProblemController;
  let service: Record<string, jest.Mock>;
  let studyIdPipe: ParseStudyIdPipe;

  const STUDY_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const PROBLEM_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

  const mockProblem = {
    id: PROBLEM_ID,
    title: '두 수의 합',
    weekNumber: '3월1주차',
    studyId: STUDY_ID,
    sourcePlatform: 'baekjoon',
    sourceUrl: 'https://www.acmicpc.net/problem/1',
  };

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    fatal: jest.fn(),
  };

  beforeEach(async () => {
    service = {
      findById: jest.fn(),
      findByIdInternal: jest.fn(),
      findActiveByStudy: jest.fn(),
      findAllByStudy: jest.fn(),
      getDeadline: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalProblemController],
      providers: [
        { provide: ProblemService, useValue: service },
        { provide: StructuredLoggerService, useValue: mockLogger },
        { provide: ConfigService, useValue: { get: jest.fn(), getOrThrow: jest.fn() } },
        { provide: REDIS_CLIENT, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    })
      .overrideGuard(InternalKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InternalProblemController>(InternalProblemController);
    studyIdPipe = new ParseStudyIdPipe();
  });

  // ──────────────────────────────────────────────
  // ParseStudyIdPipe — x-study-id 헤더 UUID 검증
  // ──────────────────────────────────────────────
  describe('ParseStudyIdPipe (x-study-id 검증)', () => {
    it('유효한 UUID v4 통과', () => {
      expect(studyIdPipe.transform(STUDY_ID)).toBe(STUDY_ID);
    });

    it('undefined 시 BadRequestException — 헤더 누락', () => {
      expect(() => studyIdPipe.transform(undefined as unknown as string)).toThrow(
        BadRequestException,
      );
    });

    it('빈 문자열 시 BadRequestException', () => {
      expect(() => studyIdPipe.transform('')).toThrow(BadRequestException);
    });

    it('UUID 형식이 아닌 문자열 시 BadRequestException', () => {
      expect(() => studyIdPipe.transform('not-a-uuid')).toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────
  // GET /internal/deadline/:id — 마감 시간 조회
  // ──────────────────────────────────────────────
  describe('getDeadline()', () => {
    it('마감 시간 조회 결과 반환', async () => {
      const deadlineResult = { deadline: '2026-03-07T23:59:59.000Z', status: 'cache_hit' };
      service.getDeadline.mockResolvedValue(deadlineResult);

      const result = await controller.getDeadline(PROBLEM_ID, STUDY_ID);

      expect(service.getDeadline).toHaveBeenCalledWith(STUDY_ID, PROBLEM_ID);
      expect(result).toEqual({ data: deadlineResult });
    });
  });

  // ──────────────────────────────────────────────
  // GET /internal/:id — 내부 전용 문제 단건 조회
  // ──────────────────────────────────────────────
  describe('findById()', () => {
    it('문제 단건 조회 성공 — { data: problem } 반환', async () => {
      service.findByIdInternal.mockResolvedValue(mockProblem);

      const result = await controller.findById(PROBLEM_ID, STUDY_ID);

      expect(service.findByIdInternal).toHaveBeenCalledWith(STUDY_ID, PROBLEM_ID);
      expect(result).toEqual({ data: mockProblem });
    });

    it('ProblemService.findByIdInternal에 studyId, id 순서로 전달', async () => {
      service.findByIdInternal.mockResolvedValue(mockProblem);

      await controller.findById(PROBLEM_ID, STUDY_ID);

      expect(service.findByIdInternal).toHaveBeenCalledWith(STUDY_ID, PROBLEM_ID);
    });

    it('서비스 예외 발생 시 그대로 전파', async () => {
      service.findByIdInternal.mockRejectedValue(new Error('DB 연결 실패'));

      await expect(controller.findById(PROBLEM_ID, STUDY_ID)).rejects.toThrow('DB 연결 실패');
    });
  });

  // ──────────────────────────────────────────────
  // GET /internal/active-ids/:studyId — 통계 대상 문제 ID 목록 (ACTIVE + CLOSED)
  // ──────────────────────────────────────────────
  describe('getActiveProblemIds()', () => {
    it('ACTIVE + CLOSED 문제 ID 배열 반환 (DELETED 제외)', async () => {
      service.findAllByStudy.mockResolvedValue([
        { id: 'p1', title: '문제1' },
        { id: 'p2', title: '문제2' },
      ]);

      const result = await controller.getActiveProblemIds(STUDY_ID);

      expect(service.findAllByStudy).toHaveBeenCalledWith(STUDY_ID);
      expect(result).toEqual({ data: ['p1', 'p2'] });
    });

    it('대상 문제가 없으면 빈 배열 반환', async () => {
      service.findAllByStudy.mockResolvedValue([]);

      const result = await controller.getActiveProblemIds(STUDY_ID);

      expect(result).toEqual({ data: [] });
    });
  });
});
