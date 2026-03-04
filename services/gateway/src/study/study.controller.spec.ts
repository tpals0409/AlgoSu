import { Test, TestingModule } from '@nestjs/testing';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';
import { StudyActiveGuard } from '../common/guards/study-active.guard';
import { StudyMemberGuard } from '../common/guards/study-member.guard';

describe('StudyController', () => {
  let controller: StudyController;
  let studyService: Record<string, jest.Mock>;

  const USER_ID = 'user-id-1';
  const STUDY_ID = '550e8400-e29b-41d4-a716-446655440000';
  const TARGET_USER_ID = '550e8400-e29b-41d4-a716-446655440001';

  function createMockReq(overrides: Record<string, unknown> = {}) {
    return {
      headers: { 'x-user-id': USER_ID, 'x-study-id': STUDY_ID },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      ...overrides,
    } as never;
  }

  beforeEach(async () => {
    studyService = {
      createStudy: jest.fn(),
      getMyStudies: jest.fn(),
      getStudyById: jest.fn(),
      updateStudy: jest.fn(),
      deleteStudy: jest.fn(),
      updateGroundRules: jest.fn(),
      createInvite: jest.fn(),
      verifyInviteCode: jest.fn(),
      joinByInviteCode: jest.fn(),
      leaveStudy: jest.fn(),
      closeStudy: jest.fn(),
      getStudyStats: jest.fn(),
      getMembers: jest.fn(),
      updateNickname: jest.fn(),
      changeMemberRole: jest.fn(),
      notifyProblemCreated: jest.fn(),
      removeMember: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudyController],
      providers: [{ provide: StudyService, useValue: studyService }],
    })
      .overrideGuard(StudyActiveGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(StudyMemberGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StudyController>(StudyController);
  });

  describe('create', () => {
    it('스터디 생성 — StudyService.createStudy 호출', async () => {
      const dto = { name: '알고리즘 스터디', nickname: '리더' };
      const expected = { id: STUDY_ID, name: '알고리즘 스터디' };
      studyService.createStudy.mockResolvedValue(expected);

      const result = await controller.create(createMockReq(), dto as any);

      expect(studyService.createStudy).toHaveBeenCalledWith(USER_ID, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('findMyStudies', () => {
    it('내 스터디 목록 조회', async () => {
      const expected = [{ id: STUDY_ID, name: 'study-1' }];
      studyService.getMyStudies.mockResolvedValue(expected);

      const result = await controller.findMyStudies(createMockReq());

      expect(studyService.getMyStudies).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('스터디 상세 조회', async () => {
      const expected = { id: STUDY_ID, name: 'study-1' };
      studyService.getStudyById.mockResolvedValue(expected);

      const result = await controller.findOne(STUDY_ID, createMockReq());

      expect(studyService.getStudyById).toHaveBeenCalledWith(STUDY_ID, USER_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('update', () => {
    it('스터디 수정', async () => {
      const body = { name: '수정된 스터디' };
      const expected = { id: STUDY_ID, name: '수정된 스터디' };
      studyService.updateStudy.mockResolvedValue(expected);

      const result = await controller.update(STUDY_ID, createMockReq(), body as any);

      expect(studyService.updateStudy).toHaveBeenCalledWith(STUDY_ID, USER_ID, body);
      expect(result).toEqual(expected);
    });
  });

  describe('remove', () => {
    it('스터디 삭제', async () => {
      studyService.deleteStudy.mockResolvedValue(undefined);

      const result = await controller.remove(STUDY_ID, createMockReq());

      expect(studyService.deleteStudy).toHaveBeenCalledWith(STUDY_ID, USER_ID);
      expect(result).toEqual({ message: '스터디가 삭제되었습니다.' });
    });
  });

  describe('updateGroundRules', () => {
    it('그라운드 룰 수정', async () => {
      const dto = { groundRules: '매일 1문제' };
      const expected = { id: STUDY_ID, groundRules: '매일 1문제' };
      studyService.updateGroundRules.mockResolvedValue(expected);

      const result = await controller.updateGroundRules(STUDY_ID, createMockReq(), dto as any);

      expect(studyService.updateGroundRules).toHaveBeenCalledWith(STUDY_ID, USER_ID, '매일 1문제');
      expect(result).toEqual(expected);
    });
  });

  describe('createInvite', () => {
    it('초대 코드 발급', async () => {
      const expected = { code: 'ABC123', expires_at: new Date() };
      studyService.createInvite.mockResolvedValue(expected);

      const result = await controller.createInvite(STUDY_ID, createMockReq());

      expect(studyService.createInvite).toHaveBeenCalledWith(STUDY_ID, USER_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('verifyInvite', () => {
    it('초대 코드 유효성 검증', async () => {
      const body = { code: 'ABC123' };
      const expected = { valid: true, studyName: '스터디' };
      studyService.verifyInviteCode.mockResolvedValue(expected);

      const result = await controller.verifyInvite(createMockReq(), body as any);

      expect(studyService.verifyInviteCode).toHaveBeenCalledWith('ABC123', '127.0.0.1');
      expect(result).toEqual(expected);
    });

    it('ip fallback — req.ip 없으면 socket.remoteAddress 사용', async () => {
      studyService.verifyInviteCode.mockResolvedValue({ valid: true, studyName: 's' });

      const req = createMockReq({ ip: undefined });
      await controller.verifyInvite(req, { code: 'X' } as any);

      expect(studyService.verifyInviteCode).toHaveBeenCalledWith('X', '127.0.0.1');
    });
  });

  describe('joinStudy', () => {
    it('초대 코드로 스터디 가입', async () => {
      const dto = { code: 'ABC123', nickname: '뉴비' };
      const expected = { id: STUDY_ID, role: 'MEMBER' };
      studyService.joinByInviteCode.mockResolvedValue(expected);

      const result = await controller.joinStudy(createMockReq(), dto as any);

      expect(studyService.joinByInviteCode).toHaveBeenCalledWith(USER_ID, 'ABC123', '뉴비', '127.0.0.1');
      expect(result).toEqual(expected);
    });
  });

  describe('leaveStudy', () => {
    it('스터디 탈퇴', async () => {
      studyService.leaveStudy.mockResolvedValue(undefined);

      const result = await controller.leaveStudy(STUDY_ID, createMockReq());

      expect(studyService.leaveStudy).toHaveBeenCalledWith(STUDY_ID, USER_ID);
      expect(result).toEqual({ message: '스터디에서 탈퇴했습니다.' });
    });
  });

  describe('closeStudy', () => {
    it('스터디 종료', async () => {
      studyService.closeStudy.mockResolvedValue(undefined);

      const result = await controller.closeStudy(STUDY_ID, createMockReq());

      expect(studyService.closeStudy).toHaveBeenCalledWith(STUDY_ID, USER_ID);
      expect(result).toEqual({ message: '스터디가 종료되었습니다.' });
    });
  });

  describe('getStudyStats', () => {
    it('스터디 통계 조회', async () => {
      const expected = { totalProblems: 10 };
      studyService.getStudyStats.mockResolvedValue(expected);

      const result = await controller.getStudyStats(STUDY_ID, '3', createMockReq());

      expect(studyService.getStudyStats).toHaveBeenCalledWith(STUDY_ID, USER_ID, '3');
      expect(result).toEqual(expected);
    });
  });

  describe('getMembers', () => {
    it('멤버 목록 조회', async () => {
      const expected = [{ user_id: USER_ID, role: 'ADMIN' }];
      studyService.getMembers.mockResolvedValue(expected);

      const result = await controller.getMembers(STUDY_ID, createMockReq());

      expect(studyService.getMembers).toHaveBeenCalledWith(STUDY_ID, USER_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('updateNickname', () => {
    it('닉네임 변경', async () => {
      const dto = { nickname: '새닉' };
      const expected = { nickname: '새닉' };
      studyService.updateNickname.mockResolvedValue(expected);

      const result = await controller.updateNickname(STUDY_ID, createMockReq(), dto as any);

      expect(studyService.updateNickname).toHaveBeenCalledWith(STUDY_ID, USER_ID, '새닉');
      expect(result).toEqual(expected);
    });
  });

  describe('changeMemberRole', () => {
    it('멤버 역할 변경', async () => {
      const dto = { role: 'ADMIN' };
      studyService.changeMemberRole.mockResolvedValue(undefined);

      const result = await controller.changeMemberRole(STUDY_ID, TARGET_USER_ID, createMockReq(), dto as any);

      expect(studyService.changeMemberRole).toHaveBeenCalledWith(STUDY_ID, TARGET_USER_ID, USER_ID, 'ADMIN');
      expect(result).toEqual({ message: '역할이 변경되었습니다.' });
    });
  });

  describe('notifyProblemCreated', () => {
    it('문제 생성 알림 전송', async () => {
      const body = { problemTitle: 'Two Sum', weekNumber: 1, problemId: 'prob-1' };
      studyService.notifyProblemCreated.mockResolvedValue(undefined);

      const result = await controller.notifyProblemCreated(STUDY_ID, createMockReq(), body as any);

      expect(studyService.notifyProblemCreated).toHaveBeenCalledWith(STUDY_ID, USER_ID, 'Two Sum', 1, 'prob-1');
      expect(result).toEqual({ message: '알림이 전송되었습니다.' });
    });
  });

  describe('removeMember', () => {
    it('멤버 추방', async () => {
      studyService.removeMember.mockResolvedValue(undefined);

      const result = await controller.removeMember(STUDY_ID, TARGET_USER_ID, createMockReq());

      expect(studyService.removeMember).toHaveBeenCalledWith(STUDY_ID, TARGET_USER_ID, USER_ID);
      expect(result).toEqual({ message: '멤버가 추방되었습니다.' });
    });
  });
});
