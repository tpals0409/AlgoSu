import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DualWriteService } from './dual-write.service';
import { ReconciliationService } from './reconciliation.service';
import { Problem, ProblemStatus, Difficulty } from '../problem/problem.entity';
import { NEW_DB_CONNECTION, DualWriteMode } from './dual-write.config';
import { register } from 'prom-client';

// getDualWriteMode 모킹
jest.mock('./dual-write.config', () => {
  const actual = jest.requireActual('./dual-write.config');
  return {
    ...actual,
    getDualWriteMode: jest.fn(() => actual.DualWriteMode.OFF),
  };
});

import { getDualWriteMode } from './dual-write.config';
const mockGetDualWriteMode = getDualWriteMode as jest.MockedFunction<typeof getDualWriteMode>;

describe('DualWriteService', () => {
  let service: DualWriteService;
  let oldRepo: Partial<Record<keyof Repository<Problem>, jest.Mock>>;
  let newRepo: Partial<Record<keyof Repository<Problem>, jest.Mock>>;
  let reconciliation: { hasMismatch: boolean };

  const mockProblem: Problem = {
    id: 'prob-001',
    title: '테스트 문제',
    description: null,
    weekNumber: '3월1주차',
    difficulty: Difficulty.SILVER,
    level: null,
    sourceUrl: null,
    sourcePlatform: null,
    status: ProblemStatus.ACTIVE,
    deadline: null,
    allowedLanguages: null,
    tags: null,
    studyId: 'study-001',
    createdBy: 'user-001',
    publicId: 'pub-001',
    createdAt: new Date(),
    updatedAt: new Date(),
    generatePublicId: jest.fn(),
  };

  beforeEach(async () => {
    // prom-client 메트릭 충돌 방지
    register.clear();

    oldRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    newRepo = {
      save: jest.fn(),
    };

    reconciliation = {
      hasMismatch: false,
    };

    mockGetDualWriteMode.mockReturnValue(DualWriteMode.OFF);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DualWriteService,
        {
          provide: getRepositoryToken(Problem),
          useValue: oldRepo,
        },
        {
          provide: getRepositoryToken(Problem, NEW_DB_CONNECTION),
          useValue: newRepo,
        },
        {
          provide: ReconciliationService,
          useValue: reconciliation,
        },
      ],
    }).compile();

    service = module.get<DualWriteService>(DualWriteService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    register.clear();
  });

  // ──────────────────────────────────────────────
  // onModuleInit
  // ──────────────────────────────────────────────
  describe('onModuleInit()', () => {
    it('환경변수에서 모드를 읽어 설정한다', () => {
      mockGetDualWriteMode.mockReturnValue(DualWriteMode.EXPAND);
      service.onModuleInit();
      expect(service.isActive).toBe(true);
    });

    it('OFF 모드에서 isActive는 false', () => {
      mockGetDualWriteMode.mockReturnValue(DualWriteMode.OFF);
      service.onModuleInit();
      expect(service.isActive).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // isActive
  // ──────────────────────────────────────────────
  describe('isActive', () => {
    it('EXPAND 모드에서 true 반환', () => {
      mockGetDualWriteMode.mockReturnValue(DualWriteMode.EXPAND);
      service.onModuleInit();
      expect(service.isActive).toBe(true);
    });

    it('SWITCH_READ 모드에서 true 반환', () => {
      mockGetDualWriteMode.mockReturnValue(DualWriteMode.SWITCH_READ);
      service.onModuleInit();
      expect(service.isActive).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // findOne
  // ──────────────────────────────────────────────
  describe('findOne()', () => {
    it('OFF 모드: 구 DB에서 조회', async () => {
      oldRepo.findOne!.mockResolvedValue(mockProblem);

      const result = await service.findOne({ where: { id: 'prob-001' } });

      expect(oldRepo.findOne).toHaveBeenCalledWith({ where: { id: 'prob-001' } });
      expect(result).toEqual(mockProblem);
    });

    it('SWITCH_READ 모드 + 불일치 없음: 신 DB에서 조회', async () => {
      mockGetDualWriteMode.mockReturnValue(DualWriteMode.SWITCH_READ);
      service.onModuleInit();
      reconciliation.hasMismatch = false;

      // newRepo에 findOne 추가
      (newRepo as Record<string, jest.Mock>).findOne = jest.fn().mockResolvedValue(mockProblem);

      const result = await service.findOne({ where: { id: 'prob-001' } });

      expect((newRepo as Record<string, jest.Mock>).findOne).toHaveBeenCalled();
      expect(result).toEqual(mockProblem);
    });

    it('SWITCH_READ 모드 + 불일치 감지: 구 DB로 fallback', async () => {
      mockGetDualWriteMode.mockReturnValue(DualWriteMode.SWITCH_READ);
      service.onModuleInit();
      reconciliation.hasMismatch = true;

      oldRepo.findOne!.mockResolvedValue(mockProblem);

      const result = await service.findOne({ where: { id: 'prob-001' } });

      expect(oldRepo.findOne).toHaveBeenCalled();
      expect(result).toEqual(mockProblem);
    });
  });

  // ──────────────────────────────────────────────
  // find
  // ──────────────────────────────────────────────
  describe('find()', () => {
    it('OFF 모드: 구 DB에서 목록 조회', async () => {
      oldRepo.find!.mockResolvedValue([mockProblem]);

      const result = await service.find({ where: { studyId: 'study-001' } });

      expect(oldRepo.find).toHaveBeenCalledWith({ where: { studyId: 'study-001' } });
      expect(result).toEqual([mockProblem]);
    });
  });

  // ──────────────────────────────────────────────
  // save
  // ──────────────────────────────────────────────
  describe('save()', () => {
    it('OFF 모드: 구 DB에만 저장, 신 DB 미호출', async () => {
      oldRepo.create!.mockReturnValue(mockProblem);
      oldRepo.save!.mockResolvedValue(mockProblem);

      const result = await service.save({ title: '테스트 문제' });

      expect(oldRepo.create).toHaveBeenCalledWith({ title: '테스트 문제' });
      expect(oldRepo.save).toHaveBeenCalledWith(mockProblem);
      expect(newRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual(mockProblem);
    });

    it('EXPAND 모드: 양쪽 DB에 저장', async () => {
      mockGetDualWriteMode.mockReturnValue(DualWriteMode.EXPAND);
      service.onModuleInit();

      oldRepo.create!.mockReturnValue(mockProblem);
      oldRepo.save!.mockResolvedValue(mockProblem);
      newRepo.save!.mockResolvedValue(mockProblem);

      const result = await service.save({ title: '테스트 문제' });

      expect(oldRepo.save).toHaveBeenCalled();
      expect(newRepo.save).toHaveBeenCalledWith(mockProblem);
      expect(result).toEqual(mockProblem);
    });

    it('EXPAND 모드 + 신 DB 실패: 구 DB 결과는 정상 반환', async () => {
      mockGetDualWriteMode.mockReturnValue(DualWriteMode.EXPAND);
      service.onModuleInit();

      oldRepo.create!.mockReturnValue(mockProblem);
      oldRepo.save!.mockResolvedValue(mockProblem);
      newRepo.save!.mockRejectedValue(new Error('connection refused'));

      const result = await service.save({ title: '테스트 문제' });

      // 구 DB 결과 정상 반환 (fire-and-forget)
      expect(result).toEqual(mockProblem);

      // 신 DB 실패 프로미스가 resolve될 때까지 대기
      await new Promise((r) => setTimeout(r, 50));
    });
  });

  // ──────────────────────────────────────────────
  // create (메모리만)
  // ──────────────────────────────────────────────
  describe('create()', () => {
    it('oldRepo.create를 호출하여 엔티티 생성 (DB 저장 X)', () => {
      oldRepo.create!.mockReturnValue(mockProblem);

      const result = service.create({ title: '테스트 문제' });

      expect(oldRepo.create).toHaveBeenCalledWith({ title: '테스트 문제' });
      expect(result).toEqual(mockProblem);
      expect(oldRepo.save).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // saveExisting
  // ──────────────────────────────────────────────
  describe('saveExisting()', () => {
    it('OFF 모드: 구 DB에만 업데이트', async () => {
      oldRepo.save!.mockResolvedValue(mockProblem);

      const result = await service.saveExisting(mockProblem);

      expect(oldRepo.save).toHaveBeenCalledWith(mockProblem);
      expect(newRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual(mockProblem);
    });

    it('EXPAND 모드: 양쪽 DB 업데이트', async () => {
      mockGetDualWriteMode.mockReturnValue(DualWriteMode.EXPAND);
      service.onModuleInit();

      oldRepo.save!.mockResolvedValue(mockProblem);
      newRepo.save!.mockResolvedValue(mockProblem);

      const result = await service.saveExisting(mockProblem);

      expect(oldRepo.save).toHaveBeenCalledWith(mockProblem);
      expect(newRepo.save).toHaveBeenCalledWith(mockProblem);
      expect(result).toEqual(mockProblem);
    });
  });
});
