import { Test, TestingModule } from '@nestjs/testing';
import { ShareLinkController } from './share-link.controller';
import { ShareLinkService } from './share-link.service';
import { StudyMemberGuard } from '../common/guards/study-member.guard';

describe('ShareLinkController', () => {
  let controller: ShareLinkController;
  let service: Record<string, jest.Mock>;

  const USER_ID = 'user-uuid-001';
  const STUDY_ID = '550e8400-e29b-41d4-a716-446655440000';
  const LINK_ID = '550e8400-e29b-41d4-a716-446655440001';

  function createMockReq(overrides: Record<string, unknown> = {}) {
    return {
      headers: { 'x-user-id': USER_ID },
      ...overrides,
    } as never;
  }

  beforeEach(async () => {
    service = {
      createShareLink: jest.fn(),
      getShareLinks: jest.fn(),
      deactivateShareLink: jest.fn(),
      getProfileSettings: jest.fn(),
      updateProfileSettings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShareLinkController],
      providers: [{ provide: ShareLinkService, useValue: service }],
    })
      .overrideGuard(StudyMemberGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ShareLinkController>(ShareLinkController);
  });

  /* ───────── ShareLink CRUD ───────── */

  describe('createShareLink', () => {
    it('서비스 createShareLink 호출 + 결과 반환', async () => {
      const dto = { expiresAt: '2026-04-10T23:59:59Z' };
      const expected = { id: LINK_ID, token: 'abc' };
      service.createShareLink.mockResolvedValue(expected);

      const result = await controller.createShareLink(STUDY_ID, dto, createMockReq());

      expect(service.createShareLink).toHaveBeenCalledWith(STUDY_ID, USER_ID, dto);
      expect(result).toEqual(expected);
    });
  });

  describe('getShareLinks', () => {
    it('서비스 getShareLinks 호출 + 결과 반환', async () => {
      const expected = [{ id: LINK_ID }];
      service.getShareLinks.mockResolvedValue(expected);

      const result = await controller.getShareLinks(STUDY_ID, createMockReq());

      expect(service.getShareLinks).toHaveBeenCalledWith(STUDY_ID, USER_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('deactivateShareLink', () => {
    it('서비스 deactivateShareLink 호출 + 결과 반환', async () => {
      const expected = { message: '비활성화 완료' };
      service.deactivateShareLink.mockResolvedValue(expected);

      const result = await controller.deactivateShareLink(STUDY_ID, LINK_ID, createMockReq());

      expect(service.deactivateShareLink).toHaveBeenCalledWith(LINK_ID, STUDY_ID, USER_ID);
      expect(result).toEqual(expected);
    });
  });

  /* ───────── Profile Settings ───────── */

  describe('getProfileSettings', () => {
    it('서비스 getProfileSettings 호출', async () => {
      const expected = { profileSlug: 'my-slug', isProfilePublic: true };
      service.getProfileSettings.mockResolvedValue(expected);

      const result = await controller.getProfileSettings(createMockReq());

      expect(service.getProfileSettings).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(expected);
    });
  });

  describe('updateProfileSettings', () => {
    it('서비스 updateProfileSettings 호출', async () => {
      const dto = { profileSlug: 'new-slug', isProfilePublic: true };
      const expected = { profileSlug: 'new-slug', isProfilePublic: true };
      service.updateProfileSettings.mockResolvedValue(expected);

      const result = await controller.updateProfileSettings(createMockReq(), dto);

      expect(service.updateProfileSettings).toHaveBeenCalledWith(USER_ID, dto);
      expect(result).toEqual(expected);
    });
  });

  /* ───────── 보안: StudyMemberGuard 적용 확인 ───────── */
  describe('보안 — StudyMemberGuard 적용', () => {
    it('createShareLink에 StudyMemberGuard 데코레이터 적용됨', () => {
      const guards = Reflect.getMetadata('__guards__', ShareLinkController.prototype.createShareLink);
      expect(guards).toBeDefined();
      expect(guards.some((g: Function) => g === StudyMemberGuard || g.name === 'StudyMemberGuard')).toBe(true);
    });

    it('getShareLinks에 StudyMemberGuard 데코레이터 적용됨', () => {
      const guards = Reflect.getMetadata('__guards__', ShareLinkController.prototype.getShareLinks);
      expect(guards).toBeDefined();
      expect(guards.some((g: Function) => g === StudyMemberGuard || g.name === 'StudyMemberGuard')).toBe(true);
    });

    it('deactivateShareLink에 StudyMemberGuard 데코레이터 적용됨', () => {
      const guards = Reflect.getMetadata('__guards__', ShareLinkController.prototype.deactivateShareLink);
      expect(guards).toBeDefined();
      expect(guards.some((g: Function) => g === StudyMemberGuard || g.name === 'StudyMemberGuard')).toBe(true);
    });
  });
});
