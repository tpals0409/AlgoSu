/**
 * @file OAuth 인증 컨트롤러 — 소셜로그인 + GitHub 연동 + 프로필 관리
 * @domain identity
 * @layer controller
 * @related OAuthService, JwtMiddleware, TokenRefreshInterceptor
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { OAuthService } from './oauth.service';
import { setTokenCookie } from '../cookie.util';

@Controller('auth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * OAuth 인증 시작 — 프로바이더 인증 URL 반환
   * @api GET /auth/oauth/:provider
   */
  @Get('oauth/:provider')
  async startOAuth(
    @Param('provider') provider: string,
  ): Promise<{ url: string }> {
    const { url } = await this.oauthService.getAuthorizationUrl(provider);
    return { url };
  }

  /**
   * OAuth 콜백 처리 — JWT를 httpOnly Cookie로 발급 후 프론트엔드 리다이렉트
   * @api GET /auth/oauth/:provider/callback
   * @guard cookie-auth
   */
  @Get('oauth/:provider/callback')
  async handleOAuthCallback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) {
      throw new BadRequestException('OAuth 콜백에 code 또는 state가 없습니다.');
    }

    const result = await this.oauthService.handleCallback(provider, code, state);

    this.logger.log(`OAuth 로그인 성공: provider=${provider}, userId=${result.user.id}`);

    // httpOnly Cookie로 JWT 발급 (fragment 전달 제거)
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    setTokenCookie(res, result.accessToken, nodeEnv);

    // 프론트엔드 리다이렉트 — github_connected만 fragment로 전달 (민감 정보 아님)
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const params = new URLSearchParams({
      github_connected: String(result.user.github_connected),
    });
    res.redirect(`${frontendUrl}/callback#${params.toString()}`);
  }

  /**
   * POST /auth/github/link — GitHub OAuth 연동 시작
   * GitHub OAuth Authorization URL을 반환한다.
   * 인증된 사용자만 접근 가능 (JWT 미들웨어 통과 후)
   */
  @Post('github/link')
  async linkGitHub(
    @Req() req: Request,
  ): Promise<{ url: string }> {
    const userId = req.headers['x-user-id'] as string;
    return this.oauthService.getGitHubAuthUrl(userId);
  }

  /**
   * GET /auth/github/link/callback — GitHub OAuth 연동 콜백
   * GitHub에서 code+state를 받아 토큰 교환 후 프론트엔드로 리다이렉트
   */
  @Get('github/link/callback')
  async handleGitHubLinkCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) {
      throw new BadRequestException('GitHub 콜백에 code 또는 state가 없습니다.');
    }

    const userId = await this.oauthService.validateAndConsumeGitHubLinkState(state);
    const user = await this.oauthService.linkGitHub(userId, code);

    this.logger.log(`GitHub 연동 완료: userId=${userId}, github=${user.github_username}`);

    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3001';
    const params = new URLSearchParams({
      github_connected: 'true',
      github_username: user.github_username ?? '',
    });
    res.redirect(`${frontendUrl}/github-link/complete#${params.toString()}`);
  }

  /**
   * DELETE /auth/github/link — GitHub 연동 해제
   */
  @Delete('github/link')
  async unlinkGitHub(
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = req.headers['x-user-id'] as string;
    await this.oauthService.unlinkGitHub(userId);
    this.logger.log(`GitHub 연동 해제: userId=${userId}`);

    return { message: 'GitHub 연동이 해제되었습니다.' };
  }

  /**
   * POST /auth/github/relink — GitHub 재연동
   * 기존 연동을 해제하고 새 GitHub 계정으로 연동 시작
   */
  @Post('github/relink')
  async relinkGitHub(
    @Req() req: Request,
  ): Promise<{ url: string }> {
    const userId = req.headers['x-user-id'] as string;
    return this.oauthService.getGitHubAuthUrl(userId);
  }

  /**
   * GET /auth/profile — 프로필 조회
   */
  @Get('profile')
  async getProfile(
    @Req() req: Request,
  ): Promise<{ email: string; name: string | null; avatar_url: string | null; oauth_provider: string | null }> {
    const userId = req.headers['x-user-id'] as string;
    const user = await this.oauthService.findUserById(userId);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }
    return {
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      oauth_provider: user.oauth_provider,
    };
  }

  /**
   * PATCH /auth/profile — 프로필 수정 (닉네임 / 아바타)
   */
  @Patch('profile')
  async updateProfile(
    @Req() req: Request,
    @Body('name') name: string | undefined,
    @Body('avatar_url') avatarUrl: string | undefined,
  ): Promise<{ name: string; avatar_url: string | null }> {
    const userId = req.headers['x-user-id'] as string;

    // name 검증 (전달된 경우만)
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new BadRequestException('닉네임을 입력해주세요.');
      }
      if (name.trim().length > 30) {
        throw new BadRequestException('닉네임은 30자 이하로 입력해주세요.');
      }
    }

    // avatar_url 검증 — preset: 형식만 허용
    if (avatarUrl !== undefined) {
      if (typeof avatarUrl !== 'string' || !avatarUrl.startsWith('preset:')) {
        throw new BadRequestException('유효하지 않은 아바타 형식입니다.');
      }
      if (avatarUrl.length > 50) {
        throw new BadRequestException('아바타 URL이 너무 깁니다.');
      }
    }

    if (name === undefined && avatarUrl === undefined) {
      throw new BadRequestException('변경할 항목이 없습니다.');
    }

    const user = await this.oauthService.updateProfile(
      userId,
      name?.trim(),
      avatarUrl,
    );
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    this.logger.log(`프로필 수정: userId=${userId}`);
    return { name: user.name ?? '', avatar_url: user.avatar_url };
  }

  /**
   * JWT 갱신 — Cookie의 기존 토큰으로 새 토큰 발급 (httpOnly Cookie 정책)
   * @api POST /auth/refresh
   * @guard cookie-auth
   */
  @Post('refresh')
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const token = req.cookies?.['token'] as string | undefined;
    if (!token) {
      throw new BadRequestException('인증 쿠키가 없습니다.');
    }

    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      throw new BadRequestException('인증 정보가 없습니다.');
    }

    const user = await this.oauthService.findUserByIdOrThrow(userId);
    const accessToken = this.oauthService.issueAccessToken(user);

    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    setTokenCookie(res, accessToken, nodeEnv);

    return { message: 'Token refreshed' };
  }

  /**
   * 로그아웃 — httpOnly Cookie 삭제
   * @api POST /auth/logout
   */
  @Post('logout')
  logout(
    @Res({ passthrough: true }) res: Response,
  ): { message: string } {
    res.clearCookie('token', { path: '/' });
    return { message: '로그아웃 되었습니다.' };
  }
}
