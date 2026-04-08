/**
 * @file 피드백 컨트롤러 단위 테스트
 * @domain feedback
 * @layer controller
 * @related FeedbackController, IdentityClientService
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { IdentityClientService } from '../identity-client/identity-client.service';

describe('FeedbackController', () => {
  let controller: FeedbackController;
  let identityClient: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;

  const USER_ID = 'user-id-1';
  const ADMIN_EMAIL = 'admin@test.com';
  const PUBLIC_ID = '550e8400-e29b-41d4-a716-446655440000';

  function createMockReq(userId = USER_ID) {
    return { headers: { 'x-user-id': userId } } as never;
  }

  beforeEach(async () => {
    identityClient = {
      createFeedback: jest.fn(),
      findFeedbacksByUserId: jest.fn(),
      findAllFeedbacks: jest.fn(),
      updateFeedbackStatus: jest.fn(),
      findUserById: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue(ADMIN_EMAIL),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedbackController],
      providers: [
        { provide: IdentityClientService, useValue: identityClient },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get<FeedbackController>(FeedbackController);
  });

  // ============================
  // 1. create — 피드백 생성
  // ============================
  describe('create', () => {
    it('x-user-id 헤더에서 userId 추출 후 identityClient.createFeedback 호출', async () => {
      const body = {
        category: 'BUG',
        content: '버그 신고합니다',
        pageUrl: '/problems',
      };
      const expected = { id: PUBLIC_ID, ...body, userId: USER_ID };
      identityClient.createFeedback.mockResolvedValue(expected);

      const result = await controller.create(createMockReq(), body as any);

      expect(identityClient.createFeedback).toHaveBeenCalledWith({
        userId: USER_ID,
        ...body,
      });
      expect(result).toEqual(expected);
    });
  });

  // ============================
  // 2. getMyFeedbacks — 내 피드백 목록
  // ============================
  describe('getMyFeedbacks', () => {
    it('identityClient.findFeedbacksByUserId 호출 후 목록 반환', async () => {
      const expected = [
        { id: PUBLIC_ID, category: 'GENERAL', content: '좋아요' },
      ];
      identityClient.findFeedbacksByUserId.mockResolvedValue(expected);

      const result = await controller.getMyFeedbacks(createMockReq());

      expect(identityClient.findFeedbacksByUserId).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(expected);
    });
  });

  // ============================
  // 3. findAll — 관리자 전체 목록
  // ============================
  describe('findAll', () => {
    it('admin 검증 통과 시 전체 피드백 목록 반환', async () => {
      identityClient.findUserById.mockResolvedValue({ email: ADMIN_EMAIL });
      const expected = { items: [], total: 0 };
      identityClient.findAllFeedbacks.mockResolvedValue(expected);

      const result = await controller.findAll(createMockReq(), '1', '10', undefined, undefined);

      expect(identityClient.findUserById).toHaveBeenCalledWith(USER_ID);
      expect(identityClient.findAllFeedbacks).toHaveBeenCalledWith(1, 10, undefined, undefined);
      expect(result).toEqual(expected);
    });

    it('admin이 아닌 경우 ForbiddenException 발생', async () => {
      identityClient.findUserById.mockResolvedValue({ email: 'user@test.com' });

      await expect(controller.findAll(createMockReq())).rejects.toThrow(
        ForbiddenException,
      );
      expect(identityClient.findAllFeedbacks).not.toHaveBeenCalled();
    });
  });

  // ============================
  // 4. updateStatus — 관리자 상태 변경
  // ============================
  describe('updateStatus', () => {
    it('admin 검증 통과 후 identityClient.updateFeedbackStatus 호출', async () => {
      identityClient.findUserById.mockResolvedValue({ email: ADMIN_EMAIL });
      const expected = { id: PUBLIC_ID, status: 'RESOLVED' };
      identityClient.updateFeedbackStatus.mockResolvedValue(expected);

      const result = await controller.updateStatus(
        createMockReq(),
        PUBLIC_ID,
        { status: 'RESOLVED' },
      );

      expect(identityClient.findUserById).toHaveBeenCalledWith(USER_ID);
      expect(identityClient.updateFeedbackStatus).toHaveBeenCalledWith(
        PUBLIC_ID,
        { status: 'RESOLVED' },
      );
      expect(result).toEqual(expected);
    });

    it('admin이 아닌 경우 ForbiddenException 발생', async () => {
      identityClient.findUserById.mockResolvedValue({ email: 'user@test.com' });

      await expect(
        controller.updateStatus(createMockReq(), PUBLIC_ID, { status: 'RESOLVED' }),
      ).rejects.toThrow(ForbiddenException);
      expect(identityClient.updateFeedbackStatus).not.toHaveBeenCalled();
    });
  });
});
