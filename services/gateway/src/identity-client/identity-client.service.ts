/**
 * @file IdentityClientService — Identity 서비스 HTTP API 래퍼
 * @domain identity-client
 * @layer service
 * @related identity-client.module.ts, Identity 서비스 컨트롤러들
 *
 * Gateway에서 Identity 서비스의 모든 API를 호출하는 단일 진입점.
 * 모든 요청에 X-Internal-Key 헤더를 첨부하고,
 * Identity 서비스 에러를 적절한 NestJS 예외로 변환한다.
 */
import { Injectable } from '@nestjs/common';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { StructuredLoggerService } from '../common/logger/structured-logger.service';

// ─── DTO 인터페이스 ─────────────────────────────────────

export interface UpsertUserData {
  email: string;
  name: string;
  avatar_url: string;
  oauth_provider: string;
}

export interface UpdateUserData {
  name?: string;
  avatar_url?: string;
}

export interface UpdateGitHubData {
  connected: boolean;
  user_id?: string | null;
  username?: string | null;
  token?: string | null;
}

export interface UpdateProfileSettingsData {
  publicId?: string;
  is_profile_public?: boolean;
}

export interface CreateStudyData {
  name: string;
  description?: string;
  created_by: string;
  nickname: string;
  github_repo?: string;
  avatar_url?: string;
}

export interface UpdateStudyData {
  name?: string;
  description?: string;
  groundRules?: string;
  status?: string;
  avatar_url?: string;
}

export interface AddMemberData {
  userId: string;
  nickname?: string;
  role?: string;
}

export interface ChangeRoleData {
  role: string;
}

export interface UpdateNicknameData {
  nickname: string;
}

export interface CreateInviteData {
  created_by: string;
  expires_at: string;
  max_uses?: number;
}

export interface CreateNotificationData {
  userId: string;
  studyId?: string | null;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateShareLinkData {
  study_id: string;
  created_by: string;
  expires_at?: string;
}

// ─── Feedback API ────────────────────────────────────

export interface CreateFeedbackData {
  userId: string;
  category: string;
  content: string;
  pageUrl?: string;
  browserInfo?: string;
  screenshot?: string;
}

export interface UpdateFeedbackStatusData {
  status: string;
}

/** GET 재시도 설정 상수 */
const RETRY_MAX_ATTEMPTS = 2; // 최대 재시도 횟수 (총 3회 시도)
const RETRY_BASE_DELAY_MS = 500; // 기본 백오프 (ms)

/** 재시도 대상 네트워크 에러 코드 */
const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

/** 재시도 대상 HTTP 상태 코드 */
const RETRYABLE_HTTP_STATUSES = new Set([500, 502, 503]);

@Injectable()
export class IdentityClientService {
  private readonly internalKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.internalKey = this.configService.get<string>(
      'INTERNAL_KEY_IDENTITY',
      this.configService.get<string>('INTERNAL_API_KEY', ''),
    );
  }

  // ─── User API ──────────────────────────────────────────

  /** OAuth 로그인 시 사용자 생성/조회 */
  async upsertUser(data: UpsertUserData): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/users/upsert', data);
  }

  /** ID로 사용자 조회 */
  async findUserById(id: string): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/users/${id}`);
  }

  /** 프로필 업데이트 (name, avatar_url) */
  async updateUser(
    id: string,
    data: UpdateUserData,
  ): Promise<Record<string, unknown>> {
    return this.request('PATCH', `/api/users/${id}`, data);
  }

  /** 소프트 삭제 */
  async softDeleteUser(id: string): Promise<Record<string, unknown>> {
    return this.request('DELETE', `/api/users/${id}`);
  }

  /** GitHub 연동/해제 */
  async updateGitHub(
    id: string,
    data: UpdateGitHubData,
  ): Promise<Record<string, unknown>> {
    return this.request('PATCH', `/api/users/${id}/github`, data);
  }

  /** GitHub 연동 상태 조회 */
  async getGitHubStatus(id: string): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/users/${id}/github-status`);
  }

  /** GitHub 토큰 정보 조회 (암호화 상태 그대로) */
  async getGitHubTokenInfo(id: string): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/users/${id}/github-token`);
  }

  /** slug 기반 공개 프로필 조회 */
  async findUserBySlug(slug: string): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/users/by-slug/${slug}`);
  }

  /** 프로필 설정 업데이트 — slug + 공개 토글 */
  async updateProfileSettings(
    id: string,
    data: UpdateProfileSettingsData,
  ): Promise<Record<string, unknown>> {
    return this.request('PATCH', `/api/users/${id}/profile-settings`, data);
  }

  // ─── Study API ─────────────────────────────────────────

  /** 스터디 생성 */
  async createStudy(data: CreateStudyData): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/studies', data);
  }

  /** 스터디 상세 조회 */
  async findStudyById(id: string): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/studies/${id}`);
  }

  /** 사용자 참여 스터디 목록 */
  async findStudiesByUserId(
    userId: string,
  ): Promise<Record<string, unknown>[]> {
    return this.request('GET', `/api/studies/by-user/${userId}`);
  }

  /** 스터디 수정 */
  async updateStudy(
    id: string,
    data: UpdateStudyData,
  ): Promise<Record<string, unknown>> {
    return this.request('PUT', `/api/studies/${id}`, data);
  }

  /** 스터디 삭제 */
  async deleteStudy(id: string): Promise<Record<string, unknown>> {
    return this.request('DELETE', `/api/studies/${id}`);
  }

  /** 멤버 추가 */
  async addMember(
    studyId: string,
    data: AddMemberData,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/studies/${studyId}/members`, data);
  }

  /** 전체 멤버 목록 */
  async getMembers(studyId: string): Promise<Record<string, unknown>[]> {
    return this.request('GET', `/api/studies/${studyId}/members`);
  }

  /** 멤버 단건 조회 */
  async getMember(
    studyId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    return this.request(
      'GET',
      `/api/studies/${studyId}/members/${userId}`,
    );
  }

  /** 멤버 제거 */
  async removeMember(
    studyId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    return this.request(
      'DELETE',
      `/api/studies/${studyId}/members/${userId}`,
    );
  }

  /** 멤버 역할 변경 */
  async changeRole(
    studyId: string,
    userId: string,
    data: ChangeRoleData,
  ): Promise<Record<string, unknown>> {
    return this.request(
      'PATCH',
      `/api/studies/${studyId}/members/${userId}/role`,
      data,
    );
  }

  /** 멤버 닉네임 수정 */
  async updateNickname(
    studyId: string,
    userId: string,
    data: UpdateNicknameData,
  ): Promise<Record<string, unknown>> {
    return this.request(
      'PATCH',
      `/api/studies/${studyId}/members/${userId}/nickname`,
      data,
    );
  }

  /** 초대 생성 */
  async createInvite(
    studyId: string,
    data: CreateInviteData,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/studies/${studyId}/invites`, data);
  }

  /** 코드로 초대 조회 */
  async findInviteByCode(code: string): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/invites/by-code/${code}`);
  }

  /** 초대 사용 횟수 증가 */
  async consumeInvite(id: string): Promise<Record<string, unknown>> {
    return this.request('PATCH', `/api/invites/${id}/consume`);
  }

  // ─── Notification API ──────────────────────────────────

  /** 알림 생성 */
  async createNotification(
    data: CreateNotificationData,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/notifications', data);
  }

  /** 사용자 알림 목록 조회 */
  async findNotificationsByUserId(
    userId: string,
  ): Promise<Record<string, unknown>[]> {
    return this.request('GET', `/api/notifications/by-user/${userId}`);
  }

  /** 미읽음 알림 수 조회 */
  async getUnreadCount(
    userId: string,
  ): Promise<{ count: number }> {
    return this.request('GET', `/api/notifications/by-user/${userId}/unread-count`);
  }

  /** 단건 읽음 처리 */
  async markAsRead(
    id: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    return this.request('PATCH', `/api/notifications/${id}/read`, { userId });
  }

  /** 전체 읽음 처리 */
  async markAllRead(userId: string): Promise<{ affected: number }> {
    return this.request(
      'PATCH',
      `/api/notifications/by-user/${userId}/read-all`,
    );
  }

  /** 30일 이상 경과 알림 삭제 */
  async deleteOldNotifications(): Promise<{ affected: number }> {
    return this.request('DELETE', '/api/notifications/old');
  }

  /** 사용자 알림 전체 삭제 (회원탈퇴 시) */
  async deleteNotificationsByUserId(
    userId: string,
  ): Promise<{ affected: number }> {
    return this.request('DELETE', `/api/notifications/by-user/${userId}`);
  }

  // ─── Feedback API ────────────────────────────────────

  /** 피드백 생성 */
  async createFeedback(
    data: CreateFeedbackData,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/feedbacks', data);
  }

  /** 사용자별 피드백 목록 */
  async findFeedbacksByUserId(
    userId: string,
  ): Promise<Record<string, unknown>[]> {
    return this.request('GET', `/api/feedbacks/by-user/${userId}`);
  }

  /** 전체 피드백 목록 (admin) */
  async findAllFeedbacks(
    page?: number,
    limit?: number,
    category?: string,
    search?: string,
    status?: string,
  ): Promise<Record<string, unknown>> {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    const query = params.toString();
    return this.request('GET', `/api/feedbacks${query ? `?${query}` : ''}`);
  }

  /** 피드백 상세 조회 (admin, screenshot 포함) */
  async findFeedbackDetail(publicId: string): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/feedbacks/${publicId}/detail`);
  }

  /** 피드백 상태 변경 (admin) */
  async updateFeedbackStatus(
    publicId: string,
    data: UpdateFeedbackStatusData,
  ): Promise<Record<string, unknown>> {
    return this.request('PATCH', `/api/feedbacks/${publicId}/status`, data);
  }

  // ─── ShareLink API ────────────────────────────────────

  /** 공유 링크 생성 */
  async createShareLink(
    data: CreateShareLinkData,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/share-links', data);
  }

  /** 사용자의 활성 공유 링크 목록 조회 */
  async findShareLinksByUserAndStudy(
    userId: string,
    studyId: string,
  ): Promise<Record<string, unknown>[]> {
    return this.request(
      'GET',
      `/api/share-links/by-user/${userId}/study/${studyId}`,
    );
  }

  /** 공유 링크 비활성화 */
  async deactivateShareLink(
    id: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    return this.request('PATCH', `/api/share-links/${id}/deactivate`, {
      userId,
    });
  }

  /** 토큰으로 공유 링크 검증 */
  async verifyShareLinkToken(
    token: string,
  ): Promise<Record<string, unknown> | null> {
    return this.request('GET', `/api/share-links/by-token/${token}`);
  }

  // ─── 내부 유틸리티 ────────────────────────────────────

  /**
   * Identity 서비스에 HTTP 요청을 보내고 응답을 반환한다.
   * - { data: ... } wrapper 자동 unwrap
   * - X-Internal-Key 헤더 자동 첨부
   * - HTTP 에러 → NestJS 예외 변환
   * - GET 요청: 일시적 오류 시 최대 2회 재시도 (총 3회)
   */
  private async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
  ): Promise<T> {
    const maxRetries = method === 'GET' ? RETRY_MAX_ATTEMPTS : 0;

    for (let attempt = 0; ; attempt++) {
      try {
        const headers = { 'X-Internal-Key': this.internalKey };
        const response = await firstValueFrom(
          this.httpService.request({
            method,
            url,
            data: body,
            headers,
          }),
        );

        return this.unwrapResponse<T>(response.data);
      } catch (error) {
        if (attempt < maxRetries && this.isRetryable(error)) {
          const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          this.logger.warn(
            `Identity 요청 재시도 (${attempt + 1}/${maxRetries}): ${method} ${url} — ${delayMs}ms 후`,
            'IdentityClientService',
          );
          await this.delay(delayMs);
          continue;
        }
        throw this.handleError(error, method, url);
      }
    }
  }

  /** 재시도 가능한 에러인지 판별 */
  private isRetryable(error: unknown): boolean {
    if (error instanceof AxiosError) {
      // 네트워크 에러 (ECONNRESET, ECONNREFUSED 등)
      if (error.code && RETRYABLE_NETWORK_CODES.has(error.code)) {
        return true;
      }
      // HTTP 500/502/503
      if (error.response && RETRYABLE_HTTP_STATUSES.has(error.response.status)) {
        return true;
      }
      return false;
    }
    // AxiosError가 아닌 네트워크 에러 (e.g. Node.js 소켓 에러)
    if (error instanceof Error) {
      const msg = error.message ?? '';
      return [...RETRYABLE_NETWORK_CODES].some((code) => msg.includes(code));
    }
    return false;
  }

  /** 재시도 대기 (테스트에서 오버라이드 가능) */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** { data: ... } wrapper 제거 — Identity API 응답 규격 대응 */
  private unwrapResponse<T>(responseData: unknown): T {
    if (
      responseData !== null &&
      typeof responseData === 'object' &&
      'data' in responseData
    ) {
      return (responseData as { data: T }).data;
    }
    return responseData as T;
  }

  /** Identity 서비스 에러를 적절한 NestJS 예외로 변환 */
  private handleError(
    error: unknown,
    method: string,
    url: string,
  ): never {
    if (error instanceof AxiosError && error.response) {
      const status = error.response.status;
      const message =
        (error.response.data as Record<string, unknown>)?.message ??
        `Identity 서비스 에러 (${status})`;
      const msg = typeof message === 'string' ? message : String(message);

      this.logger.warn(
        `Identity 서비스 에러: ${method} ${url} → ${status}`,
        'IdentityClientService',
      );

      switch (status) {
        case 400:
          throw new BadRequestException(msg);
        case 403:
          throw new ForbiddenException(msg);
        case 404:
          throw new NotFoundException(msg);
        case 409:
          throw new ConflictException(msg);
        default:
          throw new InternalServerErrorException(msg);
      }
    }

    // 네트워크 에러 (ECONNREFUSED, ETIMEDOUT 등)
    this.logger.error(
      `Identity 서비스 연결 실패: ${method} ${url}`,
      error instanceof Error ? error.stack : undefined,
      'IdentityClientService',
    );
    throw new InternalServerErrorException('Identity 서비스 연결 실패');
  }
}
