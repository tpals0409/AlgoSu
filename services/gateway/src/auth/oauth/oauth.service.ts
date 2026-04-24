/**
 * @file OAuth 인증 서비스 — Google/Naver/Kakao 로그인 + GitHub 연동 + JWT 발급
 * @domain identity
 * @layer service
 * @related oauth.controller.ts, token-crypto.util.ts, identity-client.service.ts
 */
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { OAuthProvider, IdentityUser } from '../../common/types/identity.types';
import { encryptToken } from './token-crypto.util';
import { IdentityClientService } from '../../identity-client/identity-client.service';
import { SessionPolicyService } from '../session-policy/session-policy.service';
import {
  OAuthInvalidStateException,
  OAuthTokenExchangeException,
  OAuthProfileFetchException,
  OAuthAccountConflictException,
  OAuthAuthFailedException,
} from './exceptions';

interface OAuthTokenResponse {
  access_token: string;
  token_type?: string;
  refresh_token?: string;
  expires_in?: number;
}

interface OAuthUserProfile {
  email: string;
  name: string | null;
  avatar_url: string | null;
}

interface GitHubUserProfile {
  id: string;
  login: string;
}

@Injectable()
export class OAuthService {
  private readonly redis: Redis;
  private readonly jwtSecret: string;
  private readonly callbackBaseUrl: string;

  private static readonly STATE_TTL_SECONDS = 300; // 5분

  constructor(
    private readonly configService: ConfigService,
    private readonly identityClient: IdentityClientService,
    // Sprint 71-1R: JWT TTL 하드코딩 제거 — SessionPolicyService SSoT 경유
    private readonly sessionPolicy: SessionPolicyService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    this.redis.on('error', (err: Error) => {
      // M11: Redis 연결 에러 핸들링 — 프로세스 크래시 방지, fail-closed 보장
      process.stdout.write(JSON.stringify({ level: 'error', context: 'OAuthService', message: `Redis 연결 오류: ${err.message}` }) + '\n');
    });
    this.jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    this.callbackBaseUrl = this.configService.getOrThrow<string>('OAUTH_CALLBACK_URL');
  }

  // --- OAuth State (CSRF 방지) ---

  async generateState(): Promise<string> {
    const state = crypto.randomUUID();
    await this.redis.set(`oauth:state:${state}`, '1', 'EX', OAuthService.STATE_TTL_SECONDS);
    return state;
  }

  async validateAndConsumeState(state: string): Promise<void> {
    const exists = await this.redis.del(`oauth:state:${state}`);
    if (exists === 0) {
      throw new OAuthInvalidStateException();
    }
  }

  async validateAndConsumeGitHubLinkState(state: string): Promise<string> {
    const key = `oauth:github:link:${state}`;
    const userId = await this.redis.get(key);
    if (!userId) {
      throw new BadRequestException('유효하지 않거나 만료된 GitHub 연동 state입니다.');
    }
    await this.redis.del(key);
    return userId;
  }

  // --- Authorization URL 생성 ---

  async getAuthorizationUrl(provider: string): Promise<{ url: string }> {
    const state = await this.generateState();

    switch (provider) {
      case 'google':
        return { url: this.buildGoogleAuthUrl(state) };
      case 'naver':
        return { url: this.buildNaverAuthUrl(state) };
      case 'kakao':
        return { url: this.buildKakaoAuthUrl(state) };
      default:
        throw new BadRequestException(`지원하지 않는 OAuth Provider: ${provider}`);
    }
  }

  private buildGoogleAuthUrl(state: string): string {
    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const redirectUri = `${this.callbackBaseUrl}/auth/oauth/google/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private buildNaverAuthUrl(state: string): string {
    const clientId = this.configService.getOrThrow<string>('NAVER_CLIENT_ID');
    const redirectUri = `${this.callbackBaseUrl}/auth/oauth/naver/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });
    return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
  }

  private buildKakaoAuthUrl(state: string): string {
    const clientId = this.configService.getOrThrow<string>('KAKAO_CLIENT_ID');
    const redirectUri = `${this.callbackBaseUrl}/auth/oauth/kakao/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });
    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  // --- Token 교환 ---

  async handleCallback(
    provider: string,
    code: string,
    state: string,
  ): Promise<{ accessToken: string; user: IdentityUser }> {
    await this.validateAndConsumeState(state);

    let profile: OAuthUserProfile;
    let oauthProvider: OAuthProvider;

    switch (provider) {
      case 'google':
        profile = await this.exchangeGoogleToken(code);
        oauthProvider = OAuthProvider.GOOGLE;
        break;
      case 'naver':
        profile = await this.exchangeNaverToken(code, state);
        oauthProvider = OAuthProvider.NAVER;
        break;
      case 'kakao':
        profile = await this.exchangeKakaoToken(code);
        oauthProvider = OAuthProvider.KAKAO;
        break;
      default:
        throw new OAuthAuthFailedException();
    }

    const user = await this.upsertUserSafe(profile, oauthProvider);
    const accessToken = this.issueJwt(user);

    return { accessToken, user };
  }

  private async exchangeGoogleToken(code: string): Promise<OAuthUserProfile> {
    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = `${this.callbackBaseUrl}/auth/oauth/google/callback`;

    const accessToken = await this.exchangeOAuthToken(
      'https://oauth2.googleapis.com/token',
      {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      },
    );

    return this.fetchGoogleProfile(accessToken);
  }

  /** Google 프로필 조회 — 실패 시 OAuthProfileFetchException */
  private async fetchGoogleProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      const res = await axios.get<{
        email: string;
        name?: string;
        picture?: string;
      }>('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return {
        email: res.data.email,
        name: res.data.name ?? null,
        avatar_url: res.data.picture ?? null,
      };
    } catch {
      throw new OAuthProfileFetchException();
    }
  }

  private async exchangeNaverToken(code: string, state: string): Promise<OAuthUserProfile> {
    const clientId = this.configService.getOrThrow<string>('NAVER_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('NAVER_CLIENT_SECRET');

    const accessToken = await this.exchangeOAuthToken(
      'https://nid.naver.com/oauth2.0/token',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          state,
        },
      },
    );

    return this.fetchNaverProfile(accessToken);
  }

  /** Naver 프로필 조회 — 실패 시 OAuthProfileFetchException */
  private async fetchNaverProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      const res = await axios.get<{
        response: { email: string; name?: string; profile_image?: string };
      }>('https://openapi.naver.com/v1/nid/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile = res.data.response;
      return {
        email: profile.email,
        name: profile.name ?? null,
        avatar_url: profile.profile_image ?? null,
      };
    } catch {
      throw new OAuthProfileFetchException();
    }
  }

  private async exchangeKakaoToken(code: string): Promise<OAuthUserProfile> {
    const clientId = this.configService.getOrThrow<string>('KAKAO_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('KAKAO_CLIENT_SECRET');
    const redirectUri = `${this.callbackBaseUrl}/auth/oauth/kakao/callback`;

    const accessToken = await this.exchangeOAuthToken(
      'https://kauth.kakao.com/oauth/token',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    return this.fetchKakaoProfile(accessToken);
  }

  /** Kakao 프로필 조회 — 실패 시 OAuthProfileFetchException */
  private async fetchKakaoProfile(accessToken: string): Promise<OAuthUserProfile> {
    try {
      const res = await axios.get<{
        kakao_account?: {
          email?: string;
          profile?: { nickname?: string; profile_image_url?: string };
        };
      }>('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const account = res.data.kakao_account;
      if (!account?.email) {
        throw new OAuthProfileFetchException();
      }

      return {
        email: account.email,
        name: account.profile?.nickname ?? null,
        avatar_url: account.profile?.profile_image_url ?? null,
      };
    } catch (error) {
      if (error instanceof OAuthProfileFetchException) throw error;
      throw new OAuthProfileFetchException();
    }
  }

  // --- GitHub 연동 ---

  async getGitHubAuthUrl(userId: string): Promise<{ url: string }> {
    const clientId = this.configService.getOrThrow<string>('GITHUB_CLIENT_ID');
    const redirectUri = `${this.callbackBaseUrl}/auth/github/link/callback`;
    const state = crypto.randomUUID();
    await this.redis.set(
      `oauth:github:link:${state}`,
      userId,
      'EX',
      OAuthService.STATE_TTL_SECONDS,
    );
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo',
      state,
    });
    return { url: `https://github.com/login/oauth/authorize?${params.toString()}` };
  }

  async connectGitHub(
    userId: string,
    githubUserId: string,
    githubUsername: string,
    encryptedToken: string | null,
  ): Promise<Record<string, unknown>> {
    return this.identityClient.updateGitHub(userId, {
      connected: true,
      user_id: githubUserId,
      username: githubUsername,
      token: encryptedToken,
    });
  }

  async disconnectGitHub(userId: string): Promise<Record<string, unknown>> {
    return this.identityClient.updateGitHub(userId, {
      connected: false,
      user_id: null,
      username: null,
      token: null,
    });
  }

  async linkGitHub(userId: string, code: string): Promise<{ github_username: string }> {
    const clientId = this.configService.getOrThrow<string>('GITHUB_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('GITHUB_CLIENT_SECRET');

    let accessToken: string;
    try {
      const tokenRes = await axios.post<{ access_token: string }>(
        'https://github.com/login/oauth/access_token',
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
        },
        {
          headers: { Accept: 'application/json' },
        },
      );

      if (!tokenRes.data.access_token) {
        throw new BadRequestException('GitHub 토큰 교환에 실패했습니다.');
      }
      accessToken = tokenRes.data.access_token;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('GitHub 인증 처리 중 오류가 발생했습니다.');
    }

    let githubUser: GitHubUserProfile;
    try {
      const res = await axios.get<GitHubUserProfile>(
        'https://api.github.com/user',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      githubUser = res.data;
    } catch {
      throw new BadRequestException('GitHub 사용자 정보 조회에 실패했습니다.');
    }

    // GitHub access token 암호화 저장 (repo push에 필요)
    // 보안: 암호화 키 없이 평문 저장 절대 금지 — fail-closed
    const encryptionKey = this.configService.get<string>('GITHUB_TOKEN_ENCRYPTION_KEY');
    if (!encryptionKey) {
      process.stdout.write(JSON.stringify({ level: 'error', context: 'OAuthService', message: 'GITHUB_TOKEN_ENCRYPTION_KEY 미설정 — GitHub 토큰 암호화 불가' }) + '\n');
      throw new InternalServerErrorException('GitHub 연동에 필요한 서버 설정이 누락되었습니다. 관리자에게 문의하세요.');
    }
    const encryptedToken = encryptToken(accessToken, encryptionKey);

    await this.connectGitHub(userId, String(githubUser.id), githubUser.login, encryptedToken);

    return { github_username: githubUser.login };
  }

  async relinkGitHub(userId: string, code: string): Promise<{ github_username: string }> {
    return this.linkGitHub(userId, code);
  }

  // --- 공통 토큰 교환 헬퍼 ---

  /**
   * OAuth 토큰 교환 공통 래퍼 — 실패 시 OAuthTokenExchangeException
   * @returns access_token 문자열
   */
  private async exchangeOAuthToken(
    url: string,
    data: unknown,
    config?: Record<string, unknown>,
  ): Promise<string> {
    try {
      const res = await axios.post<OAuthTokenResponse>(url, data, config);
      return res.data.access_token;
    } catch {
      throw new OAuthTokenExchangeException();
    }
  }

  // --- User CRUD ---

  /**
   * 사용자 upsert — provider 충돌 시 OAuthAccountConflictException
   * handleCallback 전용 래퍼 (ADR-025 에러 코드 정규화)
   */
  private async upsertUserSafe(
    profile: OAuthUserProfile,
    provider: OAuthProvider,
  ): Promise<IdentityUser> {
    try {
      return await this.upsertUser(profile, provider);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw new OAuthAccountConflictException();
      }
      throw new OAuthAuthFailedException();
    }
  }

  private async upsertUser(
    profile: OAuthUserProfile,
    provider: OAuthProvider,
  ): Promise<IdentityUser> {
    // 1계정 1OAuth 정책 + 탈퇴 복구 + ON CONFLICT upsert 모두 Identity 서비스에서 처리
    const result = await this.identityClient.upsertUser({
      email: profile.email,
      name: profile.name ?? '',
      avatar_url: profile.avatar_url ?? 'preset:default',
      oauth_provider: provider,
    });

    return result as unknown as IdentityUser;
  }

  async findUserById(userId: string): Promise<IdentityUser | null> {
    try {
      const result = await this.identityClient.findUserById(userId);
      return result as unknown as IdentityUser;
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<Record<string, unknown>> {
    return this.identityClient.updateUser(userId, { avatar_url: avatarUrl });
  }

  async softDeleteAccount(userId: string): Promise<void> {
    // 멱등성 + 트랜잭션(user 익명화, study_members/notifications 삭제) 모두 Identity에서 처리
    await this.identityClient.softDeleteUser(userId);
  }

  // --- JWT 발급 ---

  /**
   * 공개 JWT 발급 메서드 — TokenRefreshInterceptor에서 사용
   * @domain identity
   */
  issueAccessToken(user: IdentityUser): string {
    return this.issueJwt(user);
  }

  /**
   * 데모 전용 JWT 발급 — isDemo: true 클레임 포함, 만료는 SessionPolicyService(env JWT_DEMO_EXPIRES_IN) 제어
   * @domain identity
   */
  issueDemoToken(user: IdentityUser): string {
    return this.issueJwt(user, { isDemo: true });
  }

  /**
   * userId로 User 조회 — 없으면 NotFoundException
   * @domain identity
   */
  async findUserByIdOrThrow(userId: string): Promise<IdentityUser> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    return user;
  }

  private issueJwt(
    user: IdentityUser,
    options?: { isDemo?: boolean },
  ): string {
    // Sprint 71-1R: 데모/일반 TTL 모두 SessionPolicyService SSoT 경유 — 하드코딩 제거
    const expiresIn = options?.isDemo
      ? this.sessionPolicy.getDemoTokenTtl()
      : this.sessionPolicy.getAccessTokenTtl();

    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        oauth_provider: user.oauth_provider,
        ...(options?.isDemo && { isDemo: true }),
      },
      this.jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
      },
    );
  }


  // --- GitHub Status (Internal API용) ---

  async getGitHubStatus(
    userId: string,
  ): Promise<{ github_connected: boolean; github_username: string | null }> {
    const result = await this.identityClient.getGitHubStatus(userId);
    return result as unknown as { github_connected: boolean; github_username: string | null };
  }

  /** GitHub 토큰 존재 여부 조회 (토큰 자체 미반환 — p0-010) */
  async getGitHubTokenInfo(
    userId: string,
  ): Promise<{ github_username: string | null; has_token: boolean }> {
    const result = await this.identityClient.getGitHubTokenInfo(userId);
    return result as unknown as { github_username: string | null; has_token: boolean };
  }

}
