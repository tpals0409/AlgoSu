import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource, In, Not } from 'typeorm';
import { ProblemService } from './problem.service';
import { Problem, ProblemStatus, Difficulty } from './problem.entity';
import { CreateProblemDto, UpdateProblemDto } from './dto/create-problem.dto';
import { DeadlineCacheService } from '../cache/deadline-cache.service';
import { DualWriteService } from '../database/dual-write.service';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

// ─── Mock QueryRunner 팩토리 ──────────────────────────────────────
const createMockQueryRunner = () => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      whereInIds: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    }),
  },
});

describe('ProblemService', () => {
  let service: ProblemService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dualWrite: any;
  let deadlineCache: Record<string, jest.Mock>;
  let dataSource: Record<string, jest.Mock>;

  const STUDY_ID = 'study-uuid-001';
  const OTHER_STUDY_ID = 'study-uuid-999';
  const PROBLEM_ID = 'prob-uuid-001';
  const USER_ID = 'user-uuid-001';

  const mockProblem: Problem = {
    id: PROBLEM_ID,
    title: '두 수의 합',
    description: '배열에서 두 수의 합이 target이 되는 인덱스를 구하세요.',
    weekNumber: '3월1주차',
    difficulty: Difficulty.SILVER,
    level: 8,
    sourceUrl: 'https://leetcode.com/problems/two-sum',
    sourcePlatform: 'LeetCode',
    status: ProblemStatus.ACTIVE,
    deadline: new Date('2026-03-07T23:59:59.000Z'),
    allowedLanguages: ['python', 'javascript'],
    tags: null,
    studyId: STUDY_ID,
    createdBy: USER_ID,
    publicId: 'pub-uuid-001',
    createdAt: new Date('2026-02-28T00:00:00.000Z'),
    updatedAt: new Date('2026-02-28T00:00:00.000Z'),
    generatePublicId: jest.fn(),
  };

  beforeEach(async () => {
    dualWrite = {
      save: jest.fn(),
      saveExisting: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      isActive: false,
    };

    deadlineCache = {
      getDeadline: jest.fn(),
      setDeadline: jest.fn(),
      invalidateDeadline: jest.fn(),
      getWeekProblems: jest.fn(),
      setWeekProblems: jest.fn(),
      invalidateWeekProblems: jest.fn(),
    };

    dataSource = {
      createQueryRunner: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProblemService,
        {
          provide: DualWriteService,
          useValue: dualWrite,
        },
        {
          provide: DeadlineCacheService,
          useValue: deadlineCache,
        },
        {
          provide: StructuredLoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: dataSource,
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
    it('sourceUrl 중복: ConflictException 발생', async () => {
      const dto: CreateProblemDto = {
        title: '두 수의 합',
        weekNumber: '3월1주차',
        sourceUrl: 'https://leetcode.com/problems/two-sum',
      };

      // 같은 스터디+주차+sourceUrl에 기존 문제 존재
      dualWrite.findOne.mockResolvedValue(mockProblem);

      await expect(service.create(dto, STUDY_ID, USER_ID)).rejects.toThrow(ConflictException);
      await expect(service.create(dto, STUDY_ID, USER_ID)).rejects.toThrow(
        '같은 주차에 이미 등록된 문제입니다.',
      );

      // save 호출 안 됨
      expect(dualWrite.save).not.toHaveBeenCalled();
    });

    it('sourceUrl 없으면 중복 체크 건너뜀', async () => {
      const dto: CreateProblemDto = {
        title: '두 수의 합',
        weekNumber: '3월1주차',
      };

      dualWrite.save.mockResolvedValue(mockProblem);
      deadlineCache.setDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      await service.create(dto, STUDY_ID, USER_ID);

      // findOne 미호출 (중복 체크 건너뜀)
      expect(dualWrite.findOne).not.toHaveBeenCalled();
      expect(dualWrite.save).toHaveBeenCalled();
    });

    it('문제 생성: DB 저장 + 캐시 설정 + 주차 캐시 무효화', async () => {
      const dto: CreateProblemDto = {
        title: '두 수의 합',
        description: '배열에서 두 수의 합이 target이 되는 인덱스를 구하세요.',
        weekNumber: '3월1주차',
        difficulty: Difficulty.SILVER,
        sourceUrl: 'https://leetcode.com/problems/two-sum',
        sourcePlatform: 'LeetCode',
        deadline: '2026-03-07T23:59:59.000Z',
        allowedLanguages: ['python', 'javascript'],
      };

      dualWrite.save.mockResolvedValue(mockProblem);
      deadlineCache.setDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      const result = await service.create(dto, STUDY_ID, USER_ID);

      // dualWrite.save 호출 확인 — studyId, createdBy 포함
      expect(dualWrite.save).toHaveBeenCalledWith({
        title: dto.title,
        description: dto.description,
        weekNumber: dto.weekNumber,
        difficulty: dto.difficulty,
        level: null,
        sourceUrl: dto.sourceUrl,
        sourcePlatform: dto.sourcePlatform,
        deadline: new Date(dto.deadline!),
        allowedLanguages: dto.allowedLanguages,
        tags: null,
        status: ProblemStatus.ACTIVE,
        studyId: STUDY_ID,
        createdBy: USER_ID,
      });

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
      dualWrite.findOne.mockResolvedValue(mockProblem);

      const result = await service.findById(STUDY_ID, PROBLEM_ID);

      expect(dualWrite.findOne).toHaveBeenCalledWith({
        where: { id: PROBLEM_ID, studyId: STUDY_ID, status: Not(ProblemStatus.DELETED) },
      });
      expect(result).toEqual(mockProblem);
    });

    it('미존재: NotFoundException 발생', async () => {
      dualWrite.findOne.mockResolvedValue(null);

      await expect(service.findById(STUDY_ID, 'non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById(STUDY_ID, 'non-existent-id')).rejects.toThrow(
        '문제를 찾을 수 없습니다: id=non-existent-id',
      );
    });

    it('다른 studyId: cross-study 접근 차단 (NotFoundException)', async () => {
      // 다른 studyId로 조회 시 findOne이 null 반환 → NotFoundException
      dualWrite.findOne.mockResolvedValue(null);

      await expect(service.findById(OTHER_STUDY_ID, PROBLEM_ID)).rejects.toThrow(
        NotFoundException,
      );

      // studyId가 OTHER_STUDY_ID로 조회되었는지 확인
      expect(dualWrite.findOne).toHaveBeenCalledWith({
        where: { id: PROBLEM_ID, studyId: OTHER_STUDY_ID, status: Not(ProblemStatus.DELETED) },
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

      const result = await service.findByWeekAndStudy(STUDY_ID, '3월1주차');

      expect(deadlineCache.getWeekProblems).toHaveBeenCalledWith(STUDY_ID, '3월1주차');
      // JSON.parse 결과이므로 Date는 문자열로 변환됨
      expect(result).toEqual(JSON.parse(JSON.stringify(cachedProblems)));

      // DB 조회하지 않음
      expect(dualWrite.find).not.toHaveBeenCalled();
      // 캐시 재설정하지 않음
      expect(deadlineCache.setWeekProblems).not.toHaveBeenCalled();
    });

    it('캐시 미스: DRAFT 제외하고 조회 (ACTIVE + CLOSED 포함)', async () => {
      deadlineCache.getWeekProblems.mockResolvedValue(null);
      dualWrite.find.mockResolvedValue([mockProblem]);
      deadlineCache.setWeekProblems.mockResolvedValue(undefined);

      await service.findByWeekAndStudy(STUDY_ID, '3월1주차');

      // DRAFT 제외 필터 확인
      expect(dualWrite.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: Not(In([ProblemStatus.DRAFT, ProblemStatus.DELETED])) }),
        }),
      );
    });

    it('캐시 미스: DB 조회 후 캐시 저장', async () => {
      const dbProblems = [mockProblem];
      deadlineCache.getWeekProblems.mockResolvedValue(null);
      dualWrite.find.mockResolvedValue(dbProblems);
      deadlineCache.setWeekProblems.mockResolvedValue(undefined);

      const result = await service.findByWeekAndStudy(STUDY_ID, '3월1주차');

      // 캐시 미스 확인
      expect(deadlineCache.getWeekProblems).toHaveBeenCalledWith(STUDY_ID, '3월1주차');

      // DB 조회 — studyId 스코핑, DRAFT 제외 필터, createdAt ASC 정렬
      expect(dualWrite.find).toHaveBeenCalledWith({
        where: { weekNumber: '3월1주차', studyId: STUDY_ID, status: Not(In([ProblemStatus.DRAFT, ProblemStatus.DELETED])) },
        order: { createdAt: 'ASC' },
      });

      // 캐시 저장
      expect(deadlineCache.setWeekProblems).toHaveBeenCalledWith(
        STUDY_ID,
        '3월1주차',
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
      dualWrite.findOne.mockResolvedValue(mockProblem);

      const result = await service.getDeadline(STUDY_ID, PROBLEM_ID);

      expect(deadlineCache.getDeadline).toHaveBeenCalledWith(STUDY_ID, PROBLEM_ID);
      expect(result).toEqual({
        deadline: cachedDeadline,
        weekNumber: '3월1주차',
        status: 'cache_hit',
      });
    });

    it('캐시 미스: DB fallback, db_hit 상태 반환', async () => {
      deadlineCache.getDeadline.mockResolvedValue(null);
      dualWrite.findOne.mockResolvedValue(mockProblem);
      deadlineCache.setDeadline.mockResolvedValue(undefined);

      const result = await service.getDeadline(STUDY_ID, PROBLEM_ID);

      // 캐시 미스 → DB 조회
      expect(deadlineCache.getDeadline).toHaveBeenCalledWith(STUDY_ID, PROBLEM_ID);
      expect(dualWrite.findOne).toHaveBeenCalledWith({
        where: { id: PROBLEM_ID, studyId: STUDY_ID, status: Not(ProblemStatus.DELETED) },
      });

      // 캐시 재설정
      expect(deadlineCache.setDeadline).toHaveBeenCalledWith(
        STUDY_ID,
        mockProblem.id,
        mockProblem.deadline,
      );

      expect(result).toEqual({
        deadline: mockProblem.deadline!.toISOString(),
        weekNumber: '3월1주차',
        status: 'db_hit',
      });
    });

    it('deadline null: cache_hit에서 null 반환', async () => {
      // deadline이 null인 경우 캐시에 'null' 문자열로 저장됨
      deadlineCache.getDeadline.mockResolvedValue('null');
      dualWrite.findOne.mockResolvedValue(mockProblem);

      const result = await service.getDeadline(STUDY_ID, PROBLEM_ID);

      expect(result).toEqual({
        deadline: null,
        weekNumber: '3월1주차',
        status: 'cache_hit',
      });
    });

    it('DB fallback — problem.deadline null: null 반환 (ternary null 분기)', async () => {
      // deadline이 null인 문제가 DB에 있을 때 → problem.deadline ? ... : null 분기
      const problemWithoutDeadline = { ...mockProblem, deadline: null } as unknown as Problem;
      deadlineCache.getDeadline.mockResolvedValue(null);
      dualWrite.findOne.mockResolvedValue(problemWithoutDeadline);
      deadlineCache.setDeadline.mockResolvedValue(undefined);

      const result = await service.getDeadline(STUDY_ID, PROBLEM_ID);

      expect(result).toEqual({
        deadline: null,
        weekNumber: '3월1주차',
        status: 'db_hit',
      });
    });
  });

  // ──────────────────────────────────────────────
  // 10. update() — QueryRunner 트랜잭션 + FOR UPDATE
  // ──────────────────────────────────────────────
  describe('update()', () => {
    it('전체 수정: 트랜잭션 내 FOR UPDATE + save + 커밋 후 캐시 무효화', async () => {
      const dto: UpdateProblemDto = {
        description: '수정된 설명',
        sourceUrl: 'https://codeforces.com/problem/1',
        sourcePlatform: 'Codeforces',
        deadline: '2026-04-01T23:59:59.000Z',
      };

      const updatedProblem = {
        ...mockProblem,
        description: '수정된 설명',
        sourceUrl: 'https://codeforces.com/problem/1',
        sourcePlatform: 'Codeforces',
        deadline: new Date('2026-04-01T23:59:59.000Z'),
      } as Problem;

      const mockQr = createMockQueryRunner();
      mockQr.manager.findOne.mockResolvedValue({ ...mockProblem });
      mockQr.manager.save.mockResolvedValue(updatedProblem);
      dataSource.createQueryRunner.mockReturnValue(mockQr);
      deadlineCache.invalidateDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      const result = await service.update(STUDY_ID, PROBLEM_ID, dto);

      // FOR UPDATE 락 확인
      expect(mockQr.manager.findOne).toHaveBeenCalledWith(Problem, {
        where: { id: PROBLEM_ID, studyId: STUDY_ID },
        lock: { mode: 'pessimistic_write' },
      });
      expect(mockQr.manager.save).toHaveBeenCalled();
      expect(mockQr.commitTransaction).toHaveBeenCalled();
      expect(mockQr.release).toHaveBeenCalled();
      expect(result).toEqual(updatedProblem);
    });

    it('부분 수정: 트랜잭션 + 캐시 무효화', async () => {
      const dto: UpdateProblemDto = {
        title: '수정된 제목',
        difficulty: Difficulty.GOLD,
        status: 'CLOSED',
      };

      const updatedProblem = {
        ...mockProblem,
        title: dto.title!,
        difficulty: Difficulty.GOLD,
        status: ProblemStatus.CLOSED,
      } as Problem;

      const mockQr = createMockQueryRunner();
      mockQr.manager.findOne.mockResolvedValue({ ...mockProblem });
      mockQr.manager.save.mockResolvedValue(updatedProblem);
      dataSource.createQueryRunner.mockReturnValue(mockQr);
      deadlineCache.invalidateDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      const result = await service.update(STUDY_ID, PROBLEM_ID, dto);

      // 트랜잭션 흐름 확인
      expect(mockQr.connect).toHaveBeenCalled();
      expect(mockQr.startTransaction).toHaveBeenCalled();
      expect(mockQr.commitTransaction).toHaveBeenCalled();

      // 캐시 무효화 (커밋 후)
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

    it('존재하지 않는 문제 수정 시 NotFoundException + 롤백', async () => {
      const dto: UpdateProblemDto = { title: '수정' };

      const mockQr = createMockQueryRunner();
      mockQr.manager.findOne.mockResolvedValue(null);
      dataSource.createQueryRunner.mockReturnValue(mockQr);

      await expect(service.update(STUDY_ID, 'non-existent', dto)).rejects.toThrow(NotFoundException);
      expect(mockQr.rollbackTransaction).toHaveBeenCalled();
      expect(mockQr.release).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // 10-2. update() — weekNumber 변경 시 구 주차 캐시 무효화
  // ──────────────────────────────────────────────
  describe('update() — weekNumber 변경', () => {
    it('weekNumber 변경: 구 주차 + 신 주차 캐시 모두 무효화', async () => {
      const dto: UpdateProblemDto = { weekNumber: '3월2주차' };
      const updatedProblem = { ...mockProblem, weekNumber: '3월2주차' } as Problem;

      const mockQr = createMockQueryRunner();
      mockQr.manager.findOne.mockResolvedValue({ ...mockProblem });
      mockQr.manager.save.mockResolvedValue(updatedProblem);
      dataSource.createQueryRunner.mockReturnValue(mockQr);
      deadlineCache.invalidateDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      await service.update(STUDY_ID, PROBLEM_ID, dto);

      // 두 번 호출: 신 주차 + 구 주차
      expect(deadlineCache.invalidateWeekProblems).toHaveBeenCalledTimes(2);
      expect(deadlineCache.invalidateWeekProblems).toHaveBeenCalledWith(STUDY_ID, '3월2주차');
      expect(deadlineCache.invalidateWeekProblems).toHaveBeenCalledWith(STUDY_ID, '3월1주차');
    });

    it('weekNumber 미변경: 구 주차 캐시 무효화 안 함', async () => {
      const dto: UpdateProblemDto = { title: '제목만 변경' };
      const updatedProblem = { ...mockProblem, title: '제목만 변경' } as Problem;

      const mockQr = createMockQueryRunner();
      mockQr.manager.findOne.mockResolvedValue({ ...mockProblem });
      mockQr.manager.save.mockResolvedValue(updatedProblem);
      dataSource.createQueryRunner.mockReturnValue(mockQr);
      deadlineCache.invalidateDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      await service.update(STUDY_ID, PROBLEM_ID, dto);

      // 한 번만 호출 (현재 주차만)
      expect(deadlineCache.invalidateWeekProblems).toHaveBeenCalledTimes(1);
    });

    it('allowedLanguages: null로 명시 설정 시 null 저장 (??null 분기)', async () => {
      const dto = { allowedLanguages: null } as unknown as UpdateProblemDto;
      const updatedProblem = { ...mockProblem, allowedLanguages: null } as Problem;

      const mockQr = createMockQueryRunner();
      mockQr.manager.findOne.mockResolvedValue({ ...mockProblem });
      mockQr.manager.save.mockResolvedValue(updatedProblem);
      dataSource.createQueryRunner.mockReturnValue(mockQr);
      deadlineCache.invalidateDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      const result = await service.update(STUDY_ID, PROBLEM_ID, dto);

      expect(result.allowedLanguages).toBeNull();
    });

    it('tags: null로 명시 설정 시 null 저장 (??null 분기)', async () => {
      const dto = { tags: null } as unknown as UpdateProblemDto;
      const updatedProblem = { ...mockProblem, tags: null } as Problem;

      const mockQr = createMockQueryRunner();
      mockQr.manager.findOne.mockResolvedValue({ ...mockProblem });
      mockQr.manager.save.mockResolvedValue(updatedProblem);
      dataSource.createQueryRunner.mockReturnValue(mockQr);
      deadlineCache.invalidateDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      const result = await service.update(STUDY_ID, PROBLEM_ID, dto);

      expect(result.tags).toBeNull();
    });

    it('deadline: 빈 문자열 설정 시 null 저장 (falsy 분기)', async () => {
      const dto = { deadline: '' } as unknown as UpdateProblemDto;
      const updatedProblem = { ...mockProblem, deadline: null } as unknown as Problem;

      const mockQr = createMockQueryRunner();
      mockQr.manager.findOne.mockResolvedValue({ ...mockProblem });
      mockQr.manager.save.mockResolvedValue(updatedProblem);
      dataSource.createQueryRunner.mockReturnValue(mockQr);
      deadlineCache.invalidateDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      const result = await service.update(STUDY_ID, PROBLEM_ID, dto);

      expect(result.deadline).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  // 11. delete() — soft delete
  // ──────────────────────────────────────────────
  describe('delete()', () => {
    it('문제 soft delete: DELETED 상태 + 캐시 무효화', async () => {
      const problem = { ...mockProblem };
      dualWrite.findOne.mockResolvedValue(problem);
      dualWrite.saveExisting.mockResolvedValue({ ...problem, status: ProblemStatus.DELETED });
      deadlineCache.invalidateDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      await service.delete(STUDY_ID, PROBLEM_ID);

      expect(dualWrite.saveExisting).toHaveBeenCalledWith(
        expect.objectContaining({ status: ProblemStatus.DELETED }),
      );
      expect(deadlineCache.invalidateDeadline).toHaveBeenCalledWith(STUDY_ID, PROBLEM_ID);
      expect(deadlineCache.invalidateWeekProblems).toHaveBeenCalledWith(STUDY_ID, mockProblem.weekNumber);
    });

    it('존재하지 않는 문제 삭제: NotFoundException', async () => {
      dualWrite.findOne.mockResolvedValue(null);

      await expect(service.delete(STUDY_ID, 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────
  // 12. findActiveByStudy()
  // ──────────────────────────────────────────────
  describe('findActiveByStudy()', () => {
    it('ACTIVE 상태 문제만 필터링하여 반환', async () => {
      const activeProblems = [mockProblem];
      dualWrite.find.mockResolvedValue(activeProblems);

      const result = await service.findActiveByStudy(STUDY_ID);

      expect(dualWrite.find).toHaveBeenCalledWith({
        where: { status: ProblemStatus.ACTIVE, studyId: STUDY_ID },
        order: { weekNumber: 'DESC', createdAt: 'ASC' },
      });
      expect(result).toEqual(activeProblems);
    });
  });

  // ──────────────────────────────────────────────
  // 13. findAllByStudy()
  // ──────────────────────────────────────────────
  describe('findAllByStudy()', () => {
    it('DRAFT 제외하여 반환 (ACTIVE + CLOSED 포함)', async () => {
      const problems = [mockProblem];
      dualWrite.find.mockResolvedValue(problems);

      const result = await service.findAllByStudy(STUDY_ID);

      expect(dualWrite.find).toHaveBeenCalledWith({
        where: { studyId: STUDY_ID, status: Not(In([ProblemStatus.DRAFT, ProblemStatus.DELETED])) },
        order: { weekNumber: 'ASC', createdAt: 'ASC' },
      });
      expect(result).toEqual(problems);
      expect(result).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────
  // 14. closeExpiredProblems()
  // ──────────────────────────────────────────────
  describe('closeExpiredProblems()', () => {
    it('만료된 ACTIVE 문제가 있으면 CLOSED로 전환 + 캐시 무효화', async () => {
      const expiredProblems = [
        { id: 'prob-001', studyId: STUDY_ID, weekNumber: '3월1주차' },
      ] as Problem[];

      dualWrite.find.mockResolvedValue(expiredProblems);
      dualWrite.isActive = false;

      const mockQr = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(mockQr);
      deadlineCache.invalidateDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      const result = await service.closeExpiredProblems();

      // 트랜잭션 흐름 확인
      expect(mockQr.connect).toHaveBeenCalled();
      expect(mockQr.startTransaction).toHaveBeenCalled();
      expect(mockQr.manager.createQueryBuilder).toHaveBeenCalled();
      expect(mockQr.commitTransaction).toHaveBeenCalled();
      expect(mockQr.release).toHaveBeenCalled();

      // 캐시 무효화 확인
      expect(deadlineCache.invalidateDeadline).toHaveBeenCalledWith(STUDY_ID, 'prob-001');
      expect(deadlineCache.invalidateWeekProblems).toHaveBeenCalledWith(STUDY_ID, '3월1주차');

      // 반환값 확인
      expect(result).toEqual({
        count: 1,
        affected: [{ studyId: STUDY_ID, id: 'prob-001', weekNumber: '3월1주차' }],
      });
    });

    it('만료된 문제 없으면 count: 0 반환 + 트랜잭션/캐시 호출 없음', async () => {
      dualWrite.find.mockResolvedValue([]);

      const result = await service.closeExpiredProblems();

      expect(result).toEqual({ count: 0, affected: [] });

      // 트랜잭션 생성 안 됨
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();

      // 캐시 무효화 안 됨
      expect(deadlineCache.invalidateDeadline).not.toHaveBeenCalled();
      expect(deadlineCache.invalidateWeekProblems).not.toHaveBeenCalled();
    });

    it('트랜잭션 에러 시 rollback 확인', async () => {
      const expiredProblems = [
        { id: 'prob-001', studyId: STUDY_ID, weekNumber: '3월1주차' },
      ] as Problem[];

      dualWrite.find.mockResolvedValue(expiredProblems);

      const mockQr = createMockQueryRunner();
      const dbError = new Error('DB write failed');
      mockQr.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        whereInIds: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(dbError),
      });
      dataSource.createQueryRunner.mockReturnValue(mockQr);

      await expect(service.closeExpiredProblems()).rejects.toThrow('DB write failed');

      expect(mockQr.rollbackTransaction).toHaveBeenCalled();
      expect(mockQr.release).toHaveBeenCalled();
      // 커밋 안 됨
      expect(mockQr.commitTransaction).not.toHaveBeenCalled();
    });

    it('중복 weekNumber dedup 확인 (동일 studyId+weekNumber인 문제 2개 → invalidateWeekProblems 1번만 호출)', async () => {
      const expiredProblems = [
        { id: 'prob-001', studyId: STUDY_ID, weekNumber: '3월1주차' },
        { id: 'prob-002', studyId: STUDY_ID, weekNumber: '3월1주차' },
      ] as Problem[];

      dualWrite.find.mockResolvedValue(expiredProblems);
      dualWrite.isActive = false;

      const mockQr = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(mockQr);
      deadlineCache.invalidateDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      const result = await service.closeExpiredProblems();

      // invalidateDeadline은 문제 수만큼 호출 (각각)
      expect(deadlineCache.invalidateDeadline).toHaveBeenCalledTimes(2);
      expect(deadlineCache.invalidateDeadline).toHaveBeenCalledWith(STUDY_ID, 'prob-001');
      expect(deadlineCache.invalidateDeadline).toHaveBeenCalledWith(STUDY_ID, 'prob-002');

      // invalidateWeekProblems는 dedup으로 1번만 호출
      expect(deadlineCache.invalidateWeekProblems).toHaveBeenCalledTimes(1);
      expect(deadlineCache.invalidateWeekProblems).toHaveBeenCalledWith(STUDY_ID, '3월1주차');

      expect(result.count).toBe(2);
    });

    it('dualWrite.isActive 시 비동기 동기화 호출', async () => {
      const expiredProblems = [
        { id: 'prob-001', studyId: STUDY_ID, weekNumber: '3월1주차' },
      ] as Problem[];

      dualWrite.find.mockResolvedValue(expiredProblems);
      dualWrite.isActive = true;
      dualWrite.findOne.mockResolvedValue({ id: 'prob-001', status: ProblemStatus.CLOSED });
      dualWrite.saveExisting.mockResolvedValue(undefined);

      const mockQr = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(mockQr);
      deadlineCache.invalidateDeadline.mockResolvedValue(undefined);
      deadlineCache.invalidateWeekProblems.mockResolvedValue(undefined);

      await service.closeExpiredProblems();

      // Dual Write 동기화: findOne → saveExisting
      expect(dualWrite.findOne).toHaveBeenCalledWith({ where: { id: 'prob-001' } });
      expect(dualWrite.saveExisting).toHaveBeenCalled();
    });
  });
});
