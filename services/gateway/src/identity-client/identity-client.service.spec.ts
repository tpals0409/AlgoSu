/**
 * @file IdentityClientService 단위 테스트
 * @domain identity-client
 * @layer test
 */
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import { IdentityClientService } from './identity-client.service';

// ─── Mock 생성 ──────────────────────────────────────────

function createMockHttpService() {
  return {
    request: jest.fn(),
  };
}

function createMockConfigService() {
  return {
    get: jest.fn().mockImplementation((key: string, defaultVal?: string) => {
      if (key === 'INTERNAL_API_KEY') return 'test-internal-key';
      return defaultVal ?? '';
    }),
  };
}

function createMockLogger() {
  return {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

/** 성공 응답 Observable 생성 */
function okResponse<T>(data: T) {
  return of({ data: { data }, status: 200 } as AxiosResponse);
}

/** 성공 응답 (wrapper 없는 raw) */
function okRawResponse<T>(data: T) {
  return of({ data, status: 200 } as AxiosResponse);
}

/** HTTP 에러 Observable 생성 */
function errorResponse(status: number, message = 'Error') {
  const err = new AxiosError();
  (err as any).response = { status, data: { message } };
  return throwError(() => err);
}

/** 네트워크 에러 Observable 생성 */
function networkError() {
  return throwError(() => new Error('ECONNREFUSED'));
}

describe('IdentityClientService', () => {
  let service: IdentityClientService;
  let httpService: ReturnType<typeof createMockHttpService>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    httpService = createMockHttpService();
    const configService = createMockConfigService();
    logger = createMockLogger();
    service = new IdentityClientService(
      httpService as any,
      configService as any,
      logger as any,
    );
    // delay를 즉시 resolve로 대체하여 재시도 대기 시간 제거
    (service as any).delay = jest.fn().mockResolvedValue(undefined);
  });

  // ─── 공통 헬퍼 ──────────────────────────────────────────

  /** 마지막 request 호출의 headers에 X-Internal-Key 가 있는지 검증 */
  function expectInternalKeyHeader() {
    const callArg = httpService.request.mock.calls[0][0];
    expect(callArg.headers).toEqual(
      expect.objectContaining({ 'X-Internal-Key': 'test-internal-key' }),
    );
  }

  /** 마지막 request 호출의 method, url 검증 */
  function expectRequestCall(method: string, url: string) {
    const callArg = httpService.request.mock.calls[0][0];
    expect(callArg.method).toBe(method);
    expect(callArg.url).toBe(url);
  }

  // ═══════════════════════════════════════════════════════
  // User API
  // ═══════════════════════════════════════════════════════

  describe('User API', () => {
    const mockUser = { id: 'u1', email: 'a@b.com', name: 'Test' };

    describe('upsertUser', () => {
      const dto = {
        email: 'a@b.com',
        name: 'Test',
        avatar_url: 'https://img.png',
        oauth_provider: 'google',
      };

      it('사용자 upsert 성공 — POST /api/users/upsert', async () => {
        httpService.request.mockReturnValue(okResponse(mockUser));
        const result = await service.upsertUser(dto);
        expect(result).toEqual(mockUser);
        expectRequestCall('POST', '/api/users/upsert');
        expectInternalKeyHeader();
      });
    });

    describe('findUserById', () => {
      it('ID로 사용자 조회 — GET /api/users/:id', async () => {
        httpService.request.mockReturnValue(okResponse(mockUser));
        const result = await service.findUserById('u1');
        expect(result).toEqual(mockUser);
        expectRequestCall('GET', '/api/users/u1');
        expectInternalKeyHeader();
      });
    });

    describe('updateUser', () => {
      it('프로필 업데이트 — PATCH /api/users/:id', async () => {
        const dto = { name: 'New Name' };
        httpService.request.mockReturnValue(okResponse(mockUser));
        const result = await service.updateUser('u1', dto);
        expect(result).toEqual(mockUser);
        expectRequestCall('PATCH', '/api/users/u1');
        const callArg = httpService.request.mock.calls[0][0];
        expect(callArg.data).toEqual(dto);
      });
    });

    describe('softDeleteUser', () => {
      it('소프트 삭제 — DELETE /api/users/:id', async () => {
        httpService.request.mockReturnValue(okResponse({ affected: 1 }));
        const result = await service.softDeleteUser('u1');
        expect(result).toEqual({ affected: 1 });
        expectRequestCall('DELETE', '/api/users/u1');
      });
    });

    describe('updateGitHub', () => {
      it('GitHub 연동 업데이트 — PATCH /api/users/:id/github', async () => {
        const dto = { connected: true, username: 'octocat', user_id: 'g1', token: 'tok' };
        httpService.request.mockReturnValue(okResponse(mockUser));
        await service.updateGitHub('u1', dto);
        expectRequestCall('PATCH', '/api/users/u1/github');
        const callArg = httpService.request.mock.calls[0][0];
        expect(callArg.data).toEqual(dto);
      });
    });

    describe('getGitHubStatus', () => {
      it('GitHub 연동 상태 조회 — GET /api/users/:id/github-status', async () => {
        const status = { connected: true, username: 'octocat' };
        httpService.request.mockReturnValue(okResponse(status));
        const result = await service.getGitHubStatus('u1');
        expect(result).toEqual(status);
        expectRequestCall('GET', '/api/users/u1/github-status');
      });
    });

    describe('getGitHubTokenInfo', () => {
      it('GitHub 토큰 정보 조회 — GET /api/users/:id/github-token', async () => {
        const tokenInfo = { hasToken: true };
        httpService.request.mockReturnValue(okResponse(tokenInfo));
        const result = await service.getGitHubTokenInfo('u1');
        expect(result).toEqual(tokenInfo);
        expectRequestCall('GET', '/api/users/u1/github-token');
      });
    });

    describe('findUserBySlug', () => {
      it('slug 기반 사용자 조회 — GET /api/users/by-slug/:slug', async () => {
        httpService.request.mockReturnValue(okResponse(mockUser));
        const result = await service.findUserBySlug('my-slug');
        expect(result).toEqual(mockUser);
        expectRequestCall('GET', '/api/users/by-slug/my-slug');
      });
    });

    describe('updateProfileSettings', () => {
      it('프로필 설정 업데이트 — PATCH /api/users/:id/profile-settings', async () => {
        const dto = { publicId: 'slug-1', is_profile_public: true };
        httpService.request.mockReturnValue(okResponse(mockUser));
        await service.updateProfileSettings('u1', dto);
        expectRequestCall('PATCH', '/api/users/u1/profile-settings');
        const callArg = httpService.request.mock.calls[0][0];
        expect(callArg.data).toEqual(dto);
      });
    });
  });

  // ═══════════════════════════════════════════════════════
  // Study API
  // ═══════════════════════════════════════════════════════

  describe('Study API', () => {
    const mockStudy = { id: 's1', name: 'Study A' };

    describe('createStudy', () => {
      it('스터디 생성 — POST /api/studies', async () => {
        const dto = { name: 'Study A', created_by: 'u1', nickname: 'nick' };
        httpService.request.mockReturnValue(okResponse(mockStudy));
        const result = await service.createStudy(dto);
        expect(result).toEqual(mockStudy);
        expectRequestCall('POST', '/api/studies');
      });
    });

    describe('findStudyById', () => {
      it('스터디 조회 — GET /api/studies/:id', async () => {
        httpService.request.mockReturnValue(okResponse(mockStudy));
        const result = await service.findStudyById('s1');
        expect(result).toEqual(mockStudy);
        expectRequestCall('GET', '/api/studies/s1');
      });
    });

    describe('findStudiesByUserId', () => {
      it('사용자 스터디 목록 — GET /api/studies/by-user/:userId', async () => {
        const studies = [mockStudy];
        httpService.request.mockReturnValue(okResponse(studies));
        const result = await service.findStudiesByUserId('u1');
        expect(result).toEqual(studies);
        expectRequestCall('GET', '/api/studies/by-user/u1');
      });
    });

    describe('updateStudy', () => {
      it('스터디 수정 — PUT /api/studies/:id', async () => {
        const dto = { name: 'Updated' };
        httpService.request.mockReturnValue(okResponse(mockStudy));
        await service.updateStudy('s1', dto);
        expectRequestCall('PUT', '/api/studies/s1');
        const callArg = httpService.request.mock.calls[0][0];
        expect(callArg.data).toEqual(dto);
      });
    });

    describe('deleteStudy', () => {
      it('스터디 삭제 — DELETE /api/studies/:id', async () => {
        httpService.request.mockReturnValue(okResponse({ affected: 1 }));
        await service.deleteStudy('s1');
        expectRequestCall('DELETE', '/api/studies/s1');
      });
    });

    describe('addMember', () => {
      it('멤버 추가 — POST /api/studies/:studyId/members', async () => {
        const dto = { userId: 'u2', nickname: 'nick2' };
        httpService.request.mockReturnValue(okResponse({ id: 'm1' }));
        await service.addMember('s1', dto);
        expectRequestCall('POST', '/api/studies/s1/members');
        const callArg = httpService.request.mock.calls[0][0];
        expect(callArg.data).toEqual(dto);
      });
    });

    describe('getMembers', () => {
      it('전체 멤버 목록 — GET /api/studies/:studyId/members', async () => {
        const members = [{ userId: 'u1' }, { userId: 'u2' }];
        httpService.request.mockReturnValue(okResponse(members));
        const result = await service.getMembers('s1');
        expect(result).toEqual(members);
        expectRequestCall('GET', '/api/studies/s1/members');
      });
    });

    describe('getMember', () => {
      it('멤버 단건 조회 — GET /api/studies/:studyId/members/:userId', async () => {
        const member = { userId: 'u1', role: 'LEADER' };
        httpService.request.mockReturnValue(okResponse(member));
        const result = await service.getMember('s1', 'u1');
        expect(result).toEqual(member);
        expectRequestCall('GET', '/api/studies/s1/members/u1');
      });
    });

    describe('removeMember', () => {
      it('멤버 제거 — DELETE /api/studies/:studyId/members/:userId', async () => {
        httpService.request.mockReturnValue(okResponse({ affected: 1 }));
        await service.removeMember('s1', 'u1');
        expectRequestCall('DELETE', '/api/studies/s1/members/u1');
      });
    });

    describe('changeRole', () => {
      it('멤버 역할 변경 — PATCH /api/studies/:studyId/members/:userId/role', async () => {
        const dto = { role: 'MEMBER' };
        httpService.request.mockReturnValue(okResponse({ updated: true }));
        await service.changeRole('s1', 'u1', dto);
        expectRequestCall('PATCH', '/api/studies/s1/members/u1/role');
        const callArg = httpService.request.mock.calls[0][0];
        expect(callArg.data).toEqual(dto);
      });
    });

    describe('updateNickname', () => {
      it('멤버 닉네임 수정 — PATCH /api/studies/:studyId/members/:userId/nickname', async () => {
        const dto = { nickname: 'newNick' };
        httpService.request.mockReturnValue(okResponse({ updated: true }));
        await service.updateNickname('s1', 'u1', dto);
        expectRequestCall('PATCH', '/api/studies/s1/members/u1/nickname');
        const callArg = httpService.request.mock.calls[0][0];
        expect(callArg.data).toEqual(dto);
      });
    });

    describe('createInvite', () => {
      it('초대 생성 — POST /api/studies/:studyId/invites', async () => {
        const dto = { created_by: 'u1', expires_at: '2026-12-31' };
        const invite = { id: 'inv1', code: 'ABC123' };
        httpService.request.mockReturnValue(okResponse(invite));
        const result = await service.createInvite('s1', dto);
        expect(result).toEqual(invite);
        expectRequestCall('POST', '/api/studies/s1/invites');
      });
    });

    describe('findInviteByCode', () => {
      it('코드로 초대 조회 — GET /api/invites/by-code/:code', async () => {
        const invite = { id: 'inv1', code: 'ABC123' };
        httpService.request.mockReturnValue(okResponse(invite));
        const result = await service.findInviteByCode('ABC123');
        expect(result).toEqual(invite);
        expectRequestCall('GET', '/api/invites/by-code/ABC123');
      });
    });

    describe('consumeInvite', () => {
      it('초대 사용 — PATCH /api/invites/:id/consume', async () => {
        httpService.request.mockReturnValue(okResponse({ consumed: true }));
        await service.consumeInvite('inv1');
        expectRequestCall('PATCH', '/api/invites/inv1/consume');
      });
    });
  });

  // ═══════════════════════════════════════════════════════
  // Notification API
  // ═══════════════════════════════════════════════════════

  describe('Notification API', () => {
    describe('createNotification', () => {
      it('알림 생성 — POST /api/notifications', async () => {
        const dto = {
          userId: 'u1',
          type: 'SUBMISSION',
          title: '제출 알림',
          message: '새 제출이 있습니다',
        };
        httpService.request.mockReturnValue(okResponse({ id: 'n1' }));
        await service.createNotification(dto);
        expectRequestCall('POST', '/api/notifications');
        const callArg = httpService.request.mock.calls[0][0];
        expect(callArg.data).toEqual(dto);
      });
    });

    describe('findNotificationsByUserId', () => {
      it('사용자 알림 목록 — GET /api/notifications/by-user/:userId', async () => {
        const notifications = [{ id: 'n1' }, { id: 'n2' }];
        httpService.request.mockReturnValue(okResponse(notifications));
        const result = await service.findNotificationsByUserId('u1');
        expect(result).toEqual(notifications);
        expectRequestCall('GET', '/api/notifications/by-user/u1');
      });
    });

    describe('getUnreadCount', () => {
      it('미읽음 수 조회 — GET /api/notifications/by-user/:userId/unread-count', async () => {
        httpService.request.mockReturnValue(okResponse({ count: 5 }));
        const result = await service.getUnreadCount('u1');
        expect(result).toEqual({ count: 5 });
        expectRequestCall('GET', '/api/notifications/by-user/u1/unread-count');
      });
    });

    describe('markAsRead', () => {
      it('단건 읽음 처리 — PATCH /api/notifications/:id/read', async () => {
        httpService.request.mockReturnValue(okResponse({ read: true }));
        await service.markAsRead('n1', 'u1');
        expectRequestCall('PATCH', '/api/notifications/n1/read');
        const callArg = httpService.request.mock.calls[0][0];
        expect(callArg.data).toEqual({ userId: 'u1' });
      });
    });

    describe('markAllRead', () => {
      it('전체 읽음 처리 — PATCH /api/notifications/by-user/:userId/read-all', async () => {
        httpService.request.mockReturnValue(okResponse({ affected: 3 }));
        const result = await service.markAllRead('u1');
        expect(result).toEqual({ affected: 3 });
        expectRequestCall('PATCH', '/api/notifications/by-user/u1/read-all');
      });
    });

    describe('deleteOldNotifications', () => {
      it('오래된 알림 삭제 — DELETE /api/notifications/old', async () => {
        httpService.request.mockReturnValue(okResponse({ affected: 10 }));
        const result = await service.deleteOldNotifications();
        expect(result).toEqual({ affected: 10 });
        expectRequestCall('DELETE', '/api/notifications/old');
      });
    });

    describe('deleteNotificationsByUserId', () => {
      it('사용자 알림 전체 삭제 — DELETE /api/notifications/by-user/:userId', async () => {
        httpService.request.mockReturnValue(okResponse({ affected: 5 }));
        const result = await service.deleteNotificationsByUserId('u1');
        expect(result).toEqual({ affected: 5 });
        expectRequestCall('DELETE', '/api/notifications/by-user/u1');
      });
    });
  });

  // ═══════════════════════════════════════════════════════
  // ShareLink API
  // ═══════════════════════════════════════════════════════

  describe('ShareLink API', () => {
    describe('createShareLink', () => {
      it('공유 링크 생성 — POST /api/share-links', async () => {
        const dto = { study_id: 's1', created_by: 'u1' };
        httpService.request.mockReturnValue(okResponse({ id: 'sl1', token: 'tok' }));
        const result = await service.createShareLink(dto);
        expect(result).toEqual({ id: 'sl1', token: 'tok' });
        expectRequestCall('POST', '/api/share-links');
      });
    });

    describe('findShareLinksByUserAndStudy', () => {
      it('공유 링크 목록 조회 — GET /api/share-links/by-user/:userId/study/:studyId', async () => {
        const links = [{ id: 'sl1' }];
        httpService.request.mockReturnValue(okResponse(links));
        const result = await service.findShareLinksByUserAndStudy('u1', 's1');
        expect(result).toEqual(links);
        expectRequestCall('GET', '/api/share-links/by-user/u1/study/s1');
      });
    });

    describe('deactivateShareLink', () => {
      it('공유 링크 비활성화 — PATCH /api/share-links/:id/deactivate', async () => {
        httpService.request.mockReturnValue(okResponse({ deactivated: true }));
        await service.deactivateShareLink('sl1', 'u1');
        expectRequestCall('PATCH', '/api/share-links/sl1/deactivate');
        const callArg = httpService.request.mock.calls[0][0];
        expect(callArg.data).toEqual({ userId: 'u1' });
      });
    });

    describe('verifyShareLinkToken', () => {
      it('토큰 검증 — GET /api/share-links/by-token/:token', async () => {
        const link = { id: 'sl1', study_id: 's1' };
        httpService.request.mockReturnValue(okResponse(link));
        const result = await service.verifyShareLinkToken('my-token');
        expect(result).toEqual(link);
        expectRequestCall('GET', '/api/share-links/by-token/my-token');
      });
    });
  });

  // ═══════════════════════════════════════════════════════
  // GET 재시도 로직
  // ═══════════════════════════════════════════════════════

  describe('GET 재시도', () => {
    it('GET 네트워크 에러 시 최대 2회 재시도 후 성공', async () => {
      const mockUser = { id: 'u1', name: 'Test' };
      httpService.request
        .mockReturnValueOnce(networkError())
        .mockReturnValueOnce(networkError())
        .mockReturnValueOnce(okResponse(mockUser));

      const result = await service.findUserById('u1');
      expect(result).toEqual(mockUser);
      expect(httpService.request).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Identity 요청 재시도 (1/2)'),
        'IdentityClientService',
      );
    });

    it('GET ECONNRESET AxiosError 시 재시도', async () => {
      const mockUser = { id: 'u1' };
      const connResetErr = new AxiosError();
      (connResetErr as any).code = 'ECONNRESET';
      httpService.request
        .mockReturnValueOnce(throwError(() => connResetErr))
        .mockReturnValueOnce(okResponse(mockUser));

      const result = await service.findUserById('u1');
      expect(result).toEqual(mockUser);
      expect(httpService.request).toHaveBeenCalledTimes(2);
    });

    it('GET ECONNREFUSED AxiosError 시 재시도', async () => {
      const mockUser = { id: 'u1' };
      const connRefusedErr = new AxiosError();
      (connRefusedErr as any).code = 'ECONNREFUSED';
      httpService.request
        .mockReturnValueOnce(throwError(() => connRefusedErr))
        .mockReturnValueOnce(okResponse(mockUser));

      const result = await service.findUserById('u1');
      expect(result).toEqual(mockUser);
      expect(httpService.request).toHaveBeenCalledTimes(2);
    });

    it('GET ETIMEDOUT AxiosError 시 재시도', async () => {
      const mockUser = { id: 'u1' };
      const timeoutErr = new AxiosError();
      (timeoutErr as any).code = 'ETIMEDOUT';
      httpService.request
        .mockReturnValueOnce(throwError(() => timeoutErr))
        .mockReturnValueOnce(okResponse(mockUser));

      const result = await service.findUserById('u1');
      expect(result).toEqual(mockUser);
      expect(httpService.request).toHaveBeenCalledTimes(2);
    });

    it('GET HTTP 503 시 재시도', async () => {
      const mockUser = { id: 'u1' };
      httpService.request
        .mockReturnValueOnce(errorResponse(503, 'Service Unavailable'))
        .mockReturnValueOnce(okResponse(mockUser));

      const result = await service.findUserById('u1');
      expect(result).toEqual(mockUser);
      expect(httpService.request).toHaveBeenCalledTimes(2);
    });

    it('GET HTTP 502 시 재시도', async () => {
      const mockUser = { id: 'u1' };
      httpService.request
        .mockReturnValueOnce(errorResponse(502, 'Bad Gateway'))
        .mockReturnValueOnce(okResponse(mockUser));

      const result = await service.findUserById('u1');
      expect(result).toEqual(mockUser);
      expect(httpService.request).toHaveBeenCalledTimes(2);
    });

    it('GET HTTP 500 시 재시도', async () => {
      const mockUser = { id: 'u1' };
      httpService.request
        .mockReturnValueOnce(errorResponse(500, 'Internal Server Error'))
        .mockReturnValueOnce(okResponse(mockUser));

      const result = await service.findUserById('u1');
      expect(result).toEqual(mockUser);
      expect(httpService.request).toHaveBeenCalledTimes(2);
    });

    it('GET 3회 모두 실패 시 최종 에러 throw', async () => {
      httpService.request
        .mockReturnValue(networkError());

      await expect(service.findUserById('u1')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(httpService.request).toHaveBeenCalledTimes(3);
      expect(logger.warn).toHaveBeenCalledTimes(2); // 재시도 로그 2회
    });

    it('GET HTTP 404 에러는 재시도하지 않음', async () => {
      httpService.request.mockReturnValue(errorResponse(404, 'Not found'));
      await expect(service.findUserById('u1')).rejects.toThrow(NotFoundException);
      expect(httpService.request).toHaveBeenCalledTimes(1);
    });

    it('GET HTTP 400 에러는 재시도하지 않음', async () => {
      httpService.request.mockReturnValue(errorResponse(400, 'Bad request'));
      await expect(service.findUserById('u1')).rejects.toThrow(BadRequestException);
      expect(httpService.request).toHaveBeenCalledTimes(1);
    });

    it('POST 요청은 재시도하지 않음 (멱등성 미보장)', async () => {
      httpService.request.mockReturnValue(networkError());
      await expect(service.upsertUser({} as any)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(httpService.request).toHaveBeenCalledTimes(1);
    });

    it('PATCH 요청은 재시도하지 않음', async () => {
      httpService.request.mockReturnValue(networkError());
      await expect(service.updateUser('u1', { name: 'x' })).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(httpService.request).toHaveBeenCalledTimes(1);
    });

    it('DELETE 요청은 재시도하지 않음', async () => {
      httpService.request.mockReturnValue(networkError());
      await expect(service.softDeleteUser('u1')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(httpService.request).toHaveBeenCalledTimes(1);
    });

    it('재시도 시 지수 백오프 적용 (500ms, 1000ms)', async () => {
      httpService.request.mockReturnValue(networkError());
      await expect(service.findUserById('u1')).rejects.toThrow();
      const delaySpy = (service as any).delay as jest.Mock;
      expect(delaySpy).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenNthCalledWith(1, 500);  // 500 * 2^0
      expect(delaySpy).toHaveBeenNthCalledWith(2, 1000); // 500 * 2^1
    });
  });

  // ═══════════════════════════════════════════════════════
  // 에러 핸들링
  // ═══════════════════════════════════════════════════════

  describe('에러 핸들링', () => {
    it('404 → NotFoundException 변환', async () => {
      httpService.request.mockReturnValue(errorResponse(404, 'Not found'));
      await expect(service.findUserById('u1')).rejects.toThrow(NotFoundException);
    });

    it('400 → BadRequestException 변환', async () => {
      httpService.request.mockReturnValue(errorResponse(400, 'Bad request'));
      await expect(service.upsertUser({} as any)).rejects.toThrow(BadRequestException);
    });

    it('403 → ForbiddenException 변환', async () => {
      httpService.request.mockReturnValue(errorResponse(403, 'Forbidden'));
      await expect(service.findUserById('u1')).rejects.toThrow(ForbiddenException);
    });

    it('409 → ConflictException 변환', async () => {
      httpService.request.mockReturnValue(errorResponse(409, 'Conflict'));
      await expect(service.upsertUser({} as any)).rejects.toThrow(ConflictException);
    });

    it('500 → InternalServerErrorException 변환', async () => {
      httpService.request.mockReturnValue(errorResponse(500, 'Server error'));
      await expect(service.findUserById('u1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('알 수 없는 HTTP 상태 (418) → InternalServerErrorException 변환', async () => {
      httpService.request.mockReturnValue(errorResponse(418, 'Teapot'));
      await expect(service.findUserById('u1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('네트워크 에러 → InternalServerErrorException 변환', async () => {
      httpService.request.mockReturnValue(networkError());
      await expect(service.findUserById('u1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('네트워크 에러 시 logger.error 호출', async () => {
      httpService.request.mockReturnValue(networkError());
      await expect(service.findUserById('u1')).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        'Identity 서비스 연결 실패: GET /api/users/u1',
        expect.any(String),
        'IdentityClientService',
      );
    });

    it('HTTP 에러 시 logger.warn 호출', async () => {
      httpService.request.mockReturnValue(errorResponse(404, 'Not found'));
      await expect(service.findUserById('u1')).rejects.toThrow();
      expect(logger.warn).toHaveBeenCalledWith(
        'Identity 서비스 에러: GET /api/users/u1 → 404',
        'IdentityClientService',
      );
    });

    it('에러 응답에 message 필드 없으면 기본 메시지 사용', async () => {
      const err = new AxiosError();
      (err as any).response = { status: 404, data: {} };
      httpService.request.mockReturnValue(throwError(() => err));
      await expect(service.findUserById('u1')).rejects.toThrow(
        'Identity 서비스 에러 (404)',
      );
    });

    it('에러 응답 message가 문자열이 아니면 String() 변환', async () => {
      const err = new AxiosError();
      (err as any).response = { status: 400, data: { message: 12345 } };
      httpService.request.mockReturnValue(throwError(() => err));
      await expect(service.findUserById('u1')).rejects.toThrow('12345');
    });

    it('비-Error 객체 throw 시 stack 없이 logger.error 호출', async () => {
      httpService.request.mockReturnValue(throwError(() => 'plain-string-error'));
      await expect(service.findUserById('u1')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Identity 서비스 연결 실패: GET /api/users/u1',
        undefined,
        'IdentityClientService',
      );
    });
  });

  // ═══════════════════════════════════════════════════════
  // unwrapResponse — { data: ... } wrapper 처리
  // ═══════════════════════════════════════════════════════

  describe('응답 unwrap', () => {
    it('{ data: ... } wrapper 제거', async () => {
      httpService.request.mockReturnValue(okResponse({ id: 'u1' }));
      const result = await service.findUserById('u1');
      expect(result).toEqual({ id: 'u1' });
    });

    it('wrapper 없는 raw 응답 — 그대로 반환', async () => {
      httpService.request.mockReturnValue(okRawResponse('plain-value'));
      const result = await service.findUserById('u1');
      expect(result).toBe('plain-value');
    });

    it('null 응답 — null 반환', async () => {
      httpService.request.mockReturnValue(okRawResponse(null));
      const result = await service.verifyShareLinkToken('invalid');
      expect(result).toBeNull();
    });
  });
});
