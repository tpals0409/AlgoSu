import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProblemService } from './problem.service';
import { Problem, ProblemStatus, Difficulty } from './problem.entity';
import { CreateProblemDto, UpdateProblemDto } from './dto/create-problem.dto';
import { DeadlineCacheService } from '../cache/deadline-cache.service';

describe('ProblemService', () => {
  let service: ProblemService;
  let problemRepo: Record<string, jest.Mock>;
  let deadlineCache: Record<string, jest.Mock>;

  const STUDY_ID = 'study-uuid-001';
  const OTHER_STUDY_ID = 'study-uuid-999';
  const PROBLEM_ID = 'prob-uuid-001';
  const USER_ID = 'user-uuid-001';

  const mockProblem: Problem = {
    id: PROBLEM_ID,
    title: '두 수의 합',
    description: '배열에서 두 수의 합이 target이 되는 인덱스를 구하세요.',
    weekNumber: 1,
    difficulty: Difficulty.SILVER,
    sourceUrl: 'https://leetcode.com/problems/two-sum',
    sourcePlatform: 'LeetCode',
    status: ProblemStatus.ACTIVE,
    deadline: new Date('2026-03-07T23:59:59.000Z'),
    allowedLanguages: ['python', 'javascript'],
    studyId: STUDY_ID,
    createdBy: USER_ID,
    createdAt: new Date('2026-02-28T00:00:00.000Z'),
    updatedAt: new Date('2026-02-28T00:00:00.000Z'),
  };

  beforeEach(async () => {
    problemRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    deadlineCache = {
      getDeadline: jest.fn(),
      setDeadline: jest.fn(),
      invalidateDeadline: jest.fn(),
      getWeekProblems: jest.fn(),
      setWeekProblems: jest.fn(),
      invalidateWeekProblems: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProblemService,
        {
          provide: getRepositoryToken(Problem),
          useValue: problemRepo,
        },
        {
          provide: DeadlineCacheService,
          useValue: deadlineCache,
        },
      ],
    }).compile();

    service = module.get<ProblemService>(ProblemService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────
  // 1. create()
  // ──────────────────────────────────────────────
  describe('create()', () => {
    it('문제 생성: DB 저장 + 캐시 설정 + 주차 캐시 무효화', async () => {
      const dto: CreateProblemDto = {
        title: '두 수의 합',
        description: '배열에서 두 수의 합이 target이 되는 인덱스를 구하세요.',
        weekNumber: 1,
        difficulty: Difficulty.SILVER,
        sourceUrl: 'https://leetcode.com/problems/two-sum',
        sourcePlatform: 'LeetCode',
        deadline: '2026-03-07T23:59:59.000Z',
        allowedLanguages: ['python', 'javascript'],
      };

      problemRepo.create.mockReturnValue(mockProblem);
      problemRepo.save.mockResolvedValue(mockProblem);
      deadlineCache.setDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      const result = await service.create(dto, STUDY_ID, USER_ID);

      // repo.create 호출 확인 — studyId, createdBy 포함
      expect(problemRepo.create).toHaveBeenCalledWith({
        title: dto.title,
        description: dto.description,
        weekNumber: dto.weekNumber,
        difficulty: dto.difficulty,
        sourceUrl: dto.sourceUrl,
        sourcePlatform: dto.sourcePlatform,
        deadline: new Date(dto.deadline!),
        allowedLanguages: dto.allowedLanguages,
        studyId: STUDY_ID,
        createdBy: USER_ID,
      });

      // repo.save 호출
      expect(problemRepo.save).toHaveBeenCalledWith(mockProblem);

      // 캐시 설정: setDeadline(studyId, problemId, deadline)
      expect(deadlineCache.setDeadline).toHaveBeenCalledWith(
        STUDY_ID,
        PROBLEM_ID,
        mockProblem.deadline,
      );

      // 주차 캐시 무효화: invalidateWeekProblems(studyId, weekNumber)
      expect(deadlineCache.invalidateWeekProblems).toHaveBeenCalledWith(
        STUDY_ID,
        mockProblem.weekNumber,
      );

      // 반환값
      expect(result).toEqual(mockProblem);
    });
  });

  // ──────────────────────────────────────────────
  // 2-4. findById()
  // ──────────────────────────────────────────────
  describe('findById()', () => {
    it('정상 조회: studyId 스코핑으로 문제 반환', async () => {
      problemRepo.findOne.mockResolvedValue(mockProblem);

      const result = await service.findById(STUDY_ID, PROBLEM_ID);

      expect(problemRepo.findOne).toHaveBeenCalledWith({
        where: { id: PROBLEM_ID, studyId: STUDY_ID },
      });
      expect(result).toEqual(mockProblem);
    });

    it('미존재: NotFoundException 발생', async () => {
      problemRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(STUDY_ID, 'non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById(STUDY_ID, 'non-existent-id')).rejects.toThrow(
        '문제를 찾을 수 없습니다: id=non-existent-id',
      );
    });

    it('다른 studyId: cross-study 접근 차단 (NotFoundException)', async () => {
      // 다른 studyId로 조회 시 findOne이 null 반환 → NotFoundException
      problemRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(OTHER_STUDY_ID, PROBLEM_ID)).rejects.toThrow(
        NotFoundException,
      );

      // studyId가 OTHER_STUDY_ID로 조회되었는지 확인
      expect(problemRepo.findOne).toHaveBeenCalledWith({
        where: { id: PROBLEM_ID, studyId: OTHER_STUDY_ID },
      });
    });
  });

  // ──────────────────────────────────────────────
  // 5-6. findByWeekAndStudy()
  // ──────────────────────────────────────────────
  describe('findByWeekAndStudy()', () => {
    it('캐시 히트: Redis에서 반환, DB 미조회', async () => {
      const cachedProblems = [mockProblem];
      deadlineCache.getWeekProblems.mockResolvedValue(JSON.stringify(cachedProblems));

      const result = await service.findByWeekAndStudy(STUDY_ID, 1);

      expect(deadlineCache.getWeekProblems).toHaveBeenCalledWith(STUDY_ID, 1);
      // JSON.parse 결과이므로 Date는 문자열로 변환됨
      expect(result).toEqual(JSON.parse(JSON.stringify(cachedProblems)));

      // DB 조회하지 않음
      expect(problemRepo.find).not.toHaveBeenCalled();
      // 캐시 재설정하지 않음
      expect(deadlineCache.setWeekProblems).not.toHaveBeenCalled();
    });

    it('캐시 미스: DB 조회 후 캐시 저장', async () => {
      const dbProblems = [mockProblem];
      deadlineCache.getWeekProblems.mockResolvedValue(null);
      problemRepo.find.mockResolvedValue(dbProblems);
      deadlineCache.setWeekProblems.mockResolvedValue(undefined);

      const result = await service.findByWeekAndStudy(STUDY_ID, 1);

      // 캐시 미스 확인
      expect(deadlineCache.getWeekProblems).toHaveBeenCalledWith(STUDY_ID, 1);

      // DB 조회 — studyId 스코핑, createdAt ASC 정렬
      expect(problemRepo.find).toHaveBeenCalledWith({
        where: { weekNumber: 1, studyId: STUDY_ID },
        order: { createdAt: 'ASC' },
      });

      // 캐시 저장
      expect(deadlineCache.setWeekProblems).toHaveBeenCalledWith(
        STUDY_ID,
        1,
        JSON.stringify(dbProblems),
      );

      expect(result).toEqual(dbProblems);
    });
  });

  // ──────────────────────────────────────────────
  // 7-9. getDeadline()
  // ──────────────────────────────────────────────
  describe('getDeadline()', () => {
    it('캐시 히트: cache_hit 상태 반환', async () => {
      const cachedDeadline = '2026-03-07T23:59:59.000Z';
      deadlineCache.getDeadline.mockResolvedValue(cachedDeadline);

      const result = await service.getDeadline(STUDY_ID, PROBLEM_ID);

      expect(deadlineCache.getDeadline).toHaveBeenCalledWith(STUDY_ID, PROBLEM_ID);
      expect(result).toEqual({
        deadline: cachedDeadline,
        status: 'cache_hit',
      });

      // DB 미조회
      expect(problemRepo.findOne).not.toHaveBeenCalled();
    });

    it('캐시 미스: DB fallback, db_hit 상태 반환', async () => {
      deadlineCache.getDeadline.mockResolvedValue(null);
      problemRepo.findOne.mockResolvedValue(mockProblem);
      deadlineCache.setDeadline.mockResolvedValue(undefined);

      const result = await service.getDeadline(STUDY_ID, PROBLEM_ID);

      // 캐시 미스 → DB 조회
      expect(deadlineCache.getDeadline).toHaveBeenCalledWith(STUDY_ID, PROBLEM_ID);
      expect(problemRepo.findOne).toHaveBeenCalledWith({
        where: { id: PROBLEM_ID, studyId: STUDY_ID },
      });

      // 캐시 재설정
      expect(deadlineCache.setDeadline).toHaveBeenCalledWith(
        STUDY_ID,
        mockProblem.id,
        mockProblem.deadline,
      );

      expect(result).toEqual({
        deadline: mockProblem.deadline!.toISOString(),
        status: 'db_hit',
      });
    });

    it('deadline null: cache_hit에서 null 반환', async () => {
      // deadline이 null인 경우 캐시에 'null' 문자열로 저장됨
      deadlineCache.getDeadline.mockResolvedValue('null');

      const result = await service.getDeadline(STUDY_ID, PROBLEM_ID);

      expect(result).toEqual({
        deadline: null,
        status: 'cache_hit',
      });
    });
  });

  // ──────────────────────────────────────────────
  // 10. update()
  // ──────────────────────────────────────────────
  describe('update()', () => {
    it('부분 수정: 필드 업데이트 + 캐시 무효화', async () => {
      const dto: UpdateProblemDto = {
        title: '수정된 제목',
        difficulty: Difficulty.GOLD,
        status: 'CLOSED',
      };

      const updatedProblem: Problem = {
        ...mockProblem,
        title: dto.title!,
        difficulty: Difficulty.GOLD,
        status: ProblemStatus.CLOSED,
      };

      // findById 내부 호출
      problemRepo.findOne.mockResolvedValue({ ...mockProblem });
      // save 호출
      problemRepo.save.mockResolvedValue(updatedProblem);
      deadlineCache.invalidateDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      const result = await service.update(STUDY_ID, PROBLEM_ID, dto);

      // findById 호출 (studyId 스코핑)
      expect(problemRepo.findOne).toHaveBeenCalledWith({
        where: { id: PROBLEM_ID, studyId: STUDY_ID },
      });

      // save 호출 — 변경된 필드 반영
      expect(problemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '수정된 제목',
          difficulty: Difficulty.GOLD,
          status: ProblemStatus.CLOSED,
        }),
      );

      // 캐시 무효화
      expect(deadlineCache.invalidateDeadline).toHaveBeenCalledWith(
        STUDY_ID,
        updatedProblem.id,
      );
      expect(deadlineCache.invalidateWeekProblems).toHaveBeenCalledWith(
        STUDY_ID,
        updatedProblem.weekNumber,
      );

      expect(result).toEqual(updatedProblem);
    });
  });

  // ──────────────────────────────────────────────
  // 11. findActiveByStudy()
  // ──────────────────────────────────────────────
  describe('findActiveByStudy()', () => {
    it('ACTIVE 상태 문제만 필터링하여 반환', async () => {
      const activeProblems = [mockProblem];
      problemRepo.find.mockResolvedValue(activeProblems);

      const result = await service.findActiveByStudy(STUDY_ID);

      expect(problemRepo.find).toHaveBeenCalledWith({
        where: { status: ProblemStatus.ACTIVE, studyId: STUDY_ID },
        order: { weekNumber: 'DESC', createdAt: 'ASC' },
      });
      expect(result).toEqual(activeProblems);
    });
  });
});
