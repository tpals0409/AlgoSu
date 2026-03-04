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
    @Query('error') oauthError: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');

    // OAuth 제공자 에러 (사용자 거부 등) → 프론트엔드 에러 리다이렉트
    if (oauthError) {
      this.logger.warn(`OAuth 제공자 에러: provider=${provider}, error=${oauthError}`);
      res.redirect(`${frontendUrl}/callback#error=${encodeURIComponent(oauthError)}`);
      return;
    }

    if (!code || !state) {
      this.logger.warn(`OAuth 콜백 파라미터 누락: provider=${provider}`);
      res.redirect(`${frontendUrl}/callback#error=missing_params`);
      return;
    }

    try {
      const result = await this.oauthService.handleCallback(provider, code, state);

      this.logger.log(`OAuth 로그인 성공: provider=${provider}, userId=${result.user.id}`);

      // httpOnly Cookie로 JWT 발급
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
      setTokenCookie(res, result.accessToken, nodeEnv);

      // 프론트엔드 리다이렉트 — github_connected만 fragment로 전달 (민감 정보 아님)
      const params = new URLSearchParams({
        github_connected: String(result.user.github_connected),
      });
      res.redirect(`${frontendUrl}/callback#${params.toString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`OAuth 콜백 처리 실패: provider=${provider}, error=${message}`);

      // 중복 제공자 에러 등 사용자 친화 메시지 전달
      const isUserFacing = error instanceof BadRequestException;
      const errorParam = isUserFacing
        ? encodeURIComponent(message)
        : 'auth_failed';
      res.redirect(`${frontendUrl}/callback#error=${errorParam}`);
    }
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
    @Query('error') oauthError: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');

    if (oauthError) {
      this.logger.warn(`GitHub 연동 제공자 에러: error=${oauthError}`);
      res.redirect(`${frontendUrl}/github-link?error=${encodeURIComponent(oauthError)}`);
      return;
    }

    if (!code || !state) {
      this.logger.warn('GitHub 콜백 파라미터 누락');
      res.redirect(`${frontendUrl}/github-link?error=missing_params`);
      return;
    }

    try {
      const userId = await this.oauthService.validateAndConsumeGitHubLinkState(state);
      const result = await this.oauthService.linkGitHub(userId, code);

      this.logger.log(`GitHub 연동 완료: userId=${userId}, github=${result.github_username}`);

      const params = new URLSearchParams({
        github_connected: 'true',
        github_username: result.github_username ?? '',
      });
      res.redirect(`${frontendUrl}/github-link/complete#${params.toString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`GitHub 연동 실패: error=${message}`);
      res.redirect(`${frontendUrl}/github-link?error=link_failed`);
    }
  }

  /**
   * DELETE /auth/github/link — GitHub 연동 해제
   */
  @Delete('github/link')
  async unlinkGitHub(
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = req.headers['x-user-id'] as string;
    await this.oauthService.disconnectGitHub(userId);
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
  ): Promise<{
    email: string;
    name: string | null;
    avatar_url: string | null;
    oauth_provider: string | null;
    github_connected: boolean;
    github_username: string | null;
    created_at: Date;
  }> {
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
      github_connected: user.github_connected,
      github_username: user.github_username,
      created_at: user.created_at,
    };
  }

  /**
   * PATCH /auth/profile — 아바타 수정
   */
  @Patch('profile')
  async updateProfile(
    @Req() req: Request,
    @Body('avatar_url') avatarUrl: string | undefined,
  ): Promise<{ avatar_url: string }> {
    const userId = req.headers['x-user-id'] as string;

    if (avatarUrl === undefined) {
      throw new BadRequestException('변경할 항목이 없습니다.');
    }

    // avatar_url 검증 — preset: 형식만 허용
    if (typeof avatarUrl !== 'string' || !avatarUrl.startsWith('preset:')) {
      throw new BadRequestException('유효하지 않은 아바타 형식입니다.');
    }
    if (avatarUrl.length > 50) {
      throw new BadRequestException('아바타 URL이 너무 깁니다.');
    }

    await this.oauthService.updateAvatar(userId, avatarUrl);

    this.logger.log(`아바타 수정: userId=${userId}`);
    return { avatar_url: avatarUrl };
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

  /**
   * 회원탈퇴 (소프트 딜리트) — 계정 익명화 + 멤버십/알림 삭제
   * @api DELETE /auth/account
   * @guard jwt-auth
   */
  @Delete('account')
  async deleteAccount(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const userId = req.headers['x-user-id'] as string;
    await this.oauthService.softDeleteAccount(userId);
    res.clearCookie('token', { path: '/' });
    this.logger.log(`계정 소프트 딜리트: userId=${userId}`);
    return { message: '계정이 삭제되었습니다.' };
  }
}
