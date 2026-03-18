import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';
import { StudyMemberRole, StudyStatus } from './study.entity';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

const mockStudy = { id: 'study-1', name: '알고리즘 스터디', status: StudyStatus.ACTIVE };
const mockMember = { id: 'member-1', study_id: 'study-1', user_id: 'user-1', role: StudyMemberRole.ADMIN, nickname: '닉네임' };
const mockInvite = { id: 'invite-1', code: 'ABCD1234', study_id: 'study-1', used_count: 0 };

describe('StudyController', () => {
  let controller: StudyController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudyController],
      providers: [
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-key') },
        },
        {
          provide: StructuredLoggerService,
          useValue: { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
        {
          provide: StudyService,
          useValue: {
            createStudy: jest.fn(),
            findById: jest.fn(),
            findByUserId: jest.fn(),
            updateStudy: jest.fn(),
            deleteStudy: jest.fn(),
            addMember: jest.fn(),
            getMembers: jest.fn(),
            getMember: jest.fn(),
            removeMember: jest.fn(),
            changeRole: jest.fn(),
            updateNickname: jest.fn(),
            createInvite: jest.fn(),
            findInviteByCode: jest.fn(),
            consumeInvite: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(StudyController);
    service = module.get(StudyService) as unknown as Record<string, jest.Mock>;
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Study CRUD ──────────────────────────────────

  describe('POST /api/studies', () => {
    it('스터디를 생성하고 data로 감싸 반환한다', async () => {
      service.createStudy.mockResolvedValue(mockStudy);
      const dto = { name: '알고리즘 스터디', created_by: 'user-1', nickname: '닉네임' };

      const result = await controller.createStudy(dto as any);

      expect(result).toEqual({ data: mockStudy });
      expect(service.createStudy).toHaveBeenCalledWith(dto);
    });
  });

  describe('GET /api/studies/:id', () => {
    it('스터디 상세를 반환한다', async () => {
      service.findById.mockResolvedValue(mockStudy);

      const result = await controller.findById('study-1');

      expect(result).toEqual({ data: mockStudy });
      expect(service.findById).toHaveBeenCalledWith('study-1');
    });
  });

  describe('GET /api/studies/by-user/:userId', () => {
    it('사용자 참여 스터디 목록을 반환한다', async () => {
      const studies = [mockStudy];
      service.findByUserId.mockResolvedValue(studies);

      const result = await controller.findByUserId('user-1');

      expect(result).toEqual({ data: studies });
      expect(service.findByUserId).toHaveBeenCalledWith('user-1');
    });
  });

  describe('PUT /api/studies/:id', () => {
    it('스터디를 수정하고 결과를 반환한다', async () => {
      const updated = { ...mockStudy, name: '변경됨' };
      service.updateStudy.mockResolvedValue(updated);
      const dto = { name: '변경됨' };

      const result = await controller.updateStudy('study-1', dto as any);

      expect(result).toEqual({ data: updated });
      expect(service.updateStudy).toHaveBeenCalledWith('study-1', dto);
    });
  });

  describe('DELETE /api/studies/:id', () => {
    it('스터디를 삭제하고 success를 반환한다', async () => {
      service.deleteStudy.mockResolvedValue(undefined);

      const result = await controller.deleteStudy('study-1');

      expect(result).toEqual({ data: { success: true } });
      expect(service.deleteStudy).toHaveBeenCalledWith('study-1');
    });
  });

  // ─── StudyMember 관리 ────────────────────────────

  describe('POST /api/studies/:id/members', () => {
    it('멤버를 추가하고 결과를 반환한다', async () => {
      service.addMember.mockResolvedValue(mockMember);
      const dto = { userId: 'user-1', nickname: '닉네임', role: StudyMemberRole.ADMIN };

      const result = await controller.addMember('study-1', dto as any);

      expect(result).toEqual({ data: mockMember });
      expect(service.addMember).toHaveBeenCalledWith('study-1', 'user-1', '닉네임', StudyMemberRole.ADMIN);
    });
  });

  describe('GET /api/studies/:id/members', () => {
    it('전체 멤버 목록을 반환한다', async () => {
      const members = [mockMember];
      service.getMembers.mockResolvedValue(members);

      const result = await controller.getMembers('study-1');

      expect(result).toEqual({ data: members });
      expect(service.getMembers).toHaveBeenCalledWith('study-1');
    });
  });

  describe('GET /api/studies/:id/members/:userId', () => {
    it('멤버 단건을 반환한다', async () => {
      service.getMember.mockResolvedValue(mockMember);

      const result = await controller.getMember('study-1', 'user-1');

      expect(result).toEqual({ data: mockMember });
      expect(service.getMember).toHaveBeenCalledWith('study-1', 'user-1');
    });
  });

  describe('DELETE /api/studies/:id/members/:userId', () => {
    it('멤버를 제거하고 success를 반환한다', async () => {
      service.removeMember.mockResolvedValue(undefined);

      const result = await controller.removeMember('study-1', 'user-1');

      expect(result).toEqual({ data: { success: true } });
      expect(service.removeMember).toHaveBeenCalledWith('study-1', 'user-1');
    });
  });

  describe('PATCH /api/studies/:id/members/:userId/role', () => {
    it('멤버 역할을 변경하고 결과를 반환한다', async () => {
      const updated = { ...mockMember, role: StudyMemberRole.MEMBER };
      service.changeRole.mockResolvedValue(updated);

      const result = await controller.changeRole('study-1', 'user-1', { role: StudyMemberRole.MEMBER } as any);

      expect(result).toEqual({ data: updated });
      expect(service.changeRole).toHaveBeenCalledWith('study-1', 'user-1', StudyMemberRole.MEMBER);
    });
  });

  describe('PATCH /api/studies/:id/members/:userId/nickname', () => {
    it('멤버 닉네임을 수정하고 결과를 반환한다', async () => {
      const updated = { ...mockMember, nickname: '새닉네임' };
      service.updateNickname.mockResolvedValue(updated);

      const result = await controller.updateNickname('study-1', 'user-1', { nickname: '새닉네임' } as any);

      expect(result).toEqual({ data: updated });
      expect(service.updateNickname).toHaveBeenCalledWith('study-1', 'user-1', '새닉네임');
    });
  });

  // ─── StudyInvite 관리 ────────────────────────────

  describe('POST /api/studies/:id/invites', () => {
    it('초대를 생성하고 결과를 반환한다', async () => {
      service.createInvite.mockResolvedValue(mockInvite);
      const dto = { created_by: 'user-1', expires_at: '2030-01-01T00:00:00Z', max_uses: 10 };

      const result = await controller.createInvite('study-1', dto as any);

      expect(result).toEqual({ data: mockInvite });
      expect(service.createInvite).toHaveBeenCalledWith({
        study_id: 'study-1',
        created_by: 'user-1',
        expires_at: expect.any(Date),
        max_uses: 10,
      });
    });
  });

  describe('GET /api/invites/by-code/:code', () => {
    it('코드로 초대를 조회하고 반환한다', async () => {
      service.findInviteByCode.mockResolvedValue(mockInvite);

      const result = await controller.findInviteByCode('ABCD1234');

      expect(result).toEqual({ data: mockInvite });
      expect(service.findInviteByCode).toHaveBeenCalledWith('ABCD1234');
    });
  });

  describe('PATCH /api/invites/:id/consume', () => {
    it('초대 사용 횟수를 증가시키고 결과를 반환한다', async () => {
      const consumed = { ...mockInvite, used_count: 1 };
      service.consumeInvite.mockResolvedValue(consumed);

      const result = await controller.consumeInvite('invite-1');

      expect(result).toEqual({ data: consumed });
      expect(service.consumeInvite).toHaveBeenCalledWith('invite-1');
    });
  });
});
