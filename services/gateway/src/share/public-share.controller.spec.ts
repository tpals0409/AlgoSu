import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PublicShareController } from './public-share.controller';
import { ShareLinkGuard } from '../common/guards/share-link.guard';
import { Study, StudyMember } from '../study/study.entity';
import { User } from '../auth/oauth/user.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

/* global fetch 모킹 */
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('PublicShareController', () => {
  let controller: PublicShareController;
  let studyRepo: Record<string, jest.Mock>;
  let memberRepo: Record<string, jest.Mock>;
  let userRepo: Record<string, jest.Mock>;

  const STUDY_ID = 'study-uuid-001';
  const CREATED_BY = 'user-uuid-001';
  const SUBMISSION_ID = 'sub-uuid-001';

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  function createMockReq(overrides: Record<string, unknown> = {}) {
    return {
      headers: {
        'x-share-study-id': STUDY_ID,
        'x-share-created-by': CREATED_BY,
      },
      params: { token: 'a'.repeat(64) },
      ...overrides,
    } as never;
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    studyRepo = { findOne: jest.fn() };
    memberRepo = { find: jest.fn() };
    userRepo = { findOne: jest.fn() };

    const configMap: Record<string, string> = {
      PROBLEM_SERVICE_URL: 'http://problem:3001',
      INTERNAL_KEY_PROBLEM: 'pk',
      SUBMISSION_SERVICE_URL: 'http://submission:3003',
      INTERNAL_KEY_SUBMISSION: 'sk',
    };
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultVal: string) => {
        return configMap[key] ?? defaultVal;
      }),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        const value = configMap[key];
        if (value === undefined) throw new Error(`Missing config: ${key}`);
        return value;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicShareController],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(Study), useValue: studyRepo },
        { provide: getRepositoryToken(StudyMember), useValue: memberRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: StructuredLoggerService, useValue: mockLogger },
      ],
    })
      .overrideGuard(ShareLinkGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PublicShareController>(PublicShareController);
  });

  /* ───────── getSharedStudyMeta ───────── */
  describe('getSharedStudyMeta', () => {
    it('스터디 메타 정보 반환', async () => {
      studyRepo.findOne.mockResolvedValue({ id: STUDY_ID, name: '알고스터디' });
      memberRepo.find.mockResolvedValue([
        { user_id: 'u1', nickname: '닉1', role: 'ADMIN' },
        { user_id: 'u2', nickname: '닉2', role: 'MEMBER' },
      ]);
      userRepo.findOne.mockResolvedValue({ name: '생성자', avatar_url: 'http://avatar' });

      const result = await controller.getSharedStudyMeta(createMockReq());

      expect(result.data.studyName).toBe('알고스터디');
      expect(result.data.memberCount).toBe(2);
      expect(result.data.createdBy.name).toBe('생성자');
      expect(result.data.members).toHaveLength(2);
    });

    it('스터디 미존재 — NotFoundException', async () => {
      studyRepo.findOne.mockResolvedValue(null);

      await expect(controller.getSharedStudyMeta(createMockReq())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('생성자 미존재 — name/avatarUrl null', async () => {
      studyRepo.findOne.mockResolvedValue({ id: STUDY_ID, name: '스터디' });
      memberRepo.find.mockResolvedValue([]);
      userRepo.findOne.mockResolvedValue(null);

      const result = await controller.getSharedStudyMeta(createMockReq());

      expect(result.data.createdBy.name).toBeNull();
      expect(result.data.createdBy.avatarUrl).toBeNull();
    });
  });

  /* ───────── getSharedProblems ───────── */
  describe('getSharedProblems', () => {
    it('Problem Service 프록시 성공', async () => {
      const mockJson = { data: [{ id: 'p1' }] };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockJson) });

      const result = await controller.getSharedProblems(createMockReq());

      expect(mockFetch).toHaveBeenCalledWith(
        'http://problem:3001/all',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Internal-Key': 'pk',
            'X-Study-ID': STUDY_ID,
            'X-User-ID': CREATED_BY,
          }),
        }),
      );
      expect(result).toEqual(mockJson);
    });

    it('Problem Service 실패 — NotFoundException', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      await expect(controller.getSharedProblems(createMockReq())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ───────── getSharedSubmissions ───────── */
  describe('getSharedSubmissions', () => {
    it('Submission Service 프록시 성공', async () => {
      const mockJson = { data: [{ id: 's1' }] };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockJson) });

      const result = await controller.getSharedSubmissions(createMockReq());

      expect(mockFetch).toHaveBeenCalledWith(
        `http://submission:3003/internal/study-all/${STUDY_ID}`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ 'X-Internal-Key': 'sk' }),
        }),
      );
      expect(result).toEqual(mockJson);
    });

    it('Submission Service 실패 — NotFoundException', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      await expect(controller.getSharedSubmissions(createMockReq())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ───────── getSharedAnalysis ───────── */
  describe('getSharedAnalysis', () => {
    it('분석 결과 프록시 성공 — 정상 필드 매핑', async () => {
      const mockResult = {
        data: {
          aiFeedback: 'good',
          aiScore: 85,
          aiOptimizedCode: 'optimized',
          aiAnalysisStatus: 'COMPLETED',
          code: 'console.log(1)',
        },
      };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResult) });

      const result = await controller.getSharedAnalysis(SUBMISSION_ID);

      expect(result.data).toEqual({
        feedback: 'good',
        score: 85,
        optimizedCode: 'optimized',
        analysisStatus: 'COMPLETED',
        code: 'console.log(1)',
      });
    });

    it('분석 결과 — 누락 필드 null 폴백', async () => {
      const mockResult = { data: {} };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResult) });

      const result = await controller.getSharedAnalysis(SUBMISSION_ID);

      expect(result.data).toEqual({
        feedback: null,
        score: null,
        optimizedCode: null,
        analysisStatus: null,
        code: null,
      });
    });

    it('Submission Service 분석 실패 — NotFoundException', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      await expect(controller.getSharedAnalysis(SUBMISSION_ID)).rejects.toThrow(NotFoundException);
    });
  });

  /* ───────── 보안: 쓰기 엔드포인트 없음 (GET only) ───────── */
  describe('보안 — 쓰기 엔드포인트 없음', () => {
    it('컨트롤러에 POST/PUT/DELETE/PATCH 메서드가 없음 — GET only', () => {
      const prototype = Object.getPrototypeOf(controller);
      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        (name) => name !== 'constructor' && typeof prototype[name] === 'function',
      );

      // 모든 메서드가 GET 엔드포인트임을 메타데이터로 확인
      // NestJS에서 @Get 데코레이터는 Reflect.getMetadata('method', ...)로 확인 가능
      for (const method of methodNames) {
        const httpMethod = Reflect.getMetadata('method', prototype[method]);
        // RequestMethod.GET = 0 in NestJS
        if (httpMethod !== undefined) {
          expect(httpMethod).toBe(0); // RequestMethod.GET
        }
      }
    });

    it('컨트롤러에 쓰기 가능한 public 메서드가 없음', () => {
      const prototype = Object.getPrototypeOf(controller);
      const publicMethods = Object.getOwnPropertyNames(prototype).filter(
        (name) => name !== 'constructor' && typeof prototype[name] === 'function',
      );

      // 모든 메서드 이름에 create/update/delete/remove/patch 포함 여부 확인
      const writeMethodPatterns = ['create', 'update', 'delete', 'remove', 'patch', 'post', 'put'];
      for (const method of publicMethods) {
        const lowerName = method.toLowerCase();
        const isWriteMethod = writeMethodPatterns.some((p) => lowerName.includes(p));
        expect(isWriteMethod).toBe(false);
      }
    });
  });

  /* ───────── 보안: 다른 스터디 데이터 접근 불가 ───────── */
  describe('보안 — 다른 스터디 데이터 접근 불가', () => {
    it('프록시 요청 시 헤더의 study_id만 사용 (다른 스터디 접근 불가)', async () => {
      const mockJson = { data: [{ id: 'p1' }] };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockJson) });

      const req = createMockReq({
        headers: {
          'x-share-study-id': STUDY_ID,
          'x-share-created-by': CREATED_BY,
        },
      });

      await controller.getSharedProblems(req);

      // fetch 호출 시 x-share-study-id 헤더 값(STUDY_ID)만 사용되어야 함 (OTHER_STUDY_ID가 아닌)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Study-ID': STUDY_ID,
          }),
        }),
      );
    });

    it('Submissions 프록시 — 헤더의 study_id로만 URL 구성', async () => {
      const mockJson = { data: [] };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockJson) });

      await controller.getSharedSubmissions(createMockReq());

      expect(mockFetch).toHaveBeenCalledWith(
        `http://submission:3003/internal/study-all/${STUDY_ID}`,
        expect.any(Object),
      );
    });
  });
});
