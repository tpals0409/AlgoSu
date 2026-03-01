import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { User, OAuthProvider } from './user.entity';

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
  private readonly jwtExpiresIn: string;
  private readonly callbackBaseUrl: string;

  private static readonly STATE_TTL_SECONDS = 300; // 5분

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.redis = new Redis(redisUrl);
    this.redis.on('error', (err: Error) => {
      // M11: Redis 연결 에러 핸들링 — 프로세스 크래시 방지, fail-closed 보장
      console.error(`[OAuthService] Redis 연결 오류: ${err.message}`);
    });
    this.jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '1h');
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
      throw new BadRequestException('유효하지 않거나 만료된 OAuth state입니다.');
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
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
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
        throw new BadRequestException(`지원하지 않는 OAuth Provider: ${provider}`);
    }

    const user = await this.upsertUser(profile, oauthProvider);
    const accessToken = this.issueJwt(user);
    const refreshToken = this.issueRefreshToken(user.id);

    await this.storeRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken, user };
  }

  private async exchangeGoogleToken(code: string): Promise<OAuthUserProfile> {
    const clientId = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = `${this.callbackBaseUrl}/auth/oauth/google/callback`;

    const tokenRes = await axios.post<OAuthTokenResponse>(
      'https://oauth2.googleapis.com/token',
      {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      },
    );

    const userInfoRes = await axios.get<{
      email: string;
      name?: string;
      picture?: string;
    }>('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });

    return {
      email: userInfoRes.data.email,
      name: userInfoRes.data.name ?? null,
      avatar_url: userInfoRes.data.picture ?? null,
    };
  }

  private async exchangeNaverToken(code: string, state: string): Promise<OAuthUserProfile> {
    const clientId = this.configService.getOrThrow<string>('NAVER_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('NAVER_CLIENT_SECRET');

    const tokenRes = await axios.post<OAuthTokenResponse>(
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

    const profileRes = await axios.get<{
      response: { email: string; name?: string; profile_image?: string };
    }>('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });

    const profile = profileRes.data.response;
    return {
      email: profile.email,
      name: profile.name ?? null,
      avatar_url: profile.profile_image ?? null,
    };
  }

  private async exchangeKakaoToken(code: string): Promise<OAuthUserProfile> {
    const clientId = this.configService.getOrThrow<string>('KAKAO_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>('KAKAO_CLIENT_SECRET');
    const redirectUri = `${this.callbackBaseUrl}/auth/oauth/kakao/callback`;

    const tokenRes = await axios.post<OAuthTokenResponse>(
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

    const profileRes = await axios.get<{
      kakao_account?: {
        email?: string;
        profile?: { nickname?: string; profile_image_url?: string };
      };
    }>('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });

    const account = profileRes.data.kakao_account;
    if (!account?.email) {
      throw new BadRequestException('Kakao 계정에서 이메일을 가져올 수 없습니다.');
    }

    return {
      email: account.email,
      name: account.profile?.nickname ?? null,
      avatar_url: account.profile?.profile_image_url ?? null,
    };
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
      scope: 'read:user',
      state,
    });
    return { url: `https://github.com/login/oauth/authorize?${params.toString()}` };
  }

  async linkGitHub(userId: string, code: string): Promise<User> {
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

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    user.github_connected = true;
    user.github_user_id = String(githubUser.id);
    user.github_username = githubUser.login;

    return this.userRepository.save(user);
  }

  async unlinkGitHub(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    user.github_connected = false;
    user.github_user_id = null;
    user.github_username = null;

    return this.userRepository.save(user);
  }

  async relinkGitHub(userId: string, code: string): Promise<User> {
    return this.linkGitHub(userId, code);
  }

  // --- User CRUD ---

  private async upsertUser(
    profile: OAuthUserProfile,
    provider: OAuthProvider,
  ): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { email: profile.email },
    });

    if (user) {
      user.name = profile.name;
      user.avatar_url = profile.avatar_url;
      return this.userRepository.save(user);
    }

    user = this.userRepository.create({
      email: profile.email,
      name: profile.name,
      avatar_url: profile.avatar_url,
      oauth_provider: provider,
      github_connected: false,
    });

    return this.userRepository.save(user);
  }

  async findUserById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  // --- JWT 발급 ---

  private issueJwt(user: User): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
      },
      this.jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: this.jwtExpiresIn as jwt.SignOptions['expiresIn'],
      },
    );
  }

  private issueRefreshToken(userId: string): string {
    return jwt.sign({ sub: userId, type: 'refresh' }, this.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: '7d',
    });
  }

  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const TTL = 7 * 24 * 60 * 60; // 7일
    await this.redis.set(`refresh:${userId}`, token, 'EX', TTL);
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: jwt.JwtPayload;

    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret, {
        algorithms: ['HS256'],
      });

      if (typeof decoded === 'string' || !decoded) {
        throw new UnauthorizedException('유효하지 않은 Refresh Token입니다.');
      }

      payload = decoded as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('유효하지 않은 Refresh Token입니다.');
    }

    const userId = payload['sub'];
    if (!userId || typeof userId !== 'string') {
      throw new UnauthorizedException('유효하지 않은 Refresh Token입니다.');
    }

    const storedToken = await this.redis.get(`refresh:${userId}`);
    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException('Refresh Token이 만료되었거나 무효화되었습니다.');
    }

    const user = await this.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    const accessToken = this.issueJwt(user);
    return { accessToken };
  }

  // --- GitHub Status (Internal API용) ---

  async getGitHubStatus(
    userId: string,
  ): Promise<{ github_connected: boolean; github_username: string | null }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }
    return {
      github_connected: user.github_connected,
      github_username: user.github_username,
    };
  }
}
