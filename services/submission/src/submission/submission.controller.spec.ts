import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { SubmissionController } from './submission.controller';
import { SubmissionService } from './submission.service';
import { DraftService } from '../draft/draft.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { StudyMemberGuard } from '../common/guards/study-member.guard';

describe('SubmissionController', () => {
  let controller: SubmissionController;
  let submissionService: jest.Mocked<SubmissionService>;
  let draftService: jest.Mocked<DraftService>;

  beforeEach(async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubmissionController],
      providers: [
        {
          provide: SubmissionService,
          useValue: {
            create: jest.fn(),
            findByStudyAndUserPaginated: jest.fn(),
            findById: jest.fn(),
            findByProblem: jest.fn(),
          },
        },
        {
          provide: DraftService,
          useValue: {
            deleteByProblem: jest.fn(),
            upsert: jest.fn(),
            findByProblem: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(InternalKeyGuard).useValue({ canActivate: () => true })
      .overrideGuard(StudyMemberGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SubmissionController>(SubmissionController);
    submissionService = module.get(SubmissionService);
    draftService = module.get(DraftService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create()', () => {
    it('제출을 생성하고 Draft를 삭제한다', async () => {
      const dto = { problemId: 'prob-1', language: 'python', code: 'print(1)' } as any;
      const mockSubmission = { id: 'sub-1', ...dto };
      submissionService.create.mockResolvedValue(mockSubmission as any);
      draftService.deleteByProblem.mockResolvedValue(undefined);

      const result = await controller.create(dto, 'user-1', 'study-1');

      expect(result).toEqual({ data: mockSubmission });
      expect(submissionService.create).toHaveBeenCalledWith(dto, 'user-1', 'study-1');
      expect(draftService.deleteByProblem).toHaveBeenCalledWith('study-1', 'user-1', 'prob-1');
    });
  });

  describe('findByStudyAndUser()', () => {
    it('페이지네이션된 제출 목록을 반환한다', async () => {
      const query = { page: 1, size: 10 } as any;
      const mockResult = { data: [], total: 0 };
      submissionService.findByStudyAndUserPaginated.mockResolvedValue(mockResult as any);

      const result = await controller.findByStudyAndUser(query, 'user-1', 'study-1');

      expect(result).toEqual(mockResult);
      expect(submissionService.findByStudyAndUserPaginated).toHaveBeenCalledWith('study-1', 'user-1', query);
    });
  });

  describe('findById()', () => {
    it('본인 제출을 반환한다', async () => {
      const mockSubmission = { id: 'sub-1', userId: 'user-1', studyId: 'study-1' };
      submissionService.findById.mockResolvedValue(mockSubmission as any);

      const result = await controller.findById('sub-1', 'user-1', 'study-1');

      expect(result).toEqual({ data: mockSubmission });
    });

    it('다른 사용자의 제출이면 ForbiddenException을 던진다', async () => {
      const mockSubmission = { id: 'sub-1', userId: 'other-user', studyId: 'study-1' };
      submissionService.findById.mockResolvedValue(mockSubmission as any);

      await expect(controller.findById('sub-1', 'user-1', 'study-1')).rejects.toThrow(ForbiddenException);
    });

    it('다른 스터디의 제출이면 ForbiddenException을 던진다', async () => {
      const mockSubmission = { id: 'sub-1', userId: 'user-1', studyId: 'other-study' };
      submissionService.findById.mockResolvedValue(mockSubmission as any);

      await expect(controller.findById('sub-1', 'user-1', 'study-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAnalysis()', () => {
    it('본인 제출의 AI 분석 결과를 반환한다', async () => {
      const mockSubmission = {
        id: 'sub-1',
        userId: 'user-1',
        studyId: 'study-1',
        aiFeedback: 'good',
        aiScore: 85,
        aiOptimizedCode: 'optimized',
        aiAnalysisStatus: 'completed',
      };
      submissionService.findById.mockResolvedValue(mockSubmission as any);

      const result = await controller.getAnalysis('sub-1', 'user-1', 'study-1');

      expect(result.data).toEqual({
        feedback: 'good',
        score: 85,
        optimizedCode: 'optimized',
        analysisStatus: 'completed',
      });
    });

    it('다른 사용자의 분석 결과이면 ForbiddenException을 던진다', async () => {
      const mockSubmission = { id: 'sub-1', userId: 'other', studyId: 'study-1' };
      submissionService.findById.mockResolvedValue(mockSubmission as any);

      await expect(controller.getAnalysis('sub-1', 'user-1', 'study-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByProblem()', () => {
    it('문제별 제출 목록을 반환한다', async () => {
      const mockList = [{ id: 'sub-1' }];
      submissionService.findByProblem.mockResolvedValue(mockList as any);

      const result = await controller.findByProblem('prob-1', 'user-1', 'study-1');

      expect(result).toEqual({ data: mockList });
      expect(submissionService.findByProblem).toHaveBeenCalledWith('study-1', 'user-1', 'prob-1');
    });
  });

  describe('upsertDraft()', () => {
    it('Draft를 upsert하고 반환한다', async () => {
      const dto = { problemId: 'prob-1', code: 'draft code', language: 'python' } as any;
      const mockDraft = { id: 'draft-1', ...dto };
      draftService.upsert.mockResolvedValue(mockDraft as any);

      const result = await controller.upsertDraft(dto, 'user-1', 'study-1');

      expect(result).toEqual({ data: mockDraft });
    });
  });

  describe('findDraft()', () => {
    it('문제별 Draft를 반환한다', async () => {
      const mockDraft = { id: 'draft-1' };
      draftService.findByProblem.mockResolvedValue(mockDraft as any);

      const result = await controller.findDraft('prob-1', 'user-1', 'study-1');

      expect(result).toEqual({ data: mockDraft });
    });
  });

  describe('deleteDraft()', () => {
    it('Draft를 삭제한다', async () => {
      draftService.deleteByProblem.mockResolvedValue(undefined);

      await controller.deleteDraft('prob-1', 'user-1', 'study-1');

      expect(draftService.deleteByProblem).toHaveBeenCalledWith('study-1', 'user-1', 'prob-1');
    });
  });
});
