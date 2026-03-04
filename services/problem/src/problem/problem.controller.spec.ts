import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ProblemController } from './problem.controller';
import { ProblemService } from './problem.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { StudyMemberGuard } from '../common/guards/study-member.guard';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '../cache/cache.module';
import { CreateProblemDto, UpdateProblemDto } from './dto/create-problem.dto';
import { Difficulty } from './problem.entity';

describe('ProblemController', () => {
  let controller: ProblemController;
  let service: Record<string, jest.Mock>;

  const STUDY_ID = 'study-uuid-001';
  const USER_ID = 'user-uuid-001';
  const PROBLEM_ID = 'prob-uuid-001';

  const mockProblem = {
    id: PROBLEM_ID,
    title: '두 수의 합',
    weekNumber: '3월1주차',
    studyId: STUDY_ID,
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
      create: jest.fn(),
      findByWeekAndStudy: jest.fn(),
      findAllByStudy: jest.fn(),
      findActiveByStudy: jest.fn(),
      getDeadline: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProblemController],
      providers: [
        { provide: ProblemService, useValue: service },
        { provide: StructuredLoggerService, useValue: mockLogger },
        { provide: ConfigService, useValue: { get: jest.fn(), getOrThrow: jest.fn() } },
        { provide: REDIS_CLIENT, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    })
      .overrideGuard(InternalKeyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(StudyMemberGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProblemController>(ProblemController);
  });

  // ──────────────────────────────────────────────
  // POST / — 문제 생성
  // ──────────────────────────────────────────────
  describe('create()', () => {
    const dto: CreateProblemDto = {
      title: '두 수의 합',
      weekNumber: '3월1주차',
      difficulty: Difficulty.SILVER,
    };

    it('ADMIN 역할: 문제 생성 성공', async () => {
      service.create.mockResolvedValue(mockProblem);

      const result = await controller.create(dto, USER_ID, STUDY_ID, { studyRole: 'ADMIN' });

      expect(service.create).toHaveBeenCalledWith(dto, STUDY_ID, USER_ID);
      expect(result).toEqual({ data: mockProblem });
    });

    it('MEMBER 역할: ForbiddenException 발생', async () => {
      await expect(
        controller.create(dto, USER_ID, STUDY_ID, { studyRole: 'MEMBER' }),
      ).rejects.toThrow(ForbiddenException);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('역할 없음: ForbiddenException 발생', async () => {
      await expect(
        controller.create(dto, USER_ID, STUDY_ID, {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ──────────────────────────────────────────────
  // GET /week/:weekNumber
  // ──────────────────────────────────────────────
  describe('findByWeek()', () => {
    it('주차별 문제 목록 반환', async () => {
      service.findByWeekAndStudy.mockResolvedValue([mockProblem]);

      const result = await controller.findByWeek('3월1주차', STUDY_ID);

      expect(service.findByWeekAndStudy).toHaveBeenCalledWith(STUDY_ID, '3월1주차');
      expect(result).toEqual({ data: [mockProblem] });
    });
  });

  // ──────────────────────────────────────────────
  // GET /all
  // ──────────────────────────────────────────────
  describe('findAll()', () => {
    it('전체 문제 목록 반환', async () => {
      service.findAllByStudy.mockResolvedValue([mockProblem]);

      const result = await controller.findAll(STUDY_ID);

      expect(service.findAllByStudy).toHaveBeenCalledWith(STUDY_ID);
      expect(result).toEqual({ data: [mockProblem] });
    });
  });

  // ──────────────────────────────────────────────
  // GET /active
  // ──────────────────────────────────────────────
  describe('findActive()', () => {
    it('활성 문제 목록 반환', async () => {
      service.findActiveByStudy.mockResolvedValue([mockProblem]);

      const result = await controller.findActive(STUDY_ID);

      expect(service.findActiveByStudy).toHaveBeenCalledWith(STUDY_ID);
      expect(result).toEqual({ data: [mockProblem] });
    });
  });

  // ──────────────────────────────────────────────
  // GET /deadline/:id
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
  // GET /:id
  // ──────────────────────────────────────────────
  describe('findById()', () => {
    it('문제 단건 조회 반환', async () => {
      service.findById.mockResolvedValue(mockProblem);

      const result = await controller.findById(PROBLEM_ID, STUDY_ID);

      expect(service.findById).toHaveBeenCalledWith(STUDY_ID, PROBLEM_ID);
      expect(result).toEqual({ data: mockProblem });
    });
  });

  // ──────────────────────────────────────────────
  // DELETE /:id
  // ──────────────────────────────────────────────
  describe('delete()', () => {
    it('ADMIN 역할: 문제 삭제 성공', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete(PROBLEM_ID, USER_ID, STUDY_ID, { studyRole: 'ADMIN' });

      expect(service.delete).toHaveBeenCalledWith(STUDY_ID, PROBLEM_ID);
    });

    it('MEMBER 역할: ForbiddenException 발생', async () => {
      await expect(
        controller.delete(PROBLEM_ID, USER_ID, STUDY_ID, { studyRole: 'MEMBER' }),
      ).rejects.toThrow(ForbiddenException);
      expect(service.delete).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // PATCH /:id
  // ──────────────────────────────────────────────
  describe('update()', () => {
    const dto: UpdateProblemDto = { title: '수정된 제목' };

    it('ADMIN 역할: 문제 수정 성공', async () => {
      const updated = { ...mockProblem, title: '수정된 제목' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(PROBLEM_ID, dto, USER_ID, STUDY_ID, { studyRole: 'ADMIN' });

      expect(service.update).toHaveBeenCalledWith(STUDY_ID, PROBLEM_ID, dto);
      expect(result).toEqual({ data: updated });
    });

    it('MEMBER 역할: ForbiddenException 발생', async () => {
      await expect(
        controller.update(PROBLEM_ID, dto, USER_ID, STUDY_ID, { studyRole: 'MEMBER' }),
      ).rejects.toThrow(ForbiddenException);
      expect(service.update).not.toHaveBeenCalled();
    });
  });
});
