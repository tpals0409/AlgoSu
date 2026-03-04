import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';

describe('AvatarController', () => {
  let controller: AvatarController;
  let avatarService: Record<string, jest.Mock>;

  const USER_ID = 'user-id-1';

  function createMockReq(userId?: string) {
    return { headers: { 'x-user-id': userId ?? USER_ID } } as never;
  }

  function createMockFile(): Express.Multer.File {
    return {
      fieldname: 'file',
      originalname: 'avatar.png',
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: Buffer.from('fake-image'),
      size: 1024,
    } as Express.Multer.File;
  }

  beforeEach(async () => {
    avatarService = {
      uploadAvatar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvatarController],
      providers: [{ provide: AvatarService, useValue: avatarService }],
    }).compile();

    controller = module.get<AvatarController>(AvatarController);
  });

  describe('uploadAvatar', () => {
    it('프로필 이미지 업로드 성공', async () => {
      const file = createMockFile();
      avatarService.uploadAvatar.mockResolvedValue({ avatarUrl: 'https://minio/avatars/user.png' });

      const result = await controller.uploadAvatar(file, createMockReq());

      expect(avatarService.uploadAvatar).toHaveBeenCalledWith(USER_ID, file);
      expect(result).toEqual({ avatarUrl: 'https://minio/avatars/user.png' });
    });

    it('userId 없으면 BadRequestException', async () => {
      const file = createMockFile();
      const req = { headers: {} } as never;

      await expect(controller.uploadAvatar(file, req)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAvatar', () => {
    it('프로필 이미지 삭제 — void 반환', async () => {
      const result = await controller.deleteAvatar(createMockReq());
      expect(result).toBeUndefined();
    });

    it('userId 없으면 BadRequestException', async () => {
      const req = { headers: {} } as never;
      await expect(controller.deleteAvatar(req)).rejects.toThrow(BadRequestException);
    });
  });
});
