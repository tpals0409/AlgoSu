import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { StudyActiveGuard } from './study-active.guard';
import { Study, StudyStatus } from '../../study/study.entity';
import { Repository } from 'typeorm';

describe('StudyActiveGuard', () => {
  let guard: StudyActiveGuard;
  let studyRepo: Record<string, jest.Mock>;

  const STUDY_ID = 'study-uuid-001';

  const mockLogger = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  function createMockContext(params: Record<string, string> = { id: STUDY_ID }): ExecutionContext {
    const request = { params };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    studyRepo = {
      findOne: jest.fn(),
    };

    guard = new StudyActiveGuard(
      studyRepo as unknown as Repository<Study>,
      mockLogger as any,
    );
  });

  // ──────────────────────────────────────────────
  // studyId 없는 경우
  // ──────────────────────────────────────────────
  it('studyId 파라미터 없으면 true 반환 (가드 통과)', async () => {
    const ctx = createMockContext({});

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(studyRepo.findOne).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // 스터디 미존재
  // ──────────────────────────────────────────────
  it('스터디 미존재 — true 반환 (서비스 레이어에서 404 처리)', async () => {
    studyRepo.findOne.mockResolvedValue(null);
    const ctx = createMockContext();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(studyRepo.findOne).toHaveBeenCalledWith({ where: { id: STUDY_ID } });
  });

  // ──────────────────────────────────────────────
  // ACTIVE 스터디
  // ──────────────────────────────────────────────
  it('ACTIVE 스터디 — true 반환', async () => {
    studyRepo.findOne.mockResolvedValue({ id: STUDY_ID, status: StudyStatus.ACTIVE });
    const ctx = createMockContext();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  // ──────────────────────────────────────────────
  // CLOSED 스터디
  // ──────────────────────────────────────────────
  it('CLOSED 스터디 — ForbiddenException', async () => {
    studyRepo.findOne.mockResolvedValue({ id: STUDY_ID, status: StudyStatus.CLOSED });
    const ctx = createMockContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('종료된 스터디입니다.');
    expect(mockLogger.warn).toHaveBeenCalled();
  });
});
