/**
 * @file InternalProblemController 단위 테스트
 * @domain problem
 * @layer controller
 * @related internal-problem.controller.ts
 *
 * InternalKeyGuard만 적용된 내부 전용 문제 조회 엔드포인트 테스트.
 * StudyMemberGuard가 적용되지 않음을 확인한다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { InternalProblemController } from './internal-problem.controller';
import { ProblemService } from './problem.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../cache/cache.module';

describe('InternalProblemController', () => {
  let controller: InternalProblemController;
  let service: Record<string, jest.Mock>;

  const STUDY_ID = 'study-uuid-001';
  const PROBLEM_ID = 'prob-uuid-001';

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
  });

  // ──────────────────────────────────────────────
  // GET /internal/:id — 내부 전용 문제 단건 조회
  // ──────────────────────────────────────────────
  describe('findById()', () => {
    it('문제 단건 조회 성공 — { data: problem } 반환', async () => {
      service.findById.mockResolvedValue(mockProblem);

      const result = await controller.findById(PROBLEM_ID, STUDY_ID);

      expect(service.findById).toHaveBeenCalledWith(STUDY_ID, PROBLEM_ID);
      expect(result).toEqual({ data: mockProblem });
    });

    it('ProblemService.findById에 studyId, id 순서로 전달', async () => {
      service.findById.mockResolvedValue(mockProblem);

      await controller.findById(PROBLEM_ID, STUDY_ID);

      expect(service.findById).toHaveBeenCalledWith(STUDY_ID, PROBLEM_ID);
    });

    it('서비스 예외 발생 시 그대로 전파', async () => {
      service.findById.mockRejectedValue(new Error('DB 연결 실패'));

      await expect(controller.findById(PROBLEM_ID, STUDY_ID)).rejects.toThrow('DB 연결 실패');
    });
  });
});
