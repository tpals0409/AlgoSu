/**
 * @file DeadlineSchedulerService 단위 테스트 — 만료 문제 자동 종료 스케줄러
 * @domain problem
 * @layer service
 * @related deadline-scheduler.service.ts, problem.service.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { DeadlineSchedulerService } from './deadline-scheduler.service';
import { ProblemService } from './problem.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

describe('DeadlineSchedulerService', () => {
  let service: DeadlineSchedulerService;
  let problemService: Record<string, jest.Mock>;
  let logger: Record<string, jest.Mock>;

  beforeEach(async () => {
    problemService = {
      closeExpiredProblems: jest.fn(),
    };

    logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadlineSchedulerService,
        {
          provide: ProblemService,
          useValue: problemService,
        },
        {
          provide: StructuredLoggerService,
          useValue: logger,
        },
      ],
    }).compile();

    service = module.get<DeadlineSchedulerService>(DeadlineSchedulerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────
  // 1. handleExpiredProblems()
  // ──────────────────────────────────────────────
  describe('handleExpiredProblems()', () => {
    it('problemService.closeExpiredProblems() 호출 확인', async () => {
      problemService.closeExpiredProblems.mockResolvedValue({ count: 0, affected: [] });

      await service.handleExpiredProblems();

      expect(problemService.closeExpiredProblems).toHaveBeenCalledTimes(1);
    });

    it('변경 건수 > 0일 때 info 로그 출력', async () => {
      const affected = [
        { studyId: 'study-001', id: 'prob-001', weekNumber: '3월1주차' },
        { studyId: 'study-001', id: 'prob-002', weekNumber: '3월1주차' },
      ];
      problemService.closeExpiredProblems.mockResolvedValue({ count: 2, affected });

      await service.handleExpiredProblems();

      expect(logger.log).toHaveBeenCalledWith(
        '만료 문제 자동 종료: 2건 CLOSED 전환',
        { count: 2, affected },
      );
      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('변경 건수 0일 때 debug 로그 출력', async () => {
      problemService.closeExpiredProblems.mockResolvedValue({ count: 0, affected: [] });

      await service.handleExpiredProblems();

      expect(logger.debug).toHaveBeenCalledWith('만료 문제 없음 — 스킵');
      expect(logger.log).not.toHaveBeenCalled();
    });

    it('에러 발생 시 error 로그 출력 + 예외가 밖으로 전파되지 않음', async () => {
      const error = new Error('DB connection lost');
      problemService.closeExpiredProblems.mockRejectedValue(error);

      // 예외가 전파되지 않음
      await expect(service.handleExpiredProblems()).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith('만료 문제 자동 종료 실패', error);
    });

    it('에러가 Error 인스턴스가 아닐 때 new Error(String(error))로 래핑', async () => {
      problemService.closeExpiredProblems.mockRejectedValue('string error');

      await expect(service.handleExpiredProblems()).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        '만료 문제 자동 종료 실패',
        expect.any(Error),
      );
      // Error 인스턴스로 래핑된 것 확인
      const errorArg = logger.error.mock.calls[0][1] as Error;
      expect(errorArg.message).toBe('string error');
    });
  });
});
