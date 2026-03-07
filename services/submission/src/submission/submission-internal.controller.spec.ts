import { Test, TestingModule } from '@nestjs/testing';
import { SubmissionInternalController } from './submission-internal.controller';
import { SubmissionService } from './submission.service';
import { SagaOrchestratorService } from '../saga/saga-orchestrator.service';
import { GitHubSyncStatus } from './submission.entity';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';

describe('SubmissionInternalController', () => {
  let controller: SubmissionInternalController;
  let submissionService: jest.Mocked<SubmissionService>;
  let sagaOrchestrator: jest.Mocked<SagaOrchestratorService>;

  beforeEach(async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubmissionInternalController],
      providers: [
        {
          provide: SubmissionService,
          useValue: {
            findById: jest.fn(),
            updateAiResult: jest.fn(),
            updateGithubFilePath: jest.fn(),
            findByProblemForStudy: jest.fn(),
            getStudyStats: jest.fn(),
          },
        },
        {
          provide: SagaOrchestratorService,
          useValue: {
            advanceToAiQueued: jest.fn(),
            compensateGitHubFailed: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(InternalKeyGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SubmissionInternalController>(SubmissionInternalController);
    submissionService = module.get(SubmissionService);
    sagaOrchestrator = module.get(SagaOrchestratorService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findByIdInternal()', () => {
    it('제출 데이터를 반환한다', async () => {
      const mockSubmission = { id: 'sub-1', code: 'print(1)' };
      submissionService.findById.mockResolvedValue(mockSubmission as any);

      const result = await controller.findByIdInternal('sub-1');

      expect(result).toEqual({ data: mockSubmission });
    });
  });

  describe('updateAiResult()', () => {
    it('AI 분석 결과를 저장한다', async () => {
      const dto = { analysisStatus: 'completed', score: 90, feedback: 'good' } as any;
      const mockUpdated = { id: 'sub-1', aiScore: 90 };
      submissionService.updateAiResult.mockResolvedValue(mockUpdated as any);

      const result = await controller.updateAiResult('sub-1', dto);

      expect(result).toEqual({ data: mockUpdated });
      expect(submissionService.updateAiResult).toHaveBeenCalledWith('sub-1', dto);
    });
  });

  describe('getSubmissionOwner()', () => {
    it('제출 소유자의 userId를 반환한다', async () => {
      submissionService.findById.mockResolvedValue({ userId: 'user-1' } as any);

      const result = await controller.getSubmissionOwner('sub-1');

      expect(result).toEqual({ userId: 'user-1' });
    });
  });

  describe('findByProblemForStudy()', () => {
    it('studyId가 있으면 문제별 제출 목록을 반환한다', async () => {
      const mockList = [{ id: 'sub-1' }];
      submissionService.findByProblemForStudy.mockResolvedValue(mockList as any);

      const result = await controller.findByProblemForStudy('prob-1', 'study-1');

      expect(result).toEqual({ data: mockList });
    });

    it('studyId가 없으면 BadRequestException을 throw한다', async () => {
      await expect(
        controller.findByProblemForStudy('prob-1', undefined as any),
      ).rejects.toThrow('studyId 쿼리 파라미터가 필요합니다.');
    });
  });

  describe('getStudyStats()', () => {
    it('스터디 통계를 반환한다', async () => {
      const mockStats = { total: 10, avgScore: 80 };
      submissionService.getStudyStats.mockResolvedValue(mockStats as any);

      const result = await controller.getStudyStats('study-1', '1', 'user-1');

      expect(result).toEqual({ data: mockStats });
      expect(submissionService.getStudyStats).toHaveBeenCalledWith('study-1', '1', 'user-1');
    });
  });

  describe('githubSuccess()', () => {
    it('GitHub 성공 콜백을 처리한다', async () => {
      submissionService.updateGithubFilePath.mockResolvedValue(undefined);
      sagaOrchestrator.advanceToAiQueued.mockResolvedValue(undefined);

      const result = await controller.githubSuccess('sub-1', { filePath: 'path/to/file.py' } as any);

      expect(result).toEqual({ success: true });
      expect(submissionService.updateGithubFilePath).toHaveBeenCalledWith('sub-1', 'path/to/file.py');
      expect(sagaOrchestrator.advanceToAiQueued).toHaveBeenCalledWith('sub-1');
    });
  });

  describe('githubFailed()', () => {
    it('GitHub 실패 콜백을 처리한다', async () => {
      sagaOrchestrator.compensateGitHubFailed.mockResolvedValue(undefined);

      const result = await controller.githubFailed('sub-1');

      expect(result).toEqual({ success: true });
      expect(sagaOrchestrator.compensateGitHubFailed).toHaveBeenCalledWith('sub-1', GitHubSyncStatus.FAILED);
    });
  });

  describe('githubTokenInvalid()', () => {
    it('TOKEN_INVALID 콜백을 처리한다', async () => {
      sagaOrchestrator.compensateGitHubFailed.mockResolvedValue(undefined);

      const result = await controller.githubTokenInvalid('sub-1');

      expect(result).toEqual({ success: true });
      expect(sagaOrchestrator.compensateGitHubFailed).toHaveBeenCalledWith('sub-1', GitHubSyncStatus.TOKEN_INVALID);
    });
  });

  describe('githubSkipped()', () => {
    it('SKIPPED 콜백을 처리한다', async () => {
      sagaOrchestrator.compensateGitHubFailed.mockResolvedValue(undefined);

      const result = await controller.githubSkipped('sub-1');

      expect(result).toEqual({ success: true });
      expect(sagaOrchestrator.compensateGitHubFailed).toHaveBeenCalledWith('sub-1', GitHubSyncStatus.SKIPPED);
    });
  });
});
